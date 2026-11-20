"""Compile the visible head of a portrait and infer the hidden body from its family."""

import numpy as np
from scipy import ndimage

from .crown import crown_edges
from .guide import source_eyes
from .family import FAMILIES
from .fit import pixels
from .fringe import forehead_fringe
from .pinna import frontal_pinnae
from .jersey_sleeve import JERSEY_ROWS, JERSEY_HALF_WIDTHS, bare_arms, measure_sleeves
from .household import fit_frontal_features, fit_portrait, frontal_lobes, paint, pigment
from .sun_rays import apply_sun_rays, jersey_neck, measure_sun_rays, measured_orb_paint
from .visor import measure_visor, visor_seed
from .visible_parts import (
    closed_lips,
    inked_cheeks,
    open_smile,
    visible_arm,
    visible_torso,
    visible_placket,
)
from .household_front import has_ink_outline, nape_height, painted_brow
from .tracing import garment_motif, nose_stroke, traced_print

PRESETS = {
    "child": ("child", 520, 150),
    "lean-teen": ("lean", 612, 142),
    "adult": ("regular", 640, 144),
}


def jersey_chest_width(mask, orb, collar_shift, head_height):
    """Fit a visible shirt below the sleeves in units of one orb radius."""
    cx, cy, rx, ry = orb
    # Transverse half-widths of the Sunshine jersey pattern at its sewn
    # stations. A crop may end anywhere between the underarm and the waist.
    ratios = []
    for y in range(
        max(0, round(cy + 2.28 * ry)), min(len(mask), round(cy + 3.48 * ry))
    ):
        axis = round(cx)
        labels, _ = ndimage.label(mask[y])
        if not 0 <= axis < len(labels) or not labels[axis]:
            continue
        left, right = np.flatnonzero(labels == labels[axis])[[0, -1]]
        radius = (right - left + 1) / 2
        if (
            left < 2
            or right >= len(labels) - 2
            or abs((right + left) / 2 - cx) > rx * 0.13
            or not 0.64 < radius / rx < 1.56
        ):
            continue
        # The head height pivot is the chin. Convert back to the pattern's
        # vertical units before looking up the expected width of the cloth.
        station = 167.2 + ((y - cy) / ry - 1) * 61.2 * head_height - 680 * collar_shift
        expected = np.interp(station, JERSEY_ROWS, JERSEY_HALF_WIDTHS)
        ratios.append(radius / rx * 60.5 / expected)
    if (
        len(ratios) < max(5, ry * 0.12)
        or np.ptp(np.percentile(ratios, [10, 90])) > 0.13
    ):
        return None
    ratio = float(np.median(ratios))
    return (
        round(float(np.clip(ratio, 0.70, 1.30)), 4) if abs(ratio - 1) >= 0.035 else None
    )


def measured_orb_scale(mask, orb, edges, unit):
    """Separate a large orb from a short shirt when two body measurements agree."""
    cx, cy, rx, ry = orb
    arm_level = float(edges.mean() - cy - ry) / unit
    vertical_ratio = arm_level / (211 - 167.2)
    if not 0.43 < vertical_ratio < 0.83:
        return 1.0, None
    widths = []
    for y in range(round(edges[-1]) + 2, min(len(mask), round(cy + 2.9 * ry))):
        labels, _ = ndimage.label(mask[y])
        axis = round(cx)
        if not labels[axis]:
            continue
        left, right = np.flatnonzero(labels == labels[axis])[[0, -1]]
        half = (right - left + 1) / 2
        if (
            0.46 < half / rx < 1.25
            and abs((left + right) / 2 - cx) < 0.10 * rx
            and left > 1
            and right < mask.shape[1] - 2
        ):
            widths.append(half / unit)
    if (
        len(widths) < max(5, 0.11 * ry)
        or np.ptp(np.percentile(widths, [10, 90])) > 0.09 * rx / unit
    ):
        return 1.0, None
    # The flat pattern has an 83-unit half chest at the underarm. Narrow
    # shirts are common, so a narrow chest alone cannot enlarge the skull.
    chest_ratio = float(np.median(widths)) / 83
    if not 0.40 < chest_ratio < 0.74:
        return 1.0, None
    scale = round(float(np.clip(1 / np.sqrt(chest_ratio * vertical_ratio), 1, 1.5)), 4)
    return scale, round(float(np.clip(chest_ratio * scale, 0.70, 1.30)), 4)


