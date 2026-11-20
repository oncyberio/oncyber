"""Compare bounded family adjustments in one live native renderer."""

import copy
import json
import tempfile
from pathlib import Path

from playwright.sync_api import sync_playwright

from .family_edits import edited_recipe
from .review import native_page


def merit(metrics):
    """Prefer closing the largest observed misses, with a continuous tie break."""
    scores = [
        (metrics[k], full)
        for k, full in (
            ("silhouette_iou", 0.90),
            ("head_iou", 0.86),
            ("head_edge_agreement", 0.68),
            ("body_edge_agreement", 0.65),
            ("eye_pigment_agreement", 0.60),
        )
    ]
    scores += [
        (metrics.get("shirt_mark_agreement", 1), 0.65),
        (28 / max(1, metrics["rgb_mae"]), 1),
    ]
    if "shirt_strokes" in metrics:
        scores.append((min(metrics["shirt_strokes"]["coverage"]), 0.65))
    if "open_hands" in metrics:
        scores.append((float(metrics["open_hands"]["matched"]), 1))
    if metrics.get("globe_measurements", {}).get("paired_pupils") is False:
        scores[4] = (0, 1)
    elif "globe_measurements" in metrics:
        eye = metrics["globe_measurements"]
        del scores[4]
        scores += [
            (
                1
                - max(
                    eye["gaze"] / 0.135,
                    eye["position"] / 0.145,
                    eye["pupil_log_error"] / 0.39,
                    eye["aperture_log_error"] / 0.19,
                )
                * 0.4,
                0.6,
            )
        ]
        if eye["source_ink"] >= 0.18:
            scores.append((eye["native_ink"], 0.12))
    gap = metrics.get("floating_gap")
    if gap and gap["source"] >= 0.003:
        scores.append((min(1, gap["native"] / gap["source"]), 0.58))
    return sum(
        -max(0, 1 - v / full) + 0.001 * min(1.25, v / full) for v, full in scores
    )


def family_rank(report):
    """Compare candidates using the complete native checks before visual merit."""
    front = report.get("front")
    return report["accepted"], merit(front) if front else float("-inf")


