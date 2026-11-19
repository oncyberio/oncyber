"""Rebuild the illustrated family targets in Oncyber and save a comparable report."""

import argparse
import json
from pathlib import Path
from time import monotonic

from avatar_authoring.family_review import compare_images, fit_and_refine
from avatar_authoring.family_sheet import review_sheet

TARGETS = {
    "vesper": ("Vesper", "sunshine"),
    "citrine": ("Citrine", "sunshine"),
    "halo": ("Halo", "sunshine"),
    "lichen": ("Dr Lichen", "rick-classic"),
    "marlow": ("Dr Marlow", "rick-classic"),
}

if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("output", type=Path)
    p.add_argument("--family", choices=["sunshine", "rick-classic"])
    p.add_argument("--renderer", choices=["auto", "webgl"], default="webgl")
    p.add_argument("--base", default="http://localhost:13000")
    p.add_argument("--case", choices=TARGETS, help="Rebuild one named drawing")
    p.add_argument(
        "--prepare-target",
        metavar="BRIEF",
        help="Render the family model sheet and write a GPT Image tool request for a new variation",
    )
    args = p.parse_args()
    if args.prepare_target is not None:
        if not args.family or args.case or not args.prepare_target.strip():
            p.error("--prepare-target needs a family and a character brief")
        from avatar_authoring.target_brief import prepare_target

        print(
            prepare_target(
                args.family, args.prepare_target, args.output, args.base, args.renderer
            )
        )
        raise SystemExit(0)
    if args.case and args.family and TARGETS[args.case][1] != args.family:
        p.error("The chosen drawing belongs to a different family")
    targets = Path(__file__).parent / "avatar_authoring" / "targets"
    reports = {}
    for key, (name, family) in TARGETS.items():
        if (args.family and args.family != family) or (args.case and args.case != key):
            continue
        source = targets / (key + ".webp")
        start = monotonic()
        folder, result, receipt = fit_and_refine(
            source,
            args.output / key,
            family,
            name,
            args.base,
            args.renderer,
            4000,
            revisions=3,
            within=True,
        )
        reports[key] = {
            "family": family,
            "accepted": result["accepted"],
            "source_sha256": result["source_sha256"],
            "review": str(receipt),
            "best": str(folder),
            "front": result.get("front"),
            "native": result.get("native"),
            "profile": result.get("profile"),
            "failed_front_checks": result.get("failed_front_checks", []),
            "reason": result.get("reason"),
        }
        reports[key]["seconds"] = round(monotonic() - start, 2)
        profile = targets / (key + "-profile.webp")
        if profile.exists() and result.get("native"):
            measured = compare_images(
                profile,
                folder / "profile.png",
                result["candidates"][family]["head_fraction"],
            )
            reports[key]["held_out_generated_profile"] = {
                k: measured[k] for k in ("silhouette_iou", "head_iou", "rgb_mae")
            }
        print(key, "passed" if result["accepted"] else result["reason"], flush=True)
    (args.output / "benchmark.json").write_text(json.dumps(reports, indent=2) + "\n")
    review_sheet(reports, targets, args.output / "comparison.png")
    raise SystemExit(0 if all(r["accepted"] for r in reports.values()) else 1)
