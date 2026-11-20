"""Recover the shoulder, armpit, neckline and torso of a sleeved cartoon shirt."""

import numpy as np


def fit_shirt_cut(rgb, mask, cx, crown, scale, body, fabric, skin, style):
    if style not in ("crew", "polo"):
        return None
    sections = body["sections"]
    arm = sections["arm"]
    shoulder = body["shoulder"]
    cuff = sections["sleeve"]
    station = next((row for row in arm if 1.28 * shoulder <= row[0] <= cuff), None)
    if station is None or not 5 <= station[0] <= 195:
        return None
    xs = (np.arange(mask.shape[1]) - cx) * scale
    ys = (np.arange(mask.shape[0]) - crown) * scale + 12
    # Work on the clothing window. Paper, skin and cloth must be distinguishable.
    cols = np.flatnonzero(abs(xs) < max(station[0] + 4, shoulder * 1.85))
    rows = np.flatnonzero((ys > body["neckline"] - shoulder) & (ys < body["hem"] + 10))
    if len(cols) < 16 or len(rows) < 25:
        return None
    patch = rgb[np.ix_(rows, cols)]
    paper = np.median(np.vstack((rgb[0], rgb[-1])), axis=0)
    if min(np.linalg.norm(fabric - p) for p in (skin, paper)) < 58:
        return None
    cloth = np.linalg.norm(patch - fabric, axis=2)
    flesh = np.linalg.norm(patch - skin, axis=2)
    dyed = mask[np.ix_(rows, cols)] & (cloth < 52) & (cloth + 18 < flesh)
    x, y = xs[cols], ys[rows]
    arm_y, radius = station[1:]
    # Both shoulders must carry fabric continuously from the shoulder to
    # the sleeve station. Reject an interrupted or obscured construction.
    shoulders = []
    for sign in (-1, 1):
        knots = []
        for u in np.linspace(0.86 * shoulder, station[0], 8):
            col = np.argmin(abs(x - sign * u))
            hits = np.flatnonzero(dyed[:, col] & (abs(y - arm_y) <= 1.6 * radius))
            if len(hits) < max(4, radius / scale):
                return None
            knots.append(y[hits[0]] - scale)
        shoulders.append(knots)
    if np.max(abs(np.subtract(*shoulders))) > 0.46 * radius:
        return None
    cut = {
        "station": station[0],
        "shoulderTop": round(float(np.median(np.array(shoulders)[:, :3])), 2),
    }
    if (
        not 15 <= cut["shoulderTop"] <= 500
        or abs(cut["shoulderTop"] - (arm_y - radius)) > radius
    ):
        return None
    neck = body["neckline"]
    if style == "crew":
        if "crew" not in sections:
            return None
    else:
        opening = collar_opening(
            x, y, dyed, flesh, cloth, shoulder, neck, body["hem"], arm_y, radius, scale
        )
        if opening is None:
            return None
        cut["opening"] = opening
        wings = collar_wings(
            patch, x, y, cut["opening"], fabric, shoulder, cut["shoulderTop"]
        )
        if wings:
            cut["wings"] = wings

    # The last shirt section below the arms can end at a split hem. Continue
    # its side seams from immediately above that split rather than measuring
    # the trouser opening as a narrower shirt.
    join = arm_y + radius
    hem = body["hem"]
    anchors = []
    for level in np.arange(join + 2 * scale, hem - 0.07 * (hem - neck), 2.5 * scale):
        row = np.argmin(abs(y - level))
        hits = np.flatnonzero(dyed[row] & (abs(x) < shoulder * 1.65))
        if len(hits) < 0.7 * shoulder / scale:
            continue
        left, right = x[hits[[0, -1]]]
        if not left < -shoulder * 0.4 < shoulder * 0.4 < right:
            continue
        # The cloth dye stops inside the ink stroke. Include the connected
        # visible outline up to its transition to local paper.
        outside = mask[rows[row], cols] & (abs(patch[row] - paper).max(1) > 19)
        limits = []
        for edge, sign in ((hits[0], -1), (hits[-1], 1)):
            stop = edge
            while (
                0 <= stop + sign < len(x)
                and outside[stop + sign]
                and abs(x[stop + sign] - x[edge]) < 0.14 * shoulder
            ):
                stop += sign
            limits.append(x[stop] + sign * scale * 0.5)
        anchors.append([y[row], *limits])
    if len(anchors) < 8:
        return None
    a = np.array(anchors)
    centers = []
    widths = []
    for row in sections["torso"]:
        level = row[0]
        q = np.clip(level, a[0, 0], a[-1, 0])
        edges = [np.interp(q, a[:, 0], a[:, i]) for i in (1, 2)]
        if level > q:
            # Extrapolate the measured lower side seam to the hem.
            prev = np.maximum(a[0, 0], q - (hem - neck) * 0.12)
            for i in range(2):
                slope = (edges[i] - np.interp(prev, a[:, 0], a[:, i + 1])) / (q - prev)
                edges[i] += (level - q) * np.clip(slope, -0.85, 0.85)
        width = (
            round((edges[1] - edges[0]) / 2, 2) if level > join - 2 * scale else row[1]
        )
        center = round((edges[1] + edges[0]) / 2, 2)
        if not 1 <= width <= 150 or abs(center) > 42:
            return None
        widths.append(width)
        centers.append(center)
    for row, width in zip(sections["torso"], widths):
        row[1] = width
    cut["centers"] = centers
    return cut


