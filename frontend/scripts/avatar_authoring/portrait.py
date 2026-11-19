"""Compile the visible head of a portrait and infer the hidden body from its family."""

import numpy as np
from scipy import ndimage

from .eye_review import portrait_pair
from .fit import pixels
from .household import fit_portrait, paint
from .sun_rays import measure_sun_rays
from .visor import measure_visor
from .visible_parts import open_smile, visible_torso
from .tracing import garment_motif, outline_mark

PRESETS = {
    "child": ("child", 520, 150),
    "lean-teen": ("lean", 612, 142),
    "adult": ("regular", 640, 144),
}


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
        dark, n = ndimage.label(
            mask & (rgb.max(2) < 108) & (np.indices(mask.shape)[0] < h * 0.72)
        )
        if not n:
            raise ValueError("Cannot locate the visor")
        region = dark == np.bincount(dark.ravel())[1:].argmax() + 1
        y, x = np.where(region)
        cx, cy = (x.min() + x.max()) / 2, (y.min() + y.max()) / 2
        radius = (np.ptp(x) + 1) / 1.9
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
        "top": "crew",
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
        result = {
            "version": 1,
            "style": "family",
            "plainJersey": True,
            "family": family,
            "name": name,
            "proportions": {},
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
    breadth = visible_torso(rgb, mask, (left, top, right, chin), colors["shirt"])
    if breadth is not None:
        recipe["design"]["household"]["shirtHalfWidth"] = breadth
    return recipe
