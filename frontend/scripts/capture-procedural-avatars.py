"""Capture the live Oncyber renderer. Requires Python Playwright and Chromium."""

import argparse
import json
import re
from io import BytesIO

import numpy as np
from PIL import Image
import os
from pathlib import Path
import shutil

from playwright.sync_api import sync_playwright


def set_angle(control, degrees):
    control.evaluate(
        """(element, angle) => {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        setter.call(element, angle);
        element.dispatchEvent(new Event('input', { bubbles: true }));
    }""",
        str(degrees),
    )


def check_cartoon_features(directory):
    """Check that required ink survives the actual material and atlas sampling.
    The two eye regions locate the face even when its portrait framing changes.
    """
    from scipy.ndimage import label, find_objects

    portraits = json.loads(
        (
            Path(__file__).resolve().parents[1]
            / "features/procedural-avatars/cartoon-portraits.json"
        ).read_text()
    )
    results = {}
    for name, recipe in portraits.items():
        picture = np.asarray(
            Image.open(directory / f"{name}-portrait.png").convert("RGB")
        ).astype(np.int16)
        h, w = picture.shape[:2]
        white = np.max(abs(picture - [255, 248, 232]), axis=2) < 19
        white[int(h * 0.89) :] = False
        groups, _ = label(white)
        areas = np.bincount(groups.ravel())
        boxes = find_objects(groups)
        eyes = sorted(
            [
                i
                for i in range(1, len(areas))
                if h * w * 0.001 < areas[i] < h * w * 0.09
            ],
            key=lambda i: areas[i],
            reverse=True,
        )[:2]
        if len(eyes) != 2:
            raise AssertionError(f"{name}: expected two visible cartoon eyes")
        features = {"eyes": 2}
        if recipe.get("mouth"):
            y = max(boxes[i - 1][0].stop for i in eyes)
            left = min(boxes[i - 1][1].start for i in eyes)
            right = max(boxes[i - 1][1].stop for i in eyes)
            area = picture[y : min(h, round(y + 1.25 * (right - left))), left:right]
            oral = np.max(abs(area - [99, 49, 46]), axis=2) < 19
            components, _ = label(oral)
            size = np.bincount(components.ravel())[1:].max(initial=0)
            if size < 0.1 * sum(areas[i] for i in eyes):
                raise AssertionError(
                    f"{name}: expected the open mouth specified in its portrait"
                )
            features["open_mouth"] = True
        results[name] = features
    return results


def compare_sunshine(page, stage, destination):
    page.get_by_label("Subject", exact=True).select_option("sunshine")
    with page.expect_response(lambda r: "/models/summer_unlit_fixed.vrm" in r.url):
        page.get_by_role("button", name="Compare default VRM").click()
    page.wait_for_function(
        "document.querySelector('.stage canvas')?.dataset.comparison === 'ready'"
    )
    rotation = page.get_by_label("Rotation", exact=False)
    results = {}
    for view, angle in [("front", 0), ("profile", 90), ("back", 180)]:
        set_angle(rotation, angle)
        page.wait_for_function(
            "target => document.querySelector('.stage canvas')?.dataset.framing === target",
            arg=f"sunshine/{angle}/body",
        )
        suffix = "" if view == "front" else f"-{view}"
        color_path = destination / f"sunshine-comparison{suffix}.png"
        page.locator(".stage").screenshot(path=color_path)
        page.get_by_role("button", name="Compare silhouettes").click()
        page.wait_for_function(
            "document.querySelector('.stage canvas')?.dataset.silhouette === 'true'"
        )
        mask_path = destination / f"sunshine-silhouettes{suffix}.png"
        stage.screenshot(path=mask_path)
        results[view] = comparison_metrics(
            mask_path, color_path, float(stage.get_attribute("data-pair-offset"))
        )
        print(f"Sunshine T-pose {view}", results[view])
        page.get_by_role("button", name="Show paint").click()
        page.wait_for_function(
            "document.querySelector('.stage canvas')?.dataset.silhouette === 'false'"
        )
    set_angle(rotation, 18)
    page.get_by_label("Motion", exact=True).select_option("Crouch")
    page.wait_for_function(
        "document.querySelector('.stage canvas')?.dataset.pose === 'Crouch'",
        timeout=90000,
    )
    page.locator(".stage").screenshot(path=destination / "sunshine-crouch.png")
    page.get_by_label("Motion", exact=True).select_option("Reference")
    return results


