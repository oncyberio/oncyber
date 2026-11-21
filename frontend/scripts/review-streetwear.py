"""Compare a registered T-pose and profile with both native renderers.

The source sheet faces left in profile. The native +90-degree camera faces right.
Align floor, height and horizontal center separately in each view, preserving aspect.
"""

import argparse
import json
from pathlib import Path
from shutil import copyfile

import numpy as np
from avatar_authoring.contours import contour_review, contour_sheet
from avatar_authoring.fit import pixels
from avatar_authoring.release import (
    digest,
    evidence,
    export_review_views,
    verified_captures,
)
from avatar_authoring.street_oblique import compare_mesh, iris_coverage, oblique_sheet
from PIL import Image, ImageDraw, ImageFont, ImageOps
from scipy import ndimage


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


def body_and_clothes(folder, output):
    paper = "#f6f3ef"
    canvas = Image.new("RGB", (1320, 1014), paper)
    draw = ImageDraw.Draw(canvas)
    font = ImageFont.truetype("DejaVuSans.ttf", 23)
    for col, title in enumerate(("Base body", "Jeans and shoes", "Full outfit")):
        draw.text((col * 440 + 15, 12), title, font=font, fill="#332f2e")
    for row, (name, title) in enumerate(
        (("front", "T-pose"), ("crouch", "Crouch · right-hand grip"))
    ):
        images = [
            Image.open(folder / (name + suffix + ".png")).convert("RGB")
            for suffix in ("-body", "-bottoms", "")
        ]
        masks = [
            np.abs(np.asarray(im).astype(np.int16) - im.getpixel((0, 0))).max(axis=2)
            > 17
            for im in images
        ]
        y, x = np.nonzero(np.logical_or.reduce(masks))
        box = (x.min() - 12, y.min() - 12, x.max() + 13, y.max() + 13)
        top = 45 + row * 483
        draw.text((14, top), title, font=font, fill="#585350")
        for col, im in enumerate(images):
            tile = im.crop(box)
            tile.thumbnail((433, 438), Image.Resampling.LANCZOS)
            canvas.paste(
                tile,
                (
                    440 * col + (440 - tile.width) // 2,
                    top + 34 + (438 - tile.height) // 2,
                ),
            )
    canvas.save(output, quality=91, method=6)


