"""Evaluate frozen full and portrait inputs without exposing withheld bodies during fitting."""

import argparse
import json
from pathlib import Path

from avatar_authoring.family_review import compare_images
from avatar_authoring.one_image import author_one, save
from avatar_authoring.release import digest


def benchmark(args):
    manifest = json.loads(args.manifest.read_text())
    cases = manifest["cases"]
    if len({c["id"] for c in cases}) != len(cases):
        raise ValueError("Duplicate holdout ID")
    args.output.mkdir(parents=True, exist_ok=True)
    summary = {"manifest_sha256": digest(args.manifest), "cases": {}}
    for case in cases:
        key = case["id"]
        if (args.case and key != args.case) or (
            args.family and args.family != case["family"]
        ):
            continue
        source = args.manifest.parent / case["input"]
        if digest(source) != case["input_sha256"]:
            raise ValueError(f"{key} input differs from the frozen drawing")
        folder, report = author_one(
            source,
            args.output / key,
            case["family"],
            case["framing"],
            case["name"],
            args,
        )
        # The complete drawing becomes available only after the last allowed correction.
        reference = args.manifest.parent / case["evaluation_reference"]
        if digest(reference) != case["reference_sha256"]:
            raise ValueError(f"{key} evaluation reference has changed")
        result = {
            "study": str(folder.relative_to(args.output)),
            "transport": report["transport"],
            "seconds": report["seconds"],
            "model_calls": report["calls"],
            "passes": [p["accepted"] for p in report["passes"]],
            "visible_checks_passed": report["accepted"],
            "independent_review": "pending",
            "error": report.get("error"),
        }
        if report.get("candidate"):
            frame = (folder / report["candidate"]).parent / "front.png"
            result["candidate_sha256"] = digest(folder / report["candidate"])
            all_visible = compare_images(reference, frame)
            result["full_body_silhouette_iou"] = all_visible["silhouette_iou"]
            result["full_body_rgb_mae"] = all_visible["rgb_mae"]
        summary["cases"][key] = result
        save(args.output / "holdout.json", summary)
        print(
            key,
            result["passes"],
            result.get("full_body_silhouette_iou"),
            result["error"],
            flush=True,
        )
    return summary


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path)
    parser.add_argument(
        "--manifest",
        type=Path,
        default=Path(__file__).parent
        / "avatar_authoring/targets/holdout-v1/manifest.json",
    )
    parser.add_argument("--case")
    parser.add_argument("--family", choices=["rick-classic", "sunshine"])
    provider = parser.add_mutually_exclusive_group()
    provider.add_argument("--adapter")
    provider.add_argument("--endpoint")
    provider.add_argument("--openrouter", action="store_true")
    parser.add_argument(
        "--feature-model", help="Strong model for an unregistered native feature"
    )
    parser.add_argument(
        "--feature-library",
        type=Path,
        default=Path(__file__).parent / "avatar_authoring/features",
        help="Reviewed native part definitions",
    )
    parser.add_argument("--model", default="gpt-6.2-astra")
    parser.add_argument("--base", default="http://localhost:13000")
    parser.add_argument("--renderer", choices=["webgl", "auto"], default="webgl")
    parser.add_argument("--max-triangles", type=int, default=4000)
    opts = parser.parse_args()
    report = benchmark(opts)
    raise SystemExit(
        0
        if report["cases"]
        and all(c["visible_checks_passed"] for c in report["cases"].values())
        else 1
    )
