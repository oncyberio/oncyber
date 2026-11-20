"""Fit an exposed Sunshine wrist and finger pad from a full-body T-pose."""

import numpy as np
from scipy import ndimage


def measure_wrist(rgb, mask, mid, axis_y, height, side):
    # Separate the pigments from the local paper above and below the limb.
    # A slight shadow around a fingertip must not lengthen the skeleton.
    y = np.arange(
        max(0, axis_y - round(height * 0.047)),
        min(len(mask), axis_y + round(height * 0.047) + 1),
    )
    x = np.arange(
        round(mid + side * height * 0.23), round(mid + side * height * 0.60), side
    )
    x = x[(x >= 0) & (x < mask.shape[1])]
    if len(y) < 9 or len(x) < 16:
        return None
    patch = rgb[np.ix_(y, x)]
    paper = (np.median(patch[:3], axis=0) + np.median(patch[-3:], axis=0)) * 0.5
    dyed = mask[np.ix_(y, x)] & (np.abs(patch - paper).max(2) > 34)
    occupied = np.flatnonzero(dyed.sum(0) >= 3)
    if not len(occupied):
        return None
    span = abs(x[occupied[-1]] - mid)
    if span < height * 0.31:
        return None
    t = abs(x - mid) / span
    arm = (t > 0.63) & (t < 0.73)
    palm = (t > 0.825) & (t < 0.855)
    pad = (t > 0.93) & (t < 0.975)
    if not all(
        zone.sum() >= 3 and np.min(dyed[:, zone].sum(0)) >= 3
        for zone in (arm, palm, pad)
    ):
        return None
    center = np.median(patch[abs(y - axis_y) <= 1], axis=0)
    skin = np.median(center[arm], axis=0)
    if np.linalg.norm(skin - np.median(center[palm], axis=0)) > 50:
        return None
    contrast = np.linalg.norm(center - skin, axis=1)
    marked = (t >= 0.715) & (t <= 0.86) & (contrast > 48)
    labeled, count = ndimage.label(marked)
    bands = []
    for index in range(1, count + 1):
        stripe = np.flatnonzero(labeled == index)
        width = len(stripe) / span
        if (
            not 0.008 <= width <= 0.062
            or stripe[0] == 0
            or stripe[-1] == len(t) - 1
        ):
            continue
        # Require the color to cross the wrist, with exposed skin on both sides.
        core = stripe[len(stripe) // 2]
        inside = np.flatnonzero(dyed[:, core])
        if len(inside) < 3:
            continue
        runs = np.linalg.norm(patch[inside, core] - skin, axis=1) > 37
        if runs.mean() < 0.72 or (
            contrast[stripe[0] - 1] > 48 or contrast[stripe[-1] + 1] > 48
        ):
            continue
        dye = np.median(
            patch[
                np.ix_(
                    abs(y - axis_y) <= 1,
                    stripe[(contrast[stripe] >= np.median(contrast[stripe]))],
                )
            ],
            axis=(0, 1),
        )
        bands.append((float(np.median(t[stripe])), width, dye))
    if len(bands) > 1:
        return None
    wrist = (t > 0.73) & (t < 0.82) & ~marked
    if wrist.sum() < 3:
        return None
    wrist_radius, pad_radius = [
        float(np.median(dyed[:, zone].sum(0)) / (2 * height)) for zone in (wrist, pad)
    ]
    if (
        not 0.006 <= wrist_radius <= 0.023
        or not 0.38 <= pad_radius / wrist_radius <= 0.94
    ):
        return None
    # Sample broad exposed forearm away from dye, outline and paper. The
    # three samples are symmetric around the center of a circular section.
    levels = []
    for col in np.flatnonzero(arm):
        rows = np.flatnonzero(dyed[:, col])
        if len(rows) < 7:
            continue
        indices = np.rint(np.quantile(rows, [0.16, 0.50, 0.84])).astype(int)
        srgb = patch[indices, col] / 255
        linear = np.where(
            srgb <= 0.04045, srgb / 12.92, ((srgb + 0.055) / 1.055) ** 2.4
        )
        luma = linear @ [0.2126, 0.7152, 0.0722]
        if luma[1] > 0.035:
            levels.append(luma[[0, 2]] / luma[1])
    light = np.median(levels, axis=0) if levels else None
    return wrist_radius, pad_radius, bands[0] if bands else None, light


def kit_hand(rgb, mask, landmarks):
    if landmarks is None:
        return None
    yy, xx = np.where(mask)
    if not len(yy) or np.ptp(yy) < 150:
        return None
    height = np.ptp(yy)
    mid = (xx.min() + xx.max()) / 2
    axis = round(yy.min() + landmarks[1] * height)
    sides = [measure_wrist(rgb, mask, mid, axis, height, side) for side in (-1, 1)]
    if any(s is None for s in sides):
        return None
    a, b = sides
    if max(abs(a[i] - b[i]) for i in (0, 1)) > 0.003:
        return None
    hand = {
        key: round((a[i] + b[i]) * 0.5, 5)
        for i, key in enumerate(("wristRadius", "padRadius"))
    }
    if a[3] is not None and b[3] is not None and np.max(abs(a[3] - b[3])) < 0.30:
        hand["light"] = np.round(np.clip((a[3] + b[3]) / 2, 0.2, 1.8), 3).tolist()
    a, b = a[2], b[2]
    if a and b and (
        abs(a[0] - b[0]) >= 0.018
        or abs(a[1] - b[1]) >= 0.02
        or np.linalg.norm(a[2] - b[2]) >= 52
    ):
        return hand
    if a or b:
        bands = [band for band in (a, b) if band]
        center, width, dye = (np.mean(values, axis=0) for values in zip(*bands))
        hand["band"] = {
            "center": round(float(center), 4),
            "width": round(float(width), 4),
            "color": "#" + np.rint(dye).astype(np.uint8).tobytes().hex(),
        }
        if len(bands) == 1:
            hand["band"]["side"] = "right" if a else "left"
    return hand