def fit_portrait_kit(result, rgb, mask, orb, skin, fabric):
    neck = jersey_neck(rgb, mask, orb)
    if not neck:
        return
    cx, cy, rx, ry = orb
    _, _, base_rx, base_ry = FAMILIES["sunshine"]["crownRoot"]
    head_height = result["proportions"]["headHeight"]
    unit = rx / base_rx
    height = 680 * unit
    arms = bare_arms(rgb, mask, cx, cy + ry, height, skin, fabric)
    scale, width = (
        measured_orb_scale(mask, orb, arms[0], unit)
        if arms is not None
        else (1.0, None)
    )
    collar, below_chin = neck
    if scale != 1:
        result["orbScale"] = scale
        unit /= scale
        collar = dict(collar)
        for key, lo, hi in (
            ("radius", 0.16, 0.43),
            ("drop", 0.04, 0.24),
            ("band", 0.02, 0.12),
        ):
            collar[key] = round(float(np.clip(collar[key] * scale, lo, hi)), 4)
    result["orbCollar"] = collar
    collar_y = below_chin * base_ry * head_height * scale - collar["drop"] * base_rx
    collar_shift = float(np.clip((collar_y - 3.8) / 680, -0.045, 0.045))
    fit = {
        "collar": round(collar_shift, 4),
        "shoulders": round(collar_shift, 4),
        "waist": 0,
        "hem": 0,
        "sock": 0,
        "width": 1,
    }
    result["kitFit"] = fit
    width = width or jersey_chest_width(mask, orb, collar_shift, head_height)
    if width:
        fit["chestWidth"] = width
    if arms is None:
        return
    edges, arm_pigment = arms
    axis = round(float(edges.mean()))
    sleeve = measure_sleeves(rgb, mask, cx, axis, height)
    if sleeve is None:
        return
    reach = sleeve.pop("reach") * height / unit
    # The socket and attached cloth move with chest width. Undo that motion
    # before storing the pattern in the family's unwarped drawing coordinates.
    chest = fit.get("chestWidth", 1.0)
    span = reach - 84 * (chest - 1) if reach >= 84 * chest else reach / chest
    cuts = np.asarray(sleeve["rows"]) * reach / span
    if not 55 <= span <= 190 or not np.all((abs(cuts) >= 0.055) & (abs(cuts) <= 0.55)):
        return
    result["jerseySleeve"] = {
        **sleeve,
        "rows": cuts.round(4).tolist(),
        "span": round(span, 2),
    }
    result["paints"]["skin"] = paint(arm_pigment)
    # The bare elbow diameters on the original pattern are 17.8 and 18.8.
    girth = (np.ptp(edges) + 1) / (18.3 * unit)
    if 0.55 <= girth <= 2.1 and abs(girth - 1) >= 0.06:
        result["limbWidth"] = {
            "arms": round(float(np.clip(girth, 0.72, 1.4)), 4),
            "legs": 1,
        }
    fit["shoulders"] = round(
        float(np.clip(((axis - cy - ry) / unit - (211 - 167.2)) / 680, -0.045, 0.045)),
        4,
    )


def portrait_jersey_print(rgb, mask, orb, fabric, fit, scale):
    """Sample the chest in the native print plane, retaining detached strokes."""
    cx, cy, rx, ry = orb
    ox, oy, radius, ry0 = FAMILIES["sunshine"]["crownRoot"]
    x0, y0, x1, y1 = FAMILIES["sunshine"]["shirtBox"]
    unit = rx / (radius * scale)
    # Use the same shoulder and waist stations as the sewn shirt. Sample a
    # margin around the stamp so a wide mark is not split at the nominal box.
    window = [-0.20, -0.22, 1.20, 1.20]
    x = (x0 - ox) + np.linspace(window[0], window[2], 97) * (x1 - x0)
    y = y0 + np.linspace(window[1], window[3], 97) * (y1 - y0)
    stretch = np.clip((y - 161) / 30, 0, 1) * (fit.get("chestWidth", 1) - 1)
    cols = np.rint(cx + unit * (x + x * stretch[:, None])).astype(int)
    shift = np.interp(
        y, [171, 211, 336], [fit.get(k, 0) for k in ("collar", "shoulders", "waist")]
    )
    rows = np.rint(cy + ry + (y - (oy + ry0) + 680 * shift) * unit).astype(int)[:, None]
    valid = (cols >= 0) & (cols < mask.shape[1]) & (rows >= 0) & (rows < len(mask))
    cols, rows = cols.clip(0, mask.shape[1] - 1), rows.clip(0, len(mask) - 1)
    valid &= mask[rows, cols]
    if valid.sum() < 200:
        return None
    patch = np.where(valid[:, :, None], rgb[rows, cols], fabric)
    return traced_print(patch, garment_motif(patch), window)


