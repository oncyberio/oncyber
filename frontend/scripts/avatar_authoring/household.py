"""Fit a Rick-family household recipe to a canonical portrait and garment description."""

import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageOps
from scipy import ndimage
from scipy.signal import find_peaks
from scipy.spatial import ConvexHull

from .eye_review import lid_pupil, reference_pair


def pigment(rgb, xy):
    x, y = xy
    h, w = rgb.shape[:2]
    if not 0 <= x < w or not 0 <= y < h:
        raise ValueError("Pigment sample falls outside the portrait.")
    return np.median(rgb[max(0, y - 2) : y + 3, max(0, x - 2) : x + 3], axis=(0, 1))


def paint(values):
    return "#" + np.rint(values).astype(np.uint8).tobytes().hex()


def skull_depth(widths):
    jaw = widths[round(0.83 * (len(widths) - 1))]
    return {"chin": round(0.15 + 0.13 * jaw, 3), "forehead": 0.115, "cheek": 0.065}


def fit_crop_back(design):
    """Infer the hidden neckline from two measured ear lobes on a short crop."""
    scalp = design["household"]
    ears = scalp.get("ears", [])
    if (
        design["hair"]["cut"] != "crop"
        or len(ears) != 2
        or len(scalp.get("pinnae", [])) != 2
        or scalp.get("nape") is None
    ):
        return
    # The front can show the sideburn ending halfway down the ear. The
    # posterior crop usually reaches the neck below the lobe by ~0.75 ear
    # lengths. Retain a longer nape when visible in the supplied drawing.
    ends = [y + 2.5 * radius_y for _, y, _, radius_y in ears]
    if abs(ends[0] - ends[1]) < 0.11:
        scalp["rearHairline"] = round(
            float(np.clip(max(np.mean(ends), scalp.get("nape", 0)), 0.72, 0.97)), 4
        )


def frontal_lobes(rgb, mask, skin, hair, cx, eye_y, top, chin, width):
    from .tracing import ear_lobes

    near = np.linalg.norm(rgb - skin, axis=2)
    exposed = mask & (near < 75) & (near + 18 < np.linalg.norm(rgb - hair, axis=2))
    return [
        [(x - cx) / width, (y - top) / (chin - top), rx / width, ry / (chin - top)]
        for _, x, y, rx, ry in ear_lobes(exposed, cx, eye_y, chin, width)
    ]


def fit_frontal_features(design, lobes, units_per_pixel, *, separate_ears=False):
    """Seat the measured ear lobes and restore the ink margin outside each eye white."""
    household = design["household"]
    face = design["face"]
    width = design["head"][0]
    radius = width * face["eyeRadius"]
    margin = max(0.78, radius * 0.075) + 0.5 * units_per_pixel
    face["eyeRadius"] = round(min(0.24, (radius + margin) / width), 4)
    ears = [
        np.round(lobe, 4).tolist()
        for lobe in lobes
        if 0.22 <= abs(lobe[0]) <= 0.7
        and 0.35 <= lobe[1] <= 0.88
        and 0.01 <= lobe[2] <= 0.19
        and 0.02 <= lobe[3] <= 0.22
    ]
    if ears:
        household["ears"] = ears
        if separate_ears and len(ears) == 2:
            # The measured ear already owns the outer arc on these rows.
            # A skull fitted to that same outline hides the pinna in the cap.
            profile = np.array(household["widths"])
            t = np.linspace(0, 1, len(profile))
            radii = []
            for x, y, rx, ry in ears:
                distance = np.minimum(1, abs(t - y) / (1.45 * ry))
                blend = 1 - distance**2 * (3 - 2 * distance)
                root = abs(x) - rx * 0.20
                radii.append(
                    np.minimum(profile * 0.5, root) * blend
                    + profile * 0.5 * (1 - blend)
                )
            household["widths"] = np.sum(radii, axis=0).round(4).tolist()
    household["depth"] = skull_depth(household["widths"])


