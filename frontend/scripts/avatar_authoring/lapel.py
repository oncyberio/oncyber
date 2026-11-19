"""Trace the two internal lapel seams of a fitted scientist's open coat."""

import numpy as np
from scipy import ndimage

from .fit import pixels


def simplify_lapel(line):
    indices = {0, len(line) - 1}

    def simplify(a, b):
        if b - a < 2:
            return
        trend = np.interp(line[a : b + 1, 1], line[[a, b], 1], line[[a, b], 0])
        err = abs(line[a : b + 1, 0] - trend)
        i = a + int(err.argmax())
        if err.max() > 1.3:
            indices.add(i)
            simplify(a, i)
            simplify(i, b)

    simplify(0, len(line) - 1)
    return line[sorted(indices)]


def lapel_edit(path, frame, coat_color):
    image, mask = pixels(path, keep_components=True)
    rows, cols = np.nonzero(mask)
    h, mid = np.ptp(rows), (cols.min() + cols.max()) / 2
    left, top, right, bottom = frame

    # Canonical shirt landmark box is shared with the coat in drawing space.
    def sample(x, y):
        px = (
            np.rint(mid + h * (left + (x - 630) * (right - left) / 41))
            .astype(int)
            .clip(0, image.shape[1] - 1)
        )
        py = (
            np.rint(rows.min() + h * (top + (y - 218) * (bottom - top) / 107))
            .astype(int)
            .clip(0, image.shape[0] - 1)
        )
        return image[py, px]

    coat = np.frombuffer(bytes.fromhex(coat_color[1:]), dtype="uint8").astype(float)
    if coat.mean() < 125:
        return
    paths, pigments = [], []
    for sign in (-1, 1):
        ys = np.arange(184, 272, 1.0)
        xs = 650.74 + sign * np.arange(13, 58, 0.38)
        xx, yy = np.meshgrid(xs, ys)
        patch = sample(xx, yy)
        dark = patch.mean(2) < min(125, coat.mean() - 58)
        # Cloth on both sides separates a lapel seam from the shirt opening,
        # hair, shoulder silhouette and lining.
        for shift in (-2.3, 2.3):
            cloth = sample(xx + shift, yy)
            dark &= np.linalg.norm(cloth - coat, axis=2) < 62
        coords = []
        last = 29.0
        for j, y in enumerate(ys):
            valid = np.where(dark[j])[0]
            if len(valid):
                groups = np.split(valid, np.flatnonzero(np.diff(valid) > 1) + 1)
                centers = [float(np.mean(xs[g])) for g in groups]
                x = min(centers, key=lambda xp: abs(abs(xp - 650.74) - last))
                if coords and y - coords[-1][1] < 5 and abs(x - coords[-1][0]) > 7:
                    continue
                coords.append((x, y))
                pigments.append(sample(x, y))
                last = abs(x - 650.74)
        if len(coords) < 14:
            return
        # Select a continuous upper lapel. A long gap usually separates a
        # notch from an unrelated waist fold.
        coords = np.array(coords)
        pieces = np.split(coords, np.flatnonzero(np.diff(coords[:, 1]) > 7) + 1)
        line = max(pieces, key=lambda p: np.ptp(p[:, 1]))
        if np.ptp(line[:, 1]) < 19 or np.ptp(line[:, 0]) < 4:
            return
        line[:, 0] = ndimage.median_filter(line[:, 0], 3, mode="nearest")
        line = simplify_lapel(line)
        if not 3 <= len(line) <= 18:
            return
        paths.append(
            np.column_stack(((line[:, 0] - 650.74) / 85, (line[:, 1] - 184) / 330))
            .round(4)
            .tolist()
        )
    if max(p[-1][1] for p in paths) - min(p[-1][1] for p in paths) > 0.18:
        return
    return {
        "field": "lapels",
        "value": {
            "color": "#"
            + np.median(pigments, axis=0).round().astype("uint8").tobytes().hex(),
            "paths": paths,
        },
    }


def has_contour_ink(path):
    """Look for narrow dark strokes on two independently colored silhouettes."""
    image, mask = pixels(path, keep_components=True)
    y, _ = np.where(mask)
    height = np.ptp(y)
    t = (np.arange(len(mask)) - y.min())[:, None] / height
    depth = ndimage.distance_transform_edt(mask) / height
    light = image.mean(2)
    for start, end in ((0.015, 0.13), (0.365, 0.68)):
        band = (t > start) & (t < end)
        rim = light[band & (depth > 0) & (depth < 0.006)]
        ground = light[band & (depth > 0.010) & (depth < 0.025)]
        if min(rim.size, ground.size) < 24:
            return False
        low = np.percentile(rim, 12)
        if low > 96 or np.median(ground) - low < 55:
            return False
    return True


