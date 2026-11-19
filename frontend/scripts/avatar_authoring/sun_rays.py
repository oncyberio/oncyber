"""Measure separate triangular rays relative to a floating mascot orb."""

import numpy as np
from scipy import ndimage
from scipy.spatial import ConvexHull


def measure_sun_rays(image, mask, center, radius, *, orb_only=False):
    cx, cy = center
    rx, ry = radius
    # Re-estimate the orb from its painted skin. The dark visor splits the
    # surface into two colored areas but does not change its outer diameter.
    x0, x1 = max(0, int(cx - 2.7 * rx)), min(mask.shape[1], int(cx + 2.7 * rx) + 1)
    y0, y1 = max(0, int(cy - 2.6 * ry)), min(mask.shape[0], int(cy + 1.55 * ry) + 1)
    rgb = image[y0:y1, x0:x1]
    yy, xx = np.mgrid[y0:y1, x0:x1]
    unit = np.hypot((xx - cx) / rx, (yy - cy) / ry)
    forehead = (unit < 0.8) & (yy < cy - 0.33 * ry) & mask[y0:y1, x0:x1]
    if forehead.sum() < 25:
        return
    skin = np.median(rgb[forehead], axis=0)
    skin_hue = skin - skin.mean()
    if np.linalg.norm(skin_hue) < 32:
        return
    tint = rgb - rgb.mean(2, keepdims=True)
    chroma = np.linalg.norm(tint, axis=2)
    skin_pixels = (
        ((tint @ skin_hue) > 0.93 * chroma * np.linalg.norm(skin_hue))
        & (chroma > 30)
        & (unit < 1.29)
    )
    components, count = ndimage.label(skin_pixels)
    central = (abs(xx - cx) < 0.56 * rx) & (abs(yy - cy) < 0.88 * ry)
    votes = np.bincount(components[central], minlength=count + 1)
    chosen = np.flatnonzero(votes[1:] >= 0.11 * rx * ry) + 1
    if not len(chosen):
        return
    skin_pixels &= np.isin(components, chosen)
    # The shirt graphic can use the orb hue below the floating gap. Constrain
    # bounds to the two painted lobes nearest the forehead and chin.
    bands, n = ndimage.label(skin_pixels.sum(1) > 0.14 * rx)
    active = np.flatnonzero(bands)
    if not n:
        return
    anchors = [
        active[np.argmin(abs(active - (cy + offset * ry - y0)))]
        for offset in (-0.55, 0.58)
    ]
    bounds = np.where(np.isin(bands, bands[anchors]))[0]
    skin_pixels[: max(0, bounds.min() - 2)] = False
    skin_pixels[bounds.max() + 3 :] = False
    ly, lx = np.nonzero(skin_pixels)
    if len(lx) < 0.35 * rx * ry:
        return
    left, right = np.percentile(lx, [0.1, 99.9]) + x0
    top, bottom = np.percentile(ly, [0.1, 99.9]) + y0
    cx, cy = (left + right) / 2, (top + bottom) / 2
    rx, ry = (right - left) / 2, (bottom - top) / 2
    if rx > 1.35 * ry or ry > 1.35 * rx:
        # A coral highlight and a blue chin need not share a hue. When pigment
        # finds just one lobe, measure orthogonal chords through the intact
        # round silhouette, including the intervening opaque visor.
        ox, oy = center
        sx, sy = radius

        def chords(layer, fixed, varying, fixed_radius, moving_radius):
            centers, radii = [], []
            for u in (-0.37, -0.23, 0, 0.23, 0.37):
                column = round(fixed + u * fixed_radius)
                anchor = round(varying)
                if not (0 <= column < layer.shape[1] and 0 <= anchor < layer.shape[0]):
                    continue
                ids, _n = ndimage.label(layer[:, column])
                if not ids[anchor]:
                    continue
                chord = np.flatnonzero(ids == ids[anchor])
                rad = np.ptp(chord) / (2 * np.sqrt(1 - u * u))
                mid = (chord[0] + chord[-1]) / 2
                if (
                    0.68 < rad / moving_radius < 1.30
                    and abs(mid - varying) < 0.35 * moving_radius
                ):
                    centers.append(mid)
                    radii.append(rad)
            return (np.median(centers), np.median(radii)) if len(radii) >= 2 else None

        vertical = chords(mask, ox, oy, sx, sy)
        if vertical is not None:
            cy, ry = vertical
            horizontal = chords(mask.T, cy, ox, ry, sx)
            if horizontal is not None:
                cx, rx = horizontal
    if min(rx, ry) < 7:
        return
    if orb_only:
        return np.array([cx, cy, rx, ry])
    unit = np.hypot((xx - cx) / rx, (yy - cy) / ry)
    annulus = (unit > 1.01) & (unit < 2.55)
    labels, _ = ndimage.label(mask[y0:y1, x0:x1])
    components = {}
    swatches = []
    for i, box in enumerate(ndimage.find_objects(labels), 1):
        sel = labels[box] == i
        if 0.005 < sel.sum() / (rx * ry) < 0.27 and np.mean(annulus[box][sel]) > 0.95:
            components[i] = (box, sel)
            swatches.append(np.median(rgb[box][sel], axis=0))
    if len(swatches) < 5:
        return
    color = np.median(swatches, axis=0)
    near = np.linalg.norm(rgb - color, axis=2) < 48
    islands = labels
    labels, _ = ndimage.label(near & annulus & mask[y0:y1, x0:x1])
    rays = []

    def triangle(region, box):
        y, x = np.nonzero(region & ~ndimage.binary_erosion(region))
        p = np.column_stack(
            ((x + box[1].start + x0 - cx) / rx, (y + box[0].start + y0 - cy) / ry)
        )
        if len(p) < 6 or np.linalg.matrix_rank(p - p.mean(0)) < 2:
            return
        hull = p[ConvexHull(p).vertices]
        # A convex hull at image resolution typically has fewer than 25 vertices.
        best, area = None, 0
        for j in range(len(hull) - 2):
            delta = hull[j + 1 :] - hull[j]
            sizes = (
                delta[:, 0, None] * delta[None, :, 1]
                - delta[:, 1, None] * delta[None, :, 0]
            )
            a, b = np.unravel_index(sizes.argmax(), sizes.shape)
            if sizes[a, b] > area:
                best, area = hull[[j, j + 1 + a, j + 1 + b]], sizes[a, b]
        if best is not None and area * rx * ry / (2 * region.sum()) >= 0.65:
            return best.round(3).tolist()

    for i, box in enumerate(ndimage.find_objects(labels), 1):
        region = labels[box] == i
        if not 0.006 < region.sum() / (rx * ry) < 0.30:
            continue
        # Lighter facet edges share the paper silhouette of the same isolated
        # triangle. A hue-only hull would narrow the rays on every turn.
        island = np.bincount(islands[box][region]).argmax()
        if island in components:
            full_box, full_region = components[island]
            if full_region.sum() <= 1.8 * region.sum():
                region, box = full_region, full_box
        tri = triangle(region, box)
        if tri is not None:
            rays.append(tri)

    for box, region in components.values():
        # Paper-colored halos can connect to a real ray and spoil its hull.
        # Recover a missing isolated facet from its contiguous painted core.
        local = near[box] & region
        if local.sum() < 0.38 * region.sum():
            continue
        y, x = np.nonzero(local)
        center = np.array(
            [
                (x.mean() + box[1].start + x0 - cx) / rx,
                (y.mean() + box[0].start + y0 - cy) / ry,
            ]
        )
        if any(np.linalg.norm(np.mean(ray, axis=0) - center) < 0.22 for ray in rays):
            continue
        core = ndimage.binary_fill_holes(local)
        tri = triangle(core, box)
        if tri is not None:
            rays.append(tri)
    if 5 <= len(rays) <= 24:
        rays.sort(key=lambda tri: np.arctan2(*np.mean(tri, axis=0)[::-1]))
        return rays, "#" + color.round().astype("uint8").tobytes().hex()


