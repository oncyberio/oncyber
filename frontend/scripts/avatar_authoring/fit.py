"""Compile image observations into the shared cartoon builder's coordinates."""

import numpy as np
from jsonschema import Draft202012Validator
from PIL import Image, ImageOps
from scipy import ndimage

from .eyes import lower_eye_ink, measure_eye
from .observation import fitted_observation, image_landmarks, observations_v1
from .outerwear import measure_coat
from .tracing import (
    bob_ink,
    chin_ink,
    crew_neckline,
    crown_contour,
    side_part_notch,
    ear_lobes,
    eye_strokes,
    eyebrow,
    facial_creases,
    forehead_lock,
    open_hand,
    filled_brow,
    garment_seams,
    mouth_profile,
    nape_contour,
    radial_crown,
    joined_brow,
    brow_covered_by_hair,
    painted_open_mouth,
    nose_stroke,
    scalp_pigment,
    shoe_sections,
    sleeve_cuff,
    shirt_mark,
)


def clear_enclosed_leg_gap(mask, paper):
    """A contact shadow joining two feet can enclose real paper between the legs."""
    y, x = np.nonzero(mask)
    if not len(y):
        return
    height, center = np.ptp(y), (x.min() + x.max()) / 2
    if height < 24 or np.ptp(x) < height * 0.4:
        return
    # Limit the search to a long, central opening terminating near the floor.
    # Matching the paper pigment alone would also remove pale eyes and shirts.
    start = y.min() + int(height * 0.45)
    labels, _ = ndimage.label(mask[start:] & paper[start:])
    for label, area in enumerate(ndimage.find_objects(labels), 1):
        if area is None:
            continue
        rows, cols = area
        if (rows.stop - rows.start < height * 0.1 or
                rows.start == 0 or start + rows.stop < y.min() + 0.94 * height or
                cols.start > center or cols.stop <= center or
                max(center - cols.start, cols.stop - center) > height * 0.12):
            continue
        # The opening has a full leg on either side for most of its height.
        block = labels[area] == label
        widths = block.sum(1)
        if np.median(widths) < max(2, height * 0.008):
            continue
        mask[start:][area] &= ~ndimage.binary_fill_holes(block)


def pixels(path, keep_components=False):
    with Image.open(path) as source:
        if source.width * source.height > 24_000_000:
            raise ValueError("Reference exceeds 24 megapixels")
        im = ImageOps.exif_transpose(source).convert("RGBA")
        im.thumbnail((1600, 1600), Image.Resampling.LANCZOS)
        arr = np.asarray(im)
    rgb = arr[:, :, :3].astype(float)
    alpha = arr[:, :, 3]
    near = None
    if np.mean(alpha < 10) > 0.05:
        mask = alpha > 127
    else:
        corners = np.stack(
            [
                block.reshape(-1, 3).mean(0)
                for block in [rgb[:5, :5], rgb[:5, -5:], rgb[-5:, :5], rgb[-5:, -5:]]
            ]
        )
        if np.ptp(corners, axis=0).max() > 32:
            raise ValueError("Use a transparent or uniform contrasting background")
        backdrop = np.median(corners, axis=0)
        border = np.concatenate((rgb[0], rgb[-1], rgb[1:-1, 0], rgb[1:-1, -1]))
        # A lossless flat background has a known color. The wider tolerance
        # for shaded paper would flood through pale sleeves and split a T-pose.
        flat = np.all(np.ptp(corners, axis=0) == 0) and np.mean(
            np.all(border == backdrop, axis=1)
        ) >= 0.995
        # Estimate the variation of this sheet. On a near-uniform cream
        # background a fixed 24-level flood eats a white mascot jersey.
        paper_noise = np.percentile(np.max(abs(border - backdrop), axis=1), 99.8)
        tolerance = 4 if flat else float(np.clip(paper_noise + 2.5, 4, 24))
        near = np.max(np.abs(rgb - backdrop), axis=2) < tolerance
        if not flat:
            # Close breaks a couple of source pixels wide in pale garment
            # outlines, while retaining the gaps between the head, rays and body.
            barrier = ndimage.binary_closing(~near, iterations=max(1, round(min(near.shape) / 800)))
            near &= ~barrier
        # Preserve background visible between separated legs or fingers.
        seeds = np.zeros_like(near)
        seeds[0] = near[0]
        seeds[-1] = near[-1]
        seeds[:, 0] = near[:, 0]
        seeds[:, -1] = near[:, -1]
        mask = ~ndimage.binary_propagation(seeds, mask=near)
    labels, n = ndimage.label(mask)
    if not n:
        raise ValueError("The image has no foreground")
    areas = np.bincount(labels.ravel())
    areas[0] = 0
    mask = (areas[labels] >= max(3, areas.max() * 0.0001)) if keep_components else labels == np.argmax(areas)
    if near is not None:
        clear_enclosed_leg_gap(mask, near)
    if mask.mean() < 0.02 or mask.mean() > 0.90:
        raise ValueError("Expected one isolated full-body character")
    return rgb, mask


def bounds(mask):
    ys, xs = np.nonzero(mask)
    if not len(xs):
        raise ValueError("Empty measured region")
    return (int(xs.min()), int(ys.min()), int(xs.max() + 1), int(ys.max() + 1))


