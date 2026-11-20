"""Measure corrections on the rendered family body in the source's front plane."""

import numpy as np

from .fit import pixels

HEIGHT = 320


def limb_spans(mask, center, top, height):
    """Sample the middle forearms and lower legs in T-pose drawing coordinates."""
    columns = np.rint(
        center + height * np.array([-0.33, -0.30, -0.27, 0.27, 0.30, 0.33])
    ).astype(int)
    rows = np.rint(top + height * np.arange(0.80, 0.926, 0.025)).astype(int)
    if columns.min() < 0 or columns.max() >= mask.shape[1] or rows.max() >= len(mask):
        return np.zeros(2)
    arms = mask[: int(top + height * 0.47), columns].sum(axis=0)
    legs = mask[rows].sum(axis=1) / 2
    return np.array([np.median(arms), np.median(legs)])


def normalized_mask(path):
    _, mask = pixels(path, keep_components=True)
    y, x = np.nonzero(mask)
    unit = np.ptp(y) / HEIGHT
    row = np.rint(np.arange(HEIGHT + 1) * unit + y.min()).astype(int)
    col = np.rint(np.arange(-224, 225) * unit + (x.max() + x.min()) / 2).astype(int)
    return mask[
        np.ix_(row.clip(0, mask.shape[0] - 1), col.clip(0, mask.shape[1] - 1))
    ] & ((col >= 0) & (col < mask.shape[1]))


def body_edits(source, native, score, recipe):
    a, b = normalized_mask(source), normalized_mask(native)
    hip = score.get("hip_fraction", 0.5)
    y = np.arange(HEIGHT + 1) / HEIGHT
    x = np.arange(b.shape[1]) - b.shape[1] // 2

    def overlap(mask):
        return (a & mask).sum() / max(1, (a | mask).sum())

    before = overlap(b)
    best, build, legs = before, 1.0, 1.0
    for length in np.arange(0.92, 1.09, 0.01):
        height = hip + (1 - hip) * length
        shifted = y * height
        rows = (
            np.rint(
                HEIGHT
                * np.where(shifted < hip, shifted, hip + (shifted - hip) / length)
            )
            .astype(int)
            .clip(0, HEIGHT)
        )
        for width in np.arange(0.92, 1.09, 0.01):
            cols = np.rint(x * height / width + b.shape[1] // 2).astype(int)
            mask = b[np.ix_(rows, cols.clip(0, b.shape[1] - 1))] & (
                (cols >= 0) & (cols < b.shape[1])
            )
            value = overlap(mask) - 0.015 * (abs(width - 1) + abs(length - 1))
            if value > best:
                best, build, legs = value, width, length
    edits = []
    if best > before + 0.005:
        for key, scale in (("build", build), ("legLength", legs)):
            if abs(scale - 1) > 0.008:
                previous = recipe["proportions"].get(key, 1)
                edits.append(
                    {
                        "field": "proportions." + key,
                        "value": round(float(np.clip(previous * scale, 0.65, 1.5)), 3),
                    }
                )

    # Width of the T-pose at its fingertips is independent of the kit waist.
    spans = [
        np.ptp(np.where(mask[: int(0.45 * HEIGHT)])[1]) / HEIGHT for mask in (a, b)
    ]
    if spans[1] and abs(spans[0] - spans[1]) > 0.012:
        old = recipe["proportions"].get("armSpan", 1)
        value = round(
            float(np.clip(old * (spans[0] - 0.16) / (spans[1] - 0.16), 0.8, 1.25)), 4
        )
        if value != old:
            edits.append({"field": "proportions.armSpan", "value": value})

    expected, actual = [limb_spans(m, len(x) // 2, 0, HEIGHT) for m in (a, b)]
    if min(expected.min(), actual.min()) >= 3:
        base = recipe.get("limbWidth", {"arms": 1, "legs": 1})
        ratio = expected / actual
        if np.max(abs(ratio - 1)) > 0.08:
            values = {
                k: round(float(np.clip(base[k] * scale, 0.72, 1.4)), 3)
                for k, scale in zip(("arms", "legs"), ratio)
            }
            if values != base:
                edits.append({"field": "limbWidth", "value": values})

    if recipe["family"] == "rick-classic":

        def coat(mask):
            w = np.array(
                [np.ptp(np.where(row)[0]) / HEIGHT if row.any() else 0 for row in mask]
            )
            long = np.where((y > 0.56) & (y < 0.82) & (w > 0.15))[0]
            if not len(long):
                return
            bottom = long.max() / HEIGHT
            top = score["shirt_frame"][1]
            samples = (
                top + (bottom - top) * np.array([0.10, 0.37, 0.65, 0.89])
            ) * HEIGHT
            return bottom - top, np.array(
                [np.median(w[round(at) - 2 : round(at) + 3]) for at in samples]
            )

        observed, rendered = coat(a), coat(b)
        if observed and rendered:
            current = recipe.get("coatFit", {"hem": 1, "widths": [1] * 4})
            length = float(
                np.clip(current["hem"] * observed[0] / rendered[0], 0.85, 1.18)
            )
            widths = np.clip(
                np.array(current["widths"]) * observed[1] / rendered[1], 0.75, 1.35
            )
            if (
                abs(length - current["hem"]) > 0.018
                or np.max(abs(widths - current["widths"])) > 0.045
            ):
                edits.append(
                    {
                        "field": "coatFit",
                        "value": {
                            "hem": round(length, 3),
                            "widths": widths.round(3).tolist(),
                        },
                    }
                )
    return edits


def sleeve_cut(source, native, frame, recipe):
    """Measure the sleeve's cuff-to-shoulder thickness independently of the hand."""
    l, t, r, b = frame

    def measure(path):
        _, mask = pixels(path, keep_components=True)
        y, x = np.nonzero(mask)
        h = np.ptp(y)
        cx = (x.max() + x.min()) * 0.5
        rows = (np.arange(len(mask)) - y.min()) / h
        center = t + (194 - 218) * (b - t) / 107
        bands = []
        for pos in (-210, -157, -108, 108, 157, 210):
            col = round(cx + h * (l + (650.74 + pos - 630) * (r - l) / 41))
            if not 0 <= col < mask.shape[1]:
                continue
            values = rows[mask[:, col] & (abs(rows - center) < 0.052)]
            if len(values) > 4:
                bands.append([values.mean(), np.ptp(values)])
        return np.median(bands, axis=0) if len(bands) >= 4 else None

    a, z = measure(source), measure(native)
    if a is None or z is None or z[1] < 0.012:
        return
    previous = recipe.get("sleeveCut", {"radius": 1, "lift": 0})
    ratio = a[1] / z[1]
    rise = (a[0] - z[0]) * 107 / (b - t)
    if abs(ratio - 1) < 0.045 and abs(rise) < 0.95:
        return
    update = {
        "radius": round(float(np.clip(previous["radius"] * ratio, 0.72, 1.32)), 3),
        "lift": round(float(np.clip(previous["lift"] + rise, -5, 5)), 2),
    }
    if update != previous:
        return {"field": "sleeveCut", "value": update}
