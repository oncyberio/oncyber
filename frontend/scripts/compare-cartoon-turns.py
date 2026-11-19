"""Compare rendered silhouette mattes around a fixed rig axis in a T-pose."""

import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

VIEWS = ("front", "quarter", "profile", "back")


def mattes(directory):
    """Accept either a native authoring pass or the OBJ renderer's output."""
    result = {}
    for view in VIEWS:
        native = "mask.png" if view == "front" else f"{view}-mask.png"
        path = directory / native
        if not path.is_file():
            path = directory / f"obj-{view}-mask.png"
        mask = np.asarray(Image.open(path).convert("L")) > 127
        if not mask.any() or mask[0, 0]:
            raise ValueError(f"Expected a white figure against black in {path}")
        result[view] = mask
    return result


def register(views, height=640):
    # Estimate scale and vertical placement only in front. Preserve shoulder,
    # face and shoe offsets from the turning axis on every subsequent view.
    front = views["front"]
    rows = np.flatnonzero(front.any(axis=1))
    top = rows[0]
    step = (rows[-1] + 1 - top) / height
    y, x = np.indices((height, height * 2))
    sy = (top + (y + 0.5) * step).astype(int)
    sx = np.floor(front.shape[1] / 2 + (x + 0.5 - height) * step).astype(int)
    valid = (sx >= 0) & (sx < front.shape[1])
    sx = sx.clip(0, front.shape[1] - 1)
    registered = {}
    for name, mask in views.items():
        if mask.shape != front.shape:
            raise ValueError("All views of one model must have the same framing")
        yy, xx = np.nonzero(mask)
        if yy.min() < top - 1 or yy.max() > rows[-1] + 1:
            raise ValueError(f"{name} extends outside the front T-pose height")
        if abs(xx + 0.5 - front.shape[1] / 2).max() > step * height:
            raise ValueError(f"{name} extends outside the registered width")
        registered[name] = mask[sy, sx] & valid
    return registered


def overlap(a, b):
    return round(np.count_nonzero(a & b) / max(1, np.count_nonzero(a | b)), 4)


def compare(reference, candidates, dest):
    reference = register(mattes(reference))
    dest.mkdir(parents=True, exist_ok=True)
    cell_width, cell_height = 310, 367
    sheet = Image.new("RGB", (len(VIEWS) * cell_width, len(candidates) * cell_height + 24), "#faf8f4")
    draw = ImageDraw.Draw(sheet)
    scores = {}
    for i, study in enumerate(candidates):
        key = str(study)
        scores[key] = {}
        candidate = register(mattes(study))
        for j, view in enumerate(VIEWS):
            a, b = reference[view], candidate[view]
            score = overlap(a, b)
            scores[key][view] = score
            rgb = np.full((*a.shape, 3), [250, 248, 244], dtype=np.uint8)
            rgb[a & b] = [81, 83, 89]
            rgb[a & ~b] = [16, 149, 161]
            rgb[b & ~a] = [223, 115, 42]
            image = Image.fromarray(rgb)
            x = np.flatnonzero((a | b).any(axis=0))
            extent = max(325, (x[-1] - x[0]) // 2 + 3)
            mid = (x[0] + x[-1]) // 2
            image = image.crop((mid - extent, 0, mid + extent, image.height))
            image.thumbnail((308, 332), Image.Resampling.LANCZOS)
            left, top = cell_width * j, cell_height * i
            sheet.paste(image, (left + (cell_width - image.width) // 2, top + 28))
            draw.text((left + 8, top + 8), f"{study.name}   {view}   {100 * score:.1f}%", fill="#252627")
    draw.text((8, sheet.height-18), "Teal   reference only       Orange   reconstruction only       Grey   overlap", fill="#252627")
    sheet.save(dest / "turn-comparison.png")
    (dest / "turn-scores.json").write_text(json.dumps(scores, indent=2) + "\n")
    return scores


def audit_portraits(reference, candidates, output, origin):
    """Compare saved native portraits with drawings without refitting any geometry."""
    from avatar_authoring.profile import compare_profile, registered_profile

    output.mkdir(parents=True, exist_ok=True)
    report = {"guide_origin": origin, "candidates": []}
    for i, study in enumerate(candidates, 1):
        directory = study
        if (study / "run.json").is_file():
            selected = json.loads((study / "run.json").read_text()).get("selected")
            if not selected:
                raise ValueError(f"No selected pass in {study}. To inspect a rejected pass supply its directory.")
            directory = study / selected
        recipe = (directory / "recipe.json").read_bytes()
        design = json.loads(recipe)["design"]
        record = {"pass": str(directory), "recipe_sha256": hashlib.sha256(recipe).hexdigest(), "turns": {}}
        for side, capture in (("quarter", "quarter"), ("right", "profile"), ("left", "other-profile")):
            guide = reference / f"{side}.png"
            if not guide.is_file():
                continue
            quarter = side == "quarter"
            native = directory / f"portrait-{capture}.png"
            # A mislabelled file reverses which asymmetrical temple is tested.
            if registered_profile(guide, design, quarter=quarter)[1] != (side != "left"):
                raise ValueError(f"The visible nose faces the wrong way in {guide}")
            measured = compare_profile(guide, native, design, output / f"{i}-{side}.png", quarter)
            record["turns"][side] = {
                "guide_sha256": hashlib.sha256(guide.read_bytes()).hexdigest(), **measured
            }
        if not record["turns"]:
            raise ValueError(f"No quarter.png, right.png or left.png in {reference}")
        report["candidates"].append(record)
    (output / "portrait-scores.json").write_text(json.dumps(report, indent=2) + "\n")
    return report


if __name__ == "__main__":
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("reference", type=Path)
    cli.add_argument("candidates", type=Path, nargs="+")
    cli.add_argument("--output", type=Path, required=True)
    cli.add_argument("--portrait-guides", choices=["generated", "reference"],
                     help="Audit saved recipes against portraits in the reference folder (quarter.png, right.png, left.png)")
    args = cli.parse_args()
    if args.portrait_guides:
        audit_portraits(args.reference, args.candidates, args.output, args.portrait_guides)
        print(args.output / "portrait-scores.json")
    else:
        print(json.dumps(compare(args.reference, args.candidates, args.output), indent=2))