def mouth_bands(strip, teeth, pigments=None):
    """Bound the cavity inside both lips before finding teeth and tongue."""
    color = np.median(strip, axis=1)
    near = (np.linalg.norm(color - teeth, axis=1) < 49) & (np.ptp(color, axis=1) < 31)
    red = color[:, 0] - color[:, 1]
    cavity = (red > 31) & (color[:, 1] < 86)
    tongue_mask = cavity & (color[:, 0] > 120)
    if pigments and "cavity" in pigments:
        dark = np.array(pigments["cavity"])
        cavity = np.linalg.norm(color - dark, axis=1) < 70
        tongue_mask = np.zeros(len(color), dtype=bool)
        if "tongue" in pigments:
            target = np.array(pigments["tongue"])
            tongue_mask = (np.linalg.norm(color - target, axis=1) < 53) & (
                color[:, 0] > dark[0] + 26
            )
            cavity |= tongue_mask
    inside = np.flatnonzero(near | cavity)
    if not len(inside):
        return [0.5] * 5
    t = np.arange(len(strip))
    first, last = inside[0], inside[-1] + 1
    middle = (first + last) / 2
    upper = np.flatnonzero(near & (t < middle))
    lower = np.flatnonzero(near & (t >= middle))
    gum = upper[-1] + 1 if len(upper) else first
    lower_gum = lower[0] if len(lower) else last
    tongue = np.flatnonzero(tongue_mask & (t >= middle) & (t < lower_gum))
    start = tongue[0] if len(tongue) else lower_gum
    return (
        (np.array([first, gum, start, lower_gum, last]) / len(strip)).round(3).tolist()
    )


def scalp_boundary(
    rgb,
    mask,
    center,
    top,
    height,
    width,
    profile,
    skin,
    hair,
    *,
    yaw=0,
    projected_centers=None,
    hidden=None,
    band_color=None,
    eyes=(),
    cap_limit=0.93,
):
    """Intersect each skull meridian with visible cap pigment before the first exposed skin."""
    if np.linalg.norm(skin - hair) < 35:
        return None
    ts = np.linspace(0.035, cap_limit, 125)
    radius = np.interp(ts, np.linspace(0, 1, len(profile)), profile) * width / 2
    ys = np.rint(top + ts * height).astype(int).clip(0, mask.shape[0] - 1)
    line = []
    for a in np.linspace(-np.pi / 2, np.pi / 2, 23 if hidden else 19):
        if hidden and np.cos(a + yaw) < 0.19:
            line.append(np.nan)
            continue
        axis = projected_centers[ys - top] if projected_centers is not None else center
        xs = (
            np.rint(axis + np.sin(a + yaw) * radius * 0.965)
            .astype(int)
            .clip(0, mask.shape[1] - 1)
        )
        v = rgb[ys, xs]
        dh = np.linalg.norm(v - hair, axis=1)
        ds = np.linalg.norm(v - skin, axis=1)
        locks = (dh < 62) & (dh + 18 < ds) & mask[ys, xs]
        exposed = (ds < 65) & (ds + 13 < dh) & mask[ys, xs]
        # An outlined eye can occupy the whole area immediately below a
        # fringe. Its white marks the end of the bang as clearly as skin.
        for eye in eyes:
            if eye:
                l, upper, r, lower = eye
                exposed |= (
                    (xs >= l)
                    & (xs < r)
                    & (ys >= upper)
                    & (ys < lower)
                    & (v.min(1) > 164)
                    & (np.ptp(v, axis=1) < 41)
                )
        if band_color is not None:
            # Pale aqua and peach can be closer than a JPEG skin tolerance.
            # A crown accessory can cross a meridian before the visible forehead.
            exposed &= ds + 8 < np.linalg.norm(v - band_color, axis=1)
        if not hidden and abs(a) > 1.1 and locks[ts > 0.73].sum() > 4:
            cut = ts[np.where(locks)[0][-1]]
        else:
            visible = np.flatnonzero(
                np.convolve(exposed.astype(int), np.ones(4, dtype=int), mode="valid")
                >= 3
            )
            end = visible[0] if len(visible) else len(ts) - 1
            last = np.flatnonzero(locks[: end + 1])
            if len(last):
                cut = ts[last[-1]] + 0.004
            elif len(visible):
                cut = ts[end]
            else:
                line.append(np.nan)
                continue
        line.append(round(float(np.clip(cut, 0.035, 0.93)), 4))
    valid = np.flatnonzero(np.isfinite(line))
    if len(valid) < 8:
        return None
    result = np.interp(np.arange(len(line)), valid, np.array(line)[valid])
    if hidden:
        # Join the far temple at the last visible lock. Carry the unobserved
        # change of height from the haircut, keeping the junction continuous.
        prior = np.interp(
            np.linspace(0, 1, len(line)), np.linspace(0, 1, len(hidden)), hidden
        )
        for part, edge in [
            (slice(None, valid[0]), valid[0]),
            (slice(valid[-1] + 1, None), valid[-1]),
        ]:
            result[part] += prior[part] - prior[edge]
    return np.clip(result, 0.035, 0.93).round(4).tolist()


