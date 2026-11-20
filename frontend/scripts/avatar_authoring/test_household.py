import json
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

import numpy as np
from PIL import Image, ImageDraw

from .family_edits import edited_recipe
from .household import projected_band_width, scalp_band
from .household_front import fit_front, hair_fall, nape_height
from .household_registration import RECIPES, VIEWS, match, role_masks


class HouseholdTests(unittest.TestCase):
    def test_both_pupils_can_meet_the_upper_lid_but_blank_apertures_are_rejected(self):
        from .eye_review import reference_pair
        from .household import observe_eye
        from .household_front import painted_brow

        art = Image.new("RGB", (160, 100), "#bc895c")
        draw = ImageDraw.Draw(art)
        for x in (56, 98):
            draw.ellipse((x - 15, 35, x + 15, 54), fill="#30251e")
            draw.ellipse((x - 13, 37, x + 13, 52), fill="#fcf9f0")
            draw.rectangle((x - 16, 29, x + 16, 40), fill="#bc895c")
            draw.line((x - 15, 40, x + 15, 40), fill="black", width=2)
        self.assertEqual(reference_pair(art), [])
        draw.ellipse((52, 37, 58, 45), fill="#221e18")
        self.assertEqual(reference_pair(art), [])
        draw.ellipse((94, 37, 100, 45), fill="#221e18")
        eyes = reference_pair(art)
        self.assertEqual(len(eyes), 2)
        for x in (56, 98):
            draw.line((x - 9, 29, x + 10, 29), fill="#37291f", width=2)
        for eye in eyes:
            x, y, r, b = eye["bounds"]
            observed = observe_eye(
                np.asarray(art, dtype=float), [x - 2, y - 2, r + 2, b + 2]
            )
            self.assertLess(observed["pupil"][1], -0.35)
            self.assertLess(abs(observed["pupil"][0]), 0.27)
            self.assertLess(observed["pupil_fraction"], 0.27)
            brow = painted_brow(np.asarray(art, dtype=float), (x, y, r, b))
            self.assertIsNotNone(brow)
            self.assertLess(max(v for _, v in brow["browRim"]), -2.45)

    def test_a_closed_colored_lip_follows_its_seam_and_rejects_a_plain_line(self):
        from .visible_parts import closed_lips

        art = Image.new("RGB", (160, 140), "#dc9663")
        draw = ImageDraw.Draw(art)
        skin = np.array([220.0, 150.0, 99.0])

        def measure():
            return closed_lips(np.asarray(art, dtype=float), 80, 0, 130, 120, skin)

        draw.line((59, 105, 101, 105), fill="#38241f", width=2)
        self.assertIsNone(measure())
        draw.ellipse((61, 99, 99, 112), fill="#a26056")
        draw.line((59, 105, 101, 105), fill="#38241f", width=2)
        mark = measure()
        self.assertEqual(mark["lipColor"], "#a26056")
        self.assertTrue(np.all(np.diff(np.array(mark["lips"])[:, 0]) > 0))
        self.assertGreater(max(b - a for _, a, b in mark["lips"]), 0.06)

    def test_ear_fold_requires_ink_bracketed_by_skin_and_mirrors_in_lobe_coordinates(
        self,
    ):
        from .pinna import frontal_pinnae

        art = Image.new("RGB", (200, 150), "#f6efdb")
        draw = ImageDraw.Draw(art)
        skin = np.array([220.0, 150.0, 99.0])
        hair = np.array([67.0, 37.0, 25.0])
        ears = [[-0.38, 0.6, 0.13, 0.16], [0.38, 0.6, 0.13, 0.16]]
        for x in (62, 138):
            draw.ellipse((x - 15, 58, x + 15, 92), fill="#322317")
            draw.ellipse((x - 13, 60, x + 13, 90), fill="#dc9663")

        def trace():
            rgb = np.asarray(art, dtype=float)
            return frontal_pinnae(
                rgb,
                (rgb != [246, 239, 219]).any(axis=2),
                100,
                15,
                100,
                100,
                ears,
                skin,
                hair,
            )

        self.assertEqual(trace(), [])
        for x, side in ((62, -1), (138, 1)):
            draw.line(
                [
                    (x + side * u, 75 + v)
                    for u, v in ((-3, 3), (-2, -2), (0, -5), (4, -6), (7, -4))
                ],
                fill="#6a3b23",
                width=2,
            )
        left, right = trace()
        self.assertEqual((left["side"], right["side"]), (-1, 1))
        self.assertEqual(len(left["radii"]), 16)
        self.assertGreater(left["radii"][0], 1.05)
        self.assertTrue(0.08 < left["inkWidth"] < 0.26)
        self.assertIn("folds", left)
        self.assertIn("folds", right)
        for ear in (left, right):
            fold = np.array(ear["folds"][0]["outline"])
            self.assertGreater(fold[:, 0].max(), 0.26)
            self.assertLess(fold[:, 1].min(), -0.18)
        np.testing.assert_allclose(left["radii"], right["radii"], atol=0.07)

    def test_painted_brow_follows_the_exposed_run_below_a_dark_fringe(self):
        from .household_front import painted_brow

        art = np.full((100, 100, 3), [221.0, 157, 110])
        art[:39, 26:73] = [39, 27, 21]
        art[41:44, 33:63] = [42, 28, 22]
        # One end of the eyebrow touches the hair. The large patch clipped
        # by the top of the search window cannot become an eyebrow.
        art[36:43, 61:65] = [39, 27, 21]
        bounds = (32, 51, 66, 73)
        brow = painted_brow(art, bounds)
        self.assertIsNotNone(brow)
        y = 62 + 11 * np.array(brow["browRim"])[:, 1]
        self.assertTrue(np.all((y >= 40.9) & (y <= 44)))
        art[39:49] = [221, 157, 110]
        self.assertIsNone(painted_brow(art, bounds))

    def test_crown_retains_a_returning_tip_and_ignores_a_smooth_or_clipped_cap(self):
        from .crown import crown_edges

        mask = Image.new("L", (160, 140))
        pen = ImageDraw.Draw(mask)
        pen.ellipse((34, 10, 126, 120), fill=255)
        skin = np.array([212.0, 146, 93])
        hair = np.array([70.0, 41, 22])

        def trace():
            active = np.asarray(mask) > 0
            rgb = np.where(active[:, :, None], hair, 240.0)
            return crown_edges(rgb, active, 80, 10, 110, 94, skin, hair)

        self.assertIsNone(trace())
        pen.polygon([(58, 25), (30, 17), (39, 33), (53, 42)], fill=255)
        left, right = trace()
        self.assertEqual(left[0], right[0])
        self.assertEqual(left[-1][1], 0.44)
        self.assertEqual(right[-1][1], 0.44)
        self.assertLess(left[-1][0], -0.24)
        self.assertGreater(right[-1][0], 0.24)
        self.assertLessEqual(len(left), 15)
        self.assertTrue(any(a[1] - b[1] > 0.026 for a, b in zip(left, left[1:])))
        pen.rectangle((0, 15, 40, 19), fill=255)
        self.assertIsNone(trace())

    def test_forehead_trace_keeps_the_sideburn_and_excludes_the_brow(self):
        from .fringe import forehead_fringe

        skin = np.array([222.0, 167, 112])
        dye = np.array([47.0, 30, 22])
        art = np.full((110, 140, 3), skin)
        yy, xx = np.indices(art.shape[:2])
        end = np.interp(xx, [35, 38, 58, 92, 97, 99], [62, 34, 33, 20, 24, 58])
        art[(yy < end) & (xx >= 29) & (xx <= 104)] = dye
        art[37:40, 44:62] = dye
        mask = np.ones(yy.shape, dtype=bool)
        trace = np.array(forehead_fringe(art, mask, 67, 0, 100, 90, skin, dye))
        self.assertTrue(np.all(np.diff(trace[:, 0]) > 0))
        self.assertLessEqual(len(trace), 16)
        self.assertGreater(trace[0, 1], 0.56)
        self.assertAlmostEqual(
            np.interp(-0.13, trace[:, 0], trace[:, 1]), 0.33, delta=0.02
        )
        self.assertIsNone(forehead_fringe(art, mask, 67, 0, 100, 90, skin, skin))

    def test_forearm_paper_control_keeps_pale_cloth_inside_ink(self):
        from .paper_control import clear_arm_paper

        x = np.arange(21)
        paper = np.tile((219 + x % 4).astype(float)[None, :, None], (30, 1, 3))
        art = paper.copy()
        art[8:22] -= 7
        art[11:19] = paper[11:19]
        art[[11, 18]] = [64, 44, 33]
        raw = np.zeros(art.shape[:2], dtype=bool)
        raw[8:22] = True
        clean = clear_arm_paper(art, raw, 12)
        self.assertTrue(clean[11:19].all())
        self.assertEqual(clean.sum(), 8 * len(x))

    def test_touching_fingers_keep_the_hidden_digit_and_reject_an_unmarked_hand(self):
        from .fit import pixels
        from .inked_hand import inked_hand

        path = Path(__file__).parent / "targets/holdout-v1/moss-full.webp"
        rgb, mask = pixels(path)
        wrist = (542, 156)
        skin = np.median(rgb[151:156, 543:547].reshape(-1, 3), axis=0)
        fan, palm = inked_hand(rgb, mask, wrist, 606, skin)
        self.assertEqual(fan.shape, (5, 5))
        self.assertTrue(np.all(fan[:, 2] > fan[:, 0]))
        self.assertLess(fan[0, 2], fan[1, 2])
        np.testing.assert_allclose(fan[-1, :4], fan[-2, :4])
        self.assertLess(fan[-1, 4], fan[-2, 4])
        self.assertTrue(np.all(np.diff(palm[:, 0]) > 0))
        reflected, _ = inked_hand(
            rgb[::-1], mask[::-1], (542, len(rgb) - 157), 606, skin
        )
        self.assertGreater(fan[0, 3], fan[3, 3])
        self.assertLess(reflected[0, 3], reflected[3, 3])
        rgb[mask] = skin
        self.assertIsNone(inked_hand(rgb, mask, wrist, 606, skin))

    def test_one_pixel_trouser_gap_follows_paper_past_a_pocket(self):
        from .household_front import trouser_opening

        paper = np.array([245, 236, 218])
        cloth = np.array([52, 65, 81])
        rgb = np.tile(paper, (65, 111, 1))
        rgb[:, 20:90] = cloth
        rgb[12:17, 53:57] = paper
        rgb[20:25, 54:57] = cloth // 2
        rgb[26:41, 56] = paper
        rgb[41:, 52:58] = paper
        mask = np.ones(rgb.shape[:2], dtype=bool)

        def opening():
            return trouser_opening(rgb, mask, 54, 7, 55, 1.0, paper, cloth)

        self.assertEqual(opening(), 26)
        rgb[26:41, 56] = 0
        mask[26:41, 56] = False
        self.assertEqual(opening(), 26)
        rgb[41:, 52:58] = cloth
        self.assertIsNone(opening())

    def test_buttons_follow_a_sewn_placket_and_ignore_printed_dots(self):
        from .visible_parts import button_front

        art = Image.new("RGB", (100, 140), "#55466f")
        draw = ImageDraw.Draw(art)
        draw.polygon([(37, 14), (63, 14), (50, 48)], fill="#efb799")
        for y in (57, 77, 97):
            draw.ellipse((47, y - 1, 49, y + 1), fill="#ecdab9")
        cloth = np.array([85, 70, 111])
        skin = np.array([239, 183, 153])

        def measure():
            return button_front(np.array(art, dtype=float), 50, 20, 120, cloth, skin)

        self.assertIsNone(measure())
        draw.line((52, 50, 52, 115), fill="#241c30", width=2)
        result = measure()
        self.assertEqual(result["buttons"], [0.37, 0.57, 0.77])
        np.testing.assert_array_equal(result["buttonColor"], [236, 218, 185])
        self.assertAlmostEqual(result["placketDepth"], 0.29, delta=0.02)

    def test_chin_length_hair_needs_locks_around_both_cheeks(self):
        art = Image.new("RGB", (160, 180), "#fff7ea")
        draw = ImageDraw.Draw(art)
        draw.ellipse((36, 10, 124, 108), fill="#9b522b")
        draw.ellipse((52, 37, 108, 110), fill="#edbe91")
        for x in (32, 109):
            draw.rounded_rectangle((x, 60, x + 19, 106), radius=5, fill="#9b522b")
        rgb = np.array(art, dtype=float)
        mask = (rgb != rgb[0, 0]).any(axis=2)
        hair, skin = np.array([155, 82, 43]), np.array([237, 190, 145])
        rows = hair_fall(rgb, mask, 80, 10, 110, 96, hair, skin)
        self.assertIsNotNone(rows)
        self.assertLess(rows[-1][0], 1.05)
        rgb[75:] = skin
        self.assertIsNone(hair_fall(rgb, mask, 80, 10, 110, 96, hair, skin))

    def test_nape_ends_at_the_connected_lock_even_when_the_jaw_ink_matches(self):
        skin = np.array([243, 170, 129])
        hair = np.array([63, 39, 36])
        rgb = np.tile(skin, (102, 141, 1))
        mask = np.ones(rgb.shape[:2], dtype=bool)
        rgb[:28, 30:111] = hair
        rgb[20:60, 30:44] = hair
        rgb[20:60, 96:111] = hair
        rgb[59:89, [35, 105]] = hair
        rgb[91:97, 25:116] = hair
        self.assertAlmostEqual(
            nape_height(rgb, mask, 70, 0, 100, 100, skin, hair), 0.595
        )
        self.assertIsNone(nape_height(rgb, mask, 70, 0, 100, 100, skin, skin))

    def test_short_bob_registers_its_geometry_and_keeps_the_covered_brow_hidden(self):
        source = VIEWS.parent / "holdout-v1" / "lark-full.webp"
        recipe, _ = fit_front(source, "Unregistered bob")
        design = recipe["design"]
        household = design["household"]
        measured = household["measuredBob"]
        self.assertEqual(measured["frame"], design["head"])
        self.assertLess(measured["skullWidth"], measured["frame"][0])
        self.assertTrue({"hair", "nape", "ears"} <= measured["sections"].keys())
        self.assertNotIn("eyes", measured["sections"])
        self.assertNotIn("fallRows", household)
        left, right = household["orbits"]
        self.assertTrue(left["browOccluded"])
        self.assertNotIn("browRim", left)
        self.assertGreaterEqual(len(right["browRim"]), 6)
        for eye in (left, right):
            self.assertGreater(eye["rimInk"]["width"], 0)
        self.assertNotEqual(household["lipColor"], household["lipInk"])
        self.assertEqual(
            edited_recipe(recipe, [{"field": "design.hair.cut", "value": "waves"}]),
            recipe,
        )

    def test_one_reusable_button_front_carries_its_opening_and_fastener_paint(self):
        from .feature_library import apply_feature

        original = json.loads((RECIPES / "morty-smith.json").read_text())
        feature = {
            "family": "rick-classic",
            "construction": "household",
            "edits": [
                {"field": "design.outfit.top", "value": "polo"},
                {"field": "design.outfit.buttons", "value": [0.31, 0.54, 0.77]},
                {"field": "design.outfit.placketDepth", "value": 0.23},
                {"field": "design.outfit.buttonColor", "value": "#e6cfaa"},
            ],
        }
        revised = apply_feature(original, feature)
        self.assertEqual(revised["design"]["outfit"]["buttonColor"], "#e6cfaa")
        crew = edited_recipe(revised, [{"field": "design.outfit.top", "value": "crew"}])
        self.assertEqual(crew["design"]["outfit"], original["design"]["outfit"])

    def test_cropped_arm_uses_both_sleeve_edges_and_the_exposed_skin_radius(self):
        from .visible_parts import visible_arm

        art = Image.new("RGB", (190, 145), "#f1eee2")
        draw = ImageDraw.Draw(art)
        draw.rectangle((0, 108, 189, 118), fill="#d39e7d")
        draw.rectangle((51, 106, 139, 121), fill="#3a7188")
        draw.rectangle((70, 102, 120, 144), fill="#3a7188")
        rgb = np.asarray(art, dtype=float)
        mask = (rgb != rgb[0, 0]).any(axis=2)
        head = [50, 10, 140, 95]
        arm = visible_arm(rgb, mask, head, rgb[112, 4], rgb[112, 90])
        self.assertAlmostEqual(arm["cuff"], 45 / 85, delta=0.025)
        self.assertAlmostEqual(arm["level"], 18 / 85, places=3)
        self.assertAlmostEqual(arm["radius"], 5.5 / 85, places=3)
        self.assertIsNone(
            visible_arm(rgb[:109], mask[:109], head, rgb[112, 4], rgb[112, 90])
        )

    def test_enamel_and_tongue_are_sampled_inside_the_open_mouth(self):
        from .visible_parts import open_smile

        art = Image.new("RGB", (120, 128), "#df9c77")
        draw = ImageDraw.Draw(art)
        draw.ellipse((43, 79, 77, 96), fill="#4a232b")
        draw.line((50, 82, 70, 82), fill="#fff4ed", width=2)
        draw.ellipse((53, 89, 67, 93), fill="#bc4b55")
        rgb = np.asarray(art, dtype=float)
        result = open_smile(
            rgb, [(37, 44, 53, 60), (67, 44, 83, 60)], 12, 115, rgb[0, 0]
        )
        colors = result["mouth_pigments"]
        self.assertEqual(colors["teeth"], [255, 244, 237])
        self.assertEqual(colors["cavity"], [74, 35, 43])
        self.assertEqual(colors["tongue"], [188, 75, 85])

    def test_gpt_image_front_recovers_an_unregistered_head_garment_and_closed_collar(
        self,
    ):
        source = VIEWS.parent / "nia.webp"
        recipe, score = fit_front(source, "Someone new")
        design = recipe["design"]
        self.assertIsNone(match(source, recipe, score))
        self.assertEqual(recipe["construction"], "household")
        self.assertTrue(design["household"]["penOutline"])
        self.assertGreater(len(design["hairline"]), 12)
        self.assertEqual(len(design["household"]["orbits"]), 2)
        self.assertTrue(
            all(eye.get("browRim") for eye in design["household"]["orbits"])
        )
        self.assertGreater(
            design["household"]["body"]["sections"]["crew"]["binding"], 2
        )
        self.assertGreater(score["eye_frame"][2], score["eye_frame"][0])
        self.assertNotIn("fallRows", design["household"])
        self.assertNotIn("headband", design["household"])
        self.assertEqual(len(design["household"]["ears"]), 2)

    def test_headband_is_measured_from_a_thin_crown_arc_without_a_paint_sample(self):
        image = Image.new("RGB", (152, 200), "#914c32")
        draw = ImageDraw.Draw(image)
        draw.arc((18, 4, 134, 194), 183, 356, fill="#a2dce8", width=6)
        rows = np.asarray(image, dtype=float)
        mask = np.ones(rows.shape[:2], dtype=bool)
        band = scalp_band(
            rows, mask, 0, 190, 140, np.array([242, 198, 160]), np.array([145, 76, 50])
        )
        self.assertEqual(band["color"], "#a2dce8")
        pixel_width = (
            band["width"] * projected_band_width(band["tilt"], 0, 190 / 140) * 140
        )
        self.assertAlmostEqual(pixel_width, 6, delta=1.5)
        draw.rectangle((6, 0, 145, 134), fill="#a2dce8")
        self.assertIsNone(
            scalp_band(
                np.asarray(image, dtype=float),
                mask,
                0,
                190,
                140,
                np.array([242, 198, 160]),
                np.array([145, 76, 50]),
            )
        )

    def test_headband_uses_the_same_family_edit_contract_as_the_eyepatch(self):
        original = json.loads((RECIPES / "jessica.json").read_text())
        band = original["design"]["household"]["headband"]
        revised = edited_recipe(
            original,
            [
                {
                    "field": "design.household.headband",
                    "value": {**band, "color": "#b14468"},
                }
            ],
        )
        self.assertEqual(revised["design"]["household"]["headband"]["color"], "#b14468")
        removed = edited_recipe(
            revised, [{"field": "design.household.headband", "value": None}]
        )
        self.assertNotIn("headband", removed["design"]["household"])
        self.assertEqual(
            revised["design"]["household"]["mouthPaint"],
            original["design"]["household"]["mouthPaint"],
        )

    def test_changing_a_registered_button_front_to_a_crew_removes_the_fasteners(self):
        original = json.loads((RECIPES / "jessica.json").read_text())
        crew = edited_recipe(
            original, [{"field": "design.outfit.top", "value": "crew"}]
        )
        self.assertNotIn("buttons", crew["design"]["outfit"])
        with self.assertRaises(ValueError):
            edited_recipe(
                original, [{"field": "design.outfit.buttons", "value": [0.55, 0.30]}]
            )

    def test_registered_hair_accessory_can_be_dyed_without_changing_skin_or_clothes(
        self,
    ):
        original = json.loads((RECIPES / "jessica.json").read_text())
        reference = np.array(Image.open(VIEWS / "jessica-front.webp").convert("RGBA"))
        mask = role_masks(reference, original["design"])[-1]
        self.assertGreater(mask.sum(), 6)
        reference[mask, :3] = (reference[mask, :3].astype(float) + [0, -73, -30]).clip(
            0, 255
        )
        with TemporaryDirectory() as tmp:
            source = Path(tmp) / "changed.png"
            Image.fromarray(reference).save(source)
            result, registration = match(source, original, {"head_fraction": 0.24})
        self.assertEqual(registration["head_base"], "jessica")
        self.assertNotEqual(
            result["design"]["household"]["headband"]["color"],
            original["design"]["household"]["headband"]["color"],
        )
        self.assertEqual(result["design"]["skin"], original["design"]["skin"])
        self.assertEqual(result["design"]["outfit"], original["design"]["outfit"])

    def test_cut_registration_uses_body_and_local_paint_instead_of_character_name(self):
        original = json.loads((RECIPES / "jerry-smith.json").read_text())
        reference = np.asarray(
            Image.open(VIEWS / "jerry-smith-front.webp").convert("RGBA")
        ).copy()
        mask = role_masks(reference, original["design"])[2]
        # The alternative carries genuinely different shirt pigments.
        reference[mask, :3] = np.clip(
            reference[mask, :3].astype(float) + [29, 0, 30], 0, 255
        )
        with TemporaryDirectory() as tmp:
            source = Path(tmp) / "some-body.png"
            Image.fromarray(reference).save(source)
            measured = {**original, "name": "Anonymous"}
            result, registration = match(source, measured, {"head_fraction": 0.23})
        self.assertEqual(registration["body_base"], "jerry-smith")
        self.assertEqual(result["name"], "Anonymous")
        self.assertNotEqual(
            result["design"]["outfit"]["color"], original["design"]["outfit"]["color"]
        )
        self.assertEqual(
            result["design"]["outfit"]["bands"], original["design"]["outfit"]["bands"]
        )
        self.assertEqual(
            result["design"]["household"]["widths"],
            original["design"]["household"]["widths"],
        )

    def test_long_hair_needs_pigment_on_both_sides_of_neck(self):
        rgb = np.zeros((148, 150, 3)) + 235
        skin = np.array([238, 168, 127])
        hair = np.array([75, 45, 26])
        rgb[23:112, 33:50] = hair
        rgb[23:112, 100:117] = hair
        mask = rgb[:, :, 0] < 200
        rows = hair_fall(rgb, mask, 75, 10, 94, 94, hair, skin)
        self.assertGreater(rows[-1][0], 1.1)
        self.assertTrue(all(a < b for (_, b, a) in rows))
        rgb[:, 100:117] = 235
        self.assertIsNone(
            hair_fall(rgb, rgb[:, :, 0] < 200, 75, 10, 94, 94, hair, skin)
        )

    def test_household_revisions_keep_the_registered_construction_and_rig(self):
        original = json.loads((RECIPES / "beth-smith.json").read_text())
        result = edited_recipe(
            original, [{"field": "design.hair.color", "value": "#DBA241"}]
        )
        self.assertEqual(result["design"]["hair"]["color"], "#dba241")
        self.assertEqual(result["design"]["household"], original["design"]["household"])
        self.assertNotEqual(original["design"]["hair"]["color"], "#dba241")
        with self.assertRaises(ValueError):
            edited_recipe(original, [{"field": "paints.coat", "value": "#999999"}])
        for field, value in [
            ("design.face.eyeRadius", 0.8),
            ("design.household.body", {}),
        ]:
            with self.assertRaises(ValueError):
                edited_recipe(original, [{"field": field, "value": value}])

    def test_wearable_uses_the_same_bounded_recipe_edit_as_a_hosted_reviewer(self):
        evil = json.loads((RECIPES / "evil-morty.json").read_text())
        morty = json.loads((RECIPES / "morty-smith.json").read_text())
        patch = evil["design"]["household"]["eyePatch"]
        value = edited_recipe(
            morty, [{"field": "design.household.eyePatch", "value": patch}]
        )
        self.assertEqual(value["design"]["household"]["eyePatch"]["side"], "right")
        self.assertEqual(value["design"]["outfit"], morty["design"]["outfit"])
        restored = edited_recipe(
            value, [{"field": "design.household.eyePatch", "value": None}]
        )
        self.assertEqual(restored, morty)

    def test_cropped_nape_uses_bilateral_visible_ear_lobes(self):
        from .household import fit_crop_back

        scalp = {
            "nape": 0.67,
            "ears": [[-0.45, 0.71, 0.05, 0.06], [0.45, 0.72, 0.05, 0.06]],
        }
        design = {"hair": {"cut": "crop"}, "household": scalp}
        fit_crop_back(design)
        self.assertNotIn("rearHairline", scalp)
        scalp["pinnae"] = [[0], [0]]
        fit_crop_back(design)
        self.assertAlmostEqual(scalp["rearHairline"], 0.865)
        del scalp["rearHairline"]
        design["hair"]["cut"] = "ponytail"
        fit_crop_back(design)
        self.assertNotIn("rearHairline", scalp)

    def test_disconnected_ear_pigment_cannot_widen_the_jaw(self):
        from .household import frontal_jaw_widths

        skin, hair = np.array([205, 140, 98]), np.array([54, 37, 32])
        rgb = np.full((120, 160, 3), hair, dtype=float)
        for y in range(30, 108):
            half = max(6, 42 - (y - 30) // 2)
            rgb[y, 80 - half : 81 + half] = skin
        measure = lambda: frontal_jaw_widths(
            rgb, np.ones((120, 160), bool), 80, 7, 100, 96, skin, hair
        )
        without = measure()
        rgb[62:87, 32:40] = skin
        rgb[62:87, 120:128] = skin
        self.assertEqual(measure(), without)
        self.assertGreater(without[0], without[-1])

    def test_portrait_recovers_visible_body_width_and_open_smile(self):
        from .portrait import compile_portrait, propose_portrait

        source = VIEWS.parent / "holdout-v1/poe-portrait.webp"
        candidate = compile_portrait(
            source,
            "rick-classic",
            "New portrait",
            propose_portrait(source, "rick-classic"),
        )
        design = candidate["design"]
        self.assertEqual(design["mouth"], "speaking")
        self.assertEqual(design["outfit"]["top"], "polo")
        self.assertTrue(
            all(orbit.get("browRim") for orbit in design["household"]["orbits"])
        )
        self.assertGreater(design["household"]["shirtHalfWidth"], 0.4)
        self.assertIn("mouthPaint", design["household"])
        self.assertEqual(design["household"]["portraitPreset"], "adult-casual")
        self.assertNotIn("body", design["household"])

    def test_foot_opening_distinguishes_a_pale_sock_from_bare_skin(self):
        for subject, sock in (("moss", True), ("lark", False)):
            with self.subTest(subject=subject):
                source = VIEWS.parent / "holdout-v1" / (subject + "-full.webp")
                design = fit_front(source, "New foot study")[0]["design"]
                sole = design["household"]["body"]["sections"]["outsole"]
                collar = sole["collar"]
                self.assertEqual(len(collar["tops"]), len(sole["rows"]))
                self.assertTrue(
                    all(y <= row[1] for y, row in zip(collar["tops"], sole["rows"]))
                )
                self.assertGreater(
                    max(row[1] - y for y, row in zip(collar["tops"], sole["rows"])), 4
                )
                self.assertEqual(collar["color"] != design["skin"], sock)
                self.assertEqual(bool(sole.get("laces")), sock)
                if sock:
                    self.assertGreaterEqual(len(sole["laces"]), 2)
                    self.assertNotEqual(sole["ink"], sole["color"])

    def test_laces_follow_matching_ink_on_the_vamp(self):
        from .tracing import lace_strokes

        shoe = np.array([108, 76, 64])
        patch = np.tile(shoe, (36, 51, 1))
        cols = np.column_stack((np.arange(2, 49), np.tile([5, 8, 29, 32], (47, 1))))
        for x in range(16, 32):
            y = 15 - (x - 16) // 6
            patch[y, x] = [35, 25, 20]
        self.assertFalse(lace_strokes(patch, cols, shoe))
        for x in range(18, 34):
            y = 19 - (x - 18) // 6
            patch[y, x] = [35, 25, 20]
        strokes = lace_strokes(patch, cols, shoe)
        self.assertEqual(len(strokes), 2)
        for stroke in strokes:
            self.assertTrue(np.all(patch[stroke[:, 1], stroke[:, 0], 0] == 35))
        patch[7:9] = [35, 25, 20]
        self.assertEqual(len(lace_strokes(patch, cols, shoe)), 2)

    def test_inked_foot_recovers_the_outline_and_rejects_detached_marks(self):
        from .household_front import inked_foot_columns

        paper, cloth, leather, ink = [
            np.array(c)
            for c in ([246, 240, 233], [76, 87, 130], [127, 75, 60], [30, 24, 21])
        ]
        patch = np.tile(paper, (30, 48, 1))
        patch[:5, 9:17] = cloth
        patch[5:14, [10, 15]] = ink
        patch[12:22, 9:31] = ink
        patch[14:20, 11:29] = leather
        patch[20:22, 10:30] = paper
        patch[22, 9:31] = ink
        patch[3:6, 26:29] = ink
        dyed = (patch == leather).all(axis=2)
        cols, hem = inked_foot_columns(
            patch, np.ones(dyed.shape, bool), paper, dyed, leather, cloth, 13, 4, True
        )
        self.assertEqual(hem, 5)
        toe, ankle = [cols[cols[:, 0] == x][0] for x in (27, 13)]
        self.assertEqual(toe[1], 12)
        self.assertEqual(ankle[1], 5)
        self.assertEqual(ankle[-1], 22)
        self.assertLess(ankle[1], ankle[2])
        self.assertLess(ankle[3], ankle[4])

        # Leave five extra rows of the paper cutout inside the foreground.
        # The traced sole still ends on the same painted bottom edge.
        from .household_front import fit_footwear

        floors = []
        for padding in (0, 5):
            figure = np.zeros(dyed.shape, bool)
            figure[: 23 + padding, 9:31] = True
            body = {"sections": {"leg": [[6, 13, 4], [12, 13, 4]]}}
            outfit = {"shoes": "#7f4b3c", "trousers": "#4c5782"}
            fit_footwear(
                patch, figure, 0, 0, 1, body, outfit, np.array([210, 151, 110])
            )
            floors.append(max(row[-1] for row in body["sections"]["outsole"]["rows"]))
        self.assertAlmostEqual(floors[0], floors[1])
        self.assertAlmostEqual(floors[0], 12 + 22, delta=1)

        # A small open arch under the leather must extend up to its own edge.
        patch[19:23, 19:22] = paper
        patch[18, 19:22] = ink
        dyed = (patch == leather).all(axis=2)
        arch, _ = inked_foot_columns(
            patch, np.ones(dyed.shape, bool), paper, dyed, leather, cloth, 13, 4, True
        )
        heel, gap, toe = (arch[arch[:, 0] == x][0, -1] for x in (17, 20, 24))
        self.assertLess(gap, min(heel, toe))

    def test_roll_and_split_require_visible_cloth_evidence(self):
        for name, rolled in (("lark", True), ("moss", False)):
            with self.subTest(name=name):
                source = VIEWS.parent / "holdout-v1" / (name + "-full.webp")
                design = fit_front(source, "New garment study")[0]["design"]
                edges = design["household"]["body"]["sections"].get("garmentEdges", {})
                self.assertEqual("rolledCuff" in edges, rolled)
                self.assertEqual("frontHem" in edges, rolled)
                if rolled:
                    hem = edges["frontHem"]
                    self.assertLess(
                        hem[12] + 0.075, min(max(hem[5:11]), max(hem[14:20]))
                    )

    def test_visible_jersey_width_requires_both_edges_below_the_sleeve(self):
        from .portrait import jersey_chest_width

        mask = np.zeros((104, 120), dtype=bool)
        mask[83:, 42:79] = True
        measured = jersey_chest_width(mask, (60, 38, 20, 20), 0, 1)
        self.assertLess(measured, 0.85)
        self.assertIsNone(jersey_chest_width(mask[:84], (60, 38, 20, 20), 0, 1))
        mask[83:] = True
        self.assertIsNone(jersey_chest_width(mask, (60, 38, 20, 20), 0, 1))

    def test_data_feature_fits_two_family_members_without_changing_their_heads(self):
        from .feature_library import apply_feature

        feature = {
            "name": "mint-headband",
            "family": "rick-classic",
            "construction": "household",
            "edits": [
                {
                    "field": "design.household.headband",
                    "value": {"color": "#83cebb", "width": 0.09, "tilt": 0.23},
                }
            ],
        }
        for slug in ("jessica", "nia-bell"):
            base = json.loads((RECIPES / (slug + ".json")).read_bytes())
            result = apply_feature(base, feature)
            self.assertEqual(
                result["design"]["household"]["headband"], feature["edits"][0]["value"]
            )
            self.assertEqual(
                result["design"]["household"]["orbits"],
                base["design"]["household"]["orbits"],
            )
        with self.assertRaisesRegex(ValueError, "another family"):
            apply_feature({"family": "sunshine"}, feature)
