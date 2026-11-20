"""Measure a Rick-family household character from a single isolated T-pose."""

import numpy as np
from scipy import ndimage

from .crown import crown_edges
from .fringe import forehead_fringe
from .pinna import frontal_pinnae
from .eye_review import lid_pupil, portrait_pair
from .household import (
    fit_frontal_features,
    fit_portrait,
    frontal_lobes,
    paint,
    pigment,
    scalp_boundary,
)

BODY_SECTIONS = {
    "torso",
    "pelvis",
    "arm",
    "leg",
    "shoe",
    "ankle",
    "sleeve",
    "handScale",
    "leftReach",
    "pelvisX",
    "hemRise",
    "garmentEdges",
    "crew",
    "outsole",
    "openHands",
    "seams",
}


def has_ink_outline(rgb, mask, bounds):
    """Two distant sections must show dark edge paint beside lighter pigment."""
    _, top, _, bottom = bounds
    height = bottom - top
    for lo, hi in ((0.36, 0.47), (0.58, 0.85)):
        votes = []
        for y in np.linspace(top + height * lo, top + height * hi, 31).astype(int):
            xs = np.flatnonzero(mask[y])
            if len(xs) < 6:
                continue
            for x, side in ((xs[0], 1), (xs[-1], -1)):
                ix = np.clip(
                    x + side * np.arange(max(3, round(height * 0.005))),
                    0,
                    rgb.shape[1] - 1,
                )
                near = rgb[y, ix].mean(1).min()
                inside = rgb[
                    y, np.clip(x + side * round(height * 0.012), 0, rgb.shape[1] - 1)
                ].mean()
                votes.append(near < 82 and inside - near > 58)
        if not votes or np.mean(votes) < 0.25:
            return False
    return True


def painted_brow(rgb, bounds):
    """Recover the filled eyebrow independently of the eyelid ink."""
    x, y, r, b = bounds
    cx, cy = (x + r) / 2, (y + b) / 2
    rx, ry = (r - x) / 2, (b - y) / 2
    reach = ry
    # A lowered lid exposes only the lower half of its globe. The brow
    # stays on the full orbital arch as the visible aperture narrows.
    if rx > 1.4 * ry:
        eye = rgb[y:b, x:r]
        white = (eye.min(2) > 183) & (np.ptp(eye, axis=2) < 25)
        if lid_pupil(white, eye) is not None:
            reach = min(rx, 1.84 * ry)
    lx, ty = max(0, round(cx - 1.12 * rx)), max(0, round(cy - 2.45 * reach))
    area = rgb[ty : max(ty, y - 2), lx : min(rgb.shape[1], round(cx + 1.12 * rx))]
    if not area.size:
        return None
    ink = area.max(2) < 84
    # A fringe and a brow can share both paint and a connected component.
    # Read only runs separated from the top of the search window by skin.
    # An exposed brow can taper into the fringe at either end.
    clipped = np.logical_and.accumulate(ink, axis=0)
    ink = ink & ~clipped
    labels, _ = ndimage.label(ink, structure=np.ones((3, 3)))
    parts = []
    for label, box in enumerate(ndimage.find_objects(labels), start=1):
        if box is None:
            continue
        yy, xx = np.where(labels == label)
        if (
            np.ptp(xx) < 0.85 * rx
            or len(xx) < rx * ry * 0.11
            or np.ptp(yy) > reach * 1.25
        ):
            continue
        parts.append((len(xx), yy, xx))
    if not parts:
        return None
    _, ys, xs = max(parts, key=lambda part: part[0])
    upper = []
    lower = []
    for col in np.unique(np.rint(np.linspace(xs.min(), xs.max(), 10)).astype(int)):
        row = ys[xs == col]
        if not len(row) or np.ptp(row) > reach * 0.6:
            continue
        u = round((col + lx - cx) / rx, 3)
        upper.append([u, round((row.min() + ty - cy) / ry, 3)])
        lower.append([u, round((row.max() + 0.5 + ty - cy) / ry, 3)])
    if len(upper) < 4:
        return None
    return {
        "browRim": upper + lower[::-1],
        "browColor": paint(np.median(area[ys, xs], axis=0)),
    }


def orbital_ink(orbit, drawn, bounds, scale, center, crown):
    """Register the measured pen strokes to the white, independent of skull size."""
    x, y, r, b = bounds
    radii = np.array([(r - x) / 2, (b - y) / 2])
    mid = np.array([(x + r) / 2 - center, (y + b) / 2 - crown])
    stroke = drawn.get("rimInk")
    if stroke:
        orbit["rimInk"] = {
            "width": round(
                float(np.clip(stroke["width"] / (radii[0] * scale), 0.018, 0.28)), 4
            ),
            "color": stroke["color"],
        }
    if drawn.get("browOccluded"):
        orbit.pop("browRim", None)
        orbit.pop("browColor", None)
        orbit.pop("brow", None)
        orbit["browOccluded"] = True
    elif drawn.get("browRim"):
        points = ((np.asarray(drawn["browRim"]) - [0, 12]) / scale - mid) / radii
        if 6 <= len(points) <= 24 and np.all(
            (points >= [-1.3, -2.8]) & (points <= [1.3, -0.7])
        ):
            orbit["browRim"] = points.round(3).tolist()
            orbit["browColor"] = drawn["browColor"]


