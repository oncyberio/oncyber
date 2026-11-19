"""Measure closed cross-sections and a hollow radial crown from a colored OBJ.

Fits the Rick study using its ZBrush subtool assignments. The fitted recipe
contains contours, section levels and swatches. Connectivity is built at runtime.
"""

import argparse
import json
from collections import defaultdict
from pathlib import Path
from runpy import run_path

import numpy as np
from matplotlib.figure import Figure
from scipy.ndimage import distance_transform_edt

from obj_avatar import components, raster

CENTER, TOP, DEPTH = 650.74, 1121, -32


def point(x, y, z):
    return [round(float(x), 1), round(float(TOP - y), 1), round(float(z - DEPTH), 1)]


def slices(v, f, axis, t):
    tri = v[f]
    p = tri[:, :, axis]
    cells = tri[(p.min(axis=1) < t) & (t < p.max(axis=1))]
    inside = cells[:, :, axis] < t
    i, j = np.where(inside != np.roll(inside, -1, axis=1))
    a, b = cells[i, j], cells[i, (j + 1) % 3]
    pts = a + (t - a[:, axis, None]) / (b[:, axis, None] - a[:, axis, None]) * (b - a)
    lines = np.delete(pts, axis, axis=1).reshape(-1, 2, 2)
    adj = defaultdict(list)
    for a, b in np.round(lines, 3):
        a, b = tuple(a), tuple(b)
        if a != b:
            adj[a].append(b)
            adj[b].append(a)
    loops = []
    while adj:
        start = next(iter(adj))
        loop = [start]
        node = start
        while adj.get(node):
            end = adj[node].pop()
            if not adj[node]:
                del adj[node]
            adj[end].remove(node)
            if not adj[end]:
                del adj[end]
            if end == start:
                break
            loop.append(end)
            node = end
        if len(loop) > 3:
            loops.append(np.array(loop))
    return sorted(loops, key=lambda l: np.ptp(l, axis=0).prod(), reverse=True)


def sample(loop, n, symmetric):
    twice_area = np.sum(
        loop[:, 0] * np.roll(loop[:, 1], -1) - loop[:, 1] * np.roll(loop[:, 0], -1)
    )
    if twice_area < 0:
        loop = loop[::-1]
    if symmetric:
        # Start on the front midline and end on the rear midline. Both go
        # through actual shell edges, including the coat's inner lining.
        crossings = []
        for j, (a, b) in enumerate(zip(loop, np.roll(loop, -1, axis=0))):
            if (a[0] < CENTER) != (b[0] < CENTER):
                crossings.append((j, a + (CENTER - a[0]) / (b[0] - a[0]) * (b - a)))
        if len(crossings) < 2:
            return
        crossings.sort(key=lambda pair: pair[1][1], reverse=True)
        idx, front = crossings[0]
        prev, rear = crossings[-1]
        ids = np.arange(idx + 1, idx + 1 + (prev - idx) % len(loop)) % len(loop)
        arc = loop[ids]
        if not len(arc) or arc[:, 0].mean() < CENTER:
            ids = np.arange(prev + 1, prev + 1 + (idx - prev) % len(loop)) % len(loop)
            arc = loop[ids][::-1]
        path = np.vstack([front, arc, rear])
    else:
        # Align the ring with the front ray at its bounding-box center.
        cx = (loop[:, 0].min() + loop[:, 0].max()) / 2
        candidates = np.flatnonzero((loop[:, 0] < cx) != (np.roll(loop[:, 0], -1) < cx))
        if not len(candidates):
            return
        at = candidates[loop[candidates, 1].argmax()]
        a, b = loop[at], loop[(at + 1) % len(loop)]
        start = a + (cx - a[0]) / (b[0] - a[0]) * (b - a)
        path = np.vstack([start, np.roll(loop, -at - 1, axis=0), start])
    arc = np.r_[0, np.cumsum(np.linalg.norm(np.diff(path, axis=0), axis=1))]
    steps = np.linspace(0, arc[-1], n + 1)
    # Keep silhouette extrema as section knots. Plain equal-length sampling
    # shaves the widest part off a flared coat or a narrow ankle.
    if n >= 8:
        for axis in range(2):
            for index in (path[:, axis].argmin(), path[:, axis].argmax()):
                k = np.abs(steps - arc[index]).argmin()
                if 0 < k < n and steps[k - 1] < arc[index] < steps[k + 1]:
                    steps[k] = arc[index]
    return np.stack([np.interp(steps, arc, path[:, i]) for i in range(2)], axis=1)


