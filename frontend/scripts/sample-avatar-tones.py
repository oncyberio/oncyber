"""Sample low-frequency front and rear garment shading onto a recipe's section rings."""
import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter, map_coordinates


def tone_field(image, swatch, tolerance, blur, background):
    rgb = np.asarray(image.convert("RGB"), dtype=float)
    accepted = np.max(abs(rgb - swatch), axis=2) <= tolerance
    if background is not None:
        accepted &= np.max(abs(rgb - background), axis=2) > 1
    luminance = rgb @ [0.2126, 0.7152, 0.0722]
    weights = gaussian_filter(accepted.astype(float), blur)
    shading = gaussian_filter(luminance * accepted, blur) / np.maximum(weights, 1e-6)
    reference = max(float(swatch @ [0.2126, 0.7152, 0.0722]), 1)
    return np.where(weights > .03, np.clip(shading / reference, .48, 1.1), 1)


def sample_sections(part, fields, count, mirror_x):
    horizontal = "across" in part
    angles = 2 * np.pi * np.arange(count) / count
    rows = []
    for along, low, high, *_ in part["across" if horizontal else "profile"]:
        across = (low + high) * .5 + (high - low) * .5 * np.sin(angles)
        fixed = np.full(count, along)
        x, y = (fixed, across) if horizontal else (across, fixed)
        front = map_coordinates(fields[0], [y, x], order=1, mode="nearest")
        back = map_coordinates(fields[1], [y, 2 * mirror_x - x], order=1, mode="nearest")
        # Crossfade at the tangent where a projection has little surface area.
        blend = np.clip(.5 + 2.5 * np.cos(angles), 0, 1)
        rows.append(np.rint(255 * (front * blend + back * (1 - blend))).astype(int).tolist())
    return rows


def rgb(hex_color):
    return np.asarray(list(bytes.fromhex(hex_color.lstrip("#"))), dtype=float)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("recipe", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--front", type=Path, required=True)
    parser.add_argument("--back", type=Path, required=True)
    parser.add_argument("--paint", required=True)
    parser.add_argument("--mirror-x", type=float, required=True, help="Centerline in aligned image pixels")
    parser.add_argument("--tolerance", type=float, default=65, help="Maximum sRGB channel difference from swatch")
    parser.add_argument("--background", help="Flat reference background color to exclude")
    parser.add_argument("--samples", type=int, default=20, help="Samples around each ring")
    parser.add_argument("--blur", type=float, default=2.4, help="Prefilter radius in reference pixels")
    args = parser.parse_args()
    recipe = json.loads(args.recipe.read_text())
    swatch = rgb(recipe["palette"][args.paint]["color"])
    fields = [tone_field(Image.open(p), swatch, args.tolerance, args.blur,
                         rgb(args.background) if args.background else None)
              for p in (args.front, args.back)]
    for part in recipe["parts"]:
        if part["paint"] == args.paint and ("profile" in part or "across" in part):
            part["tones"] = sample_sections(part, fields, args.samples, args.mirror_x)
    args.output.write_text(json.dumps(recipe, indent=2) + "\n")
