"""Compare a fitted family with the input before offering it for reuse."""

import hashlib
import json
from pathlib import Path
from tempfile import mkdtemp
from time import monotonic

import numpy as np
from PIL import Image, ImageDraw
from playwright.sync_api import TimeoutError as BrowserTimeout
from scipy import ndimage

from .family import FAMILIES, NoFamilySilhouette, fit_family
from .family_body import body_edits, sleeve_cut
from .family_edits import edited_recipe
from .family_eyes import eye_agreement, eye_edits
from .fit import pixels
from .jersey_print import projected_print
from .kit_hand import compare_open_hands
from .lapel import has_contour_ink, lapel_edit, panel_edit
from .review import render
from .sun_rays import (
    collar_closed,
    floating_gap,
    kit_edits,
    kit_landmarks,
    open_collar,
    orb_edits,
)
from .tracing import (
    garment_motif,
    garment_patch,
    print_frame,
    print_islands,
    registered_print,
)
from .visor import profile_gap, trace_front_visor


def compare_images(
    reference,
    candidate,
    head_fraction=0.27,
    eye_frame=None,
    front_frames=None,
    shirt_frame=None,
    garment_preview=None,
):
    """Compare source and native front at one uniform scale about the subject."""
    images = [pixels(path, keep_components=True) for path in (reference, candidate)]
    # A turnaround has a fixed camera. Register it once at the T-pose so a
    # moving hand or a ray seen edge-on cannot shift the entire profile.
    calibration = (
        [pixels(path, keep_components=True) for path in front_frames]
        if front_frames
        else images
    )
    frames = []
    for _, mask in calibration:
        y, x = np.nonzero(mask)
        span = float(np.ptp(y))
        if span < 1:
            raise ValueError("The reference has no measurable height")
        frames.append(((x.min() + x.max()) / 2, y.min(), span / 384))
    half_width = 4 + int(
        np.ceil(
            max(
                np.max(abs(np.nonzero(mask)[1] - cx)) / unit
                for (_, mask), (cx, _, unit) in zip(images, frames)
            )
        )
    )
    # The original front framing is tight. Reserve room on turned captures
    # for a feature which stands above or below the front silhouette.
    pad_y = 32 if front_frames else 0

    def frame(rgb, mask, registration):
        cx, top, unit = registration
        row = top + (np.arange(385 + 2 * pad_y) - pad_y) * unit
        col = cx + (np.arange(2 * half_width + 1) - half_width) * unit
        inside = ((row >= 0) & (row < mask.shape[0]))[:, None] & (
            (col >= 0) & (col < mask.shape[1])
        )
        iy = row.round().astype(int).clip(0, mask.shape[0] - 1)
        ix = col.round().astype(int).clip(0, mask.shape[1] - 1)
        m = mask[np.ix_(iy, ix)] & inside
        im = rgb[np.ix_(iy, ix)].copy()
        im[~m] = [233, 228, 220]
        return m, im

    def edges(rgb, mask):
        smooth = ndimage.gaussian_filter(rgb, (0.65, 0.65, 0))
        magnitude = np.hypot(
            np.gradient(smooth, axis=0), np.gradient(smooth, axis=1)
        ).max(2)
        return (magnitude > 16) & ndimage.binary_erosion(mask, iterations=2)

    a, ar = frame(*images[0], frames[0])
    b, br = frame(*images[1], frames[1])
    head = np.arange(a.shape[0])[:, None] <= pad_y + round(384 * head_fraction)
    shared = a & b

    def iou(m, n):
        return round(float((m & n).sum() / max(1, (m | n).sum())), 4)

    def agreement(m, n):
        if not m.any() or not n.any():
            return float(not m.any() and not n.any())

        def within(hits, target):
            return np.mean(ndimage.distance_transform_edt(~target)[hits] <= 1.6)

        return round(float(min(within(m, n), within(n, m))), 4)

    ea, eb = edges(ar, a), edges(br, b)
    error = np.abs(ar - br).mean(2)
    metrics = {
        "silhouette_iou": iou(a, b),
        "head_iou": iou(a & head, b & head),
        "head_edge_agreement": agreement(ea & head, eb & head),
        "body_edge_agreement": agreement(ea & ~head, eb & ~head),
        "rgb_mae": round(float(error[shared].mean()), 2) if shared.any() else 255,
    }
    if eye_frame:
        x0, y0, x1, y1 = eye_frame
        rect = np.s_[
            max(0, pad_y + round(384 * y0) - 1) : min(
                a.shape[0], pad_y + round(384 * y1) + 2
            ),
            max(0, half_width + round(384 * x0) - 1) : min(
                2 * half_width + 1, half_width + round(384 * x1) + 2
            ),
        ]
        reference_eye, drawn_eye = ar[rect], br[rect]
        # Relative contrast covers a dark pupil on a white globe and a white
        # star on a dark visor. Check both pigments in each side of the face.
        matches = []
        for ax, bx in zip(
            np.array_split(reference_eye, 2, axis=1),
            np.array_split(drawn_eye, 2, axis=1),
        ):
            for mask in [lambda x: x.mean(2) < 88, lambda x: x.min(2) > 187]:
                expected, rendered = mask(ax), mask(bx)
                if expected.any() or rendered.any():
                    matches.append(agreement(expected, rendered))
        metrics["eye_pigment_agreement"] = min(matches, default=0)
    if shirt_frame:
        window, patch, reference_mark = registered_print(*images[0], shirt_frame)
        rendered = garment_patch(*images[1], print_frame(shirt_frame, window))
        patches = [patch, rendered]
        marks = [reference_mark, garment_motif(rendered)]
        if window != [0, 0, 1, 1]:
            metrics["shirt_window"] = window
        for i in (0, 1):
            if marks[i] is None and marks[1 - i] is not None:
                y, x = np.unravel_index(
                    ndimage.distance_transform_edt(marks[1 - i][0]).argmax(),
                    patches[i].shape[:2],
                )
                marks[i] = garment_motif(patches[i], [x / 96, y / 96])
        if garment_preview and any(mark is not None for mark in marks):
            sheet = Image.new("RGB", (392, 220), "#f7f4ef")
            labels = ImageDraw.Draw(sheet)
            for i, (patch, title) in enumerate(
                zip(patches, ("Source shirt", "Native shirt"))
            ):
                tile = Image.fromarray(patch.astype("uint8")).resize((192, 192))
                sheet.paste(tile, (2 + 196 * i, 24))
                labels.text((4 + 196 * i, 5), title, fill="#292624")
            sheet.save(garment_preview)
        if any(mark is not None for mark in marks):
            match = 0
            if all(mark is not None for mark in marks):

                def painted_area(patch, mark):
                    region, pigment = mark
                    region = region.copy()
                    for _, component, _ in print_islands(patch, mark):
                        region |= component
                    return region, pigment

                (ma, ca), (mb, cb) = [
                    painted_area(p, m) for p, m in zip(patches, marks)
                ]
                # Native lighting can shift pigments slightly; compare the
                # shape and the paint so a wrong-colored logo also fails.
                color_match = float(
                    np.clip(1 - max(0, np.linalg.norm(ca - cb) - 26) / 100, 0, 1)
                )
                match = round(min(agreement(ma, mb), color_match), 4)
            metrics["shirt_mark_agreement"] = match
            if marks[0] is not None:
                y, x = np.unravel_index(
                    ndimage.distance_transform_edt(marks[0][0]).argmax(), (97, 97)
                )
                metrics["shirt_mark_sample"] = [round(x / 96, 3), round(y / 96, 3)]
    return metrics