def orb_edits(source, native, frame, recipe):
    from .fit import pixels

    def measure(path):
        rgb, mask = pixels(path, keep_components=True)
        y, x = np.nonzero(mask)
        span, top, cx = np.ptp(y), y.min(), (x.min() + x.max()) / 2
        x0, y0, x1, y1 = frame
        center = [cx + (x0 + x1) * span / 2, top + (y0 + y1) * span / 2]
        radius = (x1 - x0) * span * 0.47
        orb = measure_sun_rays(rgb, mask, center, [radius, radius], orb_only=True)
        if orb is not None:
            ox, oy, rx, ry = orb
            swatches = []
            for offset in (-0.63, 0.72):
                col = (
                    np.rint(ox + rx * np.linspace(-0.32, 0.32, 9))
                    .astype(int)
                    .clip(0, rgb.shape[1] - 1)
                )
                row = (
                    np.rint(oy + ry * (offset + np.linspace(-0.075, 0.075, 5)))
                    .astype(int)
                    .clip(0, rgb.shape[0] - 1)
                )
                swatches.append(np.median(rgb[np.ix_(row, col)], axis=(0, 1)))
            return (orb - np.array([cx, top, 0, 0])) / span, np.array(swatches)

    expected, actual = measure(source), measure(native)
    if expected is None or actual is None:
        return []
    expected, ref_paint = expected
    actual, draw_paint = actual
    ratio = expected[2:] / actual[2:]
    if not np.all((0.75 < ratio) & (ratio < 1.28)):
        return []
    edits = []
    differences = ref_paint - draw_paint
    if abs(differences).max() > 12:

        def rgb_hex(value):
            return np.frombuffer(bytes.fromhex(value[1:]), dtype="uint8").astype(float)

        previous = recipe.get("orbPaint", {})
        base = rgb_hex(recipe["paints"].get("skin", "#f32685"))
        paints = {}
        for k, shade, delta in zip(
            ("top", "bottom"), ("#ff2e90", "#c21b59"), differences
        ):
            initial = (
                rgb_hex(previous[k])
                if k in previous
                else np.clip(base + rgb_hex(shade) - rgb_hex("#f32685"), 0, 255)
            )
            paints[k] = (
                "#"
                + (initial + delta).clip(0, 255).round().astype("uint8").tobytes().hex()
            )
        if paints != previous:
            edits.append({"field": "orbPaint", "value": paints})
    for key, scale in zip(("headWidth", "headHeight"), ratio):
        if abs(scale - 1) > 0.018:
            value = recipe["proportions"].get(key, 1) * scale
            edits.append(
                {
                    "field": "proportions." + key,
                    "value": round(float(np.clip(value, 0.65, 1.5)), 3),
                }
            )
    adjusted = actual[:2] - [0, actual[3] * (ratio[1] - 1)]
    shift = (
        np.array(recipe.get("orbOffset", [0, 0]))
        + (expected[:2] - adjusted) / expected[2:]
    )
    shift = shift.clip(-0.35, 0.35).round(3)
    if np.max(abs(shift - recipe.get("orbOffset", [0, 0]))) > 0.018:
        edits.append({"field": "orbOffset", "value": shift.tolist()})
    if (
        recipe.get("sunRays")
        and abs(recipe["proportions"].get("crownLength", 1) - 1) > 0.02
    ):
        edits.append({"field": "proportions.crownLength", "value": 1})
    return edits


