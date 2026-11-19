"""A full-figure and face ruler in the coordinate system of draw_cartoon."""

import numpy as np
from PIL import Image, ImageDraw, ImageFont

from .eye_review import portrait_pair
from .eyes import suggest_eye_centers
from .fit import bounds, pixels


def head_region(mask):
    h, w = mask.shape
    left, top, right, floor = bounds(mask)
    # In a T-pose the first broad row is the arms. Restrict the portrait to
    # the subject above them, preserving headwear and space around the jaw.
    arm_rows = np.flatnonzero(np.sum(mask, axis=1) > (right - left) * 0.58)
    shoulder = next((int(y) for y in arm_rows if y > top), floor)
    shoulder = np.clip(shoulder, top + (floor - top) * 0.13, top + (floor - top) * 0.46)
    pad = max(3, round((shoulder - top) * 0.12))
    xl, _, xr, _ = bounds(mask[top : max(top + 1, int(shoulder) - pad)])
    portrait = (
        max(0, xl - pad),
        max(0, top - pad),
        min(w, xr + pad),
        min(h, int(shoulder) + pad),
    )
    return portrait


def suggested_landmarks(rgb, mask, box):
    x0, y0, x1, y1 = box
    local = suggest_eye_centers(rgb[y0:y1, x0:x1], mask[y0:y1, x0:x1])
    if len(local) == 2:
        return [[x0 + x, y0 + y] for x, y in local]
    # A small black dot may cover too few source pixels for the close-up
    # detector. The paired white components still identify both sockets.
    found = portrait_pair(rgb, box)
    centers = [
        [(a + c - 1) / 2, (b + d - 1) / 2]
        for a, b, c, d in (eye["bounds"] for eye in found)
    ]
    return centers if all(x0 <= x < x1 and y0 <= y < y1 for x, y in centers) else []


def draw_guide(path, destination):
    rgb, mask = pixels(path)
    h, w = mask.shape
    portrait = head_region(mask)
    rgb[~mask] = [249, 248, 245]
    source = Image.fromarray(rgb.astype(np.uint8))
    sheet = Image.new("RGB", (1220, 692), "#f9f8f5")
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.truetype("DejaVuSans.ttf", 14)
    for origin, size, title, box in [
        ((47, 61), (630, 580), "Full T-pose", (0, 0, w, h)),
        ((745, 61), (447, 580), "Head and neckline", portrait),
    ]:
        x0, y0, x1, y1 = box
        ratio = min(size[0] / (x1 - x0), size[1] / (y1 - y0))
        pw, ph = max(2, round((x1 - x0) * ratio)), max(2, round((y1 - y0) * ratio))
        x, y = origin
        sheet.paste(source.crop(box).resize((pw, ph), Image.Resampling.LANCZOS), (x, y))
        draw.text((x, 9), title, fill="#201f22", font=font)
        draw.rectangle((x - 1, y - 1, x + pw, y + ph), outline="#98948f")
        # A label on the crop has exactly the same value as that point in the
        # original. Keep labels outside the drawing and adapt spacing for narrow crops.
        for axis, (lo, hi, span, dimension) in enumerate(
            [(x0, x1, pw, w), (y0, y1, ph, h)]
        ):
            for step in (10, 25, 50, 100, 200, 500, 1000):
                if step * (dimension - 1) * (span - 1) / (
                    1000 * max(1, hi - lo - 1)
                ) >= (37 if axis == 0 else 22):
                    break
            for coordinate in range(0, 1001, step):
                pixel = coordinate * (dimension - 1) / 1000
                if not lo <= pixel <= hi - 1:
                    continue
                offset = round((pixel - lo) * (span - 1) / max(1, hi - lo - 1))
                if axis == 0:
                    at = x + offset
                    draw.line((at, y - 5, at, y + 2), fill="#383638")
                    draw.text(
                        (at, y - 8),
                        str(coordinate),
                        anchor="mb",
                        fill="#383638",
                        font=font,
                    )
                else:
                    at = y + offset
                    draw.line((x - 5, at, x + 2, at), fill="#383638")
                    draw.text(
                        (x - 9, at),
                        str(coordinate),
                        anchor="rm",
                        fill="#383638",
                        font=font,
                    )
    draw.text(
        (47, 663),
        "Both rulers use the original frame. X increases to the right, Y downward.",
        fill="#393737",
        font=font,
    )
    suggestions = suggested_landmarks(rgb, mask, portrait)
    if suggestions:
        coordinates = [
            f"({round(1000 * x / (w - 1))}, {round(1000 * y / (h - 1))})"
            for x, y in suggestions
        ]
        draw.text(
            (745, 663),
            "Eye centers L / R    " + "    ".join(coordinates),
            fill="#393737",
            font=font,
        )
    sheet.save(destination)