def collar_opening(x, y, dyed, flesh, cloth, shoulder, neck, hem, arm_y, radius, scale):
    # The two sides of the neck and the point of the V are observations
    # on the *same* connected skin region. Buttons and hair outside it
    # cannot lengthen the opening.
    from scipy import ndimage

    skin_pixels = (flesh < 68) & (flesh + 25 < cloth) & (abs(x) < shoulder * 0.75)
    labeled, _ = ndimage.label(skin_pixels)
    labels, counts = np.unique(
        labeled[
            (abs(y - neck) < radius * 0.55)[:, None]
            & (abs(x) < shoulder * 0.24)[None, :]
        ],
        return_counts=True,
    )
    inside = labels > 0
    if not inside.any():
        return None
    area = labeled == labels[inside][np.argmax(counts[inside])]
    # First row on which cloth borders the skin on *both* sides.
    first = last = None
    boundary = []
    for row in np.flatnonzero(abs(y - arm_y) < 2.35 * radius):
        border = np.flatnonzero(area[row])
        if not len(border):
            continue
        left, right = border[[0, -1]]
        lined = [
            np.any(
                dyed[row]
                & (side * (x - x[i]) > 0)
                & (side * (x - x[i]) < shoulder * 0.43)
            )
            for side, i in [(-1, left), (1, right)]
        ]
        if all(lined):
            if first is None and x[right] - x[left] >= 0.38 * shoulder:
                first = [x[left] - scale / 2, x[right] + scale / 2, y[row]]
            if first is not None:
                boundary.append([y[row], x[left] - scale / 2, x[right] + scale / 2])
            last = [np.mean(x[border]), y[row] + scale / 2]
    if (
        first is None
        or last is None
        or not 0.12 < (last[1] - first[2]) / (hem - neck) < 0.45
    ):
        return None
    if not first[0] < last[0] < first[1]:
        return None
    trace = np.array(boundary)
    levels = np.linspace(first[2], last[1], 7)
    sides = [np.interp(levels, trace[:, 0], trace[:, i]) for i in [1, 2]]
    sides[0][-1] = sides[1][-1] = last[0]
    opening = np.round(np.column_stack((levels, *sides)), 2)
    if (
        np.any(opening[:-1, 1] >= opening[:-1, 2])
        or levels[0] < 15
        or levels[-1] > 530
        or np.any((opening[:, 1] < -55) | (opening[:, 1] > 48))
        or np.any((opening[:, 2] < -48) | (opening[:, 2] > 55))
    ):
        return None
    return opening.tolist()


def collar_wings(patch, x, y, opening, fabric, shoulder, shoulder_top):
    """Trace the outer point and the returning fold of a turned-down collar."""
    luma = patch @ [0.2126, 0.7152, 0.0722]
    dye = fabric @ [0.2126, 0.7152, 0.0722]
    ink = luma < dye * 0.73
    levels, left, right = np.asarray(opening).T
    top, tip = levels[[0, -1]]
    drop = tip - top
    paths = []
    for sign, edge in ((-1, left), (1, right)):
        root = edge[0]
        reach = sign * (x - root)
        # Below the shoulder there is dyed fabric outside the lapel. Isolate
        # the crease from the neckline itself and from the shoulder outline.
        hits = ink & (reach > 0.12 * shoulder) & (reach < 0.86 * shoulder)
        yy, xx = np.nonzero(
            hits
            & (y[:, None] > shoulder_top + 0.13 * drop)
            & (y[:, None] < tip - 0.22 * drop)
        )
        if not len(xx):
            return None
        far = np.max(reach[xx])
        at = yy[reach[xx] > far - 1.75]
        outer = [root + sign * far, np.max(y[at])]
        if far < 0.29 * shoulder:
            return None

        xs = np.flatnonzero((reach >= far * 0.26) & (reach <= far * 0.80))
        folded = []
        for i in xs:
            interior = np.flatnonzero(
                ink[:, i]
                & (y > shoulder_top + 0.11 * drop)
                & (y < outer[1] + 0.12 * drop)
                & (sign * (x[i] - np.interp(y, levels, edge)) > 2)
            )
            if len(interior):
                folded.append([x[i], y[interior[0]], y[interior[-1]]])
        if len(folded) < 3:
            return None
        f = np.array(folded)
        notch = f[np.argmin(f[:, 1] + 0.025 * abs(f[:, 0] - root))]
        tail = f[np.argmax(f[:, 2] - 0.10 * abs(f[:, 0] - notch[0]))]
        if outer[1] - notch[1] < 0.075 * drop or tail[2] - notch[1] < 0.075 * drop:
            return None
        # Where the rising outside edge meets the shirt's shoulder line.
        cross = (
            ink[(abs(y - shoulder_top)).argmin()] & (reach > 0.25 * far) & (reach < far)
        )
        # The paper boundary of the shoulder also crosses this scan. The
        # lapel itself meets it from the neckward side.
        elbow = root + sign * (min(reach[cross]) if cross.any() else 0.69 * far)
        paths.append(
            np.round(
                [
                    [root, top],
                    [elbow, shoulder_top],
                    outer,
                    notch[:2],
                    [tail[0], tail[2]],
                ],
                2,
            ).tolist()
        )
    points = np.array(paths)
    if (
        np.max(abs(points[:, :, 0])) > 100
        or points[:, :, 1].min() < 15
        or points[:, :, 1].max() > 530
    ):
        return None
    return paths


