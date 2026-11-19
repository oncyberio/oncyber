"""Trace painted features in a front-facing cartoon reference."""

import numpy as np
from contourpy import contour_generator
from scipy import ndimage
from scipy.optimize import least_squares
from scipy.signal import find_peaks


def shirt_mark(rgb, labels, shirt, rect, ox, oy, unit):
    """Trace a single uniform, enclosed motif in normalized garment coordinates."""
    (left, top), (right, bottom) = rect
    # Sample at source resolution to preserve small marks on a full-body pose.
    cols = np.linspace(left, right, 97)
    rows = np.linspace(top, bottom, 97)
    x = np.clip(np.rint(ox + cols * unit).astype(int), 0, rgb.shape[1] - 1)
    y = np.clip(np.rint(oy + rows * unit).astype(int), 0, rgb.shape[0] - 1)
    swatches = rgb[np.ix_(y, x)]
    fabric = (
        labels[
            np.ix_(
                rows.round().astype(int).clip(0, labels.shape[0] - 1),
                cols.round().astype(int).clip(0, labels.shape[1] - 1),
            )
        ]
        == shirt
    )
    if fabric.mean() < 0.45:
        return
    fabric = ndimage.binary_erosion(fabric, iterations=2)
    if not fabric.any():
        return
    background = np.median(swatches[fabric], axis=0)
    contrast = np.linalg.norm(swatches - background, axis=2) > 50
    regions, _ = ndimage.label(contrast & fabric)
    for i in np.argsort(np.bincount(regions.ravel())[1:])[::-1] + 1:
        region = regions == i
        fraction = region.sum() / max(1, fabric.sum())
        if fraction < 0.013 or fraction > 0.43:
            continue
        if (ndimage.binary_dilation(region, iterations=2) & ~fabric).any():
            continue
        core = ndimage.binary_erosion(region)
        if core.sum() < 12:
            continue
        paint = np.median(swatches[core], axis=0)
        if np.percentile(np.linalg.norm(swatches[core] - paint, axis=1), 80) > 22:
            continue
        result = outline_mark(region, paint)
        if result:
            return result


def outline_mark(region, paint):
    borders = contour_generator(z=region.astype(float)).lines(0.5)
    if len(borders) != 1:
        return
    path = borders[0]

    # Simplify the closed contour in its own plane and keep corner extrema.
    def simplify(points):
        a, b = points[0], points[-1]
        delta = b - a
        t = ((points - a) @ delta / max(1e-9, delta @ delta)).clip(0, 1)
        err = np.linalg.norm(points - a - t[:, None] * delta, axis=1)
        at = int(err.argmax())
        if err[at] < 1.6:
            return points[[0, -1]]
        return np.vstack((simplify(points[: at + 1])[:-1], simplify(points[at:])))

    split = int(np.linalg.norm(path - path[0], axis=1).argmax())
    polygon = np.vstack(
        (simplify(path[: split + 1])[:-1], simplify(path[split:])[:-1])
    )
    if 3 <= len(polygon) <= 32:
        return {
            "color": "#" + paint.round().astype("uint8").tobytes().hex(),
            "outline": (polygon / 96).round(4).tolist(),
        }


def radial_crown(hair, cx, eye, face_width):
    """Trace a star-shaped haircut in the plane of the T-pose."""
    ys, xs = np.nonzero(hair)
    if not len(ys) or face_width < 12:
        return
    top = ys.min()
    cy = eye - 0.32 * (eye - top)
    if cy <= top + 2:
        return
    count = 180
    angle = np.arange(count) * (2 * np.pi / count) - np.pi
    bins = np.rint((np.arctan2(ys - cy, xs - cx) + np.pi) * count / (2 * np.pi)).astype(int) % count
    radius = np.zeros(count)
    np.maximum.at(radius, bins, np.hypot(xs - cx, ys - cy))
    # The cheek can hide the rear crown. Close that interior inside the face.
    interior = np.minimum(face_width * 0.43 / (abs(np.cos(angle)) + 0.001),
                          (cy - top) * 0.64 / (abs(np.sin(angle)) + 0.001))
    radius = ndimage.maximum_filter1d(radius, 3, mode="wrap")
    radius = ndimage.gaussian_filter1d(np.maximum(radius, interior), 0.67, mode="wrap")
    peaks, _ = find_peaks(np.tile(radius, 3), prominence=face_width * 0.10, distance=6)
    peaks = peaks[(peaks >= count) & (peaks < 2 * count)] - count
    if len(peaks) < 5 or (np.sin(angle[peaks]) < 0).sum() < 3 or np.ptp(angle[peaks]) < np.pi:
        return
    keep = set(map(int, peaks))
    for start, end in zip(peaks, np.r_[peaks[1:], peaks[0] + count]):
        arc = np.arange(start, end + 1)
        keep.add(int(arc[np.argmin(radius[arc % count])]) % count)
    xy = np.column_stack([cx + np.cos(angle) * radius, cy + np.sin(angle) * radius])

    def refine(start, end):
        samples = np.arange(start + 1, end)
        if not len(samples):
            return
        origin = xy[start % count]
        chord = xy[end % count] - origin
        offset = xy[samples % count] - origin
        t = np.clip(offset @ chord / max(1e-6, chord @ chord), 0, 1)
        distance = np.linalg.norm(offset - t[:, None] * chord, axis=1)
        i = np.argmax(distance)
        if distance[i] > face_width * 0.029:
            middle = int(samples[i])
            keep.add(middle % count)
            refine(start, middle)
            refine(middle, end)

    corners = sorted(keep)
    for start, end in zip(corners, corners[1:] + [corners[0] + count]):
        refine(start, end)
    return (cx, cy), xy[sorted(keep)]


def eyebrow(rgb, eye_box, head_height):
    """Trace one dark brow above the measured eye, excluding the hair boundary."""
    left, top, right, _bottom = eye_box
    width = right - left
    x0 = max(0, round(left - width * 0.17))
    y0 = max(0, round(top - head_height * 0.15))
    area = rgb[y0 : max(y0 + 1, top - 1), x0 : round(right + width * 0.17)]
    if not area.size:
        return
    ink = (area.max(axis=2) < 89) & (np.ptp(area, axis=2) < 34)
    labels, n = ndimage.label(ink)
    candidates = []
    for i in range(1, n + 1):
        y, x = np.where(labels == i)
        span = np.ptp(x) + 1
        if not width * 0.39 <= span <= width * 1.29 or np.ptp(y) > span * 0.65:
            continue
        if x.min() == 0 or x.max() == area.shape[1] - 1 or y.min() == 0:
            continue
        score = span / (1 + abs(x.mean() + x0 - (left + right) * 0.5) / width)
        candidates.append((score, i))
    if not candidates:
        return
    y, x = np.where(labels == max(candidates)[1])
    knots = []
    for group in np.array_split(np.unique(x), min(9, len(np.unique(x)))):
        mid = x[(x >= group[0]) & (x <= group[-1])].mean()
        knots.append(
            [
                float(mid + x0),
                float(np.median(y[(x >= group[0]) & (x <= group[-1])]) + y0),
            ]
        )
    return knots, len(x) / (np.ptp(x) + 1)


