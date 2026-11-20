"""Measure individual painted rays relative to a floating mascot orb."""

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage, optimize
from scipy.spatial import ConvexHull


def orb_contour(image, mask, center, radius):
    """Fit both outer arcs without including the visor temples, rays or neck."""
    cx, cy = center
    rx, ry = radius
    h, w = mask.shape
    if min(rx, ry) < 7 or not 0 <= round(cx) < w:
        return
    rows = []
    for y in range(max(0, round(cy - 1.25 * ry)), min(h, round(cy + 1.25 * ry) + 1)):
        labels, _ = ndimage.label(mask[y])
        mid = labels[round(cx)]
        if not mid:
            continue
        left, right = np.flatnonzero(labels == mid)[[0, -1]]
        if (
            not 0.60 * rx < right - left < 2.48 * rx
            or abs((left + right) / 2 - cx) > 0.14 * rx
        ):
            continue
        section = image[y, left : right + 1]
        if np.mean((section.max(1) < 100) & (np.ptp(section, axis=1) < 24)) > 0.29:
            continue
        rows.append([y, left - 0.5, right + 0.5])
    if len(rows) < max(8, 0.49 * ry):
        return
    y, left, right = np.asarray(rows).T
    x, y = np.r_[left, right], np.tile(y, 2)

    def residual(p):
        return np.hypot((x - p[0]) / p[2], (y - p[1]) / p[3]) - 1

    bounds = (
        [cx - 0.25 * rx, cy - 0.52 * ry, rx * 0.65, ry * 0.6],
        [cx + 0.25 * rx, cy + 0.52 * ry, rx * 1.35, ry * 1.35],
    )
    solution = optimize.least_squares(
        residual,
        [cx, cy, rx, ry],
        bounds=bounds,
        loss="soft_l1",
        f_scale=0.018,
    )
    ox, oy, sx, sy = solution.x
    good = abs(residual(solution.x)) < max(0.04, 1.4 / min(rx, ry))
    if (
        good.mean() > 0.68
        and np.any(good & (y < oy - 0.59 * sy))
        and np.any(good & (y > oy + 0.59 * sy))
    ):
        # Once the two arcs are identified, a few collar or stem pixels
        # beyond the chin should exert no pull on the vertical radius.
        return optimize.least_squares(
            lambda p: residual(p)[good],
            solution.x,
            bounds=bounds,
            loss="soft_l1",
            f_scale=0.012,
        ).x


