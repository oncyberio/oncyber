"""Build one candidate and allow one measured correction within a named family."""

import json
from hashlib import sha256
from pathlib import Path
from tempfile import mkdtemp
from time import monotonic

import numpy as np
from jsonschema import ValidationError, validate
from PIL import Image, ImageOps
from playwright.sync_api import Error as BrowserError
from scipy import ndimage

from .eye_review import portrait_pair
from .family import fit_family
from .family_edits import record
from .family_review import assess_native, revise_family
from .fit import pixels
from .household_front import fit_front
from .portrait import compile_portrait, propose_portrait
from .provider import openrouter_model, request_drawing, review_family
from .review import render

point = {
    "type": "array",
    "items": {"type": "integer", "minimum": 0, "maximum": 1000},
    "minItems": 2,
    "maxItems": 2,
}
OBSERVATION = record(
    {
        "head": {**point, "minItems": 4, "maxItems": 4},
        **{field: point for field in ("skin", "hair", "shirt")},
        "body": {"type": "string", "enum": ["child", "lean-teen", "adult"]},
        "top": {"type": "string", "enum": ["crew", "polo", "tank"]},
        "cut": {"type": "string", "enum": ["crop", "part", "ponytail"]},
        "yaw": {"type": "integer", "minimum": -35, "maximum": 35},
        "missing": {"type": "string", "maxLength": 96},
    }
)
OPERATION = {
    "name": "measure_family_portrait",
    "type": "function",
    "strict": True,
    "parameters": OBSERVATION,
    "description": "Locate the head and visible pigments and select a family body preset.",
}


def save(path, value):
    path.write_text(json.dumps(value, indent=2, allow_nan=False) + "\n")


def portrait_metrics(source, native, family):
    """Register by the two eye centers or by the dark visor, independent of crop."""

    def sample(path):
        try:
            rgb, mask = pixels(path, keep_components=True)
        except ValueError as exc:
            # A close native portrait can fill both lower corners with jersey.
            # Only infer a backdrop when the upper corners actually agree.
            if "contrasting background" not in str(exc):
                raise
            with Image.open(path) as im:
                im = ImageOps.exif_transpose(im).convert("RGB")
                im.thumbnail((1600, 1600))
                rgb = np.asarray(im, dtype=float)
            corners = [
                np.median(p.reshape(-1, 3), axis=0) for p in (rgb[:5, :5], rgb[:5, -5:])
            ]
            if np.max(np.abs(corners[0] - corners[1])) > 12:
                raise
            background = np.max(abs(rgb - np.mean(corners, axis=0)), axis=2) < 15
            border = np.zeros_like(background)
            border[0] = background[0]
            border[:, 0] = background[:, 0]
            border[:, -1] = background[:, -1]
            mask = ~ndimage.binary_propagation(border, mask=background)
        h, w = mask.shape
        if family == "sunshine":
            labels, n = ndimage.label(
                mask & (rgb.max(2) < 103) & (np.indices(mask.shape)[0] < h * 0.77)
            )
            if not n:
                raise ValueError("Cannot register the visor")
            y, x = np.where(labels == 1 + np.bincount(labels.ravel())[1:].argmax())
            scale = (np.ptp(x) + 1) / 2
            cx, cy = (x.min() + x.max()) / 2, (y.min() + y.max()) / 2
            half = 1.65
        else:
            pair = portrait_pair(rgb, (0, 0, w, h))
            if len(pair) != 2:
                raise ValueError("Cannot register both eyes")
            centers = np.array(
                [
                    [(a + c) / 2, (b + d) / 2]
                    for a, b, c, d in (p["bounds"] for p in pair)
                ]
            )
            cx, cy = centers.mean(0)
            scale = centers[1, 0] - centers[0, 0]
            half = 1.95
        y, x = np.mgrid[-half:half:192j, -half:half:192j]
        yy, xx = (
            np.rint(cy + y * scale).astype(int),
            np.rint(cx + x * scale).astype(int),
        )
        inside = (xx >= 0) & (xx < w) & (yy >= 0) & (yy < h)
        xx, yy = xx.clip(0, w - 1), yy.clip(0, h - 1)
        shape = mask[yy, xx] & inside
        colors = rgb[yy, xx]
        ink = (colors.max(2) < 112) & shape
        return shape, colors, ink, inside

    a, ar, ai, ac = sample(source)
    b, br, bi, bc = sample(native)
    valid = ac & bc
    shared = a & b & valid

    def overlap(a, b):
        return round(float((a & b & valid).sum() / max(1, ((a | b) & valid).sum())), 4)

    def within(a, b):
        active = a & valid
        return (
            float((ndimage.distance_transform_edt(~b)[active] < 3).mean())
            if active.any()
            else 0.0
        )

    return {
        "head_iou": overlap(a, b),
        "rgb_mae": round(float(np.abs(ar - br)[shared].mean()), 2)
        if shared.any()
        else 255,
        "ink_agreement": round(min(within(ai, bi), within(bi, ai)), 4),
        "visible_fraction": round(float(valid.mean()), 4),
    }


