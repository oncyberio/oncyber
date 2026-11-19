"""Render distinct native recipe variations and measure their shared avatar draw call."""

import argparse
import json
from hashlib import sha256
import os
import re
import shutil
from copy import deepcopy
from pathlib import Path
from urllib.parse import urlencode

from playwright.sync_api import sync_playwright


def variants(recipes, count):
    result = {}
    for i in range(count):
        recipe = deepcopy(recipes[i % len(recipes)])
        recipe["name"] = f"Crowd study {i}"
        color = f"#{(73 + 37 * i) % 190 + 30:02x}{(41 + 13 * i) % 160 + 60:02x}{(101 + 17 * i) % 180 + 50:02x}"
        if recipe.get("construction") == "household":
            design = recipe["design"]
            design["head"][0] = round(design["head"][0] * (0.90 + i * 0.002), 2)
            design["outfit"]["color"] = color
        elif recipe["style"] == "family":
            recipe["paints"]["shirt"] = color
            recipe["proportions"]["headWidth"] = round(0.84 + i * 0.003, 3)
            recipe["proportions"]["crownLength"] = round(0.55 + (i % 97) / 96, 3)
        else:
            design = recipe["design"]
            design.setdefault("face", {})["eyeDepthScale"] = round(0.85 + i * 0.003, 3)
            design["outfit"]["color"] = color
            for row in design["fit"]["sections"]["arm"]:
                row[2] *= 0.86 + i % 17 * 0.017
        result[f"crowd-study-{i}"] = recipe
    return result


def recipe_handler(recipes, loaded):
    def serve(route):
        slug = re.search(r"/(crowd-study-\d+)\.json$", route.request.url).group(1)
        loaded.add(slug)
        route.fulfill(content_type="application/json", body=json.dumps(recipes[slug]))
    return serve


def occupied_cells(image, count, shadow_only=False):
    """Count projected avatar slots containing a visible figure on the receiver."""
    from math import ceil, sqrt
    import numpy as np
    from PIL import Image

    rgb = np.asarray(Image.open(image).convert("RGB"), dtype=float)
    h, w = rgb.shape[:2]
    cols = ceil(sqrt(count))
    rows = ceil(count / cols)
    scale = min(h / (rows * 2.45), w / (cols * 1.72))
    # A uniform plane fills the camera. Every occupied slot must contain
    # foreground in both its upper and lower half, away from adjacent slots.
    paper = np.median(rgb[::6, ::6], axis=(0, 1))
    foreground = np.abs(rgb - paper).max(axis=2) > 26
    if shadow_only and np.mean(np.ptp((rgb - paper)[foreground], axis=1) > 38) > 0.005:
        raise RuntimeError("The shadow-only receiver still contains avatar pigments")
    occupied = 0
    for i in range(count):
        row, col = divmod(i, cols)
        x = w / 2 + (col - (cols - 1) / 2) * 1.72 * scale
        y = h / 2 + (row - (rows - 1) / 2) * 2.45 * scale
        patch = foreground[max(0, round(y - 0.88 * scale)):round(y + 1.10 * scale),
                           max(0, round(x - 0.69 * scale)):round(x + 0.69 * scale)]
        if patch.size and all(half.mean() >= 0.027 for half in np.array_split(patch, 2)):
            occupied += 1
    return occupied