def measure_sun_rays(image, mask, center, radius, *, orb_only=False):
    cx, cy = center
    rx, ry = radius
    # Re-estimate the orb from its painted skin. The dark visor splits the
    # surface into two colored areas but does not change its outer diameter.
    x0, x1 = max(0, int(cx - 2.7 * rx)), min(mask.shape[1], int(cx + 2.7 * rx) + 1)
    y0, y1 = max(0, int(cy - 2.6 * ry)), min(mask.shape[0], int(cy + 1.55 * ry) + 1)
    rgb = image[y0:y1, x0:x1]
    yy, xx = np.mgrid[y0:y1, x0:x1]
    # Paper can brighten towards the center of a full sheet. Its faint halo
    # joins separate triangles in a mask inferred from the distant corners.
    # Discard only paper-colored pixels connected to the local background.
    local_mask = mask[y0:y1, x0:x1]
    paper = rgb[~local_mask]
    if len(paper) >= 20:
        background = np.median(paper, axis=0)
        noise = np.percentile(abs(paper - background).max(1), 95)
        close = abs(rgb - background).max(2) <= np.clip(4 * noise + 4, 12, 22)
        near_paper = ndimage.binary_propagation(~local_mask, mask=(~local_mask | close))
        mask = mask.copy()
        mask[y0:y1, x0:x1] = ~near_paper
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
    contour = orb_contour(image, mask, center, radius)
    if contour is None:
        # Shaded paper can join the ray gaps to the orb in the foreground mask.
        # Register the same two arcs on the connected skin instead. A narrow
        # throat below the cheeks cannot set the vertical diameter.
        origin = np.array([x0, y0])
        local = orb_contour(rgb, skin_pixels, np.asarray(center) - origin, radius)
        if local is not None:
            contour = local + [x0, y0, 0, 0]
    if contour is not None:
        cx, cy, rx, ry = contour
    elif rx > 1.35 * ry or ry > 1.35 * rx:
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
    # Shaded tips can be darker than the upper swatches. Grow only from
    # matching pigment, through pixels of the same hue. For neutral rays the
    # paper supplies no hue contrast, so retain the more selective seed.
    active = annulus & mask[y0:y1, x0:x1]
    if np.linalg.norm(color - color.mean()) > 38:
        delta = rgb - color
        chroma_gap = np.linalg.norm(delta - delta.mean(2, keepdims=True), axis=2)
        shadow = (chroma_gap < 56) & (np.linalg.norm(delta, axis=2) < 82)
        near = ndimage.binary_propagation(near & active, mask=shadow & active)
    elif len(paper) >= 20:
        # Pale rays can disappear entirely from a dark-foreground extraction.
        # Recover the signed contrast against nearby paper, along the measured
        # neutral pigment direction. The chroma bound excludes jersey and skin.
        axis = color - background
        contrast = np.linalg.norm(axis)
        if contrast > 15:
            axis /= contrast
            level = (rgb - background) @ axis
            noise = np.percentile(abs((paper - background) @ axis), 75)
            neutral = np.ptp(rgb - color, axis=2) < 13
            painted = neutral & (level > max(0.30 * contrast, 2.6 * noise, 8))
            seed = ((active & near) | (painted & (level > 0.70 * contrast))) & annulus
            active |= painted & annulus
            near = ndimage.binary_propagation(seed, mask=active & (near | painted))
    islands = labels
    labels, _ = ndimage.label(near & active)
    rays = []

    def outline(region, box):
        y, x = np.nonzero(region & ~ndimage.binary_erosion(region))
        origin = np.array([box[1].start + x0 - cx, box[0].start + y0 - cy])
        points = np.column_stack((x, y)) + origin
        uv = points / [rx, ry]
        if len(uv) < 6 or np.linalg.matrix_rank(points - points.mean(0)) < 2:
            return
        direction = uv.mean(0)
        direction /= np.linalg.norm(direction)
        depth = uv @ direction
        across = uv @ [-direction[1], direction[0]]
        base = np.ptp(across[depth <= np.quantile(depth, 0.42)])
        tip = np.ptp(across[depth >= np.quantile(depth, 0.58)])
        # Binding can use exactly the same dye. A ray projects out from the
        # head and tapers toward its outer end, across both large and small lobes.
        if np.ptp(depth) < 0.55 * np.ptp(across) or base < 1.08 * tip:
            return
        # Follow the half-pixel paint boundary with at most six convex knots.
        # This retains rounded corners without baking image-resolution geometry.
        edge = np.concatenate(
            [points + d for d in ((-0.5, 0), (0.5, 0), (0, -0.5), (0, 0.5))]
        )
        boundary = ConvexHull(edge)
        hull = edge[boundary.vertices]
        if boundary.volume > 1.35 * region.sum():
            return
        while len(hull) > 3:
            before = np.roll(hull, 1, axis=0)
            after = np.roll(hull, -1, axis=0)
            chord = after - before
            offset = hull - before
            cross = abs(chord[:, 0] * offset[:, 1] - chord[:, 1] * offset[:, 0])
            distance = cross / np.linalg.norm(chord, axis=1)
            k = int(distance.argmin())
            if len(hull) <= 6 and distance[k] >= 0.72:
                break
            hull = np.delete(hull, k, axis=0)
        corners = (hull / [rx, ry]).round(3)
        if np.all(
            (np.linalg.norm(corners, axis=1) >= 0.93)
            & (np.linalg.norm(corners, axis=1) <= 2.79)
        ):
            return corners.tolist()

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
        tri = outline(region, box)
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
        tri = outline(core, box)
        if tri is not None:
            rays.append(tri)
    if rays:
        # The bases of a single corona share an orbit even with long, unequal
        # tips. A matching sleeve accent farther down the page is separate.
        roots = np.array([np.linalg.norm(ray, axis=1).min() for ray in rays])
        median = np.median(roots)
        reach = max(0.32, 4 * np.median(abs(roots - median)))
        rays = [ray for ray, root in zip(rays, roots) if root <= median + reach]
    if 5 <= len(rays) <= 24:
        rays.sort(key=lambda tri: np.arctan2(*np.mean(tri, axis=0)[::-1]))
        return rays, "#" + color.round().astype("uint8").tobytes().hex()


def apply_sun_rays(recipe, measurement, rgb, orb):
    """Infer depth only when the interiors of several painted facets are shaded."""
    rays, pigment = measurement
    recipe["sunRays"] = rays
    recipe["paints"]["rays"] = pigment
    if orb is None:
        return
    shaded, measured = 0, 0
    for ray in rays:
        xy = np.asarray(ray) * orb[2:] + orb[:2]
        lo = np.maximum(0, np.floor(xy.min(0)).astype(int))
        hi = np.minimum(rgb.shape[1::-1], np.ceil(xy.max(0)).astype(int) + 1)
        if np.any(hi <= lo):
            continue
        tile = Image.new("L", tuple(hi - lo))
        ImageDraw.Draw(tile).polygon([tuple(p) for p in xy - lo], fill=1)
        # Exclude the ink/paper boundary. Its antialiasing can create a
        # strong apparent gradient even on a completely flat graphic.
        inside = ndimage.binary_erosion(
            np.asarray(tile), iterations=max(1, round(0.02 * min(orb[2:])))
        )
        y, x = np.where(inside)
        if len(x) < 12:
            continue
        colors = rgb[y + lo[1], x + lo[0]]
        coherent = np.linalg.norm(colors - np.median(colors, axis=0), axis=1) < 50
        if coherent.sum() < 12 or coherent.mean() < 0.55:
            continue
        luma = colors[coherent] @ [0.2126, 0.7152, 0.0722]
        plane = np.column_stack((x[coherent], y[coherent], np.ones(len(luma))))
        fitted = plane @ np.linalg.lstsq(plane, luma, rcond=None)[0]
        spread = np.ptp(np.quantile(fitted, [0.1, 0.9]))
        residual = np.median(abs(luma - fitted))
        shaded += int(spread >= max(8, 2.5 * residual))
        measured += 1
    if shaded >= 4 and shaded >= 0.6 * measured:
        # Front art cannot determine thickness. For a molded corona the
        # family default is a base as deep as it is wide, tapering to a tip.
        recipe["rayDepth"] = 1