def calibrate(source, parent, result, base, backend, budget):
    from .family_review import failed_front_checks, native_front, revise_family
    from .sun_rays import collar_closed

    recipe = json.loads((parent / "candidate.json").read_text())
    geometry = result["candidates"][recipe["family"]]
    family = recipe["family"]
    best = copy.deepcopy(recipe)

    def rank_front(m):
        passes = (
            not failed_front_checks(m)
            and not collar_closed(m.get("floating_gap"))
            and m.get("shirt_mark_agreement", 1) >= 0.65
        )
        return passes, merit(m)

    best_score = rank_front(result["front"])
    history = []
    # Source measurements propose precise pigment, clothing and eye edits.
    # Try coherent groups independently when applying them together missed.
    suggested = [
        e
        for e in result.get("suggested_edits", [])
        if e["field"] not in ("shirtMark", "visor")
    ]
    groups = [[e] for e in suggested if not e["field"].startswith("paints.")]
    paints = [e for e in suggested if e["field"].startswith("paints.")]
    if paints:
        groups.append(paints)

    with tempfile.TemporaryDirectory(dir=parent) as tmp, sync_playwright() as pw:
        browser, page = native_page(pw, base, backend)
        front = Path(tmp) / "front.png"
        seen = {json.dumps(best, sort_keys=True)}

        def try_value(trial, label):
            nonlocal best, best_score
            key = json.dumps(trial, sort_keys=True)
            if key in seen:
                return
            seen.add(key)
            path = Path(tmp) / f"trial-{len(seen)}.json"
            path.write_text(key)
            stage = page.locator(".stage canvas")
            previous = stage.element_handle() if stage.count() else None
            page.get_by_label("Open cartoon recipe").set_input_files(path)
            if previous:
                page.wait_for_function(
                    "c=>!c.isConnected || document.querySelector('header [role=alert]')",
                    arg=previous,
                )
            page.wait_for_function("""()=>document.querySelector('.stage canvas')?.dataset.framing==='authored/0/body' ||
                document.querySelector('header [role=alert]')""")
            if page.locator("header [role=alert]").count():
                raise ValueError(page.locator("header [role=alert]").inner_text())
            triangles = int(
                page.locator("small")
                .inner_text()
                .split(" triangles")[0]
                .replace(",", "")
            )
            if budget > 0 and triangles > budget:
                history.append({"field": label, "triangles": triangles})
                return
            # A shader may still be compiling on the first canvas frame.
            for frame in range(3):
                stage.screenshot(path=front)
                try:
                    m = native_front(source, front, family, geometry)
                    break
                except ValueError as exc:
                    if str(exc) != "The image has no foreground" or frame == 2:
                        raise
                    page.evaluate(
                        "new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))"
                    )
            passes, score = rank_front(m)
            history.append({"field": label, "front": m, "score": round(score, 6)})
            if (passes, score) > (best_score[0], best_score[1] + 0.0004):
                best, best_score = trial, (passes, score)

        try:
            for edits in groups:
                try_value(edited_recipe(best, edits), [e["field"] for e in edits])
            steps = [
                ("legLength", 0.035),
                ("build", 0.035),
                ("armSpan", 0.025),
                ("headHeight", 0.045),
                ("headWidth", 0.045),
            ]
            if family == "rick-classic":
                steps += [("jaw", 0.11), ("eyes", 0.045)]

            def proportions(steps):
                for key, step in steps:
                    before = best
                    val = best["proportions"].get(key, 1)
                    for sign in (-1, 1):
                        lo, hi = (0.8, 1.25) if key == "armSpan" else (0.65, 1.5)
                        upd = round(max(lo, min(hi, val + sign * step)), 4)
                        try_value(
                            edited_recipe(
                                before, [{"field": "proportions." + key, "value": upd}]
                            ),
                            [key, upd],
                        )

            proportions(steps)
            if family == "sunshine":
                # Scaling a single limb cross-section should not also change
                # the already fitted diameter of a sock or the wrist position.
                for part, step in (("arms", 0.16), ("legs", 0.09)):
                    before = best
                    for sign in (-1, 1):
                        cross = {**before.get("limbWidth", {"arms": 1, "legs": 1})}
                        cross[part] = round(
                            max(0.72, min(1.4, cross[part] + sign * step)), 3
                        )
                        try_value(
                            edited_recipe(
                                before, [{"field": "limbWidth", "value": cross}]
                            ),
                            [part, cross[part]],
                        )

                def orb_position(delta):
                    for axis in (1, 0):
                        before = best
                        for sign in (-1, 1):
                            point = before.get("orbOffset", [0, 0]).copy()
                            point[axis] = round(
                                max(-0.35, min(0.35, point[axis] + sign * delta)), 4
                            )
                            try_value(
                                edited_recipe(
                                    before, [{"field": "orbOffset", "value": point}]
                                ),
                                ["orbOffset", point],
                            )

                orb_position(0.048)
                if not best_score[0]:
                    proportions([(k, v * 0.43) for k, v in steps])
                    orb_position(0.019)
        finally:
            browser.close()
    edits = []
    for section in ("proportions", "paints"):
        for k, v in best[section].items():
            if v != recipe[section].get(k):
                edits.append({"field": section + "." + k, "value": v})
    edits.extend(
        {"field": k, "value": v}
        for k, v in best.items()
        if k not in ("paints", "proportions") and v != recipe.get(k)
    )
    (parent / "front-trials.json").write_text(
        json.dumps({"trials": history, "edits": edits}, indent=2) + "\n"
    )
    return (
        revise_family(source, parent, edits, base, backend, budget)
        if edits
        else (parent, result)
    )
