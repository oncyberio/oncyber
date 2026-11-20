"""Propose editable cartoon observations directly from an isolated front T-pose."""

import numpy as np
from PIL import Image
from scipy import ndimage

from .eyes import portrait_eyes
from .fit import bounds, pixels
from .guide import head_region, suggested_landmarks
from .tracing import painted_open_mouth, radial_crown, scalp_pigment


def interior_swatch(rgb, mask, box):
    """Pick a real interior pixel from the dominant pigment in a bounded region."""
    left, top, right, bottom = box
    h, w = mask.shape
    x0, y0 = max(0, int(left)), max(0, int(top))
    x1, y1 = min(w, int(np.ceil(right))), min(h, int(np.ceil(bottom)))
    region = mask[y0:y1, x0:x1]
    y, x = np.nonzero(region)
    if not len(x):
        raise ValueError("A proposed pigment region falls outside the figure")
    patch = rgb[y0:y1, x0:x1]
    color = patch[y, x]
    bins = (color // 24).astype(int)
    codes = bins @ [121, 11, 1]
    popular = np.bincount(codes).argmax()
    pigment = np.median(color[codes == popular], axis=0)
    similar = region & (np.linalg.norm(patch - pigment, axis=2) < 31)
    depth = ndimage.distance_transform_edt(np.pad(similar, 1))[1:-1, 1:-1]
    row, col = np.unravel_index(depth.argmax(), depth.shape)
    return int(x0 + col), int(y0 + row)


def face_marks(rgb, skin, eyes, cheeks, chin):
    """Locate the mouth seam and the lowest nose contour inside the exposed face."""
    x0, x1 = cheeks
    face_width = x1 - x0
    ey = np.mean(eyes, axis=0)[1]
    cx = (x0 + x1) / 2
    gap = chin - ey
    left = max(0, int(x0 + 0.13 * face_width))
    right = min(rgb.shape[1], int(x1 - 0.13 * face_width))
    top = max(0, round(ey + gap * 0.15))
    bottom = min(rgb.shape[0], round(chin - gap * 0.12))
    if right - left < 8 or bottom - top < 8:
        raise ValueError("The visible face is too small for a first draft")
    patch = rgb[top:bottom, left:right]
    luma = patch @ [0.2126, 0.7152, 0.0722]
    skin_luma = skin @ [0.2126, 0.7152, 0.0722]
    # Reject large fields of hair and shadow while preserving the tip of a
    # hooked nose and the long thin stroke of a crooked smile.
    window = max(3, round(face_width * 0.054))
    background = ndimage.grey_closing(luma, size=(window, window))
    ink = (background - luma > max(18, skin_luma * 0.22)) & (luma < skin_luma * 0.7)
    white = (patch.min(axis=2) > 180) & (np.ptp(patch, axis=2) < 44)
    ink &= ~ndimage.binary_dilation(white, iterations=max(2, round(face_width * 0.029)))
    components, _ = ndimage.label(ink, structure=np.ones((3, 3)))
    mouths, noses = [], []
    for i, box in enumerate(ndimage.find_objects(components), 1):
        ys, xs = box
        y, x = np.nonzero(components[box] == i)
        x = x + xs.start + left
        y = y + ys.start + top
        width = np.ptp(x) + 1
        if width < 2:
            continue
        middle = np.median(y)
        position = (middle - ey) / gap
        middle_x = (x.max() + x.min()) / 2
        if (
            0.16 < width / face_width < 0.69
            and 0.36 < position < 0.86
            and np.ptp(y) < width * 0.57
            and abs(middle_x - cx) < face_width * 0.23
        ):
            rank = width / (
                1 + 4 * abs(position - 0.65) + 2 * abs(middle_x - cx) / face_width
            )
            ends = [
                (int(q), float(np.median(y[np.abs(x - q) <= 1])))
                for q in [x.min(), x.max()]
            ]
            mouths.append((rank, ends, middle))
        if (
            0.052 < width / face_width < 0.48
            and 0.11 < position < 0.62
            and abs(middle_x - cx) < face_width * 0.28
        ):
            tip_y = y.max()
            tip = (float(np.median(x[y >= tip_y - 1])), float(tip_y))
            noses.append((width / (1 + 5 * abs(position - 0.38)), tip))
    if mouths:
        _, mouth, my = max(mouths, key=lambda m: m[0])
    else:
        my = ey + gap * 0.66
        mouth = [(cx - face_width * 0.14, my), (cx + face_width * 0.14, my)]
    noses = [n for n in noses if n[1][1] < my - gap * 0.025]
    nose = max(noses, key=lambda n: n[0])[1] if noses else (cx, ey + gap * 0.39)
    expression = (
        "smile" if mouths and my > np.mean([p[1] for p in mouth]) + 1 else "neutral"
    )
    return mouth, nose, expression


def wrist_position(mask, shoulder_x, shoulder_y, right, height):
    """Find the narrowing of the forearm immediately before the palm."""
    reach = right - shoulder_x
    start = max(0, int(shoulder_x + reach * 0.52))
    band = max(4, round(height * 0.065))
    thickness = mask[
        max(0, shoulder_y - band) : shoulder_y + band + 1, start:right
    ].sum(axis=0)
    thickness = ndimage.median_filter(thickness, size=max(3, round(reach * 0.015)) | 1)
    step = max(2, round(reach * 0.055))
    troughs = []
    for i in range(step, len(thickness) - step):
        x = start + i
        if not shoulder_x + reach * 0.62 < x < shoulder_x + reach * 0.90:
            continue
        rise = thickness[i + 1 : i + step + 1].max() - thickness[i]
        fall = thickness[i - step : i].max() - thickness[i]
        if min(rise, fall) > max(1, thickness[i] * 0.036):
            troughs.append((min(rise, fall) / (thickness[i] + 1), x))
    wrist = max(troughs)[1] if troughs else right - reach * 0.22
    if wrist > shoulder_x + 0.84 * reach:
        # A raised thumb creates a second trough between the thumb and
        # fingers. Trace the *first* sustained widening from the bare forearm.
        def at(fraction):
            return max(0, round(shoulder_x + fraction * reach) - start)

        forearm = thickness[at(0.55) : at(0.67)]
        palm = thickness[at(0.67) : round(wrist) - start]
        if len(forearm) and len(palm):
            forearm_width = np.median(forearm)
            wide = np.flatnonzero(palm > forearm_width * 1.25)
            for run in np.split(wide, np.flatnonzero(np.diff(wide) > 1) + 1):
                if len(run) < 0.055 * reach or np.max(palm[run]) < forearm_width * 1.48:
                    continue
                narrow = np.flatnonzero(palm[: run[0]] < forearm_width * 1.07)
                if len(narrow):
                    return start + at(0.67) + narrow[-1]
    return wrist


def trouser_landmarks(rgb, mask, top, bottom, arm_bottom, eyes):
    h, w = mask.shape
    x = np.arange(w)
    eye_x = eyes[:, 0].mean()
    eye_span = eyes[1, 0] - eyes[0, 0]
    height = bottom - top
    leg_y = round(top + height * 0.79)
    leg_x = np.flatnonzero(mask[leg_y] & (np.arange(w) > eye_x))
    if len(leg_x) < 3:
        raise ValueError("Could not locate the screen-right trouser leg")
    leg_cx = np.median(leg_x)
    swatch = interior_swatch(
        rgb,
        mask,
        (leg_x.min(), leg_y - height * 0.06, leg_x.max() + 1, leg_y + height * 0.06),
    )
    sx, sy = swatch
    pants = rgb[sy, sx]
    pant_mask = mask & (np.linalg.norm(rgb - pants, axis=2) < 53)
    leg_column = abs(x - leg_cx) < max(3, len(leg_x) * 0.24)
    support = np.sum(pant_mask & leg_column, axis=1) / max(1, leg_column.sum())
    runs = np.flatnonzero(support > 0.47)
    trouser = next(
        (
            r
            for r in np.split(
                runs, np.flatnonzero(np.diff(runs) > max(3, height * 0.014)) + 1
            )
            if len(r) and r[0] <= leg_y <= r[-1]
        ),
        None,
    )
    if trouser is None:
        raise ValueError("Could not trace a continuous trouser leg")
    ankle_y = min(bottom - 2, trouser[-1] + 1)
    # Find the hem at the belly, where a curved shirttail can hang below the hips.
    center_rows = np.flatnonzero(
        ((pant_mask & (abs(x - eye_x) < eye_span * 0.5)).sum(axis=1) > eye_span * 0.18)
        & (np.arange(h) > max(arm_bottom, trouser[0] - height * 0.06))
    )
    hem_y = (
        int(center_rows[0])
        if len(center_rows) and center_rows[0] < leg_y
        else int(trouser[0])
    )
    if not arm_bottom < hem_y < ankle_y < bottom:
        raise ValueError("Could not separate the shirt, trousers and shoes")
    return swatch, (leg_cx, ankle_y), hem_y


def shirt_bands(rgb, shirt, cx, torso_w, shoulder_y, hem_y, point):
    h, w = rgb.shape[:2]
    bands = []
    midcols = (np.arange(w) > cx - torso_w * 0.26) & (
        np.arange(w) < cx + torso_w * 0.26
    )
    color_rows = np.median(rgb[:, midcols], axis=1)
    across = (np.arange(w) - cx) / max(1, torso_w)
    flanks = [(sign * across > 0.23) & (sign * across < 0.39) for sign in (-1, 1)]
    offset = (
        (np.linalg.norm(color_rows - shirt, axis=1) > 61)
        & (np.arange(h) > shoulder_y)
        & (np.arange(h) < hem_y - 2)
    )
    indices = np.flatnonzero(offset)
    for run in np.split(indices, np.flatnonzero(np.diff(indices) > 1) + 1):
        if (
            len(run) < max(2, (hem_y - shoulder_y) * 0.014)
            or len(run) > (hem_y - shoulder_y) * 0.72
        ):
            continue
        middle = run[len(run) // 2]
        # Bands wrap around the trunk. A broad emblem can occupy the
        # middle of many scanlines while leaving both flanks unpainted.
        probes = run[(np.linspace(0.2, 0.8, 3) * (len(run) - 1)).round().astype(int)]
        similar = np.linalg.norm(rgb[probes] - color_rows[probes, None], axis=2) < 38
        if any(not flank.any() or np.median(similar[:, flank].mean(axis=1)) < 0.64 for flank in flanks):
            continue
        bands.append(
            {
                "sample": point((cx, middle)),
                "topY": point((cx, run[0]))["y"],
                "bottomY": point((cx, run[-1]))["y"],
            }
        )
    if len(bands) > 3:
        bands = []
    return bands


def long_outer_layer(rgb, mask, cx, torso_width, arm_top, arm_bottom, hem, ankle, shirt, skin):
    """Detect matching sleeves and two contrasting panels extending below a shirt."""
    sleeves = []
    for side in (-1, 1):
        x0, x1 = sorted(round(cx + side * t * torso_width) for t in (0.73, 1.08))
        x0, x1 = max(0, x0), min(mask.shape[1], x1)
        samples = rgb[arm_top:arm_bottom + 1, x0:x1][mask[arm_top:arm_bottom + 1, x0:x1]]
        if len(samples) < 5:
            return False
        sleeves.append(np.median(samples, axis=0))
    paint = np.mean(sleeves, axis=0)
    if (np.linalg.norm(sleeves[0] - sleeves[1]) > 30
            or min(np.linalg.norm(paint - other) for other in (shirt, skin)) < 46):
        return False
    x = np.arange(mask.shape[1]) - cx
    def both_panels(y):
        cloth = mask[y] & (np.linalg.norm(rgb[y] - paint, axis=1) < 40)
        if y < hem and np.mean(cloth[abs(x) < torso_width * 0.1]) > 0.2:
            return False
        for side in (-1, 1):
            inner = np.flatnonzero(mask[y] & ~cloth & (side * x > 0) & (side * x < torso_width * 0.61))
            if len(inner) < 3:
                return False
            outside = max(torso_width * 0.18, np.median(side * x[inner]))
            if (cloth & (side * x > outside)).sum() < max(2, torso_width * 0.035):
                return False
        return True
    chest = np.linspace(arm_bottom, hem, 6)[1:-1].round().astype(int)
    thigh = np.linspace(hem + 0.07 * (ankle - hem), hem + 0.30 * (ankle - hem), 4).round().astype(int)
    return sum(both_panels(y) for y in chest) >= 3 and sum(both_panels(y) for y in thigh) >= 3


def propose(path, name):
    rgb, mask = pixels(path)
    # Keep the acquisition pass bounded on very large source sheets. The
    # existing compiler subsequently traces each corrected feature at full resolution.
    if max(mask.shape) > 760:
        pic = Image.fromarray(rgb.astype("uint8"))
        pic.thumbnail((760, 760), Image.Resampling.LANCZOS)
        mask = np.asarray(
            Image.fromarray(mask).resize(pic.size, Image.Resampling.NEAREST)
        )
        rgb = np.asarray(pic, dtype=float)
    h, w = mask.shape
    left, top, right, bottom = bounds(mask)
    height = bottom - top
    y, x = np.indices(mask.shape)
    spans = mask.sum(axis=1)
    rows = np.flatnonzero(spans > (right - left) * 0.62)
    if not len(rows):
        raise ValueError("Could not locate extended arms in the T-pose")
    arm_group = max(np.split(rows, np.flatnonzero(np.diff(rows) > 1) + 1), key=len)
    shoulder_y = round(float(np.median(arm_group)))
    arm_top, arm_bottom = arm_group[0], arm_group[-1]
    if not 0.10 < (shoulder_y - top) / height < 0.58:
        raise ValueError("The drawing needs one upright character with extended arms")
    box = head_region(mask)
    eyes = suggested_landmarks(rgb, mask, box)
    if len(eyes) != 2:
        raise ValueError("Two visible eye openings are needed for automatic landmarks")
    eyes = np.array(eyes)
    eye_x, eye_y = eyes.mean(axis=0)
    eye_span = eyes[1, 0] - eyes[0, 0]
    head_h = arm_top - top
    samples = {}

    def sample(role, region, extra=None):
        samples[role] = interior_swatch(
            rgb, mask if extra is None else mask & extra, region
        )
        col, row = samples[role]
        return rgb[row, col]

    samples["trousers"], (leg_cx, ankle_y), hem_y = trouser_landmarks(
        rgb, mask, top, bottom, arm_bottom, eyes
    )
    sample("shoes", (left, ankle_y, right, bottom))
    torso_x = np.flatnonzero(mask[round((arm_bottom + hem_y) * 0.5)])
    if len(torso_x) < 4:
        raise ValueError("Could not find the torso below the sleeves")
    torso_left, torso_right = torso_x[0], torso_x[-1]
    cx = (torso_left + torso_right) / 2
    torso_w = torso_right - torso_left
    shoulder_x = cx + torso_w * 0.47
    shirt = sample(
        "shirt",
        (cx - torso_w * 0.32, arm_top, cx + torso_w * 0.32, hem_y - height * 0.013),
    )
    skin = sample(
        "skin",
        (
            eye_x - eye_span * 0.28,
            eye_y + head_h * 0.075,
            eye_x + eye_span * 0.34,
            eye_y + head_h * 0.31,
        ),
    )

    def face_region(pigment):
        distance = np.linalg.norm(rgb - pigment, axis=2)
        region = mask & (distance < 54)
        if np.linalg.norm(pigment - shirt) > 16:
            region &= (y < arm_top - head_h * 0.17) | (
                distance + 4 < np.linalg.norm(rgb - shirt, axis=2)
            )
        return region

    skin_region = face_region(skin)
    # Across the upper cheeks include the whites but trim protruding ears.
    cheek_row = round(eye_y + 0.12 * (arm_top - eye_y))
    window = np.s_[
        max(top, round(eye_y - head_h * 0.17)) : cheek_row + 1, box[0] : box[2]
    ]
    _, ix = np.nonzero(skin_region[window])
    red_shadow = skin[0] - skin[1] > 38 and skin[1] < 78
    if len(ix) < 12 or red_shadow:
        # A broad smile can fill the center sample with the mouth's dark
        # interior. Look for the same pigment below both eye openings.
        cheeks = [
            interior_swatch(
                rgb,
                mask,
                (
                    ex - eye_span * 0.14,
                    ey + head_h * 0.09,
                    ex + eye_span * 0.14,
                    ey + head_h * 0.21,
                ),
            )
            for ex, ey in eyes
        ]
        pigments = [rgb[py, px] for px, py in cheeks]
        if np.linalg.norm(pigments[0] - pigments[1]) < 50:
            samples["skin"] = cheeks[0]
            skin = pigments[0]
            skin_region = face_region(skin)
            _, ix = np.nonzero(skin_region[window])
    if len(ix) < 12:
        raise ValueError("Could not measure the exposed face")
    cheek_l, cheek_r = np.percentile(ix, [1, 99]) + box[0]
    face_w = cheek_r - cheek_l
    if face_w < eye_span * 1.32:
        cheek_l = min(cheek_l, eyes[0, 0] - eye_span * 0.42)
        cheek_r = max(cheek_r, eyes[1, 0] + eye_span * 0.42)
        face_w = cheek_r - cheek_l
    view = Image.fromarray(rgb.astype("uint8"))
    apertures = portrait_eyes(view, eyes)
    if all(apertures):
        # Leave room for the outer white on a three-quarter drawing even when
        # hair hides most of the skin at that temple.
        cheek_l = min(
            cheek_l, eyes[0, 0] - apertures[0]["size"][0] / 2 - eye_span * 0.04
        )
        cheek_r = max(
            cheek_r, eyes[1, 0] + apertures[1]["size"][0] / 2 + eye_span * 0.04
        )
        face_w = cheek_r - cheek_l
    face_x = (cheek_l + cheek_r) / 2
    throat_columns = abs(x - face_x) < face_w * 0.58
    throat = skin_region & throat_columns
    # A mouth full of teeth can remove most of the skin on a row while both
    # cheeks remain visible. Locate the neck from the outside of those cheeks.
    skin_width = np.where(throat.any(1), w - throat[:, ::-1].argmax(1) - throat.argmax(1), 0)
    start = round(eye_y + (arm_top - eye_y) * 0.45)
    # An open mouth can fill the entire narrow part of the chin. Its dark
    # red paint belongs above the jaw, even where the cheeks disappear.
    jaw_luma = rgb @ [0.2126, 0.7152, 0.0722]
    skin_luma = skin @ [0.2126, 0.7152, 0.0722]
    cavity = (
        (abs(x - face_x) < face_w * 0.3)
        & (rgb[:, :, 0] - rgb[:, :, 1] > skin[0] - skin[1] + 24)
        & (jaw_luma < skin_luma * 0.68)
        & mask
    )
    painted_rows = np.flatnonzero(
        (cavity.sum(axis=1) > face_w * 0.19)
        & (np.arange(h) >= start)
        & (np.arange(h) < arm_top - head_h * 0.08)
    )
    if len(painted_rows):
        start = max(start, painted_rows[-1] + 2)
    neck_rows = np.flatnonzero(
        (np.arange(h) >= start)
        & (np.arange(h) <= shoulder_y)
        & (skin_width < face_w * 0.36)
    )
    chin = float(neck_rows[0]) if len(neck_rows) else eye_y + (arm_top - eye_y) * 0.82
    chin = np.clip(chin, eye_y + eye_span * 0.67, arm_top - 2)
    # The jaw ink crosses the neck before the neck pigment meets the shirt.
    jaw_zone = abs(x - face_x) < face_w * 0.14
    dark = (jaw_luma < skin @ [0.2126, 0.7152, 0.0722] * 0.46) & mask
    chin_band = np.arange(
        max(start, round(chin - head_h * 0.09)),
        min(arm_top, round(chin + head_h * 0.08)),
    )
    if len(chin_band):
        vote = (dark & jaw_zone).sum(axis=1)[chin_band]
        if vote.max() > face_w * 0.06:
            chin = chin_band[vote.argmax()]
    # A wide neck over an open collar can run into the shirt before the skin
    # narrows. Do not use the shoulders below it as part of the skull's hull.
    row = round(chin)
    sides = x[row] - face_x
    cloth = np.linalg.norm(rgb[row] - shirt, axis=1) < 44
    if all(
        np.any(cloth & mask[row] & (side * sides > face_w * 0.78)) for side in (-1, 1)
    ):
        zone = abs(sides) < face_w * 0.24
        levels = np.arange(round(eye_y + (chin - eye_y) * 0.53), row + 1)
        below = np.minimum(levels + max(2, round(face_w * 0.028)), h - 1)
        # The mouth has a full cheek on each side. The chin stroke has a
        # narrower column of neck skin immediately below it.
        narrow = (skin_width[below] > face_w * 0.20) & (
            skin_width[below] < face_w * 0.68
        )
        vote = dark[levels][:, zone].sum(1) * narrow
        if len(vote) and vote.max() >= face_w * 0.12:
            chin = float(levels[vote.argmax()])
    # A cowlick can be the highest point of the figure without being the
    # crown of the skull. Locate the first substantial scalp at face center.
    scalp_rows = np.flatnonzero(
        (y[:, 0] < eye_y) & mask[:, round(face_x)] & (spans > face_w * 0.34)
    )
    crown = (
        max(top, int(scalp_rows[0]) + max(1, round(head_h * 0.016)))
        if len(scalp_rows)
        else top
    )
    mouth, nose, expression = face_marks(rgb, skin, eyes, (cheek_l, cheek_r), chin)
    cavity = painted_open_mouth(rgb, skin, face_x, eye_y, chin, face_w)
    if cavity:
        mouth = [(row[0], (row[2] + row[4]) / 2) for row in cavity[0][[0, -1]]]
        expression = "speaking"
    hair = sample(
        "hair", (box[0], top, box[2], eye_y), np.linalg.norm(rgb - skin, axis=2) > 62
    )
    # On a shallow crew cut a large eye white can win the pigment vote.
    # Sample again above the eyelids only if the proposed swatch hit an eye.
    if all(apertures):
        hx, hy = samples["hair"]
        if any(
            abs(hx - e["center"][0]) <= e["size"][0] * 0.52
            and abs(hy - e["center"][1]) <= e["size"][1] * 0.52
            for e in apertures
        ):
            eyelid = min(e["center"][1] - 0.58 * e["size"][1] for e in apertures)
            hair = sample(
                "hair",
                (
                    max(box[0], face_x - face_w * 0.65),
                    top,
                    min(box[2], face_x + face_w * 0.65),
                    eyelid,
                ),
                np.linalg.norm(rgb - skin, axis=2) > 62,
            )
    hair_pixels = (
        mask
        & (np.linalg.norm(rgb - hair, axis=2) < 47)
        & (y < arm_top)
        & (x >= box[0])
        & (x < box[2])
    )
    hair_pixels = scalp_pigment(hair_pixels, mask, samples["hair"], arm_top, face_w)
    hair_rows = np.flatnonzero(hair_pixels.sum(axis=1) > max(2, face_w * 0.05))
    long_hair = len(hair_rows) > 0 and hair_rows[-1] > eye_y + (chin - eye_y) * 0.67
    spiked = radial_crown(hair_pixels, face_x, eye_y, face_w) is not None
    # Skin at the center of the neck ends immediately inside the binding.
    neckline = np.flatnonzero(
        skin_region[:, int(face_x)]
        & (np.arange(h) > chin)
        & (np.arange(h) < shoulder_y + height * 0.045)
    )
    samples["binding"] = samples["shirt"]
    if len(neckline):
        neck_end = neckline[-1]
        strip = (
            face_x - face_w * 0.065,
            neck_end + 2,
            face_x + face_w * 0.065,
            min(h, neck_end + max(5, face_w * 0.077)),
        )
        if mask[int(strip[1]) : int(strip[3]), int(strip[0]) : int(strip[2])].any():
            sample("binding", strip)

    def point(pair):
        return {
            "x": round(1000 * pair[0] / (w - 1)),
            "y": round(1000 * pair[1] / (h - 1)),
        }

    bands = shirt_bands(rgb, shirt, cx, torso_w, shoulder_y, hem_y, point)
    wrist = wrist_position(mask, shoulder_x, shoulder_y, right, height)
    marks = {
        "crown": (face_x, crown),
        "chin": (face_x, chin),
        "leftCheek": (cheek_l, cheek_row),
        "rightCheek": (cheek_r, cheek_row),
        "leftEye": eyes[0],
        "rightEye": eyes[1],
        "noseTip": nose,
        "mouthLeft": mouth[0],
        "mouthRight": mouth[1],
        "shoulder": (shoulder_x, shoulder_y),
        "wrist": (wrist, shoulder_y),
        "hem": (cx, hem_y),
        "ankle": (leg_cx, ankle_y),
    }
    pupils = [e["pupil"][0] for e in apertures if e and e["pupil"]]
    gaze = (
        round(float(np.clip((np.mean(pupils) - 0.5) * 2, -0.7, 0.7)), 2)
        if pupils
        else 0
    )
    shapes = [e["size"][1] / e["size"][0] for e in apertures if e]
    return {
        "version": 2,
        "name": name,
        "landmarks": {k: point(v) for k, v in marks.items()},
        "samples": {k: point(v) for k, v in samples.items()},
        "bands": bands,
        "build": "regular",
        "skull": "round" if face_w >= (chin - crown) * 0.91 else "oval",
        "eyes": "wide" if shapes and np.mean(shapes) > 0.86 else "relaxed",
        "gaze": gaze,
        "brow": "level",
        "nose": "straight",
        "mouth": expression,
        "haircut": "spikes" if spiked else "bob" if long_hair else "crop",
        "footwear": "sneaker",
        "top": "open-coat" if long_outer_layer(
            rgb, mask, cx, torso_w, arm_top, arm_bottom, hem_y, ankle_y, shirt, skin
        ) else "crew",
        "lashes": False,
        "spectacles": False,
        "freckles": False,
        "details": {
            "frames": "round",
            "noseWidth": 1,
            "noseProjection": 1,
            "ponytailFall": 0.5,
        },
        "unsupported": [],
    }
