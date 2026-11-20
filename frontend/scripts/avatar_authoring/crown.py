"""Measure the two ordered edges of a swept crown, including returning tips."""

import numpy as np
from contourpy import contour_generator
from scipy import ndimage


def crown_edges(rgb, mask, center, top, height, width, skin, hair):
    if min(height, width) < 46 or np.linalg.norm(hair - skin) < 48:
        return None
    x0, x1 = (
        max(0, int(center - width * 0.78)),
        min(mask.shape[1], round(center + width * 0.78) + 1),
    )
    y0, y1 = max(0, int(top)), min(len(mask), round(top + height * 0.44) + 1)
    patch = rgb[y0:y1, x0:x1]
    dh = np.linalg.norm(patch - hair, axis=2)
    ds = np.linalg.norm(patch - skin, axis=2)
    pigment = (dh < 75) & (dh + 14 < ds)
    # Parting ink can divide the two colored locks. Include adjoining ink,
    # while keeping the patch of paper between the tips and the scalp open.
    dark = patch.max(2) < min(95, max(45, hair.max() * 0.83))
    cap = (pigment | (dark & ndimage.binary_dilation(pigment, iterations=2))) & mask[
        y0:y1, x0:x1
    ]
    if len(cap) < 10 or cap.shape[1] < 14 or cap[:, [0, -1]].any():
        return None
    ends = np.flatnonzero(cap[-1])
    if (
        not len(ends)
        or not ends[0] + x0
        < center - width * 0.24
        < center + width * 0.24
        < ends[-1] + x0
    ):
        return None
    cap[-1, ends[0] : ends[-1] + 1] = True
    outlines = contour_generator(z=np.pad(cap.astype(float), 1)).lines(0.5)
    if not outlines:
        return None

    def area(p):
        return abs(np.sum(p[:-1, 0] * p[1:, 1] - p[1:, 0] * p[:-1, 1]))

    rim = max(outlines, key=area)[:-1] + [x0 - 1, y0 - 1]
    summit = np.flatnonzero(rim[:, 1] == rim[:, 1].min())
    apex = summit[np.argmin(abs(rim[summit, 0] - np.median(rim[summit, 0])))]
    if (
        abs(rim[apex, 0] - center) > width * 0.34
        or abs(rim[apex, 1] - top) > height * 0.065
    ):
        return None
    paths = []
    hooked = False
    for direction in (-1, 1):
        arc = rim[(apex + direction * np.arange(len(rim))) % len(rim)]
        hit = np.flatnonzero(arc[:, 1] >= y1 - 1.25)
        if not len(hit):
            return None
        arc = arc[: hit[0] + 1]
        path = (arc - [center, top]) / [width, height]
        path[:, 1] = np.maximum(path[:, 1], 0)
        path[-1, 1] = 0.44
        # Preserve sub-pixel antialiasing only up to the chart's point budget.
        keep = [0, len(path) - 1]
        while len(keep) < 15:
            error, index = 0, None
            for a, b in zip(keep, keep[1:]):
                delta = path[b] - path[a]
                step = np.clip(
                    (path[a : b + 1] - path[a]) @ delta / max(delta @ delta, 1e-9), 0, 1
                )
                distances = np.linalg.norm(
                    path[a : b + 1] - (path[a] + step[:, None] * delta), axis=1
                )
                i = int(distances.argmax())
                if distances[i] > error:
                    error, index = distances[i], a + i
            if error < max(0.006, 0.72 / min(width, height)):
                break
            keep = sorted([*keep, index])
        kept = path[keep]
        # Only install a new cap when the exterior turns upward as it travels
        # from the summit down to a temple. Smooth domes keep the family cap.
        returns = np.maximum.accumulate(kept[:, 1]) - kept[:, 1]
        hooked |= np.any((abs(kept[:, 0]) > 0.20) & (returns > 0.026))
        paths.append(kept.round(4).tolist())
    paths.sort(key=lambda p: p[-1][0])
    if not hooked or paths[0][-1][0] >= -0.24 or paths[1][-1][0] <= 0.24:
        return None
    apex_x = paths[0][0][0]
    if any(x > apex_x for x, _ in paths[0]) or any(x < apex_x for x, _ in paths[1]):
        return None
    return paths
