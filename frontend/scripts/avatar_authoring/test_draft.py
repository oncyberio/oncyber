"""Image-only acquisition and revision protocol regressions."""

import io
import json
import runpy
import tempfile
import unittest
from itertools import pairwise
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import numpy as np
from jsonschema import Draft202012Validator
from PIL import Image, ImageDraw, ImageOps

from .draft import propose, shirt_bands
from .fit import fit
from .observation import draft_edits, observations
from .profile import compare_profile, fit_profile
from .provider import ask, openrouter_model
from .review import detached_parts, hair_coverage, painted_face_iou
from .study import Study, score, write
from .tracing import painted_open_mouth, scalp_pigment


def drawing(eyes=True):
    im = Image.new("RGB", (360, 390), "white")
    pen = ImageDraw.Draw(im)
    skin = (203, 144, 94)
    pen.ellipse((124, 9, 235, 112), fill=skin, outline="black", width=2)
    pen.pieslice((124, 7, 235, 85), 180, 355, fill="#273922")
    if eyes:
        for x in (145, 188):
            pen.ellipse((x, 48, x + 29, 75), fill="white", outline="black", width=2)
            pen.ellipse((x + 17, 58, x + 22, 64), fill="black")
    pen.line([(164, 91), (179, 95), (196, 90)], fill="black", width=2)
    pen.rectangle((164, 108, 194, 145), fill=skin)
    pen.rectangle((10, 133, 349, 151), fill=skin)
    pen.rectangle((101, 128, 260, 158), fill="#602442")
    pen.rectangle((132, 130, 227, 234), fill="#602442")
    pen.rectangle((132, 174, 227, 189), fill="#93d8bb")
    for l, r in ((136, 171), (185, 221)):
        pen.rectangle((l, 233, r, 349), fill="#28394f")
        pen.rectangle((l - 4, 350, r + 4, 375), fill="#e5cea0")
    return im


