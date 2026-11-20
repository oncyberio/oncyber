"""Bind a promotion decision to the exact candidate, reference and native evidence."""

import hashlib
import json
from pathlib import Path

from .family_review import compare_images, eyes_match, native_front
from .sun_rays import collar_closed
from .one_image import portrait_metrics
from .review import render

CHECKS = ("likeness", "profile", "eyes", "garments", "body", "motion", "grip")
GRIP_VIEWS = ("grip-right.png", "grip-left.png")
VIEWS = (
    "turnaround.png",
    "portrait.png",
    "portrait-quarter.png",
    "portrait-other-quarter.png",
    "front.png",
    "quarter.png",
    "profile.png",
    "back.png",
    "walk.webp",
    "crouch.png",
)


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def reference_passes(framing, score):
    if framing == "portrait":
        return (
            score["head_iou"] >= 0.86
            and score["ink_agreement"] >= 0.68
            and score["rgb_mae"] <= 28
            and score["visible_fraction"] >= 0.70
            and score.get("visor_glyphs", {}).get("matched", True)
        )
    if framing == "full":
        return (
            score["silhouette_iou"] >= 0.90
            and score["head_iou"] >= 0.86
            and score["head_edge_agreement"] >= 0.68
            and score["body_edge_agreement"] >= 0.65
            and ("eye_pigment_agreement" not in score or eyes_match(score))
            and score.get("open_hands", {}).get("matched", True)
            and score.get("shirt_strokes", {}).get("matched", True)
            and score.get("visor_glyphs", {}).get("matched", True)
            and score.get("shirt_mark_agreement", 1) >= 0.65
            and not collar_closed(score.get("floating_gap"))
            and score["rgb_mae"] <= 28
        )
    raise ValueError("Unknown reference framing")


def registration_from_source(recipe, source):
    data = json.loads(recipe.read_bytes())
    family = data.get("family")
    if not family:
        return None
    existing = recipe.parent / "review.json"
    if existing.exists():
        study = json.loads(existing.read_bytes())
        if study.get("source_sha256") == digest(source) and study.get(
            "recipe_sha256"
        ) == digest(recipe):
            measured = study.get("candidates", {}).get(family)
            cached_fingers = not (data.get("kitHand") or {}).get("spread") or (
                measured or {}
            ).get("source_finger_spread")
            cached_print = not (data.get("shirtMark") or {}).get("islands") or (
                measured or {}
            ).get("stroke_mark")
            if measured and cached_fingers and cached_print:
                return measured
    if data.get("construction") == "household":
        from .household_front import fit_front

        _, registration = fit_front(source, "Reference measurement", project_arms=False)
    else:
        from .family import fit_family

        _, metrics, _ = fit_family(
            source, family, custom_jersey=data.get("plainJersey", False)
        )
        registration = metrics[family]
    return registration


def add_turn_guide(report, recipe, folder, guide):
    from shutil import copyfile
    from PIL import Image
    from .turn_guides import compare_turns

    with Image.open(guide) as image:
        split = image.width // 2
    copyfile(guide, folder / "turn-guide")
    report["turn_guide"] = {
        "sha256": digest(guide),
        "split_x": split,
        "angles": [35, 90],
    }
    candidate = json.loads(recipe.read_bytes())
    for backend, item in report["backends"].items():
        dest = folder / backend
        item["turn_metrics"] = compare_turns(
            guide, split, candidate, dest, dest / "turns.webp"
        )
        for name in ("portrait-profile.png", "turns.webp"):
            item["views"][name] = digest(dest / name)


def evidence(
    recipe, source, folder, base, budget, framing="full", yaw=0, turn_guide=None
):
    folder.mkdir(parents=True, exist_ok=True)
    family = json.loads(recipe.read_text()).get("family", "rick-classic")
    if framing == "full" and yaw:
        raise ValueError("Full-body evidence requires a front reference")
    result = {
        "framing": framing,
        "yaw": yaw,
        "recipe": digest(recipe),
        "reference": digest(source),
        "triangle_budget": budget,
        "backends": {},
    }
    registration = (
        registration_from_source(recipe, source) if framing == "full" else None
    )
    if registration:
        result["registration"] = registration
    for mode, backend in [("webgl", "WebGLBackend"), ("auto", "WebGPUBackend")]:
        dest = folder / backend
        native = render(recipe, dest, base, motion=True, backend=mode)
        title = {-35: "portrait-other-quarter", 0: "portrait", 35: "portrait-quarter"}[
            yaw
        ]
        measured = (
            portrait_metrics(source, dest / (title + ".png"), family)
            if framing == "portrait"
            else native_front(source, dest / "front.png", family, registration)
            if registration
            else compare_images(source, dest / "front.png")
        )
        result["backends"][backend] = {
            "reference_metrics": measured,
            "native": native,
            "views": {v: digest(dest / v) for v in (*VIEWS, *GRIP_VIEWS)},
        }
    if turn_guide is not None:
        add_turn_guide(result, recipe, folder, turn_guide)
    (folder / "evidence.json").write_text(json.dumps(result, indent=2) + "\n")
    return result


