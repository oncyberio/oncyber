"""Compile the visible head of a portrait and infer the hidden body from its family."""

import numpy as np
from scipy import ndimage

from .eye_review import portrait_pair
from .family import FAMILIES
from .fit import pixels
from .household import fit_frontal_features, fit_portrait, frontal_lobes, paint, pigment
from .sun_rays import jersey_neck, measure_sun_rays, orb_swatches
from .visor import measure_visor, visor_seed
from .visible_parts import (
    inked_cheeks,
    open_smile,
    visible_arm,
    visible_torso,
    visible_placket,
)
from .household_front import has_ink_outline, painted_brow
from .tracing import garment_motif, nose_stroke, outline_mark

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
    stations = [243, 273, 306, 337]
    pattern = [83, 77.5, 70.5, 67.5]
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
        expected = np.interp(station, stations, pattern)
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
        pair = portrait_pair(rgb, (0, top, w, min(h, round(0.84 * h))))
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
        # A single chosen point can land on a chest logo. Use cloth on both
        # sides of the print, then trace any fully visible central motif.
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
                patch[~valid] = fabric
                motif = garment_motif(patch)
                mark = outline_mark(*motif) if motif else None
            else:
                mark = None
        else:
            mark = None
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
            "orbPaint": dict(
                zip(("top", "bottom"), map(paint, orb_swatches(rgb, orb)))
            ),
            "paints": {
                "skin": paints["skin"],
                "rays": paints["hair"],
                "shirt": paints["shirt"],
            },
            "visor": visor,
        }
        if mark:
            result["shirtMark"] = mark
        if rays:
            result["sunRays"], result["paints"]["rays"] = rays
        neck = jersey_neck(rgb, mask, orb)
        if neck:
            collar, below_chin = neck
            result["orbCollar"] = collar
            # In the mascot's drawing space the crew rim starts at 171 and
            # the chin at 167.2. Move the shirt to the drawn neck length.
            collar_shift = float(
                np.clip(
                    (
                        below_chin * base_ry * result["proportions"]["headHeight"]
                        - collar["drop"] * base_rx
                        - 3.8
                    )
                    / 680,
                    -0.045,
                    0.045,
                )
            )
            result["kitFit"] = {
                "collar": round(collar_shift, 4),
                "shoulders": round(collar_shift, 4),
                "waist": 0,
                "hem": 0,
                "sock": 0,
                "width": 1,
            }
            width = jersey_chest_width(
                mask, orb, collar_shift, result["proportions"]["headHeight"]
            )
            if width:
                result["kitFit"]["chestWidth"] = width
        return result
    build, stature, head = PRESETS[obs["body"]]
    pair = portrait_pair(rgb, (left, top, right + 1, chin + 1))
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
        lobes = frontal_lobes(rgb, mask, skin, hair, cx, eye_y, top, chin, skull_width)
        fit_frontal_features(
            design, lobes, design["head"][1] / height, separate_ears=True
        )
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
    return recipe