def measure_panels(path, frame, swatch):
    """Measure the open coat at seven heights, from the chest to the hem."""
    image, mask = pixels(path, keep_components=True)
    yy, xx = np.nonzero(mask)
    h, top, mid = np.ptp(yy), yy.min(), (xx.min() + xx.max()) / 2
    l, t, r, b = frame
    cloth = np.frombuffer(bytes.fromhex(swatch[1:]), dtype="uint8").astype(float)
    if cloth.mean() < 120:
        return
    openings, liner = [], []
    for y, width in zip(
        (217, 245, 292, 340, 395, 453, 484), (44, 43, 46, 57, 76, 82, 82)
    ):
        row = round(top + h * (t + (y - 218) * (b - t) / 107))
        widths = []
        for side in (-1, 1):
            u = np.arange(0, width * 1.55, 0.45)
            cols = (
                np.rint(mid + h * (l + (650.74 + side * u - 630) * (r - l) / 41))
                .astype(int)
                .clip(0, mask.shape[1] - 1)
            )
            colors = np.median(image[max(0, row - 1) : row + 2, cols], axis=0)
            on = mask[row, cols]
            # The outer cloth usually has the same local pigment from seam
            # to edge. A lining, dark trousers or pen stroke breaks this run.
            distance = np.linalg.norm(colors - cloth, axis=1)
            pieces, count = ndimage.label((distance < 48) & on)
            runs = [np.flatnonzero(pieces == i) for i in range(1, count + 1)]
            runs = [
                indices
                for indices in runs
                if len(indices) > 5 and u[indices[-1]] > width * 0.58
            ]
            if not runs:
                continue
            run = max(runs, key=lambda indices: len(indices))
            outer = u[run[-1]]
            if outer > width * 1.48 or outer < width * 0.58:
                continue
            core = np.median(colors[run[len(run) // 3 : 2 * len(run) // 3 + 1]], axis=0)
            local = ndimage.binary_closing(
                (np.linalg.norm(colors - core, axis=1) < 32) & on, iterations=1
            )
            pieces, _ = ndimage.label(local)
            anchor = run[len(run) // 2]
            if not pieces[anchor]:
                continue
            same = np.where(pieces == pieces[anchor])[0]
            inner = u[same.min()]
            widths.append(float(np.clip(inner / outer, 0.24, 0.90)))
            if y >= 395:
                under = colors[(u < inner - 2) & (u > inner * 0.60) & on]
                if len(under):
                    shade = core.mean() - under.mean(1)
                    liner.extend(
                        under[
                            (shade > 24) & (shade < 84) & (np.ptp(under, axis=1) < 68)
                        ]
                    )
        openings.append(float(np.median(widths)) if widths else np.nan)
    valid = np.flatnonzero(np.isfinite(openings))
    if len(valid) < 4 or valid[-1] < 5 or not len(liner):
        return
    fit = np.interp(range(7), valid, np.asarray(openings)[valid])
    lining = "#" + np.median(liner, axis=0).round().astype("uint8").tobytes().hex()
    return {
        "field": "coatPanels",
        "value": {"opening": fit.round(3).tolist(), "lining": lining},
    }


def panel_edit(source, front, frame, paint, existing):
    target = measure_panels(source, frame, paint)
    if not target or not existing:
        return target
    actual = measure_panels(front, frame, paint)
    if not actual:
        return
    expected = target["value"]
    drawn = actual["value"]
    error = np.array(expected["opening"]) - np.array(drawn["opening"])

    def channels(color):
        return np.frombuffer(bytes.fromhex(color[1:]), dtype=np.uint8).astype(float)

    tint = channels(expected["lining"]) - channels(drawn["lining"])
    if np.max(abs(error)) < 0.032 and np.max(abs(tint)) < 8:
        return
    widths = (np.asarray(existing["opening"]) + 0.82 * error).clip(0.24, 0.9).round(3)
    pigment = (
        (channels(existing["lining"]) + tint.clip(-24, 24))
        .clip(0, 255)
        .round()
        .astype("uint8")
    )
    return {
        "field": "coatPanels",
        "value": {"opening": widths.tolist(), "lining": "#" + pigment.tobytes().hex()},
    }
