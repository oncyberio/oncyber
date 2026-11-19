"""Measure distinct visible shirt and mouth boundaries at source resolution."""

import numpy as np
from scipy import ndimage

from .household import pigment


def open_smile(rgb, eyes, crown, chin, skin):
    """Require bright enamel inside a connected, dark mouth below both eyes."""
    centers = np.array([[(a + c) / 2, (b + d) / 2] for a, b, c, d in eyes])
    gap = centers[1, 0] - centers[0, 0]
    cx, cy = centers.mean(0)
    left, right = max(0, round(cx - gap)), min(rgb.shape[1], round(cx + gap) + 1)
    top, bottom = (
        round(cy + 0.18 * (chin - cy)),
        min(rgb.shape[0], round(chin - 0.025 * (chin - crown))),
    )
    patch = rgb[top:bottom, left:right]
    if min(patch.shape[:2]) < 4:
        return {}
    luma = patch @ [0.2126, 0.7152, 0.0722]
    dark = luma < min(116, 0.74 * (skin @ [0.2126, 0.7152, 0.0722]))
    labels, n = ndimage.label(dark, np.ones((3, 3)))
    candidates = []
    for i, (ys, xs) in enumerate(ndimage.find_objects(labels), 1):
        w, h = xs.stop - xs.start, ys.stop - ys.start
        if not (
            0.45 * gap < w < 2 * gap
            and 0.16 * w < h < 0.85 * w
            and abs(left + (xs.start + xs.stop) / 2 - cx) < 0.32 * gap
        ):
            continue
        component = labels[ys, xs] == i
        area = ndimage.binary_fill_holes(component)
        # If the top edge is open against white teeth, close the columns
        # inside the observed mouth contour before looking for enamel.
        for x in range(w):
            hits = np.flatnonzero(component[:, x])
            if len(hits) > 1:
                area[hits[0] : hits[-1] + 1, x] = True
        colors = patch[ys, xs]
        teeth = area & (colors.min(2) > 145) & (np.ptp(colors, axis=2) < 46)
        if teeth.sum() < max(3, 0.035 * w * h):
            continue
        depth = ndimage.distance_transform_edt(np.pad(teeth, 1))[1:-1, 1:-1]
        ty, tx = np.unravel_index(depth.argmax(), depth.shape)
        x0, y0 = left + xs.start, top + ys.start
        box = [x0, y0, x0 + w, y0 + h]
        candidates.append(
            (
                teeth.sum(),
                {
                    "mouth_box": box,
                    "mouth_y": round(y0 + h / 2),
                    "tooth_sample": [x0 + int(tx), y0 + int(ty)],
                },
            )
        )
    return max(candidates, key=lambda c: c[0])[1] if candidates else {}


def visible_torso(rgb, mask, head, shirt_xy):
    """Use shirt width below the T-pose sleeve where the reference shows both side seams."""
    left, top, right, chin = head
    height = chin - top
    cx = (left + right) / 2
    y0 = min(len(mask), round(chin + 0.15 * height))
    if len(mask) - y0 < 0.12 * height:
        return None
    shirt = pigment(rgb, shirt_xy)
    color = np.linalg.norm(rgb - shirt, axis=2) < 55
    samples = []
    for y in range(y0, len(mask)):
        labels, n = ndimage.label(mask[y])
        label = labels[round(cx)]
        if not label:
            continue
        xs = np.flatnonzero(labels == label)
        if xs.min() <= 2 or xs.max() >= mask.shape[1] - 3:
            continue
        half = (xs.max() - xs.min()) / (2 * height)
        if 0.17 < half < 0.98 and color[y, xs].mean() > 0.49:
            samples.append(half)
    if len(samples) < max(3, 0.065 * height):
        return None
    return round(float(np.percentile(samples, 30)), 4)


def visible_placket(rgb, head, fabric):
    """A polo placket has a vertical ink stroke between two cloth-colored edges."""
    left, top, right, chin = head
    height = chin - top
    center = (right + left) / 2
    start = round(chin + 0.18 * height)
    stop = min(len(rgb), round(chin + 0.57 * height))
    if stop - start < 0.17 * height:
        return False
    cloth = pigment(rgb, fabric)
    offset = max(3, round(height * 0.04))
    for x in range(
        max(offset, round(center - 0.08 * height)),
        min(rgb.shape[1] - offset, round(center + 0.08 * height)),
    ):
        middle = rgb[start:stop, x]
        edges = rgb[start:stop, [x - offset, x + offset]]
        has_ink = (middle @ [0.2126, 0.7152, 0.0722]) < 0.61 * (
            cloth @ [0.2126, 0.7152, 0.0722]
        )
        fabric_edges = (np.linalg.norm(edges - cloth, axis=2) < 48).all(axis=1)
        if np.count_nonzero(has_ink & fabric_edges) >= 0.16 * height:
            return True
    return False
