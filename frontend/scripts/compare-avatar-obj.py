"""Compare a runtime Rick capture with the source OBJ at the recorded camera."""

import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from obj_avatar import components, raster
from scipy.ndimage import binary_erosion, binary_fill_holes


def layer_intrusions(source, actual):
    """Count foreign layers inside a surface, excluding antialiased borders.
    A displaced collar edge is a fit error; an enclosed island is a cut.
    """
    actual = actual.astype(np.int16)
    source = source.astype(np.int16)

    def matches(image, swatch, tol=7):
        return np.max(abs(image - swatch), axis=2) <= tol

    def inside(mask):
        return binary_erosion(mask, iterations=2)

    shirt = [154, 218, 216]
    ref_shirt = inside(matches(source, shirt))
    shirt_hull = binary_fill_holes(matches(actual, shirt))
    coat = matches(actual, [254, 254, 254]) | matches(actual, [236, 236, 236])
    mouth = inside(
        matches(source, [104, 35, 36])
        | matches(source, [218, 204, 156])
        | matches(source, [212, 88, 88])
    )
    ref_coat = inside(
        matches(source, [254, 254, 254]) | matches(source, [236, 236, 236])
    )
    return {
        "coat_inside_shirt": int((ref_shirt & shirt_hull & coat).sum()),
        "background_inside_shirt": int(
            (ref_shirt & shirt_hull & matches(actual, source[0, 0], 2)).sum()
        ),
        "hair_inside_mouth": int((mouth & matches(actual, [170, 212, 234])).sum()),
        "shirt_inside_coat": int(
            (ref_coat & binary_fill_holes(coat) & matches(actual, shirt)).sum()
        ),
    }


