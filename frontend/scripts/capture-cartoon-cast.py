"""Render the recipe-driven cartoon cast through the native Oncyber loader."""

import argparse
import itertools
import json
import os
import shutil
from io import BytesIO
from pathlib import Path
from runpy import run_path

import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageOps, ImageSequence
from playwright.sync_api import sync_playwright

set_angle = run_path(str(Path(__file__).with_name("capture-procedural-avatars.py")))[
    "set_angle"
]


def figure_bounds(im):
    rgb = np.array(im.convert("RGB"), np.int16)
    ys, xs = np.where(np.abs(rgb - rgb[0, 0]).max(axis=2) > 24)
    if not len(xs):
        raise AssertionError("Empty rendered avatar")
    return (
        max(0, xs.min() - 3),
        max(0, ys.min() - 3),
        min(im.width, xs.max() + 4),
        min(im.height, ys.max() + 4),
    )


def portrait_coverage(dest, models):
    """Measure eye and scalp coverage at the inspector's portrait framing."""
    from scipy.ndimage import binary_closing, label

    def picture(slug):
        return np.asarray(
            Image.open(dest / f"{slug}-portrait-profile.png").convert("RGB"),
            dtype=float,
        )

    result = {}
    for slug, model in models.items():
        if "band_color" not in model:
            continue
        color = np.frombuffer(
            bytes.fromhex(model["band_color"][1:]), dtype=np.uint8
        ).astype(float)
        hue = color - color.mean()
        if np.linalg.norm(hue) < 24:
            continue
        for angle in ("", "-quarter", "-profile", "-other-quarter", "-other-profile"):
            path = dest / f"{slug}-portrait{angle}.png"
            if not path.exists():
                continue
            image = np.array(Image.open(path).convert("RGB"), dtype=float)
            crown = image[: round(len(image) * 0.48)]
            chroma = crown - crown.mean(2, keepdims=True)
            strength = (chroma @ hue) / (hue @ hue)
            pigment = (
                (strength > 0.31)
                & (strength < 1.8)
                & (np.linalg.norm(chroma - strength[:, :, None] * hue, axis=2) < 13)
                & (np.max(abs(crown - image[0, 0]), axis=2) > 16)
            )
            pieces, _ = label(
                binary_closing(pigment, structure=np.ones((3, 3))), np.ones((3, 3))
            )
            sizes = np.bincount(pieces.ravel(), minlength=2)[1:]
            result[f"{slug}{angle}_broken_headband_fraction"] = round(
                1 - float(sizes.max()) / max(1, sizes.sum()), 4
            )
    if "morty-smith" in models:
        morty = picture("morty-smith")
        height = morty.shape[0]
        foreground = np.abs(morty - morty[0, 0]).max(axis=2) > 15
        whites = (
            (morty > [203, 199, 183]).all(axis=2)
            & (np.ptp(morty, axis=2) < 41)
            & foreground
        )
        whites[: int(height * 0.17)] = False
        whites[int(height * 0.70) :] = False
        parts, n = label(whites)
        if not n:
            raise AssertionError("Morty's eye is missing from the profile")
        areas = np.bincount(parts.ravel())
        areas[0] = 0
        yy, xx = np.where(parts == np.argmax(areas))
        w, h = np.ptp(xx), np.ptp(yy)
        if w < 5 or h < 5:
            raise AssertionError("Morty's eye is too small to inspect")
        temple = morty[
            int(yy.min() + 0.3 * h) : int(yy.min() + 0.7 * h),
            max(0, int(xx.min() - 0.88 * w)) : int(xx.min() + 0.18 * w),
        ]
        dark_eye = float(
            ((temple.max(axis=2) < 108) & (np.ptp(temple, axis=2) < 40)).mean()
        )
        result["morty_dark_sidewall_fraction"] = round(dark_eye, 4)
    if "summer-smith" in models:
        summer = picture("summer-smith")
        height = summer.shape[0]
        visible = np.abs(summer - summer[0, 0]).max(axis=2) > 15
        _, xx = np.where(visible[: int(height * 0.65)])
        width = np.ptp(xx)
        temple = summer[
            int(height * 0.42) : int(height * 0.54),
            int(xx.min() + 0.3 * width) : int(xx.min() + 0.56 * width),
        ]
        skin = (
            (temple[:, :, 0] > 157)
            & ((temple[:, :, 0] - temple[:, :, 2]) < 100)
            & ((temple[:, :, 0] - temple[:, :, 1]) > 12)
        )
        result["summer_exposed_temple_fraction"] = round(float(skin.mean()), 4)
    if "oren-pike" in models:
        oren = picture("oren-pike")
        extent = int(oren.shape[0] * 0.65)
        visible = np.abs(oren - oren[0, 0]).max(axis=2) > 20
        yy, xx = np.where(visible[:extent])
        box = oren[
            int(yy.min() + 0.20 * (extent - yy.min())) : int(
                yy.min() + 0.53 * (extent - yy.min())
            ),
            int(xx.min() + 0.15 * np.ptp(xx)) : int(xx.min() + 0.49 * np.ptp(xx)),
        ]
        warmth = box[:, :, 0] - box[:, :, 1]
        scalp = (box[:, :, 0] > 161) & (box[:, :, 1] > 113) & (warmth > 17) & (warmth < 65)
        result["oren_exposed_scalp_fraction"] = round(float(scalp.mean()), 4)
    return result