def kit_landmarks(path):
    """Read the pale jersey, dark shorts, exposed legs and sock bands of this kit."""
    from .fit import pixels

    rgb, m = pixels(path, keep_components=True)
    y, x = np.nonzero(m)
    top, h, mid = y.min(), np.ptp(y), (x.min() + x.max()) / 2
    u = (np.arange(m.shape[1]) - mid) / h
    t = (np.arange(m.shape[0]) - top) / h
    arm_col = (0.24 < abs(u)) & (abs(u) < 0.38)
    rows = np.where(m[:, arm_col].mean(1) > 0.75)[0]
    if not len(rows):
        return
    shoulder = np.median(t[rows])
    lanes = (0.028 < abs(u)) & (abs(u) < 0.067)
    dark = ((rgb.mean(2) < 123) & m)[:, lanes].mean(1)
    band = (t > shoulder + 0.08) & (t < 0.75) & (ndimage.median_filter(dark, 5) > 0.64)
    labels, count = ndimage.label(band)
    if not count:
        return
    long = np.bincount(labels)[1:].argmax() + 1
    trouser_rows = np.flatnonzero(labels == long)
    waist, hem = t[trouser_rows.min()], t[trouser_rows.max()]
    if hem - waist < 0.07:
        return
    light = (rgb.min(2) > 153) & (np.ptp(rgb, axis=2) < 76) & m
    center = abs(u) < 0.085
    neckline = (
        (t > shoulder - 0.105) & (t < shoulder) & (light[:, center].mean(1) > 0.13)
    )
    sock = (t > max(0.65, hem + 0.06)) & (t < 0.91) & (light[:, lanes].mean(1) > 0.18)
    if not neckline.any() or not sock.any():
        return
    waist_width = np.median(
        [np.ptp(u[m[row]]) for row in trouser_rows[1:10] if m[row].any()]
    )
    return np.array(
        [t[neckline].min(), shoulder, waist, hem, t[sock].min(), waist_width]
    )


