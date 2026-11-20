"""Measure a matched pair of short jersey sleeves on a frontal T-pose."""

import numpy as np
from scipy import ndimage


def jersey_sleeve(rgb, mask, kit):
    if kit is None:
        return None
    ys, xs = np.nonzero(mask)
    height = float(np.ptp(ys))
    if height < 96:
        return None
    mid = (xs.min() + xs.max()) / 2
    arm = round(ys.min() + height * kit[1])
    u = np.arange(round(0.058 * height), round(0.29 * height))
    if mid - u[-1] < 0 or mid + u[-1] >= mask.shape[1]:
        return None
    ys = np.arange(arm - round(0.075 * height), arm + round(0.075 * height) + 1)
    if ys[0] < 0 or ys[-1] >= mask.shape[0]:
        return None
    cuts, reaches, tilts, swatches = [], [], [], []
    openings = []
    paper = np.median(np.vstack((rgb[0], rgb[-1])), axis=0)
    stations = np.array([0.52, 0.62, 0.72, 0.82, 0.92])
    samples = np.linspace(0.70, 0.992, 61)
    for side in (-1, 1):
        x = np.rint(mid + side * u).astype(int)
        if mask[arm, x[u > 0.23 * height]].mean() < 0.9:
            return None

        def cuff(y):
            line = np.median(rgb[max(0, y - 1) : y + 2, x], axis=0)
            skin = np.median(line[u > 0.23 * height], axis=0)
            cloth = (np.linalg.norm(line - skin, axis=1) > 43) & (u < 0.24 * height)
            last = np.flatnonzero(ndimage.median_filter(cloth, 3))
            return (u[last[-1]] + 0.5 if len(last) else 0), line, skin

        edge, line, skin = cuff(arm)
        if not 0.105 <= edge / height <= 0.235:
            return None
        body = np.median(line[(u > 0.61 * edge) & (u < 0.76 * edge)], axis=0)
        if np.linalg.norm(body - skin) < 50:
            return None
        reaches.append(edge / height)
        rows = []
        for ratio in stations:
            col = round(mid + side * edge * ratio)
            marks, _ = ndimage.label(mask[ys, col])
            label = marks[arm - ys[0]]
            if not label:
                return None
            span = ys[marks == label]
            top, bottom = (span[[0, -1]] - arm) / edge
            if not (-0.56 < top < -0.055 and 0.055 < bottom < 0.56):
                return None
            rows.append([top, bottom])
        # Measure the exposed arm just beyond the opening relative to the
        # same arm at the elbow. The latter already belongs to the family rig.
        spans = []
        for offset in (edge + 0.023 * height, 0.265 * height):
            cols = np.rint(mid + side * (offset + np.arange(-2, 3))).astype(int)
            patch = np.median(rgb[np.ix_(ys, cols)], axis=1)
            pigment = np.linalg.norm(patch - paper, axis=1) > 0.55 * np.linalg.norm(
                patch - skin, axis=1
            )
            labels, _ = ndimage.label(pigment & mask[np.ix_(ys, cols)].any(axis=1))
            label = labels[arm - ys[0]]
            if label:
                spans.append(ys[labels == label][[0, -1]])
        if len(spans) == 2 and np.ptp(spans[1]) >= 4:
            ends = (spans[0] - np.mean(spans[1])) / (np.ptp(spans[1]) * 0.5)
            if -0.3 > ends[0] >= -1.8 and 0.3 < ends[1] <= 1.8:
                openings.append(ends)
        cuts.append(rows)
        swatches.append(
            np.column_stack(
                [np.interp(samples * edge, u, line[:, c]) for c in range(3)]
            )
        )
        # The cuff tilt is the difference in sleeve reach above and below
        # the arm axis, extrapolated to the top and bottom of the cloth.
        dy = max(1, round(0.007 * height))
        upper, lower = cuff(arm - dy)[0], cuff(arm + dy)[0]
        radius = (rows[-1][1] - rows[-1][0]) * 0.5
        tilts.append((upper - lower) * radius / (2 * dy))

    if np.ptp(reaches) > 0.02 or np.max(abs(np.diff(cuts, axis=0))) > 0.15:
        return None
    colors = np.mean(swatches, axis=0)
    cloth = np.median(colors[samples <= 0.76], axis=0)
    # Lighter and darker bands can meet without a return to the shirt dye.
    change = colors - cloth
    marked = np.linalg.norm(change, axis=1) > 43
    tone = np.where(marked, np.where(change @ [0.21, 0.72, 0.07] >= 0, 1, -1), 0)
    step = samples[1] - samples[0]
    bands = []
    for run in np.split(np.arange(len(tone)), np.flatnonzero(np.diff(tone)) + 1):
        if not tone[run[0]] or len(run) * step < 0.019:
            continue
        start = samples[run[0]] - step / 2
        end = 1 if samples[run[-1]] > 0.973 else samples[run[-1]] + step / 2
        rgb8 = np.round(np.median(colors[run], axis=0)).astype(int)
        bands.append(
            dict(
                start=round(start, 3),
                end=round(end, 3),
                color="#%02x%02x%02x" % tuple(rgb8),
            )
        )
    if len(bands) > 3:
        return None
    return dict(
        reach=round(float(np.mean(reaches)), 4),
        rows=np.round(
            np.clip(np.mean(cuts, axis=0), [-0.55, 0.055], [-0.055, 0.55]), 4
        ).tolist(),
        tilt=round(float(np.clip(np.mean(tilts), -0.09, 0.09)), 4),
        bands=bands,
        **(
            {"armhole": np.mean(openings, axis=0).round(3).tolist()}
            if len(openings) == 2
            else {}
        ),
    )