def compare(parts, captures, output):
    output.mkdir(parents=True, exist_ok=True)
    calibration = json.loads((captures / "rick-cameras.json").read_text())
    results = {}
    images = []
    for name, view in calibration.items():
        generated = np.array(
            Image.open(captures / f"rick-calibrated-{name}.png").convert("RGB")
        )
        h, w = generated.shape[:2]
        basis = np.array(view["basis"])
        offset = np.array([650.7, 743, -31])
        # The browser resolves a multisampled linear framebuffer before displaying
        # sRGB. Match its subpixel footprint on fine strands, teeth and trouser edges.
        depth = np.full((2 * h, 2 * w), -np.inf, np.float32)
        samples = np.empty((2 * h, 2 * w, 3), np.uint8)
        samples[:] = generated[0, 0]
        head = []
        eyes = []
        for part, _, xyz, c, f in parts:
            projected = (xyz - offset) @ (basis[1:] - basis[0]) + basis[0]
            view_samples = projected.copy()
            view_samples[:, :2] = projected[:, :2] * 2 + 0.5
            raster(view_samples, c, f, depth, samples)
            if part == 8:
                eyes.append(
                    (projected[:, :2].min(axis=0), projected[:, :2].max(axis=0))
                )
            if part in (0, 2, 11):
                head.append(
                    (projected[:, :2].min(axis=0), projected[:, :2].max(axis=0))
                )
        fg = np.isfinite(depth).reshape(h, 2, w, 2).sum(axis=(1, 3)) >= 2
        srgb = np.arange(256, dtype=np.float32) / 255
        linear = np.where(
            srgb <= 0.04045, srgb / 12.92, ((srgb + 0.055) / 1.055) ** 2.4
        )
        pixel = linear[samples].reshape(h, 2, w, 2, 3).mean(axis=(1, 3))
        src = (
            np.rint(
                np.where(
                    pixel <= 0.0031308,
                    pixel * 12.92,
                    1.055 * pixel ** (1 / 2.4) - 0.055,
                )
                * 255
            )
            .clip(0, 255)
            .astype(np.uint8)
        )
        candidate = (
            np.asarray(Image.open(captures / f"rick-mask-{name}.png").convert("L"))
            >= 128
        )
        iou = (fg & candidate).sum() / (fg | candidate).sum()
        raw = np.array(Image.open(captures / f"rick-mrgb-{name}.png").convert("RGB"))
        mae = abs(src.astype(float) - raw)[fg & candidate].mean()
        stats = {
            "silhouette_iou": round(float(iou), 4),
            "mrgb_color_mae": round(float(mae), 2),
            "layer_intrusion_pixels": layer_intrusions(src, raw),
        }
        if "portrait" in name:
            regions = {}
            limits = np.array(head)
            lx, ly = np.maximum(0, np.floor(limits[:, 0].min(axis=0)).astype(int))
            hx, hy = np.ceil(limits[:, 1].max(axis=0)).astype(int)
            raw_region = raw[ly : hy + 1, lx : hx + 1].astype(float)
            ref_region = src[ly : hy + 1, lx : hx + 1].astype(float)
            for role, swatch in {
                "hair": [170, 212, 234],
                "skin": [197, 178, 164],
                "eye_white": [255, 255, 255],
                "mouth": [104, 35, 36],
            }.items():
                region_ref, region_raw = ref_region, raw_region
                if role == "eye_white":
                    # The coat is also white and enters the portrait below the ears.
                    eye_bounds = np.asarray(eyes)
                    x0, y0 = np.maximum(
                        0, np.floor(eye_bounds[:, 0].min(axis=0)).astype(int) - 3
                    )
                    x1, y1 = np.ceil(eye_bounds[:, 1].max(axis=0)).astype(int) + 4
                    region_ref = src[y0:y1, x0:x1].astype(float)
                    region_raw = raw[y0:y1, x0:x1].astype(float)
                a = np.max(abs(region_ref - swatch), axis=2) <= 8
                b = np.max(abs(region_raw - swatch), axis=2) <= 8
                if (a | b).any():
                    regions[role] = round(float((a & b).sum() / (a | b).sum()), 4)
            stats["face_paint_iou"] = regions
        y, x = np.where(fg | candidate)
        box = (x.min() - 3, y.min() - 3, x.max() + 4, y.max() + 4)
        if "portrait" in name:
            bounds = np.array(head)
            x0, y0 = bounds[:, 0].min(axis=0) - 6
            x1, y1 = bounds[:, 1].max(axis=0) + 6
            box = (x0, y0, x1, y1)
        box = (
            max(0, int(box[0])),
            max(0, int(box[1])),
            min(w, int(box[2])),
            min(h, int(box[3])),
        )
        images.append(
            (name, [Image.fromarray(a).crop(box) for a in (src, raw, generated)])
        )
        results[name] = stats
        Image.fromarray(src).save(output / f"rick-obj-{name}.png")
    font = lambda n: ImageFont.truetype("DejaVuSans.ttf", n)

    def sheet(panels, dims, filename):
        width, height = dims
        gap = 10
        out = Image.new(
            "RGB",
            (145 + (width + gap) * len(panels), 90 + 3 * (height + gap)),
            "#f7f5ef",
        )
        draw = ImageDraw.Draw(out)
        draw.text((16, 12), "Rick Sanchez", fill="#302c29", font=font(25))
        for i, (name, pair) in enumerate(panels):
            cx = 145 + i * (width + gap)
            label = {
                "portrait": "Front",
                "portrait-quarter": "Three-quarter",
                "portrait-profile": "Profile",
            }.get(name, name.title())
            draw.text(
                (cx + width / 2, 54), label, fill="#383430", font=font(16), anchor="mt"
            )
            for j, image in enumerate(pair):
                image = image.copy()
                image.thumbnail((width, height), Image.Resampling.LANCZOS)
                pad = Image.new("RGB", (width, height), tuple(generated[0, 0]))
                pad.paste(
                    image, ((width - image.width) // 2, (height - image.height) // 2)
                )
                out.paste(pad, (cx, 78 + j * (height + gap)))
        for j, text in enumerate(["Source OBJ", "Procedural MRGB", "Baked paint"]):
            draw.text(
                (16, 78 + j * (height + gap) + height / 2),
                text,
                font=font(17),
                fill="#393632",
            )
        out.save(output / filename)

    sheet(
        [p for p in images if p[0] in ("front", "profile", "back")],
        (320, 360),
        "rick-obj-turntable.png",
    )
    sheet(
        [p for p in images if "portrait" in p[0]], (290, 290), "rick-obj-portraits.png"
    )
    counts = sum(len(f) for _, _, _, _, f in parts)
    (output / "rick-obj-metrics.json").write_text(
        json.dumps({"source_triangles": counts, "views": results}, indent=2)
    )
    return results


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path)
    parser.add_argument("captures", type=Path)
    parser.add_argument("out", type=Path)
    parser.add_argument("--min-silhouette", type=float, default=0)
    parser.add_argument("--max-mrgb-error", type=float, default=255)
    parser.add_argument(
        "--max-intrusion-pixels",
        type=int,
        help="Maximum enclosed wrong-layer pixels per check in each camera",
    )
    args = parser.parse_args()
    results = compare(list(components(args.archive)), args.captures, args.out)
    print(json.dumps(results, indent=2))
    if any(
        v["silhouette_iou"] < args.min_silhouette
        or v["mrgb_color_mae"] > args.max_mrgb_error
        or (
            args.max_intrusion_pixels is not None
            and max(v["layer_intrusion_pixels"].values()) > args.max_intrusion_pixels
        )
        for v in results.values()
    ):
        raise SystemExit("Reference comparison exceeded the supplied tolerance.")