def orb_swatches(rgb, orb):
    ox, oy, rx, ry = orb
    col = (
        np.rint(ox + rx * np.linspace(-0.32, 0.32, 9))
        .astype(int)
        .clip(0, rgb.shape[1] - 1)
    )
    swatches = []
    for offset in (-0.63, 0.72):
        row = (
            np.rint(oy + ry * (offset + np.linspace(-0.075, 0.075, 5)))
            .astype(int)
            .clip(0, rgb.shape[0] - 1)
        )
        swatches.append(np.median(rgb[np.ix_(row, col)], axis=(0, 1)))
    return np.array(swatches)


def measured_orb_paint(rgb, mask, orb):
    """Fit low-frequency irradiance on the visible sphere, excluding its lens."""
    cx, cy, rx, ry = orb
    colors = orb_swatches(rgb, orb).round().astype(np.uint8)
    paint = dict(zip(("top", "bottom"), ("#" + c.tobytes().hex() for c in colors)))
    if min(rx, ry) < 12:
        return paint
    v, u = np.mgrid[-0.94:0.95:0.035, -0.94:0.95:0.035]
    x = np.rint(cx + rx * u).astype(int)
    y = np.rint(cy + ry * v).astype(int)
    observed = (x >= 0) & (x < mask.shape[1]) & (y >= 0) & (y < len(mask))
    x, y = x.clip(0, mask.shape[1] - 1), y.clip(0, len(mask) - 1)
    # Omit the lens, its cast shadow, the crown outline and adjacent rays.
    # Both exposed zones and both temples must support the fit.
    valid = (
        observed & mask[y, x] & (u * u + v * v < 0.91**2) & ((v < -0.44) | (v > 0.65))
    )
    if any(
        np.count_nonzero(valid & side & zone) < 24
        for side in (u < -0.28, u > 0.28)
        for zone in (v < 0, v > 0)
    ):
        return paint

    def luminance(srgb):
        s = srgb / 255.0
        linear = np.where(s <= 0.04045, s / 12.92, ((s + 0.055) / 1.055) ** 2.4)
        return linear @ [0.2126, 0.7152, 0.0722]

    u, v = u[valid], v[valid]
    z = np.sqrt(1 - u * u - v * v)
    anchor_y = np.where(v < 0, -0.63, 0.72)
    reference = np.where(v < 0, *luminance(colors))
    if reference.min() < 0.014:
        return paint
    value = np.log(np.maximum(0.001, luminance(rgb[y[valid], x[valid]])) / reference)
    basis = np.column_stack((u, v - anchor_y, z - np.sqrt(1 - anchor_y**2)))
    weights = np.ones(len(value))
    # Robust regression keeps isolated highlights and thin painted outlines
    # from becoming the inferred light direction on the unseen hemisphere.
    for _ in range(4):
        coef = np.linalg.lstsq(basis * weights[:, None], value * weights, rcond=None)[0]
        residual = np.abs(value - basis @ coef)
        weights = np.sqrt(np.minimum(1, 0.075 / np.maximum(residual, 0.001)))
    if np.median(residual) > 0.16 or np.max(abs(coef)) > 3:
        return paint
    paint["light"] = np.clip(coef, -2, 2).round(3).tolist()
    return paint