def verify(base, dest, sources, count, preview=False, shadows=False):
    dest.mkdir(parents=True, exist_ok=True)
    recipes = {} if preview else variants([json.loads(p.read_text()) for p in sources], count)
    seed_digest = None
    if preview:
        root = Path(__file__).parent / "avatar_authoring/targets/holdout-v1"
        seeds = [(root / "candidates" / (c["id"] + ".recipe")).read_bytes()
                 for c in json.loads((root / "manifest.json").read_bytes())["cases"]]
        seed_digest = sha256(b"\n".join(seeds)).hexdigest()
    report = {}
    env = dict(os.environ)
    driver = "/usr/lib/chromium/vk_swiftshader_icd.json"
    if Path(driver).is_file():
        env.setdefault("VK_ICD_FILENAMES", driver)
    with sync_playwright() as pw:
        browser = pw.chromium.launch(executable_path=shutil.which("chromium"), env=env, args=[
            "--enable-unsafe-webgpu", "--use-webgpu-adapter=swiftshader", "--enable-unsafe-swiftshader",
            "--enable-features=Vulkan", "--use-angle=swiftshader",
        ])
        for mode, expected in [("webgl", "WebGLBackend"), ("auto", "WebGPUBackend")]:
            loaded = set()

            page = browser.new_page(user_agent="Oncyber local avatar review", viewport={"width": 1050, "height": 840})
            if not preview:
                page.route("**/lobby/procedural/recipes/crowd-study-*.json", recipe_handler(recipes, loaded))
            query = urlencode({"renderer": mode, "count": count, "cast": "cartoon", "shadows": "1" if shadows else "0", "guest": list(recipes)}, doseq=True)
            route = "/preview/crowd" if preview else "/dev/procedural-crowd"
            page.goto(f"{base.rstrip('/')}{route}?{query}", wait_until="domcontentloaded", timeout=120000)
            page.wait_for_function("n => Number(document.querySelector('canvas')?.dataset.visible) === n", arg=count, timeout=240000)
            canvas = page.locator("canvas")
            stats = canvas.evaluate("c => ({...c.dataset})")
            if preview and stats.get("seedDigest") != seed_digest:
                raise RuntimeError(f"{expected} rendered a different revision of the eight preview recipes")
            distinct = int(stats["distinct"]) if preview else len(loaded)
            if distinct != count or stats["authored"] != str(count) or stats["calls"] != "1" or stats["backend"] != expected:
                raise RuntimeError(f"{expected} loaded {distinct} distinct recipes, renderer reported {stats}")
            if shadows and stats.get("shadowCalls") != "1":
                raise RuntimeError(f"{expected} shadow pass reported {stats}")
            report[expected] = {**stats, "uniqueRecipesLoaded": distinct}
            color = dest / f"crowd-{mode}.png"
            canvas.screenshot(path=color)
            occupied = occupied_cells(color, count)
            report[expected]["occupiedColorCells"] = occupied
            if occupied != count:
                raise RuntimeError(f"{expected} displayed avatars in {occupied}/{count} projected cells")
            if shadows:
                page.get_by_role("checkbox", name="Shadows only").check()
                page.wait_for_function("document.querySelector('canvas').dataset.shadowOnly === 'true'")
                shadow = dest / f"shadows-{mode}.png"
                canvas.screenshot(path=shadow)
                occupied = occupied_cells(shadow, count, shadow_only=True)
                report[expected]["occupiedShadowCells"] = occupied
                if occupied != count:
                    raise RuntimeError(f"{expected} displayed shadows in {occupied}/{count} projected cells")
            page.close()
        browser.close()
    (dest / "crowd.json").write_text(json.dumps(report, indent=2) + "\n")
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path)
    parser.add_argument("recipes", type=Path, nargs="*", help="Fitted front-view cartoon recipes to vary")
    parser.add_argument("--preview", action="store_true", help="Test the eight embedded branch study seeds")
    parser.add_argument("--shadows", action="store_true", help="Measure a directional shadow-map pass with an actual receiver")
    parser.add_argument("--base", default="http://localhost:13000")
    parser.add_argument("--count", type=int, default=100)
    args = parser.parse_args()
    if not 1 <= args.count <= 100:
        parser.error("--count must be between 1 and 100")
    if bool(args.recipes) == args.preview:
        parser.error("Choose recipe files or --preview")
    print(json.dumps(verify(args.base, args.output, args.recipes, args.count, args.preview, args.shadows), indent=2))
