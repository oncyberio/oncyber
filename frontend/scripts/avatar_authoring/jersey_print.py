"""Place observed print contours on a jersey using one native projection."""

import numpy as np
from scipy import ndimage

from .fit import pixels
from .tracing import garment_patch, outline_mark, print_frame, validate_outline


def ink_fills(smooth):
    """Split a printed counter into touching simple fills accepted by the mesh."""
    solid = ndimage.binary_fill_holes(smooth)
    holes, count = ndimage.label(solid & ~smooth)
    counter = np.isin(
        holes,
        np.flatnonzero(
            np.bincount(holes.ravel(), minlength=count + 1)[1:]
            >= max(5, 0.025 * smooth.sum())
        )
        + 1,
    )
    if not counter.any():
        return [solid]
    visible = solid & ~counter
    # Split along the common direction of the counters. Two openings in a
    # diagonal stroke may never intersect the same horizontal or vertical row.
    y, x = np.indices(smooth.shape)
    points = np.column_stack((x[counter], y[counter]))
    _, axes = np.linalg.eigh(np.cov(points.T))
    best = []
    for normal in (axes[:, 0], axes[:, 1], [1, 0], [0, 1]):
        grid = x * normal[0] + y * normal[1]
        seam = np.median(grid[counter])
        pieces = []
        for half in [visible & (grid <= seam), visible & (grid > seam)]:
            labels, n = ndimage.label(half)
            pieces += [labels == k for k in range(1, n + 1) if (labels == k).sum() >= 3]
        if 2 <= len(pieces) <= 3 and all(
            np.array_equal(ndimage.binary_fill_holes(p), p) for p in pieces
        ):
            if len(pieces) == 2:
                return pieces
            if not best or min(p.sum() for p in pieces) > min(p.sum() for p in best):
                best = pieces
    return best


PRINT_BOUNDS = np.array([-0.35, -0.28, 1.35, 1.16])
PRINT_STEP = (PRINT_BOUNDS[2:] - PRINT_BOUNDS[:2]) / 96


def ink_color(mark):
    return np.frombuffer(bytes.fromhex(mark["color"][1:]), np.uint8)


def ink_regions(image, frame, ink):
    rgb = garment_patch(*image, print_frame(frame, PRINT_BOUNDS))
    chroma = ink - ink.mean()
    if np.linalg.norm(np.median(rgb, axis=(0, 1)) - ink) < 54:
        return []
    near = np.linalg.norm(rgb - ink, axis=2) < 90
    if np.linalg.norm(chroma) > 35:
        hue = rgb - rgb.mean(2, keepdims=True)
        length = np.linalg.norm(hue, axis=2)
        near &= (hue @ chroma > 0.94 * length * np.linalg.norm(chroma)) & (
            length > 0.5 * np.linalg.norm(chroma)
        )
    regions, _ = ndimage.label(near)
    found = []
    for i, box in enumerate(ndimage.find_objects(regions), 1):
        patch = regions[box] == i
        if patch.sum() < 13 or any(s.start == 0 or s.stop == 97 for s in box):
            continue
        y, x = np.nonzero(patch)
        points = PRINT_BOUNDS[:2] + PRINT_STEP * np.column_stack(
            (x + box[1].start, y + box[0].start)
        )
        xmid, ymid = points.mean(0)
        if -0.13 < xmid < 1.16 and -0.08 < ymid < 1.01:
            region = regions == i
            found.append((region, points, np.median(rgb[region], axis=0)))
    return found


def print_anchor(mark):
    outline = np.asarray(mark["outline"])
    after = np.roll(outline, -1, axis=0)
    cross = outline[:, 0] * after[:, 1] - after[:, 0] * outline[:, 1]
    if abs(cross.sum()) < 1e-7:
        return
    return ((outline + after) * cross[:, None]).sum(0) / (3 * cross.sum())