def correct_ray_edges(rays, pigment, target, actual):
    """Correct each convex rim from its native radial and tangential projection error."""

    def facets(sample):
        rgb, shape, visible, orb = sample
        yy, xx = np.indices(shape.shape)
        uv = (np.stack((xx, yy), axis=2) - orb[:2]) / orb[2:]
        radius = np.linalg.norm(uv, axis=2)
        ink = np.linalg.norm(rgb - pigment, axis=2) < 72
        labels, n = ndimage.label(
            ink & shape & visible & (radius > 1.025) & (radius < 2.65)
        )
        interior = ndimage.binary_erosion(visible)
        parts = []
        for k in range(1, n + 1):
            selected = labels == k
            if (
                0.012 < selected.sum() / np.prod(orb[2:]) < 0.29
                and interior[selected].all()
            ):
                points = uv[selected]
                parts.append((points.mean(0), points))
        return parts

    target_parts, actual_parts = facets(target), facets(actual)
    result = []
    for ray in rays:
        corners = np.asarray(ray, dtype=float)
        mid = corners.mean(0)

        def match(parts):
            if parts:
                p, points = min(parts, key=lambda entry: np.linalg.norm(entry[0] - mid))
                if np.linalg.norm(p - mid) < 0.22:
                    return points

        observed, drawn = match(target_parts), match(actual_parts)
        if observed is not None and drawn is not None:
            # Compare both silhouettes in the ray's radial and tangential
            # frame. A single affine update keeps small rounded corners convex,
            # even when adjacent supporting edges are nearly parallel.
            radial = mid / np.linalg.norm(mid)
            axes = np.array([radial, [-radial[1], radial[0]]])
            lo, hi = np.percentile(observed @ axes.T, [2, 98], axis=0)
            left, right = np.percentile(drawn @ axes.T, [2, 98], axis=0)
            if np.all(right - left > 0.025):
                scale = np.clip((hi - lo) / (right - left), 0.82, 1.22)
                shift = np.clip((lo + hi - left - right) / 2, -0.10, 0.10)
                center = (left + right) / 2
                revised = ((corners @ axes.T - center) * scale + center + shift) @ axes
                r = np.linalg.norm(revised, axis=1)
                if np.all((r > 0.93) & (r < 2.79)):
                    corners = revised
        result.append(corners.round(3).tolist())
    return result


def jersey_neck(rgb, mask, orb):
    """Require an attached throat, then measure the contrasting crew binding."""
    cx, cy, rx, ry = orb
    x = round(cx)
    first, last = max(0, round(cy + 0.97 * ry)), min(len(mask), round(cy + 1.72 * ry))
    if last - first < 10:
        return
    stripe = slice(
        max(0, x - max(1, round(0.07 * rx))),
        min(mask.shape[1], x + max(1, round(0.07 * rx)) + 1),
    )
    # A visible paper gap anywhere just below the chin keeps the orb floating.
    if not mask[first:last, stripe].all():
        return
    neck_rows, painted_rows = [], []
    chin = np.median(rgb[round(cy + 0.66 * ry), stripe], axis=0)
    chin_hue = chin - chin.mean()
    for y in range(first, min(last, round(cy + 1.25 * ry))):
        ids, _ = ndimage.label(mask[y])
        group = np.flatnonzero(ids == ids[x])
        rows = neck_rows
        if len(group) >= 0.85 * rx:
            # Some backdrops join the outward rays to the shoulders. Keep a
            # separate estimate from continuous skin for that case alone.
            sample = np.median(rgb[y, stripe], axis=0)
            hue = sample - sample.mean()
            if hue @ chin_hue <= 0.9 * np.linalg.norm(chin_hue) * max(
                24, np.linalg.norm(hue)
            ):
                continue
            same = np.max(abs(rgb[y] - sample), axis=1) < 38
            ids, _ = ndimage.label(mask[y] & same)
            if not ids[x]:
                continue
            group = np.flatnonzero(ids == ids[x])
            rows = painted_rows
        if 0.32 * rx < len(group) < 0.85 * rx and abs(group.mean() - cx) < 0.14 * rx:
            rows.append((y, len(group) / (2 * rx)))
    required = max(2, 0.055 * ry)
    if len(neck_rows) < required:
        neck_rows = painted_rows
    if len(neck_rows) < required:
        return
    color = np.median(rgb[first:last, stripe], axis=1)
    # The central binding has two color transitions. The second returns to
    # jersey fabric. Require enough pixels in each of the three materials.
    width = max(2, round(0.052 * ry))
    start = max(width, neck_rows[-1][0] - first)
    choices = []
    for i in range(start, min(len(color) - width * 2, round(cy + 1.5 * ry) - first)):
        skin = np.median(color[i - width : i], axis=0)
        for length in range(width, max(width + 1, round(0.15 * ry))):
            if i + length + width > len(color):
                break
            band = color[i : i + length]
            fabric = np.median(color[i + length : i + length + width], axis=0)
            dye = np.median(band, axis=0)
            score = min(
                np.linalg.norm(dye - skin), np.linalg.norm(dye - fabric)
            ) - np.mean(np.linalg.norm(band - dye, axis=1))
            if score >= 42:
                choices.append((score, i, length, dye, skin))
    if not choices:
        # A self-colored binding meets the same fabric on both sides of the
        # neckline. Locate the skin-to-shirt transition across the center only
        # when that color continues onto both shoulders.
        sides = np.rint(cx + np.array([-0.53, 0.53]) * rx).astype(int)
        if sides[0] < width or sides[1] + width >= mask.shape[1]:
            return
        for i in range(
            start, min(len(color) - width * 2, round(cy + 1.52 * ry) - first)
        ):
            skin = np.median(color[i - width : i], axis=0)
            fabric = np.median(color[i : i + width], axis=0)
            shoulder_y = min(len(mask) - width, first + i + 3 * width)
            flank = [
                np.median(
                    rgb[
                        shoulder_y : shoulder_y + width, side - width : side + width + 1
                    ],
                    axis=(0, 1),
                )
                for side in sides
            ]
            delta = fabric - np.asarray(flank)
            # The binding is recessed beneath the chin. Match the garment hue
            # while allowing that recess to darken all three channels together.
            shade = delta.mean(axis=1)
            follows = max(np.linalg.norm(delta - shade[:, None], axis=1))

            contrast = np.linalg.norm(fabric - skin)
            if (
                contrast > 70
                and follows < 25
                and max(abs(shade)) < 55
                and mask[shoulder_y, sides].all()
            ):
                choices.append((contrast - follows, i, width, fabric, skin))
    if not choices:
        return
    _, i, length, dye, skin = max(choices, key=lambda c: c[0])
    throat_y = neck_rows[-1][0]
    radius = np.median([r for _, r in neck_rows])
    drop = np.clip((first + i - throat_y) / rx, 0.04, 0.24)

    def swatch(v):
        return "#" + np.round(v).astype("uint8").tobytes().hex()

    collar = {
        "radius": round(float(radius), 4),
        "drop": round(float(drop), 4),
        "band": round(float(np.clip(length / rx, 0.02, 0.12)), 4),
        "binding": swatch(dye),
        "skin": swatch(skin),
    }
    return collar, (first + i - cy) / ry - 1


