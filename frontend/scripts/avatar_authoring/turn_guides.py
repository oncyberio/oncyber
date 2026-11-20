"""Compare a frozen head turn against an illustration withheld from the author."""

from pathlib import Path
from tempfile import TemporaryDirectory

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

from .fit import pixels
from .profile import registered_profile
from .review import iou
from .sun_rays import orb_contour


def orb_roles(path, paints):
    """Center on the orb's exposed arcs. One radius scales both axes."""
    rgb, active = pixels(path, keep_components=True)
    tint = rgb - rgb.mean(2, keepdims=True)
    chroma = np.linalg.norm(tint, axis=2)

    def pigment(hex_color):
        dye = np.array(list(bytes.fromhex(hex_color[1:])), dtype=float)
        dye -= dye.mean()
        return (
            active & (chroma > 33) & (tint @ dye > 0.90 * chroma * np.linalg.norm(dye))
        )

    skin, rays = pigment(paints["skin"]), pigment(paints["rays"])
    glass = active & (rgb.max(2) < 102) & (chroma < 40)
    labels, count = ndimage.label(glass[: round(active.shape[0] * 0.68)])
    if not count:
        raise ValueError("Cannot locate the turned visor")
    ey = np.nonzero(labels == 1 + np.bincount(labels.ravel())[1:].argmax())[0].mean()
    band = skin[: round(ey)]
    rows = np.flatnonzero(band.sum(1) > max(4, active.shape[1] * 0.02))
    if not len(rows):
        raise ValueError("Cannot locate the painted forehead above the visor")
    _, xs = np.where(band[rows[0] :])
    left, right = np.percentile(xs, [0.5, 99.5])
    radius = (right - left) / 2
    center = [(right + left) / 2, rows[0] + radius]
    arcs = orb_contour(rgb, active, center, (radius, radius))
    if arcs is None:
        raise ValueError("The two visible orb arcs do not support registration")
    cx, cy, _, radius = arcs
    # Stop above the throat. The guide specifies head yaw and may give the
    # lower body a different pose from the recorded T-pose.
    y, x = np.mgrid[-1.95:0.92:250j, -1.84:1.84:320j]
    iy, ix = np.rint(cy + y * radius).astype(int), np.rint(cx + x * radius).astype(int)
    inside = (iy >= 0) & (ix >= 0) & (iy < len(active)) & (ix < active.shape[1])
    iy, ix = iy.clip(0, len(active) - 1), ix.clip(0, active.shape[1] - 1)
    frame = np.where(inside[:, :, None], rgb[iy, ix], rgb[0, 0]).astype(np.uint8)
    return frame, {
        key: inside & mask[iy, ix]
        for key, mask in [("skin", skin), ("rays", rays), ("visor", glass)]
    }


def registered_turn_pairs(guide, split_x, candidate, captures):
    """Yield drawing and mesh in the same head frame for each recorded angle."""
    with Image.open(guide) as sheet, TemporaryDirectory() as tmp:
        if not 0 < split_x < sheet.width:
            raise ValueError("Invalid guide split")
        for angle, bounds, native in (
            (35, (0, 0, split_x, sheet.height), "portrait-quarter.png"),
            (90, (split_x, 0, sheet.width, sheet.height), "portrait-profile.png"),
        ):
            art = Path(tmp) / f"{angle}.png"
            sheet.crop(bounds).save(art)
            pair = []
            for path in (art, captures / native):
                if candidate.get("family", "rick-classic") == "sunshine":
                    frame, regions = orb_roles(path, candidate["paints"])
                else:
                    (levels, frame), _, _, _ = registered_profile(
                        path, candidate["design"], angle == 35, "both"
                    )
                    regions = {
                        "skin": levels == 2,
                        "hair": levels == 3,
                        "silhouette": levels > 0,
                    }
                pair.append((frame, regions))
            yield angle, native, pair


def compare_turns(guide, split_x, candidate, captures, output):
    """Keep the two projected comparisons separate; a reviewer judges identity."""
    canvas = Image.new("RGB", (960, 566), "#f5f2eb")
    pen = ImageDraw.Draw(canvas)
    scores = {}
    for row, (angle, _, pair) in enumerate(
        registered_turn_pairs(guide, split_x, candidate, captures)
    ):
        origin = 283 * row
        a, b = (regions for _, regions in pair)
        scores[str(angle)] = {key + "_iou": iou(a[key], b[key]) for key in a}
        silhouette_a = np.logical_or.reduce(list(a.values()))
        silhouette_b = np.logical_or.reduce(list(b.values()))
        overlay = np.full((*silhouette_a.shape, 3), [246, 242, 233], dtype=np.uint8)
        overlay[silhouette_a] = [215, 132, 87]
        overlay[silhouette_b] = [48, 141, 169]
        overlay[silhouette_a & silhouette_b] = [82, 71, 71]
        for col, (im, label) in enumerate(
            [
                (pair[0][0], f"{angle}°  Guide drawing"),
                (pair[1][0], f"{angle}°  Native render"),
                (overlay, "Orange drawing · blue mesh · dark overlap"),
            ]
        ):
            canvas.paste(Image.fromarray(im), (320 * col, origin + 25))
            pen.text((320 * col + 6, origin + 5), label, fill="#252625")
    canvas.save(output, lossless=True)
    return scores