def fit(path, obs, measure=True):
    Draft202012Validator(
        observations_v1
        if isinstance(obs, dict) and obs.get("version") == 1
        else fitted_observation
    ).validate(obs)
    rgb, mask = pixels(path)
    h, w = mask.shape

    def point(p):
        return np.array(
            [round(p["x"] * (w - 1) / 1000), round(p["y"] * (h - 1) / 1000)]
        )

    lm = {k: point(v) for k, v in image_landmarks(obs).items()}

    def swatch(p, role):
        x, y = point(p)
        if not mask[y, x]:
            raise ValueError(f"The {role} swatch is outside the character")
        r = max(1, round(min(h, w) / 500))
        block = rgb[max(0, y - r) : y + r + 1, max(0, x - r) : x + r + 1]
        return np.median(block.reshape(-1, 3), axis=0)

    paints = {k: swatch(p, k) for k, p in obs["samples"].items()}
    bands = [swatch(b["sample"], "band") for b in obs["bands"]]
    # A point on a lace or a shaded seam can miss the shoe's base pigment.
    # Vote inside both shoe silhouettes, with a color-distance penalty to retain contrast panels.
    shoe_region = mask.copy()
    shoe_region[: lm["ankle"][1] + 1] = False
    shoe_region = ndimage.binary_erosion(shoe_region, iterations=max(1, h // 340))
    candidates = rgb[shoe_region]
    if len(candidates):
        colors, count = np.unique(
            (candidates // 20).astype(int), axis=0, return_counts=True
        )
        delta = np.linalg.norm(colors * 20 + 10 - paints["shoes"], axis=1)
        target = colors[np.argmax(count / (1 + delta / 95))]
        selected = (candidates // 20 == target).all(axis=1)
        paints["shoes"] = np.median(candidates[selected], axis=0)

    def pigment(color):
        return "#" + "".join(f"{round(v):02x}" for v in color)

    x0, y0, x1, y1 = bounds(mask)
    cx = (lm["leftCheek"][0] + lm["rightCheek"][0]) * 0.5
    crown = lm["crown"][1]
    chin = lm["chin"][1]
    shoulderY = lm["shoulder"][1]
    hem = lm["hem"][1]
    if not (
        y0 - 2 <= crown < chin < shoulderY < hem < lm["ankle"][1] < y1
        and lm["leftCheek"][0] < cx < lm["rightCheek"][0]
        and cx < lm["shoulder"][0] < lm["wrist"][0]
    ):
        raise ValueError(
            "Check crown, chin, shoulder, wrist, hem and ankle landmarks against the coordinate grid"
        )
    scale = 608 / (y1 - crown)

    def sy(y):
        return 12 + (y - crown) * scale

    def clamp(x, a, b):
        return round(float(np.clip(x, a, b)), 4)

    headW = (lm["rightCheek"][0] - lm["leftCheek"][0]) * scale
    headH = (chin - crown) * scale
    eyeY = (lm["leftEye"][1] + lm["rightEye"][1]) / 2

    # Color samples identify semantic regions even when a color is used elsewhere.
    def region(role):
        return mask & (np.linalg.norm(rgb - paints[role], axis=2) < 47)

    hair = scalp_pigment(
        region("hair"), mask, point(obs["samples"]["hair"]), shoulderY, headW / scale
    )
    if not hair.any():
        raise ValueError("Could not locate the hair swatch above the shoulders")
    hx, hy, hr, hb = bounds(hair)

    def span(row, use=mask):
        yy = int(np.clip(row, 0, h - 1))
        xs = np.flatnonzero(use[yy])
        return np.ptp(xs) + 1 if len(xs) > 1 else 0

    def yspan(x):
        col = int(x)
        yy = np.flatnonzero(
            mask[max(0, shoulderY - int(h * 0.08)) : shoulderY + int(h * 0.08), col]
        )
        return np.ptp(yy) + 1 if len(yy) > 1 else 0

    halfShoulder = clamp((lm["shoulder"][0] - cx) * scale, 16, 105)
    armLength = (lm["wrist"][0] - lm["shoulder"][0]) * scale
    coat = None
    sleeve_paints = paints
    if obs["top"] == "open-coat":
        coat, sleeve_color, coat_pixels = measure_coat(
            rgb, mask, cx, lm["shoulder"], lm["wrist"], hem, lm["ankle"][1], paints, sy, scale
        )
        sleeve_paints = {**paints, "shirt": sleeve_color}
    cuff = sleeve_cuff(rgb, mask, sleeve_paints, lm["shoulder"], lm["wrist"])
    sleeve = (
        (cuff - lm["shoulder"][0]) * scale if cuff is not None else armLength * 0.25
    )
    # Avoid counting the air between legs when measuring a trouser leg.
    kneeY = int(hem + (lm["ankle"][1] - hem) * 0.51)
    trouser = region("trousers")[kneeY]
    legPixels = np.flatnonzero(trouser & (np.arange(w) > cx))
    legR = clamp((len(legPixels) * 0.5 * scale) / 0.85, 4, 52)
    hipOffset = (
        clamp((np.median(legPixels) - cx) * scale, 6, 72)
        if len(legPixels) > 2
        else halfShoulder * 0.42
    )
    waist = clamp(span(hem - 0.035 * (y1 - y0)) * 0.5 * scale, 12, 110)
    neck = clamp(sy(shoulderY) - max(8, halfShoulder * 0.32), 12 + headH + 3, 500)
    fitBody = {
        "neckline": neck,
        "hem": clamp(sy(hem) - 4, neck + 35, 570),
        "shoulder": halfShoulder,
        "waist": waist,
        "armLength": clamp(armLength, 60, 420),
        "armRadius": clamp(
            yspan((lm["wrist"][0] + lm["shoulder"][0]) / 2) * 0.5 * scale / 0.9, 3, 32
        ),
        "sleeveFraction": clamp(sleeve / (0.52 * armLength), 0.17, 0.97),
        "legRadius": legR,
        "hipOffset": hipOffset,
        "cuffHeight": clamp((y1 - lm["ankle"][1]) * scale, 10, 78),
        "hairWidth": clamp((hr - hx) * scale / headW, 0.7, 2.5),
        "hairLength": clamp((hb - crown) * scale / headH, 0.47, 1.95),
    }
    if measure:

        def rounded(rows):
            return np.round(rows, 2).tolist()

        # Measure paired body cross-sections. Only the depth is invented by the compiler.
        radiusX = lm["shoulder"][0] - cx
        wrist = lm["wrist"][0] - cx
        sleevePx = max(0, min(wrist, sleeve / scale + radiusX))
        locations = np.unique(np.r_[np.linspace(radiusX * 0.72, wrist, 10), sleevePx])
        arm = []
        for off in locations:
            scans = []
            for side in [-1, 1]:
                x = int(np.clip(cx + side * off, 0, w - 1))
                window = max(
                    4, int((y1 - y0) * 0.048), round(fitBody["armRadius"] / scale * 2.0)
                )
                lo = max(0, shoulderY - window)
                ys = np.flatnonzero(mask[lo : min(h, shoulderY + window), x]) + lo
                if len(ys) > 2:
                    scans.append([ys[0], ys[-1]])
            if not scans:
                continue
            top, bottom = np.median(scans, axis=0)
            if off < radiusX * 1.10:
                top = max(top, shoulderY - 0.75 * radiusX)
                bottom = min(bottom, shoulderY + 0.42 * radiusX)
            arm.append(
                [
                    off * scale,
                    sy((top + bottom) / 2),
                    max(2, (bottom - top) * scale / 2),
                ]
            )
        tor = []
        # A T-pose arm overlaps the torso at shoulder height. Below the sleeve
        # the outer silhouette belongs to the ribs, belly and shirt hem.
        sleeve_x = round(cx + (radiusX + min(wrist, max(radiusX * 1.1, sleevePx))) / 2)
        probe = np.flatnonzero(mask[shoulderY:hem, int(np.clip(sleeve_x, 0, w - 1))])
        arm_end = shoulderY
        if len(probe) and probe[0] == 0:
            arm_end += np.split(probe, np.flatnonzero(np.diff(probe) > 1) + 1)[0][-1]
        region_shirt = region("shirt") if coat else None
        for t in [0, 0.02, 0.07, 0.18, 0.29, 0.43, 0.55, 0.69, 0.82, 0.94, 1]:
            yy = neck + (fitBody["hem"] + 4 - neck) * t
            py = int(crown + (yy - 12) / scale)
            # The wrists or splayed fingertips can dip below the sleeve.
            # At those heights only the continuous run containing the ribs
            # measures the shirt. At the hem the legs may already be separate.
            xs = np.flatnonzero(mask[py])
            runs = np.split(xs, np.flatnonzero(np.diff(xs) > 1) + 1)
            ribs = next((r for r in runs if len(r) and r[0] <= cx <= r[-1]), None)
            width = (len(ribs) if ribs is not None else span(py)) * scale / 2
            if py <= arm_end:
                width = min(width, halfShoulder * min(1, 0.43 + 25 * t))
            if coat and py > arm_end:
                # Keep the shirt under the panels as the coat flares away from the hips.
                visible = span(py, region_shirt) * scale / 2
                width = min(width * 0.92, max(visible * 1.08, halfShoulder * 0.8))
            tor.append([yy, max(width, 12)])
        cloth = region("trousers")
        # A coat can fill the gap behind both legs. Exclude its pigment from
        # the foreground used to trace the fork, knees and trouser waistband.
        legs_mask = mask & ~coat_pixels if coat else mask
        # The first sustained central opening marks the inseam and separates the legs.
        gap_y = int(hem + 0.16 * (y1 - hem))
        for y in range(hem + 3, int(hem + 0.53 * (y1 - hem))):
            xs = np.flatnonzero(legs_mask[y])
            if len(xs) < 4:
                continue
            gaps = np.flatnonzero(np.diff(xs) > 1)
            inner = (xs[gaps] + xs[gaps + 1]) // 2
            if any(
                abs(col - cx) < radiusX * 0.32 and not legs_mask[y + 2, col] for col in inner
            ):
                gap_y = y
                break

        def leg_row(y):
            groups = []
            row = int(y)
            xs = np.flatnonzero(legs_mask[row])
            runs = [
                r
                for r in np.split(xs, np.flatnonzero(np.diff(xs) > 1) + 1)
                if len(r) > radiusX * 0.14
            ]
            if len(runs) == 2 and runs[0].mean() < cx < runs[1].mean():
                groups = [
                    [abs((r[0] + r[-1]) * 0.5 - cx), (r[-1] - r[0] + 1) * 0.5]
                    for r in runs
                ]
            else:
                for half in [-1, 1]:
                    x = np.flatnonzero(cloth[row] & ((np.arange(w) - cx) * half > 0))
                    if len(x) > 2:
                        groups.append(
                            [abs((x[-1] + x[0]) * 0.5 - cx), (x[-1] - x[0] + 1) * 0.5]
                        )
            if not groups:
                return None
            off, rad = np.mean(groups, axis=0)
            return [sy(y), off * scale, max(2, rad * scale)]

        ly = min(lm["ankle"][1], y1 - 8)
        legs = [
            r
            for y in np.linspace(max(hem + 2, gap_y - 3), ly - 2, 12)
            if (r := leg_row(y)) is not None
        ]
        pelvis = []
        for y in np.linspace(hem - 3, gap_y + 1, 6):
            width = span(y, legs_mask) * scale / 2
            pelvis.append([sy(y), width])
        shoes = []
        for y in np.linspace(ly - 1, y1 - 2, 9):
            x = np.flatnonzero(mask[int(y)] & (np.arange(w) > cx))
            if len(x) > 2:
                shoes.append(
                    [
                        sy(y),
                        ((x[0] + x[-1]) / 2 - cx) * scale,
                        (x[-1] - x[0] + 1) * scale / 2,
                    ]
                )
        # Slice the contiguous hair color on the face. Keep the real asymmetric
        # opening and outside silhouette, then infer the depth of the rear shell.
        cap = []
        # Keep the shaded cheek when a broad area is darker than the sampled
        # skin. The chromaticity test is independent of daylight intensity.
        skin_color = paints["skin"]
        chroma = rgb / np.maximum(rgb.sum(axis=2, keepdims=True), 1)
        skin_chroma = skin_color / max(skin_color.sum(), 1)
        faceSkin = (
            mask
            & (np.linalg.norm(chroma - skin_chroma, axis=2) < 0.068)
            & (rgb.sum(axis=2) > skin_color.sum() * 0.49)
        )
        # Eye whites interrupt the skin pigment. They are part of the exposed face.
        eyeWhite = (rgb.min(axis=2) > 175) & (np.ptp(rgb, axis=2) < 53) & mask
        eyeRows = np.arange(h)[:, None]
        eyeY = (lm["leftEye"][1] + lm["rightEye"][1]) * 0.5
        faceSkin |= eyeWhite & (abs(eyeRows - eyeY) < (chin - crown) * 0.16)
        exposed_skin = faceSkin
        # Heal fine ink before tracing contiguous exposed skin. An isolated
        # ear outside a lock must not cut a notch into the main face opening.
        faceSkin = ndimage.binary_closing(
            faceSkin, structure=np.ones((1, max(3, int(headW / scale * 0.075))))
        )
        faceSkin = ndimage.binary_fill_holes(faceSkin)
        ears = ear_lobes(
            faceSkin,
            cx,
            eyeY,
            chin,
            headW / scale,
            lm["noseTip"][1] + (chin - crown) * 0.048,
        )
        if (
            obs["haircut"] in ["bob", "waves", "crop", "part"]
            and hr - hx > headW / scale * 0.55
        ):
            for y in np.unique(np.linspace(hy + 1, hb - 2, 28).astype(int)):
                xs = np.flatnonzero(hair[y])
                inside = np.flatnonzero(faceSkin[y])
                if len(xs) < 3:
                    continue
                l, r = xs[0], xs[-1]
                if y > eyeY and not (l < cx < r):
                    # A last isolated sideburn does not describe a full scalp ring.
                    continue
                if y > chin and r - l < (hr - hx) * 0.33:
                    continue
                inside = inside[
                    (inside > l)
                    & (inside < r)
                    & (abs(inside - cx) < headW / scale * 0.51)
                ]
                if len(inside) > 2 and y <= chin:
                    runs = np.split(inside, np.flatnonzero(np.diff(inside) > 1) + 1)
                    main = max(
                        runs,
                        key=lambda q: (
                            len(q) / (1 + abs(q.mean() - cx) / (headW / scale))
                        ),
                    )
                    il, ir = main[0], main[-1]
                elif y > chin:
                    il, ir = cx - (r - l) * 0.19, cx + (r - l) * 0.19
                else:
                    il = ir = np.clip(cx, l, r)
                for side, ex, ey, rx, ry in ears:
                    t = (y - ey) / ry
                    if abs(t) < 1:
                        tip = ex + side * rx * np.sqrt(1 - t * t)
                        if side < 0:
                            il = min(il, tip)
                        else:
                            ir = max(ir, tip)
                cap.append(
                    [
                        sy(y),
                        (l - cx) * scale,
                        (r - cx) * scale,
                        (np.clip(il, l, r) - cx) * scale,
                        (np.clip(ir, l, r) - cx) * scale,
                    ]
                )
        if len(arm) >= 3 and len(legs) >= 3 and len(shoes) >= 3:
            left_reach = 1 + ((cx - x0) - (x1 - 1 - cx)) / max(1, wrist - radiusX)
            leg_bounds = np.flatnonzero(trouser)
            pelvis_x = 0
            if len(leg_bounds) and leg_bounds[0] < cx < leg_bounds[-1]:
                pelvis_x = clamp(
                    ((leg_bounds[0] + leg_bounds[-1]) * 0.5 - cx) * scale,
                    -halfShoulder * 0.35,
                    halfShoulder * 0.35,
                )
            for shoe in shoes:
                shoe[1] -= pelvis_x
            fitBody["sections"] = {
                "arm": rounded(arm),
                "torso": rounded(tor),
                "leg": rounded(legs),
                "pelvis": rounded(pelvis),
                "shoe": rounded(shoes),
                "sleeve": round(sleevePx * scale, 3),
                "handScale": clamp((x1 - cx - wrist) * scale / 29, 0.65, 2.4),
                "leftReach": clamp(left_reach, 0.65, 1.45),
                "pelvisX": pelvis_x,
            }
            if coat:
                fitBody["sections"]["coat"] = coat
            # Ankle skin can be much narrower than either the trouser cuff
            # or the shoe; retain the exposed span and bury both ends.
            ankle_rows = []
            skin_rows = region("skin")
            for y in np.unique(
                np.linspace(ly - 3, min(h - 2, ly + (y1 - ly) * 0.52), 9).astype(int)
            ):
                xx = np.flatnonzero(skin_rows[y] & (np.arange(w) > cx))
                if len(xx) >= 4:
                    ankle_rows.append(
                        [
                            sy(y),
                            ((xx[0] + xx[-1]) * 0.5 - cx) * scale - pelvis_x,
                            (xx[-1] - xx[0] + 1) * scale * 0.5,
                        ]
                    )
            if len(ankle_rows) >= 3:
                fitBody["sections"]["ankle"] = rounded(ankle_rows)
            seams = {}
            for role, y0, y2 in [
                ("shirt", shoulderY + radiusX * 0.17, hem),
                ("trousers", hem, gap_y + radiusX * 0.23),
            ]:
                lines = garment_seams(
                    rgb,
                    paints[role],
                    (
                        int(cx - radiusX * 1.4),
                        int(y0),
                        int(cx + radiusX * 1.45),
                        int(y2),
                    ),
                    radiusX * 2,
                )
                if lines:
                    seams[role] = [
                        {
                            "points": rounded(
                                [[(x - cx) * scale, sy(y)] for x, y in stroke]
                            ),
                            "color": pigment(color),
                            "radius": clamp(width * scale * 0.52, 0.31, 1.4),
                        }
                        for _, stroke, color, width in lines
                    ]
            if seams:
                fitBody["sections"]["seams"] = seams
            sole = shoe_sections(rgb, mask, paints["shoes"], paints["skin"], cx, ly)
            if sole:
                shoe_rows, rubber = sole
                fitBody["sections"]["outsole"] = {
                    "rows": rounded(
                        [
                            [(x - cx) * scale - pelvis_x, sy(top), sy(seam), sy(floor)]
                            for x, top, seam, floor in shoe_rows
                        ]
                    ),
                    "color": pigment(rubber),
                }
            if ears:
                fitBody["sections"]["ears"] = rounded(
                    [
                        [(ex - cx) * scale, sy(ey), rx * scale, ry * scale]
                        for _, ex, ey, rx, ry in ears
                    ]
                )
            if len(cap) >= 4:
                # Smooth one-pixel color islands without flattening the measured part.
                cap = np.asarray(cap, dtype=float)
                # Closed rows meet above the actual part. An artificial center
                # seam would turn into a second forelock as the scalp opens.
                opened = np.flatnonzero(cap[:, 4] - cap[:, 3] > headW * 0.016)
                if len(opened):
                    first = opened[0]
                    split = (cap[first, 3] + cap[first, 4]) * 0.5
                    if obs["haircut"] == "bob":
                        notch = side_part_notch(hair, eyeY, headW / scale, cx + split / scale)
                        if notch:
                            x, y, depth = notch
                            fitBody["sections"]["sidePart"] = [
                                round(float((x - cx) * scale), 2),
                                round(float(sy(y)), 2), round(float(depth * scale), 2),
                            ]
                    for r in cap[:first]:
                        r[3] = r[4] = np.clip(split, r[1], r[2])
                for col in (1, 2, 3, 4):
                    cap[:, col] = ndimage.gaussian_filter1d(
                        cap[:, col], 0.72, mode="nearest"
                    )
                fitBody["sections"]["hair"] = rounded(cap)
                first_open = next(
                    (i for i, row in enumerate(cap) if row[4] - row[3] > headW * 0.014),
                    len(cap),
                )
                base = first_open - 1
                if (
                    obs["haircut"] != "bob"
                    and hb < eyeY + (chin - crown) * 0.20
                    and 2 <= base < len(cap) - 1
                ):
                    by, left, right = cap[base, :3]
                    contour = crown_contour(
                        hair,
                        cx + left / scale,
                        cx + right / scale,
                        round((by - 12) / scale + crown),
                        headW / scale,
                    )
                    if contour is not None:
                        fitBody["sections"]["crown"] = {
                            "base": base,
                            "rim": rounded(
                                [[(px - cx) * scale, sy(py)] for px, py in contour]
                            ),
                        }
            if obs["haircut"] == "bob":
                lock = forehead_lock(hair, region("skin"), cx, eyeY, headW / scale)
                if lock is not None:
                    fitBody["sections"]["foreheadLock"] = rounded([
                        [sy(y), (a - cx) * scale, (b - cx) * scale] for y, a, b in lock
                    ])
                edge = nape_contour(hair, cx, eyeY, chin, headW / scale)
                if edge is not None:
                    fitBody["sections"]["nape"] = rounded(
                        [[(x - cx) * scale, sy(y)] for x, y in edge]
                    )
                    strands = bob_ink(
                        rgb, paints["hair"], cx, eyeY, chin, headW / scale
                    )
                    if strands:
                        fitBody["sections"]["locks"] = [
                            rounded([[(x - cx) * scale, sy(y)] for x, y in strand])
                            for strand in strands
                        ]
            chin_line = chin_ink(
                rgb,
                paints["skin"],
                cx,
                max(lm["mouthLeft"][1], lm["mouthRight"][1]),
                chin,
                headW / scale,
            )
            if chin_line is not None:
                fitBody["sections"]["chin"] = rounded(
                    [[(x - cx) * scale, sy(y)] for x, y in chin_line]
                )
            jaw_rows = []
            short_crop = len(cap) >= 4 and cap[-1][0] < sy(eyeY) + 0.20 * headH
            start_face = eyeY - (chin - crown) * 0.23 if short_crop else eyeY
            for row in np.unique(
                np.linspace(start_face, chin - 2, 18 if short_crop else 12).astype(int)
            ):
                xs = np.flatnonzero(
                    faceSkin[row] & (np.abs(np.arange(w) - cx) < headW / scale * 0.52)
                )
                if len(xs) < 3:
                    continue
                runs = np.split(xs, np.flatnonzero(np.diff(xs) > 1) + 1)
                main = max(
                    runs,
                    key=lambda q: len(q) / (1 + abs(q.mean() - cx) / (headW / scale)),
                )
                if main[0] < cx < main[-1]:
                    lo, hi = main[0], main[-1]
                    if short_crop and eyeY < row < eyeY + (chin - crown) * 0.20:
                        # Ear and cheek are often the same pigment, separated only
                        # by their ink contour. Keep that separation at the temples.
                        sides = []
                        for s in (-1, 1):
                            for off in range(
                                round(headW / scale * 0.417),
                                round(headW / scale * 0.54),
                            ):
                                x = int(np.clip(cx + s * off, 1, w - 2))
                                if (
                                    not exposed_skin[row, x]
                                    and not exposed_skin[row, x + s]
                                ):
                                    sides.append(x)
                                    break
                        if len(sides) == 2:
                            lo, hi = max(lo, sides[0]), min(hi, sides[1])
                    jaw_rows.append([sy(row), (lo - cx) * scale, (hi - cx) * scale])
            if len(jaw_rows) >= 5:
                jaw_rows = np.asarray(jaw_rows, dtype=float)
                for col in (1, 2):
                    jaw_rows[:, col] = ndimage.median_filter(
                        jaw_rows[:, col], size=3, mode="nearest"
                    )
                fitBody["sections"]["jaw"] = rounded(jaw_rows)
    face = {
        "eyeHeight": clamp((eyeY - crown) * scale / headH, 0.21, 0.64),
        "eyeSpacing": clamp(
            (lm["rightEye"][0] - lm["leftEye"][0]) * scale / (2 * headW), 0.13, 0.32
        ),
        "noseBase": clamp((lm["noseTip"][1] - crown) * scale / headH, 0.43, 0.83),
        "mouthHeight": clamp(
            ((lm["mouthLeft"][1] + lm["mouthRight"][1]) / 2 - crown) * scale / headH,
            0.56,
            0.91,
        ),
        "mouthWidth": clamp(
            (lm["mouthRight"][0] - lm["mouthLeft"][0]) * scale / (2 * headW), 0.08, 0.32
        ),
        "eyeRadius": 0.15,
        "chinTaper": 0.09,
    }
    light = (rgb.min(axis=2) > 178) & ((rgb.max(axis=2) - rgb.min(axis=2)) < 55) & mask
    eye_aspects = []
    eyes = []
    for_eye = ndimage.binary_closing(light, iterations=2)
    elabel, _ = ndimage.label(for_eye)
    eyeWidths = []
    eyelid_candidates = []
    for eye in ["leftEye", "rightEye"]:
        x, y = lm[eye]
        r = max(2, int(headW / scale * 0.10))
        window = elabel[max(0, y - r) : y + r + 1, max(0, x - r) : x + r + 1]
        pos = window[window > 0]
        if pos.size:
            component = elabel == np.bincount(pos).argmax()
            xlo, ylo, xhi, yhi = bounds(component)
            if xhi - xlo < headW / scale * 0.55:
                eyeWidths.append((xhi - xlo) / 2)
                eye_aspects.append((yhi - ylo) / (xhi - xlo))
                # Include the ink immediately outside the white opening.
                pad = max(2, round((xhi - xlo) * 0.16))
                ay, ax = max(0, ylo - pad), max(0, xlo - pad)
                patch = np.s_[ay : yhi + pad, ax : xhi + pad]
                filled, dot = measure_eye(component[patch], rgb[patch])
                yy, xx = ndimage.center_of_mass(filled)
                rim = []
                for angle in np.linspace(0, 2 * np.pi, 24, endpoint=False):
                    steps = np.arange(max(filled.shape) + 1)
                    xi = np.rint(xx + steps * np.cos(angle)).astype(int)
                    yi = np.rint(yy + steps * np.sin(angle)).astype(int)
                    valid = (
                        (xi >= 0)
                        & (xi < filled.shape[1])
                        & (yi >= 0)
                        & (yi < filled.shape[0])
                    )
                    idx = np.flatnonzero(
                        filled[
                            np.clip(yi, 0, filled.shape[0] - 1),
                            np.clip(xi, 0, filled.shape[1] - 1),
                        ]
                        & valid
                    )
                    if len(idx):
                        j = idx[-1]
                        rim.append([(xi[j] + ax - cx) * scale, sy(yi[j] + ay)])
                if dot:
                    px, py, pr = dot
                    pr *= scale
                else:
                    px = xx + obs["gaze"] * (xhi - xlo) * 0.5
                    py = yy
                    pr = headW * 0.018
                eyes.append(
                    {
                        "rim": np.round(rim, 2).tolist(),
                        "pupil": [
                            round((px + ax - cx) * scale, 2),
                            round(sy(py + ay), 2),
                            clamp(pr, 0.65, 8 if dot else 4),
                        ],
                    }
                )
                strokes = eye_strokes(
                    rgb, (xlo, ylo, xhi, yhi), paints["skin"], chin - crown
                )
                eyelid_candidates.append((eyes[-1], strokes, xhi - xlo, ylo))
                stroke = lower_eye_ink(rgb, light, (xlo, ylo, xhi, yhi), paints["skin"])
                if stroke:
                    width, tint = stroke
                    eyes[-1]["rimInk"] = {"width": round(float(np.clip(width * scale, 0.2, 5)), 3),
                                          "color": pigment(tint)}
                band = filled_brow(
                    rgb, paints["skin"], (xlo, ylo, xhi, yhi), chin - crown
                )
                if band:
                    rim, tint = band
                    eyes[-1]["browRim"] = np.round(
                        [[(bx - cx) * scale, sy(by)] for bx, by in rim], 2
                    ).tolist()
                    eyes[-1]["browColor"] = pigment(tint)
                    continue
                brow = eyebrow(rgb, (xlo, ylo, xhi, yhi), chin - crown)
                if brow and len(brow[0]) >= 3:
                    eyes[-1]["brow"] = np.round(
                        [[(x - cx) * scale, sy(y)] for x, y in brow[0]], 2
                    ).tolist()
                    eyes[-1]["browWidth"] = clamp(brow[1] * scale * 0.55, 0.45, 2.5)
    # A bowed crease and the higher brow are two independent strokes in some
    # drawings. The other eye can have its brow hidden by the fringe.
    has_fold = any(
        len(strokes) == 2
        and strokes[1][0][3][1] - strokes[0][0][3][1] > width * 0.12
        and top - width * 0.42 < strokes[1][0][3][1] < top
        for _, strokes, width, top in eyelid_candidates
    )
    if has_fold:
        for eye, strokes, width, top in eyelid_candidates:
            if (
                not strokes
                or len(strokes) > 2
                or not top - width * 0.42 < strokes[-1][0][3][1] < top
            ):
                continue
            lower, line_width, paint = strokes[-1]
            eye["lid"] = np.round(
                [[(x - cx) * scale, sy(y)] for x, y in lower], 2
            ).tolist()
            if len(strokes) == 2:
                upper, line_width, _ = strokes[0]
                eye["brow"] = np.round(
                    [[(x - cx) * scale, sy(y)] for x, y in upper], 2
                ).tolist()
                eye["browWidth"] = clamp(line_width * scale * 0.55, 0.45, 2.5)
            else:
                eye.pop("brow", None)
                eye.pop("browWidth", None)
    if measure and len(eyes) == 2 and "sections" in fitBody:
        bridge = joined_brow(rgb, paints["skin"], paints["hair"],
                             [lm["leftEye"][0], lm["rightEye"][0]], eyeY, headW / scale)
        if bridge:
            rim, tint = bridge
            for eye in eyes:
                for key in ("browRim", "browColor", "brow", "browWidth"):
                    eye.pop(key, None)
            eyes[0]["browRim"] = np.round([[(x - cx) * scale, sy(y)] for x, y in rim], 2).tolist()
            eyes[0]["browColor"] = pigment(tint)
        else:
            for eye in eyes:
                if "brow" in eye or "browRim" in eye:
                    continue
                rim = np.asarray(eye["rim"])
                x = rim[:, 0] / scale + cx
                top = (rim[:, 1].min() - 12) / scale + crown
                if brow_covered_by_hair(hair, x.min(), x.max(), top):
                    eye["browOccluded"] = True
        fitBody["sections"]["eyes"] = eyes
    if measure and "sections" in fitBody:
        nose = nose_stroke(
            rgb,
            paints["skin"],
            eyeY,
            lm["noseTip"],
            (lm["mouthLeft"][1] + lm["mouthRight"][1]) / 2,
            headW / scale,
        )
        if nose is not None:
            stroke, width, paint = nose
            fitBody["sections"]["nose"] = {
                "stroke": np.round(
                    [[(px - cx) * scale, sy(py)] for px, py in stroke], 2
                ).tolist(),
                "radius": clamp(width * scale * 0.54, 0.32, 1.8),
                "ink": pigment(paint),
            }
    if measure and "sections" in fitBody:
        # Sample the shirt/trouser transition across the belly. Its rise at the
        # flanks describes a curved hem with one number.
        half_hem = fitBody["sections"]["torso"][-1][1] / scale
        hem_start = max(0, round(hem - (hem - shoulderY) * 0.32))
        cloth_rows = region("shirt")
        rises = []
        for t in (-0.9, -0.8, -0.7, 0.7, 0.8, 0.9):
            x = int(np.clip(cx + t * half_hem, 0, w - 1))
            edge = np.flatnonzero(cloth_rows[hem_start : hem + 4, x])
            if len(edge):
                rises.append((hem - hem_start - edge[-1]) * scale / t**2)
        if len(rises) >= 4 and np.median(rises) > 2:
            fitBody["sections"]["hemRise"] = clamp(
                np.median(rises), 0, (fitBody["hem"] - neck) * 0.22
            )
        creases = facial_creases(
            rgb,
            paints["skin"],
            cx,
            headW / scale,
            crown,
            chin,
            eyeY,
            max(lm["mouthLeft"][1], lm["mouthRight"][1]),
        )
        if creases:
            fitBody["sections"]["creases"] = [
                {
                    "points": np.round(
                        [[(x - cx) * scale, sy(y)] for x, y in points], 2
                    ).tolist(),
                    "radius": clamp(width * scale * 0.52, 0.3, 1.6),
                    "color": pigment(color),
                }
                for points, width, color in creases
            ]
    if measure and "sections" in fitBody and obs["top"] in ("crew", "open-coat"):
        collar = crew_neckline(
            rgb,
            mask,
            paints,
            cx,
            chin - (chin - crown) * 0.25,
            shoulderY,
            hem,
            halfShoulder / scale,
        )
        if collar is not None:
            mid, base, radius, drop, width, stitch = collar
            opening = {
                "center": round((mid - cx) * scale, 2),
                "top": round(sy(base), 2),
                "radius": round(radius * scale, 2),
                "drop": round(drop * scale, 2),
                "binding": round(width * scale, 2),
            }
            if stitch is not None:
                opening["ink"] = pigment(stitch)
            fitBody["sections"]["crew"] = opening
        if obs["top"] == "crew" and not obs.get("bands"):
            half = fitBody["sections"]["torso"][-1][1] / scale * 0.86
            top = max(shoulderY, base + drop + width if collar is not None else shoulderY)
            bottom = hem - (hem - shoulderY) * 0.03
            if bottom > top:
                rect = ((cx - half, top), (cx + half, bottom))
                mark = shirt_mark(rgb, mask, True, rect, 0, 0, 1)
                if mark:
                    mark["box"] = np.round([-half * scale, sy(top), half * scale, sy(bottom)], 2).tolist()
                    fitBody["sections"]["shirtMark"] = mark
    if (
        measure
        and "sections" in fitBody
        and obs["mouth"] in ("smile", "uncertain", "neutral")
    ):
        traced = mouth_profile(rgb, lm["mouthLeft"], lm["mouthRight"])
        if traced is not None:
            knots, ink_color, ink_width, lip_color = traced
            knots[:, 0] = (knots[:, 0] - cx) * scale
            knots[:, 1:] = sy(knots[:, 1:])
            mouth = {
                "expression": obs["mouth"],
                "rows": np.round(knots, 2).tolist(),
                "ink": pigment(ink_color),
                "radius": clamp(ink_width * scale * 0.5, 0.34, 2.2),
            }
            if lip_color is not None:
                mouth["color"] = pigment(lip_color)
            fitBody["sections"]["mouth"] = mouth
    if eyeWidths:
        face["eyeRadius"] = clamp(np.mean(eyeWidths) * scale / headW, 0.09, 0.235)
        face["eyeAspect"] = clamp(np.mean(eye_aspects), 0.52, 1.18)
    if measure and "sections" in fitBody and obs["mouth"] == "speaking":
        mouth = painted_open_mouth(rgb, paints["skin"], cx, eyeY, chin, headW / scale)
        if mouth:
            rows, cavity, teeth, tongue = mouth
            rows = rows.astype(float)
            rows[:, 0] = (rows[:, 0] - cx) * scale
            rows[:, 1:] = sy(rows[:, 1:])
            opening = {"rows": np.round(rows, 2).tolist(), "interior": pigment(cavity), "teeth": pigment(teeth)}
            if tongue is not None:
                opening["tongue"] = pigment(tongue)
            fitBody["sections"]["openMouth"] = opening
    if obs["haircut"] == "spikes":
        contour = radial_crown(hair, cx, eyeY, headW / scale)
        if contour is None or "sections" not in fitBody:
            raise ValueError("A radial crown needs measurable body sections and distinct hair tips around the head")
        center, rim = contour
        def on_head(p):
            return [round(float((p[0] - cx) * scale), 2), round(float(sy(p[1])), 2)]
        fitBody["sections"]["radialCrown"] = {"center": on_head(center), "rim": [on_head(p) for p in rim]}
    if coat and "sections" not in fitBody:
        raise ValueError("An open coat needs fitted torso, arm and leg sections")
    keys = [
        "build",
        "skull",
        "eyes",
        "gaze",
        "brow",
        "nose",
        "mouth",
        "lashes",
        "freckles",
        "spectacles",
    ]
    design = {k: obs[k] for k in keys}
    design.update(
        height=620,
        stance="relaxed",
        head=[clamp(headW, 38, 253), clamp(headH, 49, 290)],
        skin=pigment(paints["skin"]),
        face=face,
        hair={"cut": obs["haircut"], "color": pigment(paints["hair"])},
        outfit={
            "top": "crew" if coat else obs["top"],
            "color": pigment(paints["shirt"]),
            "trim": pigment(paints["binding"]),
            "trousers": pigment(paints["trousers"]),
            "shoes": pigment(paints["shoes"]),
            "footwear": obs["footwear"],
        },
    )
    if "details" in obs:
        details = obs["details"]
        design["face"].update(
            noseWidth=details["noseWidth"], noseProjection=details["noseProjection"]
        )
        if "fringeDepthScale" in details and design["hair"]["cut"] == "bob":
            design["hair"]["fringeDepthScale"] = details["fringeDepthScale"]
        if "eyeDepthScale" in details:
            design["face"]["eyeDepthScale"] = details["eyeDepthScale"]
        if obs["spectacles"]:
            design["frames"] = details["frames"]
        if obs["haircut"] == "ponytail":
            design["hair"]["fall"] = details["ponytailFall"]
    if measure:
        design["fit"] = fitBody
        if "sections" in fitBody:
            # Estimate the visible palm breadth relative to its wrist. Rolled
            # hands show their thumb and finger fan on the drawing plane.
            wx, wy = lm["wrist"]
            end = x1 - 1
            breadth = []
            for x in np.linspace(
                wx + (end - wx) * 0.13, wx + (end - wx) * 0.54, 10
            ).astype(int):
                yy = np.flatnonzero(mask[:, x])
                if len(yy):
                    breadth.append(yy[-1] - yy[0] + 1)
            hand = end - wx
            roll = (
                clamp((np.median(breadth) / max(1, hand) - 0.12) / 0.37, 0, 1) * 57
                if breadth
                else 0
            )
            tip_x = min(w - 1, round(wx + hand * 0.80))
            tip_y = np.flatnonzero(mask[:, tip_x])
            pitch = (
                clamp(
                    np.rad2deg(np.arctan2(np.median(tip_y) - wy, tip_x - wx)), -24, 24
                )
                if len(tip_y)
                else 0
            )
            # The arm builder maps both wrists by their reach from the shoulder.
            # Scan each hand independently in outward-facing coordinates.
            left_wrist = cx - (wx - cx) - max(0, wx - cx - halfShoulder / scale) * (
                fitBody["sections"]["leftReach"] - 1
            )
            fans = [
                open_hand(mask[:, ::-1], (w - 1 - round(left_wrist), wy), w - 1 - x0),
                open_hand(mask, (wx, wy), end),
            ]
            if any(fan is not None for fan in fans):
                fitBody["sections"]["openHands"] = [
                    np.round(fan * scale, 2).tolist() if fan is not None else None for fan in fans
                ]
            design["parts"] = {
                "legs": "classic",
                "feet": "sunshine" if obs["footwear"] == "sneaker" else "classic",
                "hands": "classic",
                "palmRoll": round(roll, 1),
                "handPitch": round(pitch, 1),
                **obs.get("parts", {}),
            }
        skin = region("skin")
        hairline = []
        for a in np.linspace(-np.pi / 2, np.pi / 2, 11):
            x = int(np.clip(cx + headW / scale * 0.48 * np.sin(a), 0, w - 1))
            ys = np.flatnonzero(skin[crown:chin, x])
            hairline.append(
                clamp((ys[0] / (chin - crown)) if ys.size else 0.70, 0.035, 0.85)
            )
        design["hairline"] = hairline
    else:
        # A control using the same observations, colors and default geometry.
        sh = {"child": 34, "lean": 42, "regular": 48, "broad": 62}[obs["build"]]
        n = 12 + design["head"][1] + (12 if obs["build"] == "child" else 24)
        hip = n + (620 - n) * 0.42
        design["fit"] = {
            "neckline": n,
            "hem": hip,
            "shoulder": sh,
            "waist": sh * 0.82,
            "armLength": (hip - n) * 1.11,
            "armRadius": sh * 0.205,
            "legRadius": sh * 0.385,
            "hipOffset": sh * 0.43,
            "cuffHeight": 20,
            "sleeveFraction": 0.57,
            "hairWidth": 1,
            "hairLength": 0.89,
        }
    mapped = []
    for b, color in zip(obs["bands"], bands):
        f = design["fit"]
        length = f["hem"] - f["neckline"]
        start = (sy(b["topY"] * (h - 1) / 1000) - f["neckline"]) / length
        end = (sy(b["bottomY"] * (h - 1) / 1000) - f["neckline"]) / length
        if not 0 <= start < end <= 1 or mapped and mapped[-1]["end"] > start:
            raise ValueError("Place bands in increasing order within the shirt")
        band = {"start": round(start, 4), "end": round(end, 4), "color": pigment(color)}
        if measure and "sections" in f:
            middle = (b["topY"] + b["bottomY"]) * (h - 1) / 2000
            extent = abs(b["bottomY"] - b["topY"]) * (h - 1) / 1000
            lo, hi = (
                max(0, int(middle - extent * 1.5)),
                min(h, int(middle + extent * 1.5)),
            )
            half = span(middle) / 2
            bends = []
            for t in (-0.85, -0.72, 0.72, 0.85):
                col = int(np.clip(cx + t * half, 0, w - 1))
                rows = np.flatnonzero(
                    np.linalg.norm(rgb[lo:hi, col] - color, axis=1) < 42
                )
                if len(rows) >= extent * 0.4:
                    bends.append(
                        ((rows[0] + rows[-1]) / 2 + lo - middle)
                        * scale
                        / (length * t * t)
                    )
            if len(bends) >= 3 and abs(np.median(bends)) > 0.012:
                band["bend"] = clamp(
                    np.median(bends), max(-start, -0.22), min(1 - end, 0.22)
                )
        mapped.append(band)
    if mapped:
        design["outfit"]["bands"] = mapped
    return {"version": 1, "name": obs["name"], "style": "cartoon", "design": design}
