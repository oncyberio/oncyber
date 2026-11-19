"""Fit depth rings from an OBJ subtool to an illustrated radial hair outline.

The input contour is a JSON object with a center and an ordered rim in image
coordinates. The OBJ uses +Y up and +Z toward the camera. Only measured depth
samples and the illustrated outline are retained in the output recipe.
"""

import argparse
import json
from pathlib import Path
from runpy import run_path
from zipfile import ZipFile

import numpy as np
from scipy.spatial import cKDTree


def fit(points, contour, steps):
    center = (points.max(axis=0)[:2] + points.min(axis=0)[:2]) / 2
    offsets = points[:, :2] - center
    radii = np.linalg.norm(offsets, axis=1)
    angles = np.arctan2(offsets[:, 1], offsets[:, 0])
    tree = cKDTree(points[:, :2])
    front, back = [], []
    for xy in contour["rim"]:
        direction = np.array(xy) - contour["center"]
        direction[1] *= -1
        direction = direction / np.linalg.norm(direction)
        angle = np.arctan2(*direction[::-1])
        near = np.cos(angles - angle) >= np.cos(np.deg2rad(1.8))
        span = np.percentile(radii[near], 99.5)
        queries = center + np.outer(steps, direction * span)
        _, indices = tree.query(queries, k=min(120, len(points)))
        lo, hi = np.percentile(points[indices, 2], [3, 97], axis=1)
        # Both sides meet at the traced tip. A midpoint avoids a flat cut edge.
        lo[-1] = hi[-1] = (lo[-1] + hi[-1]) / 2
        front.append(hi.round().astype(int).tolist())
        back.append(lo.round().astype(int).tolist())
    return {**contour, "steps": steps, "front": front, "back": back}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path)
    parser.add_argument("part", help="Exact OBJ basename inside the archive")
    parser.add_argument("contour", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    obj_parts = run_path(str(Path(__file__).with_name("measure-avatar-obj.py")))[
        "obj_parts"
    ]
    with ZipFile(args.archive) as archive:
        for name, lines in obj_parts(archive):
            if Path(name).name == args.part:
                vertices = np.asarray(
                    [s.split()[1:4] for s in lines if s.startswith(b"v ")], dtype=float
                )
                break
        else:
            parser.error(f"Missing OBJ part {args.part}")
    recipe = fit(
        vertices, json.loads(args.contour.read_text()), [0, 0.44, 0.73, 0.9, 1]
    )
    args.output.write_text(json.dumps(recipe, separators=(",", ":")) + "\n")