def projected_band_width(tilt, yaw, aspect):
    """Project one radian of strap width onto the visible crown, normal to the strip."""
    a = np.linspace(-1.81, 1.81, 97)

    def curve(edge):
        cross = edge - 0.1 * np.sin(a) ** 2
        up = np.cos(cross) * np.cos(a)
        lateral = np.cos(cross) * np.sin(a)
        forward = up * np.sin(tilt) + np.sin(cross) * np.cos(tilt)
        vertical = -up * np.cos(tilt) + np.sin(cross) * np.sin(tilt)
        x = lateral * 0.5 * np.cos(yaw) + forward * 0.46 * np.sin(yaw)
        return np.column_stack((x, vertical * aspect / 2)), forward * np.cos(
            yaw
        ) - lateral * np.sin(yaw)

    axis, visible = curve(0)
    tangent = np.gradient(axis, axis=0)
    tangent /= np.linalg.norm(tangent, axis=1)[:, None]
    across = (curve(0.001)[0] - curve(-0.001)[0]) / 0.001
    normal = abs(across[:, 0] * tangent[:, 1] - across[:, 1] * tangent[:, 0])
    # The woven color occupies 81% of the strip between its dark bound edges.
    return 0.81 * np.median(normal[visible > 0.1])


def scalp_band(rgb, mask, top, height, width, skin, hair, seed=None, yaw=0):
    """Identify a continuous contrasting strip running from crown to temple."""
    rows, cols = np.nonzero(mask)
    if not len(rows):
        return
    left, right = cols.min(), cols.max() + 1
    bottom = min(mask.shape[0], int(top + height * 0.67))
    area = rgb[top:bottom, left:right]
    eligible = (
        mask[top:bottom, left:right]
        & (area.min(2) > 48)
        & (np.linalg.norm(area - skin, axis=2) > 40)
        & (np.linalg.norm(area - hair, axis=2) > 50)
    )
    if seed:
        colors = [pigment(rgb, seed)]
    else:
        # The upper cap excludes eyebrows, eyes, and ears as color candidates.
        upper = eligible[: max(1, round(0.21 * height))]
        swatches = area[: len(upper)][upper]
        if not len(swatches):
            return
        bins, counts = np.unique(
            (swatches / 20).astype(int), axis=0, return_counts=True
        )
        colors = [
            np.median(
                swatches[np.all((swatches / 20).astype(int) == bins[i], axis=1)], axis=0
            )
            for i in counts.argsort()[-5:][::-1]
        ]
    for color in colors:
        same = eligible & (np.linalg.norm(area - color, axis=2) < 36)
        labels, n = ndimage.label(same, structure=np.ones((3, 3)))
        if not n:
            continue
        y, x = (seed[1] - top, seed[0] - left) if seed else (0, 0)
        label = (
            labels[y, x]
            if seed and 0 <= y < len(area) and 0 <= x < area.shape[1]
            else 0
        )
        if seed and not label:
            continue
        if not label:
            label = np.bincount(labels.ravel())[1:].argmax() + 1
        strip = labels == label
        yy, xx = np.nonzero(strip)
        h, w = np.ptp(yy) + 1, np.ptp(xx) + 1
        if h < 0.22 * height or w < 0.20 * width or yy.min() > 0.2 * height:
            continue
        distance = ndimage.distance_transform_edt(strip)
        thickness = 2 * np.percentile(distance[strip], 92) / width
        if not 0.015 <= thickness <= 0.11 or strip.sum() / (w * h) > 0.47:
            continue
        tilt = np.arccos(
            np.clip(1 - 2 * (yy.min() + thickness * width / 2) / height, -1, 1)
        )
        tilt = float(np.clip(tilt, 0.12, 0.75))
        angular_width = thickness / max(
            0.16, projected_band_width(tilt, yaw, height / width)
        )
        return {
            "color": paint(
                np.median(area[strip & (distance >= distance.max() * 0.5)], axis=0)
            ),
            "width": round(float(np.clip(angular_width, 0.015, 0.24)), 4),
            "tilt": round(tilt, 3),
        }