def sample_region(rgb, mask, x, y, radius):
    h, w = mask.shape
    left, top = max(0, round(x - radius)), max(0, round(y - radius))
    right, bottom = min(w, round(x + radius) + 1), min(h, round(y + radius) + 1)
    patch = rgb[top:bottom, left:right]
    valid = mask[top:bottom, left:right]
    if not valid.any():
        raise ValueError("A visible pigment sample falls outside the figure")
    color = np.median(patch[valid], axis=0)
    diff = np.linalg.norm(patch - color, axis=2)
    ix, iy = np.unravel_index(np.argmin(np.where(valid, diff, np.inf)), diff.shape)
    return [int(left + iy), int(top + ix)]


def propose_portrait(source, family):
    rgb, mask = pixels(source, keep_components=True)
    h, w = mask.shape
    ys, xs = np.nonzero(mask)
    top = int(ys.min())
    if family == "sunshine":
        # The visor is the largest dark region high on the figure. Its span
        # estimates the orb even when short rays protrude on one side.
        seed = visor_seed(rgb, mask)
        if not seed:
            raise ValueError("Cannot locate the visor")
        (cx, cy), radius = seed
        if not 0.10 * w < radius < w * 0.48:
            raise ValueError("A measurable floating visor is required")
        head = [cx - radius, cy - radius, cx + radius, cy + radius]
        skin = sample_region(rgb, mask, cx, cy - radius * 0.62, radius * 0.12)
        hair = sample_region(rgb, mask, cx, top + 3, 5)
    else:
        pair = source_eyes(rgb, mask, (0, top, w, min(h, round(0.84 * h))))
        if len(pair) != 2:
            raise ValueError("Cannot locate two distinct eyes in the portrait")
        eyes = np.array(
            [
                [(a + c) / 2, (b + d) / 2]
                for a, b, c, d in (eye["bounds"] for eye in pair)
            ]
        )
        cx, cy = eyes.mean(axis=0)
        gap = eyes[1, 0] - eyes[0, 0]
        # A detached ear and a long fringe can extend below the face. Locate
        # the chin where the central skin silhouette narrows to the neck.
        neck_y = min(h - 1, round(cy + 1.70 * gap))
        for y in range(
            min(h - 1, round(cy + 0.84 * gap)), min(h - 2, round(cy + 1.95 * gap))
        ):
            row = mask[y]
            before = np.flatnonzero(row & (abs(np.arange(w) - cx) < gap * 1.3))
            if len(before) and np.ptp(before) < gap * 0.78:
                neck_y = y
                break
        # The narrowest dark contour below the lower lip crosses the midline.
        xi = round(cx)
        ys = np.arange(
            max(0, round(cy + 0.92 * gap)), min(h, round(neck_y + 0.14 * gap) + 1)
        )
        if len(ys):
            tone = rgb[ys, max(0, xi - 2) : xi + 3].mean(axis=(1, 2))
            marks = ys[tone < 95]
            if len(marks):
                neck_y = int(marks[-1])
        head = [max(0, cx - gap * 1.85), top, min(w - 1, cx + gap * 1.85), neck_y]
        skin = sample_region(
            rgb, mask, cx + 0.66 * gap, cy + 0.56 * gap, max(2, gap * 0.10)
        )
        hair = sample_region(rgb, mask, cx, top + (cy - top) * 0.26, max(2, gap * 0.12))
    shirt = sample_region(
        rgb,
        mask,
        cx + (0.17 * (head[2] - head[0])),
        min(h - 2, head[3] + (h - head[3]) * 0.73),
        max(2, w * 0.018),
    )

    def unit(point):
        return [
            int(np.clip(round(1000 * point[i] / ((w, h)[i] - 1)), 0, 1000))
            for i in range(2)
        ]

    return {
        "head": unit(head[:2]) + unit(head[2:]),
        "skin": unit(skin),
        "hair": unit(hair),
        "shirt": unit(shirt),
        "body": "adult",
        "top": "polo"
        if family == "rick-classic" and visible_placket(rgb, head, shirt)
        else "crew",
        "cut": "crop",
        "yaw": 0,
        "missing": "",
    }


