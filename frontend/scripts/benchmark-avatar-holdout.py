"""Evaluate frozen full and portrait inputs without exposing withheld bodies during fitting."""

import argparse
import json
from hashlib import sha256
from pathlib import Path

import numpy as np

from avatar_authoring.family_review import compare_images
from avatar_authoring.fit import pixels
from avatar_authoring.household_front import trouser_opening
from avatar_authoring.kit_footwear import compare_footwear
from avatar_authoring.inked_hand import compare_hand_contours
from avatar_authoring.jersey_sleeve import jersey_sleeve
from avatar_authoring.sun_rays import kit_landmarks, measure_sun_rays, shorts_cut
from avatar_authoring.visor import measure_visor, visor_seed
from avatar_authoring.one_image import author_one, save
from avatar_authoring.release import digest, verified_captures
from avatar_authoring.paper_control import crown_paper_control


def manifest_digest(manifest):
    # Hash benchmark content independently of editor formatting.
    return sha256(
        json.dumps(manifest, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()


def comparison_sheet(summary, manifest, root, output):
    from avatar_authoring.family_sheet import view_tile
    from PIL import Image, ImageDraw, ImageFont

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
        if report.get("native_render_retries"):
            result["native_render_retries"] = report["native_render_retries"]
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


def visible_shorts(path):
    rgb, mask = pixels(path, keep_components=True)
    cut = shorts_cut(rgb, mask, kit_landmarks(rgb, mask))
    if cut is not None:
        return {
            "rise": round(float(cut[0]), 4),
            "hem_to_waist": round(float(cut[1]), 4),
        }


def orb_meridian_luma_step(path):
    """Largest adjacent luma step near the frontal meridian on visible bare skin."""
    rgb, mask = pixels(path, keep_components=True)
    seed = visor_seed(rgb, mask)
    if not seed:
        return None
    center, radius = seed
    orb = measure_sun_rays(rgb, mask, center, [radius, radius], orb_only=True)
    if orb is None:
        return None
    x, y, rx, ry = orb
    columns = np.arange(round(x - 0.18 * rx), round(x + 0.18 * rx) + 1)
    if len(columns) < 2 or columns[0] < 0 or columns[-1] >= mask.shape[1]:
        return None
    steps = []
    # Sample exposed forehead and chin, avoiding the lens and its contact edge.
    for fraction in (-0.7, -0.6, -0.5, 0.53, 0.63, 0.73):
        row = round(y + fraction * ry)
        if row < 1 or row + 1 >= mask.shape[0]:
            return None
        luma = rgb[row - 1 : row + 2, columns].mean(axis=0) @ [0.2126, 0.7152, 0.0722]
        steps.append(float(np.abs(np.diff(luma)).max()))
    return round(max(steps), 2)


def compare_ray_paint(reference, native):
    """Compare painted rays on a shared orb frame, excluding the jersey and collar."""
    v, u = np.mgrid[-1.93:1.52:196j, -2.08:2.08:236j]
    r = np.hypot(u, v)
    sector = (r > 1.055) & (r < 2.02) & ((v < 0.92) | ((abs(u) > 0.47) & (v < 1.37)))
    lower = sector & (v > 0.96) & (abs(u) < 0.93)
    samples = []
    for path in (reference, native):
        rgb, mask = pixels(path, keep_components=True)
        seed = visor_seed(rgb, mask)
        if not seed:
            return None
        center, radius = seed
        orb = measure_sun_rays(rgb, mask, center, [radius, radius], orb_only=True)
        if orb is None:
            return None
        ox, oy, rx, ry = orb
        cols = np.rint(ox + rx * u).astype(int).clip(0, mask.shape[1] - 1)
        rows = np.rint(oy + ry * v).astype(int).clip(0, mask.shape[0] - 1)
        samples.append(rgb[rows, cols])
    source = samples[0]
    ink = (np.ptp(source, axis=2) > 65) & sector & (v < -0.1)
    if ink.sum() < 100:
        return None
    # The separated upper rays provide the measured ink. Ignore lightness so
    # a soft shaded edge can count. Native colors must match the source hue.
    pigment = np.median(source[ink], axis=0)
    hue = pigment - pigment.mean()

    def painted(rgb):
        tint = rgb - rgb.mean(2, keepdims=True)
        length = np.linalg.norm(tint, axis=2)
        return (length > 0.35 * np.linalg.norm(hue)) & (
            tint @ hue > 0.92 * length * np.linalg.norm(hue)
        )

    a, b = map(painted, samples)

    def agreement(area):
        return round(float((a & b & area).sum() / max(1, ((a | b) & area).sum())), 4)

    return {"iou": agreement(sector), "lower_iou": agreement(lower)}


def visor_shadow_luma(path):
    """Sample the photographed edge and neighboring exposed cheek independently."""
    rgb, mask = pixels(path, keep_components=True)
    seed = visor_seed(rgb, mask)
    if not seed:
        return None
    center, radius = seed
    orb = measure_sun_rays(rgb, mask, center, [radius, radius], orb_only=True)
    visor = measure_visor(rgb, mask, orb)
    if not visor:
        return None
    ux = np.array([-0.63, -0.42, -0.22, -0.10, 0, 0.10, 0.22, 0.42, 0.63])
    knots = visor["center"] + visor["span"] * np.linspace(-1, 1, len(visor["rows"]))
    hem = np.interp(ux, knots, np.array(visor["rows"])[:, 1])
    ox, oy, rx, ry = orb
    x = np.rint(ox + ux * rx).astype(int)
    y = np.rint(oy + (hem + np.array([[0.04], [0.18]])) * ry).astype(int)
    if (
        x.min() < 0
        or x.max() >= mask.shape[1]
        or y.min() < 0
        or y.max() >= mask.shape[0]
    ):
        return None
    exposed = mask[y, x].all(axis=0)
    if exposed.sum() < 5:
        return None
    edge, cheek = np.median(rgb[y, x][:, exposed] @ [0.2126, 0.7152, 0.0722], axis=1)
    return {"edge": round(float(edge), 1), "cheek": round(float(cheek), 1)}


def compare_jersey_sleeves(reference, native):
    """Compare both sleeves in units of standing height relative to the arm axis."""
    images = [pixels(path, keep_components=True) for path in (reference, native)]
    kits = [kit_landmarks(*frame) for frame in images]
    cut = jersey_sleeve(*images[0], kits[0])
    if cut is None or kits[1] is None:
        return None
    reach = cut["reach"]
    y, u = np.mgrid[-0.40:0.40:96j, 0.52:1.16:128j]
    masks, colors = [], []
    for (rgb, mask), kit in zip(images, kits):
        ys, xs = np.nonzero(mask)
        height = np.ptp(ys)
        arm = ys.min() + kit[1] * height
        mid = (xs.max() + xs.min()) / 2
        rows = np.rint(arm + y * reach * height).astype(int)
        cols = np.rint(mid + np.stack([-u, u]) * reach * height).astype(int)
        if (
            rows.min() < 0
            or cols.min() < 0
            or rows.max() >= mask.shape[0]
            or cols.max() >= mask.shape[1]
        ):
            return None
        masks.append(mask[rows, cols])
        colors.append(rgb[rows, cols])
    a, b = masks
    metrics = {
        "silhouette_iou": round(
            np.count_nonzero(a & b) / max(1, np.count_nonzero(a | b)), 4
        )
    }
    top, bottom = cut["rows"][-1]
    v = (2 * y - top - bottom) / (bottom - top)
    t = u + cut["tilt"] * v
    bands = np.zeros_like(u, dtype=bool)
    # Sample away from the ink boundary, on both sleeves at their source positions.
    for band in cut["bands"]:
        margin = min(0.012, 0.2 * (band["end"] - band["start"]))
        bands |= (
            (t > band["start"] + margin) & (t < band["end"] - margin) & (abs(v) < 0.55)
        )
    if bands.any():
        metrics["cuff_rgb_mae"] = round(
            float(abs(colors[0] - colors[1])[:, bands].mean()), 2
        )
    return metrics


def visible_trouser_opening(path):
    """Locate the fork on a rendered T-pose independently of the authored pattern."""
    rgb, mask = pixels(path, keep_components=True)
    ys = np.nonzero(mask)[0]
    top, height = ys.min(), float(np.ptp(ys))
    if height < 10:
        return None
    floor = round(top + height * 0.72)
    span = np.flatnonzero(mask[floor])
    if len(span) < 4:
        return None
    center = round((span[0] + span[-1]) / 2)
    samples = [round(center + side * 0.28 * np.ptp(span)) for side in (-1, 1)]
    dye = np.median(rgb[floor, samples], axis=0)
    paper = np.median(np.vstack((rgb[0], rgb[-1])), axis=0)
    if np.linalg.norm(paper - dye) < 60:
        return None
    opening = trouser_opening(
        rgb, mask, center, round(top + height * 0.43), floor, 608 / height, paper, dye
    )
    if opening is not None:
        return round((opening - top) / height, 4)


def export_review_views(folder, destination, key, report):
    """Offer the captured turns and motion on demand, bound to the archived evidence."""
    from shutil import copyfile
    from PIL import Image, ImageDraw, ImageFont
    from avatar_authoring.family_sheet import view_tile

    destination.mkdir(parents=True, exist_ok=True)
    font = ImageFont.truetype("DejaVuSans.ttf", 17)
    assets = {}
    for backend, capture in report["backends"].items():
        source = folder / backend
        prefix = destination / (key + "-" + backend)
        sheet = Image.new("RGB", (1440, 926), "#eee9e1")
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
        still = prefix.with_name(prefix.name + "-views.webp")
        motion = prefix.with_name(prefix.name + "-walk.webp")
        sheet.save(still, "WEBP", quality=92, method=6)
        copyfile(source / "walk.webp", motion)
        assets[backend] = {
            "views": digest(still),
            "walk": capture["views"]["walk.webp"],
        }
    return assets


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
        if "front" in selected:
            data["front_checks"] = [
                {
                    field: attempt["front"][field]
                    for field in (
                        "silhouette_iou",
                        "head_iou",
                        "head_edge_agreement",
                        "body_edge_agreement",
                        "rgb_mae",
                        "eye_pigment_agreement",
                        "shirt_mark_agreement",
                    )
                    if field in attempt["front"]
                }
                for attempt in study["passes"]
                if "front" in attempt
            ]
        evidence = folder / selected["directory"] / "approval/evidence.json"
        reference = root / case["evaluation_reference"]
        report = verified_captures(candidate, evidence.parent)
        if (
            report["reference"] != case["reference_sha256"]
            or digest(reference) != case["reference_sha256"]
            or report["framing"] != "full"
        ):
            raise ValueError(
                f"{key} native evidence and frozen full-body reference differ"
            )
        data["evidence_sha256"] = digest(evidence)
        data["review_assets"] = export_review_views(
            evidence.parent, root / "reviews", key, report
        )
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
        recipe = json.loads(candidate.read_bytes())
        design = recipe.get("design", {})
        if (
            design.get("household", {})
            .get("body", {})
            .get("sections", {})
            .get("palmContours")
        ):
            data["inked_hands"] = {
                mode: compare_hand_contours(
                    reference, evidence.parent / mode / "front.png", design
                )
                for mode in report["backends"]
            }
        if "visor" in recipe:
            data["orb_meridian_luma_step"] = {
                "reference": orb_meridian_luma_step(reference),
                **{
                    mode: orb_meridian_luma_step(evidence.parent / mode / "front.png")
                    for mode in report["backends"]
                },
            }
        if "sunRays" in recipe and case["framing"] == "full":
            data["crown_paper_control"] = {
                mode: crown_paper_control(reference, evidence.parent / mode / "front.png")
                for mode in report["backends"]
            }
            data["ray_paint"] = {
                mode: compare_ray_paint(reference, evidence.parent / mode / "front.png")
                for mode in report["backends"]
            }
        if recipe.get("visor", {}).get("contact"):
            data["visor_shadow_luma"] = {
                "reference": visor_shadow_luma(reference),
                **{
                    mode: visor_shadow_luma(evidence.parent / mode / "front.png")
                    for mode in report["backends"]
                },
            }
        if "jerseySleeve" in recipe:
            data["jersey_sleeves"] = {
                mode: compare_jersey_sleeves(
                    reference, evidence.parent / mode / "front.png"
                )
                for mode in report["backends"]
            }
        if "kitFootwear" in recipe:
            data["kit_footwear"] = {
                mode: compare_footwear(reference, evidence.parent / mode / "front.png")
                for mode in report["backends"]
            }
        if "shortsCut" in recipe:
            data["visible_shorts"] = {
                "reference": visible_shorts(reference),
                **{
                    mode: visible_shorts(evidence.parent / mode / "front.png")
                    for mode in report["backends"]
                },
            }
        if case["family"] == "rick-classic" and case["framing"] == "full":
            data["trouser_opening_height_fraction"] = {
                "reference": visible_trouser_opening(reference),
                **{
                    mode: visible_trouser_opening(evidence.parent / mode / "front.png")
                    for mode in report["backends"]
                },
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
    parser.add_argument(
        "--model", help="Vision model for the initial observation and one correction"
    )
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