def foreground(im):
    return im.crop(figure_bounds(im))


def sheet(dest, models):
    width = 238
    height = 432
    columns = min(5, len(models))
    rows = (len(models) + columns - 1) // columns
    page = Image.new("RGB", (width * columns + 36, rows * height + 78), "#f9f6ed")
    draw = ImageDraw.Draw(page)
    font = lambda size: ImageFont.truetype("DejaVuSans.ttf", size)
    draw.text((18, 10), "Rick and Morty style study", font=font(26), fill="#312d2a")
    for i, (key, props) in enumerate(models.items()):
        x = 18 + i % columns * width
        y = 55 + i // columns * height
        thumb = Image.open(dest / f"{key}-portrait.png").convert("RGB")
        thumb = thumb.resize((143, 143), Image.Resampling.LANCZOS)
        bg = thumb.getpixel((0, 0))
        tile = Image.new("RGB", (width - 5, height - 65), bg)
        tile.paste(thumb, ((tile.width - thumb.width) // 2, 2))
        body = foreground(
            Image.open(
                dest / f"{key}-idle.png"
                if (dest / f"{key}-idle.png").exists()
                else dest / f"{key}-front.png"
            ).convert("RGB")
        )
        body.thumbnail((tile.width - 12, height - 226), Image.Resampling.LANCZOS)
        tile.paste(
            body, ((tile.width - body.width) // 2, tile.height - body.height - 5)
        )
        page.paste(tile, (x, y))
        draw.text(
            (x + tile.width / 2, y + height - 51),
            props["name"],
            font=font(17),
            fill="#302a26",
            anchor="mt",
        )
        draw.text(
            (x + tile.width / 2, y + height - 27),
            f"{props['triangles']:,} triangles",
            font=font(13),
            fill="#60584f",
            anchor="mt",
        )
    page.save(dest / "cartoon-cast.png", optimize=True)


def walk_sheet(dest, models):
    """Keep the same crop across each walk cycle so foot and hand motion is visible."""
    width, height = 195, 268
    font = ImageFont.truetype("DejaVuSans.ttf", 15)
    pages = []
    columns = min(5, len(models))
    rows = (len(models) + columns - 1) // columns
    for i, (key, props) in enumerate(models.items()):
        with Image.open(dest / f"{key}-walk.webp") as clip:
            frames = []
            for frame in ImageSequence.Iterator(clip):
                # WebP coalesces adjacent identical frames and retains their duration.
                sample = frame.convert("RGB")
                frames.extend(
                    [sample] * max(1, round(frame.info.get("duration", 90) / 90))
                )
        if not pages:
            pages = [
                Image.new("RGB", (columns * width, rows * height), "#f6f2e7") for _ in frames
            ]
        bounds = [figure_bounds(frame) for frame in frames]
        box = (
            min(b[0] for b in bounds),
            min(b[1] for b in bounds),
            max(b[2] for b in bounds),
            max(b[3] for b in bounds),
        )
        x, y = i % columns * width, i // columns * height
        for page, frame in zip(pages, frames, strict=True):
            figure = frame.crop(box)
            figure.thumbnail((width - 14, height - 31), Image.Resampling.LANCZOS)
            tile = Image.new("RGB", (width - 2, height - 2), frame.getpixel((0, 0)))
            tile.paste(
                figure, ((tile.width - figure.width) // 2, height - 27 - figure.height)
            )
            ImageDraw.Draw(tile).text(
                (tile.width / 2, height - 19),
                props["name"],
                font=font,
                fill="#352f2b",
                anchor="mt",
            )
            page.paste(tile, (x, y))
    pages[0].save(
        dest / "cartoon-walk.webp",
        save_all=True,
        append_images=pages[1:],
        duration=90,
        loop=0,
        quality=91,
    )


def reference_sheet(dest, references, report):
    size, row_height = 240, 290
    page = Image.new("RGB", (size * 2 + 30, row_height * len(references)), "#f9f6ed")
    draw = ImageDraw.Draw(page)
    font = ImageFont.truetype("DejaVuSans.ttf", 15)
    for i, (key, (angle, source)) in enumerate(references.items()):
        y = i * row_height
        draw.text((10, y + 4), report[key]["name"], font=font, fill="#302a26")
        for j, (path, label) in enumerate(
            [(source, "Drawing"), (dest / f"{key}-match.png", f"Procedural · {angle}°")]
        ):
            with Image.open(path) as im:
                tile = ImageOps.contain(
                    im.convert("RGB"), (size, size), Image.Resampling.LANCZOS
                )
            x = 10 + j * (size + 10)
            page.paste(
                tile, (x + (size - tile.width) // 2, y + 25 + (size - tile.height) // 2)
            )
            draw.text((x, y + size + 28), label, font=font, fill="#554e46")
    page.save(dest / "cartoon-references.png", optimize=True)


def compare_portraits(dest, previous, references, report):
    """Show the source and exactly the same profile camera before and after an edit."""
    size, gap, margin, title = 244, 8, 18, 42
    columns = 4 if references else 3
    members = references or report
    sheet = Image.new(
        "RGB",
        (
            2 * margin + columns * size + (columns - 1) * gap,
            margin + len(members) * (size + title) + 30,
        ),
        "#faf7ef",
    )
    draw = ImageDraw.Draw(sheet)
    text = ImageFont.truetype("DejaVuSans.ttf", 15)
    heading = ImageFont.truetype("DejaVuSans-Bold.ttf", 17)
    for i, key in enumerate(members):
        props = report[key]
        y = margin + i * (size + title)
        draw.text((margin, y), props["name"], font=heading, fill="#322d29")
        draw.text(
            (sheet.width - margin, y + 1),
            f"{props['triangles']:,} triangles",
            font=text,
            fill="#544f46",
            anchor="rt",
        )
        if references:
            angle, source = references[key]
            panels = [
                ("Reference drawing", source),
                (f"Revised · {angle}°", dest / f"{key}-match.png"),
            ]
        else:
            panels = [("Revised · 35°", dest / f"{key}-portrait-quarter.png")]
        panels += [
            ("Earlier · profile", previous / f"{key}-portrait-profile.png"),
            ("Revised · profile", dest / f"{key}-portrait-profile.png"),
        ]
        for col, (label, path) in enumerate(panels):
            x = margin + col * (size + gap)
            draw.text((x, y + 22), label, font=text, fill="#655d53")
            with Image.open(path) as im:
                pic = ImageOps.contain(
                    im.convert("RGB"), (size, size), Image.Resampling.LANCZOS
                )
            sheet.paste(pic, (x + (size - pic.width) // 2, y + title))
    sheet.save(dest / "portrait-comparison.png", optimize=True)


def sync_picker(dest, report):
    """Install verified portraits and add new cast entries to the native picker."""
    frontend = Path(__file__).resolve().parents[1]
    catalog_path = frontend / "components/_3DExhibit-v2/three/factory/player/vrms.json"
    catalog = json.loads(catalog_path.read_text())
    for key, model in report.items():
        slug = key if key == "rick-classic" else f"cast-{key}"
        entry = "procedural-" + slug
        if entry not in catalog:
            catalog[entry] = {
                "id": entry,
                "name": model["name"],
                "url": f"/models/procedural/{slug}",
                "image": f"/lobby/procedural/{slug}.png",
                "description": "Procedural cartoon humanoid.",
            }
        path = frontend / "public/lobby/procedural" / f"{slug}.png"
        path.parent.mkdir(parents=True, exist_ok=True)
        with Image.open(dest / f"{key}-portrait.png") as image:
            image.convert("RGB").resize((256, 256), Image.Resampling.LANCZOS).save(
                path, optimize=True
            )
    original = catalog_path.read_text()
    if json.loads(original) != catalog:
        catalog_path.write_text(
            json.dumps(catalog, indent=4, ensure_ascii=False) + "\n"
        )


def capture(args):
    dest = args.output
    dest.mkdir(parents=True, exist_ok=True)
    flags = ["--enable-unsafe-swiftshader"]
    env = dict(os.environ)
    if (
        args.renderer == "auto"
        and Path("/usr/lib/chromium/vk_swiftshader_icd.json").exists()
    ):
        env.setdefault("VK_ICD_FILENAMES", "/usr/lib/chromium/vk_swiftshader_icd.json")
        flags += [
            "--enable-unsafe-webgpu",
            "--use-webgpu-adapter=swiftshader",
            "--enable-features=Vulkan",
            "--use-angle=swiftshader",
        ]
    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path=shutil.which("chromium"), args=flags, env=env
        )
        page = browser.new_page(
            viewport={"width": 1050, "height": 850},
            user_agent="Oncyber local avatar review",
        )
        page.on("pageerror", lambda error: print("Browser error", error, flush=True))
        page.goto(
            f"{args.base.rstrip('/')}/dev/cartoon-cast?renderer={args.renderer}",
            wait_until="domcontentloaded",
            timeout=180000,
        )
        status = page.locator("small").filter(has_text="skinned mesh")
        status.wait_for(timeout=120000)
        stage = page.locator(".stage canvas")
        subject = page.get_by_label("Subject", exact=True)
        motion = page.get_by_label("Motion", exact=True)
        members = subject.locator("option").evaluate_all(
            "options=>options.map(o=>[o.value,o.textContent])"
        )
        if args.character:
            unknown = set(args.character) - dict(members).keys()
            if unknown:
                raise ValueError(f"Unknown cast IDs: {sorted(unknown)}")
            members = [(key, name) for key, name in members if key in args.character]
        references = {
            key: (int(angle), Path(source)) for key, angle, source in args.reference
        }
        for key, (angle, source) in references.items():
            if (
                key not in dict(members)
                or not source.is_file()
                or not -180 <= angle <= 180
            ):
                raise ValueError(
                    f"Reference requires a cast ID, rotation in [-180,180] and local image: {key} {angle} {source}"
                )
        report = {}
        for key, name in members:
            subject.select_option(key)

            def framing(angle, frame, subject_id=key):
                page.wait_for_function(
                    "key=>document.querySelector('.stage canvas')?.dataset.framing===key",
                    arg=f"{subject_id}/{angle}/{frame}",
                )

            def rotate(angle, frame):
                set_angle(page.get_by_label("Rotation", exact=False), angle)
                framing(angle, frame)

            framing(0, "body")
            report[key] = {
                "name": name,
                "triangles": int(
                    status.inner_text().split(" triangles")[0].replace(",", "")
                ),
            }
            source_recipe = (
                Path(__file__).resolve().parents[1]
                / "public/lobby/procedural/recipes"
                / (key + ".json")
            )
            if source_recipe.is_file():
                household = json.loads(source_recipe.read_text()).get("design", {}).get("household", {})
                if household.get("eyePatch"):
                    report[key]["eye_patch"] = household["eyePatch"]
                elif any(eye.get("observedGaze") for eye in household.get("orbits", [])):
                    report[key]["profile_pupils"] = True
                if household.get("headband"):
                    report[key]["band_color"] = household["headband"]["color"]
            print(key, report[key], flush=True)
            for angle, title in [
                (0, "front"),
                (35, "quarter"),
                (90, "profile"),
                (180, "back"),
            ]:
                rotate(angle, "body")
                stage.screenshot(path=dest / f"{key}-{title}.png")
            rotate(0, "body")
            page.get_by_role("button", name="Portrait", exact=True).click()
            framing(0, "portrait")
            box = stage.bounding_box()
            size = min(box["width"], box["height"])
            crop = {
                "x": box["x"] + (box["width"] - size) / 2,
                "y": box["y"],
                "width": size,
                "height": size,
            }
            page.screenshot(path=dest / f"{key}-portrait.png", clip=crop)
            if args.portrait_turns or args.compare_with:
                for degrees, suffix in [(35, "quarter"), (-35, "other-quarter"), (90, "profile"), (-90, "other-profile"), (180, "back")]:
                    rotate(degrees, "portrait")
                    page.screenshot(
                        path=dest / f"{key}-portrait-{suffix}.png", clip=crop
                    )
                rotate(0, "portrait")
            if key in references:
                rotate(references[key][0], "portrait")
                page.screenshot(path=dest / f"{key}-match.png", clip=crop)
                rotate(0, "portrait")
            page.get_by_role("button", name="Full body", exact=True).click()
            framing(0, "body")
            if args.motion:
                rotate(12, "body")
                motion.select_option("IDLE")
                page.wait_for_timeout(500)
                stage.screenshot(path=dest / f"{key}-idle.png")
                rotate(22, "body")
                motion.select_option("WALK")
                page.wait_for_timeout(400)
                page.get_by_role("button", name="Pause", exact=True).click()
                step_button = page.get_by_role(
                    "button", name="Advance 90 ms", exact=True
                )
                step = int(stage.get_attribute("data-motion-step"))
                frames = []
                for _ in range(12):
                    step_button.click()
                    step += 1
                    page.wait_for_function(
                        "n=>document.querySelector('.stage canvas').dataset.motionStep===String(n)",
                        arg=step,
                    )
                    frame = Image.open(BytesIO(stage.screenshot())).convert("RGB")
                    frame.thumbnail((660, 400), Image.Resampling.LANCZOS)
                    frames.append(frame)
                samples = [np.asarray(frame, np.int16) for frame in frames]
                moving = sum(
                    (abs(a - b).max(axis=2) > 15).sum() >= 90
                    for a, b in itertools.pairwise(samples)
                )
                if moving < 9:
                    raise AssertionError(
                        f"{name} moved on only {moving} of 11 walk steps"
                    )
                frames[0].save(
                    dest / f"{key}-walk.webp",
                    save_all=True,
                    append_images=frames[1:],
                    duration=90,
                    loop=0,
                )
                page.get_by_role("button", name="Play", exact=True).click()
                motion.select_option("Reference")
                rotate(0, "body")
        (dest / "cast-metrics.json").write_text(
            json.dumps(
                {"backend": stage.get_attribute("data-backend"), "models": report},
                indent=2,
            )
        )
        sheet(dest, report)
        if args.portrait_turns or args.compare_with:
            from avatar_authoring.eye_review import review_eyes

            review_eyes(dest, report, args.compare_with)
            coverage = portrait_coverage(dest, report)
            (dest / "profile-coverage.json").write_text(json.dumps(coverage, indent=2))
            if any(fraction > 0.12 for fraction in coverage.values()):
                raise AssertionError(f"Profile coverage regression: {coverage}")
        if args.compare_with:
            compare_portraits(dest, args.compare_with, references, report)
        if references:
            from avatar_authoring.eye_review import reference_eye_sheet

            reference_sheet(dest, references, report)
            reference_eye_sheet(dest, report, references, args.compare_with)
        if args.motion:
            walk_sheet(dest, report)
        if args.crowd:
            page.goto(
                f"{args.base.rstrip('/')}/dev/procedural-crowd?cast=cartoon&count=100&renderer={args.renderer}",
                wait_until="domcontentloaded",
                timeout=120000,
            )
            page.wait_for_function(
                "()=>document.querySelector('canvas')?.dataset.visible==='100'",
                timeout=150000,
            )
            el = page.locator("canvas")
            counts = el.evaluate("el=>({...el.dataset})")
            if counts.get("calls") != "1":
                raise AssertionError(f"Crowd used {counts.get('calls')} avatar draws")
            el.screenshot(path=dest / "cartoon-crowd.png")
            (dest / "crowd-metrics.json").write_text(json.dumps(counts, indent=2))
        browser.close()
    if args.sync_picker:
        sync_picker(dest, report)


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("output", type=Path)
    ap.add_argument("--base", default="http://localhost:13000")
    ap.add_argument("--renderer", choices=["auto", "webgl"], default="auto")
    ap.add_argument("--motion", action="store_true")
    ap.add_argument("--character", action="append", help="Limit review to this cast ID; repeat for more characters")
    ap.add_argument(
        "--crowd",
        action="store_true",
        help="Measure 100 independently animated variations of this cartoon cast",
    )
    ap.add_argument(
        "--reference",
        action="append",
        nargs=3,
        default=[],
        metavar=("CAST_ID", "DEGREES", "IMAGE"),
        help="Compare a recipe portrait with a local drawing at a chosen angle; repeat for more characters",
    )
    ap.add_argument(
        "--sync-picker",
        action="store_true",
        help="Install these portraits and register new cast entries in the local native picker",
    )
    ap.add_argument(
        "--portrait-turns",
        action="store_true",
        help="Also capture three-quarter and profile close-ups",
    )
    ap.add_argument(
        "--compare-with",
        type=Path,
        metavar="PREVIOUS_CAPTURE",
        help="Compare both profile cameras with an earlier --portrait-turns capture",
    )
    capture(ap.parse_args())