def family_study(source, output, family, name, base, backend, budget, *, within=False):
    output.mkdir(exist_ok=True, parents=True)
    directory = Path(mkdtemp(prefix="family-", dir=output)).resolve()
    start = monotonic()
    report = {
        "source_sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
        "accepted": False,
    }
    try:
        recipe, measurements, overlay = fit_family(source, family, name)
    except NoFamilySilhouette as exc:
        report.update(
            reason=str(exc), candidates={}, total_seconds=round(monotonic() - start, 3)
        )
        (directory / "review.json").write_text(json.dumps(report, indent=2) + "\n")
        return directory, report
    report.update(candidates=measurements, fit_seconds=round(monotonic() - start, 3))
    overlay.save(directory / "silhouettes.png")
    key = recipe["family"]
    score = measurements[key]
    report["family"] = key
    report["depth_review"] = (
        f"The hidden surfaces inherit the registered {key} geometry."
    )
    # In a named family, a plausible partial match can receive native part
    # measurements. The acceptance thresholds after rendering are identical.
    whole, head = (0.78, 0.60) if within else (0.90, 0.86)
    if score["silhouette_iou"] < whole or score["head_iou"] < head:
        report["reason"] = "The source needs different geometry."
    else:
        assess_native(recipe, source, directory, report, base, backend, budget)
    return finish(directory, report, start)