def verified_captures(recipe, folder):
    """Verify exact native evidence, including captures of candidates that missed."""
    report = json.loads((folder / "evidence.json").read_text())
    if report["recipe"] != digest(recipe):
        raise ValueError("The recipe changed after the native review")
    if set(report["backends"]) != {"WebGPUBackend", "WebGLBackend"}:
        raise ValueError("Both native backends must be reviewed")
    guide = report.get("turn_guide")
    if guide is not None and digest(folder / "turn-guide") != guide["sha256"]:
        raise ValueError("The withheld turn guide changed after review")
    for backend, item in report["backends"].items():
        if item["native"]["backend"] != backend:
            raise ValueError(f"Unexpected renderer for {backend}")
        # Older evidence remains inspectable. A new promotion also requires
        # both socket and finger measurements on the current candidate.
        views = (*VIEWS, *GRIP_VIEWS) if "grip_test" in item["native"] else VIEWS
        if guide is not None:
            views = (*views, "portrait-profile.png", "turns.webp")
        if set(item["views"]) != set(views) or any(
            digest(folder / backend / name) != item["views"][name] for name in views
        ):
            raise ValueError(f"Review frames changed for {backend}")
    return report


def check_evidence(recipe, folder):
    report = verified_captures(recipe, folder)
    for backend, item in report["backends"].items():
        native = item["native"]
        grip = native.get("grip_test", {})
        if not reference_passes(report["framing"], item["reference_metrics"]):
            raise ValueError(f"Native reference comparison failed on {backend}")
        if not (
            0 < native["triangles"] <= report["triangle_budget"]
            and native["moving_steps"] >= 9
            and native["hand"] == "right"
            and grip.get("released") is True
            and all(
                0.025 < grip.get("minimum_curl_radians", {}).get(side, 0) <= 3.1416
                for side in ("right", "left")
            )
            and 0.3 <= native["crouch_height_ratio"] < 0.98
        ):
            raise ValueError(f"Motion, grip or performance failed on {backend}")
    return report


def require_release(recipe, folder):
    if folder is None:
        raise ValueError(
            "Supply --release with native evidence and an independent visual decision"
        )
    report = check_evidence(recipe, folder)
    decision = json.loads((folder / "visual-review.json").read_text())
    if (
        decision.get("evidence") != digest(folder / "evidence.json")
        or decision.get("reference") != report["reference"]
        or not str(decision.get("reviewer", "")).strip()
        or decision.get("kind") not in ("human", "vision")
        or any(decision.get("checks", {}).get(c) is not True for c in CHECKS)
    ):
        raise ValueError(
            "The independent visual decision is incomplete or belongs to another candidate"
        )
    return report


def record_decision(recipe, source, folder, decision):
    report = verified_captures(recipe, folder)
    if report["reference"] != digest(source) or decision.get("evidence") != digest(
        folder / "evidence.json"
    ):
        raise ValueError(
            "The reviewer must identify the current evidence and reference"
        )
    if decision.get("reference", report["reference"]) != report["reference"]:
        raise ValueError("The visual assessment names another reference")
    if (
        decision.get("kind") not in ("vision", "human")
        or not isinstance(decision.get("reviewer"), str)
        or not decision["reviewer"].strip()
        or not isinstance(decision.get("checks"), dict)
        or any(type(decision["checks"].get(check)) is not bool for check in CHECKS)
    ):
        raise ValueError(
            "A reviewer and a pass or miss on every visual check are required"
        )
    # Preserve a failed visual assessment for the next round as well.
    decision = {**decision, "reference": report["reference"]}
    (folder / "visual-review.json").write_text(json.dumps(decision, indent=2) + "\n")
    return require_release(recipe, folder)


