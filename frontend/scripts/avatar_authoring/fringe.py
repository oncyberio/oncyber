"""Trace the visible hair-to-forehead boundary in the drawing plane."""

import numpy as np
from scipy import ndimage


def forehead_fringe(rgb, mask, center, top, height, width, skin, hair, eyes=()):
    if np.linalg.norm(hair - skin) < 52 or min(width, height) < 35:
        return
    cols = np.arange(
        max(0, round(center - 0.48 * width)),
        min(mask.shape[1], round(center + 0.48 * width) + 1),
    )
    rows = np.arange(max(0, round(top)), min(len(mask), round(top + 0.76 * height)))
    if len(cols) < 20 or len(rows) < 16:
        return
    patch = rgb[np.ix_(rows, cols)]
    active = mask[np.ix_(rows, cols)]
    dh = np.linalg.norm(patch - hair, axis=2)
    ds = np.linalg.norm(patch - skin, axis=2)
    direction = skin - hair
    fraction = ((patch - hair) @ direction) / (direction @ direction)
    residual = np.linalg.norm(patch - hair - fraction[:, :, None] * direction, axis=2)
    # A narrow forehead gap above an eyebrow may be only two antialiased
    # pixels. Their mixture can be closer to the hair than to the full skin.
    skin_edge = (
        (fraction > 0.23)
        & (residual < max(10, 0.12 * np.linalg.norm(direction)))
        & active
    )
    dyed = (dh < 78) & (dh + 16 < ds) & active & ~skin_edge
    # Only pigment attached to the crown can end the fringe. A matching
    # eyebrow just below it remains a separate part of the face.
    radius = max(1, round(height * 0.012))
    core = ndimage.binary_erosion(dyed, iterations=radius)
    labels, count = ndimage.label(core, np.ones((3, 3)))
    if not count:
        return
    crown = np.unique(
        labels[
            (rows < top + height * 0.25)[:, None] & (abs(cols - center) < width * 0.38)
        ]
    )
    areas = np.bincount(labels.ravel())
    rooted = np.isin(
        labels, [i for i in crown if i and areas[i] > max(12, dyed.sum() * 0.055)]
    )
    rooted = ndimage.binary_dilation(rooted, iterations=radius + 1) & dyed
    face = (ds < 78) & (ds + 15 < dh) & active
    for left, upper, right, bottom in eyes:
        box = (
            ((rows >= upper) & (rows < bottom))[:, None]
            & (cols >= left)
            & (cols < right)
        )
        face |= box & (patch.min(2) > 170) & (np.ptp(patch, axis=2) < 42) & active
    look = max(3, round(0.048 * height))
    path = []
    for i, x in enumerate(cols):
        # Search from the crown towards the face. Several adjacent skin
        # pixels distinguish an actual opening from a highlight inside a lock.
        ends = np.flatnonzero(rooted[:-1, i] & ~rooted[1:, i])
        for end in ends:
            if not 0.075 * height < rows[end] - top < 0.70 * height:
                continue
            below = face[end + 1 : end + look + 1, i]
            gap = (
                skin_edge[end + 1 : end + 3, i].all()
                and face[end + 1 : end + look * 2 + 1, i].any()
            )
            if (below.sum() >= max(2, look * 0.42) or gap) and rooted[
                max(0, end - look) : end + 1, i
            ].mean() > 0.7:
                path.append([x, rows[end] + 0.5])
                break
    if len(path) < 12:
        return
    # A printed line, uncovered ear or gap between locks can interrupt the
    # trace at a temple. Keep the continuous section crossing the forehead.
    path = np.array(path)
    gaps = np.diff(path[:, 0])
    jump = abs(np.diff(path[:, 1]))
    runs = np.split(
        path,
        np.flatnonzero(
            (gaps > max(3, 0.085 * width))
            | ((gaps > 0.045 * width) & (jump > 0.05 * height))
        )
        + 1,
    )
    usable = [
        r
        for r in runs
        if r[0, 0] < center - 0.13 * width and r[-1, 0] > center + 0.13 * width
    ]
    if not usable:
        return
    path = max(usable, key=len)
    if np.ptp(path[:, 0]) < 0.4 * width:
        return
    # The lower tips of the sideburns mark the ends of the front seam.
    # Beyond them the visible boundary turns upward around an ear or to paper.
    mid = int(abs(path[:, 0] - center).argmin())
    left = int(np.argmax(path[: mid + 1, 1]))
    right = mid + int(np.argmax(path[mid:, 1]))
    if path[left, 0] < center - 0.13 * width and path[right, 0] > center + 0.13 * width:
        path = path[left : right + 1]
    # Keep sharp turns while discarding stair steps of a single source pixel.
    points = np.column_stack(
        (
            (path[:, 0] - center) / width,
            (ndimage.median_filter(path[:, 1], 3, mode="nearest") - top) / height,
        )
    )
    kept = [0, len(points) - 1]
    while len(kept) < 16:
        worst, index = 0, None
        for lo, hi in zip(kept, kept[1:]):
            delta = points[hi] - points[lo]
            vec = points[lo + 1 : hi] - points[lo]
            if not len(vec):
                continue
            distance = abs(
                vec[:, 0] * delta[1] - vec[:, 1] * delta[0]
            ) / np.linalg.norm(delta)
            i = int(distance.argmax())
            if distance[i] > worst:
                worst, index = distance[i], lo + 1 + i
        if worst < max(0.009, 0.9 / height):
            break
        kept = sorted([*kept, index])
    return points[kept].round(4).tolist()
