"""Fit recipe cross-sections to aligned front and profile reference images."""
import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image


def silhouette(image, region, background, swatch, tolerance):
    colors = np.asarray(image.convert("RGB"), dtype=float)
    mask = np.max(abs(colors - background), axis=2) > 2
    if swatch is not None:
        mask &= np.max(abs(colors - swatch), axis=2) <= tolerance
    mask[:, :region[0]] = False
    mask[:, region[1]:] = False
    return mask


def sections(front, side, heights, origin_z, sign):
    rows = []
    for y in heights:
        x = np.flatnonzero(front[y])
        z = sign * (np.flatnonzero(side[y]) - origin_z)
        if not x.size or not z.size:
            raise ValueError(f"No matching surface at row {y}")
        rows.append([y, int(x.min()), int(x.max() + 1),
                     float(z.max() - z.min() + 1) / 2,
                     float(z.max() + z.min()) / 2])
    return rows


def rgb(value):
    return np.array(list(bytes.fromhex(value.lstrip("#"))), dtype=float)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("front", type=Path)
    parser.add_argument("side", type=Path)
    parser.add_argument("--rows", type=int, nargs="+", required=True)
    parser.add_argument("--front-x", type=int, nargs=2, required=True, metavar=("LEFT", "RIGHT"))
    parser.add_argument("--side-x", type=int, nargs=2, required=True, metavar=("LEFT", "RIGHT"))
    parser.add_argument("--depth-origin", type=float, required=True)
    parser.add_argument("--forward", choices=["left", "right"], default="left")
    parser.add_argument("--background", type=rgb, required=True)
    parser.add_argument("--swatch", type=rgb, help="Select a part by its approximate color")
    parser.add_argument("--tolerance", type=float, default=55)
    args = parser.parse_args()
    masks = [silhouette(Image.open(path), region, args.background, args.swatch, args.tolerance)
             for path, region in [(args.front, args.front_x), (args.side, args.side_x)]]
    print(json.dumps(sections(*masks, args.rows, args.depth_origin, -1 if args.forward == "left" else 1)))