def export_review_views(folder, destination, key, report):
    """Offer the captured turns and motion on demand, bound to the archived evidence."""
    from shutil import copyfile
    from PIL import Image, ImageDraw, ImageFont
    from .family_sheet import view_tile

    destination.mkdir(parents=True, exist_ok=True)
    font = ImageFont.truetype("DejaVuSans.ttf", 17)
    assets = {}
    for backend, capture in report["backends"].items():
        source = folder / backend
        prefix = destination / (key + "-" + backend)
        grips = "grip_test" in capture["native"]
        sheet = Image.new("RGB", (1440, 1190 if grips else 926), "#eee9e1")
        labels = ImageDraw.Draw(sheet)
        for index, (view, label) in enumerate(
            (
                ("front", "Front"),
                ("quarter", "35°"),
                ("profile", "Profile"),
                ("back", "Back"),
            )
        ):
            x = index * 360
            tile = view_tile(source / (view + ".png"), (352, 330))
            sheet.paste(
                tile, (x + (360 - tile.width) // 2, 30 + (330 - tile.height) // 2)
            )
            labels.text((x + 9, 6), label, font=font, fill="#262521")
        with Image.open(source / "turnaround.png") as turns:
            sheet.paste(turns.convert("RGB"), (0, 366))
        pose = view_tile(source / "crouch.png", (392, 490))
        sheet.paste(
            pose, (1040 + (400 - pose.width) // 2, 407 + (490 - pose.height) // 2)
        )
        labels.text(
            (1050, 377), "Crouch and right-hand grip", font=font, fill="#262521"
        )
        if grips:
            for i, side in enumerate(("right", "left")):
                with Image.open(source / ("grip-" + side + ".png")) as hand:
                    # The native hand camera centers the wrist and middle fingertip.
                    # Preserve the scale and leave room for the projecting handle.
                    w, h = hand.size
                    scale = min(w / 680, h * 0.48 / 232)
                    box = (
                        w / 2 - 340 * scale,
                        h / 2 - 116 * scale,
                        w / 2 + 340 * scale,
                        h / 2 + 116 * scale,
                    )
                    tile = hand.resize((680, 232), Image.Resampling.LANCZOS, box=box)
                    sheet.paste(tile, (i * 720 + 20, 950))
                labels.text(
                    (i * 720 + 14, 925),
                    side.capitalize() + " grip",
                    font=font,
                    fill="#262521",
                )
        still = prefix.with_name(prefix.name + "-views.webp")
        motion = prefix.with_name(prefix.name + "-walk.webp")
        sheet.save(still, "WEBP", quality=92, method=6)
        copyfile(source / "walk.webp", motion)
        assets[backend] = {
            "views": digest(still),
            "walk": capture["views"]["walk.webp"],
        }
        if report.get("turn_guide"):
            copyfile(
                source / "turns.webp", prefix.with_name(prefix.name + "-turns.webp")
            )
            assets[backend]["turns"] = capture["views"]["turns.webp"]
    return assets


def vision_decision(recipe, source, folder, args):
    from .family_edits import record
    from .provider import openrouter_model, request_drawing
    from PIL import Image, ImageOps, ImageDraw

    report = verified_captures(recipe, folder)
    if report["reference"] != digest(source):
        raise ValueError("The reference changed after it was measured")
    if args.openrouter:
        args.model = openrouter_model(args.model)
    operation = {
        "name": "inspect_native_avatar",
        "type": "function",
        "strict": True,
        "description": "Evaluate the observed identity, garment fit, anatomy, animation and grip.",
        "parameters": record(
            {
                "checks": record({k: {"type": "boolean"} for k in CHECKS}),
                "reason": {"type": "string"},
            }
        ),
    }
    # Give a static-image reviewer both native rigs, each grip close-up and
    # successive walk frames. The recorded walk alone opens at frame zero.
    dest = folder / "vision-review"
    export_review_views(folder, dest, "native", report)
    images = [source]
    for backend in report["backends"]:
        images.append(dest / f"native-{backend}-views.webp")
        sheet = Image.new("RGB", (960, 640), "#ebe5db")
        draw = ImageDraw.Draw(sheet)
        with Image.open(folder / backend / "walk.webp") as animation:
            for i in range(6):
                animation.seek(round(i * (animation.n_frames - 1) / 5))
                cell = ImageOps.contain(animation.convert("RGB"), (320, 300))
                x, y = (i % 3) * 320, (i // 3) * 320
                sheet.paste(cell, (x + (320 - cell.width) // 2, y + 18))
                draw.text(
                    (x + 5, y + 3),
                    f"{backend} walk frame {animation.tell() + 1}",
                    fill="black",
                )
        motion = dest / f"{backend}-motion.png"
        sheet.save(motion)
        images.append(motion)
        if report.get("turn_guide"):
            images.append(folder / backend / "turns.webp")
    result, receipt = request_drawing(
        args,
        "Independently review the reference and each renderer's body and head turns, crouch, both grips and six walk frames. Inspect eye seating, pupils, neckline, proportions, hair, elbows, knees and item contact. Compare any separately drawn 35 and 90 degree head guides to their native turns. Reject visible errors. Infer plausible anatomy where the source ends. Return one boolean per criterion and explain each miss.",
        images,
        [operation],
        operation,
    )
    return record_decision(
        recipe,
        source,
        folder,
        {
            **result,
            "kind": "vision",
            "reviewer": receipt["reported_model"],
            "receipt": receipt,
            "evidence": digest(folder / "evidence.json"),
        },
    )