def comparison_metrics(path, color_path, pair_offset):
    img = np.asarray(Image.open(path).convert("RGB"))
    mask = img[:, :, 0] >= 128
    width = mask.shape[1] // 2
    source, generated = mask[:, :width], mask[:, -width:]
    # Translating the two known camera-space positions aligns the masks.
    # No fitting, per-avatar scaling or color-based foreground extraction.
    shift = round(mask.shape[1] - width - pair_offset)
    aligned = np.zeros_like(generated)
    lo, hi = max(shift, 0), min(width + shift, width)
    aligned[:, lo:hi] = generated[:, lo - shift : hi - shift]
    iou = np.count_nonzero(source & aligned) / np.count_nonzero(source | aligned)
    colors = np.asarray(Image.open(color_path).convert("RGB"), dtype=float)[
        : mask.shape[0]
    ]
    right = colors[:, -width:]
    left = colors[:, :width]
    overlap = (source & aligned)[:, lo:hi]
    color_mae = np.abs(left[:, lo:hi] - right[:, lo - shift : hi - shift])[
        overlap
    ].mean()
    return {"iou": round(iou, 4), "color_mae": round(float(color_mae), 2)}


def capture_motion(page, output, subjects, angle, clip):
    rotation = page.get_by_label("Rotation", exact=False)
    set_angle(rotation, angle)
    page.get_by_label("Motion", exact=True).select_option(clip)
    page.wait_for_timeout(450)
    frames = []
    for _ in range(24):
        frame = Image.open(BytesIO(page.locator(".stage").screenshot())).convert("RGB")
        frame.thumbnail((840, 520), Image.Resampling.LANCZOS)
        frames.append(frame)
    first = np.asarray(frames[0], dtype=float)
    # Each subject occupies its own horizontal slice in this view.
    changes = [
        np.abs(np.asarray(frame, dtype=float) - first).mean(axis=2)
        for frame in frames[1:]
    ]
    for index, region in enumerate(
        np.array_split(np.max(changes, axis=0), subjects, axis=1)
    ):
        if np.count_nonzero(region > 12) < 150:
            raise AssertionError(
                f"Subject {index + 1} in {output.name} did not animate"
            )
    frames[0].save(
        output, save_all=True, append_images=frames[1:], duration=90, loop=0, quality=88
    )


def capture_rick(page, destination, turntable=False):
    # Paired color and mask captures must have the same viewport when controls wrap.
    size = page.add_style_tag(
        content='section[aria-label="Model and reference"] { flex:none !important; height:640px !important; min-height:640px !important; }'
    )
    page.get_by_label("Subject", exact=True).select_option("rick-classic")
    stage = page.locator(".stage canvas")
    rotation = page.get_by_label("Rotation", exact=False)
    cameras = {}
    for portrait in (False, True):
        if portrait:
            page.get_by_role("button", name="Portrait", exact=True).click()
        views = (
            [("portrait", 0), ("portrait-quarter", 35), ("portrait-profile", 90)]
            if portrait
            else [("front", 0), ("profile", 90), ("back", 180)]
        )
        if turntable and not portrait:
            views += [
                (f"turn-{a}", a) for a in range(-150, 180, 30) if a not in (0, 90)
            ]
        for name, angle in views:
            set_angle(rotation, angle)
            page.wait_for_function(
                "target=>document.querySelector('.stage canvas')?.dataset.framing===target",
                arg=f"rick-classic/{angle}/{'portrait' if portrait else 'body'}",
            )
            stage.screenshot(path=destination / f"rick-calibrated-{name}.png")
            page.get_by_role("button", name="Show OBJ swatches").click()
            page.wait_for_function(
                "document.querySelector('.stage canvas')?.dataset.paint==='mrgb'"
            )
            stage.screenshot(path=destination / f"rick-mrgb-{name}.png")
            page.get_by_role("button", name="Show baked paint").click()
            page.wait_for_function(
                "document.querySelector('.stage canvas')?.dataset.paint==='baked'"
            )
            page.get_by_role("button", name="Compare silhouettes").click()
            page.wait_for_function(
                "document.querySelector('.stage canvas')?.dataset.silhouette === 'true'"
            )
            stage.screenshot(path=destination / f"rick-mask-{name}.png")
            page.get_by_role("button", name="Show paint").click()
            page.wait_for_function(
                "document.querySelector('.stage canvas')?.dataset.silhouette === 'false'"
            )
            cameras[name] = {
                "basis": json.loads(stage.get_attribute("data-reference-basis"))
            }
        if portrait:
            page.get_by_role("button", name="Full body", exact=True).click()
    (destination / "rick-cameras.json").write_text(json.dumps(cameras, indent=2))
    size.evaluate("e=>e.remove()")


