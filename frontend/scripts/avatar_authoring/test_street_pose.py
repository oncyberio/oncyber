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
