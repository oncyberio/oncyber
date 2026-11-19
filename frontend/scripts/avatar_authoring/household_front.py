"""Measure a Rick-family household character from a single isolated T-pose."""

import numpy as np
from scipy import ndimage

from .eye_review import portrait_pair
from .household import (
    fit_frontal_features,
    fit_portrait,
    frontal_lobes,
    paint,
    pigment,
    scalp_boundary,
)

BODY_SECTIONS = {
    "torso",
    "pelvis",
    "arm",
    "leg",
    "shoe",
    "ankle",
    "sleeve",
    "handScale",
    "leftReach",
    "pelvisX",
    "hemRise",
    "crew",
    "outsole",
    "openHands",
    "seams",
}


def has_ink_outline(rgb, mask, bounds):
    """Two distant sections must show dark edge paint beside lighter pigment."""
    _, top, _, bottom = bounds
    height = bottom - top
    for lo, hi in ((0.36, 0.47), (0.58, 0.85)):
        votes = []
        for y in np.linspace(top + height * lo, top + height * hi, 31).astype(int):
            xs = np.flatnonzero(mask[y])
            if len(xs) < 6:
                continue
            for x, side in ((xs[0], 1), (xs[-1], -1)):
                ix = np.clip(
                    x + side * np.arange(max(3, round(height * 0.005))),
                    0,
                    rgb.shape[1] - 1,
                )
                near = rgb[y, ix].mean(1).min()
                inside = rgb[
                    y, np.clip(x + side * round(height * 0.012), 0, rgb.shape[1] - 1)
                ].mean()
                votes.append(near < 82 and inside - near > 58)
        if not votes or np.mean(votes) < 0.25:
            return False
    return True


def painted_brow(rgb, bounds):
    """Recover the filled eyebrow independently of the eyelid ink."""
    x, y, r, b = bounds
    cx, cy = (x + r) / 2, (y + b) / 2
    rx, ry = (r - x) / 2, (b - y) / 2
    lx, ty = max(0, round(cx - 1.12 * rx)), max(0, round(cy - 2.45 * ry))
    area = rgb[ty : max(ty, y - 2), lx : min(rgb.shape[1], round(cx + 1.12 * rx))]
    if not area.size:
        return None
    labels, _ = ndimage.label(area.max(2) < 84, structure=np.ones((3, 3)))
    parts = []
    for label, box in enumerate(ndimage.find_objects(labels), start=1):
        if box is None:
            continue
        yy, xx = np.where(labels == label)
        if np.ptp(xx) < 0.85 * rx or len(xx) < rx * ry * 0.11 or np.ptp(yy) > ry * 1.25:
            continue
        parts.append((len(xx), yy, xx))
    if not parts:
        return None
    _, ys, xs = max(parts, key=lambda part: part[0])
    upper = []
    lower = []
    for col in np.unique(np.rint(np.linspace(xs.min(), xs.max(), 10)).astype(int)):
        row = ys[xs == col]
        if not len(row) or np.ptp(row) > ry * 0.6:
            continue
        u = round((col + lx - cx) / rx, 3)
        upper.append([u, round((row.min() + ty - cy) / ry, 3)])
        lower.append([u, round((row.max() + 0.5 + ty - cy) / ry, 3)])
    if len(upper) < 4:
        return None
    return {
        "browRim": upper + lower[::-1],
        "browColor": paint(np.median(area[ys, xs], axis=0)),
    }