def outlined_collar(
    rgb, center, chin, shoulder_y, head_width, skin, shirt, scale, crown
):
    """Read the two nested ink arcs of a crew collar around a skin opening."""
    cols = []
    bottoms = []
    y0 = chin + 2
    y1 = round(shoulder_y + head_width * 0.18)
    if y1 <= y0 + 4:
        return None
    cx = round(center)
    for x in range(
        max(0, round(cx - head_width * 0.33)),
        min(rgb.shape[1], round(cx + head_width * 0.33)),
    ):
        v = rgb[y0:y1, x]
        cloth = np.flatnonzero(np.linalg.norm(v - shirt, axis=1) < 46)
        skin_rows = np.flatnonzero(np.linalg.norm(v - skin, axis=1) < 64)
        if not len(cloth) or not len(skin_rows):
            continue
        y = cloth[0]
        before = skin_rows[skin_rows < y]
        if len(before) < 4 or y - before[-1] > max(7, head_width * 0.045):
            continue
        cols.append(x)
        bottoms.append(y + y0)
    if len(cols) < 9 or cx not in cols:
        return None
    xs = np.array(cols)
    bottoms = np.array(bottoms)
    group = next(
        ids
        for ids in np.split(np.arange(len(xs)), np.flatnonzero(np.diff(xs) > 2) + 1)
        if cx in xs[ids]
    )
    xs = xs[group]
    bottoms = bottoms[group]
    radius = (np.ptp(xs) + 1) / 2
    if radius < 4 or not 0.07 < radius / head_width < 0.32:
        return None
    base = bottoms.min() - 1
    bottom = np.median(bottoms[abs(xs - cx) < radius * 0.3])
    drop = bottom - base
    if drop < 2 or drop > radius * 1.3:
        return None
    strip = rgb[
        round(bottom) + 1 : round(bottom + radius * 0.85), max(0, cx - 1) : cx + 2
    ].mean(axis=1)
    if len(strip) < 3:
        return None
    dark = np.flatnonzero(strip.mean(axis=1) < min(105, shirt.mean() * 0.58))
    if not len(dark):
        return None
    return {
        "center": round(((xs[0] + xs[-1]) / 2 - center) * scale, 2),
        "top": round((base - crown) * scale + 12, 2),
        "radius": round(radius * scale, 2),
        "drop": round(drop * scale, 2),
        "binding": round((np.median(dark) + 1) * scale, 2),
        "ink": paint(np.median(strip[dark], axis=0)),
    }


def crown_sides(rgb, mask, axis, top, chin, width, hair, skin):
    """Read the swept crown outside the convex skull, retaining its depth in the rig."""
    xs = np.arange(
        max(0, round(axis - width * 0.8)),
        min(mask.shape[1], round(axis + width * 0.8) + 1),
    )
    if len(xs) < 12 or np.linalg.norm(hair - skin) < 48:
        return None
    ys = np.arange(top, min(len(mask), round(top + (chin - top) * 0.46) + 1))
    patch = rgb[np.ix_(ys, xs)]
    dh = np.linalg.norm(patch - hair, axis=2)
    ds = np.linalg.norm(patch - skin, axis=2)
    cap = (dh < 65) & (dh + 15 < ds) & mask[np.ix_(ys, xs)]
    labels, count = ndimage.label(cap, np.ones((3, 3)))
    if not count:
        return None
    # Black parting ink can divide a single haircut into two large locks.
    # Reunite only pigment islands rooted in the upper crown.
    sizes = np.bincount(labels.ravel())
    rooted = np.unique(labels[: max(1, round((chin - top) * 0.23))])
    cap = np.isin(labels, [i for i in rooted if i and sizes[i] >= cap.sum() * 0.045])
    bounds = []
    for y, row in enumerate(cap):
        hit = xs[row]
        if len(hit) >= 2:
            bounds.append([y, hit[0], hit[-1]])
    if len(bounds) < 9 or bounds[0][0] > (chin - top) * 0.075:
        return None
    y, left, right = np.asarray(bounds).T
    # Once the face opening moves off the part, the two outer edges must
    # still bracket the forehead. A single sideburn cannot size the skull.
    if min(np.max(axis - left), np.max(right - axis)) < width * 0.30:
        return None
    t = np.linspace(y[0], (chin - top) * 0.44, 12)
    edges = np.column_stack(
        [np.interp(t, y, (v - axis) / width) for v in (left, right)]
    )
    edges[0] = np.mean(edges[0])
    return np.clip(edges, -0.85, 0.85).round(4).tolist()


def nape_height(rgb, mask, axis, top, chin, width, skin, hair):
    """Find the end of the hair mass behind each ear without following jaw ink."""
    if np.linalg.norm(hair - skin) < 42:
        return None
    height = chin - top
    lo = max(0, round(axis - 0.8 * width))
    hi = min(mask.shape[1], round(axis + 0.8 * width) + 1)
    patch = rgb[top : chin + 1, lo:hi]
    dh = np.linalg.norm(patch - hair, axis=2)
    ds = np.linalg.norm(patch - skin, axis=2)
    cap = (dh < 55) & (dh + 18 < ds) & mask[top : chin + 1, lo:hi]
    # A dark jaw contour can share the hair swatch. Keep colored locks wide
    # enough to survive erosion and connected to the upper cap after opening.
    brush = np.ones((max(2, round(height * 0.016)), max(3, round(width * 0.033))), bool)
    labels, count = ndimage.label(ndimage.binary_opening(cap, brush), np.ones((3, 3)))
    if not count:
        return None
    roots = np.unique(labels[: max(1, round(height * 0.40))])
    cap = np.isin(labels, roots[roots > 0])
    u = (np.arange(lo, hi) - axis) / width
    ends = []
    for side in (-1, 1):
        counts = cap[:, (side * u > 0.24) & (side * u < 0.75)].sum(axis=1)
        ys = np.flatnonzero(counts >= max(3, width * 0.032))
        if not len(ys):
            return None
        ends.append((ys[-1] + 0.5) / height)
    return round(float(np.clip(np.mean(ends), 0.5, 0.97)), 3)


def hair_fall(rgb, mask, center, top, chin, width, hair, skin):
    """Sample a joined curtain only when locks flank the neck beyond the chin."""
    if np.linalg.norm(hair - skin) < 42:
        return None
    height = chin - top
    xs = np.arange(
        max(0, round(center - width)), min(mask.shape[1], round(center + width))
    )
    offsets = (xs - center) / width
    rows = []
    for t in np.linspace(0.15, 1.43, 24):
        y = round(top + t * height)
        if y >= mask.shape[0]:
            break
        v = rgb[y, xs]
        dh = np.linalg.norm(v - hair, axis=1)
        lock = (dh < 60) & (dh + 16 < np.linalg.norm(v - skin, axis=1)) & mask[y, xs]
        sides = []
        for side in (-1, 1):
            u = offsets * side
            hits = u[lock & (u > 0.115) & (u < 0.94)]
            if len(hits) < max(2, width * 0.032):
                break
            sides.append([np.percentile(hits, 96), np.percentile(hits, 4)])
        if len(sides) != 2:
            if t > 1:
                break
            continue
        outer, inner = np.mean(sides, axis=0)
        if t < 0.55:
            inner = max(inner, outer * 0.76)
        if outer <= 0.16 or inner > outer - 0.012:
            continue
        rows.append(
            [round(float(t), 3), round(float(outer), 3), round(float(inner), 3)]
        )
    # A chin-length bob has broad locks on both sides of the lower jaw.
    # A cropped cap and the narrow outline around a cheek end much earlier.
    bob = (
        len([1 for t, outer, inner in rows if 0.74 < t < 1 and outer - inner > 0.075])
        >= 3
        and rows[-1][0] >= 0.9
    )
    if len(rows) < 7 or (rows[-1][0] < 1.05 and not bob) or rows[0][0] > 0.49:
        return None
    if len(rows) > 16:
        rows = [rows[i] for i in np.linspace(0, len(rows) - 1, 16).round().astype(int)]
    return rows


