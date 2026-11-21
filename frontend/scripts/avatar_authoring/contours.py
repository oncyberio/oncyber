"""Measure the painted stroke on the figure side of a light silhouette."""

from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage


def contour_samples(paint: Path, matte: Path | None = None):
    rgb = np.asarray(Image.open(paint).convert("RGB"), dtype=np.float32)
    if matte is None:
        # Native portrait captures use a flat paper background. Filling holes
        # keeps a painted highlight that matches the paper inside the figure.
        mask = ndimage.binary_fill_holes(abs(rgb - rgb[0, 0]).max(axis=2) > 5)
    else:
        mask = np.asarray(Image.open(matte).convert("L")) > 127
    region = mask & ~ndimage.binary_erosion(mask)
    region[:9] = region[-9:] = False
    region[:, :9] = region[:, -9:] = False
    points = np.array(np.nonzero(region))
    normal = np.gradient(ndimage.gaussian_filter(mask.astype(float), 1.7))
    normal = np.array([channel[tuple(points)] for channel in normal])
    normal /= np.maximum(1e-6, np.linalg.norm(normal, axis=0))
    luma = rgb @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)

    def sample(image, offset):
        return ndimage.map_coordinates(
            image, points + normal * offset, order=1, mode="nearest"
        )

    near = np.array([sample(luma, t / 2) for t in range(-1, 6)])
    interior = np.array([sample(luma, t) for t in (5, 6, 7)])
    pigment = np.median(interior, axis=0)
    # Exclude dark clothing, fine spikes and overlapping interior features.
    eligible = (
        (pigment > 145)
        & (np.ptp(interior, axis=0) < 20)
        & (sample(mask.astype(float), 7) > 0.99)
        & (sample(mask.astype(float), -2) < 0.01)
    )
    if eligible.sum() < 40:
        raise ValueError(f"Too few light silhouette samples in {paint}")
    dark = near[:, eligible] < (pigment[eligible] - 42)
    return {
        "samples": int(eligible.sum()),
        "ink_fraction": round(float(dark.any(axis=0).mean()), 4),
    }


def contour_review(folder: Path):
    scores = {}
    for view in ("front", "quarter", "profile", "back"):
        mask = folder / ("mask.png" if view == "front" else view + "-mask.png")
        scores["body-" + view] = contour_samples(folder / (view + ".png"), mask)
    for view in (
        "portrait",
        "portrait-quarter",
        "portrait-profile",
        "portrait-rear-quarter",
        "portrait-back",
        "portrait-other-rear",
        "portrait-other-profile",
        "portrait-other-quarter",
    ):
        scores[view] = contour_samples(folder / (view + ".png"))
    return scores


def contour_sheet(before: Path, after: Path, output: Path):
    from PIL import ImageDraw, ImageFont

    views = [
        ("portrait-quarter", "35°"),
        ("portrait-profile", "Profile"),
        ("portrait-back", "Back"),
        ("quarter", "Full body · 35°"),
    ]
    side, row_height = 350, 391
    sheet = Image.new("RGB", (side * len(views), 2 * row_height), "#f6f3ef")
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.truetype("DejaVuSans.ttf", 18)
    for row, (root, name) in enumerate(((before, "Previous"), (after, "Revised"))):
        for col, (view, label) in enumerate(views):
            with Image.open(root / (view + ".png")) as image:
                w, h = image.size
                span = round(h * 0.74) if view.startswith("portrait") else h
                top = round(h * 0.1) if view.startswith("portrait") else 0
                tile = image.crop(
                    ((w - span) // 2, top, (w - span) // 2 + span, top + span)
                )
                sheet.paste(
                    tile.resize((side, side), Image.Resampling.LANCZOS),
                    (col * side, row * row_height + 37),
                )
            draw.text(
                (col * side + 12, row * row_height + 8),
                f"{name} · {label}",
                font=font,
                fill="#302b2a",
            )
    sheet.save(output, quality=95, method=6)