def outlined_collar(
    rgb, center, chin, shoulder_y, head_width, skin, shirt, scale, crown
):
    """Read the two nested ink arcs of a crew collar around a skin opening."""
    cols = []
    bottoms = []
    y0 = chin + 2
    y1 = round(shoulder_y + head_width * 0.18)
    if y1 <= y0 + 4:
        return None
    cx = round(center)
    for x in range(
        max(0, round(cx - head_width * 0.33)),
        min(rgb.shape[1], round(cx + head_width * 0.33)),
    ):
        v = rgb[y0:y1, x]
        cloth = np.flatnonzero(np.linalg.norm(v - shirt, axis=1) < 46)
        skin_rows = np.flatnonzero(np.linalg.norm(v - skin, axis=1) < 64)
        if not len(cloth) or not len(skin_rows):
            continue
        y = cloth[0]
        before = skin_rows[skin_rows < y]
        if len(before) < 4 or y - before[-1] > max(7, head_width * 0.045):
            continue
        cols.append(x)
        bottoms.append(y + y0)
    if len(cols) < 9 or cx not in cols:
        return None
    xs = np.array(cols)
    bottoms = np.array(bottoms)
    group = next(
        ids
        for ids in np.split(np.arange(len(xs)), np.flatnonzero(np.diff(xs) > 2) + 1)
        if cx in xs[ids]
    )
    xs = xs[group]
    bottoms = bottoms[group]
    radius = (np.ptp(xs) + 1) / 2
    if radius < 4 or not 0.07 < radius / head_width < 0.32:
        return None
    base = bottoms.min() - 1
    bottom = np.median(bottoms[abs(xs - cx) < radius * 0.3])
    drop = bottom - base
    if drop < 2 or drop > radius * 1.3:
        return None
    strip = rgb[
        round(bottom) + 1 : round(bottom + radius * 0.85), max(0, cx - 1) : cx + 2
    ].mean(axis=1)
    if len(strip) < 3:
        return None
    dark = np.flatnonzero(strip.mean(axis=1) < min(105, shirt.mean() * 0.58))
    if not len(dark):
        return None
    return {
        "center": round(((xs[0] + xs[-1]) / 2 - center) * scale, 2),
        "top": round((base - crown) * scale + 12, 2),
        "radius": round(radius * scale, 2),
        "drop": round(drop * scale, 2),
        "binding": round((np.median(dark) + 1) * scale, 2),
        "ink": paint(np.median(strip[dark], axis=0)),
    }


def hair_fall(rgb, mask, center, top, chin, width, hair, skin):
    """Sample a joined curtain only when locks flank the neck beyond the chin."""
    if np.linalg.norm(hair - skin) < 42:
        return None
    height = chin - top
    xs = np.arange(
        max(0, round(center - width)), min(mask.shape[1], round(center + width))
    )
    offsets = (xs - center) / width
    rows = []
    for t in np.linspace(0.15, 1.43, 24):
        y = round(top + t * height)
        if y >= mask.shape[0]:
            break
        v = rgb[y, xs]
        dh = np.linalg.norm(v - hair, axis=1)
        lock = (dh < 60) & (dh + 16 < np.linalg.norm(v - skin, axis=1)) & mask[y, xs]
        sides = []
        for side in (-1, 1):
            u = offsets * side
            hits = u[lock & (u > 0.115) & (u < 0.94)]
            if len(hits) < max(2, width * 0.032):
                break
            sides.append([np.percentile(hits, 96), np.percentile(hits, 4)])
        if len(sides) != 2:
            if t > 1:
                break
            continue
        outer, inner = np.mean(sides, axis=0)
        if t < 0.55:
            inner = max(inner, outer * 0.76)
        if outer <= 0.16 or inner > outer - 0.012:
            continue
        rows.append(
            [round(float(t), 3), round(float(outer), 3), round(float(inner), 3)]
        )
    # A chin-length bob has broad locks on both sides of the lower jaw.
    # A cropped cap and the narrow outline around a cheek end much earlier.
    bob = (
        len([1 for t, outer, inner in rows if 0.74 < t < 1 and outer - inner > 0.075])
        >= 3
        and rows[-1][0] >= 0.9
    )
    if len(rows) < 7 or (rows[-1][0] < 1.05 and not bob) or rows[0][0] > 0.49:
        return None
    if len(rows) > 16:
        rows = [rows[i] for i in np.linspace(0, len(rows) - 1, 16).round().astype(int)]
    return rows