class DraftTests(unittest.TestCase):
    def test_thin_enamel_on_a_pale_face_survives_whole_body_resolution(self):
        skin = np.array([251, 234, 218])
        picture = np.full((100, 90, 3), skin, dtype=float)
        picture[51:61, 32:58] = [84, 11, 17]
        self.assertIsNone(painted_open_mouth(picture, skin, 45, 34, 71, 56))
        picture[50, 37:48] = [204, 194, 186]
        rows, _, enamel, _ = painted_open_mouth(picture, skin, 45, 34, 71, 56)
        self.assertTrue(np.any(rows[:, 2] > rows[:, 1]))
        np.testing.assert_array_equal(enamel, [204, 194, 186])

    def test_long_coat_keeps_the_underlying_shirt_trousers_and_sleeve_paint(self):
        image = drawing()
        pen = ImageDraw.Draw(image)
        for a, b in [(32, 155), (205, 327)]:
            pen.rectangle((a, 132, b, 152), fill="#327079")
        for panel in [
            [(128, 131), (156, 131), (149, 231), (132, 302), (115, 302)],
            [(205, 131), (230, 131), (245, 302), (228, 302), (214, 231)],
        ]:
            pen.polygon(panel, fill="#36838c")
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "coat.png"
            image.save(path)
            draft = propose(path, "Long teal coat")
            self.assertEqual(draft["top"], "open-coat")
            design = fit(path, draft)["design"]
            body = design["fit"]["sections"]
            coat = body["coat"]
            self.assertEqual((coat["color"], coat["sleeves"]), ("#36838c", "#327079"))
            self.assertEqual(design["outfit"]["color"], "#602442")
            self.assertTrue(all(left < a < b < right for _,left,a,b,right in coat["rows"]))
            self.assertLess(body["pelvis"][0][1], coat["rows"][-1][-1] * 0.7)
            self.assertGreater(body["sleeve"], body["arm"][-1][0]*0.8)
            drawing().save(path)
            self.assertEqual(propose(path, "Short sleeves")["top"], "crew")

    def test_shirt_retains_a_thin_full_width_stripe_and_skips_a_short_crease(self):
        shirt = np.array([24, 145, 153])
        rgb = np.broadcast_to(shirt, (220, 120, 3)).copy()
        rgb[70:73, 12:108] = [236, 190, 41]
        rgb[90:93, 42:78] = [20, 35, 40]
        rgb[121:148, 40:80] = [244, 194, 42]
        bands = shirt_bands(
            rgb, shirt, 60, 100, 20, 210, lambda xy: {"x": xy[0], "y": xy[1]}
        )
        self.assertEqual([(b["topY"], b["bottomY"]) for b in bands], [(70, 72)])

    def test_side_portrait_preserves_depth_under_mirroring_and_measures_an_incorrect_bob(
        self,
    ):
        design = {
            "hair": {"color": "#204944", "cut": "bob"},
            "skin": "#ce8655",
            "outfit": {"color": "#eb6556"},
            "head": [100, 152],
            "face": {"eyeHeight": 0.51, "noseBase": 0.69},
        }
        im = Image.new("RGB", (270, 310), "#eeeeee")
        draw = ImageDraw.Draw(im)
        draw.rectangle((125, 170, 153, 273), fill=design["skin"])
        draw.ellipse((51, 27, 219, 230), fill=design["skin"])
        draw.ellipse((197, 150, 233, 171), fill=design["skin"])
        draw.ellipse((172, 105, 212, 145), fill="white", outline="black", width=2)
        draw.ellipse((200, 117, 208, 125), fill="black")
        draw.polygon(
            [
                (126, 20),
                (172, 25),
                (203, 52),
                (159, 92),
                (136, 154),
                (146, 219),
                (79, 229),
                (43, 197),
                (38, 91),
                (62, 46),
            ],
            fill=design["hair"]["color"],
        )
        draw.ellipse((62, 256, 232, 333), fill=design["outfit"]["color"])
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            ref, opposite = root / "ref.png", root / "opposite.png"
            im.save(ref)
            ImageOps.mirror(im).save(opposite)
            first = fit_profile(ref, design)
            self.assertGreater(first["noseRise"], 1)
            profile = first["noseProfile"]
            self.assertEqual([profile[0][1], profile[-1][1]], [0.0, 0.0])
            self.assertAlmostEqual(max(p[1] for p in profile), first["noseRise"])
            self.assertGreater(first["eyeSpan"], 2)
            rows = first["eyeRows"]
            self.assertEqual([rows[0][0], rows[-1][0]], [0.0, 1.0])
            self.assertTrue(all(a[0] < b[0] for a, b in pairwise(rows)))
            self.assertTrue(all(row[1] <= row[2] for row in rows))
            self.assertGreater(first["pupilDepth"], first["eyeCenter"])
            self.assertEqual(first, fit_profile(opposite, design))
            self.assertEqual(
                compare_profile(ref, opposite, design, root / "review.png")["skin_iou"],
                1,
            )
            draw.polygon(
                [(89, 71), (131, 80), (159, 130), (172, 209), (121, 226), (74, 216)],
                fill=design["hair"]["color"],
            )
            im.save(opposite)
            self.assertLess(
                compare_profile(ref, opposite, design, root / "review.png")["skin_iou"],
                0.86,
            )

    def test_router_model_requires_an_exact_unique_catalog_match(self):
        entries = [
            {"id": "a/cartoon"},
            {"id": "b/cartoon"},
            {"id": "a/cartoon-preview"},
        ]
        with patch(
            "avatar_authoring.provider.fetch_json", return_value={"data": entries}
        ):
            self.assertEqual(openrouter_model("a/cartoon"), "a/cartoon")
            self.assertEqual(openrouter_model("cartoon-preview"), "a/cartoon-preview")
            for model in ("cartoon", "unknown", "cart"):
                with self.assertRaisesRegex(
                    ValueError, "exact OpenRouter catalog match"
                ):
                    openrouter_model(model)

    def test_router_uses_its_own_key_on_its_fixed_responses_endpoint(self):
        model = "provider/fixture"
        args = SimpleNamespace(adapter=None, openrouter=True, model=model)
        response = {
            "id": "fixture-id",
            "model": model,
            "output": [
                {"type": "function_call", "name": "draw_cartoon", "arguments": "{}"}
            ],
        }
        with (
            patch.dict(
                "os.environ",
                {"OPENROUTER_API_KEY": "fixture", "AVATAR_MODEL_API_KEY": "other"},
            ),
            patch(
                "avatar_authoring.provider.fetch_json", return_value=response
            ) as http,
        ):
            _, receipt = ask(args, [], "")
            url, key, body = http.call_args.args
            self.assertEqual(
                (url, key, body["model"]),
                ("https://openrouter.ai/api/v1/responses", "fixture", model),
            )
            self.assertGreaterEqual(receipt.pop("seconds"), 0)
            self.assertIsNone(receipt.pop("usage"))
            self.assertEqual(
                receipt,
                {
                    "transport": "openrouter",
                    "reported_model": model,
                    "request_id": "fixture-id",
                },
            )

    def test_a_reviewed_preview_reuses_native_output_and_still_requires_a_qualifying_draw(
        self,
    ):
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp) / "character.png"
            drawing().save(source)
            study = Study(
                SimpleNamespace(
                    image=source,
                    output=Path(tmp) / "study",
                    base="",
                    renderer="webgl",
                    max_triangles=4000,
                )
            )
            draft = study.prepare_draft("Proposal")

            def capture(recipe, directory, *args, **kw):
                for name in (
                    "front.png",
                    "comparison.png",
                    "portrait-review.png",
                    "walk.webp",
                ):
                    (directory / name).write_bytes(b"capture")
                return {"triangles": 3000}

            metrics = {
                "silhouette_iou": 0.95,
                "regions": {"body": 0.95},
                "profile_nose_visible": True,
                "foreground_rgb_mae": 3,
                "face_rgb_mae": 7,
                "face_edge_agreement": 0.9,
                "eyes": {"status": "matched"},
            }
            receipt = {"transport": "adapter", "reported_model": "fixture"}
            edits = {"name": "Named character", "base_pass": 0, "edits": []}
            with (
                patch("avatar_authoring.study.render", side_effect=capture) as render,
                patch("avatar_authoring.study.evaluate", return_value=metrics),
            ):
                study.preview(draft)
                study.preview(draft)
                self.assertEqual(study.summary["attempts"], [])
                self.assertFalse((study.run / "recipe.json").exists())
                study.budget = 2900
                study.draw(edits, receipt, draft)
                self.assertIsNone(study.best)
                study.budget = 4000
                directory, _ = study.draw(edits, receipt, draft)
                self.assertEqual(render.call_count, 1)
                self.assertEqual(
                    study.summary["attempts"][-1]["rendered_from"], "preview"
                )
                self.assertEqual((directory / "walk.webp").read_bytes(), b"capture")
                self.assertEqual(
                    json.loads((study.run / "recipe.json").read_text())["name"],
                    "Named character",
                )
                study.draw(
                    {**edits, "edits": [{"field": "parts.palmRoll", "value": 27}]},
                    receipt,
                    draft,
                )
                self.assertEqual(render.call_count, 2)
                selected = study.summary["selected"]
                study.profile = source
                for side in [
                    {
                        "silhouette_iou": 0.95,
                        "skin_iou": 0.90,
                        "hair_iou": 0.93,
                        "pupil_visible": True,
                        "pupil_x_error": 0.50,
                    },
                    {"silhouette_iou": 0.66, "skin_iou": 0.27, "hair_iou": 0.46},
                    {"silhouette_iou": 0.95, "skin_iou": 0.9, "hair_iou": 0.91, "eye_size_error": 0.42},
                    {
                        "silhouette_iou": 0.94,
                        "skin_iou": 0.82,
                        "hair_iou": 0.90,
                        "pupil_visible": False,
                    },
                ]:
                    with patch.object(
                        study,
                        "render_observation",
                        return_value=(
                            {**metrics, "triangles": 3000, "side_view": side},
                            None,
                        ),
                    ):
                        _, rejected = study.draw(edits, receipt, draft)
                    self.assertEqual(study.summary["selected"], selected)
                    self.assertEqual(
                        study.summary["attempts"][-1]["side_review"], "revise"
                    )
                    self.assertIn("side_feedback", rejected)

    def test_turn_review_detects_a_collapsed_far_eye_with_the_same_head_outline(self):
        design = {"hair": {"color": "#21413e"}, "skin": "#d48f61"}

        def portrait(far_radius, near_radius=26, gaze=0):
            im = Image.new("RGB", (240, 300), "#eeeeee")
            p = ImageDraw.Draw(im)
            p.ellipse((28, 12, 209, 245), fill=design["hair"]["color"])
            p.ellipse((79, 62, 206, 236), fill=design["skin"])
            for x, rx in ((130, near_radius), (183, far_radius)):
                p.ellipse(
                    (x - rx, 103, x + rx, 139), fill="white", outline="black", width=2
                )
                p.ellipse((x + gaze - 3, 117, x + gaze + 3, 123), fill="black")
            return im

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            ref = root / "guide.png"
            actual = root / "actual.png"
            portrait(17).save(ref)
            portrait(17, gaze=10).save(actual)
            shifted = compare_profile(ref, actual, design, root / "review.png", quarter=True)
            self.assertEqual(shifted["eye_width_error"], 0)
            self.assertGreater(shifted["pupil_x_error"], 0.23)
            portrait(5).save(actual)
            result = compare_profile(
                ref, actual, design, root / "review.png", quarter=True
            )
            self.assertEqual(result["silhouette_iou"], 1)
            self.assertGreater(result["eye_width_error"], 0.35)
            portrait(10, near_radius=15).save(actual)
            both = compare_profile(ref, actual, design, root / "review.png", quarter=True)
            self.assertLess(both["eye_width_error"], 0.06)
            self.assertGreater(both["eye_size_error"], 0.35)
            front = {
                "silhouette_iou": 1,
                "profile_nose_visible": True,
                "regions": {"torso": 1},
                "foreground_rgb_mae": 0,
                "face_rgb_mae": 0,
                "face_edge_agreement": 1,
            }
            smaller = {**both, "eye_size_error": 0.22}
            closer = {**both, "eye_size_error": 0.05}
            self.assertGreater(
                score({**front, "quarter_view": closer}),
                score({**front, "quarter_view": smaller}),
            )
            # Two drawings can describe different expressions of the same eyes.
            # Score the requested pose independently of the resting turnaround.
            looks_away = {**closer, "pupil_x_error": 0.7}
            target_gaze = {**closer, "pupil_x_error": 0.01}
            self.assertGreater(
                score({**front, "quarter_view": looks_away, "quarter_expression": target_gaze}),
                score({**front, "quarter_view": target_gaze, "quarter_expression": looks_away}),
            )


    def test_source_only_draft_measures_colors_eyes_band_and_trouser_cuff(self):
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp) / "drawing.png"
            img = drawing()
            img.save(p)
            draft = propose(p, "Radio operator")
            Draft202012Validator(observations).validate(draft)
            for name, x in [("leftEye", 159), ("rightEye", 202)]:
                self.assertAlmostEqual(
                    draft["landmarks"][name]["x"] * 0.359, x, delta=2
                )
            self.assertAlmostEqual(
                draft["landmarks"]["ankle"]["y"] * 0.389, 350, delta=3
            )
            self.assertEqual(len(draft["bands"]), 1)
            for name, expected in [
                ("shirt", (96, 36, 66)),
                ("hair", (39, 57, 34)),
                ("trousers", (40, 57, 79)),
            ]:
                point = draft["samples"][name]
                self.assertEqual(
                    img.getpixel(
                        (round(point["x"] * 0.359), round(point["y"] * 0.389))
                    ),
                    expected,
                )
            self.assertAlmostEqual(draft["bands"][0]["topY"] * 0.389, 174, delta=2)
            drawing(eyes=False).save(p)
            with self.assertRaisesRegex(ValueError, "eye openings"):
                propose(p, "Radio operator")

    def test_changes_are_typed_scoped_and_can_start_from_a_saved_pass(self):
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp) / "test.png"
            drawing().save(p)
            study = Study(
                SimpleNamespace(
                    image=p,
                    output=Path(tmp) / "studies",
                    base="",
                    renderer="webgl",
                    max_triangles=4000,
                )
            )
            draft = study.prepare_draft()
            args = {
                "name": "First",
                "base_pass": 0,
                "edits": [
                    {"field": "details.noseProjection", "value": 1.25},
                    {"field": "details.eyeDepthScale", "value": 1.08},
                ],
            }
            candidate = study.resolve_edits(draft, args)
            self.assertEqual(draft["details"]["noseProjection"], 1)
            self.assertEqual(candidate["details"]["noseProjection"], 1.25)
            self.assertNotIn("eyeDepthScale", draft["details"])
            face = fit(p, candidate, measure=False)["design"]["face"]
            self.assertEqual(face["eyeDepthScale"], 1.08)
            bob = study.resolve_edits(draft, {
                "name": "Side part", "base_pass": 0, "edits": [
                    {"field": "haircut", "value": "bob"},
                    {"field": "details.fringeDepthScale", "value": 0.94},
                ],
            })
            self.assertEqual(fit(p, bob, measure=False)["design"]["hair"]["fringeDepthScale"], 0.94)
            self.assertNotIn("fringeDepthScale", draft["details"])
            saved = study.run / "pass-1"
            saved.mkdir()
            write(saved / "observations.json", candidate)
            second = study.resolve_edits(
                draft,
                {
                    "name": "Second",
                    "base_pass": 1,
                    "edits": [{"field": "bands", "value": []}],
                },
            )
            self.assertEqual(second["details"]["noseProjection"], 1.25)
            self.assertEqual(second["bands"], [])
            self.assertEqual(second["landmarks"], draft["landmarks"])
            with self.assertRaisesRegex(ValueError, "No saved"):
                study.resolve_edits(draft, {**args, "base_pass": 2})
            with self.assertRaisesRegex(ValueError, "Conflicting edits"):
                study.resolve_edits(draft, {**args, "edits": args["edits"] * 2})
            validator = Draft202012Validator(draft_edits)
            for field, value in [
                ("details.noseProjection", 9),
                ("details.eyeDepthScale", 0),
                ("samples.skin", {"x": 12}),
                ("model", "example"),
            ]:
                self.assertFalse(
                    validator.is_valid(
                        {**args, "edits": [{"field": field, "value": value}]}
                    )
                )

    def test_hosted_image_draft_forces_the_revision_tool_and_checks_its_receipt(self):
        args = SimpleNamespace(
            adapter=None,
            endpoint="https://example.invalid/responses",
            model="test-model",
        )
        request_args = {"name": "Lane", "base_pass": 0, "edits": []}

        def response(model):
            return io.BytesIO(
                json.dumps(
                    {
                        "id": "test-id",
                        "model": model,
                        "output": [
                            {
                                "type": "function_call",
                                "name": "draw_from_draft",
                                "arguments": json.dumps(request_args),
                            }
                        ],
                    }
                ).encode()
            )

        with patch(
            "urllib.request.OpenerDirector.open", return_value=response("test-model")
        ) as http:
            reply, receipt = ask(args, [], "", {"version": 2, "name": "Proposal"})
            body = json.loads(http.call_args.args[0].data)
            self.assertEqual(body["tool_choice"]["name"], "draw_from_draft")
            self.assertEqual(len(body["tools"]), 1)
            self.assertEqual(reply, request_args)
            self.assertEqual(receipt["request_id"], "test-id")
        with (
            patch(
                "urllib.request.OpenerDirector.open", return_value=response("different")
            ),
            self.assertRaisesRegex(ValueError, "different model"),
        ):
            ask(args, [], "", {"version": 2, "name": "Proposal"})

    def test_hosted_manual_landmarks_can_be_revised_after_a_rejected_submission(self):
        author = runpy.run_path(str(Path(__file__).parents[1] / "author-cartoon.py"))[
            "author"
        ]
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            image = root / "character.png"
            drawing().save(image)
            measured = propose(image, "Manual landmarks")
            drawing(eyes=False).save(image)
            args = SimpleNamespace(
                image=image,
                output=root,
                model="fixture",
                name=None,
                base="",
                renderer="webgl",
                max_triangles=4000,
                observations=None,
                auto=False,
                install=None,
                rounds=3,
                adapter=None,
                endpoint="https://example.invalid",
                openrouter=False,
            )
            edit = {"name": measured["name"], "base_pass": 2, "edits": []}
            replies = iter([{}, measured, edit])
            requests = []

            def respond(url, key, body):
                name = body["tool_choice"]["name"]
                requests.append((name, body["input"][0]["content"][0]["text"]))
                return {
                    "model": "fixture",
                    "output": [
                        {
                            "type": "function_call",
                            "name": name,
                            "arguments": json.dumps(next(replies)),
                        }
                    ],
                }

            def capture(recipe, directory, *args, **kwargs):
                for name in ("comparison.png", "portrait-review.png", "walk.webp"):
                    drawing().save(directory / name)
                return {"triangles": 2100}

            metrics = {
                "regions": {"body": 0.9},
                "silhouette_iou": 0.9,
                "profile_nose_visible": True,
                "foreground_rgb_mae": 4,
                "face_rgb_mae": 7,
                "face_edge_agreement": 0.9,
            }
            with (
                patch("avatar_authoring.provider.fetch_json", side_effect=respond),
                patch("avatar_authoring.study.render", side_effect=capture),
                patch("avatar_authoring.study.evaluate", return_value=metrics),
            ):
                author(args)
            self.assertEqual(
                [name for name, _ in requests],
                ["draw_cartoon", "draw_cartoon", "draw_from_draft"],
            )
            self.assertIn("base_pass 2", requests[2][1])
            summary = json.loads(next(root.glob("study-*/run.json")).read_text())
            self.assertIn("eye openings", summary["draft_unavailable"])
            self.assertEqual(summary["selected"], "pass-3")
            self.assertEqual(summary["attempts"][-1]["rendered_from"], "pass-2")

    def test_ink_separated_locks_survive_without_absorbing_the_brow(self):
        figure = np.zeros((80, 90), bool)
        figure[7:75, 9:81] = True
        locks = np.zeros_like(figure)
        locks[7:18, 9:51] = True
        locks[7:19, 57:81] = True
        locks[17:43, 73:81] = True
        locks[27:31, 47:66] = True
        actual = scalp_pigment(locks, figure, (26, 12), 71, 160)
        self.assertTrue(actual[21, 76])
        self.assertFalse(actual[28, 56])
        reference = np.full((*figure.shape, 3), [193, 120, 82], dtype=np.uint8)
        hair = np.array([40, 55, 23])
        reference[locks] = hair
        missing = reference.copy()
        missing[:, 49:] = [193, 120, 82]
        images = list(map(Image.fromarray, [reference, missing]))
        recall = hair_coverage(
            images, [figure, figure], np.array([193, 120, 82]), hair, 70
        )
        self.assertLess(recall, 0.70)

    def test_isolated_foot_and_wrong_face_shape_are_visible_independent_of_gaze(self):
        mask = np.zeros((90, 60), bool)
        mask[10:72, 24:39] = True
        mask[75:80, 24:36] = True
        self.assertEqual(detached_parts(mask), 1)
        mask[70:77, 26:31] = True
        self.assertEqual(detached_parts(mask), 0)
        skin = np.array([197, 126, 82])
        hair = np.array([24, 66, 55])
        colors = np.tile(hair, (90, 60, 1)).astype("uint8")
        colors[20:70, 14:40] = skin
        ref = Image.fromarray(colors)
        self.assertEqual(painted_face_iou(ref, ref, skin, hair, 70), 1)
        colors[28:65, 24:40] = hair
        self.assertLess(
            painted_face_iou(ref, Image.fromarray(colors), skin, hair, 70), 0.6
        )

    def test_face_comparison_excludes_the_studio_from_tan_skin(self):
        hair = np.array([59, 42, 87])
        skin = np.array([241, 180, 131])
        images = []
        for bg in ([255, 255, 255], [232, 226, 214]):
            rgb = np.full((90, 60, 3), bg, dtype=np.uint8)
            rgb[20:70, 14:40] = skin
            rgb[10:20, 13:41] = hair
            images.append(Image.fromarray(rgb))
        self.assertEqual(painted_face_iou(*images, skin, hair, 70), 1)

    def test_compact_part_edits_flow_into_a_new_recipe_without_moving_the_landmarks(
        self,
    ):
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp) / "figure.png"
            drawing().save(p)
            study = Study(
                SimpleNamespace(
                    image=p,
                    output=Path(tmp) / "study",
                    base="",
                    renderer="webgl",
                    max_triangles=4000,
                )
            )
            draft = study.prepare_draft()
            edits = {
                "name": "Alternate",
                "base_pass": 0,
                "edits": [
                    {"field": "parts.legs", "value": "sunshine"},
                    {"field": "parts.palmRoll", "value": 43},
                ],
            }
            corrected = study.resolve_edits(draft, edits)
            design = fit(p, corrected)["design"]
            self.assertEqual(design["parts"]["legs"], "sunshine")
            self.assertEqual(design["parts"]["palmRoll"], 43)
            self.assertEqual(draft["landmarks"], corrected["landmarks"])
            with self.assertRaises(ValueError):
                study.resolve_edits(
                    draft,
                    {**edits, "edits": [{"field": "parts.feet", "value": "unknown"}]},
                )
