"""Measure distinct visible shirt and mouth boundaries at source resolution."""

import numpy as np
from scipy import ndimage

from .household import paint, pigment
from .tracing import mouth_profile


def closed_lips(rgb, center, top, height, width, skin):
    """Locate a painted, closed lip and use the same relief as a full drawing."""
    x0, x1 = (
        max(0, round(center - 0.32 * width)),
        min(rgb.shape[1], round(center + 0.32 * width) + 1),
    )
    y0, y1 = (
        max(0, round(top + 0.69 * height)),
        min(len(rgb), round(top + 0.92 * height) + 1),
    )
    patch = rgb[y0:y1, x0:x1]
    if min(patch.shape[:2]) < 4:
        return None
    luma = np.array([0.213, 0.715, 0.072])
    labels, _ = ndimage.label(patch @ luma < (skin @ luma) * 0.52, np.ones((3, 3)))
    for i, box in enumerate(ndimage.find_objects(labels), 1):
        if box is None:
            continue
        ys, xs = box
        span = xs.stop - xs.start
        if not 0.16 * width <= span <= 0.57 * width or ys.stop - ys.start > 0.29 * span:
            continue
        x, y = np.nonzero(labels == i)[::-1]
        mid = x0 + (xs.start + xs.stop - 1) / 2
        if abs(mid - center) > 0.12 * width:
            continue
        left = [x0 + x.min(), y0 + np.median(y[x == x.min()])]
        right = [x0 + x.max(), y0 + np.median(y[x == x.max()])]
        profile = mouth_profile(rgb, left, right)
        if profile is None:
            continue
        rows, ink, _, color = profile
        if color is None or np.linalg.norm(color - skin) < 34:
            continue
        thickness = rows[:, 3] - rows[:, 2]
        if not 0.045 * span < np.median(thickness) < 0.38 * span:
            continue
        lips = np.column_stack(
            (
                (rows[:, 0] - center) / width,
                (rows[:, 2] - top) / height,
                (rows[:, 3] - top) / height,
            )
        )
        if np.max(abs(lips[:, 0])) <= 0.38 and np.all(
            (0.55 <= lips[:, 1:]) & (lips[:, 1:] <= 0.98)
        ):
            return {
                "lips": lips.round(4).tolist(),
                "lipInk": paint(ink),
                "lipColor": paint(color),
            }
    return None


def inked_cheeks(rgb, mask, head, skin):
    """Identify an ink silhouette on exposed cheeks, independent of hair color."""
    left, top, right, chin = head
    h = chin - top
    depth = max(2, round(0.036 * h))
    votes = []
    for y in np.linspace(top + 0.55 * h, top + 0.96 * h, 36).round().astype(int):
        row = np.flatnonzero(mask[y, left:right]) + left
        if len(row) <= 2 * depth:
            continue
        for x, direction in ((row[0], 1), (row[-1], -1)):
            strip = rgb[y, x + direction * np.arange(depth + 1)]
            inside = strip[-1]
            if np.linalg.norm(inside - skin) < 81:
                edge = np.min(strip[:-1].mean(1))
                votes.append(edge < 105 and inside.mean() - edge > 44)
    return len(votes) >= 8 and np.mean(votes) > 0.55