def eye_strokes(rgb, eye_box, skin, head_height):
    """Trace separate brows and upper-lid arcs where ink has skin on both sides."""
    left, top, right, _ = eye_box
    width = right - left
    x0 = max(0, round(left - 0.1 * width))
    x1 = min(rgb.shape[1], round(right + 0.1 * width))
    y0 = max(0, round(top - head_height * 0.205))
    patch = rgb[y0 : round(top + width * 0.18), x0:x1]
    if min(patch.shape[:2]) < 6:
        return []
    distance = np.linalg.norm(patch - skin, axis=2)
    weights = [0.21, 0.72, 0.07]
    core = (distance > 62) & (patch @ weights < (skin @ weights) * 0.66)
    step = max(2, round(width * 0.062))
    above = np.roll(distance, step, axis=0)
    below = np.roll(distance, -step, axis=0)
    ink = core & (above < 60) & (below < 60)
    ink[:step] = ink[-step:] = False
    labels, _ = ndimage.label(ink, np.ones((3, 3)))
    strokes = []
    for index, (ys, xs) in enumerate(ndimage.find_objects(labels), 1):
        span = xs.stop - xs.start
        offset = abs(x0 + (xs.start + xs.stop) * 0.5 - (left + right) * 0.5)
        if span < 7 or not width * 0.36 < span < width * 1.27 or offset > width * 0.29:
            continue
        y, x = np.where(labels == index)
        if np.ptp(y) > span * 0.72:
            continue
        points = []
        for columns in np.array_split(np.unique(x), 7):
            strip = (x >= columns[0]) & (x <= columns[-1])
            points.append(
                [float(np.median(x[strip])) + x0, float(np.median(y[strip])) + y0]
            )
        if points[3][1] < top - max(1, width * 0.025):
            strokes.append((points, len(x) / span, np.median(patch[y, x], axis=0)))
    return sorted(strokes, key=lambda stroke: stroke[0][3][1])


def facial_creases(rgb, skin, cx, head_width, crown, chin, eyes, lower_mouth):
    """Trace interior forehead and chin marks that have skin on both sides."""
    lines = []
    height = chin - crown
    x0 = max(0, round(cx - head_width * 0.43))
    x1 = min(rgb.shape[1], round(cx + head_width * 0.43))
    for top, bottom in [
        (crown + height * 0.085, eyes - height * 0.20),
        (lower_mouth + height * 0.02, chin + height * 0.025),
    ]:
        y0, y1 = max(0, round(top)), min(rgb.shape[0], round(bottom))
        patch = rgb[y0:y1, x0:x1]
        if min(patch.shape[:2]) < 5:
            continue
        luma = patch @ [0.213, 0.715, 0.072]
        gap = max(3, round(head_width * 0.035))
        background = ndimage.grey_closing(luma, size=(gap, gap))
        strokes = background - luma > np.maximum(18, background * 0.22)
        labels, n = ndimage.label(strokes, structure=np.ones((3, 3)))
        for i, box in enumerate(ndimage.find_objects(labels, n), 1):
            ys, xs = box
            span = xs.stop - xs.start
            if (
                not head_width * 0.105 < span < head_width * 0.65
                or ys.stop - ys.start > span * 0.45
            ):
                continue
            if (
                xs.start == 0
                or xs.stop == patch.shape[1]
                or ys.start == 0
                or ys.stop == patch.shape[0]
            ):
                continue
            y, x = np.nonzero(labels[box] == i)
            x, y = x + xs.start + x0, y + ys.start + y0
            width = len(x) / span
            if width > max(4, span * 0.07):
                continue
            points = []
            for group in np.array_split(np.unique(x), min(11, len(np.unique(x)))):
                points.append(
                    [
                        int(np.median(group)),
                        int(np.median(y[(x >= group[0]) & (x <= group[-1])])),
                    ]
                )
            cols, rows = np.asarray(points).T
            room = max(3, round(width * 2.2))
            support = rgb[
                np.clip(rows[None, :] + np.array([[-room], [room]]), 0, len(rgb) - 1),
                cols,
            ]
            if (
                np.mean(
                    np.linalg.norm(support - skin, axis=2)
                    < max(46, np.linalg.norm(skin) * 0.32)
                )
                < 0.83
            ):
                continue
            lines.append((points, width, np.median(rgb[y, x], axis=0)))
    return sorted(
        lines, key=lambda line: np.ptp(np.asarray(line[0])[:, 0]), reverse=True
    )[:5]


def mouth_profile(rgb, left, right):
    """Follow the ink between two mouth corners, then measure the colored lip on either side."""
    width = right[0] - left[0]
    if width < 8:
        return None
    h, w = rgb.shape[:2]
    x0 = max(0, int(left[0] - width * 0.24))
    y0 = max(0, int(min(left[1], right[1]) - width * 0.43))
    area = rgb[
        y0 : min(h, int(max(left[1], right[1]) + width * 0.43) + 1),
        x0 : min(w, int(right[0] + width * 0.24) + 1),
    ]
    if min(area.shape[:2]) < 4:
        return None
    luminance = area @ [0.213, 0.715, 0.072]
    ground = np.median(luminance)
    labels, count = ndimage.label(luminance < ground * 0.53, structure=np.ones((3, 3)))
    candidates = []
    for n, box in enumerate(ndimage.find_objects(labels, count), 1):
        if box is None:
            continue
        ys, xs = box
        span = xs.stop - xs.start
        if not 0.56 * width <= span <= 1.4 * width or ys.stop - ys.start > 0.39 * span:
            continue
        y, x = np.nonzero(labels[box] == n)
        y, x = y + ys.start, x + xs.start
        ends = np.array(
            [
                [x.min() + x0, np.median(y[x == x.min()]) + y0],
                [x.max() + x0, np.median(y[x == x.max()]) + y0],
            ]
        )
        distance = np.linalg.norm(ends - [left, right], axis=1).max()
        if distance < width * 0.32 and len(x) / span < 0.14 * width:
            candidates.append((distance, n))
    if not candidates:
        return None

    ink = labels == min(candidates)[1]
    y, x = np.nonzero(ink)
    knots, lip_pixels = [], []
    for group in np.array_split(np.unique(x), min(15, len(np.unique(x)))):
        column = round(group.mean())
        ys = y[(x >= group[0]) & (x <= group[-1])]
        seam = np.median(ys)
        # Skin immediately above and below the mouth is a local lighting sample.
        # Distinct lip paint must stay connected to the ink. A cheek shadow or
        # a second line beyond the lip should not inflate the relief.
        edges = []
        for sign in [-1, 1]:
            limit = min(len(area) - 1, max(0, round(seam + sign * width * 0.29)))
            base = np.median(
                area[max(0, limit - 1) : limit + 2, max(0, column - 1) : column + 2],
                axis=(0, 1),
            )
            edge = seam
            first = int(min(ys) if sign < 0 else max(ys))
            for step in range(first + sign, limit, sign):
                sample = area[step, column]
                if np.linalg.norm(base - sample) < max(
                    19, np.linalg.norm(base) * 0.105
                ):
                    break
                if luminance[step, column] >= ground * 0.57:
                    lip_pixels.append(sample)
                    edge = step
            edges.append(edge + y0)
        knots.append([column + x0, seam + y0, *edges])
    knots = np.array(knots)
    has_lip = False
    for i in (2, 3):
        delta = ndimage.median_filter(knots[:, i] - knots[:, 1], size=3, mode="nearest")
        if np.count_nonzero(abs(delta) > 1) < max(3, len(delta) * 0.25):
            delta[:] = 0
        else:
            has_lip = True
        knots[:, i] = knots[:, 1] + delta
    paint = np.median(lip_pixels, axis=0) if has_lip and lip_pixels else None
    return knots, np.median(area[ink], axis=0), len(x) / np.ptp(x), paint