def inked_sections(rgb, mask, center, crown, scale, arm_y, samples, body):
    """Follow the two edges of a clothed limb through paper grain and contour ink."""
    h, w = mask.shape
    sections = body["sections"]
    paper = np.median(np.vstack((rgb[0], rgb[-1])), axis=0)

    def x_at(x):
        return int(np.clip(round(center + x / scale), 0, w - 1))

    def y_at(y):
        return int(np.clip(round(crown + (y - 12) / scale), 0, h - 1))

    def level(y):
        return round((y - crown) * scale + 12, 2)

    visible = mask & (abs(rgb - paper).max(axis=2) > 38)
    # A pale forearm can differ from cream paper mostly in its blue channel.
    # Use the same color distance as the silhouette being measured.
    if all(
        np.max(abs(pigment(rgb, samples[k]) - paper)) > 45 for k in ("shirt", "skin")
    ):
        cut = sections["sleeve"]

        # The distal ring of the sleeve is a stable guide through the armpit,
        # where the arm's silhouette is shared with the shirt front.
        def arm_span(x):
            ix = x_at(x)
            lo = max(0, round(arm_y - body["armRadius"] * 2.3 / scale))
            hi = min(h, round(arm_y + body["armRadius"] * 2.3 / scale) + 1)
            ys = np.flatnonzero(visible[lo:hi, ix])
            if len(ys) < 3:
                return None
            groups = np.split(ys, np.flatnonzero(np.diff(ys) > 2) + 1)
            hit = min(groups, key=lambda g: abs(np.median(g) + lo - arm_y))
            if abs(np.median(hit) + lo - arm_y) > body["armRadius"] / scale:
                return None
            return lo + hit[0], lo + hit[-1]

        cuff = arm_span(cut - 2)
        if cuff:
            mid = sum(cuff) / 2
            radius = (cuff[1] - cuff[0] + 1) / 2
            for row in sections["arm"]:
                span = arm_span(row[0])
                if not span:
                    continue
                upper, lower = span
                if row[0] <= cut:
                    upper = max(upper, mid - radius * 1.15)
                    lower = min(lower, mid + radius * 1.15)
                if lower > upper + 2:
                    row[1:] = [
                        level((upper + lower) / 2),
                        round((lower - upper + 1) / 2 * scale, 2),
                    ]
    pants = pigment(rgb, samples["trousers"])
    if np.linalg.norm(pants - paper) < 92:
        return
    ix = x_at(sections.get("pelvisX", 0))
    first = y_at(body["hem"] + 2)
    last = y_at(sections["leg"][1][0])
    if last <= first + 3:
        return
    # Find the first sustained background opening between the thighs.
    strip = visible[first:last, ix - 1 : ix + 2].any(axis=1)
    opens = np.flatnonzero(
        np.convolve((~strip).astype(int), np.ones(4, dtype=int), mode="valid") == 4
    )
    if not len(opens):
        return
    fork = level(first + opens[0])
    pelvis = sections["pelvis"]
    if not body["hem"] + 4 < fork < sections["leg"][1][0] - 1:
        return
    for j, row in enumerate(pelvis):
        row[0] = round(pelvis[0][0] + (fork - pelvis[0][0]) * j / (len(pelvis) - 1), 2)
    leg = sections["leg"]
    leg[0][0] = round(fork + 0.7, 2)
    for yrow in leg:
        y = y_at(yrow[0])
        xs = np.flatnonzero(visible[y, ix:]) + ix
        if len(xs) < 3:
            continue
        runs = np.split(xs, np.flatnonzero(np.diff(xs) > 2) + 1)
        limb = max(runs, key=len)
        if not len(limb) > 4:
            continue
        yrow[1:] = [
            round(((limb[0] + limb[-1]) / 2 - ix) * scale, 2),
            # The dark edge and its antialiasing straddle the trouser contour.
            # Center the section between the paper mask and the solid stroke.
            round((yrow[2] + (np.ptp(limb) + 1) * scale / 2) / 2, 2),
        ]