def open_smile(rgb, eyes, crown, chin, skin):
    """Require bright enamel inside a connected, dark mouth below both eyes."""
    centers = np.array([[(a + c) / 2, (b + d) / 2] for a, b, c, d in eyes])
    gap = centers[1, 0] - centers[0, 0]
    cx, cy = centers.mean(0)
    left, right = max(0, round(cx - gap)), min(rgb.shape[1], round(cx + gap) + 1)
    top, bottom = (
        round(cy + 0.18 * (chin - cy)),
        min(rgb.shape[0], round(chin - 0.025 * (chin - crown))),
    )
    patch = rgb[top:bottom, left:right]
    if min(patch.shape[:2]) < 4:
        return {}
    luma = patch @ [0.2126, 0.7152, 0.0722]
    dark = luma < min(116, 0.74 * (skin @ [0.2126, 0.7152, 0.0722]))
    labels, n = ndimage.label(dark, np.ones((3, 3)))
    candidates = []
    for i, (ys, xs) in enumerate(ndimage.find_objects(labels), 1):
        w, h = xs.stop - xs.start, ys.stop - ys.start
        if not (
            0.45 * gap < w < 2 * gap
            and 0.16 * w < h < 0.85 * w
            and abs(left + (xs.start + xs.stop) / 2 - cx) < 0.32 * gap
        ):
            continue
        component = labels[ys, xs] == i
        area = ndimage.binary_fill_holes(component)
        # If the top edge is open against white teeth, close the columns
        # inside the observed mouth contour before looking for enamel.
        for x in range(w):
            hits = np.flatnonzero(component[:, x])
            if len(hits) > 1:
                area[hits[0] : hits[-1] + 1, x] = True
        colors = patch[ys, xs]
        teeth = area & (colors.min(2) > 145) & (np.ptp(colors, axis=2) < 46)
        if teeth.sum() < max(3, 0.035 * w * h):
            continue
        depth = ndimage.distance_transform_edt(np.pad(teeth, 1))[1:-1, 1:-1]
        ty, tx = np.unravel_index(depth.argmax(), depth.shape)
        x0, y0 = left + xs.start, top + ys.start
        box = [x0, y0, x0 + w, y0 + h]
        # Small enamel strips can be narrower than a five-pixel swatch. Take
        # their color from the interior of their own connected paint region.
        enamel = colors[teeth]
        pigments = {"teeth": np.percentile(enamel, 75, axis=0).round().tolist()}
        core = ndimage.binary_erosion(area) & ~teeth
        if core.any():
            cavity = np.median(
                colors[core & (colors.mean(2) <= np.median(colors[core].mean(1)))],
                axis=0,
            )
            if np.all(np.isfinite(cavity)):
                pigments["cavity"] = cavity.round().tolist()
                tongue = (
                    core
                    & (np.indices(core.shape)[0] > 0.50 * h)
                    & (colors[:, :, 0] > cavity[0] + 36)
                    & (colors[:, :, 0] - colors[:, :, 1] > 40)
                    & (colors[:, :, 2] < 151)
                )
                islands, count = ndimage.label(tongue)
                if count:
                    island = islands == (1 + np.bincount(islands.ravel())[1:].argmax())
                    if island.sum() >= max(4, 0.045 * area.sum()):
                        pigments["tongue"] = (
                            np.median(colors[island], axis=0).round().tolist()
                        )
        candidates.append(
            (
                teeth.sum(),
                {
                    "mouth_box": box,
                    "mouth_y": round(y0 + h / 2),
                    "tooth_sample": [x0 + int(tx), y0 + int(ty)],
                    "mouth_pigments": pigments,
                },
            )
        )
    return max(candidates, key=lambda c: c[0])[1] if candidates else {}


def visible_torso(rgb, mask, head, shirt_xy):
    """Use shirt width below the T-pose sleeve where the reference shows both side seams."""
    left, top, right, chin = head
    height = chin - top
    cx = (left + right) / 2
    y0 = min(len(mask), round(chin + 0.15 * height))
    if len(mask) - y0 < 0.12 * height:
        return None
    shirt = pigment(rgb, shirt_xy)
    color = np.linalg.norm(rgb - shirt, axis=2) < 55
    samples = []
    for y in range(y0, len(mask)):
        labels, n = ndimage.label(mask[y])
        label = labels[round(cx)]
        if not label:
            continue
        xs = np.flatnonzero(labels == label)
        if xs.min() <= 2 or xs.max() >= mask.shape[1] - 3:
            continue
        half = (xs.max() - xs.min()) / (2 * height)
        if 0.17 < half < 0.98 and color[y, xs].mean() > 0.49:
            samples.append(half)
    if len(samples) < max(3, 0.065 * height):
        return None
    return round(float(np.percentile(samples, 30)), 4)