def projected(v, c, f, scale=3):
    low = v.min(axis=0)
    high = v.max(axis=0)
    view = np.column_stack(
        ((v[:, 0] - low[0]) * scale + 2, (high[1] - v[:, 1]) * scale + 2, v[:, 2])
    )
    h, w = np.rint((high - low)[[1, 0]] * scale).astype(int) + 5
    front = np.full((h, w), -np.inf, np.float32)
    back = front.copy()
    color = np.zeros((h, w, 3), np.uint8)
    raster(view, c, f, front, color)
    view[:, 2] *= -1
    raster(view, c, f, back, np.empty_like(color))

    def xy(p):
        return np.column_stack(
            (low[0] + (p[:, 0] - 2) / scale, TOP - high[1] + (p[:, 1] - 2) / scale)
        )

    return front, -back, color, xy


def hair(v, c, f, skull):
    front, back, _, xy = projected(v, c, f)
    mask = np.isfinite(front)
    fig = Figure()
    loops = fig.subplots().contour(mask.astype(float), levels=[0.5]).allsegs[0]
    loops = sorted(loops, key=len, reverse=True)
    simplify = run_path(str(Path(__file__).with_name("trace-avatar-paint.py")))[
        "simplify"
    ]
    rim = simplify(loops[0], 2.2)[:-1]
    center = (loops[1].min(axis=0) + loops[1].max(axis=0)) / 2
    origin = xy(center[None, :])[0]
    outline = xy(rim)
    angles = np.degrees(
        np.arctan2(outline[:, 1] - origin[1], np.abs(outline[:, 0] - origin[0]))
    )
    angles = np.unique(np.round(np.r_[angles, np.arange(-90, 91, 4), 90], 1))
    # Trace the complete section in (radius, depth). A folded spike can have
    # four depth intersections at one radius, which a front/back field loses.
    X = v[:, 0] - CENTER
    Y = TOP - v[:, 1] - origin[1]
    sections = []

    def resample(arc, skull_loops):
        lengths = np.r_[0, np.cumsum(np.linalg.norm(np.diff(arc, axis=0), axis=1))]
        hits = []
        # Anchor the transition between scalp and crown on the measured
        # intersection of the two surfaces in this radial plane.
        for segment in skull_loops:
            q = segment
            e = np.roll(q, -1, axis=0) - q
            for j, (a, b) in enumerate(zip(arc, arc[1:])):
                d = b - a
                delta = q - a
                den = d[0] * e[:, 1] - d[1] * e[:, 0]
                den = np.where(abs(den) > 1e-7, den, np.nan)
                ua = (delta[:, 0] * e[:, 1] - delta[:, 1] * e[:, 0]) / den
                ub = (delta[:, 0] * d[1] - delta[:, 1] * d[0]) / den
                ok = (ua >= 0) & (ua <= 1) & (ub >= 0) & (ub <= 1)
                hits.extend(lengths[j] + ua[ok] * (lengths[j + 1] - lengths[j]))
        seam = max(hits) if hits else lengths[-1] * 0.37
        at = np.r_[
            0,
            0.47 * seam,
            seam,
            seam + (lengths[-1] - seam) * np.array([0.18, 0.43, 0.73, 1]),
        ]
        return np.column_stack([np.interp(at, lengths, arc[:, k]) for k in (0, 1)])

    for deg in angles:
        if sections and deg - sections[-1][0] < 0.72 and deg < 89.99:
            continue
        angle = np.radians(deg)
        co, si = np.cos(angle), np.sin(angle)
        local = np.column_stack((X * co + Y * si, -X * si + Y * co, v[:, 2] - DEPTH))
        candidates = [l for l in slices(local, f, 1, 0.017) if l[:, 0].mean() > 0]
        if not candidates:
            continue
        main = max(candidates, key=lambda l: np.ptp(l[:, 0]))
        outer = max(candidates, key=lambda l: l[:, 0].max())
        loop = main
        if outer is not main and outer[:, 0].max() > main[:, 0].max() + 0.7:
            # Across an undercut, preserve the outer lobe as well as the inner root.
            from scipy.spatial import ConvexHull

            both = np.vstack([main, outer])
            loop = both[ConvexHull(both).vertices]
        inner, outer = loop[:, 0].argmin(), loop[:, 0].argmax()
        ix = np.arange(inner, inner + (outer - inner) % len(loop) + 1) % len(loop)
        jx = np.arange(outer, outer + (inner - outer) % len(loop) + 1) % len(loop)
        arcs = [loop[ix], loop[jx][::-1]]
        arcs.sort(key=lambda a: a[:, 1].mean(), reverse=True)
        sv, _, sf = skull
        sx = sv[:, 0] - CENTER
        sy = TOP - sv[:, 1] - origin[1]
        cranial = np.column_stack(
            (sx * co + sy * si, -sx * si + sy * co, sv[:, 2] - DEPTH)
        )
        skull_loops = slices(cranial, sf, 1, 0.017)
        front, rear = (resample(a, skull_loops) for a in arcs)
        ring = np.vstack([front, rear[-2:0:-1]])
        sections.append([round(float(deg), 1), *ring.round(1).ravel().tolist()])
    return {
        "center": [round(CENTER, 2), round(float(origin[1]), 2)],
        "sections": sections,
    }


