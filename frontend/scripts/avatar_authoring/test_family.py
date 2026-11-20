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
