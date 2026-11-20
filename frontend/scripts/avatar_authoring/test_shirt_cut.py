import copy
import unittest
from pathlib import Path

import numpy as np

from .family_edits import edited_recipe
from .household_front import fit_front
from .shirt_cut import compare_shirt_cut, fit_shirt_cut, shirt_side_offset


class ShirtCutTests(unittest.TestCase):
    def test_crew_edges_include_ink_and_abstain_for_missing_sleeve(self):
        paper = np.array([248.0, 242.0, 230.0])
        fabric = np.array([123.0, 150.0, 56.0])
        skin = np.array([203.0, 146.0, 109.0])
        art = np.tile(paper, (180, 181, 1))
        art[23:38, 22:161] = fabric
        art[37:130, 56:129] = fabric
        art[37:130, [55, 129]] = 20
        body = {
            "shoulder": 30,
            "neckline": 32,
            "hem": 139,
            "sections": {
                "arm": [[30, 42, 8], [43, 42, 8], [60, 42, 8]],
                "sleeve": 50,
                "crew": {},
                "torso": [[38, 17], [63, 52], [132, 59]],
            },
        }

        def fit(body):
            mask = np.any(art != paper, axis=2)
            return fit_shirt_cut(art, mask, 90, 0, 1, body, fabric, skin, "crew")

        initial = copy.deepcopy(body)
        cut = fit(body)
        self.assertEqual(cut["station"], 43)
        self.assertEqual(cut["centers"][-1], 2)
        self.assertEqual(body["sections"]["torso"][-1], [132, 37.5])
        self.assertNotIn("opening", cut)
        art[:38, :65] = paper
        self.assertIsNone(fit(initial))
        self.assertEqual(initial["sections"]["torso"][-1], [132, 59])

    def test_small_hair_cap_open_collar_and_raised_thumbs(self):
        # This independently drawn target previously sampled a white eyeball
        # as hair and included both shirt shoulders in the head's convex hull.
        path = Path(__file__).parent / "targets/holdout-v1/finch-full.webp"
        recipe, _ = fit_front(path, "Different name")
        design = recipe["design"]
        self.assertLess(design["head"][0] / design["head"][1], 0.84)
        hair = list(bytes.fromhex(design["hair"]["color"][1:]))
        self.assertLess(max(hair), 110)
        self.assertGreater(hair[0], hair[2] + 20)
        shirt = design["outfit"]
        self.assertEqual(shirt["top"], "polo")
        self.assertEqual(len(shirt["buttons"]), 2)
        self.assertLess(shirt["buttons"][-1], shirt["placketEnd"])
        self.assertLess(shirt["placketEnd"], 0.4)
        sections = design["household"]["body"]["sections"]
        self.assertIn("opening", sections["shirtCut"])
        for hand in sections["openHands"]:
            self.assertEqual(len(hand), 5)
            self.assertLess(hand[0][2], hand[1][2])
            self.assertLess(hand[0][3], min(f[3] for f in hand[1:]))

    def test_measured_polo_follows_connected_skin_and_both_turnbacks(self):
        src = Path(__file__).parent / "targets/holdout-v1/lark-full.webp"
        recipe, _ = fit_front(src, "Test")
        body = recipe["design"]["household"]["body"]
        cut = body["sections"]["shirtCut"]
        opening = np.array(cut["opening"])
        self.assertTrue(np.all(np.diff(opening[:, 0]) > 0))
        self.assertEqual(opening[-1, 1], opening[-1, 2])
        self.assertGreater(
            np.ptp(opening[:, 0]), (body["hem"] - body["neckline"]) * 0.25
        )
        for sign, path in zip((-1, 1), cut["wings"]):
            self.assertGreater(sign * (path[2][0] - path[0][0]), 10)
            self.assertLess(path[3][1], path[2][1])
        self.assertEqual(
            compare_shirt_cut(src, src, recipe["design"]),
            {"torso_cloth_iou": 1.0, "neck_skin_iou": 1.0},
        )
        self.assertIsNone(shirt_side_offset(src, src, recipe["design"]))

        def adjust(offset):
            return edited_recipe(
                recipe, [{"field": "shirtSideOffset", "value": offset}]
            )

        adjusted = adjust([-3, 5])["design"]["household"]["body"]
        old, new = body["sections"], adjusted["sections"]
        self.assertEqual(new["torso"][0], old["torso"][0])
        self.assertAlmostEqual(new["torso"][-1][1] - old["torso"][-1][1], 4)
        self.assertAlmostEqual(new["shirtCut"]["centers"][-1] - cut["centers"][-1], 1)
        self.assertEqual(new["shirtCut"]["opening"], cut["opening"])
        self.assertEqual(new["arm"], old["arm"])
        with self.assertRaises(ValueError):
            adjust([0, 8])
        cut["station"] += 0.01
        with self.assertRaisesRegex(ValueError, "sleeve"):
            adjust([0, 2])
        del old["shirtCut"]
        with self.assertRaisesRegex(ValueError, "torso"):
            adjust([0, 2])
