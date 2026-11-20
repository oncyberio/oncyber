"""Fit an exposed Sunshine wrist and finger pad from a full-body T-pose."""

import numpy as np
from scipy import ndimage

from .tracing import open_hand


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
        if not 0.008 <= width <= 0.062 or stripe[0] == 0 or stripe[-1] == len(t) - 1:
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


def finger_fan(rgb, mask, mid, axis, height, span, side):
    """Measure the same five visible finger rays as the cartoon fitter.

    Keep outside paper connected through open gaps. Enclosed highlights and
    the skin of a pale palm should stay inside its outline.
    """
    start = round(mid + side * 0.67 * span)
    stop = np.clip(round(mid + side * 1.04 * span), -1, mask.shape[1])
    xs = np.arange(start, stop, side)
    ys = np.arange(
        max(0, axis - round(0.1 * height)), min(len(mask), axis + round(0.1 * height))
    )
    if len(xs) < 30 or len(ys) < 12:
        return None
    grid = np.ix_(ys, xs)
    art = rgb[grid]
    v = np.linspace(0, 1, len(ys))[:, None, None]
    paper = (1 - v) * np.median(art[:3], axis=0) + v * np.median(art[-3:], axis=0)
    near = np.max(abs(art - paper), axis=2) < 20
    seeds = np.zeros_like(near)
    seeds[[0, -1]] = near[[0, -1]]
    seeds[:, -1] = near[:, -1]
    clean = mask[grid] & ~ndimage.binary_propagation(seeds, mask=near)
    widths = clean.sum(axis=0)
    tips = np.flatnonzero(widths >= 2)
    stations = np.flatnonzero(
        (abs(xs - mid) > span * 0.72) & (abs(xs - mid) < span * 0.86)
    )
    if not len(tips) or not len(stations) or min(widths[stations]) < 2:
        return None
    smooth = ndimage.median_filter(widths, size=5)
    wrist = stations[smooth[stations] <= min(smooth[stations]) + 1][-1]
    center = int(np.median(np.flatnonzero(clean[:, wrist])))
    length = tips[-1] - wrist
    rays = open_hand(clean, (wrist, center), tips[-1])
    if rays is None or not 0.14 <= length / span <= 0.29:
        return None
    radii = []
    for ax, ay, bx, by in rays:
        # Where the shafts have separated, measure diameter normal to the ray.
        widths = []
        for t in (0.70, 0.75, 0.80):
            col = wrist + round(ax + t * (bx - ax))
            row = center + ay + t * (by - ay)
            ix = np.flatnonzero(clean[:, col])
            runs = np.split(ix, np.flatnonzero(np.diff(ix) > 1) + 1)
            matches = [r for r in runs if len(r) and r[0] - 1 <= row <= r[-1] + 1]
            if len(matches) == 1:
                widths.append(len(matches[0]) * (bx - ax) / np.hypot(bx - ax, by - ay))
        if len(widths) < 2:
            return None
        radii.append(np.median(widths) / (2 * length))
    digits = np.column_stack((rays / length, radii))
    # A double contour or an ambiguous ordering should keep the family hand.
    direction = np.sign(digits[-1, 3] - digits[0, 3])
    if (
        min(radii) < 0.025
        or max(radii) > 0.105
        or np.max(abs(digits[:, [1, 3]])) > 0.74
        or np.any(np.diff(digits[:, 3]) * direction < 0.055)
    ):
        return None
    return length / span, digits, clean[:, wrist].sum() / (2 * length)


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
    fans = [
        finger_fan(rgb, mask, mid, axis, height, np.ptp(xx) / 2, side)
        for side in (-1, 1)
    ]
    if all(f is not None for f in fans):
        (span_a, rays_a, wrist_a), (span_b, rays_b, wrist_b) = fans
        wrist = (wrist_a + wrist_b) / 2
        if (
            abs(span_a - span_b) < 0.03
            and np.max(abs(rays_a - rays_b)) < 0.09
            and abs(wrist_a - wrist_b) < 0.04
            and 0.075 <= wrist <= 0.22
        ):
            hand["spread"] = {
                "length": round(float((span_a + span_b) / 2), 4),
                "wrist": round(float(wrist), 4),
                "digits": np.round((rays_a + rays_b) / 2, 4).tolist(),
            }
    a, b = a[2], b[2]
    if (
        a
        and b
        and (
            abs(a[0] - b[0]) >= 0.018
            or abs(a[1] - b[1]) >= 0.02
            or np.linalg.norm(a[2] - b[2]) >= 52
        )
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


def compare_open_hands(observed, rgb, mask, landmarks):
    """Check the native contours of both open hands against their measured source."""
    yy, xx = np.where(mask)
    if not len(yy) or landmarks is None:
        return {"matched": False, "hands": []}
    height = np.ptp(yy)
    axis = round(yy.min() + landmarks[1] * height)
    mid, span = (xx.min() + xx.max()) / 2, np.ptp(xx) / 2
    expected = np.asarray(observed["digits"])
    hands = []
    for side in (-1, 1):
        actual = finger_fan(rgb, mask, mid, axis, height, span, side)
        if actual is None:
            hands.append({"matched": False, "separated_digits": None})
            continue
        length, digits, _ = actual
        span_error = abs(observed["length"] - length)
        tip_error = np.linalg.norm(expected[:, 2:4] - digits[:, 2:4], axis=1).max()
        radius_error = np.max(abs(np.log(digits[:, 4] / expected[:, 4])))
        hands.append(
            {
                "separated_digits": 5,
                "max_tip_error_in_hand_lengths": round(float(tip_error), 4),
                "length_error_in_half_spans": round(float(span_error), 4),
                "max_radius_log_error": round(float(radius_error), 4),
                "matched": bool(
                    tip_error <= 0.10
                    and span_error <= 0.035
                    and radius_error <= np.log(1.5)
                ),
            }
        )
    return {"matched": all(s["matched"] for s in hands), "hands": hands}