def ear_lobes(skin, cx, eye_y, chin, head_width, lowest_center=None):
    """Fit a lateral lobe only where a convex arc protrudes from the cheek."""
    height = chin - eye_y
    y0, y1 = (
        max(0, round(eye_y - height * 0.09)),
        min(skin.shape[0], round(chin - height * 0.17)),
    )
    if y1 - y0 < 12:
        return []
    width = skin.shape[1]
    lobes = []
    for side in (-1, 1):
        columns = np.flatnonzero(
            ((np.arange(width) - cx) * side > head_width * 0.21)
            & ((np.arange(width) - cx) * side < head_width * 0.83)
        )
        if not len(columns):
            continue
        # Hair highlights and antialiased outlines can share the skin hue.
        # Remove thin strokes before taking the outermost skin on each row.
        region = ndimage.binary_opening(
            skin[y0:y1, columns], iterations=max(1, round(head_width * 0.008))
        )
        coord = (columns - cx) * side
        edge = np.max(np.where(region, coord, -1), axis=1)
        edge = ndimage.median_filter(edge, size=3)
        best, result = 0, None
        for size in np.unique(
            np.linspace(max(9, height * 0.18), height * 0.58, 18).astype(int)
        ):
            unit = np.linspace(-1, 1, size)
            arc = np.sqrt(np.maximum(0, 1 - unit**2))
            for start in range(0, len(edge) - size + 1, 2):
                cy = y0 + start + (size - 1) / 2
                if lowest_center is not None and cy > lowest_center:
                    continue
                trace = edge[start : start + size]
                if trace.min() < 0:
                    continue
                chord = np.linspace(trace[0], trace[-1], size)
                bump = trace - chord
                bulge = float(np.dot(arc, bump) / np.dot(arc, arc))
                if not head_width * 0.054 < bulge < head_width * 0.22:
                    continue
                error = np.mean(abs(bump - arc * bulge)) / bulge
                if error > 0.19 or abs(chord[0] - chord[-1]) > bulge * 0.85:
                    continue
                rank = bulge * (1 - error)
                if rank > best:
                    best = rank
                    # Put the inner half into the cheek; keep the measured tip.
                    rx = bulge * 0.67
                    ex = cx + side * (float(np.max(trace)) - rx)
                    result = (side, ex, cy, rx, size * 0.5)
        if result:
            lobes.append(result)
    return lobes


def sleeve_cuff(rgb, mask, paints, shoulder, wrist):
    """Find the end of the continuous sleeve, excluding skin and wrist accessories."""
    x, y = shoulder
    reach = wrist[0] - x
    if reach < 4 or np.linalg.norm(paints["skin"] - paints["shirt"]) < 12:
        return None
    start = max(0, round(x - reach * 0.12))
    span = max(8, round(reach * 0.24))
    band = np.s_[max(0, y - span) : y + span + 1, start : wrist[0] + 1]
    color, visible = rgb[band], mask[band]
    shirt = np.linalg.norm(color - paints["shirt"], axis=2)
    skin = np.linalg.norm(color - paints["skin"], axis=2)
    textile = visible & (shirt < 62) & (shirt + 5 < skin)
    fraction = textile.sum(axis=0) / np.maximum(1, visible.sum(axis=0))
    # At a tilted cuff the sleeve covers about half of the cross-section.
    cloth = (
        ndimage.median_filter(fraction, size=max(3, round(reach * 0.012)) | 1) >= 0.4
    )
    columns = np.flatnonzero(cloth)
    runs = np.split(
        columns, np.flatnonzero(np.diff(columns) > max(3, reach * 0.025)) + 1
    )
    sleeve = next(
        (
            r
            for r in runs
            if len(r) >= max(3, reach * 0.045) and r[0] + start < x + reach * 0.2
        ),
        None,
    )
    return int(start + sleeve[-1]) if sleeve is not None else None


