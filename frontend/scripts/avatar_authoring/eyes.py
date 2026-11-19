"""Measure an inked cartoon pupil even when it meets the eyelid."""

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
from scipy.spatial import ConvexHull


def measure_eye(white, rgb):
    """Return the opening and a measured (x, y, radius) in patch pixels."""
    filled = ndimage.binary_fill_holes(white)
    y, x = np.nonzero(white & ~ndimage.binary_erosion(white))
    if len(x) < 5 or min(np.ptp(x), np.ptp(y)) < 3:
        return filled, None
    points = np.column_stack((x, y))
    if np.linalg.matrix_rank(points - points[0]) < 2:
        return filled, None
    hull = Image.new("1", white.shape[::-1])
    ImageDraw.Draw(hull).polygon(
        [tuple(p) for p in points[ConvexHull(points).vertices].tolist()], fill=1
    )
    # A thin pen line around the eye may connect to the dot. Find the disk
    # by its thickness and the white surrounding it, independently of topology.
    dark = rgb.max(axis=2) < 105
    thickness = ndimage.distance_transform_edt(np.pad(dark, 1))[1:-1, 1:-1]
    peaks = np.asarray(hull) & (thickness == ndimage.maximum_filter(thickness, size=5))
    yy, xx = np.indices(white.shape)
    # Turning compresses the visible white around a round pupil. Bound its
    # diameter by both axes while retaining the surrounding-white check.
    short, long = sorted([np.ptp(x), np.ptp(y)])
    maximum_radius = min(short * 0.47, long * 0.29)
    best, pupil = (-1, 0), None
    for py, px in zip(*np.nonzero(peaks & (thickness >= max(1.4, np.ptp(x) * 0.023)))):
        r = thickness[py, px]
        if r > maximum_radius:
            continue
        distance = np.hypot(xx - px, yy - py)
        around = (distance > r * 1.25) & (distance < r * 2.05)
        if not around.any() or white[around].mean() < 0.32:
            continue
        core = dark & (distance <= r * 1.18)
        area = core.sum()
        # An opaque fringe can project a broad dark triangle into the white.
        # Prefer a resolved dot enclosed by sclera. A pupil meeting the lid
        # remains measurable when no such enclosed dot is present.
        score = (int(filled[py, px]), area * white[around].mean())
        if score > best:
            best = score
            cy, cx = ndimage.center_of_mass(core)
            pupil = (cx, cy, np.sqrt(area / np.pi))
    if pupil is not None:
        px, py, radius = pupil
        # Restore only the bitten arc. A deliberately concave upper lid
        # elsewhere in the drawing must retain its shape.
        filled = filled | (
            np.asarray(hull) & (np.hypot(xx - px, yy - py) <= radius * 1.7)
        )
    return filled, pupil


def lower_eye_ink(rgb, white, box, skin):
    """Measure the dark stroke between the lower sclera and the cheek."""
    left, top, right, bottom = box
    width = right - left
    fibers, samples = [], []
    xs = np.arange(left + round(width * 0.17), right - round(width * 0.17))
    last_white = []
    for x in xs:
        rows = np.flatnonzero(white[top : bottom + 1, x])
        last_white.append(top + rows[-1] if len(rows) else top)
    if len(xs) < 5:
        return None
    slope = np.gradient(ndimage.median_filter(last_white, size=3).astype(float))
    luma = np.array([0.213, 0.715, 0.072])
    limit = min(112, np.dot(skin, luma) * 0.63)
    for x, end, rise in zip(xs, last_white, slope):
        if end < (top + bottom) / 2:
            continue
        strip = rgb[end + 1 : end + max(6, round(width * 0.16)), x]
        dark = np.flatnonzero(strip @ luma < limit)
        if not len(dark) or dark[0] > 1:
            continue
        stroke = np.split(dark, np.flatnonzero(np.diff(dark) > 1) + 1)[0]
        cheek = strip[stroke[-1] + 1 :].astype(float)
        if not len(cheek) or np.linalg.norm(cheek - skin, axis=1).min() > 58:
            continue
        fibers.append(len(stroke) / np.hypot(1, rise))
        colors = strip[stroke]
        samples.append(colors[np.argmin(colors @ luma)])
    if len(fibers) < max(4, len(xs) * 0.52):
        return None
    return float(np.median(fibers)), np.median(samples, axis=0)