def fit_crew_to_orb(rgb, mask, orb, recipe, crown):
    """Register the shirt and shoulder anchors to a visible neck in a full T-pose."""
    neck = jersey_neck(rgb, mask, orb)
    if not neck:
        return
    collar, below = neck
    cx, cy, rx, ry = orb
    x, r = round(cx), round(rx * 2.5)
    if x - r < 0 or x + r >= mask.shape[1]:
        return
    at = np.flatnonzero(mask[:, x - r] & mask[:, x + r])
    at = at[(at > cy + 1.08 * ry) & (at < cy + 2.5 * ry)]
    if len(at) < 2 or np.ptp(at) > 0.55 * ry:
        return
    base_rx, base_ry = crown[2:]
    y_scale = base_ry * recipe["proportions"].get("headHeight", 1)
    chin = crown[1] + base_ry + y_scale * recipe.get("orbOffset", [0, 0])[1]
    shoulder = chin + ((np.median(at) - cy) / ry - 1) * y_scale
    binding = chin + below * y_scale - collar["drop"] * base_rx
    recipe["orbCollar"] = collar
    marks = kit_landmarks(rgb, mask)
    if marks is not None:
        yy, _ = np.where(mask)
        levels = yy.min() + np.ptp(yy) * np.linspace(
            marks[1] + 0.04, marks[2] - 0.02, 9
        )
        axes = []
        for y in np.rint(levels).astype(int):
            xs = np.flatnonzero(mask[y])
            if len(xs) >= rx and xs[0] < cx < xs[-1] and np.ptp(xs) <= 3 * rx:
                axes.append((xs[0] + xs[-1]) * 0.5)
        if len(axes) >= 7 and np.ptp(axes) < 0.08 * rx:
            # The stock orb and jersey have the same horizontal centre.
            # Asymmetric fingertips can shift a whole-figure fit away from it.
            offset = recipe.get("orbOffset", [0, 0])
            lateral = round(float(np.clip((cx - np.median(axes)) / rx, -0.35, 0.35)), 4)
            if abs(lateral - offset[0]) > 0.015:
                recipe["orbOffset"] = [lateral, offset[1]]
    recipe["kitFit"] = {
        "waist": 0,
        "hem": 0,
        "sock": 0,
        "width": 1,
        **recipe.get("kitFit", {}),
        "collar": round(float(np.clip((binding - 171) / 680, -0.045, 0.045)), 4),
        "shoulders": round(float(np.clip((shoulder - 211) / 680, -0.045, 0.045)), 4),
    }