def observe_eye(rgb, box):
    x, y, r, b = box
    if not (0 <= x < r <= rgb.shape[1] and 0 <= y < b <= rgb.shape[0]):
        raise ValueError("An eye box falls outside the portrait.")
    patch = rgb[y:b, x:r]
    white = (patch.min(2) > 192) & (np.ptp(patch, axis=2) < 29)
    labels, count = ndimage.label(white)
    if not count:
        raise ValueError("The eye box must include an exposed white.")
    mask = ndimage.binary_fill_holes(
        labels == np.bincount(labels.ravel())[1:].argmax() + 1
    )
    yy, xx = np.where(mask)
    cx, cy = (xx.min() + xx.max()) / 2, (yy.min() + yy.max()) / 2
    rx, ry = (np.ptp(xx) + 1) / 2, (np.ptp(yy) + 1) / 2
    dark = (patch.max(2) < 108) & ndimage.binary_erosion(mask)
    labels, count = ndimage.label(dark)
    if not count:
        notch = lid_pupil(mask, patch)
        if notch is not None:
            mask |= notch
            labels, count = ndimage.label(notch)
    if not count:
        # A sideward gaze can touch the rim. Recover the compact black mark
        # adjacent to the white without picking up the longer colored eyelid.
        near = ndimage.binary_dilation(mask, iterations=3)
        labels, count = ndimage.label(
            near & (patch.max(2) < 90) & (np.ptp(patch, axis=2) < 24)
        )
    if not count:
        raise ValueError("A distinct pupil must be visible inside each eye.")
    py, px = np.where(labels == np.bincount(labels.ravel())[1:].argmax() + 1)
    edge = mask & ~ndimage.binary_erosion(mask)
    yy, xx = np.where(edge)
    points = np.column_stack(((xx - cx) / rx, (yy - cy) / ry))
    angle = np.arctan2(points[:, 1], points[:, 0])
    rim = []
    for a in np.arange(24) * np.pi / 12:
        dist = abs(np.angle(np.exp(1j * (angle - a))))
        subset = points[np.argsort(dist)[:2]]
        rim.append(subset[np.argmax(np.linalg.norm(subset, axis=1))])
    return {
        "center": np.array([x + cx, y + cy]),
        "radius": np.array([rx, ry]),
        "rim": np.array(rim),
        "pupil": np.array([(px.mean() - cx) / rx, (py.mean() - cy) / ry]),
        "pupil_fraction": float(np.sqrt(len(px) / np.pi) / rx),
    }


def enclosed_gaze(eye, pupil):
    """Project an oblique single-eye estimate into its measured aperture."""
    radius = eye["radius"]
    resolution = 80
    ratio = radius[1] / radius[0]
    origin = np.array([resolution + 2, np.ceil(resolution * ratio) + 2])
    size = tuple((2 * origin + 1).astype(int))
    shape = Image.new("1", size)
    scale = np.array([resolution, resolution * ratio])
    ImageDraw.Draw(shape).polygon(
        [tuple(p) for p in eye["rim"] * scale + origin], fill=1
    )
    inside = ndimage.distance_transform_edt(np.asarray(shape)) >= resolution * max(
        0.18, 2 * eye["pupil_fraction"]
    )
    ys, xs = np.where(inside)
    if not len(ys):
        return pupil
    options = (np.column_stack((xs, ys)) - origin) / scale
    # An oblique drawing constrains the exposed gaze at one camera angle.
    # Reserve corneal curvature on both axes when moving that gaze to 0°.
    # Near the top corner the optical projection approaches the lid sooner
    # than the projected 2D outline does.
    central = options[np.linalg.norm(options, axis=1) <= 0.64]
    if len(central):
        options = central
    return options[np.argmin(((options - pupil) ** 2).sum(axis=1))]


