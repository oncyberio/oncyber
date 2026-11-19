"""Draw a local Oncyber avatar recipe from a single front T-pose."""

import argparse
import json
import shutil
import subprocess
from pathlib import Path

from avatar_authoring.family import FAMILIES, FAMILY_TOOL
from avatar_authoring.family_edits import REVISION_TOOL
from avatar_authoring.install import install
from avatar_authoring.observation import (
    draft_edits,
    draft_instructions,
    instructions,
    observations,
)
from avatar_authoring.provider import (
    DrawingOnlyAdapter,
    ask,
    openrouter_model,
    review_family,
)
from avatar_authoring.study import Study, write


def calibrate_turns(study, directory):
    """Search existing recipe controls locally, retaining the best qualifying native draw."""
    design = json.loads((directory / "recipe.json").read_text())["design"]
    sections = design.get("fit", {}).get("sections", {})
    controls = []
    if sections.get("sidePart") and sections.get("sideGuide"):
        controls.append(("fringeDepthScale", 0.75, 1.2, 0.12))
    if sections.get("eyes") and sections.get("sideGuide", {}).get("eyeRows"):
        controls.append(("eyeDepthScale", 0.7, 1.4, 0.11))
    for field, low, high, step in controls:
        selected = study.summary.get("selected")
        source = study.run / selected if selected else directory
        initial = json.loads((source / "observations.json").read_text())
        value = initial.get("details", {}).get(field, 1.0)

        def measure(trial, initial=initial, field=field, source=source):
            edited = {
                **initial,
                "details": {**initial.get("details", {}), field: trial},
            }
            receipt = {
                "transport": "native-turn-calibration",
                "from_pass": source.name,
                "control": field,
                "value": trial,
            }
            try:
                study.draw(edited, receipt)
            except (ValueError, RuntimeError):
                # draw records the failed validation or native render. An
                # earlier qualifying recipe is still available for selection.
                return None
            return study.summary["attempts"][-1]

        candidates = {
            max(low, round(value - step, 3)),
            min(high, round(value + step, 3)),
        }
        neighbors = [
            record
            for trial in sorted(candidates - {value})
            if (record := measure(trial))
        ]
        if neighbors:
            # Interpolate toward the stronger neighbor. The final native
            # acceptance checks apply even when both coarse steps failed.
            neighbor = max(
                neighbors, key=lambda r: (r["qualifies"], r["weakest_turn"], r["score"])
            )
            midpoint = round((neighbor["value"] + value) * 0.5, 3)
            if midpoint not in candidates and midpoint != value:
                measure(midpoint)


