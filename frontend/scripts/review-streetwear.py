"""Compare a registered T-pose and profile with both native renderers.

The source sheet faces left in profile. The native +90-degree camera faces right.
Align floor, height and horizontal center separately in each view, preserving aspect.
"""

import argparse
import json
from pathlib import Path

import numpy as np
from avatar_authoring.fit import pixels
from avatar_authoring.release import (
    digest,
    evidence,
    export_review_views,
    verified_captures,
)
from PIL import Image, ImageDraw, ImageFont, ImageOps


def frame(image, mask, width):
    y, x = np.nonzero(mask)
    height = np.ptp(y) + 1
    center = (x.min() + x.max()) / 2
    box = (
        center - width * height / 2000,
        y.min(),
        center + width * height / 2000,
        y.max() + 1,
    )
    size = (width, 1000)
    rgb = image.transform(
        size,
        Image.Transform.EXTENT,
        box,
        Image.Resampling.BICUBIC,
        fillcolor=image.getpixel((0, 0)),
    )
    matte = Image.fromarray(mask.astype("uint8") * 255).transform(
        size, Image.Transform.EXTENT, box, Image.Resampling.NEAREST
    )
    return rgb, np.asarray(matte) > 0


def review(args):
    args.captures.mkdir(parents=True, exist_ok=True)
    args.destination.mkdir(parents=True, exist_ok=True)
    sheet = Image.open(args.sheet).convert("RGB")
    front = sheet.crop((0, 0, args.split, sheet.height))
    profile = ImageOps.mirror(sheet.crop((args.split, 0, sheet.width, sheet.height)))
    targets = {}
    for name, image, width in [("front", front, 1040), ("profile", profile, 480)]:
        path = args.captures / ("target-" + name + ".png")
        image.save(path)
        _, mask = pixels(path, keep_components=True)
        targets[name] = frame(image, mask, width)
    path = args.captures / "target-front.png"
    if not args.use_captures:
        evidence(args.recipe, path, args.captures, args.base, args.budget)
    report = verified_captures(args.recipe, args.captures)
    if digest(path) != report["reference"]:
        raise ValueError("The measured front does not match this turnaround")
    result = {
        "recipe_sha256": digest(args.recipe),
        "turnaround_sha256": digest(args.sheet),
        "front_split_x": args.split,
        "triangle_budget": args.budget,
        "backends": {},
    }
    canvas = Image.new("RGB", (3040, 1100), "#f6f3ef")
    label = ImageDraw.Draw(canvas)
    font = ImageFont.truetype("DejaVuSans.ttf", 31)
    for backend, capture in report["backends"].items():
        native = capture["native"]
        if native["triangles"] > args.budget:
            raise ValueError(f"{backend} exceeded {args.budget} triangles")
        metrics = {}
        offset = 0
        for angle, (drawing, reference) in targets.items():
            folder = args.captures / backend
            image = Image.open(folder / (angle + ".png")).convert("RGB")
            matte = Image.open(
                folder / ("mask.png" if angle == "front" else "profile-mask.png")
            ).convert("L")
            render, mask = frame(image, np.asarray(matte) > 127, drawing.width)
            metrics[angle] = round(
                float(np.sum(reference & mask) / np.sum(reference | mask)), 4
            )
            if backend == "WebGLBackend":
                for subject, tile in [("Drawing", drawing), ("Three.js", render)]:
                    label.text(
                        (offset + 12, 15),
                        f"{subject} · {angle}",
                        font=font,
                        fill="#302b2a",
                    )
                    canvas.paste(tile, (offset, 65))
                    offset += tile.width
        result["backends"][backend] = {"silhouette_iou": metrics, **native}
    comparison = args.destination / (args.slug + "-comparison.webp")
    canvas.thumbnail((2048, 1100), Image.Resampling.LANCZOS)
    canvas.save(comparison, quality=92, method=6)
    result["comparison_sha256"] = digest(comparison)
    result["captures"] = export_review_views(
        args.captures, args.destination, args.slug, report
    )
    (args.destination / "measurements.json").write_text(
        json.dumps(result, indent=2) + "\n"
    )
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    for arg in ("sheet", "recipe", "captures", "destination"):
        parser.add_argument(arg, type=Path)
    parser.add_argument(
        "--split",
        required=True,
        type=int,
        help="Pixel column dividing front and profile",
    )
    parser.add_argument("--slug", required=True)
    parser.add_argument("--base", default="http://localhost:13000")
    parser.add_argument("--budget", default=5500, type=int)
    parser.add_argument(
        "--use-captures",
        action="store_true",
        help="Rebuild the comparison from the same verified captures",
    )
    print(json.dumps(review(parser.parse_args()), indent=2))