def frontal_jaw_widths(rgb, region, center, top, height, width, skin, hair):
    """Measure the connected cheek pigment. Hair, ears and neck are separate landmarks."""
    if height < 40 or width < 24:
        return None
    near_skin = np.linalg.norm(rgb - skin, axis=2)
    skin_pixels = (
        region
        & (near_skin < 58)
        & (near_skin + 12 < np.linalg.norm(rgb - hair, axis=2))
    )
    # The central cheek is one 2D region even when a mouth, nose or an
    # eye divides a scanline. Ear lobes across an ink contour are islands.
    y0 = max(0, top)
    y1 = min(rgb.shape[0], top + height + 1)
    x0 = max(0, round(center - width * 0.58))
    x1 = min(rgb.shape[1], round(center + width * 0.58))
    regions, _ = ndimage.label(skin_pixels[y0:y1, x0:x1])
    middle = round(center - x0)
    votes = regions[
        round(height * 0.58) : round(height * 0.92),
        max(0, middle - round(width * 0.23)) : middle + round(width * 0.23) + 1,
    ]
    sizes = np.bincount(votes.ravel())
    if len(sizes) < 2:
        return None
    face = regions == (np.argmax(sizes[1:]) + 1)
    widths = []
    for t in np.linspace(0.60, 0.95, 8):
        y = round(top + t * height) - y0
        half = max(1, round(height * 0.012))
        samples = []
        for row in face[max(0, y - half) : y + half + 1]:
            xs = np.flatnonzero(row)
            if len(xs) and xs[0] < middle < xs[-1]:
                samples.append((np.ptp(xs) + 2) / width)
        widths.append(float(np.median(samples)) if samples else np.nan)
    visible = np.flatnonzero(np.isfinite(widths))
    if len(visible) < 5 or visible[-1] < 6:
        return None
    return (
        np.clip(np.interp(range(8), visible, np.asarray(widths)[visible]), 0.04, 1.15)
        .round(4)
        .tolist()
    )


