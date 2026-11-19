"""Put held-out artwork and actual native views on a comparable review sheet."""

import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

from .fit import pixels


def view_tile(path, size, head_fraction=None):
    rgb, mask = pixels(path, keep_components=True)
    y, x = np.where(mask)
    height = np.ptp(y)
    if head_fraction:
        # The width follows the crown as well as the orb, in both orientations.
        cutoff = min(len(mask), y.min() + round(head_fraction * height))
        chin = min(len(mask), cutoff + round(0.015 * height))
        for row in range(y.min() + round(0.14 * height), cutoff):
            foreground = np.flatnonzero(mask[row])
            if foreground.size and np.ptp(foreground) > 0.40 * height:
                cutoff = max(y.min() + 2, row - 1)
                break
        face_x = np.where(mask[:cutoff])[1]
        x0, x1 = face_x.min(), face_x.max()
        box = (x0 - 3, y.min() - 3, x1 + 4, chin)
    else:
        box = (x.min() - 2, y.min() - 2, x.max() + 3, y.max() + 3)
    rgb[~mask] = [245, 244, 241]
    tile = Image.fromarray(rgb.astype("uint8")).crop(tuple(map(int, box)))
    tile.thumbnail(size, Image.Resampling.LANCZOS)
    return tile


def review_sheet(reports, targets, output):
    width, full_height, face_height = 225, 249, 142
    row_height = 38 + full_height + face_height
    columns = ["Drawing", "Native front", "Native 35°", "Native 90°"]
    if any((targets / (key + "-profile.webp")).is_file() for key in reports):
        columns.append("Profile drawing¹")
    sheet = Image.new(
        "RGB", (len(columns) * width, 56 + row_height * len(reports) + 36), "#f5f4f1"
    )
    draw = ImageDraw.Draw(sheet)

    def font(sz):
        try:
            return ImageFont.truetype("DejaVuSans.ttf", sz)
        except OSError:
            return ImageFont.load_default()

    for col, title in enumerate(columns):
        draw.text((col * width + 13, 18), title, fill="#20252a", font=font(18))
    for index, (key, report) in enumerate(reports.items()):
        top = 56 + index * row_height
        dest = Path(report["best"])
        review = json.loads((dest / "review.json").read_text())
        head = (review.get("candidates", {}).get(report["family"]) or {}).get(
            "head_fraction", 0.25
        )
        recipe = dest / "candidate.json"
        label = (
            json.loads(recipe.read_text()).get("name", key.title())
            if recipe.exists()
            else key.title()
        )
        status = "Passed" if review["accepted"] else "Under review"
        draw.line((0, top, sheet.width, top), fill="#a9aaa6")
        draw.text(
            (12, top + 6),
            f"{label}  /  {report['family']}  /  {status}",
            fill="#353a3d",
            font=font(16),
        )
        paths = [
            targets / (key + ".webp"),
            dest / "front.png",
            dest / "quarter.png",
            dest / "profile.png",
            targets / (key + "-profile.webp"),
        ]
        for col, path in enumerate(paths[: len(columns)]):
            if not path.is_file():
                continue
            for offset, height, crop in (
                (32, full_height, None),
                (32 + full_height, face_height, head),
            ):
                tile = view_tile(path, (width - 14, height - 10 if crop else 201), crop)
                sheet.paste(
                    tile,
                    (
                        col * width + (width - tile.width) // 2,
                        top + offset + (height - tile.height) // 2,
                    ),
                )
    if len(columns) > 4:
        draw.text(
            (12, sheet.height - 26),
            "¹ Independent GPT Image interpretation, held out of fitting.",
            font=font(14),
            fill="#46484a",
        )
    sheet.save(output)