def visible_arm(rgb, mask, head, skin, cloth):
    """Measure a horizontal bare forearm meeting a short sleeve in a cropped T-pose."""
    left, top, right, chin = head
    height = chin - top
    cx = (left + right) / 2
    start, stop = (
        max(0, round(chin - 0.08 * height)),
        min(len(mask), round(chin + 0.69 * height)),
    )
    if stop - start < 0.16 * height or np.linalg.norm(skin - cloth) < 42:
        return
    arms = []
    for side in (-1, 1):
        bare, covered = [], []
        for x in range(
            max(0, round(cx - 1.6 * height)),
            min(mask.shape[1], round(cx + 1.6 * height)),
        ):
            distance = (x - cx) * side / height
            if distance < 0.26:
                continue
            labels, _ = ndimage.label(mask[start:stop, x])
            for sl in ndimage.find_objects(labels):
                row = sl[0]
                if (
                    row.start < 1
                    or row.stop >= stop - start
                    or not 0.055 * height <= row.stop - row.start <= 0.37 * height
                ):
                    continue
                y = start + (row.start + row.stop - 1) / 2
                if not chin - 0.01 * height <= y <= chin + 0.55 * height:
                    continue
                middle = np.median(rgb[round(y) - 1 : round(y) + 2, x], axis=0)
                ds, dc = np.linalg.norm(middle - skin), np.linalg.norm(middle - cloth)
                if ds < 77 and ds + 14 < dc:
                    bare.append(
                        (
                            distance,
                            (y - chin) / height,
                            (row.stop - row.start) / (2 * height),
                        )
                    )
                elif dc < 75 and dc + 14 < ds:
                    covered.append(distance)
        if len(bare) < max(4, 0.065 * height) or not covered:
            continue
        bare = np.array(sorted(bare))
        cuff = bare[0, 0]
        if not 0.33 < cuff < 1.25 or not any(cuff - 0.13 < x < cuff for x in covered):
            continue
        if np.ptp(bare[:, 1]) > 0.075:
            continue
        arms.append([cuff, np.median(bare[:, 1]), np.median(bare[:, 2])])
    if not arms:
        return
    cuff, level, radius = np.median(arms, axis=0)
    if 0.03 <= level <= 0.46 and 0.026 <= radius <= 0.14:
        return dict(
            zip(
                ("cuff", "level", "radius"), np.round([cuff, level, radius], 4).tolist()
            )
        )


def visible_placket(rgb, head, fabric):
    """A polo placket has a vertical ink stroke between two cloth-colored edges."""
    left, top, right, chin = head
    height = chin - top
    center = (right + left) / 2
    start = round(chin + 0.18 * height)
    stop = min(len(rgb), round(chin + 0.57 * height))
    if stop - start < 0.17 * height:
        return False
    cloth = pigment(rgb, fabric)
    offset = max(3, round(height * 0.04))
    for x in range(
        max(offset, round(center - 0.08 * height)),
        min(rgb.shape[1] - offset, round(center + 0.08 * height)),
    ):
        middle = rgb[start:stop, x]
        edges = rgb[start:stop, [x - offset, x + offset]]
        has_ink = (middle @ [0.2126, 0.7152, 0.0722]) < 0.61 * (
            cloth @ [0.2126, 0.7152, 0.0722]
        )
        fabric_edges = (np.linalg.norm(edges - cloth, axis=2) < 48).all(axis=1)
        if np.count_nonzero(has_ink & fabric_edges) >= 0.16 * height:
            return True
    return False


