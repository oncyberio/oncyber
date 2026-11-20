"""Measure the front contour and two printed marks of a floating-orb visor."""

import numpy as np
from scipy import ndimage


def visor_seed(rgb, mask):
    """Find a horizontal dark visor containing two bright enclosed marks."""
    ys = np.nonzero(mask)[0]
    if not len(ys):
        return
    stop = min(len(mask), round(ys.min() + 0.72 * np.ptp(ys)) + 1)
    dark = mask[:stop] & (rgb[:stop].max(2) < 108)
    # Plum and navy skin can join the frame into a plausible dark shape.
    # Prefer the black lens around the marks, then allow tinted frames.
    seed = marked_lens(rgb[:stop], dark & (np.ptp(rgb[:stop], axis=2) < 24))
    return seed or marked_lens(rgb[:stop], dark)


def marked_lens(rgb, dark):
    dark, _ = ndimage.label(dark)
    candidates = []
    for i, box in enumerate(ndimage.find_objects(dark), 1):
        sy, sx = box
        width, height = sx.stop - sx.start, sy.stop - sy.start
        if width < 12 or not 1.45 < width / height < 4.6:
            continue
        component = dark[box] == i
        if component.mean() < 0.42:
            continue
        white = (rgb[box].min(2) > 150) & (np.ptp(rgb[box], axis=2) < 46)
        holes = ndimage.binary_fill_holes(component) & white
        marks, n = ndimage.label(holes)
        areas = np.bincount(marks.ravel(), minlength=n + 1)
        centers = [
            np.nonzero(marks == k)[1].mean() / width
            for k in np.flatnonzero(areas[1:] > 0.009 * width * height) + 1
        ]
        paired = any(x < 0.46 for x in centers) and any(x > 0.54 for x in centers)
        if not paired:
            # A warm studio light can turn white crosses champagne or cream.
            # Require two enclosed, similarly sized marks on the same eye line.
            bright = (rgb[box].min(2) > 146) & (np.ptp(rgb[box], axis=2) < 100)
            islands, n = ndimage.label(
                ndimage.binary_fill_holes(component) & ~component & bright
            )
            blobs = []
            for k, tile in enumerate(ndimage.find_objects(islands), start=1):
                if tile is None:
                    continue
                y, x = np.nonzero(islands[tile] == k)
                area = len(x) / (width * height)
                aspect = (np.ptp(x) + 1) / (np.ptp(y) + 1)
                if 0.009 < area < 0.12 and 0.52 < aspect < 1.85:
                    blobs.append(
                        (
                            (tile[1].start + x.mean()) / width,
                            (tile[0].start + y.mean()) / height,
                            area,
                        )
                    )
            paired = any(
                0.1 < x < 0.43
                and 0.57 < u < 0.9
                and abs(y - v) < 0.16
                and 0.45 < a / b < 2.2
                for x, y, a in blobs
                for u, v, b in blobs
            )
        if paired:
            candidates.append(
                (width, ((sx.start + sx.stop - 1) / 2, (sy.start + sy.stop - 1) / 2))
            )
    if candidates:
        span, center = max(candidates)
        return center, span / 1.9


def visor_contact(rgb, mask, orb, center, span, rows):
    """Measure the soft shadow below the lower lens edge, in units of orb radius."""
    ox, oy, rx, ry = orb
    u = np.linspace(center - 0.64 * span, center + 0.64 * span, 23)
    hem = np.interp(
        u, np.linspace(center - span, center + span, len(rows)), np.array(rows)[:, 1]
    )
    depth = np.array([0.04, 0.065, 0.09, 0.12, 0.155, 0.195, 0.24])
    x = np.rint(ox + u * rx).astype(int)
    y = np.rint(oy + (hem[None, :] + depth[:, None]) * ry).astype(int)
    if (
        x.min() < 0
        or x.max() >= mask.shape[1]
        or y.min() < 0
        or y.max() >= mask.shape[0]
    ):
        return
    visible = mask[y, x].all(axis=0)
    if visible.sum() < 12:
        return
    color = rgb[y, x][:, visible] / 255
    linear = np.where(color <= 0.04045, color / 12.92, ((color + 0.055) / 1.055) ** 2.4)
    luma = linear @ [0.2126, 0.7152, 0.0722]
    far = np.median(luma[-2:], axis=0)
    if np.median(far) < 0.025:
        return
    loss = 1 - np.median(luma / np.maximum(0.01, far), axis=1)
    if loss[0] < 0.20 or loss[1] < 0.10:
        return
    widths = np.linspace(0.075, 0.26, 38)
    t = np.minimum(1, depth[None, :] / widths[:, None])
    kernel = 1 - t * t * (3 - 2 * t)
    strength = np.clip((kernel @ loss) / np.sum(kernel**2, axis=1), 0, 0.92)
    error = np.mean((strength[:, None] * kernel - loss) ** 2, axis=1)
    i = error.argmin()
    if strength[i] >= 0.20 and error[i] < 0.016:
        return {
            "strength": round(float(strength[i]), 3),
            "width": round(float(widths[i]), 3),
        }