def orb_edits(source, native, frame, recipe):
    from .fit import pixels
    from .visor import front_orb_seed

    def measure(path, trace_rays=False):
        rgb, mask = pixels(path, keep_components=True)
        y, x = np.nonzero(mask)
        span, top, cx = np.ptp(y), y.min(), (x.min() + x.max()) / 2
        center, radius = front_orb_seed(rgb, mask, frame)
        orb = measure_sun_rays(rgb, mask, center, [radius, radius], orb_only=True)
        if orb is not None:
            rays = (
                measure_sun_rays(rgb, mask, center, [radius, radius])
                if trace_rays
                else None
            )
            return (orb - [cx, top, 0, 0]) / span, orb_swatches(rgb, orb), rays

    expected = measure(source, trace_rays=not recipe.get("sunRays"))
    actual = measure(native)
    if expected is None or actual is None:
        return []
    expected, ref_paint, rays = expected
    actual, draw_paint, _ = actual
    ratio = expected[2:] / actual[2:]
    if not np.all((0.75 < ratio) & (ratio < 1.28)):
        return []
    edits = []
    if rays:
        # The orb and the individual painted rays are independently visible.
        # A close body fit must not discard the observed ray count.
        edges, pigment = rays
        edits.append({"field": "sunRays", "value": edges})
        if pigment != recipe["paints"].get("rays"):
            edits.append({"field": "paints.rays", "value": pigment})
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
    if (rays or recipe.get("sunRays")) and abs(
        recipe["proportions"].get("crownLength", 1) - 1
    ) > 0.02:
        edits.append({"field": "proportions.crownLength", "value": 1})
    return edits