def paint_edits(source, native, score, recipe):
    def sample(path):
        rgb, mask = pixels(path, keep_components=True)
        yy, xx = np.where(mask)
        span, cx, top = np.ptp(yy), (xx.max() + xx.min()) / 2, yy.min()
        out = {}
        for key, points in score.get("paint_probes", {}).items():
            xy = np.rint(np.array(points) * span + [cx, top]).astype(int)
            x, y = (
                xy[:, 0].clip(0, rgb.shape[1] - 1),
                xy[:, 1].clip(0, rgb.shape[0] - 1),
            )
            out[key] = (rgb[y, x], mask[y, x])
        return out

    expected, actual = sample(source), sample(native)
    edits = []
    for key, (target, ok) in expected.items():
        observed, inside = actual[key]
        valid = ok & inside
        if valid.sum() < 15:
            continue
        error = target[valid] - observed[valid]
        delta = np.median(error, axis=0)
        # A role can contain printing or several depth-shaded surfaces. Only
        # correct channels on which most of its interior samples agree.
        iqr = np.percentile(error, 75, axis=0) - np.percentile(error, 25, axis=0)
        delta = np.where(iqr <= 44, delta, 0)
        if abs(delta).max() < 8:
            continue
        paint = recipe["paints"].get(key, FAMILIES[recipe["family"]]["paints"][key][0])
        base = np.frombuffer(bytes.fromhex(paint[1:]), dtype="uint8")
        updated = (
            "#"
            + (base + delta.clip(-48, 48))
            .round()
            .clip(0, 255)
            .astype("uint8")
            .tobytes()
            .hex()
        )
        if updated != paint:
            edits.append({"field": "paints." + key, "value": updated})
    return edits


def native_front(source, candidate, family, score, preview=None):
    visual = compare_images(
        source,
        candidate,
        score["head_fraction"],
        score["eye_frame"],
        shirt_frame=score.get("shirt_frame"),
        garment_preview=preview,
    )
    if family == "rick-classic":
        pair = eye_agreement(
            source,
            candidate,
            score["eye_frame"],
            lowered=score.get("lowered_lids", False),
        )
        if pair:
            visual["globe_measurements"] = pair
    if family == "sunshine":
        original, drawn = [
            floating_gap(path, score["eye_frame"]) for path in (source, candidate)
        ]
        if original is not None and drawn is not None:
            visual["floating_gap"] = {"source": original, "native": drawn}
        if score.get("source_finger_spread"):
            rgb, mask = pixels(candidate, keep_components=True)
            visual["open_hands"] = compare_open_hands(
                score["source_finger_spread"], rgb, mask, kit_landmarks(rgb, mask)
            )
    return visual


def eyes_match(visual):
    pair = visual.get("globe_measurements")
    if pair and pair.get("paired_pupils") is False:
        return False
    if pair:
        # Measure both pupils individually on their own globes. Decorative ink
        # or a brow crossing the registration box cannot substitute for a pupil.
        return (
            pair["position"] <= 0.145
            and pair["aperture_log_error"] <= 0.19
            and pair["gaze"] <= 0.135
            and pair["pupil_log_error"] <= 0.39
            and (pair["source_ink"] < 0.18 or pair["native_ink"] >= 0.12)
        )
    return visual["eye_pigment_agreement"] >= 0.60


def failed_front_checks(visual):
    thresholds = {
        "silhouette_iou": 0.90,
        "head_iou": 0.86,
        "head_edge_agreement": 0.68,
        "body_edge_agreement": 0.65,
    }
    misses = [key for key, minimum in thresholds.items() if visual[key] < minimum]
    if "open_hands" in visual and not visual["open_hands"]["matched"]:
        misses.append("open hands")
    if not eyes_match(visual):
        misses.append("eyes")
    if visual["rgb_mae"] > 28:
        misses.append("rgb_mae")
    return misses