def trouser_opening(rgb, mask, ix, first, last, scale, paper, pants):
    """Follow the paper between two thighs back to the tip of the opening."""
    reach = max(2, round(49 / scale))
    xs = np.arange(max(0, ix - reach), min(mask.shape[1], ix + reach + 1))
    rows = np.arange(first, last + 1)
    patch = rgb[np.ix_(rows, xs)]
    paper_distance = np.linalg.norm(patch - paper, axis=2)
    pants_distance = np.linalg.norm(patch - pants, axis=2)
    empty = (~mask[np.ix_(rows, xs)]) | (paper_distance < 0.6 * pants_distance)
    # Seed only the gap bracketed by cloth. A pale pocket, or the paper
    # outside a narrow leg, must not raise the measured crotch.
    cloth = np.flatnonzero(~empty[-1])
    if len(cloth) < 2:
        return None
    middle = np.arange(len(xs))
    seed = np.zeros_like(empty)
    seed[-1] = (
        empty[-1]
        & (abs(xs - ix) < 15 / scale)
        & (middle > cloth[0])
        & (middle < cloth[-1])
    )
    gap = ndimage.binary_propagation(seed, structure=np.ones((3, 3)), mask=empty)
    if gap[:, 0].any() or gap[:, -1].any() or not gap.any():
        return None
    return int(first + np.flatnonzero(gap.any(axis=1))[0])


def inked_sections(rgb, mask, center, crown, scale, arm_y, samples, body):
    """Follow the two edges of a clothed limb through paper grain and contour ink."""
    h, w = mask.shape
    sections = body["sections"]
    paper = np.median(np.vstack((rgb[0], rgb[-1])), axis=0)

    def x_at(x):
        return int(np.clip(round(center + x / scale), 0, w - 1))

    def y_at(y):
        return int(np.clip(round(crown + (y - 12) / scale), 0, h - 1))

    def level(y):
        return round((y - crown) * scale + 12, 2)

    visible = mask & (abs(rgb - paper).max(axis=2) > 38)
    # A pale forearm can differ from cream paper mostly in its blue channel.
    # Use the same color distance as the silhouette being measured.
    if all(
        np.max(abs(pigment(rgb, samples[k]) - paper)) > 45 for k in ("shirt", "skin")
    ):
        cut = sections["sleeve"]

        # The distal ring of the sleeve is a stable guide through the armpit,
        # where the arm's silhouette is shared with the shirt front.
        def arm_span(x):
            ix = x_at(x)
            lo = max(0, round(arm_y - body["armRadius"] * 2.3 / scale))
            hi = min(h, round(arm_y + body["armRadius"] * 2.3 / scale) + 1)
            ys = np.flatnonzero(visible[lo:hi, ix])
            if len(ys) < 3:
                return None
            groups = np.split(ys, np.flatnonzero(np.diff(ys) > 2) + 1)
            hit = min(groups, key=lambda g: abs(np.median(g) + lo - arm_y))
            if abs(np.median(hit) + lo - arm_y) > body["armRadius"] / scale:
                return None
            return lo + hit[0], lo + hit[-1]

        cuff = arm_span(cut - 2)
        if cuff:
            mid = sum(cuff) / 2
            radius = (cuff[1] - cuff[0] + 1) / 2
            for row in sections["arm"]:
                span = arm_span(row[0])
                if not span:
                    continue
                upper, lower = span
                if row[0] <= cut:
                    upper = max(upper, mid - radius * 1.15)
                    lower = min(lower, mid + radius * 1.15)
                if lower > upper + 2:
                    row[1:] = [
                        level((upper + lower) / 2),
                        round((lower - upper + 1) / 2 * scale, 2),
                    ]
    pants = pigment(rgb, samples["trousers"])
    if np.linalg.norm(pants - paper) < 92:
        return
    ix = x_at(sections.get("pelvisX", 0))
    first = y_at(body["hem"] + 2)
    last = y_at(sections["leg"][1][0])
    if last <= first + 3:
        return
    opening = trouser_opening(rgb, mask, ix, first, last, scale, paper, pants)
    if opening is None:
        return
    fork = level(opening)
    pelvis = sections["pelvis"]
    if not body["hem"] + 4 < fork < sections["leg"][1][0] - 1:
        return
    for j, row in enumerate(pelvis):
        row[0] = round(pelvis[0][0] + (fork - pelvis[0][0]) * j / (len(pelvis) - 1), 2)
    leg = sections["leg"]
    leg[0][0] = round(fork + 0.7, 2)
    # Measure both legs at the newly located fork. The old radius was fit
    # at another height, often well below the inner edge of the trousers.
    y = y_at(leg[0][0])
    xs = np.flatnonzero(
        mask[y]
        & (
            np.linalg.norm(rgb[y] - pants, axis=1)
            < 1.1 * np.linalg.norm(rgb[y] - paper, axis=1)
        )
    )
    near = xs[abs(xs - ix) < 79 / scale] - ix
    sides = [near[near >= 0], -near[near <= 0]]
    if all(len(side) >= 4 for side in sides):
        inner, outer = np.mean([(s.min(), s.max()) for s in sides], axis=0) * scale
        leg[0][1:] = [
            round((outer + inner) / 2, 2),
            round((outer - inner + scale) / 2, 2),
        ]
    for yrow in leg[1:]:
        y = y_at(yrow[0])
        xs = np.flatnonzero(visible[y, ix:]) + ix
        if len(xs) < 3:
            continue
        runs = np.split(xs, np.flatnonzero(np.diff(xs) > 2) + 1)
        limb = max(runs, key=len)
        if not len(limb) > 4:
            continue
        yrow[1:] = [
            round(((limb[0] + limb[-1]) / 2 - ix) * scale, 2),
            # The dark edge and its antialiasing straddle the trouser contour.
            # Center the section between the paper mask and the solid stroke.
            round((yrow[2] + (np.ptp(limb) + 1) * scale / 2) / 2, 2),
        ]