def oral_sections(skull, shell):
    """Follow radial cuts from the back of the oral cavity, around the lip,
    to existing skull vertices. The MRGB transition anchors the lip on each ray.
    """
    from scipy.spatial import cKDTree

    xyz, paint, faces = skull
    tree = cKDTree(xyz)
    levels = [r[0] for r in shell["rows"]]
    start, end, span = levels.index(142.0), levels.index(167.0), 8
    rows = []
    for r in shell["rows"][start : end + 1]:
        right = np.array(r[1:]).reshape(-1, 2)[: span + 1]
        xz = np.vstack((right[:0:-1] * [-1, 1], right))
        rows.append(
            np.column_stack((xz[:, 0] + CENTER, np.full(len(xz), r[0]), xz[:, 1]))
        )
    frame = [
        *rows[0],
        *(r[-1] for r in rows[1:]),
        *rows[-1][-2::-1],
        *(r[0] for r in rows[-2:0:-1]),
    ]
    center = np.array([CENTER, 153.1])
    X, Y, Z = xyz[:, 0] - CENTER, TOP - xyz[:, 1] - center[1], xyz[:, 2] - DEPTH
    rays = []
    for outer in frame:
        ray = outer[:2] - center
        length = np.linalg.norm(ray)
        co, si = ray / length
        radial = np.column_stack((X * co + Y * si, -X * si + Y * co, Z))
        candidates = []
        for loop in slices(radial, faces, 1, 0.005):
            idx = np.where((loop[:, 0] < 0) != (np.roll(loop[:, 0], -1) < 0))[0]
            if not len(idx):
                continue
            a, b = loop[idx], loop[(idx + 1) % len(loop)]
            center_hits = a + (-a[:, 0] / (b[:, 0] - a[:, 0]))[:, None] * (b - a)
            k = center_hits[:, 1].argmax()
            near = np.linalg.norm(loop - [length, outer[2]], axis=1)
            candidates.append((near.min(), loop, idx[k], center_hits[k], near.argmin()))
        _, loop, i, origin, j = min(candidates, key=lambda c: c[0])
        advance = lambda a, b: loop[
            np.arange(a, a + (b - a) % len(loop) + 1) % len(loop)
        ]
        paths = [
            np.vstack([origin, advance(i + 1, j)]),
            np.vstack([origin, advance(j, i)[::-1]]),
        ]
        arc = min(
            paths, key=lambda path: np.linalg.norm(np.diff(path, axis=0), axis=1).sum()
        )
        r, z = arc.T
        source = np.column_stack(
            (center[0] + co * r, TOP - center[1] - si * r, z + DEPTH)
        )
        red = paint[tree.query(source)[1], 0].astype(float)
        transitions = np.where((red[:-1] < 152) & (red[1:] >= 152))[0]
        if not len(transitions):
            raise ValueError("No skin transition on oral section")
        k = transitions[-1]
        dist = np.r_[0, np.cumsum(np.linalg.norm(np.diff(arc, axis=0), axis=1))]
        seam = np.interp(152, red[k : k + 2], dist[k : k + 2])

        # Put interior knots at the turn between the curved inner cheek
        # and its overhanging lip. Preserve the exterior cheek turn as well.
        def bend(a, b):
            select = (dist >= a) & (dist <= b)
            points = arc[select]
            if len(points) < 3:
                return (a + b) / 2
            chord = points[-1] - points[0]
            deviation = np.abs(
                chord[0] * (points[:, 1] - points[0, 1])
                - chord[1] * (points[:, 0] - points[0, 0])
            )
            return np.clip(
                dist[select][deviation.argmax()], a + 0.09 * (b - a), b - 0.09 * (b - a)
            )

        turn = bend(0, seam)
        outside = bend(seam, dist[-1])
        at = np.array(
            [0, turn * 0.52, turn, (turn + seam) / 2, seam, outside, dist[-1]]
        )
        radius, depth = (np.interp(at, dist, arc[:, a]) for a in (0, 1))
        coords = np.column_stack(
            (center[0] + co * radius, center[1] + si * radius, depth)
        )
        coords[-1] = outer
        coords[0] = [CENTER, center[1], coords[0, 2]]
        rays.append(coords.round(1).tolist())
    # Keep the lip and outer skull boundary intact. Inner rings need fewer
    # knots, particularly where they converge at the back of the mouth.
    rings = []
    for level, stride in enumerate([len(rays), 4, 3, 2, 1, 1, 1]):
        rings.append(
            [
                [round(j / len(rays), 5), *rays[j][level]]
                for j in range(0, len(rays), stride)
            ]
        )
    return dict(start=start, end=end, span=span, rings=rings)


