"""Measure a hand whose extended fingers touch and are separated by drawn ink."""

import numpy as np
from scipy import ndimage

from .fit import pixels


def inked_hand(rgb, mask, wrist, end, skin):
    wx, wy = np.rint(wrist).astype(int)
    length = end - wx
    if length < 30 or wx < 0 or end >= mask.shape[1]:
        return None
    top = max(0, round(wy - length * 0.42))
    bottom = min(mask.shape[0], round(wy + length * 0.42) + 1)
    if top >= bottom:
        return None
    patch = rgb[top:bottom, wx : end + 1]
    luma = np.array([0.2126, 0.7152, 0.0722])
    ink = (patch @ luma < (skin @ luma) * 0.70) & mask[top:bottom, wx : end + 1]
    bands = []
    for x in range(length + 1):
        pen = np.flatnonzero(ink[:, x])
        spans = []
        if len(pen) >= 2:
            strokes = np.split(pen, np.flatnonzero(np.diff(pen) > 1) + 1)
            for above, below in zip(strokes, strokes[1:]):
                fill = patch[above[-1] + 1 : below[0], x]
                if np.linalg.norm(np.median(fill, axis=0) - skin) < 80:
                    low, high = (above[0] + above[-1]) / 2, (below[0] + below[-1]) / 2
                    spans.append(((low + high) / 2 + top - wrist[1], (high - low) / 2))
        bands.append(spans)

    def stable(count, start, stop, minimum):
        hits = np.array(
            [
                i
                for i in range(round(length * start), round(length * stop))
                if len(bands[i]) == count
            ]
        )
        for run in np.split(hits, np.flatnonzero(np.diff(hits) > 2) + 1):
            if len(run) >= max(3, length * minimum):
                return run
        return None

    # Two separate runs identify the thumb against the palm. Three or four
    # persistent bands past the thumb describe the extended fingertips.
    thumb = stable(2, 0.20, 0.52, 0.095)
    digits = stable(4, 0.61, 0.89, 0.13)
    if digits is None:
        digits = stable(3, 0.60, 0.89, 0.12)
    if thumb is None or digits is None:
        return None

    def ray(x, band, root, minimum, fingertip=True):
        y, radius = band
        trace = [(x, y, radius)]
        for col in range(x + 1, length + 1):
            if not bands[col]:
                break
            near, half = min(bands[col], key=lambda p: abs(p[0] - trace[-1][1]))
            if abs(near - trace[-1][1]) > max(1.8, length * 0.028):
                break
            trace.append((col, near, half))
        span = trace[-1][0] - x
        if span < length * minimum:
            return None
        rows = np.asarray(trace)
        radius = np.median(rows[: max(2, round(len(rows) * 0.7)), 2])
        tip_x, tip_y = rows[-1, :2]
        slope = (tip_y - y) / span
        # A digit's last skin pixel precedes its inked tip. Follow that
        # same centerline to the outer silhouette across the dark cap.
        paper = rgb[0, 0]
        if fingertip and np.max(np.abs(skin - paper)) > 35:
            for col in range(
                int(tip_x) + 1, min(length + 1, int(tip_x + radius * 2.5) + 3)
            ):
                row = round(wrist[1] - top + y + slope * (col - x))
                if (
                    not 0 <= row < len(patch)
                    or not mask[top + row, wx + col]
                    or np.max(abs(patch[row, col] - paper)) < 42
                ):
                    break
                tip_x = col
        # The runtime adds its rounded cap after the final joint.
        tip_x -= radius * (0.75 if fingertip else 0.27)
        root_y = y + slope * (root - x)
        return [root, root_y, tip_x, y + slope * (tip_x - x), radius]

    start = int(digits[0])
    fingers = [ray(start, band, length * 0.45, 0.09) for band in bands[start]]
    if any(f is None for f in fingers):
        return None
    start = int(thumb[len(thumb) // 2])
    branches = [
        ray(start, band, length * 0.23, 0.10, fingertip=False) for band in bands[start]
    ]
    for side, branch in enumerate(branches):
        other = branches[1 - side]
        if (
            branch
            and branch[2] < length * 0.72
            and (other is None or other[2] > branch[2] + length * 0.1)
        ):
            if side:
                fingers.reverse()
            if len(fingers) == 3:
                # A fourth bone chain still curls around the grip. Its rest
                # projection is hidden behind the last visible finger.
                fingers.append([*fingers[-1][:4], fingers[-1][4] * 0.80])
            # The widest part of the palm includes the thumb pad. At its
            # distal end the ink separating the thumb supplies the free edge.
            palm = []
            for fraction in (0, 0.13, 0.28, 0.41, 0.52):
                col = round(length * fraction)
                pen = np.flatnonzero(ink[:, col])
                if len(pen) < 2:
                    return None
                low = pen[0] + top - wrist[1]
                high = pen[-1] + top - wrist[1]
                if fraction >= 0.41 and len(bands[col]) >= 2:
                    center, radius = bands[col][-1 if side else 0]
                    if side:
                        high = center - radius + 0.5
                    else:
                        low = center + radius - 0.5
                if high - low < 2:
                    return None
                palm.append([col, low, high])
            return np.asarray([branch, *fingers]), np.asarray(palm, dtype=float)
    return None


def fit_inked_hands(rgb, mask, center, crown, scale, bounds, skin, body):
    """Register each closed hand to its measured wrist and retain open finger fans."""
    sections = body["sections"]
    reach, height, _ = sections["arm"][-1]
    wrist_y = (height - 12) / scale + crown
    opposite = reach + max(0, reach - body["shoulder"]) * (
        sections.get("leftReach", 1) - 1
    )
    mirror = mask.shape[1] - 1
    views = (
        (
            rgb[:, ::-1],
            mask[:, ::-1],
            mirror - center + opposite / scale,
            mirror - bounds[0],
        ),
        (rgb, mask, center + reach / scale, bounds[1] - 1),
    )
    fans = list(sections.get("openHands", [None, None]))
    palms = list(sections.get("palmContours", [None, None]))
    for i, (image, region, x, tip) in enumerate(views):
        if fans[i] is not None:
            continue
        trace = inked_hand(image, region, (x, wrist_y), tip, skin)
        if trace is not None:
            rays, palm = trace
            rays[:, [0, 2]] += round(x) - x
            rays *= scale
            if (
                np.all((rays[:, 4] >= 0.2) & (rays[:, 4] <= 30))
                and np.all(rays[:, 0] <= 140)
                and np.all(rays[:, 2] <= 190)
                and np.all(np.abs(rays[:, 1]) <= 140)
                and np.all(np.abs(rays[:, 3]) <= 190)
            ):
                palm[:, 0] += round(x) - x
                palm[0, 0] = 0
                palm *= scale
                if np.max(np.abs(palm)) <= 140:
                    fans[i] = rays.round(2).tolist()
                    palms[i] = palm.round(2).tolist()
    if any(fan is not None for fan in fans):
        sections["openHands"] = fans
    if any(palm is not None for palm in palms):
        sections["palmContours"] = palms


def arm_frame(path, body, height):
    """Register native pixels to the figure height and the visible torso axis."""
    rgb, mask = pixels(path, keep_components=True)
    ys = np.nonzero(mask)[0]
    if len(ys) < 2 or ys.min() == ys.max():
        return None
    unit = np.ptp(ys) / (height - 12)
    top = ys.min()
    trunk = round(top + ((body["neckline"] + body["hem"]) / 2 - 12) * unit)
    if not 0 <= trunk < len(mask):
        return None
    waist = np.flatnonzero(mask[trunk])
    if len(waist) < 2:
        return None
    center = (waist[0] + waist[-1]) / 2
    paper = np.median(np.vstack((rgb[0], rgb[-1])), axis=0)
    return rgb, mask, paper, center, top, unit


def arm_centerlines(path, body, height):
    """Height of both exposed arms in drawing units, registered at the torso."""
    frame = arm_frame(path, body, height)
    if frame is None:
        return None
    rgb, mask, paper, center, top, unit = frame
    arm = body["sections"]["arm"]
    middle = round(top + (arm[-1][1] - 12) * unit)
    reach = max(3, round(arm[-1][2] * unit * 2.6))
    low, high = max(0, middle - reach), min(len(mask), middle + reach + 1)
    heights = []
    for side in (-1, 1):
        stations = []
        for x in np.linspace(arm[0][0], arm[-1][0], 11)[4:-1]:
            col = round(center + side * x * unit)
            if not 0 <= col < mask.shape[1]:
                return None
            ink = mask[low:high, col] & (
                np.max(np.abs(rgb[low:high, col] - paper), axis=1) > 38
            )
            rows = np.flatnonzero(ink)
            if len(rows) < 3 or rows[0] == 0 or rows[-1] == high - low - 1:
                continue
            stations.append((low + (rows[0] + rows[-1]) / 2 - top) / unit)
        if len(stations) < 4:
            return None
        heights.append(np.median(stations))
    return np.array(heights)


def compare_hand_contours(reference, native, design):
    """Compare both hands at the same scale and position relative to the torso."""
    body = design["household"]["body"]
    reach, wrist_y, radius = body["sections"]["arm"][-1]
    # Include the wrist and all projected fingers without centering on the tips.
    extents = [
        ray[2] + ray[4]
        for fan in body["sections"].get("openHands", [])
        if fan
        for ray in fan
        if len(ray) == 5
    ]
    if not extents:
        return None
    extent = max(extents)
    outward = np.arange(np.floor(reach - radius), np.ceil(reach + extent + radius) + 1)
    x = np.concatenate((-outward[::-1], outward))
    y = np.arange(np.floor(wrist_y - 3.5 * radius), np.ceil(wrist_y + 3.5 * radius) + 1)
    frames = []
    for path in (reference, native):
        frame = arm_frame(path, body, design["height"])
        if frame is None:
            return None
        rgb, mask, paper, center, top, unit = frame
        col = np.rint(center + x * unit).astype(int)
        row = np.rint(top + (y - 12) * unit).astype(int)
        valid = ((row >= 0) & (row < len(mask)))[:, None] & (
            (col >= 0) & (col < mask.shape[1])
        )
        grid = np.ix_(row.clip(0, len(mask) - 1), col.clip(0, mask.shape[1] - 1))
        color = rgb[grid]
        # Exclude near-paper halos around ink. Retain the light skin that
        # an inked contour encloses, including highlights at the knuckles.
        exterior = np.max(np.abs(color - paper), axis=2) > 38
        matte = (
            np.hstack(
                [ndimage.binary_fill_holes(half) for half in np.hsplit(exterior, 2)]
            )
            & mask[grid]
            & valid
        )
        frames.append((color, matte))
    (a, first), (b, second) = frames
    inside = first & second
    if not inside.any():
        return None
    return {
        "silhouette_iou": round(float(inside.sum() / (first | second).sum()), 4),
        "rgb_mae": round(float(np.abs(a - b)[inside].mean()), 2),
    }