def garment_edges(rgb, center, crown, scale, body, fabric, trousers):
    """Read a split hem and a rolled cuff when the drawing shows their seams."""
    sections = body["sections"]
    edges = {}
    length = body["hem"] - body["neckline"]
    half_width = sections["torso"][-1][1] / scale
    waist = center + sections.get("pelvisX", 0) / scale
    hem = round(crown + (body["hem"] + 4 - 12) / scale)
    reach = round(0.24 * length / scale)
    if np.linalg.norm(fabric - trousers) > 58 and hem >= reach and reach >= 6:
        # Locate the paint change on both sides of the placket. A front split
        # has two lower corners with trouser pigment directly beneath each.
        u = np.linspace(-0.84, 0.84, 33)
        xs = np.rint(waist + u * half_width).astype(int).clip(0, rgb.shape[1] - 1)
        patch = rgb[hem - reach : hem + reach + 1, xs]
        cloth = np.linalg.norm(patch - fabric, axis=2)
        pants = np.linalg.norm(patch - trousers, axis=2)
        heights = np.full(len(u), np.nan)
        for i in range(len(u)):
            dyed = np.flatnonzero((cloth[:, i] < 65) & (cloth[:, i] + 15 < pants[:, i]))
            if not len(dyed):
                continue
            last = dyed[-1]
            below = np.flatnonzero(
                (pants[last + 1 :, i] < 75)
                & (pants[last + 1 :, i] + 15 < cloth[last + 1 :, i])
            )
            if len(below) and below[0] < reach * 0.42:
                heights[i] = (last + (1 + below[0]) / 2 - reach) * scale / length
        valid = np.isfinite(heights)
        if valid.mean() > 0.7 and np.any(valid & (abs(u) < 0.10)):
            heights = np.interp(u, u[valid], heights[valid])
            notch = heights[abs(u) < 0.1].min()
            if all(
                heights[(u * side > 0.1) & (u * side < 0.49)].max() - notch > 0.07
                for side in (-1, 1)
            ):
                # A fixed array over the front half makes the same edge usable
                # on a wider or narrower torso. The plain back meets both sides.
                edges["frontHem"] = (
                    np.interp(np.linspace(-1, 1, 25), u, heights)
                    .clip(-0.24, 0.24)
                    .round(4)
                    .tolist()
                )

    cut = sections["sleeve"]
    arm = np.array(sections["arm"])
    radius = np.interp(cut, arm[:, 0], arm[:, 2])
    # A rolled cuff has an ink line across the sleeve, with cloth of the
    # same hue before and after it. Sample the middle to exclude silhouette ink.
    offsets = np.arange(3, min(cut - arm[0, 0], radius * 1.7), scale)
    if len(offsets) < 5:
        return edges
    xs = np.rint(center + (cut - offsets) / scale).astype(int).clip(0, rgb.shape[1] - 1)
    ys = np.interp(cut - offsets, arm[:, 0], arm[:, 1])
    scan = crown + (ys + np.linspace(-0.46, 0.46, 9)[:, None] * radius - 12) / scale
    colors = rgb[np.rint(scan).astype(int).clip(0, rgb.shape[0] - 1), xs]
    luma = np.array([0.213, 0.715, 0.072])
    dark = ((colors @ luma) < fabric @ luma - 26).mean(axis=0)
    fabric_hits = (np.linalg.norm(colors - fabric, axis=2) < 38).mean(axis=0)
    for i in np.flatnonzero(dark >= 0.55):
        if (
            i >= 2
            and i + 2 < len(offsets)
            and min(fabric_hits[i - 2], fabric_hits[i + 2]) >= 0.65
        ):
            edges["rolledCuff"] = round(float(offsets[i]), 2)
            break
    return edges