def shoulder_panel(parts):
    """Sample the visible yoke between the neck opening and the sleeve seam.
    Other layers participate in the depth test, so only exterior cloth is fitted.
    """
    scale = 6
    x0, top = CENTER, 943
    h, w = 360, 285
    front = np.full((h, w), -np.inf, np.float32)
    mask = np.zeros((h, w, 3), np.uint8)
    for (p, _), (v, c, f) in parts.items():
        if p not in (1, 2, 10, 16, 17, 18):
            continue
        view = np.column_stack(
            ((v[:, 0] - x0) * scale, (top - v[:, 1]) * scale, v[:, 2] - DEPTH)
        )
        paint = np.full_like(c, 255 if p in (17, 18) else 0)
        raster(view, paint, f, front, mask)
    rows = []
    for level in (941.1, 940.5, 939.5, 938, 936, 933, 929, 923, 916, 906, 896, 886):
        y = round((top - level) * scale)
        on = np.flatnonzero(mask[y, :, 0] > 240)
        if not len(on):
            continue
        groups = np.split(on, np.flatnonzero(np.diff(on) > 1) + 1)
        span = max(groups, key=len)
        if len(span) < 3:
            continue
        r = []
        for t in (0, 0.14, 0.34, 0.58, 0.81, 1):
            x = int(np.round(np.interp(t, [0, 1], [span[0], span[-1]])))
            r.append(
                [
                    round(x0 + x / scale, 1),
                    round(TOP - top + y / scale, 1),
                    round(float(front[y, x]) + 0.65, 1),
                ]
            )
        rows.append(r)
    return rows


def collar_sections(parts, shirt):
    """Follow the true shirt surface to its intersection with the neck.
    Both pieces share the same rim and sampling directions.
    """
    v, c, f = parts[16, 0]
    # Cast downward onto the shirt in the horizontal (x,z) plane.
    top, _, _, _ = projected(v[:, [0, 2, 1]], c, f, 8)
    low_x, high_z = v[:, 0].min(), v[:, 2].max()
    near = distance_transform_edt(
        ~np.isfinite(top), return_distances=False, return_indices=True
    )

    def height(p):
        col = int(np.clip(round((p[0] - low_x) * 8 + 2), 0, top.shape[1] - 1))
        row = int(np.clip(round((high_z - p[1]) * 8 + 2), 0, top.shape[0] - 1))
        return float(top[near[0, row, col], near[1, row, col]])

    nv, _, nf = parts[10, 0]
    center = np.array([CENTER, -34.2])
    rings = {level: slices(nv, nf, 1, level + 0.0003)[0] for level in range(907, 950)}
    base = next(row for row in shirt["rows"] if row[0] >= 246)
    section = np.array(base[1:]).reshape(-1, 2) + [CENTER, DEPTH]

    def radius(y, d):
        ring = rings[int(np.clip(round(y), 907, 949))] - center
        q = ring @ np.array([-d[1], d[0]])
        a = np.where((q < 0) != (np.roll(q, -1) < 0))[0]
        b = (a + 1) % len(q)
        return (
            (ring[a] + (q[a] / (q[a] - q[b]))[:, None] * (ring[b] - ring[a])) @ d
        ).max()

    cloth, neck = [], []
    for end in section:
        d = (end - center) / np.linalg.norm(end - center)
        lo, hi = 0, 17
        for _ in range(14):
            r = (lo + hi) * 0.5
            if r < radius(height(center + d * r), d):
                lo = r
            else:
                hi = r
        edge = center + d * (lo + hi) * 0.5
        y = height(edge)
        n = []
        for t in (0, 0.45, 0.8, 1):
            h = 949 + (y - 949) * t
            x, z = center + d * radius(h, d)
            n.append(point(x, h, z))
        collar = point(edge[0], y, edge[1])
        n[-1] = collar
        neck.append(n)
        a = []
        for t in (0, 0.20, 0.52, 0.81, 1):
            p = edge * (1 - t) + end * t
            a.append(point(p[0], height(p), p[1]))
        a[0] = collar
        a[-1] = point(end[0], TOP - base[0], end[1])
        cloth.append(a)
    return dict(
        join=base[0],
        shirt=np.array(cloth).transpose(1, 0, 2).tolist(),
        neck=np.array(neck).transpose(1, 0, 2).tolist(),
    )


