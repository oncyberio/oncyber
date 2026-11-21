import json
import runpy
import unittest
from pathlib import Path

import numpy as np


class StreetPoseTests(unittest.TestCase):
    def test_turn_drawing_resolves_ambiguous_spikes_on_either_side(self):
        fit = runpy.run_path(
            str(Path(__file__).resolve().parents[1] / "fit-streetwear.py")
        )["register_illustration"]
        for sign in (-1, 1):
            yaw = np.deg2rad(sign * 40)

            def project(p, yaw=yaw):
                x, y, z = p
                return [120 + 1.5 * (x * np.cos(yaw) + z * np.sin(yaw)), 25 + 1.5 * y]

            tips = [
                [-80, 20, -25],
                [-100, 90, -60],
                [-90, 130, -70],
                [80, 20, -75],
                [100, 90, -75],
                [90, 130, -80],
            ]
            recipe = {
                "faceFit": {
                    "orbit": [[131, 18, 30, 49, 45]],
                    "sections": [
                        [149, 37, 71, -34],
                        [168, 26, 61, -3],
                        [184, 1.5, 53, 46],
                    ],
                },
                "hair": {"spikes": [[0, 92, -15, *tip, 20] for tip in tips]},
            }
            face = {
                "leftEye": [-24, 131, 47],
                "rightEye": [24, 131, 47],
                "nose": [0, 149, 71],
                "chin": [0, 184, 53],
                "mouth": [0, 168, 61],
            }
            pose = fit(
                recipe,
                {
                    "face": {k: project(v) for k, v in face.items()},
                    "spikeTips": {
                        "leftUpper": project([-80, 20, -75]),
                        "rightUpper": project([80, 20, -25]),
                    },
                },
            )
            self.assertEqual((pose["turn"], pose["tilt"]), (40 * sign, 0))
            self.assertEqual(pose["spike_rms_after_px"], 0)
            self.assertEqual(
                [r[5] for r in recipe["hair"]["spikes"]], [-75, -60, -70, -25, -75, -80]
            )
            self.assertTrue(
                all(r[:3] == [0, 92, -15] for r in recipe["hair"]["spikes"])
            )

    def test_vale_three_quarter_survives_reduction_and_hides_far_tuft(self):
        from .street_oblique import compare_mesh

        scripts = Path(__file__).resolve().parents[1]
        recipe = scripts.parent / "public/lobby/procedural/recipes/vale-streetwear.json"
        marks = (
            scripts / "avatar_authoring/targets/streetwear-v1/vale-illustration.json"
        )
        measured = compare_mesh(recipe, marks, 43)
        for lod in ("full", "crowd"):
            self.assertLess(measured[lod]["rms_px"], 7.2)
            self.assertLess(measured[lod]["landmark_error_px"]["nose"], 4.5)
        model = json.loads(recipe.read_text())
        turn = np.deg2rad(
            json.loads(marks.read_text())["hiddenTipsAtTurn"]["leftLower"]
        )
        x, y, z = model["hair"]["spikes"][2][3:6]
        rows = np.asarray(model["faceFit"]["sections"])
        face_depth = np.interp(y, rows[:, 0], rows[:, 2])
        # The tip sits inside the face in the counterturn, with drawing-unit clearance.
        self.assertGreater(
            x * np.cos(turn) + z * np.sin(turn), face_depth * np.sin(turn) + 2
        )