def compile_portrait(source, family, name, obs):
    rgb, mask = pixels(source, keep_components=True)
    h, w = mask.shape

    def xy(point):
        return [round(point[0] * (w - 1) / 1000), round(point[1] * (h - 1) / 1000)]

    left, top = xy(obs["head"][:2])
    right, chin = xy(obs["head"][2:])
    width, height = right - left, chin - top
    if min(height, width) < 20:
        raise ValueError("A larger visible head is required")
    colors = {k: xy(obs[k]) for k in ("skin", "hair", "shirt")}
    if family == "sunshine":
        center = ((left + right) / 2, (top + chin) / 2)
        radius = (width / 2, height / 2)
        orb = measure_sun_rays(rgb, mask, center, radius, orb_only=True)
        if orb is None:
            orb = [*center, *radius]
        visor = measure_visor(rgb, mask, orb)
        if not visor:
            raise ValueError("The visible visor could not be measured")
        rays = measure_sun_rays(rgb, mask, center, radius)
        paints = {k: paint(rgb[y, x]) for k, (x, y) in colors.items()}
        fabric = pigment(rgb, colors["shirt"])
        # A single chosen point can land on the print. Sample the predominant
        # cloth from the visible central chest before tracing its ink.
        cx, cy, rx, ry = orb
        left, right = round(cx - 0.83 * rx), round(cx + 0.83 * rx)
        top, bottom = round(cy + 1.55 * ry), round(cy + 3.35 * ry)
        if min(w, right) - max(0, left) > 10 and min(h, bottom) - max(0, top) > 8:
            xs = np.linspace(left, right, 97).round().astype(int).clip(0, w - 1)
            rows = np.linspace(top, bottom, 97).round().astype(int)
            ys = rows.clip(0, h - 1)
            patch = rgb[np.ix_(ys, xs)].copy()
            valid = mask[np.ix_(ys, xs)] & (rows[:, None] < h)
            if valid.sum() > 200:
                pigments = patch[valid]
                bins = (pigments // 32).astype(int) @ [64, 8, 1]
                most_common = np.bincount(bins).argmax()
                fabric = np.median(pigments[bins == most_common], axis=0)
                paints["shirt"] = paint(fabric)

        _, _, base_rx, base_ry = FAMILIES[family]["crownRoot"]
        result = {
            "version": 1,
            "style": "family",
            "plainJersey": True,
            "family": family,
            "name": name,
            "proportions": {
                "headHeight": round(
                    float(np.clip((ry / rx) / (base_ry / base_rx), 0.65, 1.5)), 4
                )
            },
            "orbPaint": measured_orb_paint(rgb, mask, orb),
            "paints": {
                "skin": paints["skin"],
                "rays": paints["hair"],
                "shirt": paints["shirt"],
            },
            "visor": visor,
        }
        if rays:
            apply_sun_rays(result, rays, rgb, orb)
        fit_portrait_kit(result, rgb, mask, orb, pigment(rgb, colors["skin"]), fabric)
        mark = portrait_jersey_print(
            rgb, mask, orb, fabric, result.get("kitFit", {}), result.get("orbScale", 1)
        )
        if mark:
            result["shirtMark"] = mark
        return result
    build, stature, head = PRESETS[obs["body"]]
    pair = source_eyes(rgb, mask, (left, top, right + 1, chin + 1))
    if len(pair) != 2:
        raise ValueError("Both eyes must be measurable")
    eyes = [
        [max(0, a - 3), max(0, b - 3), min(w, c + 3), min(h, d + 3)]
        for a, b, c, d in (eye["bounds"] for eye in pair)
    ]
    body = {
        "height": stature,
        "head": [head, head],
        "build": build,
        "skull": "oval",
        "eyes": "wide",
        "gaze": 0,
        "brow": "level",
        "nose": "straight",
        "mouth": "smile",
        "lashes": False,
        "freckles": False,
        "spectacles": False,
        "stance": "relaxed",
        "face": {"mouthWidth": 0.20, "chinTaper": 0.11},
        "hair": {"cut": obs["cut"]},
        "hairline": [0.67, 0.57, 0.45, 0.38, 0.32, 0.31, 0.35, 0.49, 0.63],
        "outfit": {
            "top": obs["top"],
            "trim": "#e8e4d8",
            "trousers": "#465568",
            "shoes": "#4e4141",
            "footwear": "flat",
        },
    }
    guide = {
        "name": name,
        "yaw": obs["yaw"],
        "portrait_preset": obs["body"],
        "height_range": [top, chin],
        "head_region": [[left, top], [right, top], [right, chin], [left, chin]],
        "trace_hairline": True,
        "body": body,
        "eyes": eyes,
        "nose_y": round(top + 0.68 * height),
        "mouth_y": round(top + 0.81 * height),
        **colors,
    }
    mark = open_smile(
        rgb,
        [e["bounds"] for e in pair],
        top,
        chin,
        rgb[colors["skin"][1], colors["skin"][0]],
    )
    if mark:
        body["mouth"] = "speaking"
        guide.update(mark)
    recipe = fit_portrait(source, guide, mask, rgb)
    design = recipe["design"]
    household = design["household"]
    # The full-body family measures pinnae, the nose crease and the ink margin
    # around each eyeball. These measurements also exist above a portrait crop.
    if abs(obs["yaw"]) < 5:
        skull_width = height * design["head"][0] / design["head"][1]
        skin, hair = (pigment(rgb, colors[key]) for key in ("skin", "hair"))
        centers = np.array(
            [[(a + c) / 2, (b + d) / 2] for a, b, c, d in (e["bounds"] for e in pair)]
        )
        cx, eye_y = centers.mean(0)
        sweep = crown_edges(rgb, mask, cx, top, height, skull_width, skin, hair)
        if sweep:
            household["crownEdges"] = sweep
        if not mark:
            lips = closed_lips(rgb, cx, top, height, skull_width, skin)
            if lips:
                household.update(lips)
                design["mouth"] = "lips"
        fringe = forehead_fringe(
            rgb,
            mask,
            cx,
            top,
            height,
            skull_width,
            skin,
            hair,
            [e["bounds"] for e in pair],
        )
        if fringe:
            household["fringe"] = fringe
        elif design.get("hairline") and design["hair"]["cut"] == "crop":
            # Where a sweep breaks the forehead trace, the older outline
            # can descend along an earring or a jaw shadow. Bound those
            # stations by the dye actually connected to the crown.
            nape = nape_height(rgb, mask, cx, top, chin, skull_width, skin, hair)
            if nape and max(design["hairline"]) > nape + 0.12:
                design["hairline"] = [
                    min(t, round(nape + 0.035, 4)) for t in design["hairline"]
                ]
                household["nape"] = nape
        lobes = frontal_lobes(rgb, mask, skin, hair, cx, eye_y, top, chin, skull_width)
        fit_frontal_features(
            design, lobes, design["head"][1] / height, separate_ears=True
        )
        pinnae = frontal_pinnae(
            rgb,
            mask,
            cx,
            top,
            skull_width,
            height,
            household.get("ears", []),
            skin,
            hair,
        )
        if pinnae:
            household["pinnae"] = pinnae
        nose = nose_stroke(
            rgb, skin, eye_y, (cx, guide["nose_y"]), guide["mouth_y"], skull_width
        )
        if nose is not None:
            stroke = nose[0].copy()
            stroke[:, 0] = (
                stroke[:, 0] - (stroke[:, 0].min() + stroke[:, 0].max()) / 2
            ) / skull_width
            stroke[:, 1] = (stroke[:, 1] - top) / height
            if (
                np.all((0.35 <= stroke[:, 1]) & (stroke[:, 1] <= 0.84))
                and stroke[:, 1].max() >= 0.42
                and np.ptp(stroke[:, 0]) > 0.003
            ):
                household["noseStroke"] = stroke.round(4).tolist()
                design["face"]["noseBase"] = round(float(stroke[:, 1].max()), 4)
        if has_ink_outline(rgb, mask, (left, top, right, chin)) or inked_cheeks(
            rgb, mask, (left, top, right, chin), skin
        ):
            household["penOutline"] = True
        arm = visible_arm(
            rgb, mask, (left, top, right, chin), skin, pigment(rgb, colors["shirt"])
        )
        if arm and design["outfit"]["top"] != "tank":
            household["portraitArm"] = arm
            if obs["body"] == "adult":
                # Match the visible arm axis to the shoulder station in the
                # independently fitted everyday body. Preserve the measured skull.
                household["portraitPreset"] = "adult-casual"
                standing = 12 + design["head"][1] * (1 + arm["level"]) / 0.293
                design["height"] = round(
                    float(np.clip(standing, stature * 0.88, stature * 1.12))
                )
    for orbit, observed in zip(household["orbits"], pair):
        brow = painted_brow(rgb, observed["bounds"])
        if brow:
            orbit.update(brow)
    breadth = visible_torso(rgb, mask, (left, top, right, chin), colors["shirt"])
    if breadth is not None:
        recipe["design"]["household"]["shirtHalfWidth"] = breadth
    from .household import fit_crop_back

    fit_crop_back(recipe["design"])
    return recipe