def registered_shirt(reference, native, design):
    """Register visible cloth and exposed throat to full standing height."""
    from .fit import pixels

    body = design["household"]["body"]
    sections = body["sections"]
    cut = sections.get("shirtCut")
    if not cut:
        return None
    arm = next(row for row in sections["arm"] if row[0] == cut["station"])
    neck, hem = body["neckline"], body["hem"]
    # Use the same fixed figure registration for both images. The waist
    # window avoids the sleeve and hem. The neck window includes the collar.
    v, u = np.mgrid[round(neck - 30) : round(hem + 2) : 0.8, -105:105:0.8]
    underarm = arm[1] + arm[2]
    waist = (v >= underarm + 3) & (v <= hem - 0.07 * (hem - neck))
    throat = (abs(u) < body["shoulder"] * 0.7) & (v > neck - 24) & (v <= underarm + 4)
    palette = [
        np.array(list(bytes.fromhex(c[1:])))
        for c in (
            design["outfit"]["color"],
            design["skin"],
            design["outfit"]["trousers"],
        )
    ]
    mattes = []
    for path in (reference, native):
        rgb, mask = pixels(path, keep_components=True)
        y, x = np.where(mask)
        unit = np.ptp(y) / (design["height"] - 12)
        ix = (
            np.rint((x.min() + x.max()) / 2 + u * unit)
            .astype(int)
            .clip(0, mask.shape[1] - 1)
        )
        iy = np.rint(y.min() + (v - 12) * unit).astype(int).clip(0, mask.shape[0] - 1)
        paper = np.median(np.vstack((rgb[0], rgb[-1])), axis=0)
        distances = np.stack(
            [np.linalg.norm(rgb[iy, ix] - color, axis=2) for color in (*palette, paper)]
        )
        pigment = np.argmin(distances, axis=0)
        mattes.append(
            [
                (pigment == i) & mask[iy, ix] & region & (distances[i] < 100)
                for i, region in enumerate((waist, throat))
            ]
        )
    return mattes, v[:, 0], u[0]


def compare_shirt_cut(reference, native, design):
    registered = registered_shirt(reference, native, design)
    if registered is None:
        return None
    mattes, _, _ = registered
    return {
        label: round(float((a & b).sum() / max(1, (a | b).sum())), 4)
        for label, (a, b) in zip(("torso_cloth_iou", "neck_skin_iou"), zip(*mattes))
    }


def shirt_side_offset(reference, native, design):
    """Measure the two side seams independently after the first native draw."""
    registered = registered_shirt(reference, native, design)
    if registered is None:
        return None
    mattes, _, x = registered
    edges = []
    for shirt, _ in mattes:
        levels = []
        for row in shirt:
            hits = np.flatnonzero(row)
            levels.append(x[hits[[0, -1]]] if len(hits) > 12 else [np.nan, np.nan])
        edges.append(np.array(levels))
    delta = edges[0] - edges[1]
    valid = np.all(np.isfinite(delta), axis=1)
    if valid.sum() < 12:
        return None
    shift = np.median(delta[valid], axis=0)
    # Avoid expanding a loose sleeve or a split hem into the torso itself.
    if np.max(np.median(abs(delta[valid] - shift), axis=0)) > 3.8:
        return None
    return (
        np.round(np.clip(shift, -7, 7), 2).tolist()
        if np.max(abs(shift)) >= 0.8
        else None
    )