def author_one(source, output, family, framing, name, args):
    if family not in ("rick-classic", "sunshine") or framing not in (
        "full",
        "portrait",
    ):
        raise ValueError("Choose a registered family and full or portrait framing")
    output.mkdir(parents=True, exist_ok=True)
    directory = Path(mkdtemp(prefix="study-", dir=output)).resolve()
    remote = bool(args.openrouter or args.endpoint or args.adapter)
    report = {
        "family": family,
        "framing": framing,
        "source_sha256": sha256(source.read_bytes()).hexdigest(),
        "transport": "openrouter"
        if args.openrouter
        else "adapter"
        if args.adapter
        else "responses"
        if args.endpoint
        else "deterministic",
        "calls": [],
        "passes": [],
        "accepted": False,
    }
    started = monotonic()
    from .feature_library import resolve_feature

    feature_cache = {}
    try:
        if args.openrouter:
            args.model = openrouter_model(args.model)
        if framing == "portrait":
            obs = None
            for i in range(2 if remote else 1):
                dest = directory / f"pass-{i + 1}"
                dest.mkdir()
                if remote:
                    prompt = (
                        f"Measure this {family} portrait. Return head bounds [left,top,right,chin] (orb excluding rays on Sunshine) and on-figure sample points as normalized 0–1000 coordinates. "
                        "Choose an anatomical body preset for the unseen body. For a visibly unsupported feature give its name in missing, otherwise an empty string."
                    )
                    images = [source]
                    if i:
                        images += [
                            previous / "portrait.png",
                            previous / "turnaround.png",
                        ]
                        prompt += f" Compare the first native draw and correct the observations once. Prior measurements {json.dumps(obs)}."
                    obs, receipt = request_drawing(
                        args, prompt, images, [OPERATION], OPERATION
                    )
                    report["calls"].append(receipt)
                else:
                    obs = propose_portrait(source, family)
                validate(obs, OBSERVATION)
                save(dest / "observations.json", obs)
                recipe = compile_portrait(source, family, name, obs)
                if obs["missing"]:
                    from .feature_library import apply_feature, library_key

                    key = library_key(obs["missing"])
                    report["needs_feature"] = key
                    if key in feature_cache:
                        recipe = apply_feature(recipe, feature_cache[key])
                    else:
                        recipe = resolve_feature(
                            args, key, recipe, source, dest, report["calls"]
                        )
                        if (dest / "feature.json").exists():
                            feature_cache[key] = json.loads(
                                (dest / "feature.json").read_bytes()
                            )
                    report.pop("needs_feature")
                    report["feature_used"] = key
                candidate = dest / "candidate.json"
                save(candidate, recipe)
                native = render(candidate, dest, args.base, backend=args.renderer)
                title = (
                    "portrait-other-quarter"
                    if obs["yaw"] < -17
                    else "portrait-quarter"
                    if obs["yaw"] > 17
                    else "portrait"
                )
                score = portrait_metrics(source, dest / (title + ".png"), family)
                passed = (
                    score["head_iou"] >= 0.86
                    and score["rgb_mae"] <= 28
                    and score["ink_agreement"] >= 0.68
                    and score["visible_fraction"] >= 0.70
                    and native["triangles"] <= args.max_triangles
                )
                report["passes"].append(
                    {
                        "directory": dest.name,
                        "accepted": passed,
                        "visible_portrait": score,
                        "native": native,
                    }
                )
                previous = dest
                if passed:
                    break
        else:
            dest = directory / "pass-1"
            dest.mkdir()
            if family == "rick-classic":
                from .draft import propose

                drawing = propose(source, name)
                household = drawing["haircut"] != "spikes" and drawing["top"] in (
                    "crew",
                    "tank",
                    "polo",
                )
            else:
                household = False
            if household:
                recipe, score = fit_front(source, name)
            else:
                recipe, measures, _ = fit_family(
                    source, family, name, custom_jersey=True
                )
                score = measures[family]
            trial = {
                "family": family,
                "source_sha256": report["source_sha256"],
                "candidates": {family: score},
                "accepted": False,
            }
            assess_native(
                recipe,
                source,
                dest,
                trial,
                args.base,
                args.renderer,
                args.max_triangles,
            )
            save(dest / "review.json", trial)

            def entry(dest, trial):
                return {
                    "directory": dest.name,
                    "accepted": trial["accepted"],
                    "native": trial.get("native"),
                    "front": trial.get("front"),
                    "reason": trial.get("reason"),
                }

            report["passes"].append(entry(dest, trial))
            if remote or not trial["accepted"]:
                if remote:
                    decision, receipt = review_family(args, source, dest, recipe, trial)
                    report["calls"].append(receipt)
                    if not decision["use_family"]:
                        report["needs_feature"] = decision["reason"]
                        extended = resolve_feature(
                            args,
                            decision["reason"],
                            recipe,
                            source,
                            dest,
                            report["calls"],
                        )
                        # A new definition still uses the one available correction.
                        from .feature_library import location

                        feature = dest / "feature.json"
                        if not feature.exists():
                            feature = location(
                                args.feature_library, extended, decision["reason"]
                            )
                        edits = json.loads(feature.read_bytes())["edits"]
                        report["feature_used"] = report.pop("needs_feature")
                    else:
                        edits = decision["edits"]
                else:
                    edits = trial.get("suggested_edits", [])
                if edits:
                    changed, revised = revise_family(
                        source,
                        dest,
                        edits,
                        args.base,
                        args.renderer,
                        args.max_triangles,
                    )
                    if changed != dest:
                        dest = changed
                        report["passes"].append(entry(dest, revised))
        report["accepted"] = report["passes"][-1]["accepted"]
        report["candidate"] = str((dest / "candidate.json").relative_to(directory))
        if report["accepted"]:
            (directory / "recipe.json").write_bytes(
                (dest / "candidate.json").read_bytes()
            )
    except (ValueError, OSError, RuntimeError, ValidationError, BrowserError) as exc:
        report["error"] = str(exc)
    finally:
        report["seconds"] = round(monotonic() - started, 2)
        charges = [(call.get("usage") or {}).get("cost") for call in report["calls"]]
        report["reported_provider_cost"] = (
            sum(charges)
            if charges and all(isinstance(c, (int, float)) for c in charges)
            else None
        )
        save(directory / "study.json", report)
    return directory, report
