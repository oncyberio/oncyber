"""Measure pupil visibility and alignment in the native cast review portraits."""

import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy.ndimage import binary_fill_holes, find_objects, label
from scipy.spatial import ConvexHull


def locate_eyes(image):
    rgb = np.asarray(image.convert("RGB"), dtype=np.int16)
    h, w = rgb.shape[:2]
    # The neutral studio background is lighter than many baked materials.
    foreground = np.abs(rgb - rgb[0, 0]).max(axis=2) > 15
    # Pale cheek paint can be brighter than a shaded globe. Its warm hue
    # separates it from the native cornea even where their outlines meet.
    white = (rgb.min(axis=2) > 213) & (np.ptp(rgb, axis=2) < 18) & foreground
    white[: int(h * 0.18)] = False
    white[int(h * 0.69) :] = False
    whites, _ = label(white)
    sizes = np.bincount(whites.ravel())
    sizes[0] = 0
    eyes = []
    boxes = find_objects(whites)
    for i in np.argsort(sizes)[-2:][::-1]:
        if sizes[i] < max(w * h * 0.0003, 0.16 * sizes.max()):
            continue
        ys, xs = boxes[i - 1]
        sclera = whites[ys, xs] == i
        # Only count dark islands fully enclosed by a single eye white.
        local = rgb[ys, xs]
        enclosed = binary_fill_holes(sclera)
        black = enclosed & (local.max(axis=2) < 100)
        skin = (
            enclosed & (local[:, :, 0] > 110) & (local[:, :, 0] - local[:, :, 2] > 34)
        )
        gaps, _ = label(skin)
        gap_sizes = np.bincount(gaps.ravel(), minlength=2)[1:]
        pupils, n = label(black)
        pupil_sizes = np.bincount(pupils.ravel(), minlength=n + 1)
        pupil_sizes[0] = 0
        candidates = np.where(pupil_sizes >= max(3, sclera.sum() * 0.0015))[0]
        eye = {
            "bounds": [xs.start, ys.start, xs.stop, ys.stop],
            "pupils": len(candidates),
            "skin_gap_pixels": int(gap_sizes.max()),
        }
        if len(candidates) == 1:
            y, x = np.where(pupils == candidates[0])
            eye.update(
                width=int(np.ptp(x)) + 1,
                height=int(np.ptp(y)) + 1,
                pixels=len(x),
                gaze_x=round(float(2 * (x.mean() + 0.5) / sclera.shape[1] - 1), 3),
                gaze_y=round(float(2 * (y.mean() + 0.5) / sclera.shape[0] - 1), 3),
            )
        eyes.append(eye)
    return sorted(eyes, key=lambda eye: eye["bounds"][0])


def eye_crop(picture, eyes, size):
    w, h = picture.size
    if eyes:
        boxes = np.array([e["bounds"] for e in eyes])
        x = (boxes[:, 0].min() + boxes[:, 2].max()) / 2
        y = (boxes[:, 1].min() + boxes[:, 3].max()) / 2
    else:
        x, y = w / 2, h * 0.43
    width = w * 0.67
    height = width * size[1] / size[0]
    left = np.clip(x - width / 2, 0, w - width)
    top = np.clip(y - height * 0.55, 0, h - height)
    return picture.crop((left, top, left + width, top + height)).resize(
        size, Image.Resampling.LANCZOS
    )