def fit_portrait(source, observations, figure=None, rgb=None):
    if rgb is None:
        with Image.open(source) as image:
            rgb = np.asarray(ImageOps.exif_transpose(image).convert("RGB"), dtype=float)
    guide = observations
    if not -90 < guide["yaw"] < 90:
        raise ValueError(
            "Use a front or three-quarter portrait with both eyes visible."
        )
    top, bottom = guide["height_range"]
    if not 0 <= top < bottom <= rgb.shape[0]:
        raise ValueError("Mark the crown and chin in descending image order.")
    design = dict(guide["body"])
    if "base" in guide:
        # A series portrait can share an established body, cut and wardrobe.
        catalog = (
            Path(__file__).resolve().parents[2] / "public/lobby/procedural/recipes"
        )
        base = guide["base"]
        if base not in ("morty-smith", "summer-smith", "beth-smith", "jerry-smith"):
            raise ValueError("Choose a registered household body")
        original = json.loads((catalog / (base + ".json")).read_text())["design"]
        design = {**original, **design}
        design.pop("household", None)
    skin, hair = [pigment(rgb, guide[k]) for k in ("skin", "hair")]
    clip = Image.new("1", (rgb.shape[1], rgb.shape[0]))
    ImageDraw.Draw(clip).polygon([tuple(p) for p in guide["head_region"]], fill=1)
    mask = np.asarray(clip) & (
        (np.linalg.norm(rgb - skin, axis=2) < 26)
        | (np.linalg.norm(rgb - hair, axis=2) < 32)
    )
    mask = (np.asarray(clip) & figure) if figure is not None else mask
    mask = ndimage.binary_fill_holes(ndimage.binary_closing(mask, iterations=1))
    # The eye, ear and sideburn interrupt the skin-colored cheek in an oblique
    # still. The unbroken vault and jaw beneath them are convex in this family.
    yy, xx = np.nonzero(mask)
    points = np.column_stack((xx, yy))
    if len(points) < 4:
        raise ValueError("The head region must include both hair and skin.")
    hull = points[ConvexHull(points).vertices]
    silhouette = Image.new("1", clip.size)
    ImageDraw.Draw(silhouette).polygon([tuple(map(int, p)) for p in hull], fill=1)
    mask = np.asarray(silhouette)
    height = bottom - top
    widths = []
    for y in np.linspace(top, bottom, 17):
        rows = mask[max(0, round(y) - 1) : round(y) + 2]
        extents = [np.ptp(np.flatnonzero(row)) + 1 for row in rows if row.any()]
        widths.append(float(np.median(extents)) if extents else 0)
    width = max(widths)
    widths[0] = widths[-1] = 0
    if guide.get("trace_hairline"):
        centers = []
        for y in range(top, bottom + 1):
            xx = np.flatnonzero(mask[y])
            centers.append((xx[0] + xx[-1]) * 0.5 if len(xx) else np.nan)
        good = np.flatnonzero(np.isfinite(centers))
        centers = np.interp(np.arange(height + 1), good, np.array(centers)[good])
        traced = scalp_boundary(
            rgb,
            mask,
            centers[len(centers) // 2],
            top,
            height,
            width,
            np.array(widths) / width,
            skin,
            hair,
            yaw=np.deg2rad(guide["yaw"]),
            projected_centers=centers,
            hidden=design["hairline"],
            eyes=guide.get("eyes", []) if "portrait_preset" in guide else (),
            band_color=pigment(rgb, guide["band_sample"])
            if "band_sample" in guide
            else None,
        )
        if traced:
            design["hairline"] = traced
    boxes = guide.get("eyes")
    if boxes is None:
        found = reference_pair(Image.fromarray(rgb.astype(np.uint8)))
        if len(found) != 2:
            raise ValueError(
                "Could not separate the two eyes; supply two eye boxes in the guide."
            )
        boxes = []
        for item in found:
            x, y, r, b = item["bounds"]
            boxes.append(
                [
                    max(0, x - 4),
                    max(0, y - 4),
                    min(rgb.shape[1], r + 4),
                    min(rgb.shape[0], b + 4),
                ]
            )
    if len(boxes) != 2:
        raise ValueError("Mark the two eyes from left to right.")
    eye_patch = guide.get("eye_patch")
    if eye_patch:
        index = 0 if eye_patch["side"] == "right" else 1
        if boxes[index] is not None or boxes[1 - index] is None:
            raise ValueError("Mark only the exposed eye for an eyepatch")
        eye = observe_eye(rgb, boxes[1 - index])
        x, y, r, b = eye_patch["box"]
        if not (0 <= x < r <= rgb.shape[1] and 0 <= y < b <= rgb.shape[0]):
            raise ValueError("The patch box falls outside the portrait")
        covered = {**eye, "center": np.array([(x + r) / 2, eye["center"][1]])}
        eyes = [covered, eye] if index == 0 else [eye, covered]
    else:
        eyes = [observe_eye(rgb, box) for box in boxes]
    if eyes[0]["center"][0] >= eyes[1]["center"][0]:
        raise ValueError("Eye boxes must run from left to right.")
    yaw = np.deg2rad(guide["yaw"])
    # A round globe keeps almost its full width in an oblique view. The spacing
    # between the left and right sockets foreshortens with the skull.
    spacing = (eyes[1]["center"][0] - eyes[0]["center"][0]) / 2 / np.cos(yaw) / width
    eye_y = float(np.mean([e["center"][1] for e in eyes]))
    radii = np.mean([e["radius"] for e in eyes], axis=0)
    design["head"] = [round(design["head"][1] * width / height, 2), design["head"][1]]
    design.update(
        skin=paint(skin),
        hair={**design["hair"], "color": paint(hair)},
        household={
            "widths": np.round(np.array(widths) / width, 3).tolist(),
            "orbits": [],
            **(
                {"portraitPreset": guide["portrait_preset"]}
                if "portrait_preset" in guide
                else {}
            ),
        },
    )
    if abs(guide["yaw"]) < 5:
        center = float(np.mean([eye["center"][0] for eye in eyes]))
        jaw = frontal_jaw_widths(
            rgb, np.asarray(clip), center, top, height, width, skin, hair
        )
        if jaw:
            design["household"]["jawWidths"] = jaw
    design["outfit"] = {
        **design["outfit"],
        "color": paint(pigment(rgb, guide["shirt"])),
    }
    design["face"] = {
        **design["face"],
        "eyeHeight": round((eye_y - top) / height, 4),
        "eyeSpacing": round(float(np.clip(spacing, 0.12, 0.33)), 4),
        "eyeRadius": round(float(np.clip(radii[0] / width, 0.085, 0.24)), 4),
        "eyeAspect": round(
            float(
                np.clip(radii[1] / radii[0], 0.28 if "lids" in guide else 0.52, 1.18)
            ),
            4,
        ),
        "noseBase": round((guide["nose_y"] - top) / height, 4),
        "mouthHeight": round((guide["mouth_y"] - top) / height, 4),
    }
    if eye_patch:
        x, y, r, b = eye_patch["box"]
        design["household"]["eyePatch"] = {
            "side": eye_patch["side"],
            "color": paint(pigment(rgb, eye_patch["color"])),
            "strap": paint(pigment(rgb, eye_patch["strap"])),
            "width": round((r - x) / (2 * width * np.cos(yaw)), 4),
            "height": round((b - y) / (2 * height), 4),
            "lift": round(((y + b) / 2 - eye_y) / height, 4),
        }
    if figure is not None or "band_sample" in guide:
        band = scalp_band(
            rgb,
            np.asarray(clip) & (figure if figure is not None else True),
            top,
            height,
            width,
            skin,
            hair,
            guide.get("band_sample"),
            yaw,
        )
        if band:
            design["household"]["headband"] = band
        elif "band_sample" in guide:
            raise ValueError(
                "The sampled headband must form a continuous strip across the crown"
            )
    if "ear_box" in guide:
        left, upper, right, lower = guide["ear_box"]
        if not (0 <= left < right <= rgb.shape[1] and top < upper < lower < bottom):
            raise ValueError("Mark the visible ear inside the skull height")
        y = ((upper + lower) / 2 - top) / height
        radius = (right - left) / (2 * width) * np.cos(yaw)
        span = np.interp(y, np.linspace(0, 1, len(widths)), widths) / width
        site = round(float(0.50 * span - radius * 0.36), 4)
        lobe = [round(float(x), 4) for x in [y, radius, (lower - upper) / (2 * height)]]
        design["household"]["ears"] = [[-site, *lobe], [site, *lobe]]
        # The helix presents nearly its broadside aspect in a side view.
        # Its apparent width in this portrait gives its turn toward the face.
        broadside = min(1, (right - left) / ((lower - upper) * 0.9))
        design["household"]["earTurn"] = round(
            float(np.clip(np.arcsin(broadside) - abs(yaw), 0, 0.8)), 3
        )
        design["household"]["depth"] = skull_depth(design["household"]["widths"])
    if "nose_stroke" in guide:
        stroke = np.array(guide["nose_stroke"], dtype=float)
        # Store the crease around the anatomical midline in the same units as
        # the skull recipe. The renderer supplies depth from the shared nose.
        stroke[:, 0] = (
            stroke[:, 0] - (stroke[:, 0].min() + stroke[:, 0].max()) / 2
        ) / (width * np.cos(yaw))
        stroke[:, 1] = (stroke[:, 1] - top) / height
        design["household"]["noseStroke"] = stroke.round(4).tolist()
    if "mouth_box" in guide:
        x, y, r, b = guide["mouth_box"]
        patch = rgb[y:b, x:r]
        luma = patch @ [0.2126, 0.7152, 0.0722]
        # Thin antialiased lip lines often connect only at a diagonal.
        labels, count = ndimage.label(
            luma < 0.78 * (skin @ [0.2126, 0.7152, 0.0722]), structure=np.ones((3, 3))
        )
        if not count:
            raise ValueError("The mouth box must contain the lip line or open mouth.")
        mark = labels == np.bincount(labels.ravel())[1:].argmax() + 1
        cols = np.unique(np.nonzero(mark)[1])
        if len(cols) < 4:
            raise ValueError("The mouth is too small to measure.")
        mid = (cols[0] + cols[-1]) / 2
        lips = []
        painted = guide.get("tooth_sample")
        bands = []
        pigments = guide.get("mouth_pigments")
        teeth = (
            np.array(pigments["teeth"])
            if pigments
            else pigment(rgb, painted)
            if painted
            else None
        )
        for col in np.unique(
            np.rint(np.linspace(0, len(cols) - 1, 17 if painted else 9)).astype(int)
        ):
            cx = cols[col]
            ys = np.flatnonzero(mark[:, cx])
            if painted:
                a, b = ys[0], ys[-1]
                strip = patch[a : b + 1, max(0, cx - 1) : cx + 2]
                bands.append(mouth_bands(strip, teeth, pigments))
            lips.append(
                [
                    (cx - mid) / (width * np.cos(yaw)),
                    (y + ys[0] - top) / height,
                    (y + ys[-1] - top) / height,
                ]
            )
        design["household"]["lips"] = np.array(lips).round(4).tolist()
        design["household"]["lipInk"] = paint(np.median(patch[mark], axis=0))
        if painted:
            # Dark tooth divisions interrupt the bright enamel in single
            # columns. Continue its upper and lower edge through those gaps.
            # Store the division separately as a narrow painted stroke.
            edges = np.array(bands)
            stations = np.arange(len(edges))
            enamel = np.flatnonzero(edges[:, 1] - edges[:, 0] > 0.018)
            if len(enamel) >= 3:
                span = slice(enamel[0], enamel[-1] + 1)
                for col in (0, 1):
                    edges[span, col] = np.interp(
                        stations[span], enamel, edges[enamel, col]
                    )
            # The source is a small JPEG. Suppress isolated single-column
            # compression steps along the tongue and lips at projected scale.
            edges = ndimage.gaussian_filter1d(edges, 0.7, axis=0, mode="nearest")
            edges[0] = edges[-1] = 0.5
            design["household"]["mouthPaint"] = {
                "teeth": paint(teeth),
                "bands": edges.round(3).tolist(),
            }
            if pigments and "cavity" in pigments:
                design["household"]["lipInk"] = paint(pigments["cavity"])
            if pigments and "tongue" in pigments:
                design["household"]["mouthPaint"]["tongue"] = paint(pigments["tongue"])
            if "tongue_sample" in guide:
                design["household"]["mouthPaint"]["tongue"] = paint(
                    pigment(rgb, guide["tongue_sample"])
                )
            # Thin vertical contacts between adjacent teeth interrupt the
            # otherwise bright upper row. Measure their spacing from the photo.
            values = []
            for cx in cols:
                ys = np.flatnonzero(mark[:, cx])
                y0, y1 = ys[0], ys[-1] + 1
                end = min(y1, y0 + max(2, round((y1 - y0) * 0.48)))
                values.append(np.percentile(luma[y0:end, cx], 82))
            neighbors, _ = find_peaks(
                -ndimage.gaussian_filter1d(np.array(values), 0.55),
                prominence=17,
                distance=max(2, round(len(cols) * 0.11)),
            )
            seams = [
                round(float((cols[i] - cols[0]) / (cols[-1] - cols[0])), 3)
                for i in neighbors
                if len(cols) * 0.15 < i < len(cols) * 0.85
            ]
            if seams:
                design["household"]["mouthPaint"]["seams"] = seams
        if guide.get("creases"):
            guides = []
            for crease in guide["creases"]:
                points = np.array(crease, dtype=float)
                points[:, 0] = (points[:, 0] - x - mid) / (width * np.cos(yaw))
                points[:, 1] = (points[:, 1] - top) / height
                guides.append(points.round(4).tolist())
            design["household"]["creases"] = guides
    if "lip_fill" in guide:
        design["household"]["lipColor"] = paint(pigment(rgb, guide["lip_fill"]))
        if "lip_ink" in guide:
            design["household"]["lipInk"] = paint(
                rgb[tuple(reversed(guide["lip_ink"]))]
            )
    if "fall_rows" in guide:
        design["household"]["fallRows"] = guide["fall_rows"]
    # Remove the camera's contribution to the apparent gaze on the cornea.
    for i, eye in enumerate(eyes):
        p = eye["pupil"].copy()
        p[0] = np.clip((p[0] - 0.72 * np.sin(yaw)) / np.cos(yaw), -0.78, 0.78)
        if eye_patch:
            p = enclosed_gaze(eye, p)
        design["household"]["orbits"].append(
            {
                "rim": eye["rim"].round(3).tolist(),
                "pupil": p.clip(-0.8, 0.8).round(3).tolist(),
                **(
                    {
                        "brow": (
                            (np.array(guide["brows"][i]) - eye["center"])
                            / eye["radius"]
                        )
                        .round(3)
                        .tolist()
                    }
                    if "brows" in guide
                    else {}
                ),
            }
        )
        lift = float((eye["center"][1] - eye_y) / height)
        if (figure is not None or guide.get("gaze_camera")) and abs(lift) > 0.006:
            design["household"]["orbits"][-1]["lift"] = round(
                float(np.clip(lift, -0.06, 0.06)), 4
            )
        if guide.get("gaze_camera") and abs(guide["yaw"]) >= 5:
            design["household"]["orbits"][-1]["observedGaze"] = [
                guide["yaw"],
                round(float((eye["pupil"][0] + 1) / 2), 4),
            ]
        if "lids" in guide and guide["lids"][i]:
            points = (np.array(guide["lids"][i]) - eye["center"]) / eye["radius"]
            design["household"]["orbits"][-1]["lid"] = points.round(3).tolist()
    if "lids" in guide:
        # A shallow visible slit makes its upper/lower clipping dominate the
        # inferred vertical gaze. Both pupils still look at the same height.
        orbits = design["household"]["orbits"]
        y = round(float(np.mean([eye["pupil"][1] for eye in orbits])), 3)
        for orbit in orbits:
            orbit["pupil"][1] = y
    design["pupil"] = {
        "radius": round(
            float(np.clip(np.median([e["pupil_fraction"] for e in eyes]), 0.06, 0.24)),
            3,
        ),
        "height": 0,
        "aspect": 1,
    }
    return {
        "version": 1,
        "name": guide["name"],
        "style": "family",
        "family": "rick-classic",
        "construction": "household",
        "design": design,
    }
