"""Measure a registered streetwear turnaround and compile its sparse, texture-free recipe.

Coordinates are in a 1,000-unit standing figure. Provide the front midline and
the side ankle center on the sheet and register both views to the same floor.
The pattern describes the wide crew tee, pooled denim and swept spike family.
"""

import argparse
import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image


def outline(mask, pigment, origin, minimum, tolerance):
    contours, _ = cv2.findContours(
        mask.astype("uint8"), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
    )
    out = []
    for c in sorted(contours, key=cv2.contourArea, reverse=True):
        if cv2.contourArea(c) < minimum:
            continue
        points = cv2.approxPolyDP(c, tolerance, True).reshape(-1, 2)
        if len(points) < 3:
            continue
        out.append({"paint": pigment, "edge": (points + origin).tolist()})
    return out


def measure(sheet, center, side, floor, height, name):
    rgb = np.asarray(Image.open(sheet).convert("RGB"))

    # Normalize the two cameras separately to the same physical length.
    def crop(x, left, right):
        return np.asarray(
            Image.fromarray(rgb).transform(
                (right - left, 1024),
                Image.Transform.AFFINE,
                (
                    height / 1000,
                    0,
                    x + left * height / 1000,
                    0,
                    height / 1000,
                    floor - 1008 * height / 1000,
                ),
                Image.Resampling.BILINEAR,
            )
        )

    front, profile = crop(center, -490, 490), crop(side, -200, 200)
    rgbf = front.astype(float)
    long = np.indices(front.shape[:2])[1] - 490

    def bounds(pixels, fallback):
        active = np.flatnonzero(pixels)
        return [int(active[0]), int(active[-1])] if len(active) > 4 else fallback

    def cloth(im, y, kind):
        row = im[y].astype(float)
        if kind == "denim":
            return (row[:, 2] > row[:, 0] + 3) & (row.max(1) < 157)
        return row.max(1) < 92

    def depth(y, kind, fallback):
        a, b = bounds(cloth(profile, y, kind), [200 - fallback[0], 200 + fallback[1]])
        return [200 - a, b - 200]

    # Fold rings travel around the leg. Their vertical pitch gives the hem a
    # distinct silhouette in profile as well as at the front.
    jeans = []
    for y, tilt in [
        (571, 0),
        (614, 0),
        (652, 1),
        (679, 2),
        (712, -1),
        (746, -7),
        (779, 6),
        (800, 10),
        (839, -9),
        (857, 9),
        (868, 5),
        (879, -7),
        (898, 8),
        (920, -8),
        (936, 4),
        (944, 7),
        (953, 4),
        (967, -6),
        (983, 3),
    ]:
        row = cloth(front, y, "denim")
        a, b = bounds(row & (long[y] > 1) & (long[y] < 219), [491, 630])
        c, d = bounds(row & (long[y] < -1) & (long[y] > -219), [350, 489])
        inner = max(0, round(((a - 490) + (490 - d)) / 2))
        outer = round(((b - 490) + (490 - c)) / 2)
        fore, aft = depth(y, "denim", (70, 60))
        jeans.append([y, inner, outer, fore, aft, tilt])
    shirt = []
    for y, default, fb in [
        (213, 108, [42, 37]),
        (225, 120, [49, 44]),
        (249, 123, [57, 48]),
        (287, 120, [64, 49]),
        (337, 117, [68, 52]),
        (373, 115, None),
        (418, 114, None),
        (453, 122, None),
        (484, 131, None),
        (502, 115, [100, 62]),
    ]:
        a, b = bounds(cloth(front, y, "tee"), [490 - default, 490 + default])
        width = default if y < 373 or y >= 484 else round((b - a) / 2)
        shirt.append([y, width, *(fb or depth(y, "tee", (85, 55)))])
    marks = []
    x0, x1, y0, y1 = -72, 73, 245, 372
    cut = rgbf[y0:y1, 490 + x0 : 490 + x1].copy()
    bright = cut.max(2) > 105
    bright = (
        cv2.morphologyEx(
            bright.astype("uint8"), cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8)
        )
        > 0
    )
    marks += outline(bright, "#e6cbaa", [x0, y0], 15, 0.95)
    r, g, b = cut.transpose(2, 0, 1)
    for mask, tint in [
        (r > g + 32, "#d4906a"),
        ((r > g + 7) & (g > b + 26), "#f0bd64"),
        ((g > r + 2) & (b > r + 5), "#55abc0"),
        ((r > 213) & (g > 202) & (b > 185), "#fff1d2"),
    ]:
        marks += outline(bright & mask, tint, [x0, y0], 4, 0.8)

    # Sample cloth light between its left and right seams. Interpolating these
    # sparse stations into vertex colors avoids disconnected shapes at folds.
    def fabric(mask, ys, x0, x1):
        gray = cv2.cvtColor(front, cv2.COLOR_RGB2GRAY)
        filled = cv2.inpaint(
            gray, ((~mask) & (gray > 110)).astype("uint8"), 5, cv2.INPAINT_TELEA
        )
        blurred = cv2.GaussianBlur(filled, (0, 0), 3)
        stations = []
        for y in ys:
            indices = np.flatnonzero(mask[y, x0:x1])
            if len(indices) < 5:
                continue
            left, right = x0 + indices[0], x0 + indices[-1]
            # Pull the sampling points away from the paper at the inked hem.
            samples = np.linspace(left + 3, right - 3, 13).round().astype(int)
            stations.append(
                [y, int(left - 490), int(right - 490), *blurred[y, samples].tolist()]
            )
        median = max(
            1, float(np.median([v for station in stations for v in station[3:]]))
        )
        for station in stations:
            station[3:] = (
                np.clip(np.round(np.array(station[3:]) * 128 / median), 55, 183)
                .astype(int)
                .tolist()
            )
        return stations

    yy, xx = np.indices(front.shape[:2])
    rr, _gg, bb = rgbf.transpose(2, 0, 1)
    tee_mask = (rgbf.max(2) < 95) & (
        abs(xx - 490)
        < np.interp(
            yy, [213, 280, 346, 373, 453, 484, 506], [100, 117, 113, 116, 121, 131, 116]
        )
    )
    leg_mask = (bb > rr + 2) & (bb > 46) & (bb < 164)
    panels = {"tee": fabric(tee_mask, range(227, 499, 10), 351, 630)}
    for key, x1, x2 in [("rightLeg", 295, 490), ("leftLeg", 491, 683)]:
        panels[key] = fabric(leg_mask, range(581, 975, 9), x1, x2)
    # Keep only the broad overlapping shadows cast by the knee and cuff.
    # Isolated dark cloth grain should stay in the continuous vertex field.
    gray = cv2.GaussianBlur(cv2.cvtColor(front, cv2.COLOR_RGB2GRAY), (0, 0), 2).astype(
        float
    )
    interior = cv2.erode(leg_mask.astype("uint8"), np.ones((9, 9), np.uint8))
    shadow = interior & ((gray < 77) & (gray - cv2.GaussianBlur(gray, (0, 0), 15) < -8))
    cuffs = {}
    for key, sign in [("rightLeg", -1), ("leftLeg", 1)]:
        edge = []
        for x in range(22, 168, 4):
            covered = np.flatnonzero(leg_mask[879:990, 490 + sign * x])
            if len(covered):
                edge.append([x, 879 + int(covered[-1])])
        cuffs[key] = (
            cv2.approxPolyDP(np.array(edge, dtype=np.int32), 1.5, False)
            .reshape(-1, 2)
            .tolist()
        )
    creases = {}
    for key, x0, x1 in [("rightLeg", 303, 486), ("leftLeg", 494, 683)]:
        paths = outline(shadow[723:963, x0:x1], "", [x0 - 490, 723], 180, 2)
        creases[key] = [p["edge"] for p in paths[:8]]

    def swatch(box):
        xl, y, xr, yb = box
        p = np.median(rgbf[y:yb, 490 + xl : 490 + xr], axis=(0, 1)).astype(int)
        return "#{:02x}{:02x}{:02x}".format(*tuple(p))

    # A family with a swept crown has three convex spike tips on each flank.
    # Match them by height, using the profile to recover their rearward reach.
    def crown_outline(view, pivot):
        cut = view[:193, pivot - 149 : pivot + 150].astype(float)
        paper = np.median(cut[0], axis=0)
        mask = np.max(abs(cut - paper), axis=2) > 32
        contours, _ = cv2.findContours(
            mask.astype("uint8"), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
        )
        if not contours:
            raise ValueError("No crown found above the face in the registered sheet")
        return cv2.approxPolyDP(max(contours, key=cv2.contourArea), 2, True).reshape(
            -1, 2
        ) - [149, 0]

    front_crown, side_crown = crown_outline(front, 490), crown_outline(profile, 200)
    spikes = []
    for sign in (-1, 1):
        for index, (lo, hi, root, rad) in enumerate(
            [(0, 49, (33, 74), 25), (50, 109, (41, 100), 21), (111, 162, (37, 121), 17)]
        ):
            tips = [p for p in front_crown if lo <= p[1] <= hi and p[0] * sign > 52]
            back = [p for p in side_crown if lo <= p[1] <= hi and p[0] > 30]
            if not tips or not back:
                raise ValueError(
                    "Expected three distinct spike tips in each registered view"
                )
            tip = max(tips, key=lambda p: p[0] * sign)
            reach = max(p[0] for p in back)
            # Overlapping left and right locks separate in profile.
            if sign < 0:
                reach *= [0.38, 0.85, 0.85][index]
            spikes.append(
                [
                    sign * root[0],
                    root[1],
                    -23,
                    int(tip[0]),
                    int(tip[1]),
                    -round(reach),
                    rad,
                ]
            )

    # The leading ink transition determines the irregular edge of the bangs.
    # Stop at the lid when a blonde strand crosses in front of it.
    hairline = [[-47, 134], [-40, 129]]
    for x in range(-37, 38, 2):
        column = rgbf[95:128, 490 + x]
        ink = np.flatnonzero(column.mean(1) < 138)
        hairline.append([x, 95 + int(ink[0]) if len(ink) else 127])
    hairline.extend([[41, 128], [47, 134]])
    fringe = (
        cv2.approxPolyDP(np.array(hairline, dtype=np.int32), 1, False)
        .reshape(-1, 2)
        .tolist()
    )
    return {
        "version": 1,
        "style": "streetwear",
        "name": name,
        "colors": {
            "skin": swatch((-8, 146, 2, 152)),
            "hair": swatch((-9, 69, 7, 78)),
            "denim": swatch((65, 695, 89, 730)),
            "tee": swatch((40, 400, 64, 423)),
            "under": swatch((-59, 518, -30, 527)),
            "iris": "#407999",
            "shoe": swatch((-121, 940, -83, 959)),
        },
        "shirt": shirt,
        "jeans": jeans,
        "print": marks,
        "panels": panels,
        "creases": creases,
        "cuffs": cuffs,
        "arm": {
            "shoulder": 98,
            "elbow": 231,
            "wrist": 371,
            "height": 246,
            "cuff": 229,
            "hem": 352,
        },
        "head": {"width": 48, "chin": 184, "eyeLine": 132, "eyeGap": 48, "depth": 54},
        "hair": {"spikes": spikes, "fringe": fringe, "nape": 415},
        "belt": {"height": 548, "slope": -0.17, "width": 31},
        "shoe": {"center": 99, "width": 60, "toe": 157, "heel": 35},
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("sheet", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--front-center", type=float, required=True)
    parser.add_argument("--profile-center", type=float, required=True)
    parser.add_argument("--floor", type=float, required=True)
    parser.add_argument("--height", type=float, required=True)
    parser.add_argument("--name", required=True)
    a = parser.parse_args()
    recipe = measure(
        a.sheet, a.front_center, a.profile_center, a.floor, a.height, a.name
    )
    a.output.write_text(json.dumps(recipe, separators=(",", ":")) + "\n")