def capture(
    base,
    destination,
    backend,
    crowd=False,
    motion=False,
    rick_only=False,
    turntable=False,
):
    destination.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as playwright:
        flags = ["--enable-unsafe-swiftshader"]
        environment = dict(os.environ)
        # Headless Chromium on the cloud image includes the SwiftShader Vulkan ICD.
        icd = Path("/usr/lib/chromium/vk_swiftshader_icd.json")
        if backend == "auto" and icd.exists():
            environment.setdefault("VK_ICD_FILENAMES", str(icd))
            flags.extend(
                [
                    "--enable-unsafe-webgpu",
                    "--use-webgpu-adapter=swiftshader",
                    "--enable-features=Vulkan",
                    "--use-angle=swiftshader",
                ]
            )
        browser = playwright.chromium.launch(
            executable_path=shutil.which("chromium"),
            args=flags,
            env=environment,
        )
        page = browser.new_page(
            viewport={"width": 1100, "height": 850},
            user_agent="Oncyber local avatar review",
        )
        page.goto(
            f"{base.rstrip('/')}/dev/procedural-avatars?renderer={backend}",
            wait_until="domcontentloaded",
            timeout=180000,
        )
        page.locator("small").filter(has_text="skinned mesh").wait_for(timeout=120000)
        stage = page.locator(".stage canvas")
        print("Renderer", stage.get_attribute("data-backend"))
        capture_rick(page, destination, turntable)
        if rick_only:
            browser.close()
            return
        page.get_by_label("Subject", exact=True).select_option("lineup")
        set_angle(page.get_by_label("Rotation", exact=False), 0)

        def wait_for_framing(key, angle, framing):
            page.wait_for_function(
                "target => document.querySelector('.stage canvas')?.dataset.framing === target",
                arg=f"{key}/{angle}/{framing}",
            )

        wait_for_framing("lineup", 0, "body")
        stage.screenshot(path=destination / "lineup.png")

        subjects = page.get_by_label("Subject", exact=True)
        rotation = page.get_by_label("Rotation", exact=False)
        subjects.wait_for()
        subjects.select_option("streetwear")
        wait_for_framing("streetwear", 0, "body")
        stage.screenshot(path=destination / "streetwear.png")
        keys = subjects.locator("option").evaluate_all(
            "(items) => items.map(i => i.value).filter(k => k !== 'lineup' && k !== 'streetwear')"
        )
        if not keys:
            raise RuntimeError("No character choices in the preview")
        triangles = {}
        for key in keys:
            subjects.select_option(key)
            page.locator("small").filter(has_text="1 skinned mesh").wait_for()
            wait_for_framing(key, 0, "body")
            status = page.locator("small").inner_text()
            triangles[key] = int(
                re.search(r"([0-9,]+) triangles", status)[1].replace(",", "")
            )
            print(key, status)
            for name, angle in [("front", 0), ("profile", 90), ("back", 180)]:
                set_angle(rotation, angle)
                wait_for_framing(key, angle, "body")
                stage.screenshot(path=destination / f"{key}-{name}.png")
            set_angle(rotation, 0)
            page.get_by_role("button", name="Portrait", exact=True).click()
            wait_for_framing(key, 0, "portrait")
            box = stage.bounding_box()
            size = min(box["width"], box["height"])
            page.screenshot(
                path=destination / f"{key}-portrait.png",
                clip={
                    "x": box["x"] + (box["width"] - size) / 2,
                    "y": box["y"],
                    "width": size,
                    "height": size,
                },
            )
            page.get_by_role("button", name="Full body", exact=True).click()
        features = check_cartoon_features(destination)
        metrics = compare_sunshine(page, stage, destination)
        report = {
            "backend": stage.get_attribute("data-backend"),
            "triangles": triangles,
            "cartoon_features": features,
            "sunshine_silhouette_iou": {k: m["iou"] for k, m in metrics.items()},
            "sunshine_color_mae": {k: m["color_mae"] for k, m in metrics.items()},
        }
        if motion:
            capture_motion(page, destination / "sunshine-walk.webp", 2, 22, "WALK")
            subjects.select_option("rick-classic")
            capture_motion(page, destination / "rick-walk.webp", 1, 26, "WALK")
            page.get_by_label("Motion", exact=True).select_option("IDLE")
            page.wait_for_timeout(450)
            stage.screenshot(path=destination / "rick-baked-idle.png")
            subjects.select_option("streetwear")
            set_angle(rotation, 0)
            wait_for_framing("streetwear", 0, "body")
            page.get_by_role("button", name="Hold microphone").click()
            page.wait_for_function(
                "document.querySelector('.stage canvas')?.dataset.grip === 'right'"
            )
            capture_motion(page, destination / "streetwear-run.webp", 3, 12, "RUN")
            page.get_by_label("Motion", exact=True).select_option("Reference")
            set_angle(rotation, 0)
            page.get_by_role("button", name="Switch to left hand").click()
            page.wait_for_function(
                "document.querySelector('.stage canvas')?.dataset.grip === 'left'"
            )
            stage.screenshot(path=destination / "streetwear-left-hand.png")
            page.get_by_role("button", name="Release microphone").click()
        if crowd:
            page.goto(
                f"{base.rstrip('/')}/dev/procedural-crowd?renderer={backend}&count=100",
                wait_until="domcontentloaded",
                timeout=180000,
            )
            page.wait_for_function(
                "document.querySelector('canvas')?.dataset.visible === '100'",
                timeout=240000,
            )
            canvas = page.locator("canvas")
            metrics = canvas.evaluate("e => ({...e.dataset})")
            if metrics["calls"] != "1":
                raise AssertionError(
                    f"Expected one avatar draw, renderer reported {metrics}"
                )
            canvas.screenshot(path=destination / "crowd.png")
            report["crowd"] = metrics
            print("Crowd", metrics)
        (destination / "measurements.json").write_text(json.dumps(report, indent=2))
        browser.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path)
    parser.add_argument("--base", default="http://localhost:13000")
    parser.add_argument("--renderer", choices=["auto", "webgl"], default="auto")
    parser.add_argument(
        "--crowd",
        action="store_true",
        help="Also verify 100 animated recipes in one avatar draw",
    )
    parser.add_argument(
        "--motion",
        action="store_true",
        help="Record the Sunshine comparison and streetwear trio playing native clips",
    )
    parser.add_argument(
        "--rick-only",
        action="store_true",
        help="Capture the six calibrated views of the OBJ-fitted recipe",
    )
    parser.add_argument(
        "--turntable",
        action="store_true",
        help="Also record the full body at 30-degree intervals for garment coverage",
    )
    args = parser.parse_args()
    capture(
        args.base,
        args.output,
        args.renderer,
        args.crowd,
        args.motion,
        args.rick_only,
        args.turntable,
    )