def dyed_shorts_landmarks(rgb, mask, t, u, shoulder, sock):
    """Find matching shorts hems where bare shin paint yields to two fabric panels."""
    height = np.ptp(np.flatnonzero(mask.any(1)))
    row = np.argmin(abs(t - (sock - 0.048)))
    leg_colors = []
    for side in (-1, 1):
        lane = (u * side > 0.016) & (u * side < 0.14) & mask[row]
        columns = np.flatnonzero(lane)
        spans = np.split(columns, np.flatnonzero(np.diff(columns) != 1) + 1)
        strip = max(spans, key=len)
        if len(strip) < 5:
            return
        core = strip[len(strip) // 3 : len(strip) - len(strip) // 3]
        leg_colors.append(np.median(rgb[:, core], axis=1))
    stations = []
    width = max(2, round(0.008 * height))
    for trace in leg_colors:
        filtered = ndimage.median_filter(trace, size=(width, 1))
        delta = np.linalg.norm(filtered[: -2 * width] - filtered[2 * width :], axis=1)
        skin = np.median(trace[row - width : row + width + 1], axis=0)
        candidates = np.flatnonzero(
            (t[width:-width] > shoulder + 0.13)
            & (t[width:-width] < sock - 0.068)
            & (np.linalg.norm(filtered[2 * width :] - skin, axis=1) < 54)
            & (delta > 44)
        )
        if not len(candidates):
            return
        runs = np.split(candidates, np.flatnonzero(np.diff(candidates) > 1) + 1)
        hit = runs[-1]
        hem = int(round((hit.min() + hit.max()) / 2)) + width
        # Trace the shorts dye back up to the hem of the jersey using the two
        # legs independently. A narrow contrasting band counts as part of the top.
        dye = np.median(trace[hem - round(0.028 * height) : hem - width], axis=0)
        distance = np.linalg.norm(filtered - dye, axis=1)
        different = (t > shoulder + 0.064) & (t < t[hem] - 0.052) & (distance > 48)
        windows, _ = ndimage.label(different)
        regions = [
            reg
            for reg in ndimage.find_objects(windows)
            if reg and reg[0].stop - reg[0].start >= width
        ]
        if not regions:
            return
        waist = regions[-1][0].stop
        stations.append([waist, hem])
    paired_stations = np.array(stations)
    if np.max(np.ptp(paired_stations, axis=0)) > 0.023 * height:
        return
    waist, hem = np.rint(np.mean(paired_stations, axis=0)).astype(int)
    if not 0.063 < t[hem] - t[waist] < 0.22:
        return
    # Paper must actually appear between the exposed legs just below the hem.
    center = abs(u) < 0.012
    if np.mean(mask[hem + width : hem + 3 * width, center]) > 0.42:
        return
    cloth = (t > t[waist] + 0.012) & (t < t[waist] + 0.028)
    widths = [np.ptp(u[r]) for r in mask[cloth] if r.sum() > 2]
    if not widths:
        return
    center = abs(u) < 0.015
    occupied = mask[:, center].mean(1) > 0.62
    gaps = (t > shoulder - 0.15) & (t < shoulder) & ~occupied
    starts = [
        region[0].stop
        for region in ndimage.find_objects(ndimage.label(gaps)[0])
        if region and region[0].stop - region[0].start >= width // 2
    ]
    if not starts:
        return
    collar = t[starts[-1]]
    if not 0.018 < shoulder - collar < 0.14:
        return
    return np.array([collar, shoulder, t[waist], t[hem], sock, np.median(widths)])


def _kit_color_landmarks(rgb, m):
    """Locate the jersey, shorts, bare lower legs and socks of a full kit."""
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
    trouser_rows = (
        np.flatnonzero(labels == 1 + np.bincount(labels)[1:].argmax())
        if count
        else np.array([], dtype=int)
    )
    light = (rgb.min(2) > 153) & (np.ptp(rgb, axis=2) < 76) & m
    center = abs(u) < 0.085
    neckline = (
        (t > shoulder - 0.105) & (t < shoulder) & (light[:, center].mean(1) > 0.13)
    )
    sock_light = (t < 0.91) & (light[:, lanes].mean(1) > 0.18)
    if not len(trouser_rows):
        sock = (t > 0.71) & sock_light
        if sock.any():
            return dyed_shorts_landmarks(rgb, m, t, u, shoulder, t[sock].min())
        return
    waist, hem = t[trouser_rows[[0, -1]]]
    sock = (t > max(0.65, hem + 0.06)) & sock_light
    if sock.any():
        below = (t > hem + 0.012) & (t < hem + 0.03)
        # If the middle is still solid, the dark band can be a shirt over
        # colored shorts. Confirm both leg-to-cloth transitions independently.
        if (
            hem - waist < 0.07
            or hem - waist > 0.22
            or m[below][:, abs(u) < 0.012].mean() > 0.68
        ):
            colored = dyed_shorts_landmarks(rgb, m, t, u, shoulder, t[sock].min())
            if colored is not None:
                return colored
    if hem - waist < 0.07 or not neckline.any() or not sock.any():
        return
    waist_width = np.median(
        [np.ptp(u[m[row]]) for row in trouser_rows[1:10] if m[row].any()]
    )
    return np.array(
        [t[neckline].min(), shoulder, waist, hem, t[sock].min(), waist_width]
    )


def kit_landmarks(rgb, mask):
    marks = _kit_color_landmarks(rgb, mask)
    if marks is None:
        return
    y, x = np.nonzero(mask)
    height = np.ptp(y)
    waist, hem = np.rint(y.min() + height * marks[2:4]).astype(int)
    length = hem - waist
    if length < 12:
        return marks
    # The rough dye segmentation can run down into a similarly colored
    # bare thigh. Locate the cloth-to-skin edge along both leg panels.
    radius = max(1, round(length * 0.024))
    start = max(radius, round(hem - length * 0.29))
    stop = min(len(rgb) - radius - 1, round(hem + length * 0.19))
    if stop <= start:
        return marks
    mid, width = (x.min() + x.max()) / 2, marks[5] * height
    edges = []
    for side in (-1, 1):
        cols = np.unique(
            np.rint(mid + side * width * np.linspace(0.18, 0.32, 19))
            .astype(int)
            .clip(0, rgb.shape[1] - 1)
        )
        trace = ndimage.median_filter(
            rgb[start - radius : stop + radius + 1, cols],
            size=(2 * radius + 1, 1, 1),
            mode="nearest",
        )
        delta = np.linalg.norm(trace[2 * radius :] - trace[: -2 * radius], axis=2)
        index = delta.argmax(0)
        strong = index[delta[index, np.arange(len(cols))] > 26]
        if len(strong) < max(3, 0.65 * len(cols)):
            return marks
        edge = np.median(strong)
        if np.mean(abs(strong - edge) <= max(2, length * 0.05)) < 0.68:
            return marks
        edges.append(start + edge)
    if np.ptp(edges) <= max(3, 0.09 * length):
        marks[3] = (round(float(np.mean(edges))) - y.min()) / height
    return marks


def shorts_cut(rgb, mask, landmarks, *, measure_inner=False):
    """Measure the first sustained opening between the two hems of a full kit."""
    if landmarks is None:
        return
    body_y = np.flatnonzero(mask.any(axis=1))
    height = np.ptp(body_y)
    waist, hem = np.rint(body_y[0] + landmarks[2:4] * height).astype(int)
    length = hem - waist
    if length < 12:
        return
    spans = [np.flatnonzero(row) for row in mask[waist : hem + 1]]
    if any(len(row) < 3 for row in spans):
        return
    mid = round(np.median([(row[0] + row[-1]) / 2 for row in spans]))
    width = height * landmarks[5]
    x = np.abs(np.arange(mask.shape[1]) - mid)
    center = x <= max(1, round(width * 0.012))
    legs = (x > 0.17 * width) & (x < 0.34 * width)
    below_hem = slice(hem + round(0.05 * length), hem + round(0.2 * length))
    below = rgb[below_hem, center]
    if not below.size or not legs.any():
        return
    paper = np.median(below, axis=(0, 1))
    fabric = np.median(
        rgb[waist + round(0.12 * length) : waist + round(0.42 * length), legs],
        axis=(0, 1),
    )
    cloth = mask[waist : hem + 1] & (x < 0.65 * width)
    if np.linalg.norm(paper - fabric) >= 35:
        # A cast shadow can connect the legs in the foreground mask. Read
        # its color just below the hem and the cloth on the neighboring legs.
        colors = rgb[waist : hem + 1]
        cloth &= np.linalg.norm(colors - fabric, axis=2) < np.linalg.norm(
            colors - paper, axis=2
        )
    elif mask[below_hem, center].mean() > 0.15:
        # Transparent pixels may store the garment RGB. An empty alpha gap
        # still supplies its silhouette. An ambiguous opaque gap cannot.
        return
    gap = cloth[:, center].mean(1) < 0.55
    run = max(2, round(length * 0.035))
    labels, count = ndimage.label(gap)
    # Use the opening connected to the hem. Holes higher in the garment
    # can come from the background remover or a highlight in the fabric.
    if not count or not np.any(labels[-run:] == count):
        return
    opening = np.flatnonzero(labels == count)
    if len(opening) < run or opening[0] < length * 0.14:
        return

    def span(a, b):
        rows = cloth[round(length * a) : round(length * b)]
        return (
            np.median([np.ptp(np.flatnonzero(row)) for row in rows if row.any()])
            if rows.any()
            else 0
        )

    waist_span, lower_span = span(0.09, 0.20), span(0.78, 0.93)
    if min(waist_span, lower_span) < width * 0.55:
        return
    cut = [opening[0] / length, lower_span / waist_span]
    if measure_inner:
        # Read only the central gap which actually reaches both inner hems.
        # The same paper classification excludes cast shadows between legs.
        widths = []
        for row in cloth[round(length * 0.86) : round(length * 0.96)]:
            left = np.flatnonzero(row[:mid])
            right = np.flatnonzero(row[mid:])
            if left.size and right.size and not row[mid]:
                widths.append((mid + right[0] - left[-1] - 1) / lower_span)
        if len(widths) >= max(2, round(0.05 * length)):
            cut.append(float(np.median(widths)))
    return np.array(cut)


def fitted_shorts(measure):
    return {
        "rise": round(float(np.clip(measure[0], 0.20, 0.93)), 3),
        "hemSpan": round(float(np.clip(measure[1], 0.75, 1.32)), 3),
        **(
            {"hemGap": round(float(np.clip(measure[2], 0.025, 0.42)), 3)}
            if len(measure) == 3
            else {}
        ),
    }


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
    from .fit import pixels

    source_image, native_image = (
        pixels(path, keep_components=True) for path in (source, native)
    )
    target, current = kit_landmarks(*source_image), kit_landmarks(*native_image)
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
    if recipe.get("orbCollar") and "collar" in fit:
        # The first light pixel can be a sleeve highlight. A fitted circular
        # binding already supplies the garment's center-front measurement.
        values["collar"] = fit["collar"]
    if "chestWidth" in fit:
        values["chestWidth"] = fit["chestWidth"]
    values["width"] = round(
        float(np.clip(fit.get("width", 1) * target[5] / current[5], 0.78, 1.25)), 3
    )
    from .jersey_sleeve import jersey_widths

    original = fit.get("jerseySides")
    if original:
        values["jerseySides"] = original
    seams_changed = False
    if recipe.get("plainJersey") and recipe.get("jerseySleeve"):
        a = jersey_widths(source_image[1], target)
        b = jersey_widths(native_image[1], current)
        if a is not None and b is not None:
            # The simultaneous waist correction also scales the outer edge.
            widths = np.asarray(original if original else [1, 1, 1])
            taper = np.clip((np.array([249, 281, 331]) - 219) / 67, 0, 1)
            compensation = (1 + taper * (fit.get("width", 1) - 1)) / (
                1 + taper * (values["width"] - 1)
            )
            sides = np.clip(widths * a / b * compensation, 0.65, 1.32)
            seams_changed = bool(max(abs(sides - widths)) > 0.025)
            if seams_changed:
                values["jerseySides"] = sides.round(4).tolist()
    edits = []
    if (
        seams_changed
        or max(abs(delta)) > 0.003
        or abs(target[5] / current[5] - 1) > 0.035
    ):
        edits.append({"field": "kitFit", "value": values})
    cut = recipe.get("shortsCut")
    if cut:
        wanted, seen = (
            shorts_cut(*source_image, target, measure_inner=True),
            shorts_cut(*native_image, current, measure_inner=True),
        )
        if wanted is not None and seen is not None:
            # Waist displacement tapers toward the hem on the shared rig.
            # Compensate for the concurrent width correction in this pass.
            prior_width, next_width = fit.get("width", 1), values["width"]

            def hem_to_waist(width):
                return (1 + 0.38 * (width - 1)) / width

            fit_cut = fitted_shorts(
                [
                    cut["rise"] + wanted[0] - seen[0],
                    cut["hemSpan"]
                    * wanted[1]
                    / seen[1]
                    * hem_to_waist(prior_width)
                    / hem_to_waist(next_width),
                    *(
                        [cut["hemGap"] + wanted[2] - seen[2]]
                        if "hemGap" in cut and len(wanted) == len(seen) == 3
                        else []
                    ),
                ]
            )
            if fit_cut != cut:
                edits.append({"field": "shortsCut", "value": fit_cut})
    return edits


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