def fit_footwear(rgb, mask, center, crown, scale, body, outfit, skin):
    """Trace the leather opening, sole and visible ankle separately on an inked foot."""
    from .tracing import lace_strokes, simplify_columns

    sections = body["sections"]
    offset = sections.get("pelvisX", 0)
    x0 = max(0, round(center + offset / scale))
    cuff, axis, radius = sections["leg"][-1]
    y0 = max(0, round(crown + (cuff - 12) / scale))
    patch = rgb[y0:, x0:]
    figure = mask[y0:, x0:]
    shoe = np.array(list(bytes.fromhex(outfit["shoes"][1:])))
    paper = np.median(np.vstack((rgb[0], rgb[-1])), axis=0)
    if np.linalg.norm(shoe - paper) < 85 or np.linalg.norm(shoe - skin) < 45:
        return
    distance = np.linalg.norm(patch - shoe, axis=2)
    labels, count = ndimage.label((distance < 39) & figure, np.ones((3, 3)))
    if not count:
        return
    counts = np.bincount(labels.ravel())[1:]
    upper = labels == (1 + counts.argmax())
    yy, xx = np.where(upper)
    width = np.ptp(xx) + 1
    if width < 10 or np.ptp(yy) < 4 or abs(np.median(xx) * scale - axis) > radius * 2:
        return

    # The paper can be the same colour as the outsole. Its painted bottom
    # edge, directly below the upper on each column, locates the real floor.
    edge = (np.abs(patch - paper).max(axis=2) > 68) & figure
    slabs, band = [], []
    for x in np.unique(xx):
        dyed = np.flatnonzero(upper[:, x])
        if len(dyed) < 2:
            continue
        top, last = dyed[0], dyed[-1]
        low = min(len(patch), last + max(4, round(width * 0.21)))
        rim = np.flatnonzero(edge[last:low, x])
        floor = last + (rim[-1] if len(rim) else 0)
        slabs.append([x, max(0, top - 1), last, floor])
        if floor - last >= max(4, width * 0.075):
            band.append(patch[(last + floor) // 2, x])
    if len(slabs) < max(7, width * 0.72):
        return
    sole = np.median(band, axis=0) if len(band) >= width * 0.4 else shoe * 0.72
    contrasting = np.linalg.norm(sole - shoe) > 48 and len(band) >= width * 0.4
    cols = np.array(slabs, dtype=float)
    if not contrasting:
        cols[:, 2] = np.maximum(cols[:, 1], cols[:, 3] - max(1, width * 0.025))
        sole = shoe * 0.72
    ankle_x = round((axis + offset) / scale + center) - x0
    trousers = np.array(list(bytes.fromhex(outfit["trousers"][1:])))
    traced = inked_foot_columns(
        patch,
        figure,
        paper,
        upper,
        shoe,
        trousers,
        ankle_x,
        radius / scale,
        contrasting,
    )
    if traced is None:
        # A solid boot can lack a separate ankle. Preserve its painted upper.
        hem = 0
        cols = np.column_stack((cols[:, 0], cols[:, 1], cols[:, 1:]))
    else:
        cols, hem = traced
    cols[:, 1:] = ndimage.gaussian_filter1d(
        ndimage.median_filter(cols[:, 1:], size=(3, 1)), 0.72, axis=0, mode="nearest"
    )
    # Keep the floor registered to the whole figure after discarding its paper halo.
    floor = np.where(figure)[0].max()
    foot_scale = min(1.25, (floor - hem) / max(1, cols[:, 4].max() - hem))

    def level(y):
        return (hem + (y - hem) * foot_scale + y0 - crown) * scale + 12

    def lateral(x):
        return (x + x0 - center) * scale - offset

    # Decimate the ankle and leather together. Thinning the leather first
    # can skip the column at which a low-cut shoe exposes the instep.
    rows = simplify_columns(cols[:, 0], cols[:, 1:], 9, max(0.55, width * 0.011))
    outsole = {
        "rows": np.column_stack((lateral(rows[:, 0]), level(rows[:, 2:])))
        .round(2)
        .tolist(),
        "color": paint(sole),
    }
    laces = []
    for stroke in lace_strokes(patch, cols, shoe):
        xs, ys = stroke.T
        knots = np.linspace(xs[0], xs[-1], min(5, len(xs)))
        levels = np.interp(knots, xs, ndimage.gaussian_filter1d(ys.astype(float), 0.9))
        laces.append(
            {
                "points": np.column_stack((lateral(knots), level(levels)))
                .round(2)
                .tolist(),
                "color": paint(np.median(patch[ys, xs], axis=0)),
                "radius": round(float(np.clip(scale * 0.68, 0.35, 1.6)), 2),
            }
        )
    if laces:
        outsole["laces"] = laces
    # Match the border in leather, outsole and the low opening of an unlined flat.
    contour = []
    for x, _, _, base_y in slabs:
        contour.append(patch[int(base_y), int(x)])
    dark = np.asarray(contour)
    luma = dark @ [0.213, 0.715, 0.072]
    border = np.median(dark[luma <= np.percentile(luma, 35)], axis=0)
    if border.mean() + 10 < shoe.mean():
        outsole["ink"] = paint(border)
    sections["outsole"] = outsole
    shoe_rows = []
    for y in np.linspace(cols[:, 2].min() + 0.1, cols[:, 4].max() - 0.3, 10):
        xs = cols[(cols[:, 2] <= y) & (cols[:, 4] >= y), 0]
        if len(xs) > 1:
            shoe_rows.append(
                [
                    level(y),
                    lateral((xs.min() + xs.max()) / 2),
                    (np.ptp(xs) + 1) * scale / 2,
                ]
            )
    if len(shoe_rows) >= 4:
        sections["shoe"] = np.round(shoe_rows, 2).tolist()

    if (level(rows[:, 2]) - level(rows[:, 1]) > 1).sum() < 2:
        return
    if hem > 0 and level(hem + 1) > sections["leg"][-2][0]:
        sections["leg"][-1][0] = round(float(level(hem + 1)), 2)
    # Sample inside the cuff along the shin axis. A pale sock must have
    # visible ink on both sides so blank paper cannot become clothing.
    near = cols[abs(cols[:, 0] - ankle_x) <= max(2, radius / scale * 0.25)]
    if not len(near):
        return
    ankle = []
    for y in range(1, min(len(patch), round(np.median(near[:, 2])))):
        reach = max(2, round(radius / scale * 1.1))
        lo, hi = max(0, ankle_x - reach), min(patch.shape[1], ankle_x + reach + 1)
        if not lo < ankle_x < hi - 1:
            continue
        left = np.flatnonzero(edge[y, lo:ankle_x])
        right = np.flatnonzero(edge[y, ankle_x + 1 : hi])
        if not len(left) or not len(right):
            continue
        # The sock interior is brighter than both ink boundaries.
        l, r = lo + left[-1], ankle_x + 1 + right[0]
        if r - l >= max(4, radius / scale * 0.4):
            ankle.extend(patch[y, l + 1 : r])
    ankle_paint = skin
    if len(ankle) >= 6:
        dye = np.median(ankle, axis=0)
        if np.linalg.norm(dye - skin) > 45 and np.linalg.norm(dye - shoe) > 45:
            ankle_paint = dye
    outsole["collar"] = {
        "tops": level(rows[:, 1]).round(2).tolist(),
        "color": paint(ankle_paint),
    }


def inked_foot_columns(
    patch, figure, paper, leather, shoe, trousers, ankle_x, radius, contrasting
):
    """Follow connected ink from a measured trouser hem down to the floor."""
    ys, xs = np.where(leather)
    width = np.ptp(xs) + 1
    x = np.arange(patch.shape[1])
    near_foot = (x >= xs.min() - width * 0.12) & (x <= xs.max() + width * 0.12)
    ink = (np.abs(patch - paper).max(axis=2) > 62) & figure & near_foot
    shin = abs(x - ankle_x) <= max(2, radius * 0.65)
    if not shin.any():
        return None
    dyed = np.linalg.norm(patch[: ys.min() + 1, shin] - trousers, axis=2) < 46
    cuffs = np.flatnonzero(dyed.mean(axis=1) > 0.38)
    hem = int(cuffs[-1] + 1) if len(cuffs) else 0

    labels, count = ndimage.label(ink[hem:], np.ones((3, 3)))
    if not count:
        return None
    overlap = np.bincount(labels[leather[hem:]], minlength=count + 1)
    overlap[0] = 0
    if overlap.max() < leather.sum() * 0.5:
        return None
    foot = np.zeros_like(figure)
    foot[hem:] = labels == overlap.argmax()
    # Pale socks and soles can match the paper between their two inked sides.
    grounded = foot.copy()
    for y in np.flatnonzero(foot.any(axis=1)):
        occupied = np.flatnonzero(foot[y])
        foot[y, occupied[0] : occupied[-1] + 1] = True
    luma = np.array([0.213, 0.715, 0.072])
    near_leather = ndimage.distance_transform_edt(~leather) < max(2.2, width * 0.054)
    upper = (leather | (near_leather & (patch @ luma < shoe @ luma - 16))) & foot
    cols = []
    for x in np.flatnonzero(upper.any(axis=0)):
        crest = np.flatnonzero(foot[:, x])[0]
        # Paper open below the arch separates the heel from the forefoot.
        contact = np.flatnonzero(grounded[:, x])
        if not len(contact):
            continue
        floor = contact[-1]
        top, seam = np.flatnonzero(upper[:, x])[[0, -1]]
        if floor <= crest or top > floor:
            continue
        seam = min(seam, floor)
        if not contrasting:
            seam = max(top, floor - max(1, width * 0.025))
        cols.append((x, crest, top, seam, floor))
    if len(cols) < max(7, width * 0.72):
        return None
    return np.asarray(cols, dtype=float), hem


def fit_front(source, name, observation=None):
    """Use the family skull around measured eyes and retain the drawn T-pose body."""
    from .draft import propose
    from .fit import bounds, fit, pixels
    from .inked_hand import fit_inked_hands
    from .shirt_cut import fit_shirt_cut

    obs = propose(source, name) if observation is None else observation
    if (
        obs["unsupported"]
        or obs["haircut"] == "spikes"
        or obs["top"] not in ("crew", "tank", "polo")
    ):
        raise ValueError("The drawing needs a different hair or garment construction.")
    rgb, mask = pixels(source)
    h, w = mask.shape
    left, top, right, floor = bounds(mask)
    # Use one coordinate origin from hair to soles. A swept crown can begin
    # above the central scalp landmark and otherwise shifts the arms upward.
    design = fit(source, obs, crown_y=top)["design"]

    def xy(p):
        return [round(p["x"] * (w - 1) / 1000), round(p["y"] * (h - 1) / 1000)]

    lm = {k: xy(v) for k, v in obs["landmarks"].items()}
    samples = {k: xy(v) for k, v in obs["samples"].items()}
    crown, chin = top, lm["chin"][1]
    # The contour is measured from the visible cap, including its uppermost strand.
    center = (lm["leftCheek"][0] + lm["rightCheek"][0]) / 2
    scale = 608 / (floor - crown)
    body = dict(design)
    measured = body.pop("fit")
    parts = body.pop("parts", {})
    sections = measured["sections"]

    def image_point(point):
        return [
            round(point[0] / scale + center),
            round((point[1] - 12) / scale + crown),
        ]

    head_height = chin - top
    if head_height <= 12 or not 0.11 <= head_height / (floor - top) <= 0.42:
        raise ValueError("Could not register the household skull to the T-pose.")
    body["head"] = [design["head"][0], round(head_height * scale, 3)]
    head_left, head_right = (
        round(center - 0.86 * head_height),
        round(center + 0.86 * head_height),
    )
    guide = {
        "name": name,
        "yaw": 0,
        "height_range": [top, chin],
        "head_region": [
            [head_left, top],
            [head_right, top],
            [head_right, chin],
            [head_left, chin],
        ],
        "skin": samples["skin"],
        "hair": samples["hair"],
        "shirt": samples["shirt"],
        "body": body,
        "nose_y": lm["noseTip"][1],
        "mouth_y": round((lm["mouthLeft"][1] + lm["mouthRight"][1]) / 2),
    }
    if sections.get("nose"):
        guide["nose_stroke"] = [image_point(p) for p in sections["nose"]["stroke"]]
    eyes = sections.get("eyes", [])
    if len(eyes) == 2 and all(e.get("brow") for e in eyes):
        guide["brows"] = [[image_point(p) for p in e["brow"]] for e in eyes]
    mouth = sections.get("mouth") or sections.get("openMouth")
    if mouth:
        points = [image_point([row[0], y]) for row in mouth["rows"] for y in row[1:]]
        xs, ys = zip(*points)
        guide["mouth_box"] = [
            max(0, min(xs) - 2),
            max(0, min(ys) - 2),
            min(w, max(xs) + 3),
            min(h, max(ys) + 3),
        ]
    # Wardrobe identity comes from pigment at the upper arm, independently
    # of a binding or shadow that crosses the front of the torso.
    arm_y = lm["wrist"][1]
    shoulder = lm["shoulder"][0] - center
    col = round(center + shoulder * 1.32)
    local = rgb[max(top, arm_y - 4) : arm_y + 5, col - 2 : col + 3]
    if local.size:
        pigment_at_shoulder = np.median(local, axis=(0, 1))
        if (
            np.linalg.norm(pigment_at_shoulder - pigment(rgb, samples["skin"]))
            < np.linalg.norm(pigment_at_shoulder - pigment(rgb, samples["shirt"]))
            * 0.55
        ):
            body["outfit"]["top"] = "tank"
    body["hair"]["cut"] = "crop"
    actual = portrait_pair(rgb, (max(0, head_left), top, min(w, head_right), chin))
    if len(actual) != 2:
        raise ValueError("Two separate eye whites are required.")
    guide["eyes"] = [
        [max(0, x - 4), max(0, y - 4), min(w, r + 4), min(h, b + 4)]
        for x, y, r, b in (eye["bounds"] for eye in actual)
    ]
    from .visible_parts import button_front, open_smile

    if body["outfit"]["top"] != "tank":
        neck, hem = ((measured[k] - 12) / scale + crown for k in ("neckline", "hem"))
        fabric = pigment(rgb, samples["shirt"])
        fasteners = button_front(
            rgb, center, neck, hem, fabric, pigment(rgb, samples["skin"])
        )
        if fasteners:
            body["outfit"].update(
                {
                    **fasteners,
                    "top": "polo",
                    "trim": paint(fabric),
                    "buttonColor": paint(fasteners["buttonColor"]),
                }
            )

    visible = open_smile(
        rgb, [e["bounds"] for e in actual], top, chin, pigment(rgb, samples["skin"])
    )
    if visible:
        body["mouth"] = "speaking"
        guide.update(visible)
    recipe = fit_portrait(source, guide, mask, rgb)
    family = recipe["design"]["household"]
    head_width, head_height = recipe["design"]["head"]
    opening = sections.get("openMouth")
    if opening and recipe["design"]["mouth"] == "speaking":
        # The T-pose fitter already traced every paint boundary. Keep the
        # rows in skull units so the household can rebuild them on a new rig.
        rows = np.asarray(opening["rows"], dtype=float)
        idx = np.unique(
            np.rint(np.linspace(0, len(rows) - 1, min(24, len(rows)))).astype(int)
        )
        rows = rows[idx]
        upper, lower = rows[:, 1], rows[:, -1]
        mid = (rows[0, 0] + rows[-1, 0]) / 2
        values = np.column_stack(
            (
                (rows[:, 0] - mid) / head_width,
                (upper - 12) / head_height,
                (lower - 12) / head_height,
            )
        )
        # At whole-body resolution the jaw ink and lip edge each occupy a
        # source pixel. Seat a close fit above the chin without cropping the
        # teeth or changing the shape of a single column.
        overhang = float(values[:, 2].max() - 0.97)
        if 0 < overhang <= 2 / (chin - top):
            values[:, 1:] -= overhang
        if (
            np.abs(values[:, 0]).max() <= 0.4
            and values[:, 1:].min() >= 0.55
            and values[:, 1:].max() <= 0.97
        ):
            family["lips"] = values.round(4).tolist()
            family["lipInk"] = opening["interior"]
            family["mouthPaint"] = {
                "teeth": opening["teeth"],
                "bands": (
                    (rows[:, 1:] - upper[:, None])
                    / np.maximum(lower - upper, 1e-6)[:, None]
                )
                .round(4)
                .tolist(),
                **({"tongue": opening["tongue"]} if opening.get("tongue") else {}),
            }
    closed = sections.get("mouth")
    if (
        closed
        and closed.get("color")
        and family.get("lips")
        and closed["expression"] == recipe["design"]["mouth"]
    ):
        drawn = np.asarray(closed["rows"])[:, 1]
        lips = np.asarray(family["lips"])
        middle = 12 + head_height * np.median(lips[:, 1:])
        if abs(np.median(drawn) - middle) < head_height * 0.035:
            # Use pigment from the seam, with the portrait fitter's closed lip
            # contour. A near-colored nostril can enter a vertical mouth scan.
            family["lipColor"] = closed["color"]
            family["lipInk"] = closed["ink"]
    lobes = [
        [
            x / head_width,
            (y - 12) / head_height,
            rx / head_width,
            ry / head_height,
        ]
        for x, y, rx, ry in sections.get("ears", [])
    ]
    boxes = np.array([e["bounds"] for e in actual])
    eye_axis, eye_y = np.mean((boxes[:, :2] + boxes[:, 2:]) / 2, axis=0)
    skin, hair = [pigment(rgb, samples[key]) for key in ("skin", "hair")]
    width = head_width / scale
    # Filling the face silhouette also fills the ink separating ear and cheek.
    # Read both visible lobes on the original pigment before choosing a default.
    raw = frontal_lobes(rgb, mask, skin, hair, eye_axis, eye_y, top, chin, width)
    recovered = len(raw) > len(lobes)
    fit_frontal_features(
        recipe["design"], raw if recovered else lobes, scale, separate_ears=recovered
    )
    family["body"] = {
        k: v
        for k, v in measured.items()
        if k not in ("hairWidth", "hairLength", "sections", "triangleBudget")
    }
    family["body"]["sections"] = {
        k: v for k, v in sections.items() if k in BODY_SECTIONS
    }
    for angle in ("palmRoll", "handPitch"):
        if angle in parts:
            family["body"][angle] = parts[angle]
    # Frame both eyes with the same source-based axial coordinates used by
    # native_front's registered comparison. The T-pose stays centered at its bounds.
    for i, (orbit, eye) in enumerate(zip(family["orbits"], actual)):
        brow = painted_brow(rgb, eye["bounds"])
        if brow:
            orbit.update(brow)
        if len(eyes) == len(actual):
            orbital_ink(orbit, eyes[i], eye["bounds"], scale, center, crown)
    cx = (left + right - 1) / 2
    H = floor - top - 1
    eye_box = [
        (boxes[:, 0].min() - cx - 3) / H,
        (boxes[:, 1].min() - top - 3) / H,
        (boxes[:, 2].max() - cx + 3) / H,
        (boxes[:, 3].max() - top + 3) / H,
    ]
    crown_profile = crown_sides(rgb, mask, eye_axis, top, chin, width, hair, skin)
    if crown_profile:
        family["crownSides"] = crown_profile
    sweep = crown_edges(rgb, mask, eye_axis, top, chin - top, width, skin, hair)
    if sweep:
        family["crownEdges"] = sweep
    fall = hair_fall(rgb, mask, eye_axis, top, chin, width, hair, skin)
    bob = fall and fall[-1][0] < 1.05
    # On a short bob the side locks visible below the ears belong to the
    # separate curtain. They must not pull the forehead cap across the cheek.
    line = scalp_boundary(
        rgb,
        mask,
        eye_axis,
        top,
        chin - top,
        width,
        family["widths"],
        skin,
        hair,
        eyes=[e["bounds"] for e in actual],
        cap_limit=min(0.76, recipe["design"]["face"]["eyeHeight"] + 0.10)
        if bob
        else 0.93,
    )
    if line:
        if bob and len(family.get("ears", [])) == 2:
            # The scalp wraps behind each observed lobe. A local paper
            # highlight near the temple is not an opening in a closed bob.
            ears = sorted(family["ears"])
            for i, angle in enumerate(np.linspace(-np.pi / 2, np.pi / 2, len(line))):
                ear = ears[int(angle > 0)]
                wrap = float(np.clip((abs(angle) - 0.85) / 0.42, 0, 1))
                line[i] = round(max(line[i], (ear[1] - ear[3] * 0.78) * wrap), 4)
        recipe["design"]["hairline"] = line
    if line and not bob:
        fringe = forehead_fringe(
            rgb,
            mask,
            eye_axis,
            top,
            chin - top,
            width,
            skin,
            hair,
            [e["bounds"] for e in actual],
        )
        if fringe:
            family["fringe"] = fringe
    if not bob:
        pinnae = frontal_pinnae(
            rgb,
            mask,
            eye_axis,
            top,
            width,
            chin - top,
            family.get("ears", []),
            skin,
            hair,
        )
        if pinnae:
            family["pinnae"] = pinnae
    # Hair visible outside both cheeks below the ears continues around the
    # occiput. Estimate the nape length independently of the forehead part.
    nape = nape_height(rgb, mask, eye_axis, top, chin, width, skin, hair)
    if nape is not None:
        family["nape"] = nape
    if fall:
        recipe["design"]["hair"]["cut"] = "waves"
        if bob and sections.get("nape") and sections.get("hair"):
            # The fitted bob already joins the crown, part and underside. Use
            # that construction on the family rig in its original drawing frame.
            family["measuredBob"] = {
                "frame": recipe["design"]["head"],
                "skullWidth": design["head"][0],
                "eyeAxis": round((eye_axis - center) * scale / head_width, 4),
                "sections": {
                    k: sections[k]
                    for k in (
                        "hair",
                        "nape",
                        "sidePart",
                        "chin",
                        "jaw",
                        "locks",
                        "ears",
                        "nose",
                    )
                    if k in sections
                },
            }
        else:
            family["fallRows"] = fall
    if has_ink_outline(rgb, mask, (left, top, right, floor)):
        family["penOutline"] = True
        inked_sections(rgb, mask, center, crown, scale, arm_y, samples, family["body"])
        fit_inked_hands(
            rgb, mask, center, crown, scale, (left, right), skin, family["body"]
        )
        edges = garment_edges(
            rgb,
            center,
            crown,
            scale,
            family["body"],
            pigment(rgb, samples["shirt"]),
            pigment(rgb, samples["trousers"]),
        )
        if edges:
            family["body"]["sections"]["garmentEdges"] = edges
        fit_footwear(
            rgb, mask, center, crown, scale, family["body"], body["outfit"], skin
        )
        if body["outfit"]["top"] == "crew":
            collar = outlined_collar(
                rgb,
                center,
                chin,
                lm["shoulder"][1],
                width,
                skin,
                pigment(rgb, samples["shirt"]),
                scale,
                crown,
            )
            if collar:
                family["body"]["sections"]["crew"] = collar
        cut = fit_shirt_cut(
            rgb,
            mask,
            center,
            crown,
            scale,
            family["body"],
            pigment(rgb, samples["shirt"]),
            skin,
            body["outfit"]["top"],
        )
        if cut:
            family["body"]["sections"]["shirtCut"] = cut
    score = {
        "head_fraction": (chin - top) / H,
        "eye_frame": list(map(float, eye_box)),
    }
    if np.min((boxes[:, 2] - boxes[:, 0]) / (boxes[:, 3] - boxes[:, 1])) > 1.85:
        score["lowered_lids"] = True
    return recipe, score


def review_edits(recipe, source, native, score, visual):
    from .family_eyes import eye_measures
    from .inked_hand import arm_centerlines

    edits = []
    design = recipe["design"]

    def change(field, value, previous):
        if value != previous:
            edits.append({"field": "design." + field, "value": value})

    body = design["household"].get("body")
    if body and body["sections"].get("shirtCut"):
        from .shirt_cut import shirt_side_offset

        shift = shirt_side_offset(source, native, design)
        if shift:
            edits.append({"field": "shirtSideOffset", "value": shift})
    if body and body["sections"].get("palmContours"):
        levels = [arm_centerlines(p, body, design["height"]) for p in (source, native)]
        if all(v is not None for v in levels):
            offset = levels[0] - levels[1]
            # Move the shared sleeve, wrist and grip only when both arms agree.
            if (
                np.prod(offset) > 0
                and np.ptp(offset) < 2
                and 0.8 < abs(offset.mean()) <= 7
            ):
                edits.append(
                    {
                        "field": "armHeightOffset",
                        "value": round(float(offset.mean()), 2),
                    }
                )
    if visual["rgb_mae"] > 12:
        from .household_registration import dye, frame, role_masks, swatches

        reference, rendered = frame(source), frame(native)
        delta = reference[:, :, :3].astype(float) - rendered[:, :, :3].astype(float)
        masks = role_masks(rendered, design)
        shared = ndimage.binary_erosion(
            (reference[:, :, 3] > 0) & (rendered[:, :, 3] > 0)
        )
        for field, previous, mask in zip(
            [
                "skin",
                "hair.color",
                "outfit.color",
                "outfit.trousers",
                "outfit.shoes",
                "outfit.trim",
            ],
            swatches(design),
            masks,
        ):
            # Average each pigment only on the shared interior. A white cuff,
            # skin in a crew opening or a narrow ink seam must not recolor a shirt.
            region = shared & mask
            if region.sum() < 14:
                continue
            correction = np.median(delta[region], axis=0)
            if np.max(abs(correction)) >= 4:
                change(
                    field,
                    paint(
                        np.clip(dye(previous) + np.clip(correction, -32, 32), 0, 255)
                    ),
                    previous,
                )
    from .family_review import eyes_match

    if eyes_match(visual):
        return edits
    seen = eye_measures(
        source, score["eye_frame"], lowered=score.get("lowered_lids", False)
    )
    drawn = eye_measures(
        native, score["eye_frame"], lowered=score.get("lowered_lids", False)
    )
    if seen is not None and drawn is not None:
        target, actual = seen[0], drawn[0]
        ratios = target[:, 2:4] / actual[:, 2:4]
        if max(np.ptp(ratios, axis=0)) < 0.25:
            rw, rh = ratios.mean(axis=0)
            face = design["face"]
            for key, factor, lo, hi in (
                ("eyeAspect", rh / rw, 0.28, 1.18),
                ("eyeRadius", rw, 0.085, 0.24),
                (
                    "eyeSpacing",
                    np.ptp(target[:, 0]) / max(0.001, np.ptp(actual[:, 0])),
                    0.12,
                    0.33,
                ),
            ):
                if abs(factor - 1) > 0.05:
                    change(
                        "face." + key,
                        round(float(np.clip(face[key] * factor, lo, hi)), 4),
                        face[key],
                    )
    return edits