def lens_rim(rgb, lens, marks, orb):
    """Trace the full front rim, including the narrow wings above the temples."""
    cx, cy, rx, ry = orb
    yy, xx = np.nonzero(lens)
    cols = np.unique(xx)
    if len(cols) < 18 or not np.all(np.diff(cols) == 1):
        return
    rows = np.column_stack(
        (
            ndimage.minimum(yy, xx, cols) - 0.5,
            ndimage.maximum(yy, xx, cols) + 0.5,
        )
    )
    rows = (rows - cy) / ry
    rows = ndimage.median_filter(rows, size=(3, 1), mode="nearest")
    u = (cols - cx) / rx
    if abs(u).max() > 1.11 or abs(rows).max() > 0.8:
        return
    # Keep the observed shoulders and the bridge notch while spending fewer
    # vertices on the almost straight top edge. Both edges use the same knots.
    knots = [0, len(cols) - 1]
    while len(knots) < 25:
        estimate = np.column_stack(
            [np.interp(u, u[knots], row[knots]) for row in rows.T]
        )
        err = np.abs(estimate - rows).max(axis=1)
        where = int(err.argmax())
        if err[where] <= max(0.015, 1.1 / ry):
            break
        knots = sorted([*knots, where])
    # Wide panels follow the spherical surface between silhouette corners.
    for x in np.linspace(u[0], u[-1], 13)[1:-1]:
        idx = np.abs(u - x).argmin()
        if np.min(abs(u[knots] - u[idx])) > 0.07:
            knots.append(idx)
    knots.sort()
    v = (yy - cy) / ry
    col_index = xx - cols[0]
    height = rows[col_index, 1] - rows[col_index, 0]
    t = (v - rows[col_index, 0]) / np.maximum(0.01, height)
    core = (abs(u[col_index]) < 0.7) & (height > 0.25)
    dye = []
    for selected in (core & (t > 0.10) & (t < 0.33), core & (t > 0.65) & (t < 0.88)):
        if selected.sum() < 10:
            return
        dye.append(np.median(rgb[yy[selected], xx[selected]], axis=0))
    if marks.sum() < 6:
        return

    def swatch(color):
        return "#" + np.rint(color).clip(0, 255).astype(np.uint8).tobytes().hex()

    return {
        "columns": np.column_stack((u[knots], rows[knots])).round(4).tolist(),
        "upper": swatch(dye[0]),
        "lower": swatch(dye[1]),
        "glyph": swatch(np.percentile(rgb[marks], 75, axis=0)),
    }


def has_sunglass_arms(rim, marks):
    if not rim or len(marks) != 2:
        return False
    u, top, bottom = np.array(rim["columns"]).T
    if u[0] > -0.89 or u[-1] < 0.89:
        return False
    height = bottom - top
    deep = min(np.interp(mark[0], u, height) for mark in marks)
    bridge = np.interp(np.mean([mark[0] for mark in marks]), u, height)
    # Two deep bowls, a raised bridge, and thin painted wings on both
    # outer edges identify a sunglass frame in a frontal drawing.
    wings = np.interp([u[0] + 0.045, u[-1] - 0.045], u, height)
    return deep >= 0.30 and bridge < 0.86 * deep and max(wings) < 0.44 * deep


def measure_visor(rgb, mask, orb):
    from .family import FAMILIES

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
    mark_pixels = np.zeros_like(lens)
    for side in (-1, 1):
        candidates = [
            i
            for i in range(1, n + 1)
            if ((islands == i) & (u * side > 0.12)).sum() > 0.01 * rx * ry
        ]
        if not candidates:
            return
        hit = max(candidates, key=lambda i: (islands == i).sum())
        mark_pixels |= islands == hit
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
        # Input bounds include the diagonal strokes' end caps on a raised
        # surface. Store the centerline in the orb plane used by drawOrbVisor.
        mascot = FAMILIES["sunshine"]
        glyph = mascot["visorGlyph"]
        projected = 1 + glyph["lift"] / np.array(mascot["crownRoot"][2:])
        centerline = np.array(mark).reshape(2, 2) / projected
        centerline[1] = np.maximum(
            0.07, (centerline[1] + 0.5 / np.array([rx, ry])) / (1 + glyph["stroke"])
        )
        marks.append(centerline.round(3).ravel().tolist())
    contact = visor_contact(rgb, mask, orb, center, span, rows)
    # Both cheeks must show a strip of skin outside the end of the lens.
    # Missing or cropped temples give no evidence to remove the default band.
    visible_skin = []
    mid = np.median(rows)
    for side in (-1, 1):
        temple = (
            ((u - center) * side > span + 0.04)
            & (abs(u) < 0.96)
            & (abs(v - mid) < 0.18)
        )
        visible_skin.append(
            temple.sum() > 0.012 * rx * ry
            and mask[temple].mean() > 0.95
            and not np.any(lens[temple])
        )
    rim = lens_rim(rgb, lens, mark_pixels, orb)
    mounting = {"strap": False} if all(visible_skin) else {}
    if not mounting and has_sunglass_arms(rim, marks):
        mounting = {"strap": "temples"}
    return {
        **({"rim": rim} if rim else {}),
        **({"contact": contact} if contact else {}),
        **mounting,
        "center": round(float(center), 3),
        "span": round(float(span), 3),
        "rows": rows,
        "marks": marks,
    }


def front_orb_seed(image, mask, frame):
    """Prefer the visible lens and its two marks over the fitted rest-pose box."""
    y, x = np.nonzero(mask)
    span = np.ptp(y)
    x0, y0, x1, y1 = frame
    fallback = [
        (x.max() + x.min()) / 2 + span * (x0 + x1) / 2,
        y.min() + span * (y0 + y1) / 2,
    ]
    seed = visor_seed(image, mask)
    if seed and np.linalg.norm(np.asarray(seed[0]) - fallback) < span * 0.12:
        return seed
    return fallback, (x1 - x0) * span * 0.47


def trace_front_visor(path, frame):
    from .fit import pixels
    from .sun_rays import measure_sun_rays

    image, mask = pixels(path, keep_components=True)
    center, radius = front_orb_seed(image, mask, frame)
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
