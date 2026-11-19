import json
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

import numpy as np
from PIL import Image, ImageDraw

from .family_edits import edited_recipe
from .household import projected_band_width, scalp_band
from .household_front import fit_front, hair_fall
from .household_registration import RECIPES, VIEWS, match, role_masks


class HouseholdTests(unittest.TestCase):
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
