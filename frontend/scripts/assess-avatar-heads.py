"""Test the existing closed profile primitive on both fitted benchmark skulls."""

import argparse
import json
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

from avatar_authoring.rounded import fit_masks, shape_recipe, shell


ASSETS = Path(__file__).resolve().parents[1] / "features/procedural-avatars"
VIEWS = [(0, 0), (35, 0), (-35, 0), (65, 0), (90, 0), (135, 0), (35, 20), (-35, -20)]


def source_skulls():
    classic = json.loads((ASSETS / "rick-classic.json").read_text())
    skull = next(p for p in classic["lofts"] if p["name"] == "skull")
    rings = []
    for y, *pairs in skull["rows"]:
        xz = np.asarray(pairs).reshape(-1, 2)
        other = xz[-2:0:-1] * [-1, 1]
        x, z = np.vstack([xz, other]).T
        rings.append(np.stack([x + classic["mirror"], np.full(len(x), y), z], axis=1))
    sunshine = json.loads((ASSETS / "sunshine.json").read_text())
    skull = next(p for p in sunshine["parts"] if p.get("name") == "skull")
    x, y, z = skull["oval"]
    rx, ry, rz = skull["radii"]
    phi = np.linspace(0, np.pi, 101)
    oval = shell(np.stack([y - ry * np.cos(phi), x - rx * np.sin(phi),
                           x + rx * np.sin(phi), rz * np.sin(phi), np.full_like(phi, z)], axis=1), 96)
    return {"Rick": np.array(rings), "Sunshine": oval}


def extents(rings):
    return np.stack([rings[:, 0, 1], rings[:, :, 0].min(1), rings[:, :, 0].max(1),
                     rings[:, :, 2].min(1), rings[:, :, 2].max(1)], axis=1)


def transfer_depth(target, donor, stations):
    # Match the vertical extent and the actual front outline of the target.
    # In the one-view trial only the other character supplies sagittal depth.
    # All comparisons remove a single unknown forward translation.
    dst, src = extents(target), extents(donor)
    t = (1 - np.cos(np.linspace(0, np.pi, stations))) / 2
    y = dst[0, 0] + np.ptp(dst[:, 0]) * t
    left, right = [np.interp(y, dst[:, 0], dst[:, i]) for i in (1, 2)]
    sy = src[0, 0] + np.ptp(src[:, 0]) * t
    scale = (dst[:, 2].max() - dst[:, 1].min()) / (src[:, 2].max() - src[:, 1].min())
    z0 = (src[:, 3].min() + src[:, 4].max()) / 2
    center = (dst[:, 3].min() + dst[:, 4].max()) / 2
    back, front = [(np.interp(sy, src[:, 0], src[:, i]) - z0) * scale + center for i in (3, 4)]
    return np.stack([y, left, right, (front - back) / 2, (front + back) / 2], axis=1).round(4)


def project(points, angle, framing):
    center, scale = framing
    yaw, pitch = np.deg2rad(angle)
    x, y, z = np.moveaxis(points - center, -1, 0)
    xp = x * np.cos(yaw) + z * np.sin(yaw)
    yp = y * np.cos(pitch) + (z * np.cos(yaw) - x * np.sin(yaw)) * np.sin(pitch)
    return np.rint(240 + scale * np.stack([xp, yp], axis=-1)).astype(int)

def mask(rings, angle, framing):
    points = project(rings, angle, framing)
    image = Image.new("1", (480, 480))
    pen = ImageDraw.Draw(image)
    for a, b in zip(points[:-1], points[1:]):
        for i in range(len(a)):
            j = (i + 1) % len(a)
            pen.polygon([tuple(a[i]), tuple(a[j]), tuple(b[i])], fill=1)
            pen.polygon([tuple(a[j]), tuple(b[i]), tuple(b[j])], fill=1)
    for cap in [points[0], points[-1]]:
        pen.polygon([tuple(p) for p in cap], fill=1)
    return np.asarray(image)


def native_mask(mesh, angle, framing):
    points = project(np.asarray(mesh["vertices"]), angle, framing)
    faces = np.asarray(mesh["index"]).reshape(-1, 3)
    image = Image.new("1", (480, 480))
    pen = ImageDraw.Draw(image)
    for tri in points[faces]:
        pen.polygon([tuple(p) for p in tri], fill=1)
    return np.asarray(image)


