"""Render MRGB truth views for an avatar study, with a common orthographic scale."""

import argparse
from pathlib import Path

import numpy as np
from PIL import Image

from obj_avatar import components, raster


VIEWS = {"front": 0, "profile": 90, "back": 180, "quarter": 35, "other-quarter": -35, "other-profile": -90}


def render(parts, output, scale=1, floor=404, center=650.7, depth_center=-32,
           views=("front", "profile", "back")):
    output.mkdir(parents=True, exist_ok=True)
    height, width = round(760 * scale), round(736 * scale)
    for name in views:
        angle = np.deg2rad(VIEWS[name])
        cosine, sine = np.round([np.cos(angle), np.sin(angle)], 15)
        z = np.full((height, width), -np.inf, np.float32)
        image = np.full((height, width, 3), [232, 226, 214], dtype=np.uint8)
        for _, _, xyz, c, f in parts:
            x, y, depth = xyz.T
            # The study camera looks down the -Z axis in the drawing's frame.
            h = (x - center) * cosine + (depth - depth_center) * sine
            near = depth * cosine - (x - center) * sine
            view = np.column_stack(
                (width / 2 + h * scale, height - 22 * scale - (y - floor) * scale, near)
            )
            raster(view, c, f, z, image)
        Image.fromarray(image).save(output / f"obj-{name}.png")
        Image.fromarray(np.isfinite(z)).save(output / f"obj-{name}-mask.png")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path)
    parser.add_argument("out", type=Path)
    parser.add_argument("--scale", type=float, default=1)
    parser.add_argument("--views", nargs="+", choices=VIEWS, default=["front", "profile", "back"])
    args = parser.parse_args()
    render(list(components(args.archive)), args.out, args.scale, views=args.views)
