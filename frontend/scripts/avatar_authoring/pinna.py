"""Measure the exposed contour and ink inside an ear in its own frontal plane."""

import numpy as np
from scipy import ndimage

from .tracing import outline_mark


def paper_rim(path, solid, colors, light, skin, paper):
    """Locate both half-intensity crossings of an ink line against paper."""
    visible = np.flatnonzero(solid & ~light)
    if not len(visible):
        return None
    last = visible[-1]
    exterior = np.flatnonzero(light & (path > path[last]))
    if not len(exterior):
        return None
    limit = exterior[0]
    band = colors[last + 1 : limit]
    if len(band) < 2 or path[limit] - path[last] >= 0.40:
        return None
    low = band.mean(axis=1).argmin()
    ink = band[low]
    if ink.mean() >= skin.mean() - 44:
        return None
    start = last + 1 + low
    midpoint = (ink.mean() + paper.mean()) / 2
    ends = np.flatnonzero(colors[start : limit + 1].mean(1) >= midpoint)
    end = start + ends[0] if len(ends) else limit
    half = (ink.mean() + skin.mean()) / 2
    lighter = np.flatnonzero(colors[:start].mean(1) >= half)
    inner = (
        path[last]
        if not len(lighter)
        else (path[lighter[-1]] + path[lighter[-1] + 1]) / 2
    )
    return inner, path[end] - inner, ink


def lobe_contour(patch, inside, flesh, skin, paper):
    # Read the outside edge on radial scans. An interior crease can
    # interrupt the flesh. Only a sustained gap ends a scan.
    angles = np.arange(16) * (2 * np.pi / 16)
    path = np.linspace(0.035, 1.45, 72)
    edge, borders, pen = [], [], []
    for angle in angles:
        ca, sa = np.cos(angle), np.sin(angle)
        xx = np.rint(48 + path * ca * 32).astype(int)
        yy = np.rint(48 + path * sa * 32).astype(int)
        solid = flesh[yy, xx]
        colors = patch[yy, xx]
        # The lobe detector locates skin inside the outline. Measure
        # the ink between skin and paper so its outside lies beyond
        # that radius, preserving the area of the exposed skin.
        light = (~inside[yy, xx]) | (abs(colors - paper).max(axis=1) < 38)
        rim = paper_rim(path, solid, colors, light, skin, paper) if ca > -0.34 else None
        if rim is not None:
            inner, width, ink = rim
            edge.append(inner)
            pen.append(width)
            borders.append(ink)
            continue
        gaps = np.convolve((~solid).astype(int), np.ones(9), mode="valid")
        ends = np.flatnonzero((gaps == 9) & (path[: len(gaps)] > 0.38))
        if len(ends):
            end = int(ends[0])
            edge.append(path[end])
            borders.append(patch[yy[end : end + 5], xx[end : end + 5]].mean(axis=0))
        else:
            # The uninterrupted, skin-colored attachment sinks into the cheek.
            edge.append(1.18)
    if len(borders) < 7:
        return None
    edge = np.clip(edge, 0.38, 1.35)
    # Hair hides the attachment and can cross the top of the lobe.
    # Use the exposed outer ellipse to complete that hidden volume.
    outer = edge.copy()
    for i, a in enumerate(angles):
        if np.cos(a) < 0.25 or outer[i] < 0.72:
            sample = edge[(8 - i) % 16]
            outer[i] = sample if np.cos(a) < -0.25 and 0.72 <= sample <= 1.24 else 1.0
    # The hair-to-ear contact can hide the upper inner arc even though
    # the remaining lobe is round. Keep the exposed arc below that cut.
    covered = (np.sin(angles) < -0.10) & (np.cos(angles) < 0.48)
    edge = np.where(covered, edge, outer).clip(0.38, 1.24)
    width = float(np.clip(np.median(pen) if pen else 0.13, 0.075, 0.27))
    ink = np.percentile(borders, 18, axis=0)
    fade = np.clip((np.cos(angles) + 0.56) / 0.71, 0, 1)
    edge += width * fade
    return {
        "radii": np.round(edge, 3).tolist(),
        "inkWidth": round(width, 3),
        "ink": "#" + ink.round().astype("uint8").tobytes().hex(),
    }


def helix_folds(patch, inside, u, v, skin):
    interior = (u * u + v * v < 0.82**2) & (u > -0.49)
    lum = patch.mean(2)
    # A shallow helix is a narrow dark stroke between two strips of
    # flesh. The much broader neighboring hair has the same pigment.
    bracket = np.zeros_like(inside)
    for angle in np.arange(8) * np.pi / 8:
        dy, dx = np.rint(9 * np.array([np.sin(angle), np.cos(angle)])).astype(int)
        bright = []
        for sign in (-1, 1):
            move = (sign * dy, sign * dx)
            nearby = np.roll(patch, move, axis=(0, 1))
            bright.append(
                (np.linalg.norm(nearby - skin, axis=2) < 64)
                & (nearby.mean(2) > lum + 22)
            )
        bracket |= bright[0] & bright[1]
    dark = bracket & (lum < skin.mean() - 32) & inside & interior
    labels, _ = ndimage.label(dark, structure=np.ones((3, 3)))
    strokes = []
    for label, box in enumerate(ndimage.find_objects(labels), 1):
        if box is None:
            continue
        part = labels == label
        if part.sum() < 36 or part.sum() > interior.sum() * 0.40:
            continue
        if u[part].max() < 0.08 or max(np.ptp(u[part]), np.ptp(v[part])) < 0.32:
            continue
        mark = outline_mark(
            ndimage.binary_fill_holes(part), np.median(patch[part], axis=0)
        )
        if mark:
            strokes.append((part.sum(), mark))
    return [
        {
            "outline": (np.array(mark["outline"]) * 3 - 1.5).round(3).tolist(),
            "ink": mark["color"],
        }
        for _, mark in sorted(strokes, key=lambda pair: -pair[0])[:2]
    ]


def frontal_pinnae(rgb, mask, center, top, head_width, head_height, ears, skin, hair):
    if not len(ears):
        return []
    result = []
    axis = np.linspace(-1.5, 1.5, 97)
    u, v = np.meshgrid(axis, axis)
    paper = np.median(rgb[:5, :5], axis=(0, 1))
    matte = mask.astype(float)
    for x, y, rx, ry in ears:
        side = int(np.sign(x))
        mid = np.array([center + x * head_width, top + y * head_height])
        radii = np.array([rx * head_width, ry * head_height])
        if radii.min() < 4:
            continue
        # Keep outward positive on both temples, including a mirrored drawing.
        coords = [mid[1] + v * radii[1], mid[0] + side * u * radii[0]]
        patch = np.stack(
            [
                ndimage.map_coordinates(rgb[:, :, i], coords, order=1, mode="nearest")
                for i in range(3)
            ],
            axis=2,
        )
        inside = ndimage.map_coordinates(matte, coords, order=1) > 0.5
        ds = np.linalg.norm(patch - skin, axis=2)
        dh = np.linalg.norm(patch - hair, axis=2)
        flesh = inside & (ds < 81) & (ds + 15 < dh)
        if flesh[(abs(u) < 0.34) & (abs(v) < 0.55)].mean() <= 0.38:
            continue
        contour = lobe_contour(patch, inside, flesh, skin, paper)
        if contour:
            pinna = {"side": side, **contour}
            folds = helix_folds(patch, inside, u, v, skin)
            if folds:
                pinna["folds"] = folds
            result.append(pinna)
    return result if any(p.get("folds") for p in result) else []