def review_eyes(dest: Path, cast, previous=None):
    """Inspect both face-on pupils and their foreshortening as the head turns."""
    failures, metrics = [], {}
    columns = ([("Earlier · front", previous, "")] if previous else []) + [
        ("Front", dest, ""),
        ("35°", dest, "-quarter"),
        ("Profile", dest, "-profile"),
    ]
    if all((dest / f"{slug}-portrait-other-quarter.png").exists() for slug in cast):
        columns.extend(
            [("−35°", dest, "-other-quarter"), ("−90°", dest, "-other-profile")]
        )
    tile = (236, 127)
    pitch = tile[1] + 29
    sheet = Image.new(
        "RGB", (len(columns) * (tile[0] + 7) + 17, len(cast) * pitch + 61), "#f4f1e9"
    )
    pen = ImageDraw.Draw(sheet)
    normal = ImageFont.truetype("DejaVuSans.ttf", 14)
    bold = ImageFont.truetype("DejaVuSans-Bold.ttf", 15)
    pen.text((10, 5), "Rick and Morty family · eye study", fill="#322c28", font=bold)
    for j, (title, _, _) in enumerate(columns):
        pen.text((10 + j * (tile[0] + 7), 32), title, fill="#564c45", font=normal)
    for i, (slug, model) in enumerate(cast.items()):
        y = 56 + i * pitch
        pen.text((10, y), model["name"], font=bold, fill="#302a26")
        views = {}
        for j, (title, folder, angle) in enumerate(columns):
            with Image.open(folder / f"{slug}-portrait{angle}.png") as src:
                eyes = locate_eyes(src)
                if folder == dest:
                    views[title] = eyes
                sheet.paste(
                    eye_crop(src.convert("RGB"), eyes, tile),
                    (10 + j * (tile[0] + 7), y + 21),
                )
        metrics[slug] = views
        front, quarter = views["Front"], views["35°"]
        checks = [("front", front), ("35°", quarter)]
        if "−35°" in views:
            checks.append(("−35°", views["−35°"]))
        patch = model.get("eye_patch")
        expected = 1 if patch else 2
        if model.get("profile_pupils"):
            for title in ("Profile", "−90°"):
                if title in views and [eye["pupils"] for eye in views[title]] != [1]:
                    failures.append(
                        f"{slug} {title}: expected one exposed eye with its pupil"
                    )
        if patch and len(front) == 1:
            l, t, r, b = front[0]["bounds"]
            with Image.open(dest / f"{slug}-portrait.png") as source:
                rgb = np.asarray(source.convert("RGB"), dtype=float)
            center = rgb.shape[1] / 2
            exposed = (l + r) / 2
            if (exposed > center) != (patch["side"] == "right"):
                failures.append(f"{slug}: eyepatch covers the wrong socket")
            x = int(2 * center - exposed)
            region = rgb[
                max(0, t - (b - t) // 2) : b,
                max(0, x - (r - l) // 3) : x + (r - l) // 3,
            ]
            if not region.size or np.mean(region.max(2) < 110) < 0.46:
                failures.append(
                    f"{slug}: socket must be covered by the painted eyepatch"
                )
        for name, pair in checks:
            if any(e["skin_gap_pixels"] > 5 for e in pair):
                failures.append(f"{slug} {name}: visible skin inside the eye white")
            if len(pair) != expected or any(e["pupils"] != 1 for e in pair):
                failures.append(
                    f"{slug} {name}: expected one enclosed pupil per visible eye"
                )
        if len(front) == 2 and all(e["pupils"] == 1 for e in front):
            for e in front:
                l, _, r, _ = e["bounds"]
                if not 0.065 <= e["width"] / (r - l) <= 0.25:
                    failures.append(
                        f"{slug}: frontal pupil outside the reference size range"
                    )
            if (
                max(
                    abs(front[0][axis] - front[1][axis])
                    for axis in ("gaze_x", "gaze_y")
                )
                > 0.28
            ):
                failures.append(f"{slug}: the two frontal eyes disagree on gaze")
        for name, pair in checks[1:]:
            if len(pair) == 2 and all(e["pupils"] == 1 for e in pair):
                for q in pair:
                    if q["width"] > 1.30 * q["height"]:
                        failures.append(f"{slug}: stretched pupil at {name}")
    sheet.save(dest / "eye-comparison.jpg", quality=94)
    (dest / "pupil-metrics.json").write_text(
        json.dumps({"views": metrics, "failures": failures}, indent=2) + "\n"
    )
    if failures:
        raise AssertionError("\n".join(failures))


def lid_pupil(white, rgb):
    """Recover a compact black pupil entering the aperture from the upper lid."""
    yy, xx = np.nonzero(white)
    if len(xx) < 12:
        return None
    width, height = np.ptp(xx) + 1, np.ptp(yy) + 1
    if width < 7 or height < 4 or white.sum() < 0.36 * width * height:
        return None
    # A dark pupil makes a concave notch in the otherwise convex white. The
    # hull excludes the eyelid, eyelashes and eyebrow outside the aperture.
    points = np.column_stack((xx, yy))
    hull = ConvexHull(points)
    canvas = Image.new("L", (white.shape[1], white.shape[0]))
    ImageDraw.Draw(canvas).polygon([tuple(p) for p in points[hull.vertices]], fill=1)
    void = np.asarray(canvas, dtype=bool) & ~binary_fill_holes(white)
    labels, _ = label(void & (rgb.max(axis=2) < 115))
    best = None
    for i, box in enumerate(find_objects(labels), 1):
        if box is None:
            continue
        ys, xs = box
        w, h = xs.stop - xs.start, ys.stop - ys.start
        if not (
            max(2, 0.055 * width) <= w <= 0.33 * width
            and max(2, 0.055 * height) <= h <= 0.45 * height
        ):
            continue
        cx = (xs.start + xs.stop - 1) // 2
        if (
            not xx.min() + 0.12 * width <= cx <= xx.max() - 0.12 * width
            or ys.start > yy.min() + 0.22 * height
        ):
            continue
        # Require white on both flanks of the same notch and immediately
        # below the tip. Two patches of outlined cloth do not provide pupils.
        flanks = white[ys]
        if not (
            flanks[:, : xs.start].any(axis=1) & flanks[:, xs.stop :].any(axis=1)
        ).any():
            continue
        if not white[
            ys.stop : min(len(white), ys.stop + max(2, round(0.18 * height))), cx
        ].any():
            continue
        part = labels == i
        if part.sum() >= 0.45 * w * h and (best is None or part.sum() > best.sum()):
            best = part
    return best


def reference_pair(picture):
    """Find adjacent cartoon eye whites, allowing one pupil to meet a lid."""
    rgb = np.asarray(picture.convert("RGB"), dtype=np.int16)
    h, w = rgb.shape[:2]
    components, _ = label((rgb.min(axis=2) > 183) & (np.ptp(rgb, axis=2) < 25))
    candidates = []
    for i, (ys, xs) in enumerate(find_objects(components), 1):
        width, height = xs.stop - xs.start, ys.stop - ys.start
        if not (w * 0.018 < width < w * 0.37 and h * 0.014 < height < h * 0.36):
            continue
        local = components[ys, xs] == i
        if local.mean() < 0.43:
            continue
        pupil = np.count_nonzero(
            binary_fill_holes(local) & (rgb[ys, xs].max(axis=2) < 120)
        )
        candidates.append((xs.start, ys.start, xs.stop, ys.stop, local.sum(), pupil, i))
    # Ordinary enclosed pupils take precedence over the lid-contact fallback.
    # A new pair needs independent pupil evidence on both eyes.
    pairs = ranked_pairs(candidates)
    if not pairs:
        touching = []
        for x, y, r, b, area, _, idx in candidates:
            pupil = lid_pupil(components[y:b, x:r] == idx, rgb[y:b, x:r])
            if pupil is not None:
                touching.append((x, y, r, b, area, pupil.sum()))
        pairs = ranked_pairs(touching)
    if not pairs:
        return []
    _, a, b = max(pairs)
    return [{"bounds": list(box[:4])} for box in sorted((a, b), key=lambda v: v[0])]


def ranked_pairs(candidates):
    pairs = []
    for i, a in enumerate(candidates):
        for b in candidates[i + 1 :]:
            width = max(a[2] - a[0], b[2] - b[0])
            gap = abs((a[0] + a[2] - b[0] - b[2]) / 2) / width
            rise = abs((a[1] + a[3] - b[1] - b[3]) / 2) / width
            pupils = int(a[5] > 0) + int(b[5] > 0)
            if (
                pupils
                and 0.8 < gap < 2.7
                and rise < 0.55
                and min(a[4], b[4]) > max(a[4], b[4]) * 0.24
            ):
                score = (pupils, min(a[4], b[4]) / (1 + rise + abs(gap - 1.35)))
                pairs.append((score, a, b))
    return pairs


def portrait_pair(rgb, box):
    """Search at head scale, so a lowered eyelid remains measurable on a wide T-pose."""
    image = Image.fromarray(rgb.astype(np.uint8))
    x0, y0, x1, y1 = box
    pair = reference_pair(image.crop(box))
    if pair:
        return [
            {"bounds": [l + x0, t + y0, r + x0, b + y0]}
            for l, t, r, b in (v["bounds"] for v in pair)
        ]
    pair = reference_pair(image)
    return [
        v
        for v in pair
        if x0 <= (v["bounds"][0] + v["bounds"][2]) / 2 < x1
        and y0 <= (v["bounds"][1] + v["bounds"][3]) / 2 < y1
    ]


def reference_eye_sheet(dest, cast, references, previous=None):
    from PIL import ImageOps

    tile = (307, 164)
    columns = 3 if previous else 2
    sheet = Image.new(
        "RGB",
        ((tile[0] + 8) * columns + 16, (tile[1] + 35) * len(references) + 65),
        "#f4f1e9",
    )
    pen = ImageDraw.Draw(sheet)
    font = ImageFont.truetype("DejaVuSans.ttf", 15)
    bold = ImageFont.truetype("DejaVuSans-Bold.ttf", 16)
    pen.text(
        (9, 5),
        "Reference drawings and native renders · matched by eye span",
        font=bold,
        fill="#302a26",
    )
    labels = ["Drawing"] + (["Earlier"] if previous else []) + ["Revised"]
    for j, title in enumerate(labels):
        pen.text((10 + j * (tile[0] + 8), 35), title, font=font, fill="#564c45")
    for row, (slug, (angle, source)) in enumerate(references.items()):
        y = 61 + row * (tile[1] + 35)
        pen.text(
            (10, y), f"{cast[slug]['name']}  ·  {angle}°", font=bold, fill="#302a26"
        )
        files = (
            [source]
            + ([previous / f"{slug}-match.png"] if previous else [])
            + [dest / f"{slug}-match.png"]
        )
        with Image.open(files[-1]) as current:
            matched_camera_pair = locate_eyes(current)
            camera_size = current.size
        for col, path in enumerate(files):
            if not path.exists():
                continue
            with Image.open(path) as pic:
                pic = pic.convert("RGB")
                pair = reference_pair(pic) if col == 0 else locate_eyes(pic)
                if col and len(pair) < 2 and pic.size == camera_size:
                    pair = matched_camera_pair
                if len(pair) == 2:
                    boxes = np.array([entry["bounds"] for entry in pair])
                    left, top = boxes[:, :2].min(axis=0)
                    right, bottom = boxes[:, 2:].max(axis=0)
                    w = (right - left) * 1.51
                    h = w * tile[1] / tile[0]
                    x = (left + right - w) / 2
                    y0 = (top + bottom) / 2 - h * 0.55
                    img = pic.crop((x, y0, x + w, y0 + h)).resize(
                        tile, Image.Resampling.LANCZOS
                    )
                else:
                    img = ImageOps.pad(pic, tile, color=pic.getpixel((0, 0)))
                sheet.paste(img, (10 + col * (tile[0] + 8), y + 23))
    sheet.save(dest / "reference-eyes.jpg", quality=95)
