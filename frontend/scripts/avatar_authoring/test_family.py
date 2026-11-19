import json
import runpy
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
from unittest.mock import patch

import numpy as np
from PIL import Image, ImageDraw

from .family import eye_assembly_scale, shirt_mark
from .family_edits import edited_recipe
from .family_eyes import eye_agreement
from .family_review import compare_images, eyes_match, family_study
from .fit import pixels
from .provider import DrawingOnlyAdapter, review_family
from .rounded import register_cranium
from .sun_rays import collar_closed, floating_gap, measure_sun_rays, open_collar
from .visor import measure_visor, profile_gap


class FamilyTests(unittest.TestCase):
    def test_review_compares_two_passing_recipes_and_preserves_the_better_fit(self):
        author = runpy.run_path(str(Path(__file__).parents[1] / "author-cartoon.py"))[
            "author"
        ]
        scores = dict(
            silhouette_iou=0.93,
            head_iou=0.92,
            head_edge_agreement=0.82,
            body_edge_agreement=0.81,
            eye_pigment_agreement=0.88,
            rgb_mae=20,
        )
        baseline = {
            "family": "sunshine",
            "accepted": True,
            "native": {"triangles": 1400},
            "front": scores,
        }
        decision = {
            "use_family": True,
            "reason": "Review the crown",
            "edits": [{"field": "proportions.crownLength", "value": 1.1}],
        }
        for revised_head, expected in [(0.87, "base"), (0.96, "trial")]:
            with self.subTest(revised_head=revised_head), TemporaryDirectory() as tmp:
                root = Path(tmp)
                args = SimpleNamespace(
                    image=Path(__file__).parent / "targets" / "halo.webp",
                    output=root,
                    base="",
                    renderer="webgl",
                    max_triangles=4000,
                    observations=None,
                    auto=False,
                    model="control",
                    rounds=1,
                    within_family="auto",
                    name="Halo",
                    install=None,
                    openrouter=False,
                )

                def save(folder, label):
                    folder.mkdir()
                    for file in ("candidate.json", "recipe.json"):
                        (folder / file).write_text(json.dumps({"name": label}))

                def fit(source, output, family, *args, revisions, within):
                    self.assertEqual((family, revisions, within), ("auto", 1, True))
                    folder = output / "base"
                    save(folder, "base")
                    return folder, baseline, folder / "family-run.json"

                def revise(source, folder, *args):
                    candidate = folder.parent / "trial"
                    save(candidate, "trial")
                    return candidate, {
                        **baseline,
                        "front": {**scores, "head_iou": revised_head},
                    }

                with (
                    patch(
                        "avatar_authoring.family_review.fit_and_refine", side_effect=fit
                    ),
                    patch(
                        "avatar_authoring.family_review.revise_family",
                        side_effect=revise,
                    ),
                    patch.dict(
                        author.__globals__,
                        review_family=lambda *a: (decision, {"transport": "fixture"}),
                    ),
                ):
                    author(args)
                run = next(root.glob("study-*"))
                self.assertEqual(
                    json.loads((run / "recipe.json").read_text())["name"], expected
                )
                review = json.loads((run / "run.json").read_text())["family_review"]
                self.assertEqual(
                    review["reviews"][0]["trial_front"]["head_iou"], revised_head
                )
                self.assertEqual(review["baseline_front"]["head_iou"], 0.92)

    def test_both_eye_whites_constrain_the_family_eye_scale(self):
        y, x = np.mgrid[:50, :191]

        def whites(x):
            return (((abs(x - 95) - 34) / 21) ** 2 + ((y - 25) / 15) ** 2) < 1

        base = whites(x)
        narrow = whites(95 + (x - 95) / 0.78)
        self.assertAlmostEqual(eye_assembly_scale(base, narrow, 95), 0.78, delta=0.015)
        self.assertEqual(eye_assembly_scale(base, base, 95), 1)
        self.assertEqual(eye_assembly_scale(base, narrow & (x < 95), 95), 1)

    def test_floor_shadow_preserves_the_paper_between_both_legs(self):
        paper = "#fbf4e8"
        im = Image.new("RGB", (240, 300), paper)
        pen = ImageDraw.Draw(im)
        pen.ellipse((80, 18, 160, 90), fill="#bd7463")
        pen.line((24, 98, 216, 98), fill="#60625c", width=14)
        pen.rectangle((86, 79, 154, 184), fill="#60625c")
        pen.rectangle((108, 95, 128, 141), fill=paper)
        pen.rectangle((91, 180, 109, 278), fill="#373847")
        pen.rectangle((129, 180, 146, 278), fill="#373847")
        pen.rectangle((81, 275, 154, 279), fill="#c4b6a3")
        with TemporaryDirectory() as tmp:
            file = Path(tmp) / "shadow.png"
            im.save(file)
            _, mask = pixels(file, keep_components=True)
        self.assertFalse(mask[228, 119])
        self.assertTrue(mask[228, 102] and mask[228, 138])
        self.assertTrue(mask[112, 118])

    def test_edits_are_atomic_and_limited_to_the_selected_native_family(self):
        mascot = {"family": "sunshine", "proportions": {}, "paints": {}}
        scientist = {**mascot, "family": "rick-classic"}

        def edit(field, value):
            return {"field": field, "value": value}

        profile = [0.64, 0.8, 1, 1.1, 1.4, 1.3, 1.1, 0.65]
        changes = [
            edit("paints.rays", "#FaEe64"),
            edit("proportions.crownProfile", profile),
        ]
        revised = edited_recipe(mascot, changes)
        self.assertEqual(revised["paints"], {"rays": "#faee64"})
        self.assertEqual(revised["proportions"]["crownProfile"], profile)
        for invalid in (
            changes + [changes[0]],
            changes + [edit("proportions.depth", 0.7)],
            [edit("proportions.eyes", 1.25)],
            [edit("paints.trousers", "#556677")],
            [edit("proportions.crownProfile", profile[:7])],
            [edit("proportions.jaw", 2)],
            [edit("shirtMark", None)],
            [edit("proportions.jaw", float("nan"))],
        ):
            with self.assertRaises(ValueError):
                edited_recipe(mascot, invalid)
        self.assertEqual(mascot["paints"], {})
        self.assertEqual(mascot["proportions"], {})
        for points in ([[0, 0], [0, 0], [1, 1]], [[0, 0], [1, 1], [0.1, 1], [0.9, 0]]):
            with self.assertRaises(ValueError):
                edited_recipe(
                    scientist,
                    [edit("shirtMark", {"color": "#223344", "outline": points})],
                )

    def test_source_sample_draws_a_compact_print_and_plain_cloth_is_rejected(self):
        patch = Image.new("RGB", (97, 97), "#586b79")
        ImageDraw.Draw(patch).polygon(
            [(10, 32), (48, 20), (83, 34), (55, 72)], fill="#d9ae55"
        )
        base = {"family": "rick-classic", "proportions": {}, "paints": {}}
        edits = [{"field": "shirtMark", "value": {"sample": [0.5, 0.46]}}]
        out = edited_recipe(base, edits, np.asarray(patch, dtype=float))
        self.assertEqual(out["shirtMark"]["color"], "#d9ae55")
        self.assertLessEqual(len(out["shirtMark"]["outline"]), 10)
        with self.assertRaisesRegex(ValueError, "inside one solid"):
            edited_recipe(base, edits, np.zeros((97, 97, 3)))
        cleared = edited_recipe(out, [{"field": "shirtMark", "value": None}])
        self.assertEqual(cleared, base)

    def test_family_review_distinguishes_an_old_adapter_from_an_invalid_receipt(self):
        args = SimpleNamespace(model="fixture", adapter="/fixture")
        reply = {"model": "fixture", "arguments": {"landmarks": {}}}
        with patch("avatar_authoring.provider.subprocess.run") as run:
            run.return_value.stdout = json.dumps(reply)
            with self.assertRaises(DrawingOnlyAdapter):
                review_family(
                    args,
                    Path("front.png"),
                    Path("."),
                    {"family": "rick-classic"},
                    {"front": {}},
                )
            run.return_value.stdout = json.dumps({**reply, "model": "different"})
            with self.assertRaisesRegex(ValueError, "different model"):
                review_family(
                    args,
                    Path("front.png"),
                    Path("."),
                    {"family": "rick-classic"},
                    {"front": {}},
                )

    def test_eye_check_rejects_a_matching_head_with_empty_eyes(self):
        with TemporaryDirectory() as tmp:
            p = Path(tmp)
            im = Image.new("RGB", (200, 320), "white")
            pen = ImageDraw.Draw(im)
            pen.ellipse((55, 16, 145, 100), fill="#c39582")
            pen.rectangle((68, 96, 132, 280), fill="#548a79")
            for x in [81, 118]:
                pen.ellipse((x - 12, 47, x + 12, 68), fill="white")
            im.save(p / "absent.png")
            for x in [81, 118]:
                pen.ellipse((x - 3, 53, x + 3, 61), fill="#212121")
            im.save(p / "model.png")
            roi = [-0.13, 0.11, 0.13, 0.20]
            score = compare_images(p / "absent.png", p / "model.png", 0.33, roi)
            self.assertGreater(score["silhouette_iou"], 0.99)
            self.assertLess(score["eye_pigment_agreement"], 0.6)
            # Missing source or candidate pigment is a mismatch in either direction.
            reverse = compare_images(p / "model.png", p / "absent.png", 0.33, roi)
            self.assertLess(reverse["eye_pigment_agreement"], 0.60)

    def test_crown_rays_and_gap_are_measured_from_the_illustration(self):
        p = Path(__file__).parent / "targets" / "citrine.webp"
        frame = [-0.1017, 0.12206, 0.09304, 0.20808]
        image, mask = pixels(p, keep_components=True)
        y, x = np.where(mask)
        h = np.ptp(y)
        cx = (x.min() + x.max()) / 2 + (frame[0] + frame[2]) * h / 2
        cy = y.min() + (frame[1] + frame[3]) * h / 2
        r = (frame[2] - frame[0]) * h * 0.47
        rays, pigment = measure_sun_rays(image, mask, [cx, cy], [r, r])
        self.assertTrue(12 <= len(rays) <= 18)
        self.assertTrue(pigment.startswith("#"))
        for tri in rays:
            self.assertGreater(np.linalg.norm(tri, axis=1).min(), 0.92)
        self.assertTrue(0.012 < floating_gap(p, frame) < 0.03)
        fit = measure_visor(
            image, mask, measure_sun_rays(image, mask, [cx, cy], [r, r], orb_only=True)
        )
        self.assertEqual(len(fit["rows"]), 17)
        self.assertLess(fit["marks"][0][0], 0)
        self.assertGreater(fit["marks"][1][0], 0)
        self.assertLess(fit["rows"][8][1], fit["rows"][4][1])

    def test_a_shaded_corona_preserves_all_eleven_separate_rays(self):
        image, mask = pixels(
            Path(__file__).parent / "targets" / "halo.webp", keep_components=True
        )
        y, x = np.nonzero(mask)
        h = np.ptp(y)
        frame = [-0.10085, 0.12522, 0.09203, 0.20819]
        cx = (x.max() + x.min()) / 2 + h * (frame[0] + frame[2]) / 2
        cy = y.min() + h * (frame[1] + frame[3]) / 2
        radius = (frame[2] - frame[0]) * h * 0.47
        rays, _ = measure_sun_rays(image, mask, [cx, cy], [radius, radius])
        self.assertEqual(len(rays), 11)
        angles = np.sort(np.arctan2(*np.mean(rays, axis=1)[:, ::-1].T))
        self.assertGreater(np.min(np.diff(angles)), 0.16)

    def test_a_small_visible_collar_gap_moves_only_the_collar(self):
        gap = {"source": 0.0047, "native": 0}
        self.assertTrue(collar_closed(gap))
        recipe = {"kitFit": {"width": 1.14, "hem": 0.023}}
        edit = open_collar(recipe, gap)["value"]
        self.assertGreater(edit["collar"], gap["source"])
        self.assertEqual(edit["width"], 1.14)
        self.assertEqual(edit["hem"], 0.023)
        self.assertFalse(collar_closed({**gap, "native": 0.004}))

    def test_profile_flags_a_lens_hanging_clear_of_the_orb(self):
        with TemporaryDirectory() as tmp:
            p = Path(tmp)
            for name, tip in (("attached", 127), ("plate", 144)):
                image = Image.new("RGB", (210, 430), "#e4ddcf")
                pen = ImageDraw.Draw(image)
                pen.polygon([(100, 5), (95, 19), (105, 19)], fill="#ff7721")
                pen.ellipse((69, 30, 131, 94), fill="#198fa3")
                pen.rectangle((82, 98, 119, 394), fill="#746d66")
                pen.rectangle((97, 53, tip + 2, 56), fill="#161716")
                pen.rectangle((tip, 54, tip + 2, 76), fill="#161716")
                image.save(p / (name + ".png"))
            self.assertLessEqual(profile_gap(p / "attached.png", "#198fa3"), 0.006)
            self.assertGreater(profile_gap(p / "plate.png", "#198fa3"), 0.006)

    def test_scientist_with_one_missing_pupil_fails_despite_inked_eyelids(self):
        with TemporaryDirectory() as tmp:
            folder = Path(tmp)
            image = Image.new("RGB", (230, 400), "#fffdfa")
            pen = ImageDraw.Draw(image)
            pen.ellipse((62, 17, 167, 119), fill="#b98467")
            pen.rectangle((66, 104, 164, 372), fill="#546e67")
            for x in (96, 133):
                pen.ellipse(
                    (x - 12, 48, x + 12, 72), fill="#fffff2", outline="#252020", width=2
                )
            pen.ellipse((93, 56, 99, 63), fill="#242020")
            image.save(folder / "one.png")
            pen.ellipse((130, 56, 136, 63), fill="#242020")
            image.save(folder / "both.png")
            frame = [-0.102, 0.081, 0.102, 0.175]
            pair = eye_agreement(folder / "both.png", folder / "one.png", frame)
            self.assertEqual(pair, {"paired_pupils": False})
            self.assertFalse(
                eyes_match({"globe_measurements": pair, "eye_pigment_agreement": 0.98})
            )

    def test_half_lidded_eyes_survive_resizing_and_reject_a_shifted_pupil(self):
        with TemporaryDirectory() as tmp:
            folder = Path(tmp)
            image = Image.new("RGBA", (230, 400), (0, 0, 0, 0))
            pen = ImageDraw.Draw(image)
            pen.ellipse((62, 17, 167, 119), fill="#e7d9cf")
            pen.rectangle((66, 104, 164, 372), fill="#b24a50")
            for x in (96, 133):
                pen.ellipse((x - 10, 55, x + 10, 62), fill="#fffdfa")
                pen.rectangle((x, 58, x + 1, 59), fill="#242020")
            source, native = folder / "source.png", folder / "native.png"
            image.save(source)
            image.resize((254, 442), Image.Resampling.LANCZOS).save(native)
            frame = [-0.10, 0.09, 0.10, 0.15]

            def agrees():
                pair = eye_agreement(source, native, frame, lowered=True)
                self.assertIsNotNone(pair)
                return eyes_match({"globe_measurements": pair})

            self.assertTrue(agrees())
            pen.rectangle((133, 58, 134, 59), fill="#fffdfa")
            pen.rectangle((139, 58, 140, 59), fill="#242020")
            image.save(native)
            self.assertFalse(agrees())

    def test_unmeasurable_picture_returns_a_family_miss_to_the_author(self):
        with TemporaryDirectory() as tmp:
            directory = Path(tmp)
            image = directory / "single-row.png"
            drawing = Image.new("RGB", (120, 12), "white")
            ImageDraw.Draw(drawing).line((0, 6, 119, 6), fill="#776252")
            drawing.save(image)
            study, review = family_study(
                image, directory, "auto", "drawing", "", "webgl", 4000
            )
            self.assertFalse(review["accepted"])
            self.assertTrue(review["reason"])
            self.assertEqual(json.loads((study / "review.json").read_text()), review)

    def test_turn_keeps_the_pivot_from_the_front_photo(self):
        with TemporaryDirectory() as tmp:
            folder = Path(tmp)
            for name, cx in (("front", 58), ("side", 58), ("offset", 72)):
                image = Image.new("RGB", (115, 170), "white")
                pen = ImageDraw.Draw(image)
                pen.ellipse((cx - 12, 12, cx + 12, 36), fill="#ad7159")
                pen.rectangle((cx - 16, 37, cx + 16, 151), fill="#607276")
                image.save(folder / (name + ".png"))
            front, side, offset = (
                folder / (name + ".png") for name in ("front", "side", "offset")
            )
            self.assertGreater(compare_images(side, offset)["silhouette_iou"], 0.99)
            fixed = compare_images(side, offset, front_frames=(front, front))
            self.assertLess(fixed["silhouette_iou"], 0.60)

    def test_fitted_part_registration_preserves_curvature_and_depth_scale(self):
        rows = [
            [0, -1, 1, 2, 3, 0.35, 2.5],
            [4, -5, 5, 6, 1, 0.6, 3],
            [12, -1, 1, 2, 2, 0.5, 2],
        ]
        part = {"parts": [{"bone": "head", "roundedProfile": rows}]}
        fitted = register_cranium(part, [20, 36])
        self.assertEqual(fitted[1], [24, -10, 10, 12, 2, 0.6, 3])
        self.assertEqual(fitted[-1][0], 48)
        self.assertEqual(rows[0][0], 0)
        with self.assertRaises(ValueError):
            register_cranium(
                {"parts": [{**part["parts"][0], "caps": "none"}]}, [20, 36]
            )

    def test_an_enclosed_garment_mark_fits_without_a_bitmap(self):
        im = Image.new("RGB", (128, 128), "#85bca5")
        ImageDraw.Draw(im).polygon(
            [(62, 33), (98, 39), (75, 55), (90, 57), (34, 97), (52, 65), (29, 65)],
            fill="#ad376a",
        )
        labels = np.ones((128, 128), dtype=int)
        result = shirt_mark(
            np.asarray(im, dtype=float), labels, 1, [[10, 10], [118, 118]], 0, 0, 1
        )
        self.assertEqual(result["color"], "#ad376a")
        self.assertLessEqual(len(result["outline"]), 12)
        self.assertTrue(all(0 < x < 1 and 0 < y < 1 for x, y in result["outline"]))

    def test_hosted_likeness_review_requests_a_single_explicit_decision(self):
        args = SimpleNamespace(model="fixture", adapter=None, openrouter=True)
        with (
            patch(
                "avatar_authoring.provider.image_url",
                return_value="data:image/jpeg;base64,test",
            ),
            patch("avatar_authoring.provider.fetch_json") as request,
        ):
            request.return_value = {
                "model": "fixture",
                "id": "fixture-only",
                "output": [
                    {
                        "type": "function_call",
                        "name": "review_avatar_family",
                        "arguments": json.dumps(
                            {"use_family": False, "reason": "Different hair and coat."}
                        ),
                    }
                ],
            }
            decision, receipt = review_family(
                args,
                Path("front.png"),
                Path("."),
                {"family": "rick-classic"},
                {"front": {}},
            )
            self.assertFalse(decision["use_family"])
            self.assertEqual(receipt["request_id"], "fixture-only")
            body = request.call_args.args[2]
            self.assertEqual(body["tool_choice"]["name"], "review_avatar_family")
            self.assertEqual(
                sum(m["type"] == "input_image" for m in body["input"][0]["content"]), 3
            )
