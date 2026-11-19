"""Render, compare and retain the best drawing for a single reference."""

import hashlib
import json
import shutil
from copy import deepcopy
from pathlib import Path
from tempfile import TemporaryDirectory, mkdtemp

from jsonschema import Draft202012Validator, ValidationError
from playwright.sync_api import Error as BrowserError

from .draft import propose
from .fit import fit
from .guide import draw_guide
from .observation import draft_edits, fitted_observation, observations
from .profile import (
    compare_expressions, compare_profile, fit_profile, fit_quarter_hair, fringe_difference,
    forehead_gap, open_fringe_gap, opposite_outline_widths, profile_layers, quarter_pupils, registered_profile,
)
from .review import evaluate, render
from .rounded import register_cranium


def write(path, value):
    path.write_text(
        json.dumps(value, indent=2, ensure_ascii=False, allow_nan=False) + "\n"
    )


def score(stats):
    # A visible profile intrusion is a measurable failure even with good front overlap.
    eye_error = stats.get("eyes", {}).get("max_gaze_error")
    face_region = stats.get("painted_face_iou")
    front_score = (
        (
            0.08 * (face_region - stats["silhouette_iou"])
            if face_region is not None
            else 0
        )
        + (-0.12 * eye_error if eye_error is not None else 0)
        + (-0.1 if stats["profile_nose_visible"] is False else 0)
        + 0.35 * stats["silhouette_iou"]
        + 0.15 * sum(stats["regions"].values()) / len(stats["regions"])
        + 0.15 * (1 - stats["foreground_rgb_mae"] / 255)
        + 0.15 * (1 - stats["face_rgb_mae"] / 255)
        + 0.20 * stats["face_edge_agreement"]
    )
    turns = [key for key in ("side_view", "opposite_view", "quarter_view") if key in stats]
    if turns:
        agreements = []
        for key in turns:
            turn = stats[key]
            layers = [turn[k] for k in ("silhouette_iou", "skin_iou", "hair_iou")]
            errors = [
                turn[k] for k in ("eye_size_error", "eye_width_error", "nose_tip_error")
                if k in turn
            ]
            gaze = stats.get("quarter_expression", turn) if key == "quarter_view" else turn
            if "pupil_x_error" in gaze:
                errors.append(gaze["pupil_x_error"])
            if "visible_jaw" in turn:
                errors.append(turn["visible_jaw"]["mean_error"])
            if "fringe" in turn:
                errors.append(turn["fringe"]["p90_distance"])
            if "smile" in turn:
                errors.append(turn["smile"]["mean_distance"])
            if errors:
                layers.append(1 - min(1, sum(errors) / len(errors)))
            agreements.append(sum(layers) / len(layers))
        return 0.8 * front_score + 0.2 * sum(agreements) / len(agreements)
    return front_score


def turn_quality(stats):
    """Score the weakest supplied angle so a front fit cannot conceal a bad profile."""
    quality = []
    for name in ("side_view", "opposite_view", "quarter_view"):
        view = stats.get(name)
        if not view:
            continue
        shape = (view["silhouette_iou"] + view["skin_iou"] + view["hair_iou"]) / 3
        features = []
        if "fringe" in view:
            features.append(view["fringe"]["p90_distance"])
        if "exposed_temple" in view:
            temple = view["exposed_temple"]
            features.extend([temple["p90_edge_error"], 1 - temple["visible_fraction"]])
        for key in ("nose_tip_error", "eye_size_error", "eye_ink_shortfall"):
            if key in view:
                features.append(view[key])
        gaze = stats.get("quarter_expression", view) if name == "quarter_view" else view
        if "pupil_x_error" in gaze:
            features.append(gaze["pupil_x_error"])
        if "smile" in view:
            features.append(view["smile"]["mean_distance"])
        if features:
            pose_error = min(1, sum(features) / len(features))
            shape = 0.75 * shape + 0.25 * (1 - pose_error)
        quality.append(shape)
    return round(min(quality), 6) if quality else 0.0