def fit_front(source, name):
    """Use the family skull around measured eyes and retain the drawn T-pose body."""
    from .draft import propose
    from .fit import bounds, fit, pixels

    obs = propose(source, name)
    if (
        obs["unsupported"]
        or obs["haircut"] == "spikes"
        or obs["top"] not in ("crew", "tank", "polo")
    ):
        raise ValueError("The drawing needs a different hair or garment construction.")
    design = fit(source, obs)["design"]
    rgb, mask = pixels(source)
    h, w = mask.shape

    def xy(p):
        return [round(p["x"] * (w - 1) / 1000), round(p["y"] * (h - 1) / 1000)]

    lm = {k: xy(v) for k, v in obs["landmarks"].items()}
    samples = {k: xy(v) for k, v in obs["samples"].items()}
    left, top, right, floor = bounds(mask)
    crown, chin = lm["crown"][1], lm["chin"][1]
    # The contour is measured from the visible cap, including its uppermost strand.
    center = (lm["leftCheek"][0] + lm["rightCheek"][0]) / 2
    scale = 608 / (floor - crown)
    body = dict(design)
    measured = body.pop("fit")
    parts = body.pop("parts", {})
    sections = measured["sections"]

    def image_point(point):
        return [
            round(point[0] / scale + center),
            round((point[1] - 12) / scale + crown),
        ]

    head_height = chin - top
    if head_height <= 12 or not 0.11 <= head_height / (floor - top) <= 0.42:
        raise ValueError("Could not register the household skull to the T-pose.")
    body["head"] = [design["head"][0], round(head_height * scale, 3)]
    head_left, head_right = (
        round(center - 0.86 * head_height),
        round(center + 0.86 * head_height),
    )
    guide = {
        "name": name,
        "yaw": 0,
        "height_range": [top, chin],
        "head_region": [
            [head_left, top],
            [head_right, top],
            [head_right, chin],
            [head_left, chin],
        ],
        "skin": samples["skin"],
        "hair": samples["hair"],
        "shirt": samples["shirt"],
        "body": body,
        "nose_y": lm["noseTip"][1],
        "mouth_y": round((lm["mouthLeft"][1] + lm["mouthRight"][1]) / 2),
    }
    if sections.get("nose"):
        guide["nose_stroke"] = [image_point(p) for p in sections["nose"]["stroke"]]
    eyes = sections.get("eyes", [])
    if len(eyes) == 2 and all(e.get("brow") for e in eyes):
        guide["brows"] = [[image_point(p) for p in e["brow"]] for e in eyes]
    mouth = sections.get("mouth") or sections.get("openMouth")
    if mouth:
        points = [image_point([row[0], y]) for row in mouth["rows"] for y in row[1:]]
        xs, ys = zip(*points)
        guide["mouth_box"] = [
            max(0, min(xs) - 2),
            max(0, min(ys) - 2),
            min(w, max(xs) + 3),
            min(h, max(ys) + 3),
        ]
    # Wardrobe identity comes from pigment at the upper arm, independently
    # of a binding or shadow that crosses the front of the torso.
    arm_y = lm["wrist"][1]
    shoulder = lm["shoulder"][0] - center
    col = round(center + shoulder * 1.32)
    local = rgb[max(top, arm_y - 4) : arm_y + 5, col - 2 : col + 3]
    if local.size:
        pigment_at_shoulder = np.median(local, axis=(0, 1))
        if (
            np.linalg.norm(pigment_at_shoulder - pigment(rgb, samples["skin"]))
            < np.linalg.norm(pigment_at_shoulder - pigment(rgb, samples["shirt"]))
            * 0.55
        ):
            body["outfit"]["top"] = "tank"
    body["hair"]["cut"] = "crop"
    actual = portrait_pair(rgb, (max(0, head_left), top, min(w, head_right), chin))
    if len(actual) != 2:
        raise ValueError("Two separate eye whites are required.")
    guide["eyes"] = [
        [max(0, x - 4), max(0, y - 4), min(w, r + 4), min(h, b + 4)]
        for x, y, r, b in (eye["bounds"] for eye in actual)
    ]
    from .visible_parts import button_front, open_smile

    if body["outfit"]["top"] != "tank":
        neck, hem = ((measured[k] - 12) / scale + crown for k in ("neckline", "hem"))
        fabric = pigment(rgb, samples["shirt"])
        fasteners = button_front(
            rgb, center, neck, hem, fabric, pigment(rgb, samples["skin"])
        )
        if fasteners:
            body["outfit"].update(
                {
                    **fasteners,
                    "top": "polo",
                    "trim": paint(fabric),
                    "buttonColor": paint(fasteners["buttonColor"]),
                }
            )

    visible = open_smile(
        rgb, [e["bounds"] for e in actual], top, chin, pigment(rgb, samples["skin"])
    )
    if visible:
        body["mouth"] = "speaking"
        guide.update(visible)
    recipe = fit_portrait(source, guide, mask, rgb)
    family = recipe["design"]["household"]
    head_width, head_height = recipe["design"]["head"]
    opening = sections.get("openMouth")
    if opening and recipe["design"]["mouth"] == "speaking":
        # The T-pose fitter already traced every paint boundary. Keep the
        # rows in skull units so the household can rebuild them on a new rig.
        rows = np.asarray(opening["rows"], dtype=float)
        idx = np.unique(
            np.rint(np.linspace(0, len(rows) - 1, min(24, len(rows)))).astype(int)
        )
        rows = rows[idx]
        upper, lower = rows[:, 1], rows[:, -1]
        mid = (rows[0, 0] + rows[-1, 0]) / 2
        values = np.column_stack(
            (
                (rows[:, 0] - mid) / head_width,
                (upper - 12 + (crown - top) * scale) / head_height,
                (lower - 12 + (crown - top) * scale) / head_height,
            )
        )
        # At whole-body resolution the jaw ink and lip edge each occupy a
        # source pixel. Seat a close fit above the chin without cropping the
        # teeth or changing the shape of a single column.
        overhang = float(values[:, 2].max() - 0.97)
        if 0 < overhang <= 2 / (chin - top):
            values[:, 1:] -= overhang
        if (
            np.abs(values[:, 0]).max() <= 0.4
            and values[:, 1:].min() >= 0.55
            and values[:, 1:].max() <= 0.97
        ):
            family["lips"] = values.round(4).tolist()
            family["lipInk"] = opening["interior"]
            family["mouthPaint"] = {
                "teeth": opening["teeth"],
                "bands": (
                    (rows[:, 1:] - upper[:, None])
                    / np.maximum(lower - upper, 1e-6)[:, None]
                )
                .round(4)
                .tolist(),
                **({"tongue": opening["tongue"]} if opening.get("tongue") else {}),
            }
    lobes = [
        [
            x / head_width,
            (y - 12 + (crown - top) * scale) / head_height,
            rx / head_width,
            ry / head_height,
        ]
        for x, y, rx, ry in sections.get("ears", [])
    ]
    boxes = np.array([e["bounds"] for e in actual])
    eye_axis, eye_y = np.mean((boxes[:, :2] + boxes[:, 2:]) / 2, axis=0)
    skin, hair = [pigment(rgb, samples[key]) for key in ("skin", "hair")]
    width = head_width / scale
    # Filling the face silhouette also fills the ink separating ear and cheek.
    # Read both visible lobes on the original pigment before choosing a default.
    raw = frontal_lobes(rgb, mask, skin, hair, eye_axis, eye_y, top, chin, width)
    recovered = len(raw) > len(lobes)
    fit_frontal_features(
        recipe["design"], raw if recovered else lobes, scale, separate_ears=recovered
    )
    family["body"] = {
        k: v
        for k, v in measured.items()
        if k not in ("hairWidth", "hairLength", "sections", "triangleBudget")
    }
    family["body"]["sections"] = {
        k: v for k, v in sections.items() if k in BODY_SECTIONS
    }
    for angle in ("palmRoll", "handPitch"):
        if angle in parts:
            family["body"][angle] = parts[angle]
    # Frame both eyes with the same source-based axial coordinates used by
    # native_front's registered comparison. The T-pose stays centered at its bounds.
    for orbit, eye in zip(family["orbits"], actual):
        brow = painted_brow(rgb, eye["bounds"])
        if brow:
            orbit.update(brow)
    cx = (left + right - 1) / 2
    H = floor - top - 1
    eye_box = [
        (boxes[:, 0].min() - cx - 3) / H,
        (boxes[:, 1].min() - top - 3) / H,
        (boxes[:, 2].max() - cx + 3) / H,
        (boxes[:, 3].max() - top + 3) / H,
    ]
    fall = hair_fall(rgb, mask, center, top, chin, width, hair, skin)
    bob = fall and fall[-1][0] < 1.05
    # On a short bob the side locks visible below the ears belong to the
    # separate curtain. They must not pull the forehead cap across the cheek.
    line = scalp_boundary(
        rgb,
        mask,
        eye_axis,
        top,
        chin - top,
        width,
        family["widths"],
        skin,
        hair,
        eyes=[e["bounds"] for e in actual],
        cap_limit=min(0.76, recipe["design"]["face"]["eyeHeight"] + 0.10)
        if bob
        else 0.93,
    )
    if line:
        if bob and len(family.get("ears", [])) == 2:
            # The scalp wraps behind each observed lobe. A local paper
            # highlight near the temple is not an opening in a closed bob.
            ears = sorted(family["ears"])
            for i, angle in enumerate(np.linspace(-np.pi / 2, np.pi / 2, len(line))):
                ear = ears[int(angle > 0)]
                wrap = float(np.clip((abs(angle) - 0.85) / 0.42, 0, 1))
                line[i] = round(max(line[i], (ear[1] - ear[3] * 0.78) * wrap), 4)
        recipe["design"]["hairline"] = line
    # Hair visible outside both cheeks below the ears continues around the
    # occiput. Estimate the nape length independently of the forehead part.
    ends = []
    for side in (-1, 1):
        for t in np.linspace(0.93, 0.65, 23):
            y = round(top + t * (chin - top))
            radius = (
                width
                * 0.5
                * np.interp(
                    t, np.linspace(0, 1, len(family["widths"])), family["widths"]
                )
            )
            xs = (
                np.rint(center + side * radius * np.linspace(0.74, 1, 19))
                .astype(int)
                .clip(0, w - 1)
            )
            colors = rgb[y, xs]
            near = np.linalg.norm(colors - hair, axis=1)
            if (
                (near < 55) & (near + 18 < np.linalg.norm(colors - skin, axis=1))
            ).sum() >= 4:
                ends.append(t)
                break
    if len(ends) == 2:
        family["nape"] = round(float(np.mean(ends)), 3)
    if fall:
        recipe["design"]["hair"]["cut"] = "waves"
        family["fallRows"] = fall
    if has_ink_outline(rgb, mask, (left, top, right, floor)):
        family["penOutline"] = True
        inked_sections(rgb, mask, center, crown, scale, arm_y, samples, family["body"])
        if body["outfit"]["top"] == "crew":
            collar = outlined_collar(
                rgb,
                center,
                chin,
                lm["shoulder"][1],
                width,
                skin,
                pigment(rgb, samples["shirt"]),
                scale,
                crown,
            )
            if collar:
                family["body"]["sections"]["crew"] = collar
    score = {
        "head_fraction": (chin - top) / H,
        "eye_frame": list(map(float, eye_box)),
    }
    if np.min((boxes[:, 2] - boxes[:, 0]) / (boxes[:, 3] - boxes[:, 1])) > 1.85:
        score["lowered_lids"] = True
    return recipe, score