def registered_edits(recipe, source, directory, score, visual, gap, closed, misses):
    edits = []
    if visual["silhouette_iou"] < 0.92 or closed:
        body = body_edits(source, directory / "front.png", score, recipe)
        if recipe["family"] == "sunshine":
            kit = kit_edits(source, directory / "front.png", recipe, gap)
            if kit:
                body = [
                    edit
                    for edit in body
                    if edit["field"] in ("limbWidth", "proportions.armSpan")
                ] + kit
        edits.extend(body)
    if recipe.get("penOutline") and visual["body_edge_agreement"] < 0.65:
        cut = sleeve_cut(source, directory / "front.png", score["shirt_frame"], recipe)
        if cut:
            edits.append(cut)
    if recipe["family"] == "rick-classic" and visual["eye_pigment_agreement"] < 0.75:
        edits.extend(
            eye_edits(source, directory / "front.png", score["eye_frame"], recipe)
        )
    if (
        recipe["family"] == "rick-classic"
        and not recipe.get("penOutline")
        and has_contour_ink(source)
    ):
        edits.append({"field": "penOutline", "value": True})
    if recipe["family"] == "rick-classic" and visual["body_edge_agreement"] < 0.65:
        panels = panel_edit(
            source,
            directory / "front.png",
            score["shirt_frame"],
            recipe["paints"].get("coat", FAMILIES["rick-classic"]["paints"]["coat"][0]),
            recipe.get("coatPanels"),
        )
        if panels:
            edits.append(panels)
    if (
        recipe["family"] == "rick-classic"
        and not recipe.get("lapels")
        and visual["body_edge_agreement"] < 0.65
    ):
        color = recipe["paints"].get(
            "coat", FAMILIES["rick-classic"]["paints"]["coat"][0]
        )
        lapels = lapel_edit(source, score["shirt_frame"], color)
        if lapels:
            edits.append(lapels)
    if (
        recipe["family"] == "sunshine"
        and not recipe.get("visor")
        and visual["eye_pigment_agreement"] < 0.78
    ) and trace_front_visor(source, score["eye_frame"]):
        edits.append({"field": "visor", "value": "trace"})
    if recipe["family"] == "sunshine" and visual["head_iou"] < 0.94:
        edits.extend(
            orb_edits(source, directory / "front.png", score["eye_frame"], recipe)
        )
    if visual["rgb_mae"] > 15:
        measured_fields = {e["field"] for e in edits}
        edits.extend(
            e
            for e in paint_edits(source, directory / "front.png", score, recipe)
            if e["field"] not in measured_fields
        )
    if visual.get("shirt_mark_agreement", 1) < 0.65:
        point = visual.get("shirt_mark_sample")
        mark = None
        if (
            recipe.get("plainJersey")
            and recipe.get("shirtMark")
            and score.get("shirt_frame")
        ):
            mark = projected_print(
                source,
                directory / "front.png",
                score["shirt_frame"],
                recipe["shirtMark"],
            )
        edits.append(
            {
                "field": "shirtMark",
                "value": mark or ({"sample": point} if point else None),
            }
        )
    if closed and not misses:
        # Independent coat or pigment adjustments would disturb an already
        # registered front. Move just the collar to clear the measured chin.
        edits = [open_collar(recipe, gap)]
    return edits