class Study:
    def __init__(self, args, requested_model=None):
        self.default_name = (
            args.image.stem.replace("-", " ").replace("_", " ")[:60] or "Cartoon"
        )
        self.base = args.base
        self.backend = args.renderer
        self.budget = args.max_triangles
        args.output.mkdir(parents=True, exist_ok=True)
        self.run = Path(mkdtemp(prefix="study-", dir=args.output)).resolve()
        self.source = self.run / ("input" + args.image.suffix.lower())
        shutil.copyfile(args.image, self.source)
        self.guide = self.run / "measurement-guide.png"
        self.calibrate_turns = getattr(args, "calibrate_turns", False)
        self.best = None
        self.last_render = None
        self.summary = {
            "source_sha256": hashlib.sha256(self.source.read_bytes()).hexdigest(),
            "requested_model": requested_model,
            "attempts": [],
        }
        self.skull_part = None
        if getattr(args, "skull_part", None):
            part = self.run / "skull-part.json"
            shutil.copyfile(args.skull_part, part)
            self.skull_part = json.loads(part.read_text())
            self.summary["skull_part_sha256"] = hashlib.sha256(part.read_bytes()).hexdigest()
        self.profile = None
        if getattr(args, "profile", None):
            self.profile = self.run / ("side-guide" + args.profile.suffix.lower())
            shutil.copyfile(args.profile, self.profile)
            self.summary["side_guide_sha256"] = hashlib.sha256(
                self.profile.read_bytes()
            ).hexdigest()
        self.fit_opposite_temple = getattr(args, "fit_opposite_temple", False)
        self.opposite = None
        if getattr(args, "opposite_profile", None):
            source = args.opposite_profile
            self.opposite = self.run / ("opposite-guide" + source.suffix.lower())
            shutil.copyfile(source, self.opposite)
            self.summary["opposite_guide_sha256"] = hashlib.sha256(self.opposite.read_bytes()).hexdigest()
            self.summary["opposite_use"] = "review_only"
        self.fit_quarter = getattr(args, "fit_quarter", False)
        self.quarter = None
        if getattr(args, "quarter", None):
            self.quarter = self.run / ("quarter-guide" + args.quarter.suffix.lower())
            shutil.copyfile(args.quarter, self.quarter)
            self.summary["quarter_guide_sha256"] = hashlib.sha256(
                self.quarter.read_bytes()
            ).hexdigest()
        if self.quarter:
            self.summary["quarter_use"] = (
                "portrait_fit_and_review" if self.fit_quarter else "review_only"
            )
        self.save()
        draw_guide(self.source, self.guide)

    def prepare_draft(self, name=None):
        """Persist the source proposal so an edit can always be replayed."""
        try:
            draft = propose(self.source, name or self.default_name)
            Draft202012Validator(observations).validate(draft)
        except (ValueError, ValidationError) as exc:
            self.summary["draft_unavailable"] = str(exc).splitlines()[0]
            self.save()
            return None
        write(self.run / "draft.json", draft)
        return draft

    def fit_gaze_pose(self, directory, recipe, target):
        """Correct the two exposed whites after the native skin and lids occlude the globe."""
        image = directory / "portrait-quarter-gaze.png"
        if not image.is_file():
            return
        actual = quarter_pupils(image)
        if actual is None:
            return
        baseline = max(abs(want - got) for want, got in zip(target, actual))
        if baseline <= 0.05:
            return
        guide = recipe["design"]["fit"]["sections"]["sideGuide"]
        candidate = deepcopy(recipe)
        trial_guide = candidate["design"]["fit"]["sections"]["sideGuide"]
        initial = list(guide["turnedPupils"])
        best = baseline
        measured = actual
        positions = initial
        for _ in range(2):
            # Use the native displacement of each visible pupil to account for
            # foreshortening and occlusion. The first trial assumes unit gain.
            next_positions = []
            for start, previous, wanted, first, last in zip(initial, positions, target, actual, measured):
                gain = (previous - start) / (last - first) if abs(last - first) >= 0.01 else 1.0
                offset = (wanted - last) * min(2, max(0.25, gain))
                next_positions.append(round(min(1, max(0, previous + offset)), 4))
            if next_positions == positions:
                break
            trial_guide["turnedPupils"] = next_positions
            with TemporaryDirectory(dir=directory) as scratch:
                trial = Path(scratch)
                write(trial / "recipe.json", candidate)
                try:
                    render(trial / "recipe.json", trial, self.base, backend=self.backend, gaze_only=True)
                    posed = trial / image.name
                    found = quarter_pupils(posed) if posed.is_file() else None
                except (ValueError, BrowserError):
                    # This optional trial cannot invalidate an existing native draw.
                    break
                if found is None:
                    break
                error = max(abs(want - got) for want, got in zip(target, found))
                if error >= best:
                    break
                shutil.copyfile(posed, image)
                measured, positions, best = found, next_positions, error
                if best <= 0.05:
                    break
        if best < baseline:
            guide["turnedPupils"] = positions
            write(directory / "recipe.json", recipe)
            return {"target": target, "before": actual, "after": measured,
                    "max_error_before": round(baseline, 4), "max_error_after": round(best, 4)}

    def render_observation(self, directory, observation, reuse):
        """A character rename changes the recipe label, but no pixels or measurements."""
        recipe = fit(self.source, observation)
        fitted = recipe.get("design", {}).get("fit")
        if fitted is not None and self.budget > 0:
            fitted["triangleBudget"] = self.budget
        if self.skull_part is not None:
            if not fitted or "sections" not in fitted:
                raise ValueError("A fitted skull requires measurable character sections")
            fitted["sections"]["cranium"] = register_cranium(self.skull_part, recipe["design"]["head"])
        if self.profile:
            design = recipe["design"]
            sections = design.get("fit", {}).get("sections")
            if sections is None:
                raise ValueError(
                    "The side guide needs measurable body and head sections in the front T-pose"
                )
            sections["sideGuide"] = fit_profile(self.profile, design)
            if self.fit_opposite_temple:
                other = fit_profile(self.opposite, design)
                temple = other.get("templeEdge")
                if temple:
                    side = sections["sideGuide"]
                    # Register the two drawings by the visible eye before
                    # transferring depth. Each drawing has its own neck axis.
                    shift = side["eyeCenter"] - other["eyeCenter"]
                    side["templeEdge"] = {"side": temple["side"], "rows": [
                        [y, round(z + shift, 2)] for y, z in temple["rows"]
                    ]}
                    if temple.get("roll"):
                        side["templeEdge"]["roll"] = [[y,round(rear+shift,2),round(front+shift,2)] for y,rear,front in temple["roll"]]
                    self.summary["opposite_use"] = "temple_fit_and_review"
        gaze_target = None
        if self.fit_quarter and self.quarter:
            design = recipe["design"]
            sections = design.get("fit", {}).get("sections", {})
            side = sections.get("sideGuide")
            if side is None:
                raise ValueError("Fitting the turned portrait requires measured profile sections")
            if sections.get("nape"):
                side.update(fit_quarter_hair(self.quarter, design))
            pupils = quarter_pupils(self.quarter)
            if pupils and side.get("eyeRows") and len(sections.get("eyes", [])) == 2:
                side["turnedPupils"] = pupils
                gaze_target = pupils
        write(directory / "recipe.json", recipe)
        key = {k: v for k, v in observation.items() if k != "name"}
        if reuse and self.last_render and self.last_render[0] == key:
            _, prior, stats = self.last_render
            if stats.get("gaze_fit"):
                cached = json.loads((prior / "recipe.json").read_text())
                recipe["design"]["fit"]["sections"]["sideGuide"]["turnedPupils"] = (
                    cached["design"]["fit"]["sections"]["sideGuide"]["turnedPupils"]
                )
                write(directory / "recipe.json", recipe)
            for path in prior.iterdir():
                if path.suffix in (".png", ".webp") or path.name == "camera.json":
                    shutil.copyfile(path, directory / path.name)
            return deepcopy(stats), prior.name
        stats = render(
            directory / "recipe.json",
            directory,
            self.base,
            motion=True,
            backend=self.backend,
        )
        if gaze_target:
            gaze = self.fit_gaze_pose(directory, recipe, gaze_target)
            if gaze is not None:
                stats["gaze_fit"] = gaze
        stats.update(
            evaluate(self.source, directory / "front.png", directory, observation, recipe.get("design"))
        )
        if fitted and fitted.get("sections", {}).get("sidePart"):
            try:
                design = recipe["design"]
                drawing = registered_profile(self.source, design, frontal=True)[0]
                native = registered_profile(directory / "portrait.png", design, frontal=True)[0]
                fringe = fringe_difference(drawing, native)
                if fringe:
                    stats["frontal_fringe"] = fringe
            except ValueError as exc:
                stats["frontal_fringe_unmeasured"] = str(exc)
            # A free lock can open onto the exterior backdrop on only one
            # oblique. A supplied positive turn cannot verify the negative one.
            for name in ("portrait-quarter", "portrait-other-quarter"):
                try:
                    supplied = self.quarter if name == "portrait-quarter" else None
                    target = registered_profile(
                        supplied or self.source, design, quarter=bool(supplied),
                        frontal=not supplied, color="both",
                    )[0]
                    native = registered_profile(
                        directory / (name + ".png"), design, quarter=True, color="both"
                    )[0]
                    drawn, found = open_fringe_gap(*target), open_fringe_gap(*native)
                    stats.setdefault("oblique_fringe", {})[name] = {
                        "reference": "quarter" if supplied else "front",
                        "drawing": drawn, "render": found,
                        "introduced": found["sustained_rows"] >= 12
                        and found["sustained_width_px"] >= drawn["sustained_width_px"] + 6,
                    }
                    if not supplied:
                        gap = forehead_gap(*native)
                        if gap["area_px"]:
                            stats.setdefault("unverified_forehead_gaps", {})[name] = gap
                except ValueError as exc:
                    stats.setdefault("forehead_gap_unmeasured", {})[name] = str(exc)
        profile_right = None
        primary_layers = None
        if self.profile:
            try:
                primary_layers, right = profile_layers(self.profile, design)
                profile_right = right
                native = (
                    "portrait-profile.png" if right else "portrait-other-profile.png"
                )
                stats["side_view"] = compare_profile(
                    self.profile,
                    directory / native,
                    design,
                    directory / "side-comparison.png",
                )
                turn = (
                    stats.get("eyes", {}).get("turns", {}).get("90" if right else "-90")
                )
                if turn is not None and "pupilDepth" in sections["sideGuide"]:
                    stats["side_view"]["pupil_visible"] = turn["pupils"] > 0
            except ValueError as error:
                stats["side_review_error"] = str(error)
        if self.opposite:
            try:
                design = recipe["design"]
                opposite_layers, right = profile_layers(self.opposite, design)
                if profile_right is not None and profile_right == right:
                    raise ValueError("Both side drawings face the same direction")
                if primary_layers is not None:
                    widths = opposite_outline_widths(primary_layers, opposite_layers)
                    if widths:
                        stats["guide_outline_agreement"] = widths
                        if abs(widths["opposite_minus_primary_width_px"]) > widths["eye_to_crown_px"] * 0.08:
                            stats["guide_outline_feedback"] = (
                                "The two side drawings give different exterior head widths at the recorded heights "
                                "after crown-to-eye registration. Check their framing, yaw and proportions before "
                                "editing shared head depth. Review the hairline and eyes on each side separately."
                            )
                native = "portrait-profile.png" if right else "portrait-other-profile.png"
                stats["opposite_view"] = compare_profile(
                    self.opposite, directory / native, design, directory / "opposite-comparison.png"
                )
            except ValueError as error:
                stats["opposite_review_error"] = str(error)
        if self.quarter:
            try:
                stats["quarter_view"] = compare_profile(
                    self.quarter,
                    directory / "portrait-quarter.png",
                    recipe["design"],
                    directory / "quarter-comparison.png",
                    quarter=True,
                )
                posed = directory / "portrait-quarter-gaze.png"
                if posed.is_file():
                    compare_expressions(
                        self.quarter, directory / "portrait-quarter.png", posed,
                        recipe["design"], directory / "quarter-expression-review.png",
                    )
                    stats["quarter_expression"] = compare_profile(
                        self.quarter, posed, recipe["design"],
                        directory / "quarter-expression-comparison.png", quarter=True,
                    )
                elif recipe["design"].get("fit", {}).get("sections", {}).get("sideGuide", {}).get("turnedPupils"):
                    raise ValueError("The authored gaze pose was missing from the native portrait")
            except ValueError as exc:
                stats["quarter_review_error"] = str(exc)
        self.last_render = (key, directory, deepcopy(stats))
        return stats, None

    def preview(self, draft):
        """Render the source proposal as pass zero. Only a submitted draw can be selected."""
        directory = self.run / "preview"
        metrics = directory / "metrics.json"
        if metrics.is_file():
            return directory, json.loads(metrics.read_text())
        if draft is None or "preview_unavailable" in self.summary:
            return None
        directory.mkdir(exist_ok=True)
        try:
            stats, _ = self.render_observation(directory, draft, reuse=False)
        except ValueError as exc:
            self.summary["preview_unavailable"] = str(exc).splitlines()[0]
            self.save()
            return None
        write(metrics, stats)
        return directory, stats

    def resolve_edits(self, proposal, arguments):
        try:
            Draft202012Validator(draft_edits).validate(arguments)
        except ValidationError as exc:
            raise ValueError(str(exc).splitlines()[0]) from exc
        index = arguments["base_pass"]
        if index:
            source = self.run / f"pass-{index}" / "observations.json"
            if not source.is_file():
                raise ValueError(f"No saved observation for pass {index}")
            base = json.loads(source.read_text())
        else:
            base = proposal
        if base is None:
            raise ValueError(
                "No automatic proposal for base_pass 0. Use draw_cartoon to submit measurements, or set base_pass to a saved drawing."
            )
        result = deepcopy(base)
        result["name"] = arguments["name"]
        used = set()
        for edit in arguments["edits"]:
            field = edit["field"]
            if field in used:
                raise ValueError(f"Conflicting edits for {field}")
            used.add(field)
            parent, _, key = field.rpartition(".")
            (result.setdefault(parent, {}) if parent else result)[key] = edit["value"]
        return result

    def save(self):
        write(self.run / "run.json", self.summary)

    def provider_error(self, error):
        record = {
            "pass": len(self.summary["attempts"]) + 1,
            "provider_error": str(error).splitlines()[0],
        }
        self.summary["attempts"].append(record)
        self.save()

    def draw(self, observation, receipt, draft=None):
        edit_request = None
        if isinstance(observation, dict) and "edits" in observation:
            edit_request = observation
            observation = self.resolve_edits(draft, edit_request)
            receipt = {
                **receipt,
                "operation": "draw_from_draft",
                "base_pass": edit_request["base_pass"],
                "edit_count": len(edit_request["edits"]),
            }
        index = len(self.summary["attempts"]) + 1
        directory = self.run / f"pass-{index}"
        directory.mkdir()
        write(directory / "observations.json", observation)
        if edit_request is not None:
            write(directory / "edits.json", edit_request)
        record = {"pass": index, **receipt}
        self.summary["attempts"].append(record)
        self.save()
        try:
            if receipt["transport"] != "observation-replay":
                Draft202012Validator(fitted_observation).validate(observation)
            stats, previous = self.render_observation(
                directory,
                observation,
                reuse=receipt["transport"]
                not in ("observation-replay", "image-measurements"),
            )
            if previous:
                record["rendered_from"] = previous
        except (ValueError, ValidationError) as error:
            record["validation_error"] = str(error).splitlines()[0]
            self.save()
            raise ValueError(record["validation_error"]) from error
        except BrowserError as error:
            record["renderer_error"] = str(error).splitlines()[0]
            self.save()
            raise RuntimeError(record["renderer_error"]) from error
        record["score"] = round(score(stats), 6)
        record["triangles"] = stats["triangles"]
        eye_status = stats.get("eyes", {}).get("status")
        record["eye_status"] = eye_status
        within_budget = stats["triangles"] <= self.budget
        hair = stats.get("hair_coverage")
        missing_hair = hair is not None and hair < 0.70
        if missing_hair:
            record["hair_feedback"] = (
                "A large area of the reference hair is missing. Check the hair swatch, crown and cheek boundaries."
            )
            stats["hair_feedback"] = record["hair_feedback"]
        if stats.get("detached_parts", 0):
            stats["geometry_feedback"] = (
                "A visible part is disconnected from the body. Inspect the wrists, ankles and hair during the turn."
            )
        front_fringe = stats.get("frontal_fringe")
        revise_fringe = bool(front_fringe and front_fringe["p90_distance"] > 0.08)
        if front_fringe:
            record["frontal_fringe"] = "revise" if revise_fringe else "within_tolerance"
        if revise_fringe:
            stats["fringe_feedback"] = (
                "Check for a new lock crossing exposed forehead in the original T-pose."
            )

        def profile_needs_revision(view, error):
            side = stats.get(view)
            return bool(stats.get(error)) or bool(side and (
                side["silhouette_iou"] < 0.80
                or side["skin_iou"] < 0.55
                or side.get("pupil_visible") is False
                or side.get("smile", {}).get("mean_distance", 0) > 0.044
                or side.get("fringe", {}).get("p90_distance", 0) > 0.14
                or side.get("exposed_temple", {}).get("p90_edge_error", 0) > 0.14
                or side.get("exposed_temple", {}).get("visible_fraction", 1) < 0.8
                or side.get("forehead_gap", {}).get("introduced", False)
                or side.get("nose_tip_error", 0) > 0.09
                or side.get("pupil_x_error", 0) > 0.23
                or side.get("eye_size_error", 0) > 0.30
            ))

        revise_side = profile_needs_revision("side_view", "side_review_error")
        revise_opposite = profile_needs_revision("opposite_view", "opposite_review_error")
        if self.opposite:
            record["opposite_review"] = "revise" if revise_opposite else "within_tolerance"
        if revise_opposite:
            stats["opposite_feedback"] = (
                "Inspect the opposite profile. Compare the fringe along the forehead, including any lock "
                "visible beyond the face, and check the eye, chin and nape against this side's drawing."
            )
        if self.profile:
            record["side_review"] = "revise" if revise_side else "within_tolerance"
        if revise_side:
            stats["side_feedback"] = (
                "Compare the side drawing with the native profile. Check the eye opening, pupil placement, "
                "the height and projection of the nose tip, the cheek exposed by the hair, and the depth from chin to neck."
            )
        quarter = stats.get("quarter_view")
        revise_quarter = bool(stats.get("quarter_review_error")) or bool(
            quarter
            and (
                quarter["silhouette_iou"] < 0.80
                or quarter["skin_iou"] < 0.64
                or quarter["hair_iou"] < 0.60
                or quarter.get("fringe", {}).get("p90_distance", 0) > 0.14
                or quarter.get("forehead_gap", {}).get("introduced", False)
                or quarter.get("nose_ink", {}).get("status", "matched") != "matched"
                or quarter.get("visible_jaw", {}).get("mean_error", 0) > 0.12
                or quarter.get("smile", {}).get("mean_distance", 0) > 0.044
                or quarter.get("eye_width_error", 0) > 0.20
                or quarter.get("eye_size_error", 0) > 0.30
            )
        )
        expression = stats.get("quarter_expression")
        pose_failed = expression is not None and expression.get("pupil_x_error", 1) > 0.15
        if expression is not None:
            record["quarter_expression"] = "revise" if pose_failed else "within_tolerance"
        different_gaze = bool(quarter and quarter.get("pupil_x_error", 0) > 0.23)
        if different_gaze:
            record["quarter_gaze"] = "differs_from_guide"
            stats["quarter_gaze_feedback"] = (
                "The turned drawing has its own measured gaze. Review its posed portrait alongside the resting face."
                if expression is not None else
                "The visible pupils point elsewhere in the 35 degree drawing. "
                "Compare each eye with the front T-pose before changing the gaze."
            )
        if self.quarter:
            record["quarter_review"] = (
                "revise" if revise_quarter or pose_failed else
                "matched_with_gaze_pose" if expression is not None and different_gaze else
                "inspect_gaze" if different_gaze else "within_tolerance"
            )
        if revise_quarter:
            stats["quarter_feedback"] = (
                "At 35 degrees compare the size of each eye, the smile, the visible cheek and the hair behind the ear."
            )
        open_lock = any(turn["introduced"] for turn in stats.get("oblique_fringe", {}).values())
        if open_lock or any(stats.get(view, {}).get("forehead_gap", {}).get("introduced")
               for view in ("quarter_view", "side_view", "opposite_view")):
            stats["fringe_feedback"] = (
                "The backdrop shows through the fringe above the brow in a turn where the drawing is closed. "
                "Seat the lock against the temple and check the original frontal hairline."
            )
        write(directory / "metrics.json", stats)
        record["qualifies"] = (
            within_budget
            and not stats.get("detached_parts", 0)
            and eye_status != "revise"
            and not stats.get("coat_feedback")
            and not missing_hair
            and not revise_fringe
            and not open_lock
            and not revise_side
            and not revise_opposite
            and not revise_quarter
            and not pose_failed
        )
        rank = record["score"]
        if self.calibrate_turns:
            record["weakest_turn"] = turn_quality(stats)
            rank = (record["weakest_turn"], rank)
        if record["qualifies"] and (
            self.best is None
            or rank > self.best
            or (previous and rank == self.best)
        ):
            self.best = rank
            for name in (
                "recipe.json",
                "comparison.png",
                "portrait-review.png",
                "metrics.json",
                "walk.webp",
            ):
                shutil.copyfile(directory / name, self.run / name)
            for name in (
                "turnaround.png",
                "walk-back.webp",
                "side-comparison.png",
                "opposite-comparison.png",
                "quarter-comparison.png",
                "quarter-expression-comparison.png",
                "quarter-expression-review.png",
                "portrait-quarter-gaze.png",
            ):
                if (directory / name).is_file():
                    shutil.copyfile(directory / name, self.run / name)
            self.summary.update(
                selected=directory.name,
                unsupported=observation["unsupported"],
                needs_review=self.profile is None
                or receipt["transport"] == "image-measurements"
                or (different_gaze and expression is None)
                or bool(observation["unsupported"])
                or stats["profile_nose_visible"] is False
                or bool(stats.get("frontal_fringe_unmeasured"))
                or bool(stats.get("guide_outline_feedback"))
                or bool(stats.get("unverified_forehead_gaps") or stats.get("forehead_gap_unmeasured"))
                or eye_status == "unmeasured",
                depth_review="Measured against the supplied side guide. Inspect both sides and the back."
                if self.profile
                else "Depth and rear silhouette inferred from one front view. Inspect the portrait turns.",
            )
            if stats.get("side_review_error"):
                self.summary["needs_review"] = True
        self.save()
        return directory, stats
