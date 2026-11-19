"""Fit vector paint regions (including holes) to a bounded area of a reference.
Output uses the same pixel coordinates as the reference and contains no bitmap."""
import argparse
import json
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.path import Path as Region
from PIL import Image
import numpy as np
from scipy.ndimage import binary_closing


def simplify(points, tolerance):
    if len(points) < 3:
        return points
    a, b = points[0], points[-1]
    segment = b - a
    scale = max(1e-8, np.dot(segment, segment))
    t = np.clip(((points - a) @ segment) / scale, 0, 1)
    error = np.linalg.norm(points - a - t[:, None] * segment, axis=1)
    i = int(error.argmax())
    if error[i] <= tolerance:
        return points[[0, -1]]
    return np.concatenate((simplify(points[:i + 1], tolerance)[:-1],
                           simplify(points[i:], tolerance)))


def trace(image, box, palette, bone, surface, tolerance, underpaint=()):
    cropped = np.asarray(image.convert("RGB").crop(box), dtype=float)
    pigments = np.array([list(bytes.fromhex(c.lstrip("#"))) for c in palette.values()])
    labels = np.argmin(np.sum((cropped[:, :, None] - pigments) ** 2, axis=3), axis=2)
    output = []
    for i, key in enumerate(palette):
        if not i:
            continue  # first swatch is the ground
        mask = labels == i
        if underpaint and key == underpaint[0]:
            mask = np.isin(labels, [list(palette).index(c) for c in underpaint])
            mask = binary_closing(mask, structure=np.ones((2, 2)))
        mask = np.pad(mask, 1)
        if not mask.any():
            continue
        figure, axes = plt.subplots()
        contours = axes.contour(mask, levels=[.5]).allsegs[0]
        plt.close(figure)
        rings = []
        for contour in contours:
            ring = simplify(contour, tolerance)[:-1]
            if len(ring) < 3:
                continue
            area = np.abs(np.sum(ring[:, 0] * np.roll(ring[:, 1], 1)
                                 - ring[:, 1] * np.roll(ring[:, 0], 1))) / 2
            if area >= 2.5:
                rings.append((area, ring + [box[0] - .5, box[1] - .5]))
        layers = []
        for area, ring in sorted(rings, key=lambda r: -r[0]):
            parent = next((item for item in reversed(layers)
                           if item["region"].contains_point(ring[0])), None)
            item = {"region": Region(ring), "depth": 1 + parent["depth"] if parent else 0}
            if item["depth"] % 2:
                parent["shape"]["holes"].append(ring.tolist())
            else:
                shape = dict(bone=bone, paint=key, decal=ring.tolist(), holes=[],
                             on=surface, **{"raise": round(1.8 + .38 * i, 2)})
                output.append(shape)
                item["shape"] = shape
            layers.append(item)
    return output


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("image", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--box", type=int, nargs=4, required=True)
    parser.add_argument("--palette", required=True, help="JSON swatches, background first")
    parser.add_argument("--bone", required=True)
    parser.add_argument("--surface", required=True)
    parser.add_argument("--tolerance", type=float, default=.85)
    parser.add_argument("--underpaint", nargs="+", default=[], help="Union these swatches beneath their highlights")
    args = parser.parse_args()
    result = trace(Image.open(args.image), tuple(args.box), json.loads(args.palette),
                   args.bone, args.surface, args.tolerance, args.underpaint)
    args.output.write_text(json.dumps(result, separators=(",", ":")))