def compare(out, stations=16, sides=24):
    out.mkdir(parents=True, exist_ok=True)
    heads = source_skulls()
    report = {}
    columns = [(35, 0), (90, 0), (35, 20)]
    sheet = Image.new("RGB", (850, 862), "#f6f3ee")
    draw = ImageDraw.Draw(sheet)
    title = ImageFont.truetype("DejaVuSans-Bold.ttf", 20)
    font = ImageFont.truetype("DejaVuSans.ttf", 14)
    draw.text((16, 12), "One closed skull primitive fitted to two benchmark heads", font=title, fill="#263936")
    for j, label in enumerate(["35° turn", "Profile", "35° turn, 20° pitch"]):
        draw.text((205 + 215*j, 49), label, font=font, fill="#253830")
    for i, (name, target) in enumerate(heads.items()):
        other = next(k for k in heads if k != name)
        bounds = (target.min(axis=(0, 1)), target.max(axis=(0, 1)))
        framing = ((bounds[0] + bounds[1])/2, 385 / (bounds[1] - bounds[0]).max())
        truth = {a: mask(target, a, framing) for a in VIEWS}
        for angle, label in [((0, 0), "front"), ((90, 0), "side"), ((35, 0), "oblique")]:
            Image.fromarray(truth[angle]).save(out / f"{name.lower()}-{label}-mask.png")
        for j, (paired, oblique) in enumerate([(False, False), (True, False), (True, True)]):
            if paired:
                recipe, curvature = fit_masks(
                    truth[(0, 0)], truth[(90, 0)], truth[(35, 0)] if oblique else None,
                    bounds[1][1] - bounds[0][1], framing[0], stations, sides,
                )
            else:
                recipe, curvature = transfer_depth(target, heads[other], stations), None
            rings = shell(recipe, sides, curvature)
            mode = "front-and-side" if paired else "front-only"
            label = "Front and side" if paired else "Front only"
            if oblique:
                mode, label = "front-side-oblique", "With 35° contour"
            native = shape_recipe(recipe, curvature, "#d49163" if name == "Rick" else "#f32685", sides)
            (out / f"{name.lower()}-{mode}.json").write_text(json.dumps(native, separators=(",", ":")) + "\n")
            case = f"{name}-{mode}"
            # Compile the native mesh before evaluating any held-out views.
            inputs = [{"id": case, "template": "rick-classic" if name == "Rick" else "sunshine", "recipe": native}]
            process = subprocess.run(["node", str(Path(__file__).parent/"avatar_authoring/compile-head-study.cjs")],
                                     input=json.dumps(inputs), text=True, capture_output=True)
            if process.returncode:
                raise RuntimeError(process.stderr)
            mesh = json.loads(process.stdout)[case]
            scores = {}
            dense_scores = {}
            row = 75 + 126*(i*3+j)
            draw.text((16, row + 25), name, font=title, fill="#253830")
            draw.text((16, row + 52), label, font=font, fill="#253830")
            for angle in VIEWS:
                ref = truth[angle]
                dense = mask(rings, angle, framing)
                dense_scores[f"{angle[0]},{angle[1]}"] = round(float((dense & ref).sum() / (dense | ref).sum()), 4)
                candidate = native_mask(mesh, angle, framing)
                iou = float((candidate & ref).sum() / (candidate | ref).sum())
                scores[f"{angle[0]},{angle[1]}"] = round(iou, 4)
                if angle in columns:
                    k = columns.index(angle)
                    overlay = np.full((*ref.shape, 3), [246,243,238], dtype=np.uint8)
                    overlay[candidate & ref] = [72,85,84]
                    overlay[candidate & ~ref] = [217,118,52]
                    overlay[~candidate & ref] = [38,157,157]
                    thumb = Image.fromarray(overlay).resize((116,116), Image.Resampling.LANCZOS)
                    sheet.paste(thumb, (192+215*k,row))
                    draw.text((306+215*k,row+53), f"{iou:.1%}", font=font, fill="#253830")
            fitted_views = {"0,0"}
            if paired:
                fitted_views.add("90,0")
            if oblique:
                fitted_views.update(["35,0", "-35,0"])
            report[case] = {
                "depth_source": name if paired else other,
                "overlap": scores,
                "triangles": len(mesh["index"]) // 3,
                "before_retopology": dense_scores,
                "worst_unfitted_angle": min(score for view, score in scores.items() if view not in fitted_views),
            }
    draw.text((16,835), "Grey overlap    Teal reference only    Orange primitive only    •    Bare skulls, before eyes and hair", font=font, fill="#394943")
    sheet.save(out / "head-bases.png")
    result = {"stations": stations, "sides": sides, "max_triangles_before_retopology": 2*sides*stations,
              "reference": "Fitted Rick skull loft and Sunshine skull oval", "cases": report}
    (out / "head-bases.json").write_text(json.dumps(result, indent=2) + "\n")
    return result


if __name__ == "__main__":
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("output", type=Path)
    print(json.dumps(compare(cli.parse_args().output), indent=2))