def crew_neckline(rgb, mask, paints, cx, search_top, shoulder, hem, half_width):
    """Fit an elliptical neck opening where skin meets the torso fabric."""
    x0 = max(0, int(cx - half_width * 0.7))
    x1 = min(mask.shape[1], int(cx + half_width * 0.7) + 1)
    y0 = max(0, int(search_top))
    y1 = min(mask.shape[0], round(shoulder + (hem - shoulder) * 0.17))
    area = rgb[y0:y1, x0:x1]
    if area.size == 0:
        return None
    skin = np.linalg.norm(area - paints["skin"], axis=2)
    cloth = np.minimum(
        np.linalg.norm(area - paints["shirt"], axis=2),
        np.linalg.norm(area - paints["binding"], axis=2),
    )
    visible = mask[y0:y1, x0:x1]
    fabric = visible & (cloth < 69) & (cloth + 14 < skin)
    neck = visible & (skin < 72) & (skin + 14 < cloth)
    neck = ndimage.binary_opening(neck, structure=np.ones((3, 3)))
    xx, yy = [], []
    for col in range(area.shape[1]):
        # The neck can share a colour with a print farther down the shirt.
        # Take the first skin-to-fabric transition in this column.
        bottoms = np.flatnonzero(np.diff(neck[:, col].astype(int), append=0) == -1) + 1
        for bottom in bottoms:
            end = bottom + max(4, round(half_width * 0.075))
            next_fabric = np.flatnonzero(fabric[bottom:end, col])
            if len(next_fabric) and visible[bottom : bottom + next_fabric[0] + 1, col].all():
                xx.append(col + x0)
                yy.append(bottom + y0)
                break
    if len(xx) < 10:
        return None
    xx, yy = np.array(xx), np.array(yy)
    # Dark hair can use the same pigment as the binding. At its meeting
    # with the jaw, the skin/fabric contour jumps vertically off the collar.
    breaks = (np.diff(xx) > max(3, half_width * 0.02)) | (
        np.abs(np.diff(yy)) > max(6, half_width * 0.11)
    )
    spans = np.split(np.arange(len(xx)), np.flatnonzero(breaks) + 1)
    center_span = next((ids for ids in spans if xx[ids[0]] <= cx <= xx[ids[-1]]), None)
    if center_span is None or len(center_span) < 10:
        return None
    xx, yy = xx[center_span], yy[center_span]
    mid = (xx[-1] + xx[0]) / 2
    radius = (xx[-1] - xx[0]) / 2 + 0.5
    if abs(mid - cx) > 0.22 * half_width or radius < 3 or len(xx) < 1.5 * radius:
        return None
    depth = np.percentile(yy, 90) - yy.min()
    if not 0.15 * radius < depth < 1.75 * radius:
        return None

    def residual(v):
        base, drop, r = v
        return base + drop * np.sqrt(np.maximum(0, 1 - ((xx - mid) / r) ** 2)) - yy

    ground, ceiling = float(y0), float(yy.max())
    # A broad jaw can touch the shirt outside the actual opening. The top
    # of the shoulders provides an independent estimate of rim height.
    tops = []
    for offset in (-0.94, -0.84, -0.74, 0.74, 0.84, 0.94):
        x = int(np.clip(cx + half_width * offset, 0, mask.shape[1] - 1))
        shirt = np.linalg.norm(rgb[y0:y1, x] - paints["shirt"], axis=1) < 49
        solid = np.flatnonzero(ndimage.binary_opening(shirt, structure=np.ones(4)))
        if solid.size and solid[0] > 0:
            tops.append(y0 + solid[0])
    if len(tops) >= 3 and np.ptp(tops) < radius * 0.45:
        seam = np.median(tops)
        ground = max(ground, seam - radius * 0.10)
        ceiling = min(ceiling, seam + radius * 0.06)
    if ground >= ceiling:
        return None
    initial = np.clip(yy.min(), ground, ceiling)
    solved = least_squares(
        residual,
        [initial, depth, radius],
        loss="soft_l1",
        bounds=(
            [ground, depth * 0.40, radius * 0.75],
            [ceiling, depth * 1.8, radius * 1.16],
        ),
    )
    if np.median(abs(solved.fun)) > max(1.75, radius * 0.08):
        return None
    base, drop, radius = solved.x
    # A contrasting outer stitch or ink line gives the width of the ribbing.
    # Require agreement across the middle of the collar to exclude shirt artwork.
    widths, inks = [], []
    limit = max(4, round(radius * 0.67))
    for x, y in zip(xx, yy):
        if abs(x - mid) > radius * 0.45:
            continue
        strip = rgb[y : y + limit, x]
        if len(strip) < 4:
            continue
        value = strip @ [0.213, 0.715, 0.072]
        marked = np.flatnonzero(value < np.median(value) * 0.53)
        marked = marked[(marked > max(2, radius * 0.10)) & (marked < radius * 0.55)]
        if len(marked):
            widths.append(np.median(marked))
            inks.append(strip[marked].mean(axis=0))
    resolved = len(widths) >= 0.48 * np.count_nonzero(abs(xx - mid) <= radius * 0.45)
    return (
        mid,
        base,
        radius,
        drop,
        np.median(widths) if resolved else radius * 0.16,
        np.median(inks, axis=0) if resolved else None,
    )


def scalp_pigment(colors, figure, seed, shoulder_y, head_width):
    """Keep exterior locks separated by ink and exclude isolated painted features."""
    pigment = colors.copy()
    pigment[int(shoulder_y) :] = False
    labels, _ = ndimage.label(ndimage.binary_closing(pigment, iterations=2))
    sx, sy = seed
    main = labels[sy, sx]
    if not main:
        return pigment
    primary = labels == main
    # Determine distance to the outer silhouette, so a matching eyebrow
    # or dark nostril does not become a strand across the forehead.
    edge = figure & ~ndimage.binary_erosion(
        figure, iterations=max(2, round(head_width * 0.043))
    )
    near = ndimage.binary_dilation(
        primary, iterations=max(3, round(head_width * 0.041))
    )
    areas = np.bincount(labels.ravel())
    linked = np.unique(labels[near])
    outer_labels = np.intersect1d(linked, np.unique(labels[edge]))
    keep = [main]
    for index in outer_labels:
        if index and areas[index] >= max(5, areas[main] * 0.012):
            keep.append(index)
    return np.isin(labels, keep)


def ink_centerline(component, thickness, count):
    """Follow a connected ink stroke between its two most distant ends."""
    from scipy.sparse import coo_matrix
    from scipy.sparse.csgraph import dijkstra

    y, x = np.nonzero(component)
    ids = np.full(component.shape, -1, dtype=int)
    ids[y, x] = np.arange(len(y))
    vertices, neighbors, weights = [], [], []
    for dy, dx in ((0, 1), (1, -1), (1, 0), (1, 1)):
        ny, nx = y + dy, x + dx
        valid = (ny >= 0) & (nx >= 0) & (ny < ids.shape[0]) & (nx < ids.shape[1])
        a = np.flatnonzero(valid)
        b = ids[ny[a], nx[a]]
        valid = b >= 0
        a, b = a[valid], b[valid]
        # Prefer the middle of broad pen strokes while keeping distance along
        # the stroke the main cost.
        weight = np.hypot(dx, dy) * (
            1 + 0.24 / np.maximum(0.5, thickness[y[a], x[a]] + thickness[y[b], x[b]])
        )
        vertices.extend(a)
        neighbors.extend(b)
        weights.extend(weight)
    graph = coo_matrix((weights, (vertices, neighbors)), shape=(len(y), len(y))).tocsr()
    start = int(np.argmax(dijkstra(graph, directed=False, indices=0)))
    distance, pred = dijkstra(
        graph, directed=False, indices=start, return_predecessors=True
    )
    end = int(np.argmax(distance))
    route = [end]
    while end != start:
        end = int(pred[end])
        route.append(end)
    path = np.column_stack((x[route], y[route])).astype(float)
    if path[0, 1] > path[-1, 1]:
        path = path[::-1]
    path = ndimage.gaussian_filter1d(path, 1.3, axis=0, mode="nearest")
    length = np.r_[0, np.cumsum(np.linalg.norm(np.diff(path, axis=0), axis=1))]
    samples = np.linspace(0, length[-1], count)
    return np.column_stack([np.interp(samples, length, path[:, k]) for k in range(2)])


