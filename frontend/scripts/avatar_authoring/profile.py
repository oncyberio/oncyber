"""Measure an optional side portrait in front-drawing coordinates."""

import numpy as np
from PIL import Image, ImageColor, ImageDraw
from scipy import ndimage
from scipy.spatial import ConvexHull

from .eyes import white_components
from .fit import pixels
from .tracing import bob_ink, eye_strokes, nose_stroke


def mouth_centerline(px, py):
    """Trace columns of a closed ink stroke. Omit the short hook behind a smile."""
    xs = np.unique(px)
    if len(xs) < 7:
        return
    ys = np.array([np.median(py[px == x]) for x in xs])
    # A commissure tick first goes up, then turns down onto the long lip.
    tip = int(np.argmin(ys[: max(2, len(ys) // 5)]))
    has_tick = tip > 0 and ys[0] - ys[tip] > max(1, len(xs) * 0.016)
    start = tip if has_tick else 0
    indices = np.unique(np.linspace(start, len(xs) - 1, 9).round().astype(int))
    tick = np.array([xs[0] - xs[start], ys[0] - ys[start]]) if has_tick else None
    return np.column_stack([xs[indices], ys[indices]]), tick


def scalp_components(hair, crown, collar):
    """Keep the hair connected to the upper head, excluding matching collar ink."""
    labels, _ = ndimage.label(hair, np.ones((3, 3)))
    roots = np.unique(labels[crown : max(crown + 1, round(crown + (collar-crown)*0.35))])
    return np.isin(labels, roots[roots != 0])


def fit_profile(path, design):
    rgb, figure = pixels(path)
    h, w = figure.shape

    colors = [design["hair"]["color"], design["skin"], design["outfit"]["color"]]
    distances = np.stack(
        [np.linalg.norm(rgb - ImageColor.getrgb(c), axis=2) for c in colors]
    )
    nearest = distances.argmin(axis=0)
    hair, skin, shirt = (
        ndimage.binary_opening(figure & (nearest == i) & (d < 52), iterations=2)
        for i, d in enumerate(distances)
    )
    hair_y = np.nonzero(hair.sum(axis=1) > w * 0.045)[0]
    shirt_y = np.nonzero(shirt.sum(axis=1) > w * 0.06)[0]
    if not len(hair_y) or not len(shirt_y):
        raise ValueError(
            "Profile needs visible hair, skin and shirt on an isolated side portrait"
        )
    top = int(hair_y[0])
    collar = int(shirt_y[0])
    hair = scalp_components(hair, top, collar)
    if collar - top < h * 0.22:
        raise ValueError("Profile needs a head above a visible neckline")
    # The face lies forward of the hair. Work in increasing depth for either view.
    band = slice(top + (collar - top) // 3, top + (collar - top) * 2 // 3)
    if not skin[band].any() or not hair[band].any():
        raise ValueError("Cannot separate the face and hair in the side portrait")
    faces_left = np.median(np.nonzero(skin[band])[1]) < np.median(np.nonzero(hair[band])[1])
    if faces_left:
        skin, hair, figure, rgb = (
            skin[:, ::-1],
            hair[:, ::-1],
            figure[:, ::-1],
            rgb[:, ::-1],
        )

    def edge(mask, last=True):
        has = np.flatnonzero(mask.sum(axis=1) > 3)
        if len(has) < 3:
            raise ValueError("Missing side portrait contour")
        points = [np.flatnonzero(mask[y])[(-1 if last else 0)] for y in has]
        return np.interp(np.arange(h), has, points)

    anterior = edge(skin)
    outer = ndimage.median_filter(edge(figure), size=3)
    n = max(2, round(0.015 * (collar - top)))
    low, high = top + (collar - top) * 2 // 3, collar - n
    chin = int(low + np.argmax(outer[low:high] - outer[low + 1 : high + 1]))
    if chin - top < h * 0.16:
        raise ValueError("Cannot locate the underside of the chin")
    throat = slice(chin + max(3, n), max(chin + n + 2, collar - n))
    neck = float(np.median((edge(skin, False)[throat] + anterior[throat]) / 2))
    white = (rgb.min(axis=2) > 178) & (np.ptp(rgb, axis=2) < 43) & figure
    yy, xx = np.nonzero(white)
    mid = (
        (yy > top + 0.32 * (chin - top))
        & (yy < top + 0.64 * (chin - top))
        & (xx > neck)
    )
    if mid.sum() < 12:
        raise ValueError("Cannot locate the visible eye in the side portrait")
    eye = int(np.median(yy[mid]))
    start = eye + round(0.045 * (chin - top))
    stop = top + round(0.77 * (chin - top))
    nose = int(np.argmax(outer[start:stop]) + start)
    face = design["face"]
    # The frontal base of the nose is below its projecting tip. Register the
    # side tip between the eye and chin at its observed height.
    tip_height = float(np.interp(nose, [eye, chin], [face["eyeHeight"], 1.0]))
    stations = [0, face["eyeHeight"], tip_height, 1]
    pixels_y = [top, eye, nose, chin]
    height = design["head"][1]
    ratio = height / (chin - top)
    hair_back, hair_edge = edge(hair, False), edge(hair)
    # Preserve the sagittal bump separately from its underlying cheek.
    root = max(eye, nose - round(0.105 * (chin - top)))
    base = min(chin, nose + round(0.080 * (chin - top)))
    skull = outer.copy()
    skull[root : base + 1] = np.linspace(outer[root], outer[base], base - root + 1)
    nose_rise = max(0, (outer[nose] - skull[nose]) * ratio)
    rows = []
    for t in [*np.linspace(0, 0.96, 27), 0.977, 0.989, 1]:
        y = round(float(np.interp(t, stations, pixels_y)))
        face_z = (
            (skull[y] if t < 1 else (skull[chin] + skull[chin + 1]) / 2) - neck
        ) * ratio
        # Reserve the thickness of the hair over the covered vault.
        cover = np.clip((0.31 - t) / 0.13, 0, 1)
        face_z -= height * 0.075 * cover
        rows.append(
            [
                round(float(t), 3),
                *[
                    round(float(v), 2)
                    for v in (
                        (hair_back[y] - neck) * ratio,
                        (hair_edge[y] - neck) * ratio,
                        face_z,
                    )
                ],
            ]
        )
    # The neck shares the jaw pigment. Trace the underside by walking out
    # from the front of the throat, where the chin actually borders the air.
    throat_front = float(np.median(anterior[throat]))
    jaw_floor = []
    y_start = round(top + (chin - top) * 0.80)
    y_stop = min(collar - n, chin + 2 * n)
    for z in np.unique(np.linspace(throat_front + n, anterior[y_start], 17).round().astype(int)):
        if z < 0 or z >= w:
            continue
        exposed = np.flatnonzero(skin[y_start:y_stop, z])
        if not len(exposed):
            continue
        end = y_start + exposed[-1]
        # Follow the narrow printed outline to its exterior, retaining only
        # samples that really meet the backdrop below the lower jaw.
        while end < y_stop and figure[end + 1, z]:
            end += 1
        if end < y_stop:
            model_y = 12 + height * (1 + (end - chin) * (1 - stations[2]) / (chin - nose))
            jaw_floor.append([round(float((z - neck) * ratio), 2), round(float(model_y), 2)])
    eye_span = (np.percentile(xx[mid], 98) - np.percentile(xx[mid], 2)) * ratio
    result = {
        "rows": rows,
        "noseRise": round(float(nose_rise), 2),
        "eyeSpan": round(float(eye_span), 2),
        "eyeCenter": round(float((np.median(xx[mid]) - neck) * ratio), 2),
    }
    sections = design.get("fit", {}).get("sections", {})
    if design["hair"]["cut"] == "bob" and (sections.get("sidePart") or sections.get("foreheadLock")):
        # On the exposed temple, skin separates the rear mass of hair from
        # the tip sweeping over the forehead. Record that second interval.
        roll = []
        temple = []
        for y in np.unique(np.linspace(top + (eye - top) * 0.18, eye, 23).round().astype(int)):
            xs = np.flatnonzero(hair[y])
            if not len(xs):
                continue
            runs = [r for r in np.split(xs, np.flatnonzero(np.diff(xs) > n) + 1)
                    if len(r) >= max(3, n * 0.55)]
            if runs:
                edge_x = runs[0][-1]
                exposed = skin[y, edge_x + 1 : edge_x + 3*n + 1].any()
                if exposed:
                    temple.append([round(float(np.interp(y, pixels_y, stations)), 4),
                                   round(float((edge_x-neck)*ratio), 2)])
            if len(runs) < 2:
                continue
            back, tip = runs[0], runs[-1]
            if len(back) < (chin-top) * 0.08 or skin[y, back[-1]:tip[0]].sum() < n:
                continue
            roll.append([round(float(np.interp(y,pixels_y,stations)),4),
                         round(float((tip[0]-neck)*ratio),2),round(float((tip[-1]-neck)*ratio),2)])
        if len(roll) >= 4 and len(temple) >= 4:
            result["templeEdge"] = {"side": 1 if faces_left else -1, "rows": temple, "roll":roll}
            if not sections.get("sidePart"):
                # The frontmost fringe and the posterior cap can occupy the
                # same scanline with visible skin between them. Using their
                # envelope as solid hair covers the eye in both profiles.
                first_split = round(float(np.interp(roll[0][0], stations, pixels_y)))
                posterior = hair_edge.copy()
                for y in range(first_split, chin + 1):
                    xs = np.flatnonzero(hair[y])
                    groups = np.split(xs, np.flatnonzero(np.diff(xs) > n) + 1)
                    rear = next((r for r in groups if len(r) > n), None)
                    if rear is not None:
                        posterior[y] = rear[-1]
                posterior = ndimage.median_filter(posterior, size=max(3, n | 1))
                for row in rows:
                    y = round(float(np.interp(row[0], stations, pixels_y)))
                    if y >= first_split:
                        row[2] = round(float((posterior[y] - neck) * ratio), 2)
    if len(jaw_floor) >= 5:
        result["chinFloor"] = jaw_floor
    if nose_rise > 0.5:
        result["noseProfile"] = [
            [
                round(float(np.interp(y, pixels_y, stations)), 4),
                round(float(max(0, outer[y] - skull[y]) * ratio), 2),
            ]
            for y in np.unique(
                np.append(np.linspace(root, base, 9).round().astype(int), nose)
            )
        ]
        result["noseRise"] = max(depth for _, depth in result["noseProfile"])
    # The side drawing supplies the third coordinate of a pupil measured in
    # the frontal T-pose. A closed lid or indistinct dot supplies no depth.
    region = figure.copy()
    region[:top] = False
    region[nose:] = False
    region[:, : max(0, round(neck))] = False
    candidates = [
        (area, e)
        for area, e in white_components(rgb, (4, w), (4, chin - top), region)
        if abs(e["center"][1] - eye) < e["size"][1] / 2
    ]
    if candidates:
        _, opening = max(candidates, key=lambda entry: entry[0])
        # The visible white and the upper lid do not share the same depth at
        # every height. Measure its sagittal outline as the second projection.
        ex, ey = opening["center"]
        ew, eh = opening["size"]
        x0, x1 = round(ex - (ew - 1) / 2), round(ex + (ew - 1) / 2) + 1
        y0, y1 = round(ey - (eh - 1) / 2), round(ey + (eh - 1) / 2) + 1
        vy, vx = np.nonzero(white[y0:y1, x0:x1])
        points = np.column_stack([vx, vy])
        if len(points) > 5 and np.linalg.matrix_rank(points - points[0]) == 2:
            hull = Image.new("1", (ew, eh))
            ImageDraw.Draw(hull).polygon(
                [tuple(p) for p in points[ConvexHull(points).vertices]], fill=1
            )
            region = np.asarray(hull)
            levels = np.flatnonzero(region.any(1))
            result["eyeRows"] = []
            for fy in np.unique(
                np.linspace(levels[0], levels[-1], 13).round().astype(int)
            ):
                edges = np.flatnonzero(region[fy]) + x0
                result["eyeRows"].append(
                    [
                        round(float((fy - levels[0]) / (levels[-1] - levels[0])), 3),
                        round(float((edges[0] - neck) * ratio), 2),
                        round(float((edges[-1] - neck) * ratio), 2),
                    ]
                )
        folds = eye_strokes(
            rgb,
            (x0, y0, x1, y1),
            np.array(ImageColor.getrgb(design["skin"])),
            chin - top,
        )
        if len(folds) >= 2:
            brow = folds[0][0]
            result["browProfile"] = [
                [round(float((x-neck)*ratio),2), round(float(12+height*np.interp(y,pixels_y,stations)),2)]
                for x,y in brow
            ]
        if folds:
            fold = folds[-1][0]
            if y0 - fold[len(fold) // 2][1] < eh * 0.75:
                result["lidSpan"] = [
                    round(float((p[0] - neck) * ratio), 2) for p in (fold[0], fold[-1])
                ]
        dot = opening["pupil"]
        if dot:
            px = opening["center"][0] + (dot[0] - 0.5) * opening["size"][0]
            result["pupilDepth"] = round(float((px - neck) * ratio), 2)
    # The cheek is a curved surface. Its commissure appears inland of the lip
    # silhouette in profile, even if the frontal smile is almost horizontal.
    # Intersect dark strokes with a skin interior to discard the outer contour.
    height_px = chin - top
    inside = ndimage.binary_erosion(figure, iterations=max(2, round(height_px * 0.014)))
    ink = (rgb.max(axis=2) < 105) & (np.ptp(rgb, axis=2) < 48)
    ys, xs = np.indices(figure.shape)
    if nose_rise > 0.5 and design.get("fit", {}).get("sections", {}).get("nose"):
        below_lid = np.percentile(yy[mid], 99) + max(2, height_px * 0.012)
        nose_region = (
            (ys >= max(root, below_lid)) & (ys <= base) & (xs > skull[:, None] - height_px * 0.045)
            & (xs < outer[:, None] - height_px * 0.016) & inside
        )
        # Only infer an unmarked surface when the region is large enough to
        # resolve an ink stroke. The outer silhouette already draws the nose.
        if nose_region.sum() > 24 and np.count_nonzero(ink & nose_region) < max(3, height_px * 0.012):
            result["frontalNoseInk"] = True
    mouth_zone = (
        (ys > nose + height_px * 0.049)
        & (ys < chin - height_px * 0.098)
        & (xs > neck + height_px * 0.024)
    )
    strokes, _ = ndimage.label(ink & inside & mouth_zone, np.ones((3, 3)))
    candidates = []
    for i, (yy, xx) in enumerate(ndimage.find_objects(strokes), 1):
        span = xx.stop - xx.start
        if (
            not height_px * 0.042 < span < height_px * 0.43
            or yy.stop - yy.start > span * 0.65
        ):
            continue
        py, px = np.nonzero(strokes == i)
        if abs(np.median(anterior[py]) - xx.stop) > height_px * 0.075:
            continue
        candidates.append((span, px, py))
    if candidates:
        _, px, py = max(candidates, key=lambda c: c[0])
        rear = px < np.percentile(px, 12)
        if rear.any():
            result["mouthCorner"] = [
                round(float((px[rear].mean() - neck) * ratio), 2),
                round(
                    float(
                        max(
                            0,
                            (
                                np.median(py[px >= np.percentile(px, 85)])
                                - np.median(py[rear])
                            )
                            * ratio,
                        )
                    ),
                    2,
                ),
            ]

        if design.get("mouth") == "smile":
            trace = mouth_centerline(px, py)
            if trace is not None:
                points, tick = trace
                result["mouthProfile"] = [
                    [round(float((x - neck) * ratio), 2),
                     round(float(12 + height * np.interp(y, pixels_y, stations)), 2)]
                    for x, y in points
                ]
                if tick is not None:
                    result["mouthTick"] = np.round(tick * ratio, 2).tolist()

    if design["hair"]["cut"] == "bob":
        # A visible ear interrupts the leading lock. Measure the recess between
        # its two roots, then round the pinna independently from the hair shell.
        low = max(eye, nose - round(0.18 * height_px))
        high = min(chin, nose + round(0.24 * height_px))
        edge_z = ndimage.median_filter(edge(skin, False), size=max(3, n))
        window = max(3, round(0.066 * height_px))
        slope = edge_z[low + window : high] - edge_z[low : high - window]
        if len(slope) and slope.min() < -0.035 * height_px:
            begin = low + int(slope.argmin())
            ups = np.arange(begin + window, min(high, begin + round(0.27 * height_px)))
            if len(ups):
                end = int(ups[np.argmax(edge_z[ups] - edge_z[ups - window])])
                if (
                    end - begin > 0.077 * height_px
                    and edge_z[end] - edge_z[end - window] > 0.021 * height_px
                ):
                    values = edge_z[begin : end + 1]
                    back = float(np.percentile(values, 9))
                    forward = max(edge_z[begin], edge_z[end])
                    if forward - back > height_px * 0.044:
                        result["ear"] = [
                            round(float(((forward + back) * 0.5 - neck) * ratio), 2),
                            round(
                                float(
                                    12
                                    + height
                                    * np.interp((begin + end) * 0.5, pixels_y, stations)
                                ),
                                2,
                            ),
                            round(float((forward - back) * 0.5 * ratio), 2),
                            round(
                                float(
                                    height
                                    * (
                                        np.interp(end, pixels_y, stations)
                                        - np.interp(begin, pixels_y, stations)
                                    )
                                    * 0.5
                                ),
                                2,
                            ),
                        ]
    if design["hair"]["cut"] == "bob":
        # The bob has a second hem in depth. Following the frontal hem all
        # around the back cuts a horizontal shelf above the neck in profile.
        zs, ends = [], []
        for z in np.flatnonzero(hair[top:collar].any(0)):
            ys = np.flatnonzero(hair[top:collar, z]) + top
            if ys[-1] >= top + height_px * 0.79:
                zs.append(z)
                ends.append(ys[-1])
        if len(zs) >= 12:
            ends = ndimage.median_filter(ends, size=5)
            sample = np.unique(np.linspace(0, len(zs) - 1, 13).round().astype(int))
            result["hem"] = [
                [
                    round(float((zs[i] - neck) * ratio), 2),
                    round(
                        float(
                            12
                            + height
                            * (1 + (ends[i] - chin) / (chin - nose) * (1 - stations[2]))
                        ),
                        2,
                    ),
                ]
                for i in sample
            ]
        strokes = bob_ink(
            rgb,
            np.array(ImageColor.getrgb(design["hair"]["color"])),
            neck,
            eye,
            chin,
            chin - top,
        )
        if strokes:
            result["locks"] = [
                [
                    [
                        round(float((px - neck) * ratio), 2),
                        round(
                            float(12 + height * np.interp(py, pixels_y, stations)), 2
                        ),
                    ]
                    for px, py in stroke
                ]
                for stroke in strokes
            ]
    if "ear" in result and design.get("fit", {}).get("sections", {}).get("jaw"):
        _, cy, _, ry = result["ear"]
        lower = max(0.68, (cy + ry - 12) / height)
        if lower < 0.88:
            edge_of_cheek = edge(skin, False)
            jaw = []
            for t in np.linspace(lower, 0.946, 8):
                y = round(np.interp(t, stations, pixels_y))
                depth = (np.median(edge_of_cheek[y - 2 : y + 3]) - neck) * ratio
                jaw.append([round(float(t), 3), round(float(depth), 2)])
            result["jawEdge"] = jaw
    return result


def projected_forelock_side(hair, contour, roll, crown, eye, eye_height, eye_fraction, origin, anchor, scale):
    """Match a profile lock to a frontal temple using the oblique drawing."""
    angle = np.deg2rad(35)
    rows = np.asarray(contour)
    top = rows[0, 0]
    votes = []
    for level, back, front in roll:
        y = top + (eye_height - top) * level / eye_fraction
        py = round(eye + (y - eye_height) / scale)
        roots = [np.interp(y, rows[:, 0], rows[:, c]) for c in (3, 4)]
        if py < crown or py >= hair.shape[0] or roots[1] - roots[0] < 6 * scale:
            continue
        depth = (back + front) / 2
        spots = np.rint(origin + (np.cos(angle) * np.asarray(roots)
                                  + np.sin(angle) * depth - anchor) / scale).astype(int)
        radius = max(1, round((eye - crown) * 0.012))
        if spots.min() < radius or spots.max() + radius >= hair.shape[1]:
            continue
        votes.append([hair[max(0, py-radius):py+radius+1, x-radius:x+radius+1].mean() for x in spots])
    if len(votes) >= 4:
        left, right = np.mean(votes, axis=0)
        if max(left, right) >= 0.62 and abs(left - right) >= 0.35:
            return -1 if left > right else 1
    return None


def fit_quarter_hair(path, design):
    """Measure the visible bob, cheek, ear and smile in the +35° portrait."""
    rgb, figure = pixels(path)
    colors = [
        ImageColor.getrgb(c)
        for c in (design["hair"]["color"], design["skin"], design["outfit"]["color"])
    ]
    dist = np.stack([np.linalg.norm(rgb - c, axis=2) for c in colors])
    hair, skin, shirt = [
        ndimage.binary_opening(figure & (d < 52) & (dist.argmin(0) == i), iterations=2)
        for i, d in enumerate(dist)
    ]

    def active(mask):
        return np.flatnonzero(mask.sum(1) > max(4, figure.shape[1] * 0.025))

    if not len(active(hair)) or not len(active(shirt)):
        raise ValueError("The 35 degree guide needs a visible bob and neckline")
    crown, collar = active(hair)[0], active(shirt)[0]
    eyes = portrait_openings(path)
    if len(eyes) != 2 or collar <= crown:
        raise ValueError(
            "The 35 degree hair fit needs two eye openings and a visible neck"
        )
    eye = np.mean([e["center"][1] for e in eyes])
    left = skin.argmax(1)
    right = skin.shape[1] - 1 - skin[:, ::-1].argmax(1)
    # Locate the width drop from the chin to the unobstructed neck.
    lower = int(eye + (collar - eye) * 0.53)
    stop = int(collar - (collar - crown) * 0.032)
    if stop <= lower:
        raise ValueError("The neck cannot be separated in the 35 degree guide")
    width = ndimage.median_filter(right - left, size=5)
    chin = lower + np.argmax(width[lower:stop] - width[lower + 1 : stop + 1])
    origin = float(np.mean([e["center"][0] for e in eyes]))
    h = design["head"][1]
    eye_y = 12 + h * design["face"]["eyeHeight"]
    sections = design["fit"]["sections"]
    if len(sections.get("eyes", [])) != 2 or "eyeCenter" not in sections["sideGuide"]:
        raise ValueError(
            "Fitting the turned locks needs two measured front eyes and the side eye center"
        )
    centers = [
        (min(p[0] for p in eye["rim"]) + max(p[0] for p in eye["rim"])) / 2
        for eye in sections["eyes"]
    ]
    angle = np.deg2rad(35)
    anchor_x = np.mean(centers) * np.cos(angle) + sections["sideGuide"][
        "eyeCenter"
    ] * np.sin(angle)
    ratio = h / (chin - crown)
    result = []
    for t in np.linspace(0.42, 0.985, 21):
        y = round(np.interp(12 + t * h, [12, eye_y, 12 + h], [crown, eye, chin]))
        ink = np.flatnonzero(hair[y])
        solid = np.flatnonzero(figure[y])
        if len(ink) < 3 or len(solid) < 3:
            continue
        # A cheek may hide a lock. Only fit a tangent where the hair itself
        # owns the exterior silhouette. All other tangents stay unconstrained.
        if solid[-1] - ink[-1] < max(4, 0.019 * (chin - crown)):
            result.append(
                [
                    round(float(t), 3),
                    round(float(anchor_x + (ink[-1] - origin) * ratio), 2),
                ]
            )
    landmarks = {"turnedHair": result} if len(result) >= 3 else {}
    crown_rows = []
    hair_top = sections["hair"][0][0] - 1.8
    eye_scale = (eye_y - hair_top) / (eye - crown)
    temple = sections["sideGuide"].get("templeEdge", {})
    if temple.get("roll"):
        measured_side = projected_forelock_side(
            hair, sections["hair"], temple["roll"], crown, eye, eye_y,
            design["face"]["eyeHeight"], origin, anchor_x, eye_scale,
        )
        if measured_side is not None and measured_side != temple["side"]:
            landmarks["forelockSide"] = measured_side
    # The rear edge of a bob is often visible from crown to hem. Measure it
    # even where the cheek or the eye owns the opposite edge of the same row.
    rear_rows = []
    for t in np.linspace(0.06, 0.975, 27):
        y = round(eye + (12 + h*t-eye_y)/eye_scale)
        if not 0 <= y < collar:
            continue
        ink, body = np.flatnonzero(hair[y]), np.flatnonzero(figure[y])
        if len(ink) > 3 and len(body) and ink[0]-body[0] <= max(4,0.016*(chin-crown)):
            rear_rows.append([round(float(t),3),round(float(anchor_x+(body[0]-origin)*eye_scale),2)])
    if len(rear_rows) >= 4:
        landmarks["turnedBack"] = rear_rows
    nose = sections.get("nose")
    if nose:
        tip_y = eye + (max(y for _, y in nose["stroke"]) - eye_y) / eye_scale
        tip_x = origin + 0.32 * abs(eyes[1]["center"][0] - eyes[0]["center"][0])
        tip = nose_stroke(rgb, np.array(colors[1]), eye, (tip_x, tip_y),
                          chin, design["head"][0] / eye_scale)
        if tip is not None:
            landmarks["turnedNose"] = [
                [round(float(anchor_x + (x - origin) * eye_scale), 2),
                 round(float(eye_y + (y - eye) * eye_scale), 2)] for x, y in tip[0]
            ]
    for t in np.linspace(0.015, min(0.55, design["face"]["eyeHeight"]), 13):
        y = round(crown + (12 + t * h - hair_top) / eye_scale)
        ink, solid = np.flatnonzero(hair[y]), np.flatnonzero(figure[y])
        if len(ink) < 3 or len(solid) < 3:
            continue
        face_row = np.flatnonzero(skin[y])
        hair_owns_edges = not len(face_row) or (ink[0] < face_row[0] and ink[-1] > face_row[-1])
        if hair_owns_edges:
            crown_rows.append([
                round(float(t), 3),
                round(float(anchor_x + (solid[0] - origin) * eye_scale), 2),
                round(float(anchor_x + (solid[-1] - origin) * eye_scale), 2),
            ])
    if len(crown_rows) >= 3:
        landmarks["turnedCrown"] = crown_rows
    jaw = sections["sideGuide"].get("jawEdge")
    if jaw:
        stations = []
        for station in jaw:
            t, depth = station[:2]
            y = round(eye + (12 + t * h - eye_y) / eye_scale)
            if not 2 <= y < chin or skin[y].sum() < (chin - crown) * 0.08:
                break
            projected = anchor_x + (np.median(left[y - 2 : y + 3]) - origin) * eye_scale
            lateral = (projected - depth * np.sin(angle)) / np.cos(angle)
            stations.append([t, depth, round(float(lateral), 2)])
        if len(stations) == len(jaw):
            landmarks["jawEdge"] = stations
    side_ear = sections["sideGuide"].get("ear")
    if side_ear:
        # The near lobe interrupts skin against the dark bob. Measure its
        # tangent at the cheek, in the same coordinate frame as the two eyes.
        _, ear_y, _, ear_ry = side_ear
        rows = np.rint(eye + (ear_y + np.linspace(-0.28, 0.28, 7) * ear_ry - eye_y) / eye_scale).astype(int)
        rows = rows[(rows >= 0) & (rows < collar)]
        ear_edge = [left[y] for y in rows if skin[y].sum() > (chin - crown) * 0.14]
        if len(ear_edge) >= 4 and np.ptp(ear_edge) < (chin - crown) * 0.055:
            landmarks["turnedEar"] = round(float(anchor_x + (np.median(ear_edge) - origin) * eye_scale), 2)
    if design.get("mouth") == "smile":
        height = chin - crown
        yy, xx = np.indices(figure.shape)
        near_skin = ndimage.distance_transform_edt(~skin) < max(3, height * 0.016)
        region = (
            near_skin & (yy > eye + 0.43 * (chin - eye))
            & (yy < eye + 0.81 * (chin - eye))
            & (abs(xx - origin) < height * 0.25)
        )
        # Ignore outlines along the jaw, hairline and nose.
        label, _ = ndimage.label(
            region & (rgb.max(2) < 108) & (np.ptp(rgb, axis=2) < 58),
            np.ones((3, 3)),
        )
        found = []
        for i, (sy, sx) in enumerate(ndimage.find_objects(label), 1):
            width, tall = sx.stop - sx.start, sy.stop - sy.start
            if height * 0.08 < width < height * 0.43 and tall < width * 0.46:
                py, px = np.nonzero(label[sy, sx] == i)
                found.append((width, px + sx.start, py + sy.start))
        if found:
            _, px, py = max(found, key=lambda f: f[0])
            trace = mouth_centerline(px, py)
            if trace is not None:
                landmarks["turnedMouth"] = [
                    [round(float(anchor_x + (x - origin) * eye_scale), 2),
                     round(float(eye_y + (y - eye) * eye_scale), 2)]
                    for x, y in trace[0]
                ]
    return landmarks


def registered_profile(path, design, quarter=False, color=False, frontal=False):
    """Register two side portraits at the eye and scale by the eye-to-crown height."""
    rgb, figure = pixels(path)
    hair_rgb = np.array(ImageColor.getrgb(design["hair"]["color"]))
    skin_rgb = np.array(ImageColor.getrgb(design["skin"]))

    def hue(x):
        return x / np.maximum(np.linalg.norm(x, axis=-1, keepdims=True), 1)

    distance = np.linalg.norm(hue(rgb) - hue(hair_rgb), axis=2)
    other = np.linalg.norm(hue(rgb) - hue(skin_rgb), axis=2)
    hair = (
        figure
        & (distance < other)
        & (rgb.mean(axis=2) < max(150, hair_rgb.mean() + 45))
    )
    skin = figure & (other < distance) & (other < 0.25)
    top_rows = np.flatnonzero(hair.sum(axis=1) >= max(4, figure.shape[1] * 0.01))
    if not len(top_rows):
        raise ValueError("Cannot register the hair in the side view")
    top = top_rows[0]
    white = figure & (rgb.min(axis=2) > 185) & (np.ptp(rgb, axis=2) < 42)
    white[:top] = False
    white[int(top + 0.71 * (figure.shape[0] - top)) :] = False
    label, count = ndimage.label(white)
    if not count:
        raise ValueError("Cannot register the visible eye in the side view")
    sizes = np.bincount(label.ravel())
    yy, xx = np.nonzero(label == np.argmax(sizes[1:]) + 1)
    ey, ex = np.mean(yy), np.mean(xx)
    half = ey - top
    if half < 10 or len(xx) < max(10, half**2 * 0.003):
        raise ValueError("The side view does not have a measurable eye")
    hair_x = np.flatnonzero(hair[round(ey)])
    if not len(hair_x):
        raise ValueError("Cannot locate hair at eye height in the side view")
    right = frontal or ex > np.median(hair_x)
    anchor_x = 242
    pair = portrait_openings(path)
    if quarter or frontal:
        if len(pair) != 2:
            raise ValueError(
                "Both white openings are needed to register a front or three-quarter view"
            )
        ex = float(np.mean([e["center"][0] for e in pair]))
        anchor_x = 175
    y, x = np.mgrid[:250, :320]
    # The whole head is measured in eye-to-crown units; its width retains its aspect.
    iy = np.rint(top + (y - 6) * half / 119).astype(int)
    ix = np.rint(ex + (x - anchor_x) * half / 119 * (1 if right else -1)).astype(int)
    inside = (iy >= 0) & (ix >= 0) & (iy < figure.shape[0]) & (ix < figure.shape[1])
    iy, ix = np.clip(iy, 0, figure.shape[0] - 1), np.clip(ix, 0, figure.shape[1] - 1)
    if color:
        picture = np.empty((250, 320, 3), dtype=np.uint8)
        picture[:] = rgb[0, 0]
        picture[inside] = rgb[iy[inside], ix[inside]]
        if color is True:
            return picture, bool(right), half, pair
    levels = np.full((250, 320), 0, dtype=np.uint8)
    levels[inside & figure[iy, ix]] = 1
    levels[inside & skin[iy, ix]] = 2
    levels[inside & hair[iy, ix]] = 3
    registered = (levels, picture) if color == "both" else levels
    return registered, bool(right), half, pair


def profile_layers(path, design, quarter=False):
    levels, right, _, _ = registered_profile(path, design, quarter)
    return levels, right


def opposite_outline_widths(first, other, crown_y=6, eye_y=125):
    """Compare exterior widths at the same height, independent of eye depth and pigment."""
    span = eye_y - crown_y
    if first.shape != other.shape or span <= 0:
        raise ValueError("Opposing silhouettes need the same grid and a crown above the eye")
    # Keep the crown, forehead and nose. A neck or shoulder may cover the lower jaw.
    low = max(0, round(crown_y + 0.10 * span))
    high = min(first.shape[0], round(crown_y + 1.45 * span))

    def widths(levels):
        mask = levels[low:high] > 0
        valid = mask.any(1) & ~mask[:, 0] & ~mask[:, -1]
        return mask.shape[1] - mask[:, ::-1].argmax(1) - mask.argmax(1), valid

    a, visible_a = widths(first)
    b, visible_b = widths(other)
    visible = visible_a & visible_b
    # Report a sustained signed discrepancy. A single antialiased row at the
    # nose or a cropped silhouette cannot determine the worst band.
    window = max(3, round(0.10 * span))
    bands = [
        (float(np.median((b - a)[i:i + window])), i)
        for i in range(len(a) - window + 1)
        if visible[i:i + window].all()
    ]
    if not bands or visible.sum() < max(8, (high - low) * 0.65):
        return None
    difference, i = max(bands, key=lambda band: abs(band[0]))
    return {
        "eye_to_crown_px": round(float(span), 2),
        "rows_compared": int(visible.sum()),
        "p90_width_difference_px": round(float(np.percentile(abs(b[visible] - a[visible]), 90)), 2),
        "worst_band_from_crown": [round((low + i + j - crown_y) / span, 3) for j in (0, window - 1)],
        "opposite_minus_primary_width_px": round(difference, 2),
    }


def portrait_openings(path):
    """Visible eye proportions in the head of an isolated studio portrait."""
    rgb, figure = pixels(path)
    h, w = figure.shape
    figure[round(h * 0.74) :] = False
    eyes = sorted(
        white_components(rgb, (w * 0.008, w * 0.6), (h * 0.014, h * 0.43), figure),
        key=lambda item: -item[0],
    )
    if not eyes:
        return []
    near = eyes[0][1]
    return [
        near,
        *[
            eye
            for _, eye in eyes[1:]
            if abs(eye["center"][1] - near["center"][1]) < near["size"][1] * 0.38
        ][:1],
    ]


def quarter_pupils(path):
    """Horizontal expression landmarks, ordered from screen left to right."""
    pair = sorted(portrait_openings(path), key=lambda eye: eye["center"][0])
    if len(pair) == 2 and all(eye["pupil"] is not None for eye in pair):
        return [round(float(np.clip(eye["pupil"][0], 0, 1)), 4) for eye in pair]


def compare_expressions(guide, neutral, posed, design, output):
    sheet = Image.new("RGB", (960, 276), "#f7f4ef")
    pen = ImageDraw.Draw(sheet)
    for i, (path, label) in enumerate((
        (guide, "35° drawing"), (neutral, "Resting gaze"), (posed, "Drawn gaze pose")
    )):
        colors, _, _, _ = registered_profile(path, design, quarter=True, color=True)
        sheet.paste(Image.fromarray(colors), (i * 320, 26))
        pen.text((i * 320 + 8, 6), label, fill="#272722")
    sheet.save(output)


def profile_nose_tip(levels):
    """Projected tip in the eye/crown coordinate system of registered_profile."""
    solid = levels > 0
    present = solid.any(axis=1)
    edge = solid.shape[1] - 1 - solid[:, ::-1].argmax(axis=1)
    eye_y, eye_x, eye_to_crown = 125, 242, 119
    # Locate a projecting nose between the opening and the mouth. Ignore the
    # ink thickness when selecting the center of a rounded, flat-topped tip.
    start = eye_y + round(eye_to_crown * 0.06)
    stop = eye_y + round(eye_to_crown * 0.47)
    if not present[start : stop + 1].all():
        return None
    contour = edge[start : stop + 1]
    bulge = contour - np.linspace(contour[0], contour[-1], len(contour))
    if bulge.max() < 3:
        return None
    apex = int(np.argmax(bulge))
    near = contour >= contour[apex] - 1
    left = right = apex
    while left and near[left - 1]:
        left -= 1
    while right + 1 < len(near) and near[right + 1]:
        right += 1
    y = (left + right) / 2 + start
    return [round(float((max(contour[left:right + 1]) - eye_x) / eye_to_crown), 4),
            round(float((y - eye_y) / eye_to_crown), 4)]


def smile_ink(rgb, levels, center_y, quarter):
    """Find an interior closed-mouth stroke on the eye-registered portrait."""
    skin = levels == 2
    # Filling a thin ink line recovers the cheek area. The exterior jaw and
    # the line where the hair meets the skin must never count as a smile.
    inside = ndimage.binary_closing(skin, iterations=3)
    y, x = np.indices(skin.shape)
    anchor = 175 if quarter else 242
    region = (
        (abs(y - center_y) < 18) & (abs(x - anchor) < 55)
        & (ndimage.distance_transform_edt(inside) > 1.5)
        & (ndimage.distance_transform_edt(~skin) < 4)
    )
    ink = region & (rgb.max(2) < 130) & (np.ptp(rgb.astype(float), axis=2) < 80)
    labels, _ = ndimage.label(ndimage.binary_dilation(ink), np.ones((3, 3)))
    found = []
    for i, (sy, sx) in enumerate(ndimage.find_objects(labels), 1):
        yy, xx = np.nonzero((labels[sy, sx] == i) & ink[sy, sx])
        if len(xx) and np.ptp(xx) > 8 and np.ptp(yy) < np.ptp(xx) * 0.75:
            found.append((np.ptp(xx), i))
    if found:
        return (labels == max(found)[1]) & ink


def visible_jaw(reference, actual, rows):
    """Near skin boundary below the ear, in eye-registered portrait pixels."""
    def left_edges(levels):
        skin = ndimage.binary_opening(levels == 2, iterations=2)
        edges = []
        for y in rows:
            indices = np.flatnonzero(skin[y])
            edges.append(int(indices[0]) if len(indices) >= 8 else None)
        return edges

    target, found = left_edges(reference), left_edges(actual)
    errors = [abs(x-y) if y is not None else 119 for x, y in zip(target, found)
              if x is not None]
    if len(errors) >= 4:
        return {"rows": rows.tolist(), "drawing": target, "render": found,
                "mean_error": round(float(np.mean(errors) / 119), 4)}


def smile_difference(reference, result):
    """Symmetric stroke distance in eye-to-crown units, including missed ends."""
    if reference is None:
        return None
    if result is None:
        return {"mean_distance": 1.0, "endpoint_error": 1.0}
    def extremes(mask):
        y, x = np.nonzero(mask)
        return np.array([[v, np.median(y[x == v])] for v in [x.min(), x.max()]])
    distance = (ndimage.distance_transform_edt(~reference)[result].mean()
                + ndimage.distance_transform_edt(~result)[reference].mean()) / 2
    endpoints = np.linalg.norm(extremes(reference) - extremes(result), axis=1)
    return {"mean_distance": round(float(distance / 119), 4),
            "endpoint_error": round(float(endpoints.max() / 119), 4)}


def forehead_edge(levels):
    """Visible hair/skin contact above the brows in an eye-registered portrait."""
    # Remove eyelashes, freckles and isolated pixels from the material masks.
    hair = ndimage.binary_opening(levels == 3, iterations=2)
    skin = ndimage.binary_opening(levels == 2)
    border = skin & ~ndimage.binary_erosion(skin)
    close = ndimage.distance_transform_edt(~hair) <= 5
    border &= close
    border[:22] = False
    border[112:] = False
    return border


def fringe_difference(drawing, native):
    return fringe_edge_distance(forehead_edge(drawing), forehead_edge(native))


def exposed_temple(drawing, rendered):
    """Compare both hair boundaries of a visible forehead in a side portrait."""
    def interval(row):
        # Registration puts the face on the right. The temple appears as skin
        # between the rear bob and a second run of hair over the brow.
        hair = np.flatnonzero(row == 3)
        runs = np.split(hair, np.flatnonzero(np.diff(hair) > 4) + 1)
        runs = [run for run in runs if len(run) >= 3]
        if len(runs) < 2:
            return None
        back, bang = runs[0], runs[-1]
        if len(back) < 11 or (row[back[-1] : bang[0]] == 2).sum() < 5:
            return None
        return np.array([back[-1], bang[0], bang[-1]])

    pairs = [(interval(a), interval(b)) for a, b in zip(drawing[26:112], rendered[26:112])]
    expected = [p for p in pairs if p[0] is not None]
    if len(expected) < 12:
        return None
    common = [abs(a - b) for a, b in expected if b is not None]
    return {
        "drawing_rows": len(expected),
        "matched_rows": len(common),
        "visible_fraction": round(len(common) / len(expected), 3),
        "p90_edge_error": round(float(np.percentile(common, 90) / 119), 4) if common else 1.0,
    }


def open_fringe_gap(levels, rgb):
    """Sustained daylight separating a forelock from the head in a registered oblique."""
    backdrop = np.max(abs(rgb.astype(float) - np.median(rgb[:4], axis=(0, 1))), axis=2) < 9
    solid = (levels > 0) & ~backdrop
    widths = []
    # The brow sits at row 125 and the top of the head at row 6.
    for row, pigments in zip(solid[24:117], levels[24:117]):
        xs = np.flatnonzero(row)
        runs = [r for r in np.split(xs, np.flatnonzero(np.diff(xs) > 1) + 1) if len(r) >= 2]
        gaps = [int(right[0] - left[-1] - 1) for left, right in zip(runs, runs[1:])
                if (pigments[left[-5:]] == 3).any() or (pigments[right[:5]] == 3).any()]
        widths.append(max(gaps, default=0))
    # Seven registered pixels span about six percent of the eye-to-crown height.
    wide = np.flatnonzero(np.asarray(widths) >= 7)
    spans = np.split(wide, np.flatnonzero(np.diff(wide) > 1) + 1)
    window = 12
    sustained_width = max(min(widths[i:i + window]) for i in range(len(widths) - window + 1))
    return {"max_width_px": max(widths), "sustained_rows": max(map(len, spans)),
            "sustained_width_px": sustained_width}


def forehead_gap(levels, rgb):
    """Largest upright patch of backdrop between the fringe and head on the registered grid."""
    solid = levels > 0
    x = np.arange(solid.shape[1])[None, :]
    left = solid.argmax(1)[:, None]
    right = solid.shape[1] - 1 - solid[:, ::-1].argmax(1)[:, None]
    # The foreground flood fill includes enclosed windows on opaque backgrounds.
    # Inspect the original colors as well as the exterior mask to recover them.
    background = np.max(abs(rgb.astype(float) - np.median(rgb[:4], axis=(0, 1))), axis=2) < 9
    inside = ((~solid) | background) & (x > left) & (x < right)
    inside[:23] = False
    inside[104:] = False
    labels, _ = ndimage.label(inside, np.ones((3, 3)))
    near_hair = ndimage.binary_dilation(levels == 3, structure=np.ones((1, 5)))
    largest = {"height_px": 0, "width_px": 0, "area_px": 0}
    for label, (ys, xs) in enumerate(ndimage.find_objects(labels), 1):
        height, width = ys.stop - ys.start, xs.stop - xs.start
        if height < 6 or width < 2 or width > height:
            continue
        patch = labels[ys, xs] == label
        area = int(patch.sum())
        if area < 12 or area <= largest["area_px"]:
            continue
        # At least half of the gap's rows must actually meet the hair.
        if (patch & near_hair[ys, xs]).any(axis=1).sum() >= height / 2:
            largest = {"height_px": height, "width_px": width, "area_px": area}
    return largest


def fringe_edge_distance(target, actual):
    if target.sum() < 16:
        return None
    if actual.sum() < 8:
        return {"mean_distance": 1.0, "p90_distance": 1.0}
    forward = ndimage.distance_transform_edt(~actual)[target]
    reverse = ndimage.distance_transform_edt(~target)[actual]
    return {
        "mean_distance": round(float((forward.mean() + reverse.mean()) / (2 * 119)), 4),
        "p90_distance": round(float(max(np.percentile(forward, 90), np.percentile(reverse, 90)) / 119), 4),
    }


def quarter_nose_difference(reference, native):
    """Compare bridge strokes after registering the eyes and crown."""
    if reference is None:
        return None
    if native is None:
        return {"status": "missing"}
    def direction(points):
        x, y = np.asarray(points).T
        return np.sign(x @ np.roll(y, 1) - y @ np.roll(x, 1))
    distances = np.linalg.norm(reference[:, None] - native[None, :], axis=2)
    mean = (distances.min(axis=0).mean() + distances.min(axis=1).mean()) / 2
    same = direction(reference) == direction(native)
    return {"status": "reversed" if not same else "offset" if mean / 119 > 0.075 else "matched",
            "mean_distance": round(float(mean / 119), 4)}


def compare_profile(guide, rendered, design, output, quarter=False):
    from .review import iou

    (target, guide_rgb), target_right, reference_scale, original = registered_profile(
        guide, design, quarter, "both"
    )
    (actual, native_rgb), native_right, native_scale, model = registered_profile(
        rendered, design, quarter, "both"
    )
    reference, result = target > 0, actual > 0
    sheet = Image.new("RGB", (960, 274), "#f7f4ef")
    pen = ImageDraw.Draw(sheet)
    palette = np.array(
        [
            [247, 244, 239],
            [240, 233, 218],
            ImageColor.getrgb(design["skin"]),
            ImageColor.getrgb(design["hair"]["color"]),
        ]
    ).astype("uint8")
    overlay = np.full((250, 320, 3), [247, 244, 239], dtype="uint8")
    overlay[reference & ~result] = [230, 117, 74]
    overlay[result & ~reference] = [46, 133, 161]
    overlay[reference & result] = [74, 65, 68]
    fit = design.get("fit", {}).get("sections", {})
    fringe = None
    overlay_title = "Silhouette overlap"
    if fit.get("nape"):
        drawn_edge, native_edge = forehead_edge(target), forehead_edge(actual)
        fringe = fringe_edge_distance(drawn_edge, native_edge)
        if fringe:
            drawn = ndimage.binary_dilation(drawn_edge)
            mesh = ndimage.binary_dilation(native_edge)
            overlay[drawn] = [251, 163, 98]
            overlay[mesh] = [104, 213, 245]
            overlay[drawn & mesh] = [251, 247, 231]
            overlay_title = "Hairline and silhouette (orange drawing, blue mesh)"
    for i, (data, title) in enumerate(
        [
            (palette[target], "Side guide"),
            (palette[actual], "Native profile"),
            (overlay, overlay_title),
        ]
    ):
        sheet.paste(Image.fromarray(data), (320 * i, 24))
        pen.text((320 * i + 8, 5), title, fill="#272722")
    sheet.save(output)
    measures = {
        "silhouette_iou": iou(reference, result),
        "skin_iou": iou(target == 2, actual == 2),
        "hair_iou": iou(target == 3, actual == 3),
    }
    if not quarter:
        temple = exposed_temple(target, actual)
        if temple is not None:
            measures["exposed_temple"] = temple
    if fringe:
        measures["fringe"] = fringe
    if fit.get("sidePart") and fit.get("nape"):
        drawn = forehead_gap(target, guide_rgb)
        found = forehead_gap(actual, native_rgb)
        measures["forehead_gap"] = {
            "drawing": drawn,
            "render": found,
            "introduced": found["height_px"] >= drawn["height_px"] + 6
            and found["area_px"] >= drawn["area_px"] + 12,
        }
    mouth, hair = fit.get("mouth"), fit.get("hair")
    if quarter and fit.get("nose") and hair:
        eye_y = 12 + design["head"][1] * design["face"]["eyeHeight"]
        units = 119 / max(1, eye_y - hair[0][0])
        tip_y = 125 + (max(y for _, y in fit["nose"]["stroke"]) - eye_y) * units
        def trace(rgb, eyes, scale):
            if len(eyes) != 2:
                return None
            tip_x = 175 + 0.32 * abs(eyes[1]["center"][0] - eyes[0]["center"][0]) * 119 / scale
            found = nose_stroke(rgb.astype(float), np.array(ImageColor.getrgb(design["skin"])),
                                125, (tip_x, tip_y), 125 + (12 + design["head"][1] - eye_y)*units,
                                design["head"][0]*units)
            return found[0] if found else None
        comparison = quarter_nose_difference(trace(guide_rgb, original, reference_scale),
                                             trace(native_rgb, model, native_scale))
        if comparison:
            measures["nose_ink"] = comparison
    if mouth and mouth["expression"] == "smile" and hair:
        eye = 12 + design["head"][1] * design["face"]["eyeHeight"]
        center_y = 125 + 119 * (np.median(np.array(mouth["rows"])[:, 1]) - eye) / max(1, eye - hair[0][0] + 1.8)
        delta = smile_difference(smile_ink(guide_rgb, target, center_y, quarter),
                                 smile_ink(native_rgb, actual, center_y, quarter))
        if delta:
            measures["smile"] = delta
    ear = fit.get("sideGuide", {}).get("ear")
    if quarter and hair and ear:
        eye = 12 + design["head"][1] * design["face"]["eyeHeight"]
        ratio = 119 / max(1, eye - hair[0][0] + 1.8)
        low = max(125, round(125 + (ear[1] + ear[3] - eye) * ratio) + 2)
        high = min(249, round(125 + (12 + 0.93 * design["head"][1] - eye) * ratio))
        if high - low >= 6:
            marks = visible_jaw(target, actual, np.linspace(low, high, 7).round().astype(int))
            if marks:
                measures["visible_jaw"] = marks
    # Both eyes can shrink together and still have the correct far/near ratio.
    # Express each opening in units of the distance from the eyes to the crown.
    if not quarter:
        expected_tip = profile_nose_tip(target)
        if expected_tip is not None:
            found_tip = profile_nose_tip(actual)
            measures["nose_tip"] = {"drawing": expected_tip, "render": found_tip}
            measures["nose_tip_error"] = (
                round(max(abs(a - b) for a, b in zip(expected_tip, found_tip)), 4)
                if found_tip is not None else 1.0
            )
    count = 2 if quarter else 1
    if len(original) >= count:

        def dimensions(eyes, scale):
            return [
                [round(float(value / scale), 3) for value in eye["size"]]
                for eye in sorted(eyes[:count], key=lambda e: -e["size"][0])
            ]

        expected = dimensions(original, reference_scale)
        found = dimensions(model, native_scale)
        measures["eye_dimensions"] = {"drawing": expected, "render": found}
        if fit.get("eyes") and any(eye.get("rimInk") for eye in fit["eyes"]):
            def coverage(eyes):
                return [eye["ink_coverage"] for eye in sorted(eyes[:count], key=lambda e: -e["size"][0])]
            drawn, native = coverage(original), coverage(model)
            if len(native) == count and None not in drawn + native:
                measures["eye_ink_coverage"] = {"drawing": drawn, "render": native}
                measures["eye_ink_shortfall"] = round(max(0, *np.subtract(drawn, native)), 3)
        measures["eye_size_error"] = (
            round(float(np.max(np.abs(np.array(found) / expected - 1))), 3)
            if len(found) == count
            else 1.0
        )
    if quarter and len(original) == 2:

        def ratio(pair):
            if len(pair) != 2:
                return 0.0
            widths = sorted(e["size"][0] for e in pair)
            return widths[0] / widths[1]

        measures["eye_width_ratio"] = {
            "drawing": round(ratio(original), 3),
            "render": round(ratio(model), 3),
        }
        measures["eye_width_error"] = round(abs(ratio(original) - ratio(model)), 3)
        def pupil_positions(pair, mirror=False):
            ordered = sorted(pair, key=lambda e: e["center"][0], reverse=mirror)
            return [
                round(1 - e["pupil"][0] if mirror else e["pupil"][0], 4)
                if e["pupil"] else None
                for e in ordered
            ]

        expected = pupil_positions(original)
        if all(pos is not None for pos in expected):
            found = pupil_positions(model, target_right != native_right)
            measures["pupil_x"] = {"drawing": expected, "render": found}
            measures["pupil_x_error"] = round(
                max(abs(a - b) if b is not None else 1 for a, b in zip(expected, found)),
                3,
            )
    elif not quarter and original and original[0]["pupil"]:
        actual = model[0]["pupil"] if model else None
        target = original[0]["pupil"][0]
        measures["pupil_x"] = {
            "drawing": target,
            "render": actual[0] if actual else None,
        }
        measures["pupil_x_error"] = (
            round(
                abs(
                    (actual[0] if target_right == native_right else 1 - actual[0])
                    - target
                ),
                3,
            )
            if actual
            else 1.0
        )
    return measures
