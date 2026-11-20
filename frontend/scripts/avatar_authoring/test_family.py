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
from .sun_rays import (
    collar_closed,
    floating_gap,
    jersey_neck,
    measure_sun_rays,
    open_collar,
    orb_contour,
    shorts_cut,
)
from .visor import measure_visor, profile_gap


class FamilyTests(unittest.TestCase):
    def test_gallery_identity_ties_do_not_count_as_a_match(self):
        from runpy import run_path

        rank = run_path(
            str(Path(__file__).resolve().parents[1] / "compare-avatar-identities.py")
        )["rank"]
        same, other = np.eye(2)
        self.assertEqual(rank({"a": same, "b": other}, same, "a")["rank"], 1)
        self.assertEqual(rank({"a": same, "b": same}, same, "a")["rank"], 2)
        self.assertLess(rank({"a": same, "b": other}, other, "a")["margin"], 0)

    def test_graph_cut_recovers_known_inked_figures_on_grained_paper(self):
        from importlib.util import find_spec
        from .fit import pixels
        from .paper_control import painted_figure

        if find_spec("cv2") is None:
            self.skipTest("Install OpenCV for the painted figure control")
        # Paint independently on alpha, then composite, grain and compress
        # three paper colours. The original alpha supplies the answer.
        shape = Image.new("RGBA", (272, 320))
        pen = ImageDraw.Draw(shape)
        pen.ellipse((103, 30, 169, 100), fill="#e2a97a", outline="#241d20")
        pen.ellipse((115, 52, 135, 74), fill="#fffdf6", outline="#28201c", width=2)
        pen.rectangle((30, 109, 241, 124), fill="#d59b75", outline="#241d20")
        pen.rectangle((105, 99, 167, 195), fill="#f3f0e9", outline="#231c24")
        pen.rectangle((105, 196, 132, 282), fill="#2d4250")
        pen.rectangle((144, 196, 167, 279), fill="#2d4250")
        for x in (110, 137, 161):
            pen.ellipse((x - 1, 18, x + 1, 25), fill="#738fcc")
        truth = np.asarray(shape.getchannel("A")) > 127
        y, x = np.indices(truth.shape)
        rng = np.random.default_rng(882)
        with TemporaryDirectory() as tmp:
            for paper in ((246, 240, 225), (217, 219, 222), (193, 203, 225)):
                grain = (
                    8 * x / 272 + 5 * y / 320 - 6.5 + rng.normal(0, 1.7, truth.shape)
                )
                bg = Image.fromarray(
                    np.clip(np.array(paper) + grain[:, :, None], 0, 255).astype("uint8")
                )
                bg.paste(shape, mask=shape.getchannel("A"))
                path = Path(tmp) / "paper.webp"
                bg.save(path, quality=83)
                rgb, raw = pixels(path, keep_components=True)
                paint = painted_figure(rgb, raw)
                jaccard = lambda m: (m & truth).sum() / (m | truth).sum()
                self.assertGreater(jaccard(paint), max(0.95, jaccard(raw)))
                self.assertTrue(paint[130:180, 112:163].all())
                self.assertTrue(paint[57:69, 121:131].all())
                self.assertTrue(paint[20:24, [110, 137, 161]].all())
                self.assertFalse(paint[210:276, 138:143].any())

    def test_orb_irradiance_recovers_a_frontal_key_and_excludes_the_lens(self):
        from .sun_rays import measured_orb_paint

        v, u = np.mgrid[-1:1:181j, -1:1:181j]
        mask = u * u + v * v <= 1
        z = np.sqrt(np.maximum(0, 1 - u * u - v * v))
        key = np.exp(0.32 * u + 0.74 * z)
        linear = key[:, :, None] * np.array([0.26, 0.19, 0.11])
        rgb = (1.055 * linear ** (1 / 2.4) - 0.055) * 255
        rgb[(abs(v) < 0.35) & mask] = [24, 22, 21]
        paint = measured_orb_paint(rgb, mask, [90, 90, 90, 90])
        side, vertical, front = paint["light"]
        self.assertAlmostEqual(side, 0.32, delta=0.04)
        self.assertAlmostEqual(front, 0.74, delta=0.09)
        self.assertAlmostEqual(vertical, 0, delta=0.1)
        self.assertNotIn(
            "light", measured_orb_paint(rgb, mask & (u > 0), [90, 90, 90, 90])
        )

    def test_two_cream_crosses_identify_a_tinted_frame_and_retain_the_wings(self):
        from .visor import marked_lens

        art = Image.new("RGB", (240, 160), "#e8a244")
        stroke = ImageDraw.Draw(art)
        stroke.rounded_rectangle([35, 61, 205, 73], radius=5, fill="#28201e")
        stroke.rounded_rectangle([46, 54, 194, 96], radius=16, fill="#28201e")
        for x in (86, 153):
            stroke.line((x - 7, 62, x + 7, 79), fill="#f8dab2", width=5)
            stroke.line((x - 7, 79, x + 7, 62), fill="#f8dab2", width=5)
        rgb = np.asarray(art, dtype=float)
        dark = rgb.max(2) < 108
        self.assertIsNotNone(marked_lens(rgb, dark))
        visor = measure_visor(rgb, np.ones_like(dark), [120, 79, 84, 76])
        cols = np.asarray(visor["rim"]["columns"])
        self.assertGreater(cols[-1, 0] - cols[0, 0], 1.9)
        self.assertLess(cols[0, 2] - cols[0, 1], 0.15)
        self.assertGreater(np.ptp(cols[:, 2]), 0.25)
        self.assertEqual(visor["rim"]["glyph"], "#f8dab2")
        stroke.rectangle((134, 58, 175, 85), fill="#28201e")
        rgb = np.asarray(art, dtype=float)
        self.assertIsNone(marked_lens(rgb, rgb.max(2) < 108))

    def test_wrist_fit_reads_pigment_on_the_hand_that_wears_it(self):
        from .kit_hand import kit_hand

        paper, skin, dye = [229, 220, 211], [170, 115, 92], [42, 92, 170]
        rgb = np.full((421, 401, 3), paper, dtype=float)
        rgb[10:411, 196:205] = skin
        radius = abs(np.arange(401) - 200)
        rgb[139:150, radius <= 148] = skin
        rgb[141:148, (148 < radius) & (radius <= 160)] = skin
        rgb[147:150, radius <= 148] = np.array(skin) * 0.65
        stripe = (125 <= radius) & (radius <= 129)
        rgb[139:150, stripe] = dye
        marks = [0, (144 - 10) / 400]

        def fit():
            return kit_hand(rgb, (rgb != paper).any(axis=2), marks)

        both = fit()
        self.assertEqual(both["wristRadius"], round(11 / 800, 5))
        self.assertEqual(both["padRadius"], round(7 / 800, 5))
        self.assertEqual(both["band"]["color"], "#2a5caa")
        self.assertNotIn("side", both["band"])
        self.assertLess(both["light"][1], 0.6)
        rgb[139:150, stripe & (np.arange(401) < 200)] = skin
        self.assertEqual(fit()["band"]["side"], "left")
        rgb[139:150, stripe] = skin
        self.assertNotIn("band", fit())
        self.assertIsNone(kit_hand(rgb, (rgb != paper).any(axis=2), None))
        self.assertIsNone(kit_hand(rgb, np.zeros(rgb.shape[:2], dtype=bool), marks))

    def test_two_open_palms_share_the_five_visible_shafts_only_when_both_are_clear(
        self,
    ):
        from .kit_hand import compare_open_hands, kit_hand
        from .sun_rays import kit_landmarks

        target = Path(__file__).parent / "targets/holdout-v1/brin-full.webp"
        rgb, mask = pixels(target, keep_components=True)
        marks = kit_landmarks(rgb, mask)
        observed = kit_hand(rgb, mask, marks)["spread"]
        self.assertTrue(compare_open_hands(observed, rgb, mask, marks)["matched"])
        self.assertEqual(len(observed["digits"]), 5)
        rays = np.asarray(observed["digits"])
        self.assertTrue(np.all(np.diff(rays[:, 3]) > 0.1))
        self.assertGreater(rays[0, 4], rays[-1, 4])
        self.assertGreater(observed["wrist"], 1.5 * max(rays[:, 4]))
        flipped = kit_hand(rgb[:, ::-1], mask[:, ::-1], marks)["spread"]
        np.testing.assert_allclose(flipped["digits"], rays, atol=0.005)
        # Occlude the shafts on one side, retaining the same full-body framing.
        yy, xx = np.where(mask)
        edge = xx.min() + np.ptp(xx) * 0.10
        palm = (np.indices(mask.shape)[1] < edge) & (
            abs(np.indices(mask.shape)[0] - (yy.min() + marks[1] * np.ptp(yy)))
            < np.ptp(yy) * 0.032
        )
        mask[palm] = True
        rgb[palm] = [230, 150, 93]
        self.assertNotIn("spread", kit_hand(rgb, mask, marks) or {})
        self.assertFalse(compare_open_hands(observed, rgb, mask, marks)["matched"])

    def test_jersey_side_seams_require_three_stable_paired_edges(self):
        from .jersey_sleeve import jersey_widths

        height, center = 400, 120
        mask = np.zeros((height + 1, 241), dtype=bool)
        mask[:, center] = True
        mask[117:123, 5:-5] = True
        for y in range(123, 205):
            radius = round(29 + abs(y - 163) / 8)
            mask[y, center - radius : center + radius + 1] = True
        marks = [0, 0.3, 0.5]
        widths = jersey_widths(mask, marks)
        np.testing.assert_allclose(widths, [62 / 400, 58 / 400, 66 / 400], atol=0.006)
        mask[140:153, center + 5 :] = False
        self.assertIsNone(jersey_widths(mask, marks))
        self.assertIsNone(jersey_widths(mask, None))

    def test_crown_paper_control_preserves_enclosed_light_paint(self):
        from .paper_control import clear_crown_paper

        # The crown has a bright painted center and an exterior paper halo.
        rgb = np.full((30, 48, 3), 210.0)
        rgb[6:23, 12:36] = 201
        rgb[9:20, 16:32] = [62, 90, 184]
        rgb[12:17, 19:29] = 210
        alpha = np.zeros(rgb.shape[:2], dtype=bool)
        alpha[6:23, 12:36] = True
        trimmed = clear_crown_paper(rgb, alpha, 12)
        self.assertEqual(trimmed.sum(), 11 * 16)
        self.assertTrue(trimmed[14, 23])
        self.assertFalse(trimmed[7, 13])

    def test_kit_footwear_measures_two_legs_and_requires_visible_shoes(self):
        from .kit_footwear import kit_footwear
        from .sun_rays import kit_landmarks

        root = Path(__file__).parent / "targets/holdout-v1"
        for k in ("solvi", "mora"):
            rgb, mask = pixels(root / (k + "-full.webp"), keep_components=True)
            marks = kit_landmarks(rgb, mask)
            cut = kit_footwear(rgb, mask, marks)
            self.assertEqual(len(cut["bands"]), 2)
            self.assertGreaterEqual(len(cut["laces"]), 2)
            self.assertLess(cut["widths"][0], cut["widths"][-1])
            color = bytes.fromhex(cut["bands"][0]["color"][1:])
            self.assertEqual(color[0] > color[2], k == "mora")
            # A cropped or obscured second foot supplies no paired measurement.
            mask[-70:, mask.shape[1] // 2 :] = False
            self.assertIsNone(kit_footwear(rgb, mask, marks))
        self.assertIsNone(kit_footwear(rgb, mask, None))

    def test_dark_jersey_above_copper_shorts_and_light_soled_shoes(self):
        from .sun_rays import kit_landmarks, shorts_cut
        from .kit_footwear import kit_footwear

        ref = Path(__file__).parent / "targets/holdout-v1/brin-full.webp"
        rgb, mask = pixels(ref, keep_components=True)
        landmarks = kit_landmarks(rgb, mask)
        np.testing.assert_allclose(landmarks[[0, 2]], [0.34, 0.59], atol=0.01)
        # The copper panel ends near row 834. Rows 842–852 already show bare legs.
        rows = np.flatnonzero(mask.any(axis=1))
        self.assertAlmostEqual(rows[0] + landmarks[3] * np.ptp(rows), 834, delta=3)
        cut = shorts_cut(rgb, mask, landmarks, measure_inner=True)
        self.assertAlmostEqual(cut[2], 0.06, delta=0.015)
        shoes = kit_footwear(rgb, mask, landmarks)
        self.assertTrue(1.2 < shoes["spread"][0] < shoes["spread"][1] < 1.7)
        self.assertGreater(shoes["rise"], 0.48)
        self.assertEqual(len(shoes["laces"]), 3)
        upper, sole, lace = (
            np.array(list(bytes.fromhex(shoes[k][1:])))
            for k in ("upper", "sole", "laceInk")
        )
        self.assertGreater(min(sole - upper), 48)
        self.assertGreater(min(lace - upper), 48)
        mask[-100:, mask.shape[1] // 2 :] = False
        self.assertIsNone(kit_footwear(rgb, mask, landmarks))

    def test_plain_shoes_and_one_sock_band_do_not_gain_laces_or_a_second_stripe(self):
        from .kit_footwear import kit_footwear

        paper = [232, 226, 213]
        rgb = np.full((256, 180, 3), paper, dtype=float)
        rgb[16:189, 65:115] = [90, 130, 181]
        for x in (78, 102):
            rgb[187:226, x - 4 : x + 5] = [242, 238, 231]
            rgb[196:200, x - 4 : x + 5] = [38, 165, 102]
            rgb[226:238, x - 6 : x + 7] = [61, 54, 62]
        mask = np.any(rgb != paper, axis=2)
        sock_start = (187 - 16) / (237 - 16)
        cut = kit_footwear(rgb, mask, [0, 0, 0, 0, sock_start])
        self.assertEqual(cut["laces"], [])
        self.assertEqual(len(cut["bands"]), 1)
        self.assertEqual(cut["bands"][0]["color"], "#26a566")
        self.assertAlmostEqual(cut["bands"][0]["start"], 9 / 39, places=3)
        rgb[196:200, 98:107] = [242, 238, 231]
        self.assertEqual(kit_footwear(rgb, mask, [0, 0, 0, 0, sock_start])["bands"], [])

    def test_marked_visor_registers_both_frames_independently_of_the_body_box(self):
        from .visor import front_orb_seed

        mask = np.zeros((200, 200), dtype=bool)
        mask[10:188, 30:171] = True
        rgb = np.full((200, 200, 3), 215.0)
        rgb[38:59, 76:125] = 24
        guide = [-0.18, 0.13, 0.18, 0.44]
        # An unmarked stripe is ambiguous and uses the body registration.
        fallback, _ = front_orb_seed(rgb, mask, guide)
        self.assertGreater(fallback[1], 56)
        rgb[46:51, 86:92] = rgb[46:51, 109:115] = 240
        center, radius = front_orb_seed(rgb, mask, guide)
        np.testing.assert_allclose(center, [100, 48])
        self.assertAlmostEqual(radius, 49 / 1.9)

    def test_orb_fit_separates_the_throat_and_preserves_a_real_floating_gap(self):
        art = Image.new("RGB", (180, 185), "#d4d9e0")
        draw = ImageDraw.Draw(art)
        draw.polygon(
            [(15, 150), (73, 121), (108, 121), (164, 151), (160, 184), (15, 184)],
            fill="#77449a",
        )
        draw.rectangle((80, 103, 100, 130), fill="#65ad87")
        draw.rectangle((79, 130, 101, 134), fill="#eabe32")
        draw.ellipse((56, 37, 124, 113), fill="#9bdac3")
        draw.rounded_rectangle((54, 64, 126, 86), radius=5, fill="#1c1820")
        rgb = np.asarray(art, dtype=float)
        mask = (rgb != rgb[0, 0]).any(axis=2)
        orb = orb_contour(rgb, mask, (90, 78), (36, 40))
        np.testing.assert_allclose(orb, [90, 75, 34.5, 38.5], atol=1.2)
        collar, _ = jersey_neck(rgb, mask, orb)
        self.assertEqual(collar["binding"], "#eabe32")
        self.assertAlmostEqual(collar["radius"], 10.5 / 34.5, delta=0.04)
        mask[115:119] = False
        self.assertIsNone(jersey_neck(rgb, mask, orb))

    def test_visor_and_skin_arcs_separate_a_painted_throat_from_the_orb(self):
        from .sun_rays import fit_crew_to_orb
        from .visor import visor_seed

        for name, dye in (("solvi", "blue"), ("mora", "mint")):
            with self.subTest(name=name):
                path = (
                    Path(__file__).parent / "targets/holdout-v1" / (name + "-full.webp")
                )
                rgb, mask = pixels(path, keep_components=True)
                center, radius = visor_seed(rgb, mask)
                orb = measure_sun_rays(
                    rgb, mask, center, [radius, radius], orb_only=True
                )
                self.assertLess(abs(orb[2] / orb[3] - 1), 0.10)
                recipe = {"proportions": {}}
                fit_crew_to_orb(rgb, mask, orb, recipe, [350, 106, 60.5, 61.2])
                collar = recipe["orbCollar"]
                r, g, b = bytes.fromhex(collar["binding"][1:])
                self.assertGreater(
                    b if dye == "blue" else g, max(r, g if dye == "blue" else b)
                )
                self.assertLess(abs(recipe["kitFit"]["shoulders"]), 0.045)
                self.assertNotEqual(collar["binding"], collar["skin"])

    def test_full_source_observer_chooses_the_foot_before_the_first_render(self):
        from . import one_image
        from .local_vqa import full_edits

        source = Path(__file__).parent / "targets/holdout-v1/lark-full.webp"
        recipe = json.loads((source.parent / "candidates/lark.recipe").read_bytes())
        recipe["design"]["outfit"]["footwear"] = "sneaker"
        edits = full_edits(recipe, {"feet": "flats", "hair": "hat"})
        self.assertEqual(edits, [{"field": "design.outfit.footwear", "value": "flat"}])
        source_call = ({"edits": edits, "missing": ""}, {"usage": {"cost": 0.001}})
        metrics = dict(
            silhouette_iou=1,
            head_iou=1,
            head_edge_agreement=1,
            body_edge_agreement=1,
            eye_pigment_agreement=1,
            rgb_mae=0,
        )

        def inspect(candidate, source, directory, report, *args):
            self.assertEqual(candidate["design"]["outfit"]["footwear"], "flat")
            one_image.save(directory / "candidate.json", candidate)
            report.update(accepted=True, native={"triangles": 1000}, front=metrics)

        args = SimpleNamespace(
            openrouter=False,
            adapter="fixture",
            endpoint=None,
            model="fixture",
            base="local",
            renderer="webgl",
            max_triangles=4000,
        )
        with (
            TemporaryDirectory() as temp,
            patch(
                "avatar_authoring.draft.propose",
                return_value={"haircut": "crop", "top": "crew"},
            ),
            patch.object(one_image, "fit_front", return_value=(recipe, {})),
            patch.object(
                one_image, "observe_full_family", return_value=source_call
            ) as initial,
            patch.object(one_image, "assess_native", side_effect=inspect) as render,
            patch.object(
                one_image,
                "review_family",
                return_value=(
                    {"use_family": False, "reason": "embroidered collar"},
                    {"usage": {"cost": 0.002}},
                ),
            ) as correction,
        ):
            folder, report = one_image.author_one(
                source, Path(temp), "rick-classic", "full", "Study", args
            )
            self.assertFalse((folder / "recipe.json").exists())
        self.assertEqual(
            [initial.call_count, render.call_count, correction.call_count], [1, 1, 1]
        )
        self.assertFalse(report["accepted"])
        self.assertEqual(report["needs_feature"], "embroidered-collar")
        self.assertEqual(report["reported_provider_cost"], 0.003)
        self.assertEqual(full_edits(recipe, {"hair": "hat"}), [])
        recipe["design"]["household"]["body"]["sections"].pop("outsole")
        self.assertEqual(full_edits(recipe, {"feet": "flats"}), [])

    def test_pose_measures_in_statures_and_ignores_uncertain_or_outside_joints(self):
        from .pose_review import project_pairs

        points = [
            SimpleNamespace(x=0.5, y=0.5, presence=0, visibility=0) for _ in range(33)
        ]
        for i, x in ((11, 0.625), (12, 0.375), (13, -0.05), (14, 0.85)):
            points[i] = SimpleNamespace(x=x, y=0.5, presence=1, visibility=1)
        mask = np.zeros((101, 201), bool)
        mask[10:91, 20:181] = True
        self.assertEqual(
            project_pairs(points, 201, 101, mask),
            {"shoulder": [[-0.3125, 0.5], [0.3125, 0.5]]},
        )

    def test_lost_portrait_frame_reuses_the_paid_observation_and_same_recipe(self):
        from playwright.sync_api import TimeoutError as BrowserTimeout

        from . import one_image

        source = Path(__file__).parent / "targets/holdout-v1/rowan-portrait.webp"
        observation = one_image.propose_portrait(source, "rick-classic")
        args = SimpleNamespace(
            openrouter=True,
            model=None,
            endpoint=None,
            adapter=None,
            base="local",
            renderer="webgl",
            max_triangles=4000,
        )
        metrics = {
            "head_iou": 0.91,
            "rgb_mae": 12,
            "ink_agreement": 0.8,
            "visible_fraction": 0.91,
        }
        with (
            TemporaryDirectory() as temp,
            patch.dict(
                one_image.os.environ,
                {
                    "AVATAR_FAST_MODEL": "demo/fast-vision",
                    "AVATAR_FEATURE_MODEL": "demo/feature-vision",
                },
            ),
            patch.object(
                one_image, "openrouter_model", side_effect=lambda model: model
            ) as catalog,
            patch.object(
                one_image,
                "request_drawing",
                return_value=(observation, {"usage": {"cost": 0.001}}),
            ) as request,
            patch.object(
                one_image,
                "render",
                side_effect=[BrowserTimeout("frame"), {"triangles": 3000}],
            ) as render,
            patch.object(one_image, "portrait_metrics", return_value=metrics),
        ):
            _, report = one_image.author_one(
                source, Path(temp), "rick-classic", "portrait", "Drawn", args
            )
        self.assertEqual(report["native_render_retries"], ["pass-1"])
        self.assertTrue(report["accepted"])
        self.assertEqual(report["selected_pass"], 1)
        self.assertEqual(report["reported_provider_cost"], 0.001)
        catalog.assert_called_once_with("demo/fast-vision")
        self.assertEqual(args.feature_model, "demo/feature-vision")
        self.assertEqual(request.call_count, 1)
        self.assertEqual(render.call_count, 2)
        self.assertEqual(render.call_args_list[0], render.call_args_list[1])

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

    def test_one_ink_sample_recovers_detached_strokes_and_excludes_the_seam(self):
        patch = Image.new("RGB", (97, 97), "#eee5dd")
        ink = ImageDraw.Draw(patch)
        ink.ellipse((22, 19, 71, 44), fill="#3484ed")
        ink.polygon([(18, 55), (64, 49), (70, 53), (22, 60)], fill="#327ae1")
        ink.rectangle((25, 63, 60, 67), fill="#3786ed")
        ink.rectangle((0, 22, 3, 51), fill="#3484ed")
        ink.rectangle((73, 44, 83, 54), fill="#7359aa")
        base = {
            "family": "sunshine",
            "plainJersey": True,
            "proportions": {},
            "paints": {},
        }
        edits = [{"field": "shirtMark", "value": {"sample": [0.5, 0.3]}}]
        graphic = edited_recipe(base, edits, np.array(patch, dtype=float))["shirtMark"]
        self.assertEqual(len(graphic["islands"]), 2)
        for stroke in graphic["islands"]:
            self.assertGreater(min(y for _, y in stroke), 0.45)
            self.assertGreater(min(x for x, _ in stroke), 0.15)

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

    def test_shaded_lower_rays_follow_the_paint_on_each_side_of_the_collar(self):
        from .visor import visor_seed

        for name in ("solvi", "mora"):
            path = Path(__file__).parent / "targets/holdout-v1" / (name + "-full.webp")
            rgb, mask = pixels(path, keep_components=True)
            center, r = visor_seed(rgb, mask)
            orb = measure_sun_rays(rgb, mask, center, [r, r], orb_only=True)
            y, x = np.indices(mask.shape)
            u, v = (x - orb[0]) / orb[2], (y - orb[1]) / orb[3]
            angle = np.rad2deg(np.arctan2(v, u))

            def angles():
                shapes, _ = measure_sun_rays(rgb, mask, center, [r, r])
                self.assertTrue(all(3 <= len(shape) <= 6 for shape in shapes))
                return np.array(
                    [
                        np.rad2deg(np.arctan2(*np.mean(shape, axis=0)[::-1]))
                        for shape in shapes
                    ]
                )

            self.assertEqual(len(angles()), 15)

            def lower():
                a = angles()
                return np.sort(a[(a > 50) & (a < 130)])

            np.testing.assert_allclose(lower(), [59, 121], atol=3)
            # A genuine asymmetry should survive when the opposite ray is present.
            erase = (
                (angle > 49)
                & (angle < 68)
                & (np.hypot(u, v) > 1.05)
                & (np.hypot(u, v) < 1.51)
            )
            mask[erase] = False
            rgb[erase] = np.median(rgb[0], axis=0)
            np.testing.assert_allclose(lower(), [121], atol=3)

    def test_neutral_rays_and_matching_sleeve_colors_on_a_portrait(self):
        from .portrait import propose_portrait, compile_portrait

        for name in ("indigo", "reed"):
            path = (
                Path(__file__).parent / "targets/holdout-v1" / (name + "-portrait.webp")
            )
            recipe = compile_portrait(
                path, "sunshine", name, propose_portrait(path, "sunshine")
            )
            cut = recipe["jerseySleeve"]
            self.assertEqual(len(cut["bands"]), 2 if name == "indigo" else 1)
            self.assertGreater(cut["span"], 125)
            self.assertGreater(recipe["limbWidth"]["arms"], 1)
            self.assertEqual(recipe["limbWidth"]["legs"], 1)
            self.assertEqual(
                len(recipe["shirtMark"].get("islands", [])), int(name == "indigo")
            )
            self.assertEqual(len(recipe["sunRays"]), 15)
            self.assertTrue(
                all(
                    np.linalg.norm(ray, axis=1).min() < 1.5 for ray in recipe["sunRays"]
                )
            )

    def test_lens_contact_requires_a_visible_soft_shadow(self):
        from .visor import visor_contact

        y, _ = np.indices((200, 200))
        mask = np.ones_like(y, bool)
        rgb = np.full((*y.shape, 3), [156, 98, 185], dtype=float)
        rows = [[-0.35, 0.25]] * 17

        def read():
            return visor_contact(rgb, mask, [100, 72, 60, 60], 0, 0.85, rows)

        self.assertIsNone(read())
        t = np.clip((y - 87) / 9, 0, 1)
        rgb *= (0.40 + 0.60 * t * t * (3 - 2 * t))[:, :, None] ** (1 / 2.2)
        fitted = read()
        self.assertAlmostEqual(fitted["strength"], 0.60, delta=0.10)
        self.assertAlmostEqual(fitted["width"], 0.15, delta=0.025)
        mask[85:107] = False
        self.assertIsNone(read())

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
        angles = np.sort(
            np.arctan2(*np.array([np.mean(ray, axis=0) for ray in rays])[:, ::-1].T)
        )
        self.assertGreater(np.min(np.diff(angles)), 0.16)

    def test_multi_stroke_jersey_checks_each_separate_fill_and_skips_the_collar(self):
        from .jersey_print import multi_stroke_print, stroke_coverage

        image = np.full((450, 403, 3), 236.0)
        mask = np.zeros(image.shape[:2], dtype=bool)
        mask[10:411, 106:297] = True
        frame = [-0.2, 0.20, 0.2, 0.65]
        dye = [45, 95, 197]

        def paint(a, box):
            x0, y0, x1, y1 = box
            a[
                round(90 + 180 * y0) : round(90 + 180 * y1),
                round(121 + 160 * x0) : round(121 + 160 * x1),
            ] = dye

        # Same dye on a neckline sitting above the printable chest.
        paint(image, [0.27, -0.075, 0.73, -0.015])
        outline = [[0.25, 0.18], [0.75, 0.18], [0.75, 0.44], [0.25, 0.44]]
        paint(image, [0.25, 0.18, 0.75, 0.44])
        paint(image, [0.24, 0.50, 0.70, 0.54])
        mark = {"color": "#2d5fc5", "outline": outline}
        incomplete = image.copy()
        paint(image, [0.23, 0.60, 0.72, 0.66])
        source = (image, mask)
        fitted = multi_stroke_print(source, frame, mark)
        self.assertEqual(len(fitted["islands"]), 2)
        self.assertTrue(stroke_coverage(source, source, frame, fitted)["matched"])
        miss = stroke_coverage(source, (incomplete, mask), frame, fitted)
        self.assertFalse(miss["matched"])
        self.assertEqual(min(miss["coverage"]), 0.0)

    def test_projected_jersey_print_preserves_a_counter_and_corrects_native_displacement(
        self,
    ):
        from .jersey_print import ink_fills, projected_print
        from scipy import ndimage

        shape = np.zeros((47, 47), dtype=bool)
        shape[6:40, 7:38] = True
        shape[14:31, 16:28] = False
        fills = ink_fills(shape)
        self.assertEqual(len(fills), 2)
        np.testing.assert_array_equal(np.logical_or.reduce(fills), shape)
        self.assertTrue(
            all(np.array_equal(f, ndimage.binary_fill_holes(f)) for f in fills)
        )

        with TemporaryDirectory() as tmp:
            stock = Image.new("RGB", (240, 300), "#ccc9c4")
            pen = ImageDraw.Draw(stock)
            pen.rectangle((106, 10, 134, 289), fill="#978075")
            pen.rectangle((50, 65, 190, 221), fill="#85c09b")
            frame = [-0.25, 0.25, 0.25, 0.65]

            def stamp(filename, x, dye):
                im = stock.copy()
                if dye:
                    ImageDraw.Draw(im).ellipse((x - 14, 118, x + 14, 136), fill=dye)
                path = Path(tmp) / filename
                im.save(path)
                return path

            ref = stamp("source.png", 135, "#e27064")
            shown = stamp("native.png", 144, "#cc6258")
            mark = {
                "color": "#e27064",
                "outline": [[0.50, 0.35], [0.61, 0.30], [0.70, 0.41], [0.61, 0.50]],
            }
            fit = projected_print(ref, shown, frame, mark)
            self.assertLess(np.mean(fit["outline"], axis=0)[0], 0.58)
            self.assertGreater(int(fit["color"][1:3], 16), 0xE2)
            self.assertNotIn("islands", fit)
            self.assertIsNone(
                projected_print(ref, stamp("blank.png", 144, None), frame, mark)
            )

    def test_jersey_sleeves_require_two_visible_arms_and_follow_the_drawn_bands(self):
        from .jersey_sleeve import jersey_sleeve

        paper, skin = [215, 214, 212], [78, 134, 52]
        image = np.full((423, 401, 3), paper, dtype=float)
        image[10, 200] = image[410, 200] = skin
        image[139:151, 43:358] = skin
        across = np.abs(np.arange(401) - 200)
        image[132:158, across <= 66] = [245, 209, 138]
        image[132:158, (across > 58) & (across <= 66)] = [34, 72, 190]

        def fit():
            return jersey_sleeve(image, (image != paper).any(axis=2), [0, 0.335])

        result = fit()
        self.assertAlmostEqual(result["reach"], 0.166, delta=0.005)
        self.assertEqual(result["bands"][0]["color"], "#2248be")
        self.assertAlmostEqual(result["bands"][0]["start"], 0.88, delta=0.03)
        self.assertEqual(result["bands"][0]["end"], 1)
        np.testing.assert_allclose(result["armhole"], [-1, 1])
        self.assertEqual(len(result["rows"]), 5)
        image[132:158, (across > 58) & (across <= 66)] = [245, 209, 138]
        self.assertEqual(fit()["bands"], [])
        image[130:163, 42:135] = paper
        self.assertIsNone(fit())

    def test_visible_sleeves_require_bare_skin_on_both_sides_inside_the_crop(self):
        from .jersey_sleeve import bare_arms, measure_sleeves

        skin, fabric = np.array([80, 128, 74]), np.array([248, 207, 119])
        rgb = np.full((97, 237, 3), 219.0)
        away = abs(np.arange(237) - 113)
        rgb[44:59] = skin
        rgb[55:59] *= 0.55
        rgb[38:66, away <= 66] = fabric
        rgb[38:66, (away > 58) & (away <= 66)] = [34, 72, 190]
        rgb[38:, away < 32] = fabric
        mask = (rgb != 219).any(axis=2)
        edges, pigment = bare_arms(rgb, mask, 113, 28, 400, skin, fabric)
        np.testing.assert_array_equal(edges, [44, 58])
        np.testing.assert_array_equal(pigment, skin)
        cut = measure_sleeves(rgb, mask, 113, round(edges.mean()), 400)
        self.assertEqual(cut["bands"][0]["color"], "#2248be")
        self.assertIsNone(
            bare_arms(rgb[:, 30:-30], mask[:, 30:-30], 83, 28, 400, skin, fabric)
        )
        mask[:, 204:] = False
        self.assertIsNone(bare_arms(rgb, mask, 113, 28, 400, skin, fabric))

    def test_only_a_short_shoulder_and_a_narrow_visible_torso_enlarge_the_orb(self):
        from .portrait import measured_orb_scale

        mask = np.zeros((236, 320), dtype=bool)
        mask[172:, 115:206] = True
        orb = [160, 90, 60.5, 61.2]
        scale, chest = measured_orb_scale(mask, orb, np.array([175, 185]), 1)
        self.assertGreater(scale, 1.35)
        self.assertGreater(chest, 0.70)
        self.assertEqual(
            measured_orb_scale(mask, orb, np.array([198, 208]), 1), (1, None)
        )
        mask[172:, 90:231] = True
        self.assertEqual(
            measured_orb_scale(mask, orb, np.array([175, 185]), 1), (1, None)
        )
        self.assertEqual(
            measured_orb_scale(mask[:186], orb, np.array([175, 185]), 1), (1, None)
        )

    def test_dark_chroma_does_not_enlarge_a_neutral_lens(self):
        from .visor import visor_seed

        art = Image.new("RGB", (240, 188), "#d3cbd3")
        draw = ImageDraw.Draw(art)
        draw.ellipse([57, 19, 181, 145], fill="#552540")
        draw.rounded_rectangle([69, 61, 169, 95], radius=13, fill="#1d1c20")
        for x in (95, 144):
            draw.line((x - 6, 71, x + 6, 85), fill="white", width=4)
            draw.line((x - 6, 85, x + 6, 71), fill="white", width=4)
        a = np.asarray(art, dtype=float)
        mask = (a != a[0, 0]).any(axis=2)
        mid, r = visor_seed(a, mask)
        np.testing.assert_allclose(mid, [119, 78], atol=0.5)
        self.assertAlmostEqual(1.9 * r, 101, delta=1)
        v = measure_visor(a, mask, [119, 82, 62, 63])
        self.assertIs(v["strap"], False)
        # A single visible strap invalidates the bare-temples observation.
        a[73:79, 58:75] = [29, 28, 32]
        self.assertNotIn("strap", measure_visor(a, mask, [119, 82, 62, 63]))

    def test_flat_and_shaded_rays_infer_different_sections_from_the_same_outline(self):
        from .sun_rays import apply_sun_rays

        orb = np.array([95, 95, 38, 38])
        base = np.array([[1.2, -0.25], [1.85, 0], [1.2, 0.25]])
        rays = []
        for angle in np.linspace(0, 2 * np.pi, 8, endpoint=False):
            c, n = np.cos(angle), np.sin(angle)
            rays.append((base @ [[c, n], [-n, c]]).tolist())
        y, x = np.indices((190, 190))
        rgb = np.full((190, 190, 3), [20.0, 95.0, 175.0])
        flat = {"paints": {}}
        apply_sun_rays(flat, (rays, "#145faf"), rgb, orb)
        self.assertNotIn("rayDepth", flat)
        for ray in rays:
            poly = np.array(ray) * orb[2:] + orb[:2]
            tile = Image.new("L", (190, 190))
            ImageDraw.Draw(tile).polygon([tuple(p) for p in poly], fill=1)
            keep = np.asarray(tile) > 0
            rgb[keep] += np.clip((x[keep] - poly[:, 0].mean()) * 2.1, -36, 36)[:, None]
        cast = {"paints": {}}
        apply_sun_rays(cast, (rays, "#145faf"), rgb, orb)
        self.assertEqual(cast["rayDepth"], 1)
        self.assertEqual(cast["sunRays"], flat["sunRays"])

    def test_frame_mounting_requires_a_bridge_and_two_narrow_wings(self):
        from .visor import has_sunglass_arms

        columns = [
            [-1, -0.2, -0.08],
            [-0.82, -0.2, -0.08],
            [-0.42, -0.28, 0.38],
            [0, -0.26, 0.12],
            [0.42, -0.28, 0.38],
            [0.82, -0.2, -0.08],
            [1, -0.2, -0.08],
        ]
        marks = [[-0.44, 0, 0.1, 0.1], [0.44, 0, 0.1, 0.1]]
        self.assertTrue(has_sunglass_arms({"columns": columns}, marks))
        columns[0][2] = columns[1][2] = 0.34
        self.assertFalse(has_sunglass_arms({"columns": columns}, marks))
        for col in columns:
            col[2] = 0.34
        self.assertFalse(has_sunglass_arms({"columns": columns}, marks))

    def test_shorts_measure_the_visible_gap_and_outer_hem(self):
        mask = np.zeros((201, 160), dtype=bool)
        mask[:, 63:97] = True
        mask[118:131, 59:101] = True
        mask[123:, 76:84] = False
        # An ink mark or isolated hole above the fork is not the leg opening.
        mask[108:110, 76:84] = False
        marks = np.array([0, 0, 0.50, 0.65, 0, 34 / 200])
        rgb = np.full((*mask.shape, 3), 212.0)
        rgb[mask] = [19, 60, 140]
        # Gray paper between the legs can survive the foreground extractor.
        mask[123:130, 76:84] = True
        rise, width = shorts_cut(rgb, mask, marks)
        measured = shorts_cut(rgb, mask, marks, measure_inner=True)
        self.assertEqual(len(measured), 3)
        self.assertGreater(measured[2], 0)
        self.assertLess(measured[2], 0.4)
        self.assertAlmostEqual(rise, 23 / 30)
        self.assertAlmostEqual(width, 41 / 33)
        separate = mask.copy()
        separate[123:, 76:84] = False
        np.testing.assert_allclose(
            shorts_cut(np.zeros_like(rgb), separate, marks), [rise, width]
        )
        mask[111:131, 76:84] = True
        rgb[111:131, 76:84] = [19, 60, 140]
        self.assertIsNone(shorts_cut(rgb, mask, marks))

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

    def test_side_looking_dots_require_two_disks_at_the_observed_rims(self):
        with TemporaryDirectory() as tmp:
            folder = Path(tmp)
            frame = [-0.16, 0.07, 0.16, 0.19]

            def drawing(name, side, radius, count=2):
                image = Image.new("RGB", (240, 430), "#fffdf8")
                pen = ImageDraw.Draw(image)
                pen.ellipse((57, 10, 183, 133), fill="#b47d63")
                pen.rectangle((86, 117, 154, 410), fill="#535d6a")
                for i, x in enumerate((95, 145)):
                    pen.ellipse(
                        (x - 21, 45, x + 21, 77),
                        fill="#fffef6",
                        outline="#282223",
                        width=2,
                    )
                    if i < count:
                        u = x + side * 17
                        pen.ellipse(
                            (u - radius, 58 - radius, u + radius, 58 + radius),
                            fill="#211c1e",
                        )
                path = folder / (name + ".png")
                image.save(path)
                return path

            source = drawing("left", -1, 5)
            for other, expected in [
                (source, True),
                (drawing("right", 1, 5), False),
                (drawing("large", -1, 10), False),
                (drawing("single", -1, 5, 1), False),
            ]:
                pair = eye_agreement(source, other, frame)
                self.assertIsNotNone(pair)
                self.assertEqual(eyes_match({"globe_measurements": pair}), expected)

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