def author(args):
    local = args.observations or args.auto
    study = Study(args, None if local else args.model)
    print(study.run, flush=True)
    within = getattr(args, "within_family", None)
    catalog_checked = False

    def resolve_model():
        nonlocal catalog_checked
        if not args.openrouter or catalog_checked:
            return
        try:
            args.model = openrouter_model(args.model)
            catalog_checked = True
        except (ValueError, OSError, RuntimeError, KeyError) as exc:
            study.provider_error(exc)
            raise

    if not local and not any(
        (study.profile, study.opposite, study.quarter, study.skull_part)
    ):
        from avatar_authoring.family_review import fit_and_refine, revise_family
        from avatar_authoring.family_trials import family_rank

        directory, result, fit_receipt = fit_and_refine(
            study.source,
            study.run,
            within or "auto",
            args.name or study.default_name,
            study.base,
            study.backend,
            study.budget,
            revisions=args.rounds if within else 0,
            within=bool(within),
        )
        reviews = {
            "directory": directory.name,
            "front_checks_passed": result["accepted"],
            "resolved_family": result.get("family"),
            "fit_receipt": str(fit_receipt.relative_to(study.run)),
            "baseline_front": result.get("front"),
            "reviews": [],
        }
        study.summary["family_review"] = reviews
        feedback = ""
        for _ in range(args.rounds):
            if "native" not in result:
                break
            resolve_model()
            try:
                decision, receipt = review_family(
                    args,
                    study.source,
                    directory,
                    json.loads((directory / "candidate.json").read_text()),
                    result,
                    feedback,
                )
            except (DrawingOnlyAdapter, subprocess.CalledProcessError) as exc:
                if not args.adapter:
                    study.provider_error(exc)
                    raise
                reviews["review_unavailable"] = str(exc).splitlines()[0]
                break
            except (
                ValueError,
                OSError,
                RuntimeError,
                KeyError,
                subprocess.TimeoutExpired,
            ) as exc:
                study.provider_error(exc)
                raise
            entry = {"base": directory.name, **decision, "receipt": receipt}
            reviews["reviews"].append(entry)
            reviews.update(
                use_family=decision["use_family"],
                reason=decision["reason"],
                receipt=receipt,
            )
            if not decision["use_family"]:
                break
            if decision["edits"]:
                try:
                    trial, trial_result = revise_family(
                        study.source,
                        directory,
                        decision["edits"],
                        study.base,
                        study.backend,
                        study.budget,
                    )
                except ValueError as exc:
                    entry["validation_error"] = feedback = str(exc)
                    continue
                entry.update(
                    render=trial.name,
                    front_checks_passed=trial_result["accepted"],
                    trial_front=trial_result.get("front"),
                )
                # An edit can pass the absolute thresholds and still lose likeness
                # relative to the fit the reviewer was shown.
                if family_rank(trial_result) > family_rank(result):
                    directory, result = trial, trial_result
                    entry["selection"] = "model_edit"
                else:
                    entry["selection"] = "retained_base"
                    feedback = (
                        trial_result.get("reason")
                        or "The edit did not improve the native comparison."
                    )
                    if not result["accepted"]:
                        continue
            if result["accepted"]:
                shutil.copyfile(directory / "recipe.json", study.run / "recipe.json")
                study.summary["selected"] = directory.name
                study.save()
                print("Selected", study.run / "recipe.json", flush=True)
                if args.install:
                    print(
                        install(
                            study.run / "recipe.json",
                            args.install,
                            release=args.release,
                            previous=args.replace_digest,
                        )
                    )
                return
            feedback = result["reason"]
            if not decision["edits"]:
                break
        study.save()
        if within:
            raise ValueError(f"No approved {within} fit. See {study.run / 'run.json'}")
    draft = None if args.observations else study.prepare_draft(args.name)
    if args.auto and draft is None:
        raise ValueError(f"{study.summary['draft_unavailable']}. See {study.run}")
    feedback = ""
    measured_pass = None
    inputs = [study.source, study.guide]
    images = inputs
    views = (
        "comparison.png",
        "portrait-review.png",
        "turnaround.png",
        "side-comparison.png",
        "opposite-comparison.png",
        "quarter-comparison.png",
        "quarter-expression-review.png",
    )
    inputs += [study.profile] if study.profile else []
    if study.fit_quarter:
        inputs.append(study.quarter)
    if not local:
        preview = study.preview(draft)
        if preview:
            directory, stats = preview
            images = [
                *inputs,
                *(directory / view for view in views if (directory / view).is_file()),
            ]
            feedback = json.dumps(
                {
                    "pass": 0,
                    "metrics": stats,
                    "triangle_budget": study.budget,
                }
            )
        elif "preview_unavailable" in study.summary:
            feedback = json.dumps(
                {"preview_error": study.summary["preview_unavailable"]}
            )
    for _ in range(1 if local else args.rounds):
        if args.auto:
            obs, receipt = draft, {"transport": "image-measurements"}
        elif args.observations:
            obs = json.loads(args.observations.read_text())
            receipt = {"transport": "observation-replay"}
        else:
            try:
                resolve_model()
                obs, receipt = ask(args, images, feedback, draft, measured_pass)
            except (
                RuntimeError,
                ValueError,
                OSError,
                subprocess.SubprocessError,
                KeyError,
            ) as exc:
                study.provider_error(exc)
                if study.best is None:
                    raise
                break
        try:
            directory, stats = study.draw(obs, receipt, draft)
            obs = json.loads((directory / "observations.json").read_text())
        except ValueError as error:
            prior = json.loads(feedback) if feedback else {}
            prior.update(rejected_request=obs, validation_error=str(error))
            feedback = json.dumps(prior)
            continue
        except RuntimeError:
            if study.best is None:
                raise
            break
        attempt = study.summary["attempts"][-1]
        measured_pass = attempt["pass"]
        if attempt.get("rendered_from") and attempt["qualifies"]:
            break
        feedback = json.dumps(
            {
                "pass": measured_pass,
                "observations": obs,
                "metrics": stats,
                "triangle_budget": study.budget,
            }
        )
        images = [
            *inputs,
            *(directory / view for view in views if (directory / view).is_file()),
        ]
    if getattr(args, "calibrate_turns", False) and measured_pass is not None:
        calibrate_turns(study, study.run / f"pass-{measured_pass}")
    if study.best is None:
        raise ValueError(
            f"No candidate passed the drawing, gaze, hair coverage, profile and triangle checks. See {study.run}"
        )
    print("Selected", study.summary["selected"], study.run / "recipe.json", flush=True)
    if study.summary.get("needs_review") and study.summary.get("depth_review"):
        print(study.summary["depth_review"], flush=True)
    if args.install:
        print(
            install(
                study.run / "recipe.json",
                args.install,
                release=args.release,
                previous=args.replace_digest,
            )
        )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("image", type=Path)
    parser.add_argument("output", type=Path)
    group = parser.add_mutually_exclusive_group()
    group.add_argument(
        "--mcp",
        action="store_true",
        help="Serve the avatar drawing tools and reference over local MCP stdio",
    )
    group.add_argument(
        "--observations",
        type=Path,
        help="Replay a saved observation without a provider call",
    )
    group.add_argument(
        "--adapter",
        help="Executable that exchanges a JSON drawing request and response on stdin/stdout",
    )
    group.add_argument(
        "--endpoint", help="Full HTTPS URL for a Responses-compatible endpoint"
    )
    group.add_argument(
        "--openrouter",
        action="store_true",
        help="Use the OpenRouter model catalog and Responses API with OPENROUTER_API_KEY",
    )
    group.add_argument(
        "--auto",
        action="store_true",
        help="Draw a local first draft from the image alone",
    )
    group.add_argument(
        "--family",
        choices=["auto", *FAMILIES],
        help="Fit an existing 360-degree family and verify its native rendering from one picture",
    )
    parser.add_argument(
        "--within-family",
        choices=["auto", *FAMILIES],
        help="Stay within the native families. Use auto to choose the closest registered base from the T-pose.",
    )
    parser.add_argument(
        "--one-image",
        choices=["auto", "full", "portrait"],
        nargs="?",
        const="auto",
        help="Build from one image within a named family with at most one correction",
    )
    parser.add_argument("--name", help="Name of the proposed character")
    parser.add_argument(
        "--profile",
        type=Path,
        help="Optional matching side portrait, including the hair, chin and shirt neckline",
    )
    parser.add_argument(
        "--opposite-profile",
        type=Path,
        help="Optional opposite-facing side portrait for review of asymmetry and occlusion",
    )
    parser.add_argument(
        "--quarter",
        type=Path,
        help="Optional 35-degree right-facing portrait held out for native render review",
    )
    parser.add_argument(
        "--fit-quarter",
        action="store_true",
        help="Fit the bob, ear, closed smile and a separate gaze pose from the right-facing 35-degree drawing",
    )
    parser.add_argument(
        "--fit-opposite-temple",
        action="store_true",
        help="Fit the visible temple hairline using the opposite profile",
    )
    parser.add_argument(
        "--calibrate-turns",
        action="store_true",
        help="Render bounded local trials of fringe and eye depth against the supplied turn guides",
    )
    parser.add_argument(
        "--skull-part",
        type=Path,
        help="Register a fitted closed skull from fit-rounded-part.py; Z=0 is the neck plane",
    )
    parser.add_argument(
        "--release", type=Path, help="Directory produced by review-avatar-release.py"
    )
    parser.add_argument(
        "--replace-digest", help="SHA-256 of the installed recipe being replaced"
    )
    parser.add_argument(
        "--feature-model", help="Strong model for an unregistered native feature"
    )
    parser.add_argument(
        "--feature-library",
        type=Path,
        default=Path(__file__).parent / "avatar_authoring/features",
        help="Reviewed native part definitions",
    )
    parser.add_argument("--model", help="Model for authoring observations")
    parser.add_argument("--rounds", type=int, choices=[1, 2, 3], default=2)
    parser.add_argument("--max-triangles", type=int, default=4000)
    parser.add_argument(
        "--install",
        metavar="SLUG",
        help="Add the accepted recipe to this checkout for the native avatar loader",
    )
    parser.add_argument("--base", default="http://localhost:13000")
    parser.add_argument("--renderer", choices=["auto", "webgl"], default="auto")
    parser.add_argument(
        "--write-contract",
        type=Path,
        help="Also save the versioned draw_cartoon instructions and schema",
    )
    args = parser.parse_args()
    if not args.one_image and not args.model:
        args.model = "gpt-6.2-astra"
    if args.one_image:
        if any(
            (
                args.profile,
                args.opposite_profile,
                args.quarter,
                args.observations,
                args.mcp,
                args.skull_part,
                args.family,
            )
        ):
            parser.error("--one-image takes one reference and optional --within-family")
        from avatar_authoring.one_image import author_one

        directory, report = author_one(
            args.image,
            args.output,
            args.within_family,
            args.one_image,
            args.name or args.image.stem,
            args,
        )
        print(directory / "study.json")
        if report["accepted"] and args.install:
            print(
                install(
                    directory / "recipe.json",
                    args.install,
                    release=args.release,
                    previous=args.replace_digest,
                )
            )
        raise SystemExit(0 if report["accepted"] else 1)
    if args.within_family:
        if args.observations or any(
            (args.profile, args.opposite_profile, args.quarter, args.skull_part)
        ):
            parser.error("--within-family takes a single reference T-pose")
        if args.family and args.family not in ("auto", args.within_family):
            parser.error("Choose one native family for this study")
        if not any(
            (args.mcp, args.openrouter, args.endpoint, args.adapter, args.family)
        ):
            args.auto = True
    if args.calibrate_turns and not args.profile:
        parser.error("--calibrate-turns requires --profile")
    if args.fit_opposite_temple and not (args.opposite_profile and args.profile):
        parser.error("--fit-opposite-temple requires --opposite-profile and --profile")
    if args.fit_quarter and not (args.quarter and args.profile):
        parser.error("--fit-quarter requires --quarter and --profile")
    if args.write_contract:
        write(
            args.write_contract,
            {
                "name": "draw_cartoon",
                "instructions": instructions,
                "parameters": observations,
                "family_tool": {
                    "name": FAMILY_TOOL["name"],
                    "instructions": FAMILY_TOOL["description"],
                    "parameters": FAMILY_TOOL["inputSchema"],
                },
                "family_revision_tool": REVISION_TOOL,
                "revision_tool": {
                    "name": "draw_from_draft",
                    "instructions": draft_instructions,
                    "parameters": draft_edits,
                },
            },
        )
    if args.family and any(
        (args.profile, args.opposite_profile, args.quarter, args.skull_part)
    ):
        parser.error("The family fitter takes a single front T-pose")
    if args.family or (
        args.auto
        and not any(
            (args.profile, args.opposite_profile, args.quarter, args.skull_part)
        )
    ):
        from avatar_authoring.family_review import fit_and_refine

        run, result, receipt = fit_and_refine(
            args.image,
            args.output,
            args.within_family or args.family or "auto",
            args.name,
            args.base,
            args.renderer,
            args.max_triangles,
            revisions=args.rounds if args.auto else 0,
            within=bool(args.within_family),
        )
        print("Family comparison", receipt, flush=True)
        if result["accepted"]:
            print("Selected", run / "recipe.json", flush=True)
            if args.install:
                print(
                    install(
                        run / "recipe.json",
                        args.install,
                        release=args.release,
                        previous=args.replace_digest,
                    )
                )
            raise SystemExit(0)
        if args.family or args.within_family:
            raise SystemExit(result["reason"])
    if args.mcp:
        import asyncio

        from avatar_authoring.agent_tool import serve

        asyncio.run(serve(args))
    else:
        author(args)