def review_edits(recipe, source, native, score, visual):
    from .family_eyes import eye_measures

    edits = []
    design = recipe["design"]

    def change(field, value, previous):
        if value != previous:
            edits.append({"field": "design." + field, "value": value})

    if visual["rgb_mae"] > 12:
        from .household_registration import dye, frame, role_masks, swatches

        reference, rendered = frame(source), frame(native)
        delta = reference[:, :, :3].astype(float) - rendered[:, :, :3].astype(float)
        masks = role_masks(rendered, design)
        shared = ndimage.binary_erosion(
            (reference[:, :, 3] > 0) & (rendered[:, :, 3] > 0)
        )
        for field, previous, mask in zip(
            [
                "skin",
                "hair.color",
                "outfit.color",
                "outfit.trousers",
                "outfit.shoes",
                "outfit.trim",
            ],
            swatches(design),
            masks,
        ):
            # Average each pigment only on the shared interior. A white cuff,
            # skin in a crew opening or a narrow ink seam must not recolor a shirt.
            region = shared & mask
            if region.sum() < 14:
                continue
            correction = np.median(delta[region], axis=0)
            if np.max(abs(correction)) >= 4:
                change(
                    field,
                    paint(
                        np.clip(dye(previous) + np.clip(correction, -32, 32), 0, 255)
                    ),
                    previous,
                )
    from .family_review import eyes_match

    if eyes_match(visual):
        return edits
    seen = eye_measures(
        source, score["eye_frame"], lowered=score.get("lowered_lids", False)
    )
    drawn = eye_measures(
        native, score["eye_frame"], lowered=score.get("lowered_lids", False)
    )
    if seen is not None and drawn is not None:
        target, actual = seen[0], drawn[0]
        ratios = target[:, 2:4] / actual[:, 2:4]
        if max(np.ptp(ratios, axis=0)) < 0.25:
            rw, rh = ratios.mean(axis=0)
            face = design["face"]
            for key, factor, lo, hi in (
                ("eyeAspect", rh / rw, 0.28, 1.18),
                ("eyeRadius", rw, 0.085, 0.24),
                (
                    "eyeSpacing",
                    np.ptp(target[:, 0]) / max(0.001, np.ptp(actual[:, 0])),
                    0.12,
                    0.33,
                ),
            ):
                if abs(factor - 1) > 0.05:
                    change(
                        "face." + key,
                        round(float(np.clip(face[key] * factor, lo, hi)), 4),
                        face[key],
                    )
    return edits
