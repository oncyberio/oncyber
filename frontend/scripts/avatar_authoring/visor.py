"""Measure the front contour and two printed marks of a floating-orb visor."""

import numpy as np
from scipy import ndimage


def measure_visor(rgb, mask, orb):
    if orb is None:
        return
    cx, cy, rx, ry = orb
    y, x = np.mgrid[: mask.shape[0], : mask.shape[1]]
    u, v = (x - cx) / rx, (y - cy) / ry
    roi = (abs(u) < 1.19) & (abs(v) < 0.78) & mask
    labels, n = ndimage.label((rgb.max(2) < 103) & (np.ptp(rgb, axis=2) < 40) & roi)
    if not n:
        return
    area = np.bincount(labels.ravel())[1:]
    lens = labels == (1 + int(area.argmax()))
    if lens.sum() < 0.49 * rx * ry:
        return
    lo, hi = np.percentile(u[lens], [0.2, 99.8])
    if not -0.7 > lo > -1.21 or not 0.7 < hi < 1.21:
        return
    center, span = (lo + hi) / 2, (hi - lo) / 2
    # A side strap can extend past the deeper lens. Measure the projected
    # lens itself and let the same shell continue behind both temples.
    active = lens.sum(0) > 0.29 * ry
    used = np.flatnonzero(active)
    if len(used) < 10:
        return
    lo, hi = (used[[0, -1]] - cx) / rx
    center, span = (lo + hi) / 2, (hi - lo) / 2
    if abs(center) > 0.13 or not 0.65 < span < 1.15:
        return
    rows = []
    for a in np.linspace(-0.975, 0.975, 17):
        region = lens & (abs(u - center - span * a) < 0.027)
        if region.sum() < 3:
            return
        top, bottom = np.percentile(v[region], [1, 99])
        if not -0.8 < top < bottom < 0.82 or bottom - top < 0.14:
            return
        rows.append([round(float(top), 3), round(float(bottom), 3)])
    holes = ndimage.binary_fill_holes(lens) & ~lens
    bright = holes & (rgb.min(2) > 155)
    islands, n = ndimage.label(bright)
    marks = []
    for side in (-1, 1):
        candidates = [
            i
            for i in range(1, n + 1)
            if ((islands == i) & (u * side > 0.12)).sum() > 0.01 * rx * ry
        ]
        if not candidates:
            return
        hit = max(candidates, key=lambda i: (islands == i).sum())
        ux = u[islands == hit]
        vy = v[islands == hit]
        bx = np.percentile(ux, [0, 100])
        by = np.percentile(vy, [0, 100])
        mark = [np.mean(bx), np.mean(by), np.ptp(bx) / 2, np.ptp(by) / 2]
        if (
            abs(mark[0]) > 0.87
            or abs(mark[1]) > 0.5
            or not all(0.07 < t < 0.28 for t in mark[2:])
        ):
            return
        marks.append(np.round(mark, 3).tolist())
    return {
        "center": round(float(center), 3),
        "span": round(float(span), 3),
        "rows": rows,
        "marks": marks,
    }


def trace_front_visor(path, frame):
    from .fit import pixels
    from .sun_rays import measure_sun_rays

    image, mask = pixels(path, keep_components=True)
    y, x = np.nonzero(mask)
    span = np.ptp(y)
    x0, y0, x1, y1 = frame
    center = [
        (x.max() + x.min()) / 2 + span * (x0 + x1) / 2,
        y.min() + span * (y0 + y1) / 2,
    ]
    radius = (x1 - x0) * span * 0.47
    return measure_visor(
        image,
        mask,
        measure_sun_rays(image, mask, center, [radius, radius], orb_only=True),
    )


def profile_gap(path, paint):
    """Measure visible background between the native lens and cheek at 90°."""
    from .fit import pixels

    image, mask = pixels(path, keep_components=True)
    y, _x = np.nonzero(mask)
    height = np.ptp(y)
    top = y.min()
    y0, y1 = top + round(0.10 * height), top + round(0.25 * height)
    bounds = slice(y0, y1)
    rgb = image[bounds]
    dye = np.frombuffer(bytes.fromhex(paint[1:]), dtype=np.uint8).astype(float)
    hue = dye - dye.mean()
    if np.linalg.norm(hue) < 25:
        return
    colors = rgb - rgb.mean(2, keepdims=True)
    norm = np.linalg.norm(colors, axis=2)
    skin = (
        (colors @ hue > 0.83 * np.linalg.norm(hue) * norm) & (norm > 29) & mask[bounds]
    )
    ink = (rgb.max(2) < 94) & mask[bounds]
    gap = []
    for paint_row, dark, foreground in zip(skin, ink, mask[bounds]):
        xs = np.flatnonzero(paint_row)
        if len(xs) < height * 0.064:
            continue
        # The right-facing studio profile puts the lens in front of the orb.
        stops = np.flatnonzero(dark & (np.arange(len(dark)) >= np.median(xs)))
        if len(stops) < 1:
            continue
        left = xs[xs < stops[-1]]
        if not len(left):
            continue
        width = (~foreground[left[-1] : stops[-1] + 1]).sum() / height
        gap.append(width)
    return round(float(np.percentile(gap, 85)), 5) if len(gap) >= 4 else None