def nearby_strokes(target, anchor):
    if not target or anchor is None:
        return []
    primary = min(target, key=lambda p: np.linalg.norm(p[1].mean(0) - anchor))
    if np.linalg.norm(primary[1].mean(0) - anchor) > 0.24:
        return []
    separation = ndimage.distance_transform_edt(~primary[0])
    area = primary[0].sum()
    neighbors = [
        p
        for p in target
        if p is not primary
        and 0.035 < p[1][:, 1].mean() < 0.97
        and separation[p[0]].min() <= max(5, np.sqrt(area) * 0.90)
        and p[0].sum() <= 1.3 * area
    ]
    if len(neighbors) > 3:
        return []
    return [primary, *sorted(neighbors, key=lambda p: -p[0].sum())]


def print_paths(cluster, ink, scale=1.0, offset=0.0):
    paths = []
    for region, _, _ in cluster:
        smooth = ndimage.gaussian_filter(region.astype(float), 0.60) > 0.45
        pieces = ink_fills(smooth)
        if not pieces or len(paths) + len(pieces) > 5:
            return
        for piece in pieces:
            part = outline_mark(piece, ink)
            if not part:
                return
            measured = PRINT_BOUNDS[:2] + np.array(part["outline"]) * 96 * PRINT_STEP
            mapped = (offset + measured * scale).round(4)
            if mapped.min() < -0.5 or mapped.max() > 1.5:
                return
            path = mapped.tolist()
            try:
                validate_outline(path)
            except ValueError:
                return
            paths.append(path)
    return paths


def multi_stroke_print(image, frame, mark):
    """Retain disconnected strokes of an enclosed badge on the first mesh."""
    ink = ink_color(mark)
    cluster = nearby_strokes(ink_regions(image, frame, ink), print_anchor(mark))
    if len(cluster) < 2:
        return
    paths = print_paths(cluster, ink)
    if paths:
        return {"color": mark["color"], "outline": paths[0], "islands": paths[1:]}


def stroke_coverage(source, native, frame, mark):
    """Check each substantial printed component in the same garment coordinates."""
    ink = ink_color(mark)
    anchor = print_anchor(mark)
    expected = nearby_strokes(ink_regions(source, frame, ink), anchor)
    if len(expected) < 2:
        return
    drawn = ink_regions(native, frame, ink)
    mask = (
        np.logical_or.reduce([p[0] for p in drawn])
        if drawn
        else np.zeros_like(expected[0][0])
    )
    near = ndimage.binary_dilation(mask, iterations=2)
    coverage = [round(float(near[p[0]].mean()), 4) for p in expected]
    return {"coverage": coverage, "matched": min(coverage) >= 0.65}


def projected_print(source, native, frame, mark):
    ink = ink_color(mark)
    anchor = print_anchor(mark)
    target = nearby_strokes(
        ink_regions(pixels(source, keep_components=True), frame, ink), anchor
    )
    drawn = ink_regions(pixels(native, keep_components=True), frame, ink)
    if not target or not drawn:
        return
    primary = target[0]
    observed = min(drawn, key=lambda p: np.linalg.norm(p[1].mean(0) - anchor))
    if np.linalg.norm(observed[1].mean(0) - anchor) > 0.24:
        return
    extent = np.ptp(observed[1], axis=0) + PRINT_STEP
    if min(extent) < 0.025:
        return
    scale = np.clip(np.ptp(np.asarray(mark["outline"]), axis=0) / extent, 0.78, 1.24)
    paths = print_paths(target, ink, scale, anchor - observed[1].mean(0) * scale)
    if not paths:
        return
    # Native enamel and fabric shade the source pigment. Invert the measured
    # channel response within the gamut of the shared material.
    ratio = np.clip((primary[2] + 14) / (observed[2] + 14), 0.85, 1.25)
    dye = np.clip((ink.astype(float) + 14) * ratio - 14, 0, 255).round()
    return {
        "color": "#" + dye.astype("uint8").tobytes().hex(),
        "outline": paths[0],
        **({"islands": paths[1:]} if len(paths) > 1 else {}),
    }
