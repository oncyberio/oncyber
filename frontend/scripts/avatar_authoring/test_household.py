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
        self.assertNotIn("body", design["household"])

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