def button_front(rgb, center, neck, hem, cloth, skin):
    """Find compact fasteners in a column beside a continuous cloth overlap."""
    length = hem - neck
    if length < 35:
        return None
    top, stop = max(0, round(neck + 0.10 * length)), min(len(rgb), round(hem))
    left, right = (
        max(0, round(center - 0.17 * length)),
        min(rgb.shape[1], round(center + 0.17 * length) + 1),
    )
    patch = rgb[top:stop, left:right]
    if min(patch.shape[:2]) < 6:
        return None
    tone = patch @ [0.2126, 0.7152, 0.0722]
    cloth_tone = cloth @ [0.2126, 0.7152, 0.0722]
    is_cloth = np.linalg.norm(patch - cloth, axis=2) < 48
    # A printed dot can resemble a single button. The adjacent seam must
    # run down the shirt with the same fabric visible on its two sides.
    offset = max(2, round(0.027 * length))
    ink = tone < min(110, 0.67 * cloth_tone)
    seams = np.zeros_like(ink)
    seams[:, offset:-offset] = (
        ink[:, offset:-offset] & is_cloth[:, : -2 * offset] & is_cloth[:, 2 * offset :]
    )

    # Either a light fastener or a separate dark button can sit on the same
    # sewn overlap. Detect light paint first, then independent dark islands.
    def button_column(dots, dark):
        labels, _ = ndimage.label(dots, np.ones((3, 3)))
        candidates = []
        for label, (ys, xs) in enumerate(ndimage.find_objects(labels), 1):
            w, h = xs.stop - xs.start, ys.stop - ys.start
            if max(w, h) > max(3, 0.055 * length) or not 0.4 <= w / h <= 2.5:
                continue
            local = labels[ys, xs] == label
            if local.sum() < (max(3, 0.00011 * length**2) if dark else 2):
                continue
            y, x = np.mean(np.nonzero(local), axis=1) + [ys.start, xs.start]
            at = (top + y - neck) / length
            if (0.1 if dark else 0.2) <= at <= 0.96:
                candidates.append(
                    (x, y, at, np.percentile(patch[ys, xs][local], 85, axis=0))
                )
        aligned = []
        for x, _, _, _ in candidates:
            group = [b for b in candidates if abs(b[0] - x) <= max(1.2, 0.015 * length)]
            if not 2 <= len(group) <= 6:
                continue
            positions = np.array([b[2] for b in group])
            if np.min(np.diff(positions)) < 0.055 or np.ptp(positions) < (
                0.075 if dark else 0.19
            ):
                continue
            lo, hi = round(group[0][1]), round(group[-1][1]) + 1
            dx = max(2, round(0.075 * length))
            xmin = max(0, round(x) - dx)
            strip = seams[lo:hi, xmin : round(x) + dx + 1]
            if not strip.size or strip.any(axis=1).mean() < 0.70:
                continue
            if dark:
                # The line must persist beside the buttons. Printed dots do
                # not supply a parallel seam in a different column.
                counts = strip.mean(axis=0)
                counts[
                    np.abs(np.arange(len(counts)) + xmin - x) < max(2, 0.012 * length)
                ] = 0
                if counts.max() < 0.7:
                    continue
            aligned.append(group)
        return max(aligned, key=len) if aligned else None

    group = button_column((tone > cloth_tone + 35) & ~is_cloth, False)
    dark = group is None
    if dark:
        group = button_column(ink, True)
    if not group:
        return None
    column = int(np.rint(np.median([b[0] for b in group])))
    # The last exposed skin just above the fasteners locates the V opening.
    core = patch[
        : max(1, round(group[0][1])), max(0, column - offset) : column + offset + 1
    ]
    exposed = np.flatnonzero((np.linalg.norm(core - skin, axis=2) < 52).any(axis=1))
    result = {
        "buttons": [round(b[2], 4) for b in group],
        "buttonColor": np.median([b[3] for b in group], axis=0),
    }
    if dark:
        last = round(group[-1][1])
        # Follow the overlap only while ink persists beyond the final button.
        sx = max(0, column - round(0.075 * length))
        strip = seams[:, sx : column + round(0.075 * length) + 1]
        runs = np.flatnonzero(~strip[last:].any(axis=1))
        if len(runs):
            end = (top + last + runs[0] - neck) / length
            if group[-1][2] < end < 0.88:
                result["placketEnd"] = round(end, 4)
    if len(exposed):
        runs = np.split(exposed, np.flatnonzero(np.diff(exposed) > 1) + 1)
        neckline = next(
            (r for r in runs if r[0] <= offset and len(r) >= max(3, 0.035 * length)),
            None,
        )
        if neckline is not None:
            result["placketDepth"] = round(
                float(np.clip((top + neckline[-1] + 1 - neck) / length, 0.1, 0.4)), 4
            )
    return result