def nose_stroke(rgb, skin, eye_y, tip, mouth_y, face_width):
    """Trace the drawn bridge and tip; the uninked return into the cheek stays soft."""
    tx, ty = tip
    if ty - eye_y < face_width * 0.062:
        return None
    left, top = max(0, round(tx - face_width * 0.24)), max(0, round(eye_y))
    right, bottom = (
        min(rgb.shape[1], round(tx + face_width * 0.24)),
        min(rgb.shape[0], round(min(ty + face_width * 0.09, mouth_y - 2))),
    )
    patch = rgb[top:bottom, left:right]
    if min(patch.shape[:2]) < 7:
        return None
    white = (patch.min(axis=2) > 178) & (np.ptp(patch, axis=2) < 48)
    luma = patch @ [0.21, 0.72, 0.07]
    window = max(4, round(face_width * 0.064))
    contrast = ndimage.grey_closing(luma, size=(window, window)) - luma
    ink = (luma < skin @ [0.21, 0.72, 0.07] * 0.64) & (contrast > 27)
    ink &= ~ndimage.binary_dilation(white, iterations=max(2, round(face_width * 0.023)))
    labels, _ = ndimage.label(ink, structure=np.ones((3, 3)))
    best = None
    for i, (ys, xs) in enumerate(ndimage.find_objects(labels), 1):
        width, height = xs.stop - xs.start, ys.stop - ys.start
        if not (
            0.06 * face_width < width < face_width * 0.41
            and 0.05 * face_width < height < face_width * 0.55
        ):
            continue
        if xs.start == 0 or xs.stop == patch.shape[1]:
            continue
        area = labels[ys, xs] == i
        y, x = np.nonzero(area)
        y = y + ys.start + top
        x = x + xs.start + left
        at_bottom = y >= y.max() - max(1, face_width * 0.009)
        miss = np.hypot(np.median(x[at_bottom]) - tx, y.max() - ty) / face_width
        if miss > 0.115:
            continue
        rank = (width + height) / (1 + miss * 14)
        if best is None or rank > best[0]:
            best = (rank, i, ys, xs)
    if best is None:
        return None
    _, i, ys, xs = best
    part = labels[ys, xs] == i
    thickness = ndimage.distance_transform_edt(np.pad(part, 1))[1:-1, 1:-1]
    stroke = ink_centerline(part, thickness, 14)
    stroke += [left + xs.start, top + ys.start]
    # An open U or L has substantial enclosed area against the chord joining
    # its ends. A straight shadow does not describe a sculpted nose.
    xx, yy = stroke.T
    area = abs(np.dot(xx, np.roll(yy, 1)) - np.dot(yy, np.roll(xx, 1))) * 0.5
    if area < np.ptp(xx) * np.ptp(yy) * 0.14 or np.argmin(yy) > 3:
        return None
    color = np.median(patch[ys, xs][part], axis=0)
    width = part.sum() / max(1, np.linalg.norm(np.diff(stroke, axis=0), axis=1).sum())
    return stroke, width, color


def brow_covered_by_hair(hair, left, right, top):
    """Measure the brow band of an eye whose source has no visible brow stroke."""
    width = right - left
    y0 = max(0, round(top - width * 0.45))
    y1 = min(hair.shape[0], round(top - width * 0.06))
    x0 = max(0, round(left + 0.1 * width))
    x1 = min(hair.shape[1], round(right - 0.1 * width))
    band = hair[y0:y1, x0:x1]
    return bool(band.size and band.mean() >= 0.75)


def joined_brow(rgb, skin, hair, centers, eye_y, face_width):
    """A distinct hair-colored band spanning both eyes, including a pale brow."""
    if np.linalg.norm(hair - skin) < 55:
        return
    cx = np.mean(centers)
    left = max(0, int(cx - face_width * 0.7))
    right = min(rgb.shape[1], int(cx + face_width * 0.7) + 1)
    top = max(0, int(eye_y - face_width * 0.55))
    bottom = min(rgb.shape[0], round(eye_y))
    patch = rgb[top:bottom, left:right]
    if not patch.size:
        return
    label, _ = ndimage.label(np.linalg.norm(patch - hair, axis=2) < 30)
    for i, (ys, xs) in enumerate(ndimage.find_objects(label), 1):
        span, height = xs.stop - xs.start, ys.stop - ys.start
        if (ys.start == 0 or ys.stop == patch.shape[0]
                or xs.start == 0 or xs.stop == patch.shape[1]
                or left + xs.start >= min(centers) or left + xs.stop <= max(centers)
                or not 0.035 * face_width < height < 0.28 * span):
            continue
        region = label[ys, xs] == i
        if region.sum() < 0.35 * span * height:
            continue
        columns = np.unique(np.linspace(0, span - 1, 10).round().astype(int))
        upper, lower = [], []
        for col in columns:
            rows = np.flatnonzero(region[:, col])
            if len(rows):
                x = left + xs.start + col
                upper.append((x, top + ys.start + rows[0]))
                lower.append((x, top + ys.start + rows[-1]))
        return upper + lower[::-1], np.median(patch[ys, xs][region], axis=0)