def assess_native(
    recipe, source, directory, report, base, backend, budget, previous=None
):
    # Keep both crops anchored to the initial source fit across every proposal.
    score = report["candidates"][recipe["family"]]
    draft = directory / "candidate.json"
    draft.write_text(json.dumps(recipe, separators=(",", ":")) + "\n")
    report["recipe_sha256"] = hashlib.sha256(draft.read_bytes()).hexdigest()
    for attempt in range(2):
        try:
            performance = render(draft, directory, base, False, backend)
            visual = native_front(
                source,
                directory / "front.png",
                recipe["family"],
                score,
                directory / "shirt-comparison.png",
            )
            break
        except (BrowserTimeout, ValueError) as exc:
            if attempt or (
                isinstance(exc, ValueError)
                and str(exc) != "The image has no foreground"
            ):
                raise
            report["render_retried"] = type(exc).__name__
    report.update(native=performance, front=visual)
    profile_passed = True
    if recipe.get("visor"):
        gap_at_profile = profile_gap(
            directory / "profile.png", recipe["paints"].get("skin", "#f32685")
        )
        profile_passed = gap_at_profile is not None and gap_at_profile <= 0.006
        report["profile"] = {
            "visor_gap_fraction": gap_at_profile,
            "maximum": 0.006,
            "passed": profile_passed,
        }
    misses = failed_front_checks(visual)
    report["failed_front_checks"] = misses
    gap = visual.get("floating_gap")
    closed = collar_closed(gap)
    if recipe.get("construction") == "household":
        from .household_front import review_edits

        edits = review_edits(recipe, source, directory / "front.png", score, visual)
    else:
        edits = registered_edits(
            recipe, source, directory, score, visual, gap, closed, misses
        )
    if edits:
        report["suggested_edits"] = sorted(
            edits, key=lambda e: e["field"].startswith("paints.")
        )[:12]
    if budget > 0 and performance["triangles"] > budget:
        report["reason"] = "The native model exceeds the triangle budget."
    elif closed:
        report["reason"] = "The drawn collar closes the source's floating-head gap."
    elif visual.get("shirt_mark_agreement", 1) < 0.65:
        report["reason"] = "The shirt graphic differs in shape, position or paint."
    elif not profile_passed:
        report["reason"] = "The 90° view must show the lens attached to the orb."
    elif misses:
        report["reason"] = "Native comparison missed " + ", ".join(misses) + "."
    elif (
        previous
        and previous["accepted"]
        and (
            any(
                previous["front"][key] - visual[key] > limit
                for key, limit in (
                    ("silhouette_iou", 0.025),
                    ("head_iou", 0.04),
                    ("eye_pigment_agreement", 0.13),
                    ("head_edge_agreement", 0.07),
                    ("body_edge_agreement", 0.07),
                )
            )
            or visual["rgb_mae"] > previous["front"]["rgb_mae"] + 3
        )
    ):
        report["reason"] = "The revision lost visible detail from the accepted base."
    else:
        report["accepted"] = True
        (directory / "recipe.json").write_bytes(draft.read_bytes())


def revise_family(source, parent, edits, base, backend, budget):
    original = json.loads((parent / "review.json").read_text())
    candidate = (parent / "candidate.json").read_bytes()
    if hashlib.sha256(source.read_bytes()).hexdigest() != original["source_sha256"]:
        raise ValueError("The family fit belongs to a different source image")
    if hashlib.sha256(candidate).hexdigest() != original["recipe_sha256"]:
        raise ValueError("Family candidate changed after review")
    start = monotonic()
    previous = json.loads(candidate)
    shirt_frame = original["candidates"][previous["family"]].get("shirt_frame")
    sampled = any(
        isinstance(e, dict)
        and isinstance(e.get("value"), dict)
        and "sample" in e["value"]
        for e in edits
    )
    window = original["front"].get("shirt_window", (0, 0, 1, 1))
    patch = (
        garment_patch(
            *pixels(source, keep_components=True), print_frame(shirt_frame, window)
        )
        if sampled and shirt_frame
        else None
    )
    trace = any(
        isinstance(e, dict) and e.get("field") == "visor" and e.get("value") == "trace"
        for e in edits
    )
    visor = (
        trace_front_visor(
            source, original["candidates"][previous["family"]]["eye_frame"]
        )
        if trace
        else None
    )
    recipe = edited_recipe(previous, edits, patch, window, visor)
    if recipe == previous:
        return parent, original
    directory = Path(mkdtemp(prefix="revision-", dir=parent.parent)).resolve()
    report = {
        k: original[k]
        for k in (
            "source_sha256",
            "candidates",
            "family",
            "construction",
            "registration",
            "depth_review",
        )
        if k in original
    }
    report.update(
        accepted=False,
        parent=parent.name,
        base_recipe_sha256=original["recipe_sha256"],
        edits=edits,
    )
    assess_native(recipe, source, directory, report, base, backend, budget, original)
    return finish(directory, report, start)


