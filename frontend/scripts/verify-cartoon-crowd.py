"""Render distinct native recipe variations and measure their shared avatar draw call."""

import argparse
import json
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


def verify(base, dest, sources, count):
    dest.mkdir(parents=True, exist_ok=True)
    recipes = variants([json.loads(p.read_text()) for p in sources], count)
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
            page.route("**/lobby/procedural/recipes/crowd-study-*.json", recipe_handler(recipes, loaded))
            query = urlencode({"renderer": mode, "count": count, "cast": "cartoon", "guest": list(recipes)}, doseq=True)
            page.goto(f"{base.rstrip('/')}/dev/procedural-crowd?{query}", wait_until="domcontentloaded", timeout=120000)
            page.wait_for_function("n => Number(document.querySelector('canvas')?.dataset.visible) === n", arg=count, timeout=240000)
            canvas = page.locator("canvas")
            stats = canvas.evaluate("c => ({...c.dataset})")
            if len(loaded) != count or stats["calls"] != "1" or stats["backend"] != expected:
                raise RuntimeError(f"{expected} loaded {len(loaded)} distinct recipes, renderer reported {stats}")
            report[expected] = {**stats, "uniqueRecipesLoaded": len(loaded)}
            canvas.screenshot(path=dest / f"crowd-{mode}.png")
            page.close()
        browser.close()
    (dest / "crowd.json").write_text(json.dumps(report, indent=2) + "\n")
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path)
    parser.add_argument("recipes", type=Path, nargs="+", help="Fitted front-view cartoon recipes to vary")
    parser.add_argument("--base", default="http://localhost:13000")
    parser.add_argument("--count", type=int, default=100)
    args = parser.parse_args()
    if not 1 <= args.count <= 100:
        parser.error("--count must be between 1 and 100")
    print(json.dumps(verify(args.base, args.output, args.recipes, args.count), indent=2))
