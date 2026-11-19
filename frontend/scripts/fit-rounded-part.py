"""Fit a native skull part from a front silhouette and a right-facing profile."""

import argparse
import json
import re
from pathlib import Path

from PIL import Image
import numpy as np

from avatar_authoring.fit import pixels
from avatar_authoring.rounded import fit_masks, shape_recipe


def silhouette(path):
    with Image.open(path) as im:
        if im.width * im.height > 24_000_000:
            raise ValueError("Reference exceeds 24 megapixels")
        palette = im.getcolors(3) if im.mode in ("1", "L") else None
        if palette and all(value in (0, 1, 255) for _, value in palette):
            binary = np.asarray(im.convert("L"))
            # Support an opaque binary matte with either polarity.
            return binary != binary[0, 0]
    return pixels(path)[1]


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("front", type=Path)
    parser.add_argument("profile", type=Path, help="90° right-facing view")
    parser.add_argument("output", type=Path)
    parser.add_argument("--quarter", type=Path, help="35° right-facing view")
    parser.add_argument("--height", type=float, required=True, help="Height in the target rig's drawing units")
    parser.add_argument("--center", type=float, nargs=3, required=True, metavar=("X", "Y", "Z"),
                        help="Center of the orbit in the target drawing frame")
    parser.add_argument("--color", default="#cf9074", help="Paint swatch in hexadecimal RGB")
    args = parser.parse_args()
    if not re.fullmatch("#[0-9a-fA-F]{6}", args.color):
        parser.error("--color must be a six-digit hexadecimal RGB swatch")
    sections, curve = fit_masks(silhouette(args.front), silhouette(args.profile),
                                silhouette(args.quarter) if args.quarter else None,
                                args.height, args.center)
    recipe = shape_recipe(sections, curve, args.color)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(recipe, separators=(",", ":")) + "\n")