def outline_coverage(opening, rgb):
    """Fraction of the visible white boundary touching a dark ink stroke."""
    rim = opening & ~ndimage.binary_erosion(opening)
    if rim.sum() < 16:
        return None
    dark = rgb @ np.array([0.213, 0.715, 0.072]) < 75
    if not dark.any():
        return 0.0
    distance = ndimage.distance_transform_edt(~dark)
    return round(float(np.mean(distance[rim] <= 2.1)), 3)


def white_components(rgb, width_range, height_range, mask=None):
    white = (rgb.min(axis=2) > 183) & (np.ptp(rgb, axis=2) < 44)
    labels, _ = ndimage.label(white if mask is None else white & mask)
    for i, (ys, xs) in enumerate(ndimage.find_objects(labels), 1):
        w, h = xs.stop - xs.start, ys.stop - ys.start
        if not (
            width_range[0] < w < width_range[1]
            and height_range[0] < h < height_range[1]
        ):
            continue
        component = labels[ys, xs] == i
        if component.mean() < 0.32:
            continue
        # Include the ink just outside the white component.
        pad = max(2, round(w * 0.16))
        y0, x0 = max(0, ys.start - pad), max(0, xs.start - pad)
        patch = np.s_[y0 : ys.stop + pad, x0 : xs.stop + pad]
        opening, dot = measure_eye(labels[patch] == i, rgb[patch])
        pupil = (
            None
            if dot is None
            else [
                round((dot[0] + x0 - xs.start + 0.5) / w, 4),
                round((dot[1] + y0 - ys.start + 0.5) / h, 4),
                round(2 * dot[2] / w, 4),
            ]
        )
        center = [(xs.start + xs.stop - 1) / 2, (ys.start + ys.stop - 1) / 2]
        yield component.sum(), {
            "center": center, "size": [w, h], "pupil": pupil,
            "ink_coverage": outline_coverage(opening, rgb[patch]),
        }


def portrait_eyes(image, anchors):
    """Locate distinct white components near two expected screen-space eyes."""
    rgb = np.asarray(image.convert("RGB"), dtype=float)
    span = np.linalg.norm(np.subtract(*anchors))
    found = [None, None]
    for area, eye in white_components(
        rgb, (span * 0.22, span * 1.45), (span * 0.12, span * 1.45)
    ):
        errors = np.linalg.norm(anchors - eye["center"], axis=1)
        index = errors.argmin()
        if errors[index] > span * 0.46:
            continue
        rank = area / (1 + (errors[index] / (0.22 * span)) ** 2)
        if not found[index] or rank > found[index][0]:
            found[index] = rank, eye
    return [entry[1] if entry else None for entry in found]


def turned_eyes(image, frontal):
    """Measure the visible whites in the same head crop as the frontal capture."""
    rgb = np.asarray(image.convert("RGB"), dtype=float)
    widths, heights = np.array([eye["size"] for eye in frontal]).T
    level = np.mean([eye["center"][1] for eye in frontal])
    # A studio background can itself be white. Restrict the search to the
    # fixed eye level shared by the four orthographic turns.
    mask = np.max(np.abs(rgb - rgb[0, 0]), axis=2) > 15
    mask[np.abs(np.arange(rgb.shape[0]) - level) > heights.max()] = False
    openings = sorted(
        white_components(
            rgb,
            (3, widths.max() * 1.8),
            (heights.min() * 0.28, heights.max() * 1.7),
            mask,
        ),
        key=lambda pair: -pair[0],
    )[:2]
    if not openings:
        return {"openings": 0, "pupils": 0}
    eyes = sorted((eye for _, eye in openings), key=lambda e: e["center"][0])
    result = {
        "openings": len(eyes),
        "screen_eyes": eyes,
        "pupils": sum(e["pupil"] is not None for e in eyes),
    }
    if len(eyes) == 2:
        small, large = sorted(e["size"][0] for e in eyes)
        result["width_ratio"] = round(small / large, 3)
    return result


