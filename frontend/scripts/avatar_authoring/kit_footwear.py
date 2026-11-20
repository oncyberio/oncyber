"""Measure matching striped sports socks and low shoes on a front-facing kit."""

import numpy as np

from scipy.signal import find_peaks


def _runs(mask):
    cols = np.flatnonzero(mask)
    return np.split(cols, np.flatnonzero(np.diff(cols) > 1) + 1) if len(cols) else []


def kit_footwear(rgb, mask, landmarks):
    if landmarks is None:
        return None
    ys, xs = np.nonzero(mask)
    if not len(ys):
        return None
    height = np.ptp(ys)
    floor = ys.max()
    cuff = round(ys.min() + landmarks[4] * height)
    if height < 150 or not floor - 0.38 * height < cuff < floor - 0.09 * height:
        return None
    cx = (xs.min() + xs.max()) / 2
    central = abs(np.arange(mask.shape[1]) - cx) < height * 0.18
    probe = round(floor - height * 0.018)
    # A white sock above a pair of darker shoes must be visible on both legs.
    feet = [
        run
        for run in _runs(mask[probe] & central & (rgb[probe].mean(1) < 135))
        if len(run) > 0.016 * height
    ]
    if len(feet) != 2:
        return None
    axes = [round(np.median(run)) for run in feet]
    spacing = axes[1] - axes[0]
    if not 0.04 * height < spacing < 0.25 * height:
        return None
    half = max(1, round(min(map(len, feet)) * 0.14))
    strips = [np.median(rgb[:, x - half : x + half + 1], axis=1) for x in axes]
    dark = np.maximum(strips[0], strips[1]).max(1) < 135
    shoes = [run for run in _runs(dark & (np.arange(len(mask)) > cuff)) if probe in run]
    if not shoes:
        return None
    shoe_top, sole = shoes[0][[0, -1]]
    sock_height = shoe_top - cuff
    shoe_height = sole - shoe_top + 1
    if (
        sock_height < 10
        or shoe_height < 8
        or not 0.10 < shoe_height / (sole - cuff + 1) < 0.47
    ):
        return None

    stalk = np.mean(strips, axis=0)
    knit = stalk[cuff:shoe_top]
    light = (knit.min(1) > 150) & (np.ptp(knit, axis=1) < 52)
    if light.mean() < 0.49:
        return None
    cloth = np.median(knit[light], axis=0)

    def color(v):
        return "#" + np.rint(v).clip(0, 255).astype("uint8").tobytes().hex()

    bands = []
    # Require both legs to carry the stripe. A contact shadow, sole or
    # boundary against bare skin cannot introduce a binding.
    colored = np.logical_and.reduce(
        [np.linalg.norm(s[cuff:shoe_top] - cloth, axis=1) > 60 for s in strips]
    )
    for run in _runs(colored):
        start, end = run[0] / sock_height, (run[-1] + 1) / sock_height
        if start < 0.07 or end > 0.95 or not 0.018 <= end - start <= 0.26:
            continue
        pigment = np.median(knit[run], axis=0)
        if (
            np.linalg.norm(
                np.median(strips[0][cuff + run] - strips[1][cuff + run], axis=0)
            )
            > 35
        ):
            return None
        bands.append(
            {"start": round(start, 3), "end": round(end, 3), "color": color(pigment)}
        )
    if len(bands) > 3:
        return None

    widths = []
    for t in (0.08, 0.28, 0.52, 0.80, 0.94):
        row = round(shoe_top + t * (shoe_height - 1))
        runs = _runs(mask[row] & central & (rgb[row].mean(1) < 135))
        pair = [next((len(r) for r in runs if x in r), 0) for x in axes]
        if min(pair) < 3 or min(pair) < 0.72 * max(pair):
            return None
        widths.append(round(float(np.mean(pair) / spacing), 3))
    if min(widths) < 0.14 or max(widths) > 0.85:
        return None

    def shoe_color(lo, hi):
        return color(
            np.median(
                stalk[
                    shoe_top + round(lo * shoe_height) : shoe_top
                    + round(hi * shoe_height)
                ],
                axis=0,
            )
        )

    # Repeated transverse dark marks on the vamp identify the visible laces.
    # The same ridges must occur at matching heights on both shoes.
    tongues = [
        s[shoe_top : shoe_top + round(0.49 * shoe_height)].mean(1) for s in strips
    ]
    valleys = [
        find_peaks(-t, prominence=5, distance=max(1, round(shoe_height * 0.06)))[0]
        for t in tongues
    ]
    laces = [
        round(float(i / shoe_height), 3)
        for i in valleys[0]
        if 0.09 <= i / shoe_height <= 0.46
        and np.any(abs(valleys[1] - i) <= max(1, round(0.025 * shoe_height)))
    ]
    return {
        "laces": laces[:4] if len(laces) >= 2 else [],
        "knit": color(cloth),
        "bands": bands,
        "rise": round(float(shoe_height / (sole - cuff + 1)), 3),
        "widths": widths,
        "upper": shoe_color(0.22, 0.67),
        "sole": shoe_color(0.83, 1),
    }


def compare_footwear(reference, native):
    """Compare the feet in each figure's registered standing frame."""
    from .fit import pixels
    from .sun_rays import kit_landmarks

    frames = []
    details = {}
    for path in (reference, native):
        rgb, mask = pixels(path, keep_components=True)
        ys, xs = np.nonzero(mask)
        height = np.ptp(ys)
        cx = (xs.min() + xs.max()) / 2
        landmarks = kit_landmarks(rgb, mask)
        measured = kit_footwear(rgb, mask, landmarks)
        if measured is not None:
            details["native" if frames else "drawing"] = {
                "bands": measured["bands"],
                "laces": measured["laces"],
            }
        if not frames:
            if landmarks is None:
                return None
            # Use the drawing's cuff-to-floor region for both images. Global
            # registration retains errors in stripe height and shoe placement.
            sample_y = np.arange(round(landmarks[4] * 512) - 3, 513) / 512
        y = np.rint(ys.min() + sample_y * height).astype(int)
        x = np.rint(cx + np.arange(-79, 80) * height / 512).astype(int)
        grid = np.ix_(y.clip(0, len(mask) - 1), x.clip(0, mask.shape[1] - 1))
        valid = ((x >= 0) & (x < mask.shape[1]))[None, :] & (
            (y >= 0) & (y < len(mask))
        )[:, None]
        frames.append((rgb[grid], mask[grid] & valid))
    (a, left), (b, right) = frames
    inside = left & right
    if not inside.any():
        return None
    return {
        "silhouette_iou": round(float(inside.sum() / (left | right).sum()), 4),
        "rgb_mae": round(float(np.abs(a[inside] - b[inside]).mean()), 2),
        **details,
    }