def painted_open_mouth(rgb, skin, cx, eye, chin, face_width):
    """Recover a visibly open painted mouth with teeth from contiguous pigment bands."""
    left = max(0, round(cx - face_width * 0.53))
    right = min(rgb.shape[1], round(cx + face_width * 0.53) + 1)
    top = max(0, round(eye + (chin - eye) * 0.35))
    bottom = min(rgb.shape[0], round(chin))
    patch = rgb[top:bottom, left:right]
    if min(patch.shape[:2], default=0) < 5:
        return
    luma = patch @ [0.21, 0.72, 0.07]
    skin_luma = skin @ [0.21, 0.72, 0.07]
    warm = patch[:, :, 0] - patch[:, :, 1] > max(24, skin[0] - skin[1] + 12)
    labels, _ = ndimage.label(
        warm & (luma < min(150, skin_luma * 0.80)), np.ones((3, 3))
    )
    enamel = (luma > max(150, min(185, skin_luma * 0.66))) & (
        np.ptp(patch, axis=2) < 29
    )
    teeth = ((luma > skin_luma + 8) | enamel) & (
        np.linalg.norm(patch - skin, axis=2) > 25
    )
    for i, (ys, xs) in enumerate(ndimage.find_objects(labels), 1):
        width, height = xs.stop - xs.start, ys.stop - ys.start
        if (
            not 0.26 * face_width < width < 1.02 * face_width
            or not 0.09 * width < height < 0.65 * width
            or abs(left + (xs.start + xs.stop) / 2 - cx) > face_width * 0.15
            or ys.start == 0
            or ys.stop == patch.shape[0]
        ):
            continue
        cavity = labels == i
        dark_level = np.percentile(luma[cavity], 35)
        tongue = cavity & (luma > dark_level + 30)
        rows, tooth_samples, tooth_columns = [], [], []
        for x in range(xs.start, xs.stop):
            y = np.flatnonzero(cavity[:, x])
            if not len(y):
                continue
            upper, lower = int(y[0]), int(y[-1]) + 1
            outer_top, outer_bottom = upper, lower
            while (
                outer_top > 0
                and upper - outer_top < width * 0.22
                and teeth[outer_top - 1, x]
            ):
                outer_top -= 1
            while (
                outer_bottom < len(patch)
                and outer_bottom - lower < width * 0.22
                and teeth[outer_bottom, x]
            ):
                outer_bottom += 1
            tooth_samples.extend(patch[outer_top:upper, x])
            tooth_samples.extend(patch[lower:outer_bottom, x])
            if outer_top < upper or outer_bottom > lower:
                tooth_columns.append(x)
            tongue_edge = lower
            while tongue_edge > upper and tongue[tongue_edge - 1, x]:
                tongue_edge -= 1
            rows.append(
                [
                    x + left,
                    top + outer_top,
                    top + upper,
                    top + tongue_edge,
                    top + lower,
                    top + outer_bottom,
                ]
            )
        # A thin enamel row can average under a pixel of coverage per
        # column on a whole-body T-pose. Keep the threshold proportional.
        thin_row = (
            height <= 20
            and len(tooth_columns) >= width * 0.24
            and np.ptp(tooth_columns) + 1 >= width / 3
        )
        if len(tooth_samples) < width * max(1.2, height * 0.08) and not thin_row:
            continue
        rows = np.array(rows)
        outline = simplify_columns(rows[:, 0], rows[:, 1:], 48, max(0.7, width * 0.009))
        if len(outline) == 2:
            outline = rows[[0, len(rows) // 2, -1]]
        return (
            np.asarray(outline),
            np.median(patch[cavity & ~tongue], axis=0),
            np.median(tooth_samples, axis=0),
            np.median(patch[tongue], axis=0) if tongue.any() else None,
        )


def filled_brow(rgb, skin, eye_box, head_height):
    """Measure a solid colored brow separately from the thin eyelid beneath it."""
    left, top, right, _ = eye_box
    width = right - left
    x0 = max(0, round(left - width * 0.25))
    x1 = min(rgb.shape[1], round(right + width * 0.25))
    y0 = max(0, round(top - head_height * 0.245))
    y1 = max(y0 + 1, top - 1)
    patch = rgb[y0:y1, x0:x1]
    if min(patch.shape[:2]) < 5:
        return None
    dark = (np.linalg.norm(patch - skin, axis=2) > 55) & (
        patch @ [0.21, 0.72, 0.07] < skin @ [0.21, 0.72, 0.07] * 0.81
    )
    labels, _ = ndimage.label(dark, structure=np.ones((3, 3)))
    candidates = []
    for i, (ys, xs) in enumerate(ndimage.find_objects(labels), 1):
        span = xs.stop - xs.start
        if (
            ys.start == 0
            or ys.stop == patch.shape[0]
            or xs.start == 0
            or xs.stop == patch.shape[1]
            or not 0.38 * width < span < 1.25 * width
            or ys.stop - ys.start > span * 0.67
        ):
            continue
        region = ndimage.binary_fill_holes(labels[ys, xs] == i)
        if region.sum() / span < max(3, width * 0.078):
            continue
        candidates.append((region.sum(), i, ys, xs, region))
    if not candidates:
        return None
    _, _, ys, xs, region = max(candidates, key=lambda c: c[0])
    xx = np.flatnonzero(np.any(region, axis=0))
    if len(xx) < 7:
        return None
    upper, lower = [], []
    for group in np.array_split(xx, 7):
        x = round(np.median(group))
        yy = np.flatnonzero(region[:, x])
        upper.append([x0 + xs.start + x, y0 + ys.start + yy[0]])
        lower.append([x0 + xs.start + x, y0 + ys.start + yy[-1]])
    # Sample the interior of the band rather than its dark outline.
    depth = ndimage.distance_transform_edt(np.pad(region, 1))[1:-1, 1:-1]
    tint = np.median(patch[ys, xs][depth > depth.max() * 0.52], axis=0)
    return upper + lower[::-1], tint


def open_hand(mask, wrist, end):
    """Five finger rays in the T-pose plane, measured only when the gaps are visible."""
    wx, wy = map(int, wrist)
    length = end - wx
    if length < 24 or wx < 0 or end >= mask.shape[1]:
        return None
    # Split at the dark background gaps between outstretched fingers. The
    # first section with four persistent runs supplies their identities.
    def runs(x):
        ys = np.flatnonzero(mask[:, x])
        return [r for r in np.split(ys, np.flatnonzero(np.diff(ys) > 1) + 1)
                if len(r) >= max(2, length * 0.018) and abs(r.mean() - wy) < length * 0.78]

    def follow(x, ys):
        base = [x, ys.mean()]
        for ahead in range(x + 1, end + 1):
            matching = [r for r in runs(ahead) if r[0] <= ys[-1] + 1 and r[-1] >= ys[0] - 1]
            if len(matching) != 1:
                break
            ys = matching[0]
            x = ahead
        return np.asarray([base, [x, ys.mean()]])

    fingers = None
    for x in range(wx + round(length * 0.54), wx + round(length * 0.8)):
        bands = runs(x)
        if len(bands) == 4:
            measured = [follow(x, band) for band in bands]
            if min(tip[0] - start[0] for start, tip in measured) > length * 0.065:
                fingers = measured
                break
    if fingers is None:
        return None
    for x in range(wx + round(length * 0.19), wx + round(length * 0.52)):
        bands = runs(x)
        if len(bands) != 2:
            continue
        short = int(len(bands[1]) < len(bands[0]))
        if len(bands[short]) > len(bands[1-short]) * 0.76:
            continue
        thumb = follow(x, bands[short])
        if thumb[1, 0] - x <= length * 0.045 or thumb[1, 0] > wx + length * 0.74:
            continue
        if short:
            fingers.reverse()
        # Place the knuckles inside the still-connected palm, continuing
        # each visible finger towards the wrist. Distal lengths stay measured.
        result = []
        for i, (start, tip) in enumerate([thumb, *fingers]):
            root_x = wx + min((start[0] - wx) * 0.84, length * (0.19 if i == 0 else 0.43))
            root = start + (tip - start) * ((root_x - start[0]) / (tip[0] - start[0]))
            result.append([*(root - wrist), *(tip - wrist)])
        return np.array(result)
    return None


def forehead_lock(hair, skin, cx, eye, width):
    """Trace a narrow branch of the scalp with exposed forehead on both sides."""
    margin = max(3, round(width * 0.052))
    top = max(0, round(eye - width * 0.69))
    bottom = min(hair.shape[0], round(eye))
    left = max(0, round(cx - width * 0.50))
    right = min(hair.shape[1], round(cx + width * 0.50))
    if bottom <= top or right <= left:
        return None
    candidates = np.zeros((bottom - top, right - left), dtype=bool)
    for y in range(top, bottom):
        runs = np.flatnonzero(np.diff(np.pad(hair[y, left:right].astype(int), 1)))
        for lo, hi in runs.reshape(-1, 2):
            if hi - lo > width * 0.14 or lo < 1 or hi == right - left:
                continue
            a, b = left + lo, left + hi
            if skin[y, max(0, a - margin):a].sum() >= 2 and skin[y, b:b + margin].sum() >= 2:
                candidates[y - top, lo:hi] = True
    labels, count = ndimage.label(candidates, structure=np.ones((3, 3)))
    for i in np.argsort(np.bincount(labels.ravel(), minlength=count + 1)[1:])[::-1] + 1:
        yy, xx = np.nonzero(labels == i)
        length = np.ptp(yy)
        if length < width * 0.09 or np.ptp(xx) > width * 0.32 or yy.max() + top > eye - width * 0.045:
            continue
        bounds = []
        for row in np.unique(np.linspace(yy.min(), yy.max(), 10).round().astype(int)):
            x = xx[yy == row] + left
            bounds.append([row + top, x.min(), x.max() + 1])
        bounds = np.array(bounds, float)
        # A hanging tip narrows towards the eye. Reject an eyebrow or a
        # horizontal painted seam caught between two areas of skin.
        widths = bounds[:, 2] - bounds[:, 1]
        if widths[-1] > widths.max() * 0.75 or widths.max() < max(3, width * 0.015):
            continue
        # Follow the branch upwards into the main mass to seat its root.
        dx = np.clip(np.mean(bounds[0, 1:] - bounds[2, 1:]), -margin, margin)
        root = bounds[0] + [-margin, dx, dx]
        return np.vstack([root, bounds])
    return None


def side_part_notch(hair, eye, width, split):
    """A join between two crown lobes indents the upper convex envelope."""
    cap = hair[:round(eye)]
    xs = np.flatnonzero(cap.any(axis=0))
    if len(xs) < 12:
        return None
    top = ndimage.gaussian_filter1d(cap[:, xs].argmax(0).astype(float),
                                    max(1, width * 0.008))
    hull = []
    for i, (x, y) in enumerate(zip(xs, top)):
        while len(hull) > 1:
            a, b = hull[-2:]
            if (xs[b] - xs[a]) * (y - top[b]) > (top[b] - top[a]) * (x - xs[b]):
                break
            hull.pop()
        hull.append(i)
    defect = top - np.interp(xs, xs[hull], top[hull])
    crest = float(top.min())
    # A real side part has an offset notch above the temple, close to the
    # opening at the forehead. Ignore notches in the bob at eye level.
    near = ((top < crest + (eye - crest) * 0.53)
            & (abs(xs - split) < width * 0.48) & (abs(xs - split) > width * 0.055))
    if not near.any():
        return None
    i = int(np.argmax(np.where(near, defect, -np.inf)))
    if defect[i] < max(2, width * 0.023):
        return None
    return xs[i], top[i], defect[i]


def crown_contour(hair, left, right, seam, head_width):
    """Retain undercuts between tufts that horizontal scalp rings would bridge."""
    xx = np.arange(
        max(0, int(np.ceil(left))), min(hair.shape[1], int(np.floor(right)) + 1)
    )
    if len(xx) < 12 or seam < 2:
        return None
    cap = hair[: seam + 1, xx]
    yy = np.where(cap.any(axis=0), cap.argmax(axis=0), seam)
    yy = ndimage.median_filter(yy, size=3).astype(float)
    size = max(5, round(head_width * 0.29)) | 1
    indentation = yy - ndimage.grey_opening(yy, size=size, mode="nearest")
    pad = max(2, len(xx) // 12)
    if indentation[pad:-pad].max() < max(3, head_width * 0.023):
        return None
    yy[[0, -1]] = seam
    # Preserve the sharpest turns, stopping once the curve agrees to about
    # one source pixel. The runtime fills the depth between these landmarks.
    knots = [0, len(xx) - 1]
    while len(knots) < 26:
        error = np.abs(yy - np.interp(xx, xx[knots], yy[knots]))
        where = int(error.argmax())
        if error[where] < max(1.1, head_width * 0.005):
            break
        knots.append(where)
        knots.sort()
    return np.column_stack((xx[knots], yy[knots]))


def nape_contour(hair, cx, eye, chin, width):
    """Retain the visible curved lower hair edge on either side of the neck."""
    xx = np.flatnonzero(hair.any(axis=0))
    if len(xx) < 24:
        return None
    yy = len(hair) - 1 - hair[::-1, xx].argmax(axis=0)
    ends = yy > eye + 0.58 * (chin - eye)
    left = np.flatnonzero(ends & (xx < cx))
    right = np.flatnonzero(ends & (xx > cx))
    if not len(left) or not len(right):
        return None
    a, b = left[-1], right[0]
    yy[a : b + 1] = np.maximum(yy[a : b + 1], np.linspace(yy[a], yy[b], b - a + 1))
    yy = ndimage.median_filter(yy, size=5)
    xs = xx[ends]
    ys = yy[ends]
    return simplify_columns(xs, ys[:, None], 20, max(1, width * 0.008))


def simplify_columns(x, profiles, count, tolerance):
    knots = [0, len(x) - 1]
    while len(knots) < count:
        error = np.max(
            np.abs(
                profiles
                - np.column_stack(
                    [np.interp(x, x[knots], p[knots]) for p in profiles.T]
                )
            ),
            axis=1,
        )
        idx = int(error.argmax())
        if error[idx] <= tolerance:
            break
        knots.append(idx)
        knots.sort()
    return np.column_stack((x, profiles))[knots]


def bob_ink(rgb, paint, cx, eye, chin, width):
    """Dark cuts between overlapping locks with hair pigment on both sides."""
    x0 = max(0, int(cx - width))
    y0 = max(0, int(eye + 0.1 * (chin - eye)))
    patch = rgb[y0 : int(chin + width * 0.10), x0 : int(cx + width)]
    if not patch.size:
        return []
    luma = patch @ [0.21, 0.72, 0.07]
    base = paint @ [0.21, 0.72, 0.07]
    offset = max(3, round(width * 0.021))
    pigment = np.linalg.norm(patch - paint, axis=2) < max(24, base * 0.6)
    # Side edges are inked too, but require colored hair on both sides of a
    # strand so the line stays on the hair when the camera turns.
    mask = (luma < base * 0.68) & (
        np.roll(pigment, offset, axis=1) & np.roll(pigment, -offset, axis=1)
    )
    mask[:, :offset] = mask[:, -offset:] = False
    labels, n = ndimage.label(mask, np.ones((3, 3)))
    result = []
    for i, (ys, xs) in enumerate(ndimage.find_objects(labels, n), 1):
        if ys.stop - ys.start < width * 0.12 or xs.stop - xs.start > width * 0.4:
            continue
        part = labels[ys, xs] == i
        if part.sum() > (ys.stop - ys.start) * width * 0.038:
            continue
        pts = ink_centerline(part, ndimage.distance_transform_edt(part), 8)
        pts += np.array([x0 + xs.start, y0 + ys.start])
        result.append(pts)
    return sorted(result, key=lambda p: np.ptp(p[:, 1]), reverse=True)[:4]


def chin_ink(rgb, skin, cx, mouth, chin, width):
    """Follow the ink turning under the jaw, including its return over the neck."""
    xs = np.arange(
        max(0, int(cx - width * 0.50)), min(rgb.shape[1], int(cx + width * 0.30))
    )
    y0 = max(3, int(mouth + (chin - mouth) * 0.22))
    y1 = min(rgb.shape[0] - 3, int(chin + width * 0.05))
    if y1 <= y0 or len(xs) < 8:
        return None
    patch = rgb[y0:y1, xs]
    dy = max(2, int(width * 0.02))
    above = rgb[y0 - dy : y1 - dy, xs] if y0 >= dy else patch
    mark = (patch @ [0.21, 0.72, 0.07] < (skin @ [0.21, 0.72, 0.07]) * 0.50) & (
        np.linalg.norm(above - skin, axis=2) < 60
    )
    y = np.where(mark.any(axis=0), y0 + len(mark) - 1 - mark[::-1].argmax(axis=0), -1)
    runs = np.split(
        np.flatnonzero(y >= 0), np.flatnonzero(np.diff(np.flatnonzero(y >= 0)) > 2) + 1
    )
    for run in sorted(runs, key=len, reverse=True):
        if len(run) < width * 0.24 or y[run].max() < chin - width * 0.038:
            continue
        yy = ndimage.median_filter(y[run], size=3)
        if np.abs(np.diff(yy)).max() > width * 0.10:
            continue
        return simplify_columns(xs[run], yy[:, None], 14, max(0.8, width * 0.0047))
    return None


def shoe_sections(rgb, figure, shoe, skin, cx, ankle):
    """Trace the upper, sidewall and outsole in lateral slices of one flat shoe."""
    y0 = max(0, round(ankle))
    x0 = int(cx) + 1
    patch = rgb[y0:, x0:]
    inside = figure[y0:, x0:]
    if not inside.any():
        return None
    upper = (np.linalg.norm(patch - shoe, axis=2) < 45) & inside
    if upper.sum() < 30:
        return None
    limit = max(5, np.ptp(np.where(upper)[1]))
    samples = []
    for x in np.flatnonzero(upper.any(axis=0)):
        yy = np.flatnonzero(upper[:, x])
        if len(yy) < 3:
            continue
        bottom = np.flatnonzero(inside[:, x])
        floor = bottom[-1]
        gap = floor - yy[-1]
        if gap >= max(4, limit * 0.04):
            samples.extend(
                patch[yy[-1] + max(1, gap // 3) : floor - max(1, gap // 4), x]
            )
    if len(samples) < 20:
        return None
    rubber = np.median(samples, axis=0)
    if np.linalg.norm(rubber - shoe) < 48 or np.linalg.norm(rubber - skin) < 40:
        return None
    wall = (np.linalg.norm(patch - rubber, axis=2) < 52) & inside
    # Outlines and bright heel piping can share the rubber color higher
    # up. Only the bottom connected sidewall belongs to the outsole.
    upper = ndimage.binary_closing(upper, iterations=2)
    wall = ndimage.binary_closing(wall, iterations=2)
    rows = []
    for x in np.flatnonzero(upper.any(axis=0) | wall.any(axis=0)):
        b = np.flatnonzero(wall[:, x])
        if not len(b):
            continue
        runs = np.split(b, np.flatnonzero(np.diff(b) > 2) + 1)
        floor = np.flatnonzero(inside[:, x])[-1]
        bottom = [
            r for r in runs if r[-1] >= floor - max(5, limit * 0.045) and len(r) >= 2
        ]
        if not bottom:
            continue
        rubber_run = bottom[-1]
        a = np.flatnonzero(upper[: rubber_run[0], x])
        top = a[0] if len(a) else rubber_run[0]
        rows.append([x + x0, top + y0, rubber_run[0] + y0, rubber_run[-1] + y0])
    if len(rows) < max(10, limit * 0.65):
        return None
    rows = np.array(rows, dtype=float)
    for i in range(1, 4):
        rows[:, i] = ndimage.median_filter(rows[:, i], size=3)
    rows[:, 1:] = ndimage.gaussian_filter1d(
        rows[:, 1:], max(1.1, limit * 0.019), axis=0, mode="nearest"
    )
    return simplify_columns(
        rows[:, 0], rows[:, 1:], 12, max(1.45, limit * 0.014)
    ), rubber


def garment_seams(rgb, paint, box, width):
    """Recover interior seams where the same textile meets both sides of the ink."""
    x0, y0, x1, y1 = box
    patch = rgb[max(0, y0) : min(len(rgb), y1), max(0, x0) : min(rgb.shape[1], x1)]
    if min(patch.shape[:2]) < 12:
        return []
    luma = patch @ [0.213, 0.715, 0.072]
    gap = max(3, int(width * 0.02))
    fabric = np.linalg.norm(patch - paint, axis=2) < max(
        40, np.linalg.norm(paint) * 0.19
    )
    across = np.zeros(fabric.shape, dtype=bool)
    for dy, dx in ((0, gap), (gap, 0), (gap, gap), (gap, -gap)):
        across |= np.roll(fabric, (dy, dx), (0, 1)) & np.roll(
            fabric, (-dy, -dx), (0, 1)
        )
    local = ndimage.grey_closing(luma, size=(gap * 2 + 1, gap * 2 + 1))
    mask = across & (local - luma > max(18, (paint @ [0.213, 0.715, 0.072]) * 0.22))
    mask[:gap] = mask[-gap:] = False
    mask[:, :gap] = mask[:, -gap:] = False
    labels, n = ndimage.label(mask, np.ones((3, 3)))
    found = []
    for i, (ys, xs) in enumerate(ndimage.find_objects(labels, n), 1):
        length = np.hypot(ys.stop - ys.start, xs.stop - xs.start)
        if length < max(7, width * 0.072) or length > width * 0.85:
            continue
        part = labels[ys, xs] == i
        if part.sum() / length > max(4, width * 0.029):
            continue
        stroke = ink_centerline(
            part,
            ndimage.distance_transform_edt(part),
            min(10, max(4, round(length / 7))),
        )
        offset = np.array([max(0, x0) + xs.start, max(0, y0) + ys.start])
        found.append(
            (
                length,
                stroke + offset,
                np.median(patch[ys, xs][part], axis=0),
                part.sum() / length,
            )
        )
    return sorted(found, key=lambda s: -s[0])[:6]


def garment_patch(image, mask, bounds):
    """Register a garment box to the full-resolution front without stretching the body."""
    yy, xx = np.nonzero(mask)
    unit = np.ptp(yy)
    left, top, right, bottom = bounds
    x = np.rint((xx.min() + xx.max()) / 2 + np.linspace(left, right, 97) * unit).astype(int)
    y = np.rint(yy.min() + np.linspace(top, bottom, 97) * unit).astype(int)
    return image[np.ix_(y.clip(0, mask.shape[0] - 1), x.clip(0, mask.shape[1] - 1))]


def garment_motif(patch, point=None):
    """Locate one solid printed region. Ignore fabric shading and panels entering at a seam."""
    cloth = np.median(patch, axis=(0, 1))
    contrast = np.linalg.norm(patch - cloth, axis=2) > 54
    if point is not None:
        u, v = np.rint(np.asarray(point) * 96).astype(int)
        seed = np.median(patch[max(0, v - 1):v + 2, max(0, u - 1):u + 2], axis=(0, 1))
        contrast &= np.linalg.norm(patch - seed, axis=2) < 46
    regions, _ = ndimage.label(contrast)
    labels = ([regions[v, u]] if point is not None else
              np.argsort(np.bincount(regions.ravel())[1:])[::-1] + 1)
    for label in labels:
        if not label:
            continue
        region = regions == label
        if not .014 <= region.mean() <= .46:
            continue
        # The print can meet a lapel at a point. A seam or a slice of the
        # sleeve normally reaches the boundary along a substantial edge.
        if region[[0, -1], :].sum() + region[:, [0, -1]].sum() > 4:
            continue
        core = ndimage.binary_erosion(region)
        if core.sum() < 14:
            continue
        paint = np.median(patch[core], axis=0)
        if np.percentile(np.linalg.norm(patch[core] - paint, axis=1), 80) > 27:
            # A print can touch a differently colored lapel. Isolate the
            # swatch around an interior point and check it independently.
            if point is None:
                y, x = np.unravel_index(ndimage.distance_transform_edt(region).argmax(), region.shape)
                match = garment_motif(patch, [x / 96, y / 96])
                if match:
                    return match
            continue
        return region, paint