def suggest_eye_centers(rgb, mask):
    """Suggest a pair for the coordinate guide only if both pupils are visible."""
    h, w = mask.shape
    eyes = [
        eye
        for _, eye in white_components(
            rgb, (w * 0.045, w * 0.48), (h * 0.018, h * 0.32), mask
        )
        if eye["pupil"]
    ]
    pairs = []
    for i, a in enumerate(eyes):
        for b in eyes[i + 1 :]:
            ax, ay = a["center"]
            bx, by = b["center"]
            aw, ah = a["size"]
            bw, bh = b["size"]
            span = abs(bx - ax)
            mean_width = (aw + bw) * 0.5
            if (
                0.78 < span / mean_width < 2.6
                and abs(ay - by) < 0.46 * mean_width
                and min(aw * ah, bw * bh) > 0.20 * max(aw * ah, bw * bh)
            ):
                rank = min(aw * ah, bw * bh) / (
                    1 + abs(ay - by) / mean_width + abs(span / mean_width - 1.35)
                )
                pairs.append((rank, [a["center"], b["center"]]))
    return sorted(max(pairs, key=lambda pair: pair[0])[1]) if pairs else []


def compare_gaze(reference, native, anchors):
    source = portrait_eyes(reference, anchors)
    actual = portrait_eyes(native, anchors)
    comparable = all(e and e["pupil"] for e in source)
    issues, errors, diameter_errors = [], [], []
    span = (
        np.linalg.norm(np.subtract(*(e["center"] for e in source)))
        if comparable
        else None
    )
    for side, a, b in zip(("left", "right"), source, actual):
        if not a or not a["pupil"]:
            continue
        if not b or not b["pupil"]:
            issues.append(
                f"Screen-{side} pupil is missing or indistinct in the render."
            )
            continue
        if span and np.linalg.norm(np.subtract(b["center"], a["center"])) / span > 0.24:
            issues.append(
                f"Screen-{side} opening is displaced by over a quarter of the distance between eyes."
            )
        delta = np.subtract(b["pupil"][:2], a["pupil"][:2])
        errors.append(float(np.abs(delta).max()))
        diameter = a["pupil"][2]
        difference = abs(b["pupil"][2] - diameter)
        diameter_errors.append(difference)
        # The detector measures the ink remaining inside the white, including
        # at a lid. Allow measurement jitter on small or partially clipped dots.
        if difference > max(
            0.075, diameter * 0.28, 2 / min(a["size"][0], b["size"][0])
        ):
            issues.append(
                f"Screen-{side} pupil diameter is {b['pupil'][2]:.0%} of its opening width. The source measures {diameter:.0%}."
            )
        if abs(delta[0]) > 0.23:
            direction = "left" if delta[0] > 0 else "right"
            issues.append(
                f"Move the screen-{side} pupil {abs(delta[0]):.0%} of its opening width {direction}."
            )
        if abs(delta[1]) > 0.23:
            direction = "up" if delta[1] > 0 else "down"
            issues.append(
                f"Move the screen-{side} pupil {abs(delta[1]):.0%} of its opening height {direction}."
            )
    status = ("revise" if issues else "matched") if comparable else "unmeasured"
    return {
        "status": status,
        "max_gaze_error": round(max(errors), 4) if errors else None,
        "max_pupil_diameter_error": round(max(diameter_errors), 4)
        if diameter_errors
        else None,
        "source": source,
        "native": actual,
        "feedback": issues,
    }