def face_gallery(folder, targets, output=None, clay_output=None):
    # Anchor matching crops at the iris centers. Use the orthographic cameras
    # to keep a millimetre on the face the same size in both drawings and renders.
    cameras = json.loads((folder / "camera.json").read_text())
    body, portrait = cameras["body"], cameras["portrait"]
    matte = np.asarray(Image.open(folder / "mask.png").convert("L")) > 127
    px_per_unit = (
        (np.ptp(np.nonzero(matte)[0]) + 1)
        / 1000
        * (body["height"] / body["pixels"])
        / (portrait["height"] / portrait["pixels"])
    )
    panels = [
        ("Drawing · front", targets["front"][0], 1, "front"),
        ("Native · front", "portrait", px_per_unit, "front"),
        ("Native · 35°", "portrait-quarter", px_per_unit, "quarter"),
        ("Native · profile", "portrait-profile", px_per_unit, "profile"),
        ("Drawing · profile", targets["profile"][0], 1, "profile"),
    ]
    canvas = Image.new("RGB", (1200, 278), "#f6f3ef")
    draw = ImageDraw.Draw(canvas)
    font = ImageFont.truetype("DejaVuSans.ttf", 18)
    tiles = []
    for i, (title, subject, scale, angle) in enumerate(panels):
        native = isinstance(subject, str)
        image = (
            Image.open(folder / (subject + ".png")).convert("RGB")
            if native
            else subject
        )
        rgb = np.asarray(image).astype(np.int16)
        r, g, b = rgb.transpose(2, 0, 1)
        yy = np.indices(r.shape)[0]
        irises = (
            (b - r > 16)
            & (b - g > 3)
            & (yy < image.height * (0.73 if native else 0.17))
        )
        labels, n = ndimage.label(irises)
        area = np.bincount(labels.ravel())[1:]
        blobs = np.argsort(area)[::-1]
        if not n or not area[blobs[0]]:
            raise ValueError(f"No iris pigment in {title}")
        # Ignore isolated blue antialiasing pixels on the ink and paper.
        keep = [blobs[0] + 1]
        if angle != "profile" and n > 1 and area[blobs[1]] > area[blobs[0]] * 0.3:
            keep.append(blobs[1] + 1)
        y, x = np.nonzero(np.isin(labels, keep))
        if len(x) < 3:
            raise ValueError(f"Cannot register the eyes in {title}")
        cx = (np.percentile(x, 5) + np.percentile(x, 95)) / 2
        cy = np.median(y)
        width = 144 * scale
        left = cx - width * {"front": 0.5, "quarter": 0.56, "profile": 0.66}[angle]
        top = cy - width * 0.47
        tile = image.transform(
            (240, 240),
            Image.Transform.EXTENT,
            (left, top, left + width, top + width),
            Image.Resampling.BICUBIC,
        )
        if (
            clay_output
            and angle == "quarter"
            and (folder / "portrait-quarter-clay.png").is_file()
        ):
            with Image.open(folder / "portrait-quarter-clay.png") as clay:
                if clay.size != image.size:
                    raise ValueError("Paint and clay require the same camera")
                clay.transform(
                    (240, 240),
                    Image.Transform.EXTENT,
                    (left, top, left + width, top + width),
                    Image.Resampling.BICUBIC,
                ).save(clay_output)
        tiles.append(np.asarray(tile).astype(float))
        canvas.paste(tile, (i * 240, 38))
        draw.text((i * 240 + 8, 8), title, font=font, fill="#332f2e")
    if output is not None:
        canvas.save(output, quality=94, method=6)
    result = {}
    # Compare both eyes in the front camera and the visible eye in profile at
    # a fixed physical scale. The source mouth accessory lies outside these windows.
    for angle, source, render, roi in [
        ("front", tiles[0], tiles[1], (49, 91, 191, 128)),
        ("profile", tiles[4], tiles[3], (124, 92, 188, 130)),
    ]:
        left, top, right, bottom = roi
        source, render = (im[top:bottom, left:right] for im in (source, render))

        def masks(im):
            r, g, b = im.transpose(2, 0, 1)
            return im.mean(2) < 105, (b - r > 12) & (b - g > 2)

        ink, iris = masks(source)
        other_ink, other_iris = masks(render)

        def agreement(a, b):
            if not a.any() or not b.any():
                return 0
            recall = (ndimage.distance_transform_edt(~b)[a] <= 2).mean()
            precision = (ndimage.distance_transform_edt(~a)[b] <= 2).mean()
            return (
                float(2 * precision * recall / (precision + recall))
                if precision + recall
                else 0
            )

        result[angle] = {
            "eye_rgb_mae": round(float(abs(source - render).mean()), 2),
            "eye_ink_f1_2px": round(agreement(ink, other_ink), 4),
            "iris_iou": round(
                float((iris & other_iris).sum() / max(1, (iris | other_iris).sum())), 4
            ),
        }
    return result


def portrait_revision(previous, current, clay, output):
    """Compare the construction and both renders at the same eye-registered scale."""
    with Image.open(previous) as before, Image.open(current) as after:
        if before.size != after.size or after.size != (1200, 278):
            raise ValueError("Expected two front, quarter and profile galleries")
        sheet = Image.new("RGB", (756, 856), "#f6f3ef")
        pen = ImageDraw.Draw(sheet)
        font = ImageFont.truetype("DejaVuSans.ttf", 16)

        def panel(image, index):
            return image.crop((240 * index, 38, 240 * (index + 1), 278))

        for row, (name, ref, index) in enumerate(
            [("Front", 0, 1), ("35°", None, 2), ("Profile", 4, 3)]
        ):
            construction = (
                panel(after, ref)
                if ref is not None
                else Image.open(clay).convert("RGB")
                if clay and clay.is_file()
                else None
            )
            for col, (title, tile) in enumerate(
                [
                    (
                        "Turnaround drawing"
                        if ref is not None
                        else "Clay construction",
                        construction,
                    ),
                    ("Previous avatar", panel(before, index)),
                    ("Revised avatar", panel(after, index)),
                ]
            ):
                if tile is None:
                    continue
                pen.text(
                    (8 + 252 * col, 12 + row * 284),
                    f"{name} · {title}",
                    font=font,
                    fill="#302b2a",
                )
                sheet.paste(tile, (8 + 252 * col, 38 + row * 284))
        sheet.save(output, quality=94, method=6)


