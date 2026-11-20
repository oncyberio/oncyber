"""Bind a promotion decision to the exact candidate, reference and native evidence."""

import hashlib
import json
from pathlib import Path

from .family_review import compare_images, eyes_match, native_front
from .sun_rays import collar_closed
from .one_image import portrait_metrics
from .review import render

CHECKS = ("likeness", "profile", "eyes", "garments", "body", "motion", "grip")
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
        )
    if framing == "full":
        return (
            score["silhouette_iou"] >= 0.90
            and score["head_iou"] >= 0.86
            and score["head_edge_agreement"] >= 0.68
            and score["body_edge_agreement"] >= 0.65
            and ("eye_pigment_agreement" not in score or eyes_match(score))
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
            if measured:
                return measured
    if data.get("construction") == "household":
        from .household_front import fit_front

        _, registration = fit_front(source, "Reference measurement")
    else:
        from .family import fit_family

        _, metrics, _ = fit_family(
            source, family, custom_jersey=data.get("plainJersey", False)
        )
        registration = metrics[family]
    return registration


def evidence(recipe, source, folder, base, budget, framing="full", yaw=0):
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
            "views": {v: digest(dest / v) for v in VIEWS},
        }
    (folder / "evidence.json").write_text(json.dumps(result, indent=2) + "\n")
    return result


def verified_captures(recipe, folder):
    """Verify exact native evidence, including captures of candidates that missed."""
    report = json.loads((folder / "evidence.json").read_text())
    if report["recipe"] != digest(recipe):
        raise ValueError("The recipe changed after the native review")
    if set(report["backends"]) != {"WebGPUBackend", "WebGLBackend"}:
        raise ValueError("Both native backends must be reviewed")
    for backend, item in report["backends"].items():
        if item["native"]["backend"] != backend:
            raise ValueError(f"Unexpected renderer for {backend}")
        if set(item["views"]) != set(VIEWS) or any(
            digest(folder / backend / name) != item["views"][name] for name in VIEWS
        ):
            raise ValueError(f"Review frames changed for {backend}")
    return report


def check_evidence(recipe, folder):
    report = verified_captures(recipe, folder)
    for backend, item in report["backends"].items():
        native = item["native"]
        if not reference_passes(report["framing"], item["reference_metrics"]):
            raise ValueError(f"Native reference comparison failed on {backend}")
        if not (
            0 < native["triangles"] <= report["triangle_budget"]
            and native["moving_steps"] >= 9
            and native["hand"] == "right"
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
    # OpenRouter receives static images. Give the reviewer sampled walk
    # frames and the actual held item instead of only the first WebP frame.
    views = folder / "WebGLBackend"
    sheet = Image.new("RGB", (960, 640), "#ebe5db")
    draw = ImageDraw.Draw(sheet)
    with Image.open(views / "walk.webp") as animation:
        for i in range(6):
            animation.seek(round(i * (animation.n_frames - 1) / 5))
            cell = ImageOps.contain(animation.convert("RGB"), (320, 300))
            x, y = (i % 3) * 320, (i // 3) * 320
            sheet.paste(cell, (x + (320 - cell.width) // 2, y + 18))
            draw.text(
                (x + 5, y + 3), f"Walk frame {animation.tell() + 1}", fill="black"
            )
    motion = folder / "review-motion.png"
    sheet.save(motion)
    result, receipt = request_drawing(
        args,
        "Independently review the reference, native full body, head turnaround, back, crouch with prop and six walk frames. Inspect eye seating and pupils at both side views, the neckline, proportions, hair, elbows, knees and hand contact. Reject visible errors. Infer plausible anatomy where the source ends. Return one boolean per listed criterion and explain each failed criterion.",
        [
            source,
            views / "front.png",
            views / "turnaround.png",
            views / "back.png",
            views / "crouch.png",
            motion,
        ],
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
