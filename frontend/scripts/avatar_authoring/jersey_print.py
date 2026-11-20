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


def projected_print(source, native, frame, mark):
    # Capture the full badge, including designs extending past the nominal
    # chest box. All comparisons take place in the same body-height frame.
    bounds = np.array([-0.35, -0.28, 1.35, 1.16])
    step = (bounds[2:] - bounds[:2]) / 96
    ink = np.frombuffer(bytes.fromhex(mark["color"][1:]), np.uint8)
    chroma = ink - ink.mean()

    def components(path):
        rgb = garment_patch(
            *pixels(path, keep_components=True), print_frame(frame, bounds)
        )
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
            points = bounds[:2] + step * np.column_stack(
                (x + box[1].start, y + box[0].start)
            )
            xmid, ymid = points.mean(0)
            if -0.13 < xmid < 1.16 and -0.08 < ymid < 1.01:
                region = regions == i
                found.append((region, points, np.median(rgb[region], axis=0)))
        return found

    target, drawn = components(source), components(native)
    if not target or not drawn:
        return
    # A swept or concave mark needs its area centroid. Knot density around
    # a curved corner should have no effect on its registration.
    outline = np.asarray(mark["outline"])
    after = np.roll(outline, -1, axis=0)
    cross = outline[:, 0] * after[:, 1] - after[:, 0] * outline[:, 1]
    if abs(cross.sum()) < 1e-7:
        return
    anchor = ((outline + after) * cross[:, None]).sum(0) / (3 * cross.sum())

    def distance(part):
        return np.linalg.norm(part[1].mean(0) - anchor)

    primary = min(target, key=distance)
    observed = min(drawn, key=distance)
    if max(distance(primary), distance(observed)) > 0.24:
        return
    separation = ndimage.distance_transform_edt(~primary[0])
    area = primary[0].sum()
    neighbors = [
        p
        for p in target
        if p is not primary
        and separation[p[0]].min() <= max(5, np.sqrt(area) * 0.90)
        and p[0].sum() <= 1.3 * area
    ]
    # Reserve one extra fill for a counter crossing a secondary stroke.
    if len(neighbors) > 3:
        return

    extent = np.ptp(observed[1], axis=0) + step
    if min(extent) < 0.025:
        return
    scale = np.clip(np.ptp(outline, axis=0) / extent, 0.78, 1.24)
    origin = observed[1].mean(0)
    paths = []
    for region, _, _ in [primary, *sorted(neighbors, key=lambda p: -p[0].sum())]:
        smooth = ndimage.gaussian_filter(region.astype(float), 0.60) > 0.45
        pieces = ink_fills(smooth)
        if not pieces or len(paths) + len(pieces) > 5:
            return
        for piece in pieces:
            part = outline_mark(piece, ink)
            if not part:
                return
            measured = bounds[:2] + np.array(part["outline"]) * 96 * step
            mapped = (anchor + (measured - origin) * scale).round(4)
            if mapped.min() < -0.5 or mapped.max() > 1.5:
                return
            path = mapped.tolist()
            try:
                validate_outline(path)
            except ValueError:
                return
            paths.append(path)
    # Native enamel and fabric shade the source pigment. Invert the measured
    # channel response within the gamut of the shared material.
    ratio = np.clip((primary[2] + 14) / (observed[2] + 14), 0.85, 1.25)
    dye = np.clip((ink.astype(float) + 14) * ratio - 14, 0, 255).round()
    return {
        "color": "#" + dye.astype("uint8").tobytes().hex(),
        "outline": paths[0],
        **({"islands": paths[1:]} if len(paths) > 1 else {}),
    }