def capture_drawing_pose(recipe, base, pose, output):
    from io import BytesIO
    from runpy import run_path

    from avatar_authoring.review import native_page
    from playwright.sync_api import sync_playwright

    turn, tilt = pose["turn"], pose["tilt"]
    set_angle = run_path(
        str(Path(__file__).with_name("capture-procedural-avatars.py"))
    )["set_angle"]
    with sync_playwright() as pw:
        browser, page = native_page(pw, base, "webgl")
        page.get_by_label("Open cartoon recipe").set_input_files(recipe)
        stage = page.locator(".stage canvas")
        page.wait_for_function(
            "document.querySelector('.stage canvas')?.dataset.layer==='dressed'"
        )
        page.get_by_role("button", name="Portrait", exact=True).click()
        set_angle(page.get_by_label("Rotation", exact=True), turn)
        set_angle(page.get_by_label("Head tilt", exact=True), tilt)
        page.wait_for_function(
            "([a,r])=>{const d=document.querySelector('.stage canvas').dataset;return d.framing.endsWith('/'+a+'/portrait') && d.headTilt===String(r)}",
            arg=[turn, tilt],
        )
        panels = []
        for finish in ("paint", "clay"):
            if finish == "clay":
                page.get_by_role("button", name="Clay study", exact=True).click()
                page.wait_for_function(
                    "document.querySelector('.stage canvas').dataset.finish==='clay'"
                )
            with Image.open(BytesIO(stage.screenshot())) as im:
                w, h = im.size
                side = min(w, h)
                panels.append(
                    im.crop(
                        (
                            (w - side) // 2,
                            (h - side) // 2,
                            (w + side) // 2,
                            (h + side) // 2,
                        )
                    ).resize((460, 460), Image.Resampling.LANCZOS)
                )
        browser.close()
    sheet = Image.new("RGB", (920, 498), "#f6f3ef")
    pen = ImageDraw.Draw(sheet)
    font = ImageFont.truetype("DejaVuSans.ttf", 17)
    for i, (title, img) in enumerate(
        zip(["Painted avatar", "Clay construction"], panels, strict=True)
    ):
        sheet.paste(img, (460 * i, 38))
        pen.text(
            (12 + 460 * i, 9),
            f"{title} · {turn}° turn, {tilt}° tilt",
            font=font,
            fill="#302b2a",
        )
    sheet.save(output, quality=94, method=6)


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
        # Looking along the arm can reveal skin inside a real opening. A larger
        # exposed island in a closed panel is a fit regression at this camera.
        control = native["clothing_fit_control"]["pixels"]
        for view, fit in native["clothing_fit"].items():
            tolerance = 0.006 if view in ("profile", "quarter") else 0.0015
            if fit["largest_patch"] > control * tolerance:
                raise ValueError(
                    f"{backend} {view}: inspect the {fit['largest_patch']}-pixel skin patch in the fit pass"
                )
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
        result["backends"][backend] = {
            "silhouette_iou": metrics,
            "light_contours": contour_review(args.captures / backend),
            **native,
        }
        if args.previous_captures:
            result["backends"][backend]["previous_light_contours"] = contour_review(
                args.previous_captures / backend
            )
    comparison = args.destination / (args.slug + "-comparison.webp")
    canvas.thumbnail((2048, 1100), Image.Resampling.LANCZOS)
    canvas.save(comparison, quality=92, method=6)
    result["comparison_sha256"] = digest(comparison)
    clay = (
        args.captures / "quarter-clay.png"
        if args.previous_face
        and (args.captures / "WebGLBackend/portrait-quarter-clay.png").is_file()
        else None
    )
    assets = {}
    for name, make in [
        (
            "body-and-clothes",
            lambda path: body_and_clothes(args.captures / "WebGLBackend", path),
        ),
        (
            "face",
            lambda path: face_gallery(
                args.captures / "WebGLBackend",
                targets,
                path,
                clay,
            ),
        ),
    ]:
        path = args.destination / (args.slug + "-" + name + ".webp")
        make(path)
        assets[name] = digest(path)
    if args.previous_captures:
        path = args.destination / (args.slug + "-outlines.webp")
        contour_sheet(
            args.previous_captures / "WebGLBackend",
            args.captures / "WebGLBackend",
            path,
        )
        assets["outlines"] = digest(path)
        turns = args.destination / (args.slug + "-oblique.webp")
        oblique_sheet(
            args.previous_captures / "WebGLBackend",
            args.captures / "WebGLBackend",
            turns,
        )
        assets["oblique"] = digest(turns)
    if args.previous_face:
        revision = args.destination / (args.slug + "-portrait-revision.webp")
        portrait_revision(
            args.previous_face,
            args.destination / (args.slug + "-face.webp"),
            clay,
            revision,
        )
        result["portrait_revision"] = {
            "previous_face_sha256": digest(args.previous_face),
            "sha256": digest(revision),
        }
    for backend in result["backends"]:
        result["backends"][backend]["three_quarter_iris"] = iris_coverage(
            args.captures / backend
        )
        result["backends"][backend]["facial_landmarks"] = face_gallery(
            args.captures / backend, targets
        )
    if args.drawing_pose:
        pose = json.loads(args.drawing_pose.read_text())
        path = args.destination / (args.slug + "-illustration-pose.webp")
        shot = (
            args.captures
            / f"drawing-pose-{digest(args.recipe)[:12]}-{digest(args.drawing_pose)[:12]}.webp"
        )
        if not args.use_captures:
            capture_drawing_pose(args.recipe, args.base, pose, shot)
        if not shot.is_file():
            raise ValueError(
                "This capture set has no portrait for the specified recipe and drawing pose"
            )
        copyfile(shot, path)
        result["drawing_pose"] = {**pose, "sha256": digest(path)}
        if args.illustration:
            # Cache with the captures: a future mesh-builder revision may
            # produce different geometry from these same recipe bytes.
            sample = (
                args.captures
                / f"{shot.stem}-{digest(args.illustration)[:12]}-mesh.json"
            )
            if not args.use_captures:
                errors = compare_mesh(args.recipe, args.illustration, pose["turn"])
                sample.write_text(json.dumps(errors, indent=2) + "\n")
            if not sample.is_file():
                raise ValueError(
                    "This capture set has no mesh measurements for the marked drawing and pose"
                )
            result["eye_registered_mesh"] = json.loads(sample.read_text())
    result["studies"] = assets
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
    parser.add_argument(
        "--previous-captures",
        type=Path,
        help="Registered earlier turns for light-contour comparison",
    )
    parser.add_argument(
        "--previous-face",
        type=Path,
        help="Earlier face gallery for a before-and-after comparison",
    )
    parser.add_argument(
        "--drawing-pose",
        type=Path,
        help="Pose output from fitting a marked three-quarter illustration",
    )
    parser.add_argument(
        "--illustration",
        type=Path,
        help="Original face marks for eye-registered mesh comparison at the fitted turn",
    )
    parser.add_argument("--base", default="http://localhost:13000")
    parser.add_argument("--budget", default=5500, type=int)
    parser.add_argument(
        "--use-captures",
        action="store_true",
        help="Rebuild the comparison from the same verified captures",
    )
    args = parser.parse_args()
    if args.illustration and not args.drawing_pose:
        parser.error("--illustration requires --drawing-pose")
    print(json.dumps(review(args), indent=2))