def fit_and_refine(
    source, output, family, name, base, backend, budget, revisions=0, within=False
):
    initial, result = family_study(
        source, output, family, name, base, backend, budget, within=within
    )
    folder = initial
    tested = [(folder, result)]
    visited = set()
    error = None
    for _ in range(revisions):
        edits = result.get("suggested_edits")
        if result["accepted"] or not edits or result["recipe_sha256"] in visited:
            break
        visited.add(result["recipe_sha256"])
        try:
            folder, result = revise_family(source, folder, edits, base, backend, budget)
        except ValueError as exc:
            error = str(exc)
            break
        if folder == tested[-1][0]:
            break
        tested.append((folder, result))

    from .family_trials import family_rank

    def rank(item):
        return family_rank(item[1])

    best, report = max(tested, key=rank)
    if (
        within
        and revisions
        and not report["accepted"]
        and result.get("family") == "sunshine"
    ):
        # Reframing a jersey shifts the normalized head measurements. Test the
        # independent orb correction against the same starting pose as the kit.
        initial_report = tested[0][1]
        all_edits = initial_report.get("suggested_edits", [])
        head_edits = [
            edit
            for edit in all_edits
            if edit["field"].startswith(
                ("proportions.head", "proportions.crown", "orb", "paints.")
            )
        ]
        if head_edits and len(head_edits) < len(all_edits):
            branch = revise_family(source, initial, head_edits, base, backend, budget)
            if branch[0] != initial:
                tested.append(branch)
                best, report = max(tested, key=rank)
    if within and revisions and not report["accepted"] and report.get("native"):
        from .family_trials import calibrate

        trial = calibrate(source, best, report, base, backend, budget)
        if trial[0] != best:
            tested.append(trial)
            best, report = max(tested, key=rank)
    if within and revisions and report["accepted"] and report["family"] == "sunshine":
        # An already registered face can retain the original pink material
        # gradient despite having a different skin hue. Check a paint-only
        # correction against the accepted geometry before saving it.
        palette = [
            e for e in report.get("suggested_edits", []) if e["field"] == "orbPaint"
        ]
        if palette and "orbPaint" not in json.loads(
            (best / "candidate.json").read_text()
        ):
            painted = revise_family(source, best, palette, base, backend, budget)
            if painted[0] != best:
                tested.append(painted)
                if (
                    painted[1]["accepted"]
                    and painted[1]["front"]["rgb_mae"] < report["front"]["rgb_mae"]
                ):
                    best, report = painted
    if within and family in ("auto", "rick-classic") and not report["accepted"]:
        from .household_front import fit_front

        try:
            household, score = fit_front(source, name)
        except ValueError as exc:
            report["household_fit_reason"] = str(exc)
        else:
            from .household_registration import match

            seed = match(source, household, score)
            candidates = [seed, (household, None)] if seed else [(household, None)]
            for household, registration in candidates:
                start = monotonic()
                directory = Path(mkdtemp(prefix="household-", dir=output)).resolve()
                household_report = {
                    "source_sha256": report["source_sha256"],
                    "family": "rick-classic",
                    "construction": "household",
                    "candidates": {"rick-classic": score},
                    "accepted": False,
                    "depth_review": "The profile uses the registered household skull, eye sockets and body depth.",
                }
                if registration:
                    household_report["registration"] = registration
                try:
                    assess_native(
                        household,
                        source,
                        directory,
                        household_report,
                        base,
                        backend,
                        budget,
                    )
                except ValueError as exc:
                    household_report["reason"] = (
                        "The measured household candidate could not be reviewed: "
                        + str(exc)
                    )
                    tested.append(finish(directory, household_report, start))
                    continue
                branch = finish(directory, household_report, start)
                tested.append(branch)
                for _ in range(revisions):
                    edits = branch[1].get("suggested_edits", [])
                    if branch[1]["accepted"] or not edits:
                        break
                    revised = revise_family(
                        source, branch[0], edits, base, backend, budget
                    )
                    if revised[0] == branch[0]:
                        break
                    tested.append(revised)
                    if rank(revised) <= rank(branch):
                        break
                    branch = revised
                if branch[1]["accepted"]:
                    break
            best, report = max(tested, key=rank)
    receipt = {
        "source_sha256": report["source_sha256"],
        "within_family": family if within else None,
        "accepted": report["accepted"],
        "best": best.name,
        "attempts": [
            {
                "folder": d.name,
                "family": r.get("family"),
                "construction": r.get("construction"),
                "registration": r.get("registration"),
                "accepted": r["accepted"],
                "front": r.get("front"),
                "profile": r.get("profile"),
                "failed_front_checks": r.get("failed_front_checks", []),
                "reason": r.get("reason"),
            }
            for d, r in tested
        ],
    }
    if error:
        receipt["edit_error"] = error
    (initial / "family-run.json").write_text(json.dumps(receipt, indent=2) + "\n")
    return best, report, initial / "family-run.json"


def finish(directory, report, start):
    report["total_seconds"] = round(monotonic() - start, 3)
    (directory / "review.json").write_text(json.dumps(report, indent=2) + "\n")
    return directory, report