def collar_closed(gap):
    # At the 610px native body height, a registered gap of .003 spans at
    # least two pixels. Keep that clearance when the source orb is detached.
    return bool(gap and gap["source"] >= 0.003 and gap["native"] < gap["source"] * 0.58)


def open_collar(recipe, gap):
    fit = {
        "collar": 0,
        "shoulders": 0,
        "waist": 0,
        "hem": 0,
        "sock": 0,
        "width": 1,
        **recipe.get("kitFit", {}),
    }
    fit["collar"] = round(
        float(
            np.clip(
                fit["collar"] + (gap["source"] - gap["native"]) * 1.25 + 0.004,
                -0.045,
                0.045,
            )
        ),
        4,
    )
    return {"field": "kitFit", "value": fit}


def kit_edits(source, native, recipe, gap=None):
    target, current = kit_landmarks(source), kit_landmarks(native)
    if target is None or current is None:
        return []
    fields = ["collar", "shoulders", "waist", "hem", "sock"]
    fit = recipe.get("kitFit", {})
    # Displacements are fractions of drawing height. Aim from the observed
    # native pose, with a small margin for the softened edge on the next pass.
    delta = (target[:5] - current[:5]) * 0.95
    if gap and gap["source"] >= 0.003:
        missing = gap["source"] - gap["native"]
        # The visible center of the neck opening belongs to the floating
        # head family. A high sleeve or a lower ray is not the collar.
        delta[0] = np.clip(
            missing * 1.25 + (0.005 if not gap["native"] else 0), -0.038, 0.038
        )
    values = {
        key: round(float(np.clip(fit.get(key, 0) + s, -0.045, 0.045)), 4)
        for key, s in zip(fields, delta)
    }
    values["width"] = round(
        float(np.clip(fit.get("width", 1) * target[5] / current[5], 0.78, 1.25)), 3
    )
    if max(abs(delta)) > 0.003 or abs(target[5] / current[5] - 1) > 0.035:
        return [{"field": "kitFit", "value": values}]
    return []


def floating_gap(path, eye_frame):
    """Visible sky between the spherical chin and the collar along the central stem."""
    from .fit import pixels

    rgb, mask = pixels(path, keep_components=True)
    y, x = np.where(mask)
    h, top, mid = np.ptp(y), y.min(), (x.min() + x.max()) / 2
    x0, y0, x1, y1 = eye_frame
    cx, cy = mid + (x0 + x1) * h / 2, top + (y0 + y1) * h / 2
    radius = (x1 - x0) * h * 0.47
    orb = measure_sun_rays(rgb, mask, [cx, cy], [radius, radius], orb_only=True)
    if orb is None:
        return
    cx, cy, rx, ry = orb
    cols = (
        np.rint(cx + np.linspace(-0.115, 0.115, 11) * rx)
        .astype(int)
        .clip(0, mask.shape[1] - 1)
    )
    start, end = (
        max(0, round(cy + 0.77 * ry)),
        min(mask.shape[0], round(cy + 1.65 * ry)),
    )
    band = rgb[start:end, cols]
    backdrop = np.median(rgb[:5, :5], axis=(0, 1))
    sky = (~mask[start:end, cols]) | (np.max(abs(band - backdrop), axis=2) < 5)
    labels, n = ndimage.label(sky.mean(1) > 0.72)
    if not n:
        return 0.0
    gaps = [s[0] for s in ndimage.find_objects(labels) if s]
    gap = min(gaps, key=lambda s: abs(start + s.start - (cy + ry)))
    if abs(start + gap.start - (cy + ry)) > 0.20 * ry:
        return 0.0
    return round((gap.stop - gap.start) / h, 5)
