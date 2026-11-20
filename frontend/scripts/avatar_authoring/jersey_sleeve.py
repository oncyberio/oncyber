"""Measure a matched pair of short jersey sleeves on a frontal T-pose."""

import numpy as np
from scipy import ndimage


def bare_arms(rgb, mask, center, chin, scale_height, skin, cloth):
    """Locate the horizontal pair of bare arms beside the two sleeves in a portrait."""
    margin = min(center, mask.shape[1] - 1 - center)
    offsets = np.arange(
        round(0.23 * scale_height), min(round(0.28 * scale_height), int(margin) - 2)
    )
    if len(offsets) < 5:
        return None
    levels = np.arange(
        max(0, round(chin + 0.015 * scale_height)),
        min(len(mask), round(chin + 0.16 * scale_height)),
    )
    if len(levels) < 5:
        return None
    edges, colors = [], []
    for side in (-1, 1):
        cols = np.rint(center + side * offsets).astype(int)
        patch = rgb[np.ix_(levels, cols)]
        flesh = np.linalg.norm(patch - skin, axis=2)
        cloth_distance = np.linalg.norm(patch - cloth, axis=2)
        bare = (
            mask[np.ix_(levels, cols)] & (flesh < 105) & (flesh + 18 < cloth_distance)
        )
        hits = np.flatnonzero(bare.mean(1) >= 0.72)
        runs = [
            run
            for run in np.split(hits, np.flatnonzero(np.diff(hits) > 1) + 1)
            if 0.010 * scale_height <= len(run) <= 0.065 * scale_height
        ]
        if len(runs) != 1 or runs[0][0] == 0 or runs[0][-1] == len(levels) - 1:
            return None
        axis = runs[0][len(runs[0]) // 2]
        # The shadow underneath the arm can be far from the forehead dye.
        # Trace the silhouette around the confirmed skin, including that shade.
        pigment = np.median(patch[axis], axis=0)
        paper = np.median(np.concatenate((patch[:2], patch[-2:])), axis=(0, 1))
        distance = np.linalg.norm(patch - paper, axis=2)
        foreground = mask[np.ix_(levels, cols)] & (
            distance > 0.50 * np.linalg.norm(patch - pigment, axis=2)
        )
        labels, _ = ndimage.label(foreground.mean(1) >= 0.70)
        if not labels[axis]:
            return None
        cut = np.flatnonzero(labels == labels[axis])
        if cut[0] == 0 or cut[-1] == len(levels) - 1 or len(cut) > 0.065 * scale_height:
            return None
        edges.append(levels[cut[[0, -1]]])
        colors.append(pigment)
    if np.max(abs(edges[0] - edges[1])) > max(3, 0.012 * scale_height):
        return None
    return np.mean(edges, axis=0), np.median(colors, axis=0)


def jersey_sleeve(rgb, mask, kit):
    if kit is None:
        return None
    ys, xs = np.nonzero(mask)
    height = float(np.ptp(ys))
    if height < 96:
        return None
    mid = (xs.min() + xs.max()) / 2
    arm = round(ys.min() + height * kit[1])
    return measure_sleeves(rgb, mask, mid, arm, height)


def measure_sleeves(rgb, mask, mid, arm, height):
    """Trace cloth and bindings where both cuffs and a length of bare arm are visible."""
    # The torso and feet may be cropped. Use the calibrated standing scale,
    # and only use columns that actually exist on both sides of this image.
    limit = min(round(0.29 * height), int(min(mid, mask.shape[1] - 1 - mid)) - 2)
    u = np.arange(round(0.058 * height), limit)
    if np.count_nonzero(u > 0.23 * height) < 4:
        return None
    ys = np.arange(
        max(0, arm - round(0.075 * height)),
        min(mask.shape[0], arm + round(0.075 * height) + 1),
    )
    if not len(ys) or not ys[0] < arm < ys[-1]:
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
            if ratio >= 0.72 and (span[0] == 0 or span[-1] == mask.shape[0] - 1):
                return None
            top, bottom = (span[[0, -1]] - arm) / edge
            if not (-0.56 < top < -0.055 and 0.055 < bottom < 0.56):
                return None
            rows.append([top, bottom])
        # Measure the exposed arm just beyond the opening relative to the
        # same arm at the elbow. The latter already belongs to the family rig.
        spans = []
        for offset in (edge + 0.023 * height, 0.265 * height):
            cols = np.rint(mid + side * (offset + np.arange(-2, 3))).astype(int)
            if cols.min() < 0 or cols.max() >= mask.shape[1]:
                continue
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


def visible_jersey_score(source, front):
    """Compare just the source-visible shirt and arms in the measured orb plane."""
    from .fit import pixels
    from .sun_rays import measure_sun_rays
    from .visor import visor_seed

    def registered(path):
        rgb, mask = pixels(path, keep_components=True)
        seed = visor_seed(rgb, mask)
        if not seed:
            return
        center, radius = seed
        orb = measure_sun_rays(rgb, mask, center, (radius, radius), orb_only=True)
        if orb is None:
            return
        cx, cy, rx, ry = orb
        x = np.rint(cx + rx * np.arange(-158, 159) / 51).astype(int)
        y = np.rint(cy + ry * np.arange(60, 137) / 51).astype(int)
        inside = ((y >= 0) & (y < len(mask)))[:, None] & (x >= 0) & (x < mask.shape[1])
        xy = np.ix_(y.clip(0, len(mask) - 1), x.clip(0, mask.shape[1] - 1))
        return rgb[xy], mask[xy], inside

    ref = registered(source)
    if ref is None:
        return
    a, am, area = ref
    # Require a bilateral visible length of arm past each cuff. A close face
    # or an occlusion cannot provide a garment verdict. The center verifies
    # that some cloth below the sleeves actually belongs to this crop.
    if (
        any(
            (am & area)[:, zone].sum() < 65 for zone in [slice(0, 24), slice(-24, None)]
        )
        or (am & area)[-26:, 130:187].sum() < 150
    ):
        return
    native = registered(front)
    if native is None:
        return {"silhouette_iou": 0.0, "rgb_mae": 255.0}
    b, bm, captured = native
    both = am & bm & area & captured
    return {
        "silhouette_iou": round(
            float(both.sum() / max(1, ((am | bm) & area).sum())), 4
        ),
        "rgb_mae": round(float(abs(a[both] - b[both]).mean()), 2)
        if both.any()
        else 255.0,
    }