def fit(parts):
    lofts = []
    bones = {}

    def loft(
        name,
        part,
        k,
        axis,
        levels,
        n,
        bone,
        *,
        half=False,
        pair=False,
        select=None,
        skin=None,
    ):
        v, c, f = parts[part, k]
        swatch = "#" + bytes(np.round(np.median(c, axis=0)).astype(np.uint8)).hex()
        rows = []
        for t in sorted(levels, reverse=axis == 1):
            t = np.clip(t, v[:, axis].min() + 0.02, v[:, axis].max() - 0.02) + 0.00071
            loops = slices(v, f, axis, t)
            if not loops:
                continue
            loop = select(loops) if select else loops[0]
            if loop is None:
                continue
            ring = sample(loop, n, half)
            if ring is None:
                continue
            if axis == 0:
                ring[:, 0] = TOP - ring[:, 0]
            if axis != 2:
                ring[:, 1] -= DEPTH
            if axis == 1:
                level = TOP - t
            else:
                level = t
            if half:
                ring[:, 0] -= CENTER
            if not half:
                ring = ring[:-1]
            rows.append([round(float(level), 1), *np.round(ring, 1).ravel().tolist()])
        if len(rows) < 2:
            raise ValueError(name)
        obj = dict(name=name, axis=axis, paint=swatch, bone=bone, rows=rows)
        for key, val in [("half", half), ("pair", pair), ("skin", skin)]:
            if val:
                obj[key] = val
        lofts.append(obj)

    def right(loops):
        loop = max(loops[:2], key=lambda l: l[:, 0].max())
        if loop[:, 0].min() >= CENTER:
            return loop
        clipped = []
        for a, b in zip(loop, np.roll(loop, -1, axis=0)):
            if a[0] >= CENTER:
                clipped.append(a)
            if (a[0] >= CENTER) != (b[0] >= CENTER):
                clipped.append(a + (CENTER - a[0]) / (b[0] - a[0]) * (b - a))
        return np.array(clipped) if len(clipped) > 3 else None

    high = right
    loft(
        "skull",
        2,
        0,
        1,
        [
            935,
            937,
            941,
            945,
            949,
            954,
            958,
            961,
            965,
            970,
            974,
            976,
            977.5,
            979,
            980.5,
            982,
            983.5,
            985,
            987,
            990,
            994,
            997,
            1001,
            1006,
            1014,
            1025,
            1034,
            1045,
            1055,
            1062,
            1067,
            1071,
        ],
        21,
        "head",
        half=True,
    )
    loft(
        "nose tip",
        2,
        0,
        1,
        [978.85, 979.5, 981, 983, 984.4],
        8,
        "head",
        select=lambda loops: max(loops, key=lambda l: l[:, 1].max()),
    )
    loft(
        "brow",
        0,
        0,
        0,
        [619, 621, 624, 629, 636, 643, 651, 658, 666, 673, 679, 682, 683],
        8,
        "head",
    )
    loft(
        "eyes",
        8,
        1,
        1,
        [1000, 1002, 1006, 1011, 1017, 1023, 1029, 1033, 1034],
        14,
        "head",
        pair=True,
    )
    loft("pupils", 3, 0, 1, [1014.1, 1015, 1017.2, 1019.4], 8, "head", pair=True)
    # Sample each incisor from its projected outline. Its small front-to-back
    # curvature affects which teeth overlap each other at three-quarter view.
    teeth = []
    simplify = run_path(str(Path(__file__).with_name("trace-avatar-paint.py")))[
        "simplify"
    ]
    for k in range(10):
        v, color, f = parts[9, k]
        front, back, _, xy = projected(v, color, f, 8)
        visible = np.isfinite(front)
        row, col = distance_transform_edt(
            ~visible, return_distances=False, return_indices=True
        )
        outline = max(
            Figure().subplots().contour(visible.astype(float), levels=[0.5]).allsegs[0],
            key=len,
        )
        rim = simplify(outline, 2.9)[:-1]
        center = (rim.min(axis=0) + rim.max(axis=0)) / 2
        coords = xy(rim)
        contour = []
        for direction, coord in zip(rim - center, coords):
            x, y = np.rint(center + 0.98 * direction).astype(int)
            near, far = front[row[y, x], col[y, x]], back[row[y, x], col[y, x]]
            contour.append([*coord, (near + far) * 0.5 - DEPTH])
        x, y = np.rint(center).astype(int)
        y, x = row[y, x], col[y, x]
        teeth.append(
            dict(
                center=xy(center[None, :])[0].round(1).tolist(),
                depth=np.round([front[y, x] - DEPTH, back[y, x] - DEPTH], 1).tolist(),
                contour=np.array(contour).round(1).tolist(),
            )
        )
    loft("tongue", 6, 0, 1, [951, 953, 956, 960, 962, 964, 966], 10, "head")
    loft("neck", 10, 0, 1, [905, 917, 932, 948, 959], 10, "neck")
    loft(
        "shirt",
        16,
        0,
        1,
        [751, 755, 765, 784, 821, 846, 874, 905, 914, 923, 930, 935, 938.0],
        13,
        "torso",
        half=True,
    )
    loft(
        "coat",
        17,
        0,
        1,
        [
            604,
            610,
            624,
            647,
            670,
            697,
            724,
            755,
            794,
            832,
            875,
            909,
            924,
            935,
            937,
            939.6,
        ],
        23,
        "torso",
        half=True,
    )
    # The open coat hits the lower hem at a different height in each column.
    # A single horizontal cap would fill the opening between its swinging tails.
    coat = lofts[-1]
    shell = parts[17, 0][0]
    bottom = shell[shell[:, 1] < 625]
    last = coat["rows"][-1]
    edge = []
    for x, z in np.array(last[1:]).reshape(-1, 2):
        x += CENTER
        column = bottom[np.abs(bottom[:, 0] - x) < 2.3]
        if not len(column):
            column = bottom[np.argsort(abs(bottom[:, 0] - x))[:16]]
        tip = column[column[:, 1].argmin()]
        edge.append(
            [
                round(float(tip[0] - CENTER), 1),
                round(float(TOP - tip[1]), 1),
                round(float(tip[2] - DEPTH), 1),
            ]
        )
    coat["hem"] = edge
    loft(
        "shoulder folds",
        17,
        0,
        1,
        [935.4, 937.0, 938.4, 939.3, 940.2, 940.5, 940.9, 941.3],
        7,
        "torso",
        pair=True,
        select=right,
    )
    loft(
        "lapels",
        18,
        0,
        1,
        [821, 826, 844, 856, 870, 880, 891, 912, 925, 934, 941],
        8,
        "torso",
        pair=True,
        select=right,
    )
    loft(
        "sleeve",
        1,
        1,
        0,
        [687.4, 694, 709, 738, 767, 783, 791, 800, 827, 852, 880, 887, 889.7],
        10,
        "leftUpperArm",
        pair=True,
        skin=["leftLowerArm", 780, 800],
    )
    loft(
        "palm",
        4,
        0,
        0,
        [886, 891, 899, 907, 916, 923, 929, 935, 939],
        12,
        "leftHand",
        pair=True,
    )
    loft("waist", 13, 0, 1, [718, 722, 728, 737, 749, 756, 764], 10, "hips", half=True)
    loft(
        "thigh",
        13,
        0,
        1,
        [551, 558, 579, 616, 656, 689, 704, 712, 718, 723],
        16,
        "leftUpperLeg",
        pair=True,
        select=high,
        skin=["hips", 401, 365],
    )
    loft(
        "shin",
        13,
        0,
        1,
        [433, 438, 458, 493, 526, 548, 558, 575],
        16,
        "leftLowerLeg",
        pair=True,
        select=high,
        skin=["leftUpperLeg", 573, 553],
    )
    loft("sock", 12, 1, 1, [418, 423, 436, 449], 8, "leftLowerLeg", pair=True)
    loft(
        "shoe",
        15,
        1,
        1,
        [404, 405, 408, 412, 417, 423, 427, 431],
        14,
        "leftFoot",
        pair=True,
    )
    loft("belt", 14, 0, 1, [739, 740.5, 745, 750, 752.7], 12, "hips", half=True)
    loft("buckle", 14, 1, 1, [739.4, 741, 745, 748.5, 749], 8, "hips")
    for k in [3, 4, 5, 9]:
        v = parts[14, k][0]
        loft(
            "belt loop",
            14,
            k,
            1,
            np.linspace(v[:, 1].min(), v[:, 1].max(), 3),
            4,
            "hips",
            pair=k != 9,
        )
    # The socket positions and radii follow the five individual digit spans.
    # The measured left hand is mirrored across the same plane as the sleeve.
    fingers = []
    v, c, f = parts[4, 0]
    for name, levels, expected in [
        ("Thumb", [917, 924, 929, 934], [940, 946, 952, 955]),
        ("Index", [935, 945, 956, 964], [942, 943, 943, 943]),
        ("Middle", [936, 946, 958, 966], [934, 934, 933, 933]),
        ("Ring", [936, 944, 955, 962], [926, 926, 924, 923]),
        ("Little", [932, 939, 948, 955], [918, 918, 916, 915]),
    ]:
        path = []
        radii = []
        for j, (x, y) in enumerate(zip(levels, expected)):
            rings = slices(v, f, 0, x + 0.031)
            small = [ring for ring in rings if np.ptp(ring[:, 0]) < 14]
            ring = min(small, key=lambda a: abs(a[:, 0].mean() - y)) if small else None
            if ring is not None and abs(ring[:, 0].mean() - y) < 6:
                yr, z = (ring.min(axis=0) + ring.max(axis=0)) / 2
                r = np.ptp(ring, axis=0).mean() / 2
            else:
                yr, z, r = y, (-31 if name == "Thumb" else -42), 3.6
            path.append(point(x, yr, z))
            radii.append(round(float(r), 1))
        fingers.append(dict(name=name, path=path, radii=radii))
        for j, suffix in enumerate(
            ["Metacarpal", "Proximal", "Distal"]
            if name == "Thumb"
            else ["Proximal", "Intermediate", "Distal"]
        ):
            for side, sign in [("left", 1), ("right", -1)]:
                x, y, z = path[j]
                bones[side + name + suffix] = [
                    round(CENTER + sign * (x - CENTER), 1),
                    y,
                    z,
                ]
    for name, xyz in {
        "hips": (CENTER, 743, -31),
        "spine": (CENTER, 790, -31),
        "chest": (CENTER, 868, -33),
        "upperChest": (CENTER, 916, -39),
        "neck": (CENTER, 935, -32),
        "head": (CENTER, 950, -24),
    }.items():
        bones[name] = point(*xyz)
    for name, xyz in {
        "Shoulder": (680, 927, -43),
        "UpperArm": (690, 930, -48),
        "LowerArm": (790, 930, -48),
        "Hand": (889, 930, -46),
        "UpperLeg": (671, 730, -30),
        "LowerLeg": (677, 561, -22),
        "Foot": (679, 430, -30),
        "Toes": (682, 409, 13),
    }.items():
        for side, sign in [("left", 1), ("right", -1)]:
            x, y, z = xyz
            bones[side + name] = point(CENTER + sign * (x - CENTER), y, z)
    return dict(
        mirror=round(CENTER, 2),
        joints=bones,
        lofts=lofts,
        hair=hair(*parts[11, 0], parts[2, 0]),
        shoulderPanel=shoulder_panel(parts),
        collar=collar_sections(parts, next(p for p in lofts if p["name"] == "shirt")),
        teeth=teeth,
        fingers=fingers,
        mouth=oral_sections(parts[2, 0], lofts[0]),
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    result = fit({(p, k): (v, c, f) for p, k, v, c, f in components(args.archive)})
    args.output.write_text(
        json.dumps(result, separators=(",", ":"), allow_nan=False) + "\n"
    )
