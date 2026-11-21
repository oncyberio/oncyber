"""Review the streetwear head between the two orthographic fitting views."""

import json
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage


def landmark_error(mesh, marks, turn):
    """Use only the eyes to resolve image scale, translation and roll."""
    a = np.radians(turn)
    axis = np.array(marks["rightEye"]) - marks["leftEye"]
    down = np.array([-axis[1], axis[0]])

    def project(p):
        x, y, z = p
        return np.array([x * np.cos(a) + z * np.sin(a), y])

    origin = project(mesh["leftEye"])
    baseline = project(mesh["rightEye"]) - origin
    across = baseline / (baseline @ baseline)
    vertical = np.array([-across[1], across[0]])
    errors = {}
    for name in ("nose", "mouth", "chin"):
        p = project(mesh[name]) - origin
        predicted = marks["leftEye"] + axis * (p @ across) + down * (p @ vertical)
        errors[name] = round(float(np.linalg.norm(predicted - marks[name])), 2)
    return {
        "landmark_error_px": errors,
        "rms_px": round(float(np.sqrt(np.mean(np.square(list(errors.values()))))), 2),
    }


def compare_mesh(recipe, drawing, turn):
    probes = Path(__file__).with_name("street-face-probes.cjs")
    meshes = json.loads(subprocess.check_output(["node", probes, recipe], text=True))
    marks = json.loads(drawing.read_text())["face"]
    return {level: landmark_error(mesh, marks, turn) for level, mesh in meshes.items()}


def eye_pair(im):
    r, g, b = np.asarray(im.convert("RGB"), dtype=np.int16).transpose(2, 0, 1)
    mask = (b - r > 16) & (b - g > 3)
    mask[int(im.height * 0.73) :] = False
    labels, _ = ndimage.label(mask)
    areas = np.bincount(labels.ravel())[1:]
    ids = np.argsort(areas)[::-1][:2]
    if len(ids) < 2 or areas[ids[1]] < 9:
        raise ValueError("Both irises must be visible in the three-quarter portrait")
    centers = ndimage.center_of_mass(mask, labels, ids + 1)
    (y1, x1), (y2, x2) = centers
    if abs(x2 - x1) < 0.04 * im.height or abs(y2 - y1) > 0.025 * im.height:
        raise ValueError(
            "The two pigment regions do not form an eye pair at neutral roll"
        )
    return sorted(zip(centers, areas[ids], strict=True), key=lambda p: p[0][1])


def iris_coverage(folder):
    result = {}
    for angle, view in [(35, "portrait-quarter"), (-35, "portrait-other-quarter")]:
        with Image.open(folder / (view + ".png")) as im:
            left, right = eye_pair(im)
            near, far = (left, right) if angle > 0 else (right, left)
            result[str(angle)] = {"near_px": int(near[1]), "far_px": int(far[1])}
    return result


def oblique_sheet(before, after, output):
    # Fix each crop to the previous camera and its eye line. Use that same
    # crop for the new geometry and the unpainted surface.
    size = 330
    sheet = Image.new("RGB", (size * 3, 2 * (size + 32)), "#f6f3ef")
    pen = ImageDraw.Draw(sheet)
    font = ImageFont.truetype("DejaVuSans.ttf", 16)
    for i, (view, title) in enumerate(
        [
            ("portrait-quarter", "+35°"),
            ("portrait-other-quarter", "−35°"),
            ("portrait-quarter-clay", "+35° clay"),
        ]
    ):
        with Image.open(before / (view.replace("-clay", "") + ".png")) as paint:
            pairs = eye_pair(paint)
            y, x = np.mean([p[0] for p in pairs], axis=0)
            w, h = paint.size
            side = 0.56 * h
            left, top = x - side * (0.59 if i != 1 else 0.41), y - 0.43 * side
        for j, (folder, label) in enumerate([(before, "Previous"), (after, "Revised")]):
            with Image.open(folder / (view + ".png")) as im:
                if im.size != (w, h):
                    raise ValueError("The comparison needs matching portrait cameras")
                tile = im.transform(
                    (size, size),
                    Image.Transform.EXTENT,
                    (left, top, left + side, top + side),
                    Image.Resampling.BICUBIC,
                )
            row = j * (size + 32)
            pen.text(
                (i * size + 9, row + 6), f"{label} · {title}", font=font, fill="#302b2a"
            )
            sheet.paste(tile, (i * size, row + 32))
    sheet.save(output, quality=94, method=6)
