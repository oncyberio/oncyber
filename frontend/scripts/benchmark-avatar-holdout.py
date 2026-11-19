"""Evaluate frozen full and portrait inputs without exposing withheld bodies during fitting."""

import argparse
from hashlib import sha256
import json
from pathlib import Path

from avatar_authoring.family_review import compare_images
from avatar_authoring.one_image import author_one, save
from avatar_authoring.release import digest


def manifest_digest(manifest):
    # Hash benchmark content independently of editor formatting.
    return sha256(
        json.dumps(manifest, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()


def comparison_sheet(summary, manifest, root, output):
    from PIL import Image, ImageDraw, ImageFont
    from avatar_authoring.family_sheet import view_tile

    cases = [c for c in manifest["cases"] if c["id"] in summary["cases"]]
    if not cases:
        return
    cols = min(4, len(cases))
    sheet = Image.new(
        "RGB", (cols * 400, 60 + ((len(cases) + cols - 1) // cols) * 274), "#f5f2eb"
    )
    pen = ImageDraw.Draw(sheet)
    font = ImageFont.truetype("DejaVuSans.ttf", 18)
    pen.text((10, 12), "Reference and native render", font=font, fill="#282522")
    for i, c in enumerate(cases):
        row = summary["cases"][c["id"]]
        folder = output / row["study"]
        study = json.loads((folder / "study.json").read_bytes())
        x, y = (i % cols) * 400, (i // cols) * 274 + 53
        pen.text(
            (x + 6, y),
            c["name"] + " · " + c["framing"] + " input",
            fill="#282522",
            font=font,
        )
        paths = [root / c["evaluation_reference"]]
        if study.get("candidate"):
            paths.append((folder / study["candidate"]).parent / "front.png")
        tiles = [view_tile(p, (1200, 1200)) for p in paths]
        height = min(236, int(192 / max(im.width / im.height for im in tiles)))
        for j, im in enumerate(tiles):
            width = max(1, round(height * im.width / im.height))
            im = im.resize((width, height), Image.Resampling.LANCZOS)
            sheet.paste(
                im, (x + j * 198 + (198 - width) // 2, y + 26 + (236 - height) // 2)
            )
    sheet.save(output / "comparison.webp", quality=94)


def benchmark(args):
    manifest = json.loads(args.manifest.read_text())
    cases = manifest["cases"]
    if len({c["id"] for c in cases}) != len(cases):
        raise ValueError("Duplicate holdout ID")
    args.output.mkdir(parents=True, exist_ok=True)
    summary = {"manifest_sha256": manifest_digest(manifest), "cases": {}}
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
            "auto",
            "auto",
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
            "selected_pass": report.get("selected_pass"),
            "reported_provider_cost": report.get("reported_provider_cost"),
            "passes": [p["accepted"] for p in report["passes"]],
            "routed_family": report["family"],
            "routed_framing": report["framing"],
            "visible_checks_passed": report["accepted"]
            and (report["family"], report["framing"])
            == (case["family"], case["framing"]),
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
    comparison_sheet(summary, manifest, args.manifest.parent, args.output)
    return summary


def export_candidates(output, manifest, destination):
    """Copy the exact measured recipes for a preview without installing them in the catalogue."""
    report = json.loads((output / "holdout.json").read_bytes())
    if manifest_digest(manifest) != report["manifest_sha256"]:
        raise ValueError("The replay belongs to a different benchmark")
    archive = {}
    for case in manifest["cases"]:
        key = case["id"]
        row = report["cases"][key]
        folder = output / row["study"]
        study = json.loads((folder / "study.json").read_bytes())
        candidate = folder / study["candidate"]
        if (
            study["source_sha256"] != case["input_sha256"]
            or digest(candidate) != row["candidate_sha256"]
        ):
            raise ValueError(f"{key} differs from the measured candidate")
        archive[key] = candidate.read_bytes()
    destination.mkdir(exist_ok=True, parents=True)
    for key, contents in archive.items():
        (destination / (key + ".recipe")).write_bytes(contents)


def score_reviews(args):
    """Read independent release decisions on frozen candidates without invoking an author."""
    from avatar_authoring.release import check_evidence, require_release

    manifest = json.loads(args.manifest.read_bytes())
    summary_path = args.output / "holdout.json"
    summary = json.loads(summary_path.read_bytes())
    legacy_digest = sha256((json.dumps(manifest, indent=2) + "\n").encode()).hexdigest()
    if summary["manifest_sha256"] not in {
        manifest_digest(manifest),
        digest(args.manifest),
        legacy_digest,
    }:
        raise ValueError("The holdout manifest changed")
    result = {
        "total": len(manifest["cases"]),
        "first_pass": 0,
        "within_one_correction": 0,
        "cases": {},
    }
    for case in manifest["cases"]:
        row = summary["cases"].get(case["id"])
        decisions = []
        if row:
            folder = args.output / row["study"]
            study = json.loads((folder / "study.json").read_bytes())
            if study["source_sha256"] != case["input_sha256"]:
                raise ValueError("Study belongs to another source")
            for attempt in study["passes"]:
                directory = folder / attempt["directory"]
                state = "failed visible checks"
                if attempt["accepted"] and (study["family"], study["framing"]) == (
                    case["family"],
                    case["framing"],
                ):
                    state = "awaiting native full-body evidence"
                    approval = directory / "approval"
                    if (approval / "evidence.json").is_file():
                        try:
                            candidate = directory / "candidate.json"
                            reviewed = (approval / "visual-review.json").is_file()
                            evidence = (
                                require_release if reviewed else check_evidence
                            )(candidate, approval)
                            if (
                                evidence["reference"] != case["reference_sha256"]
                                or evidence["framing"] != "full"
                            ):
                                raise ValueError(
                                    "Benchmark review must use the withheld full drawing"
                                )
                            state = (
                                "passed" if reviewed else "awaiting independent review"
                            )
                        except (KeyError, ValueError, OSError) as exc:
                            state = f"failed review: {exc}"
                decisions.append(state)
        result["cases"][case["id"]] = decisions
        result["first_pass"] += int(bool(decisions) and decisions[0] == "passed")
        result["within_one_correction"] += int("passed" in decisions[:2])
    save(args.output / "reviewed-scores.json", result)
    print(json.dumps(result, indent=2))
    return result


def record_preview(args):
    """Record the exact exported, rendered study bytes alongside the frozen inputs."""
    root = args.manifest.parent
    manifest = json.loads(args.manifest.read_bytes())
    summary = json.loads((args.output / "holdout.json").read_bytes())
    if summary["manifest_sha256"] != manifest_digest(manifest):
        raise ValueError("The replay belongs to a different benchmark")
    scores = score_reviews(args)
    archive = json.loads((root / "results.json").read_bytes())
    rows, hashes, seeds = {}, {}, []
    for case in manifest["cases"]:
        key = case["id"]
        row = summary["cases"][key]
        folder = args.output / row["study"]
        study = json.loads((folder / "study.json").read_bytes())
        selected = study["passes"][row["selected_pass"] - 1]
        candidate = root / "candidates" / (key + ".recipe")
        sha = digest(candidate)
        if sha != row["candidate_sha256"] or sha != digest(folder / study["candidate"]):
            raise ValueError(f"{key} preview differs from the native study")
        hashes[key] = sha
        seeds.append(candidate.read_bytes())
        data = {
            k: v for k, v in row.items() if k not in ("study", "independent_review")
        }
        data.update(
            triangles=selected["native"]["triangles"],
            release_checks=scores["cases"][key],
        )
        if "visible_portrait" in selected:
            data["visible_portrait"] = selected["visible_portrait"]
        if selected["accepted"]:
            evidence = folder / selected["directory"] / "approval/evidence.json"
            report = json.loads(evidence.read_bytes())
            if (
                report["reference"] != case["reference_sha256"]
                or report["recipe"] != sha
            ):
                raise ValueError(
                    f"{key} release evidence differs from the selected recipe"
                )
            data["evidence_sha256"] = digest(evidence)
            data["native_release"] = {
                mode: {
                    "source_silhouette_iou": v["reference_metrics"]["silhouette_iou"],
                    **{
                        f: v["native"][f]
                        for f in (
                            "triangles",
                            "moving_steps",
                            "hand",
                            "crouch_height_ratio",
                        )
                    },
                }
                for mode, v in report["backends"].items()
            }
        rows[key] = data
    seed_digest = sha256(b"\n".join(seeds)).hexdigest()
    crowd = json.loads(args.crowd_evidence.read_bytes())
    if set(crowd) != {"WebGPUBackend", "WebGLBackend"} or any(
        v.get("seedDigest") != seed_digest
        or v["calls"] != "1"
        or v["shadowCalls"] != "1"
        or min(
            v["uniqueRecipesLoaded"], v["occupiedColorCells"], v["occupiedShadowCells"]
        )
        != 100
        for v in crowd.values()
    ):
        raise ValueError(
            "Crowd evidence must cover these exact eight seeds on both backends"
        )
    obj = json.loads((args.benchmarks / "obj/rick-obj-metrics.json").read_bytes())
    views = obj["views"].values()
    transports = sorted({row["transport"] for row in rows.values()})
    costs = [row["reported_provider_cost"] for row in rows.values()]
    archive["runs"][args.record_preview] = {
        "transport": transports[0] if len(transports) == 1 else transports,
        "model_calls": sum(len(r["model_calls"]) for r in rows.values()),
        "reported_provider_cost": sum(costs)
        if all(isinstance(c, (int, float)) for c in costs)
        else None,
        "cases": rows,
        "independent_first_pass": scores["first_pass"],
        "independent_within_one_correction": scores["within_one_correction"],
        "crowd": {
            "base_recipes": list(rows),
            "variants": 100,
            "route": "/preview/crowd?shadows=1",
            "backends": crowd,
        },
        "benchmarks": {
            "rick_source_triangles": obj["source_triangles"],
            "rick_views": len(views),
            "minimum_rick_silhouette_iou": min(v["silhouette_iou"] for v in views),
            "maximum_rick_layer_intrusion_pixels": max(
                max(v["layer_intrusion_pixels"].values()) for v in views
            ),
            "sunshine": json.loads((args.benchmarks / "sunshine.json").read_bytes()),
        },
    }
    archive["preview"] = {"run": args.record_preview, "candidate_sha256": hashes}
    archive["independent_approvals"] = scores["within_one_correction"]
    path = root / "results.json"
    temp = path.with_suffix(".json.tmp")
    temp.write_text(json.dumps(archive, indent=4, allow_nan=False) + "\n")
    temp.replace(path)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path)
    parser.add_argument(
        "--manifest",
        type=Path,
        default=Path(__file__).parent
        / "avatar_authoring/targets/holdout-v1/manifest.json",
    )
    parser.add_argument(
        "--score-reviews",
        action="store_true",
        help="Score both attempts against saved native release decisions",
    )
    parser.add_argument("--case")
    parser.add_argument(
        "--export-candidates",
        type=Path,
        help="Export the selected recipe bytes from a completed replay for branch review",
    )
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
    parser.add_argument(
        "--record-preview",
        metavar="RUN",
        help="Record retested preview candidates and both rendering passes",
    )
    parser.add_argument(
        "--crowd-evidence",
        type=Path,
        help="Report from verify-cartoon-crowd.py --preview --shadows",
    )
    parser.add_argument(
        "--benchmarks",
        type=Path,
        help="Matched Rick OBJ and Sunshine VRM reference comparisons",
    )
    opts = parser.parse_args()
    if opts.record_preview:
        if not opts.crowd_evidence or not opts.benchmarks:
            parser.error("--record-preview needs --crowd-evidence and --benchmarks")
        record_preview(opts)
        raise SystemExit(0)
    if opts.export_candidates:
        export_candidates(
            opts.output, json.loads(opts.manifest.read_bytes()), opts.export_candidates
        )
        raise SystemExit(0)
    if opts.score_reviews:
        import math

        scores = score_reviews(opts)
        raise SystemExit(
            0
            if scores["total"] > 0
            and scores["first_pass"] >= math.ceil(0.875 * scores["total"])
            and scores["within_one_correction"] == scores["total"]
            else 1
        )
    report = benchmark(opts)
    raise SystemExit(
        0
        if report["cases"]
        and all(c["visible_checks_passed"] for c in report["cases"].values())
        else 1
    )
