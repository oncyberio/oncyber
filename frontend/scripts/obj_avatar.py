"""Offline readers and orthographic MRGB rendering for avatar fitting."""

from pathlib import Path
from runpy import run_path
from zipfile import ZipFile

import numpy as np
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components


def components(path):
    obj_parts = run_path(str(Path(__file__).with_name("measure-avatar-obj.py")))[
        "obj_parts"
    ]
    with ZipFile(path) as source:
        for name, lines in obj_parts(source):
            xyz = np.array(
                [s.split()[1:4] for s in lines if s.startswith(b"v ")], dtype=np.float32
            )
            mrgb = b"".join(s[6:].strip() for s in lines if s.startswith(b"#MRGB "))
            paint = (
                np.frombuffer(bytes.fromhex(mrgb.decode()), np.uint8).reshape(-1, 4)[
                    :, 1:
                ]
                if mrgb
                else np.full(xyz.shape, 224, np.uint8)
            )
            if len(paint) != len(xyz):
                raise ValueError(f"Incomplete MRGB stream in {name}")
            faces = [s.split()[1:] for s in lines if s.startswith(b"f ")]
            triangles = []
            for arity in sorted({len(f) for f in faces}):
                poly = (
                    np.array([f for f in faces if len(f) == arity], dtype=np.int32) - 1
                )
                for j in range(1, arity - 1):
                    triangles.append(poly[:, [0, j, j + 1]])
            tri = np.concatenate(triangles)
            graph = coo_matrix(
                (
                    np.ones(tri.size, np.uint8),
                    (tri.ravel(), np.roll(tri, 1, axis=1).ravel()),
                ),
                shape=(len(xyz), len(xyz)),
            )
            count, classes = connected_components(graph, directed=False)
            part = int(Path(name).stem.split("-")[1])
            islands = []
            for k in range(count):
                mask = classes == k
                ids = np.flatnonzero(mask)
                faces = tri[mask[tri[:, 0]]]
                if len(faces):
                    islands.append((xyz[ids], paint[ids], np.searchsorted(ids, faces)))
            islands.sort(
                key=lambda island: (-len(island[0]), float(island[0][:, 0].mean()))
            )
            for number, (v, c, f) in enumerate(islands):
                yield part, number, v, c, f


def raster(view, rgb, faces, depth, canvas):
    """Barycentric z-buffer at pixel centers, in bounded batches of similar-sized faces."""
    verts = view[faces]
    lo = np.ceil(verts[:, :, :2].min(axis=1)).astype(int)
    hi = np.floor(verts[:, :, :2].max(axis=1)).astype(int)
    span = hi - lo + 1
    valid = (span > 0).all(axis=1)
    buckets = np.ceil(np.log2(np.maximum(1, span))).astype(int)
    for bx, by in np.unique(buckets[valid], axis=0):
        ids = np.flatnonzero(valid & (buckets[:, 0] == bx) & (buckets[:, 1] == by))
        w, h = 2 ** int(bx), 2 ** int(by)
        dx, dy = np.meshgrid(np.arange(w), np.arange(h))
        step = max(1, 200000 // (w * h))
        for pos in range(0, len(ids), step):
            ix = ids[pos : pos + step]
            xx = lo[ix, 0, None] + dx.ravel()
            yy = lo[ix, 1, None] + dy.ravel()
            a, b, c = (verts[ix, j] for j in range(3))
            u, v = b - a, c - a
            den = u[:, 0] * v[:, 1] - v[:, 0] * u[:, 1]
            den[np.abs(den) < 1e-12] = np.nan
            px, py = xx - a[:, 0, None], yy - a[:, 1, None]
            s = (px * v[:, 1, None] - py * v[:, 0, None]) / den[:, None]
            t = (py * u[:, 0, None] - px * u[:, 1, None]) / den[:, None]
            inside = (
                (s >= -1e-6)
                & (t >= -1e-6)
                & (s + t <= 1.000001)
                & (xx >= 0)
                & (xx < canvas.shape[1])
                & (yy >= 0)
                & (yy < canvas.shape[0])
            )
            fi, pi = np.nonzero(inside)
            if not len(fi):
                continue
            x, y = xx[fi, pi], yy[fi, pi]
            s, t = s[fi, pi], t[fi, pi]
            z = (a[fi, 2] + s * u[fi, 2] + t * v[fi, 2]).astype(np.float32)
            np.maximum.at(depth, (y, x), z)
            keep = z >= depth[y, x]
            i = faces[ix[fi[keep]]]
            s, t = s[keep, None], t[keep, None]
            canvas[y[keep], x[keep]] = np.rint(
                (1 - s - t) * rgb[i[:, 0]] + s * rgb[i[:, 1]] + t * rgb[i[:, 2]]
            ).clip(0, 255)
