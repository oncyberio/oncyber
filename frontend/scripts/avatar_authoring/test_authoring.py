"""Regression checks for the image and provider boundaries of cartoon authoring."""

import json
import runpy
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import numpy as np
from PIL import Image, ImageDraw

from .eyes import (
    measure_eye,
    compare_gaze,
    lower_eye_ink,
    suggest_eye_centers,
    turned_eyes,
)
from .fit import pixels
from .install import install
from .observation import image_landmarks
from .provider import ask
from .tracing import (
    forehead_lock,
    open_hand,
    crew_neckline,
    ear_lobes,
    eye_strokes,
    eyebrow,
    mouth_profile,
    sleeve_cuff,
)


class AuthoringTests(unittest.TestCase):
    def test_oblique_hair_identifies_which_temple_owns_a_swept_lock(self):
        from .profile import projected_forelock_side

        mask = np.zeros((100, 120), dtype=bool)
        contour = [[0, -40, 40, -15, 15], [80, -40, 40, -15, 15]]
        roll = [[v, -1, 1] for v in np.linspace(0.15, 0.48, 8)]

        def owner(pixels, samples=roll):
            return projected_forelock_side(
                pixels, contour, samples, 0, 60, 60, 0.5, 60, 0, 1
            )

        mask[:, 66:80] = True
        self.assertEqual(owner(mask), 1)
        self.assertEqual(owner(mask[:, ::-1]), -1)
        self.assertIsNone(owner(mask, roll[:3]))
        self.assertIsNone(owner(mask | mask[:, ::-1]))

    def test_gaze_trial_retains_the_best_native_pose_and_original_target(self):
        from .study import Study, write

        target = [0.65, 0.65]
        study = SimpleNamespace(base="", backend="webgl")
        recipe = {
            "design": {"fit": {"sections": {"sideGuide": {"turnedPupils": target}}}}
        }

        def capture(file, directory, *args, **kwargs):
            positions = json.loads(file.read_text())["design"]["fit"]["sections"][
                "sideGuide"
            ]["turnedPupils"]
            write(
                directory / "portrait-quarter-gaze.png",
                [0.5 + 1.5 * (p - 0.65) for p in positions],
            )

        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            pose = directory / "portrait-quarter-gaze.png"
            write(pose, [0.5, 0.5])
            with (
                patch("avatar_authoring.study.render", side_effect=capture),
                patch(
                    "avatar_authoring.study.quarter_pupils",
                    side_effect=lambda f: json.loads(f.read_text()),
                ),
            ):
                record = Study.fit_gaze_pose(study, directory, recipe, target)
            self.assertAlmostEqual(record["max_error_after"], 0, places=4)
            self.assertEqual(record["target"], target)
            np.testing.assert_allclose(json.loads(pose.read_text()), target)
            self.assertEqual(
                json.loads((directory / "recipe.json").read_text()), recipe
            )

    def test_pupil_surrounded_by_white_is_distinct_from_a_fringe_over_the_rim(self):
        image = Image.new("RGB", (84, 80), "#deac89")
        draw = ImageDraw.Draw(image)
        draw.ellipse((4, 4, 79, 76), fill="white")
        draw.polygon([(12, 1), (33, 7), (25, 40)], fill="#352142")
        draw.ellipse((55, 35, 63, 43), fill="#16131a")
        rgb = np.asarray(image)
        _, pupil = measure_eye(rgb.min(axis=2) > 220, rgb)
        np.testing.assert_allclose(pupil[:2], [59, 39], atol=1)
        self.assertLess(pupil[2], 6)

    def test_part_fitter_keeps_front_and_side_offsets_from_the_orbit(self):
        from .rounded import fit_masks

        y, x = np.mgrid[:101, :121]
        front = ((x - 70) / 28) ** 2 + ((y - 50) / 40) ** 2 <= 1
        side = ((x - 54) / 18) ** 2 + ((y - 50) / 40) ** 2 <= 1
        sections, curve = fit_masks(front, side, None, 80, (100, 200, 300), stations=17)
        np.testing.assert_allclose(sections[8], [200, 82, 138, 18, 294])
        self.assertIsNone(curve)

    def test_profile_review_detects_a_misplaced_or_missing_bang(self):
        from .profile import exposed_temple

        guide = np.zeros((250, 320), dtype=int)
        guide[36:95, 45:135] = 3
        guide[36:95, 135:158] = 2
        guide[36:95, 158:177] = 3
        matching = exposed_temple(guide, guide)
        self.assertEqual(matching["visible_fraction"], 1)
        self.assertEqual(matching["p90_edge_error"], 0)
        displaced = guide.copy()
        displaced[36:95, 158:178] = 2
        displaced[36:95, 178:197] = 3
        self.assertGreater(exposed_temple(guide, displaced)["p90_edge_error"], 0.14)
        displaced[36:95, 178:197] = 2
        self.assertEqual(exposed_temple(guide, displaced)["visible_fraction"], 0)
        self.assertIsNone(exposed_temple(displaced, guide))

    def test_lower_eye_ink_measures_pigment_against_the_cheek(self):
        skin, pen = (154, 96, 71), (47, 12, 28)
        im = Image.new("RGB", (110, 96), skin)
        draw = ImageDraw.Draw(im)
        draw.ellipse((13, 15, 93, 76), fill=pen)
        draw.ellipse((16, 18, 90, 73), fill="white")
        rgb = np.asarray(im)
        white = rgb.min(axis=2) == 255
        bounds = (16, 18, 90, 73)
        width, color = lower_eye_ink(rgb, white, bounds, skin)
        self.assertAlmostEqual(width, 3, delta=0.65)
        np.testing.assert_array_equal(color, pen)

        uninked = np.where(white[:, :, None], rgb, np.array(skin))
        self.assertIsNone(lower_eye_ink(uninked, white, bounds, skin))

    def test_calibration_ranks_the_weakest_view(self):
        from .study import turn_quality

        def view(overlap):
            return dict(silhouette_iou=overlap, skin_iou=overlap, hair_iou=overlap)

        uneven = {"side_view": view(0.99), "opposite_view": view(0.74)}
        balanced = {"side_view": view(0.85), "opposite_view": view(0.82)}
        self.assertGreater(turn_quality(balanced), turn_quality(uneven))

    def test_turn_comparison_keeps_enclosed_background_and_camera_axis(self):
        tool = runpy.run_path(
            str(Path(__file__).resolve().parents[1] / "compare-cartoon-turns.py")
        )
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            image = Image.new("L", (80, 80), 0)
            draw = ImageDraw.Draw(image)
            draw.rectangle((24, 8, 56, 71), fill=255)
            draw.rectangle((30, 36, 50, 63), fill=0)
            for view in tool["VIEWS"]:
                image.save(
                    root / ("mask.png" if view == "front" else f"{view}-mask.png")
                )
            masks = tool["mattes"](root)
            self.assertFalse(masks["quarter"][50, 40])
            masks["profile"] = np.roll(masks["profile"], 8, axis=1)
            turns = tool["register"](masks)
            self.assertEqual(tool["overlap"](turns["front"], turns["quarter"]), 1)
            self.assertLess(tool["overlap"](turns["front"], turns["profile"]), 0.7)

    def test_bob_hem_excludes_detached_collar_ink_of_the_same_color(self):
        from .profile import scalp_components

        hair = np.zeros((125, 70), bool)
        hair[4:76, 5:45] = True
        hair[65:96, 5:9] = True
        hair[101:115, 18:45] = True
        kept = scalp_components(hair, 4, 113)
        self.assertTrue(kept[95, 8])
        self.assertFalse(kept[104, 23])

    def test_quarter_nose_checks_the_way_the_tip_turns(self):
        from .profile import quarter_nose_difference

        line = np.array([[2, 0], [4, 5], [4, 7], [1, 9]], dtype=float)
        self.assertEqual(quarter_nose_difference(line, line + 0.3)["status"], "matched")
        self.assertEqual(
            quarter_nose_difference(line, line * [-1, 1])["status"], "reversed"
        )
        self.assertEqual(quarter_nose_difference(line, line + 15)["status"], "offset")
        self.assertEqual(quarter_nose_difference(line, None)["status"], "missing")
        self.assertIsNone(quarter_nose_difference(None, line))

    def test_a_heavy_fringe_can_hide_only_one_brow(self):
        from .tracing import brow_covered_by_hair

        hair = np.zeros((100, 120), dtype=bool)
        hair[10:51, 64:] = True
        self.assertTrue(brow_covered_by_hair(hair, 65, 94, 52))
        self.assertFalse(brow_covered_by_hair(hair, 24, 53, 52))

    def test_spiked_crown_follows_the_drawn_tips_and_ignores_a_smooth_bob(self):
        from .tracing import radial_crown

        y, x = np.mgrid[:160, :180]
        angle = np.arctan2(y - 68, x - 90)
        distance = np.hypot(x - 90, y - 68)
        radius = 40 + 15 * np.cos(8 * angle + 0.4)
        traced = radial_crown(distance < radius, 90, 85, 73)
        self.assertIsNotNone(traced)
        center, rim = traced
        self.assertLess(abs(center[0] - 90), 1)
        self.assertGreater(np.ptp(rim[:, 0]), 96)
        self.assertLessEqual(len(rim), 180)
        self.assertIsNone(radial_crown(distance < 50, 90, 85, 73))

    def test_open_mouth_retains_tooth_gaps_and_tongue_and_skips_a_closed_crease(self):
        from .tracing import painted_open_mouth

        skin = np.array([197, 178, 164])
        im = np.full((130, 130, 3), skin, dtype=float)
        im[76:86, 36:96] = [104, 36, 36]
        self.assertIsNone(painted_open_mouth(im, skin, 65, 46, 112, 78))
        for x in range(39, 90, 10):
            im[73:78, x : x + 7] = [218, 204, 156]
            im[84:89, x : x + 7] = [218, 204, 156]
        im[80:86, 61:66] = [212, 88, 88]
        rows, cavity, teeth, tongue = painted_open_mouth(im, skin, 65, 46, 112, 78)
        self.assertTrue(np.all(np.diff(rows[:, 1:], axis=1) >= 0))
        self.assertTrue(
            np.any(rows[:, 1] == rows[:, 2]) and np.any(rows[:, 1] < rows[:, 2])
        )
        np.testing.assert_equal(cavity, [104, 36, 36])
        np.testing.assert_equal(teeth, [218, 204, 156])
        np.testing.assert_equal(tongue, [212, 88, 88])

    def test_pale_sleeves_survive_on_a_lossless_flat_backdrop(self):
        im = Image.new("RGB", (140, 140), (232, 226, 214))
        pen = ImageDraw.Draw(im)
        pen.rectangle((53, 20, 86, 113), fill=(112, 80, 68))
        pen.rectangle((8, 50, 131, 59), fill=(236, 236, 236))
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "figure.png"
            im.save(path)
            _, mask = pixels(path)
        self.assertTrue(mask[54, 10] and mask[54, 129] and mask[63, 70])
        self.assertFalse(mask[40, 18])

    def test_turn_review_finds_background_between_the_bob_and_forehead(self):
        from .profile import forehead_gap

        layers = np.zeros((250, 320), dtype=np.uint8)
        layers[20:130, 60:260] = 2
        layers[20:130, 247:260] = 3
        image = np.full((250, 320, 3), 230, dtype=np.uint8)
        image[layers == 2] = [174, 108, 76]
        image[layers == 3] = [43, 72, 50]
        # A horizontal lid highlight and the backdrop outside the head are allowed.
        image[98:101, 235:249] = 230
        self.assertEqual(forehead_gap(layers, image)["area_px"], 0)
        image[68:80, 244:247] = 230
        self.assertEqual(
            forehead_gap(layers, image), {"width_px": 3, "height_px": 12, "area_px": 36}
        )
        image[68:80, 244:247] = [174, 108, 76]
        layers[68:80, 244:247] = 0
        self.assertEqual(forehead_gap(layers, image)["height_px"], 12)

    def test_turn_review_detects_a_floating_lock_open_to_the_backdrop(self):
        from .profile import open_fringe_gap

        layers = np.zeros((250, 320), dtype=np.uint8)
        layers[14:120, 75:210] = 2
        layers[14:35, 75:235] = 3
        layers[35:78, 226:235] = 3
        image = np.full((250, 320, 3), 240, dtype=np.uint8)
        image[layers != 0] = (63, 52, 44)
        self.assertEqual(
            open_fringe_gap(layers, image),
            {"max_width_px": 16, "sustained_rows": 43, "sustained_width_px": 16},
        )
        layers[35:78, 210:226] = 2
        image[layers != 0] = (63, 52, 44)
        self.assertEqual(open_fringe_gap(layers, image)["sustained_rows"], 0)

    def test_opposing_outer_widths_ignore_paint_and_eye_depth_but_find_a_wider_forehead(
        self,
    ):
        from .profile import opposite_outline_widths

        primary = np.zeros((250, 320), dtype=np.uint8)
        primary[6:220, 35:205] = 2
        other = np.roll(primary, 18, axis=1)
        other[40:160, 55:145] = 3
        same = opposite_outline_widths(primary, other)
        self.assertEqual(same["p90_width_difference_px"], 0)
        other[50:78, 220:245] = 3
        changed = opposite_outline_widths(primary, other)
        self.assertEqual(changed["opposite_minus_primary_width_px"], 22)
        self.assertGreater(changed["worst_band_from_crown"][0], 0.25)
        other[:, :55] = 3
        self.assertIsNone(opposite_outline_widths(primary, other))

    def test_edge_pupils_survive_the_trace_and_reversing_them_fails_review(self):
        def portrait(side, pupils=True):
            image = Image.new("RGB", (180, 180), "#bc8166")
            ink = ImageDraw.Draw(image)
            for x in [15, 95]:
                ink.ellipse((x, 18, x + 55, 66), fill="white", outline="black", width=2)
                if pupils:
                    center = x + (5 if side == "left" else 50)
                    ink.ellipse((center - 5, 37, center + 5, 47), fill="black")
            return image

        source = portrait("left")
        anchors = np.array([[42, 42], [122, 42]])
        measured = suggest_eye_centers(np.array(source), np.ones((180, 180), bool))
        np.testing.assert_allclose(measured, anchors, atol=1)
        good = compare_gaze(source, source, anchors)
        self.assertEqual(good["status"], "matched")
        self.assertTrue(all(0.04 < e["pupil"][0] < 0.15 for e in good["source"]))
        self.assertEqual(
            compare_gaze(source, portrait("right"), anchors)["status"], "revise"
        )
        no_pupils = portrait("left", False)
        self.assertEqual(compare_gaze(source, no_pupils, anchors)["status"], "revise")
        self.assertEqual(
            compare_gaze(no_pupils, source, anchors)["status"], "unmeasured"
        )

    def test_centered_gaze_does_not_hide_a_pupil_diameter_error(self):
        anchors = np.array([[44, 52], [133, 52]])

        def drawing(radius):
            im = Image.new("RGB", (180, 110), "#c88b6d")
            pen = ImageDraw.Draw(im)
            for x, y in anchors:
                pen.ellipse(
                    (x - 30, y - 26, x + 30, y + 26),
                    fill="white",
                    outline="black",
                    width=2,
                )
                pen.ellipse(
                    (x - radius, y - radius, x + radius, y + radius), fill="black"
                )
            return im

        correct = drawing(10)
        bad = compare_gaze(correct, drawing(4), anchors)
        self.assertEqual(bad["status"], "revise")
        self.assertLess(bad["max_gaze_error"], 0.05)
        self.assertGreater(bad["max_pupil_diameter_error"], 0.15)
        self.assertEqual(compare_gaze(correct, correct, anchors)["status"], "matched")

    def test_turn_review_detects_a_collapsed_far_eye_and_an_erased_pupil(self):
        frontal = [{"center": [x, 58], "size": [49, 49]} for x in (40, 111)]
        im = Image.new("RGB", (170, 130), "#ceb59b")
        pen = ImageDraw.Draw(im)
        for left, width in ((22, 56), (104, 19)):
            pen.ellipse((left, 35, left + width, 81), fill="white", outline="black")
        pen.ellipse((39, 49, 47, 57), fill="black")
        result = turned_eyes(im, frontal)
        self.assertEqual((result["openings"], result["pupils"]), (2, 1))
        self.assertLess(result["width_ratio"], 0.4)
        left, right = result["screen_eyes"]
        self.assertIsNotNone(left["pupil"])
        self.assertIsNone(right["pupil"])

    def test_profile_measures_tip_height_at_equal_projection(self):
        from .profile import profile_nose_tip

        def nose(at):
            levels = np.zeros((250, 320), dtype=np.uint8)
            for y in range(250):
                x = round(260 + 16 * np.exp(-(((y - at) / 8) ** 2)))
                levels[y, 20 : x + 1] = 2
            return profile_nose_tip(levels)

        high, low = nose(150), nose(166)
        self.assertEqual(high[0], low[0])
        self.assertAlmostEqual(low[1] - high[1], 16 / 119, places=3)

    def test_review_finds_a_missing_forelock_inside_the_same_head_silhouette(self):
        from .profile import fringe_difference

        drawing = np.full((250, 320), 3, dtype=np.uint8)
        drawing[46:135, 110:212] = 2
        native = drawing.copy()
        native[46:135, 212:] = 2
        np.testing.assert_array_equal(drawing > 0, native > 0)
        self.assertEqual(fringe_difference(drawing, drawing)["p90_distance"], 0)
        self.assertGreater(fringe_difference(drawing, native)["p90_distance"], 0.14)
        self.assertIsNone(fringe_difference(np.zeros_like(drawing), native))

    def test_side_part_requires_a_measurable_notch_above_the_temple(self):
        from .tracing import side_part_notch

        y, x = np.mgrid[:160, :180]
        dome = 10 + 0.007 * (x - 92) ** 2
        self.assertIsNone(side_part_notch(y >= dome, 98, 112, 106))
        joined = y >= dome + 12 * np.exp(-(((x - 119) / 4) ** 2))
        px, py, depth = side_part_notch(joined, 98, 112, 106)
        self.assertAlmostEqual(px, 119, delta=2)
        self.assertGreater(depth, 5)

    def test_visible_jaw_compares_the_skin_below_the_ear(self):
        from .profile import visible_jaw

        rows = np.arange(176, 200, 3)
        drawing = np.zeros((250, 320), dtype=np.uint8)
        drawing[168:210, 80:210] = 2
        native = drawing.copy()
        native[:, :100] = 3
        self.assertEqual(visible_jaw(drawing, drawing, rows)["mean_error"], 0)
        self.assertAlmostEqual(
            visible_jaw(drawing, native, rows)["mean_error"], 20 / 119, places=3
        )

    def test_smile_review_ignores_the_hair_and_tracks_a_displaced_crease(self):
        from .profile import smile_ink, smile_difference, mouth_centerline

        def portrait(shift):
            rgb = np.full((250, 320, 3), 240, dtype=np.uint8)
            levels = np.zeros((250, 320), dtype=np.uint8)
            rgb[110:230, 100:245] = [209, 149, 106]
            levels[110:230, 100:245] = 2
            rgb[110:230, 94:100] = 35
            levels[110:230, 94:100] = 3
            for x in range(145, 196):
                y = round(183 + 5 * np.sin((x - 145) / 50 * np.pi))
                rgb[y : y + 2, x + shift] = 29
                levels[y : y + 2, x + shift] = 1
            return smile_ink(rgb, levels, 184, True)

        stroke = portrait(0)
        self.assertIsNotNone(stroke)
        self.assertEqual(smile_difference(stroke, stroke)["mean_distance"], 0)
        self.assertGreater(
            smile_difference(stroke, portrait(12))["endpoint_error"], 0.09
        )
        self.assertEqual(smile_difference(stroke, None)["mean_distance"], 1)
        self.assertIsNone(smile_difference(None, stroke))
        x = np.arange(24)
        y = np.array([9, 7, 6, 5, *range(6, 14), *([14] * 12)])
        points, tick = mouth_centerline(x, y)
        np.testing.assert_array_equal(points[0], [3, 5])
        np.testing.assert_array_equal(tick, [-3, 4])

    def test_turned_gaze_needs_two_measured_pupils_in_screen_order(self):
        from .profile import quarter_pupils

        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "portrait.png"
            image = Image.new("RGB", (200, 200), "#f5f4ee")
            pen = ImageDraw.Draw(image)
            pen.ellipse((5, 4, 190, 170), fill="#b8855c")
            for left, width in ((36, 36), (96, 64)):
                pen.ellipse((left, 40, left + width, 86), fill="white", outline="black")
            pen.ellipse((43, 56, 52, 65), fill="black")
            image.save(path)
            self.assertIsNone(quarter_pupils(path))
            pen.ellipse((137, 56, 146, 65), fill="black")
            image.save(path)
            first, second = quarter_pupils(path)
            self.assertLess(first, 0.4)
            self.assertGreater(second, 0.65)

    def test_turn_review_recognizes_a_large_round_pupil_in_a_narrow_profile(self):
        frontal = [{"center": [x, 58], "size": [50, 49]} for x in (45, 115)]
        im = Image.new("RGB", (170, 130), "#bd8560")
        pen = ImageDraw.Draw(im)
        pen.ellipse((74, 33, 104, 84), fill="white", outline="black", width=2)
        self.assertEqual(turned_eyes(im, frontal)["pupils"], 0)
        pen.ellipse((79, 48, 99, 68), fill="black")
        measured = turned_eyes(im, frontal)
        self.assertEqual((measured["openings"], measured["pupils"]), (1, 1))
        self.assertEqual(len(measured["screen_eyes"]), 1)

    def test_a_failed_eye_review_retains_the_prior_accepted_recipe(self):
        from .study import Study

        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            source = base / "input.png"
            Image.new("RGB", (40, 40), "white").save(source)
            args = SimpleNamespace(
                image=source,
                output=base / "studies",
                base="local",
                renderer="webgl",
                max_triangles=4000,
            )

            def render_fixture(recipe, directory, *_args, **_kwargs):
                for name in ("comparison.png", "portrait-review.png", "walk.webp"):
                    (directory / name).touch()
                return {"triangles": 2000}

            metrics = {
                "profile_nose_visible": True,
                "silhouette_iou": 0.97,
                "regions": {"body": 0.97},
                "foreground_rgb_mae": 3,
                "face_rgb_mae": 2,
                "face_edge_agreement": 0.9,
            }
            comparison = [
                {**metrics, "eyes": {"status": status, "max_gaze_error": err}}
                for status, err in [
                    ("revise", 0.87),
                    ("matched", 0.02),
                    ("revise", 0.84),
                ]
            ]
            with (
                patch("avatar_authoring.study.draw_guide"),
                patch(
                    "avatar_authoring.study.fit",
                    side_effect=[{"pass": 1}, {"pass": 2}, {"pass": 3}],
                ),
                patch("avatar_authoring.study.render", side_effect=render_fixture),
                patch("avatar_authoring.study.evaluate", side_effect=comparison),
            ):
                study = Study(args)
                for index in range(3):
                    study.draw({"unsupported": []}, {"transport": "observation-replay"})
                    if index == 0:
                        self.assertIsNone(study.best)
                self.assertEqual(study.summary["selected"], "pass-2")
                self.assertEqual(
                    json.loads((study.run / "recipe.json").read_text()), {"pass": 2}
                )

    def test_the_upper_lid_fold_and_brow_are_distinct_strokes(self):
        skin = np.array([191, 123, 83])
        frame = np.full((150, 160, 3), skin, dtype=float)
        for x in range(44, 106):
            u = (x - 75) / 31
            for apex in (51, 67):
                y = round(apex + 9 * u * u)
                frame[y : y + 2, x] = 19
        strokes = eye_strokes(frame, (40, 81, 110, 116), skin, 200)
        self.assertEqual(len(strokes), 2)
        self.assertAlmostEqual(strokes[0][0][3][1], 51.5, delta=1)
        self.assertAlmostEqual(strokes[1][0][3][1], 67.5, delta=1)

    def test_a_single_exposed_ear_has_a_lobe_beyond_the_cheek(self):
        face = Image.new("L", (240, 280))
        pen = ImageDraw.Draw(face)
        pen.ellipse((53, 24, 183, 242), fill=255)
        self.assertFalse(ear_lobes(np.array(face) > 0, 118, 116, 243, 130))
        pen.ellipse((164, 126, 202, 170), fill=255)
        ears = ear_lobes(np.array(face) > 0, 118, 116, 243, 130)
        self.assertEqual([e[0] for e in ears], [1])
        _, x, y, rx, ry = ears[0]
        self.assertAlmostEqual(x + rx, 202, delta=2)
        self.assertAlmostEqual(y, 148, delta=5)
        self.assertAlmostEqual(ry, 22, delta=5)
        # The edge of dark hair can contain a thin skin-colored highlight.
        pen.line((217, 131, 217, 164), fill=255, width=1)
        self.assertEqual(ear_lobes(np.array(face) > 0, 118, 116, 243, 130), ears)

    def test_similar_skin_pigment_and_a_matching_bracelet_do_not_extend_a_sleeve(self):
        skin, shirt = np.array([203, 133, 85]), np.array([234, 109, 86])
        image = np.full((100, 180, 3), 250, dtype=float)
        mask = np.zeros((100, 180), bool)
        image[37:63, 15:160] = skin
        mask[37:63, 15:160] = True
        image[37:63, 15:59] = shirt
        image[37:63, 137:144] = shirt
        cuff = sleeve_cuff(
            image, mask, {"skin": skin, "shirt": shirt}, (30, 50), (154, 50)
        )
        self.assertEqual(cuff, 58)

    def test_trace_a_closed_smile_with_approximate_corners_and_a_nearby_nose(self):
        rgb = np.full((84, 110, 3), [170, 105, 73], float)
        # A narrower, equally dark nose edge shares the search window.
        rgb[38:40, 48:62] = 20
        for x in range(28, 82):
            arch = 1 - ((x - 55) / 27) ** 2
            y = round(47 + 8 * arch)
            rgb[y - round(3 * arch) : y + round(5 * arch) + 1, x] = [137, 63, 45]
            rgb[y : y + 2, x] = [24, 14, 10]
        rows, ink, width, color = mouth_profile(rgb, (30, 45), (79, 48))
        self.assertLess(rows[0, 1] + 4, rows[len(rows) // 2, 1])
        self.assertTrue(np.all(rows[:, 2] <= rows[:, 1]))
        self.assertTrue(np.all(rows[:, 1] <= rows[:, 3]))
        self.assertGreater(rows[len(rows) // 2, 3] - rows[len(rows) // 2, 2], 4)
        np.testing.assert_array_equal(ink, [24, 14, 10])
        np.testing.assert_array_equal(color, [137, 63, 45])
        self.assertLess(width, 3)
        self.assertIsNone(mouth_profile(rgb[:34], (30, 20), (79, 21)))

    def test_floating_colour_and_a_fringe_connected_to_the_crown(self):
        scalp = np.zeros((96, 120), dtype=bool)
        scalp[:24, 22:99] = True
        for y in range(23, 60):
            left = 46 - round(5 * np.sin((y - 23) / 37 * np.pi))
            scalp[y, left : left + max(1, (63 - y) // 5)] = True
        skin = ~scalp
        lock = forehead_lock(scalp, skin, 60, 75, 90)
        self.assertIsNotNone(lock)
        self.assertLess(lock[0, 0], 24)
        self.assertLessEqual(abs(lock[-1, 1] - 46), 2)
        scalp[24:] = False
        self.assertIsNone(forehead_lock(scalp, ~scalp, 60, 75, 90))

    def test_open_fingers_preserve_the_thumb_side_and_skip_a_mitten(self):
        im = Image.new("1", (230, 170))
        pen = ImageDraw.Draw(im)
        pen.polygon(
            [(10, 72), (75, 62), (109, 62), (110, 99), (75, 101), (10, 87)], fill=1
        )
        for start, tip in [
            ((45, 70), (91, 25)),
            ((90, 65), (187, 47)),
            ((94, 74), (202, 73)),
            ((95, 83), (193, 97)),
            ((91, 94), (165, 124)),
        ]:
            pen.line([start, tip], fill=1, width=9)
        mask = np.asarray(im)
        fan = open_hand(mask, (10, 80), 202)
        self.assertIsNotNone(fan)
        self.assertLess(fan[0, 3], fan[1, 3])
        self.assertGreater(fan[2, 2], fan[4, 2])
        flipped = open_hand(mask[::-1], (10, 89), 202)
        np.testing.assert_allclose(flipped[:, 3], -fan[:, 3], atol=1)
        self.assertIsNone(open_hand(np.ones_like(mask), (10, 80), 202))

    def test_fit_a_crew_opening_and_its_separate_outer_stitch(self):
        skin, shirt = np.array([113, 66, 49]), np.array([60, 161, 170])
        rgb = np.full((120, 150, 3), shirt, float)
        for x in range(53, 98):
            half = np.sqrt(max(0, 1 - ((x - 75) / 22) ** 2))
            inside = round(43 + 16 * half)
            rgb[27:inside, x] = skin
            rgb[inside : inside + 1, x] = 20
            rgb[inside + 6 : inside + 8, x] = 20
        # A skin-coloured chest print begins below the actual collar.
        rgb[70:75, 70:80] = skin
        palette = {"skin": skin, "shirt": shirt, "binding": shirt}
        mid, top, radius, drop, band, ink = crew_neckline(
            rgb, np.ones((120, 150), bool), palette, 74, 20, 55, 205, 44
        )
        for value, target in zip((mid, top, radius, drop, band), (75, 43, 22, 16, 6.5)):
            self.assertAlmostEqual(value, target, delta=2)
        np.testing.assert_array_equal(ink, [20, 20, 20])
        self.assertIsNone(
            crew_neckline(
                rgb,
                np.ones((120, 150), bool),
                {k: shirt for k in palette},
                74,
                20,
                55,
                105,
                44,
            )
        )

    def test_left_right_conventions_preserve_asymmetric_heights(self):
        source = {"landmarks": {}}
        for left, right in (
            ("leftEye", "rightEye"),
            ("leftCheek", "rightCheek"),
            ("mouthLeft", "mouthRight"),
        ):
            source["landmarks"].update(
                {left: {"x": 590, "y": 100}, right: {"x": 410, "y": 111}}
            )
        marks = image_landmarks(source)
        self.assertEqual(marks["leftEye"], {"x": 410, "y": 111})
        self.assertEqual(marks["mouthRight"], {"x": 590, "y": 100})
        self.assertEqual(source["landmarks"]["leftEye"]["x"], 590)

    def test_an_enclosed_white_eye_belongs_to_the_figure(self):
        with tempfile.TemporaryDirectory() as tmp:
            frame = np.full((64, 60, 3), 250, dtype=np.uint8)
            frame[12:56, 15:48] = [149, 70, 39]
            frame[19:26, 28:37] = 250
            frame[40:56, 29:34] = 250
            path = Path(tmp) / "source.png"
            Image.fromarray(frame).save(path)
            _, mask = pixels(path)
            self.assertTrue(mask[22, 31])
            self.assertFalse(mask[49, 31])

    def test_the_brow_tracer_skips_the_hair_boundary(self):
        image = np.full((80, 90, 3), [197, 130, 83], dtype=float)
        image[10:37, 17] = 20
        image[27:29, 27:43] = 22
        points, width = eyebrow(image, (23, 35, 46, 45), 65)
        self.assertGreaterEqual(len(points), 3)
        self.assertTrue(all(26 <= y <= 29 for _, y in points))
        self.assertAlmostEqual(width, 2)

    def test_family_and_framing_are_visible_in_the_single_input(self):
        from .one_image import recognize_input

        folder = Path(__file__).parent / "targets/holdout-v1"
        for case in json.loads((folder / "manifest.json").read_bytes())["cases"]:
            with self.subTest(case=case["id"]):
                self.assertEqual(
                    recognize_input(folder / case["input"]),
                    (case["family"], case["framing"]),
                )

    def test_bounded_correction_can_retain_a_better_first_portrait(self):
        from .one_image import best_pass

        first = {
            "accepted": False,
            "visible_portrait": {
                "head_iou": 0.91,
                "rgb_mae": 32,
                "ink_agreement": 0.7,
                "visible_fraction": 1,
            },
        }
        second = {
            "accepted": False,
            "visible_portrait": {
                "head_iou": 0.75,
                "rgb_mae": 34,
                "ink_agreement": 0.5,
                "visible_fraction": 1,
            },
        }
        self.assertIs(best_pass([first, second]), first)
        passed = {**first, "accepted": True}
        self.assertIs(best_pass([first, passed]), passed)

    def test_second_unknown_part_cannot_start_another_extension_call(self):
        from types import SimpleNamespace
        from .feature_library import resolve_feature

        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp)
            calls = [{"operation": "compose_native_part", "usage": {"cost": 0.01}}]
            with self.assertRaisesRegex(ValueError, "one family extension"):
                resolve_feature(
                    SimpleNamespace(feature_library=folder, feature_model="strong"),
                    "extra fringe",
                    {"family": "rick-classic"},
                    folder / "source.png",
                    folder,
                    calls,
                )
            self.assertEqual(len(calls), 1)

    def test_release_reuses_registration_only_for_the_measured_image_and_recipe(self):
        from .release import digest, registration_from_source

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            recipe, source = root / "candidate.json", root / "source.png"
            recipe.write_text('{"family":"rick-classic","construction":"household"}')
            source.write_bytes(b"calibration image")
            score = {"head_fraction": 0.227, "eye_frame": [-0.06, 0.1, 0.06, 0.15]}
            (root / "review.json").write_text(
                json.dumps(
                    {
                        "recipe_sha256": digest(recipe),
                        "source_sha256": digest(source),
                        "candidates": {"rick-classic": score},
                    }
                )
            )
            self.assertEqual(registration_from_source(recipe, source), score)
            source.write_bytes(b"held out image")
            with patch(
                "avatar_authoring.household_front.fit_front",
                return_value=({}, {"head_fraction": 0.34}),
            ) as measure:
                self.assertEqual(
                    registration_from_source(recipe, source), {"head_fraction": 0.34}
                )
                measure.assert_called_once()

    def test_promotion_checks_reference_motion_views_and_previous_digest(self):
        from .release import (
            CHECKS,
            GRIP_VIEWS,
            VIEWS,
            check_evidence,
            digest,
            record_decision,
            verified_captures,
        )

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source, reference, store = (
                root / "first.json",
                root / "reference.png",
                root / "store",
            )
            reference.write_bytes(b"immutable reference")
            source.write_text('{"name":"First"}')
            with self.assertRaisesRegex(ValueError, "release"):
                install(source, "artist", store)

            def approval():
                approved = {
                    "recipe": digest(source),
                    "reference": digest(reference),
                    "framing": "full",
                    "triangle_budget": 4000,
                    "backends": {},
                }
                for backend in ("WebGPUBackend", "WebGLBackend"):
                    folder = root / backend
                    folder.mkdir(exist_ok=True)
                    for name in (*VIEWS, *GRIP_VIEWS):
                        (folder / name).write_bytes(name.encode())
                    approved["backends"][backend] = {
                        "views": {
                            name: digest(folder / name) for name in (*VIEWS, *GRIP_VIEWS)
                        },
                        "reference_metrics": {
                            "head_iou": 1,
                            "silhouette_iou": 1,
                            "rgb_mae": 0,
                            "head_edge_agreement": 1,
                            "body_edge_agreement": 1,
                        },
                        "native": {
                            "backend": backend,
                            "triangles": 3250,
                            "moving_steps": 11,
                            "hand": "right",
                            "grip_test": {
                                "minimum_curl_radians": {"left": 0.4, "right": 0.4},
                                "released": True,
                            },
                            "crouch_height_ratio": 0.7,
                        },
                    }
                (root / "evidence.json").write_text(json.dumps(approved))
                decision = {
                    "evidence": digest(root / "evidence.json"),
                    "kind": "human",
                    "reviewer": "unit fixture",
                    "checks": dict.fromkeys(CHECKS, True),
                }
                record_decision(source, reference, root, decision)

            approval()
            # A supplementary turn guide binds its own bytes and the raw 90°
            # capture to the decision, including the second renderer.
            guide_report = json.loads((root / "evidence.json").read_bytes())
            guide = root / "turn-guide"
            guide.write_bytes(b"separately drawn turn")
            guide_report["turn_guide"] = {"sha256": digest(guide)}
            for backend, item in guide_report["backends"].items():
                for name in ("turns.webp", "portrait-profile.png"):
                    file = root / backend / name
                    file.write_bytes((name + backend).encode())
                    item["views"][name] = digest(file)
            (root / "evidence.json").write_text(json.dumps(guide_report))
            self.assertEqual(verified_captures(source, root), guide_report)
            gpu_profile = root / "WebGPUBackend/portrait-profile.png"
            gpu_profile.write_bytes(b"different profile")
            with self.assertRaisesRegex(ValueError, "frames changed"):
                verified_captures(source, root)
            guide.write_bytes(b"revised guide")
            with self.assertRaisesRegex(ValueError, "guide changed"):
                verified_captures(source, root)
            approval()
            report = json.loads((root / "evidence.json").read_text())
            grip = report["backends"]["WebGPUBackend"]["native"]["grip_test"]
            grip["minimum_curl_radians"]["left"] = 0
            (root / "evidence.json").write_text(json.dumps(report))
            with self.assertRaisesRegex(ValueError, "grip"):
                check_evidence(source, root)
            grip["minimum_curl_radians"]["left"] = 0.4
            grip["released"] = False
            (root / "evidence.json").write_text(json.dumps(report))
            with self.assertRaisesRegex(ValueError, "grip"):
                check_evidence(source, root)
            grip["released"] = True
            report["backends"]["WebGLBackend"]["reference_metrics"][
                "silhouette_iou"
            ] = 0.8
            (root / "evidence.json").write_text(json.dumps(report))
            self.assertEqual(verified_captures(source, root), report)
            decision = {
                "kind": "human",
                "reviewer": "unit fixture",
                "checks": dict.fromkeys(CHECKS, False),
                "evidence": digest(root / "evidence.json"),
            }
            before = (root / "visual-review.json").read_bytes()
            for field, value in (("reference", "other drawing"), ("checks", {})):
                with self.assertRaises(ValueError):
                    record_decision(source, reference, root, {**decision, field: value})
                self.assertEqual((root / "visual-review.json").read_bytes(), before)
            with self.assertRaisesRegex(ValueError, "reference comparison"):
                record_decision(source, reference, root, decision)
            self.assertFalse(
                json.loads((root / "visual-review.json").read_text())["checks"]["body"]
            )
            (root / "WebGLBackend" / "back.png").write_bytes(b"unreviewed")
            with self.assertRaisesRegex(ValueError, "frames changed"):
                verified_captures(source, root)
            approval()
            url = install(source, "artist", store, release=root)
            self.assertEqual(install(source, "artist", store), url)
            old = digest(store / "artist.json")
            source.write_text('{"name":"Second"}')
            with self.assertRaisesRegex(ValueError, "changed"):
                check_evidence(source, root)
            approval()
            with self.assertRaisesRegex(ValueError, "digest"):
                install(source, "artist", store, release=root)
            self.assertEqual(
                install(source, "artist", store, release=root, previous=old), url
            )
            (root / "WebGLBackend" / "walk.webp").write_bytes(b"different native frame")
            with self.assertRaisesRegex(ValueError, "frames changed"):
                check_evidence(source, root)

    def test_current_contract_exposes_sculpt_controls_and_replays_previous_observations(
        self,
    ):
        from jsonschema import Draft202012Validator

        from .observation import observations, observations_v1

        def sample(node):
            if "enum" in node:
                return node["enum"][0]
            match node["type"]:
                case "object":
                    return {k: sample(v) for k, v in node["properties"].items()}
                case "array":
                    return []
                case "boolean":
                    return False
                case "number":
                    return node.get("minimum", 0)
                case "string":
                    return "Character"

        legacy = sample(observations_v1)
        Draft202012Validator(observations_v1).validate(legacy)
        current = sample(observations)
        validator = Draft202012Validator(observations)
        validator.validate(current)
        self.assertEqual(current["version"], 2)
        self.assertFalse(validator.is_valid(legacy))
        current["details"]["noseProjection"] = 40
        self.assertFalse(validator.is_valid(current))

    def test_provider_receipt_has_to_match_the_requested_model(self):
        args = SimpleNamespace(adapter="/fixture", model="test-model")
        reply = SimpleNamespace(
            stdout=json.dumps({"model": "wrong-model", "arguments": {}})
        )
        with (
            patch("subprocess.run", return_value=reply),
            self.assertRaisesRegex(ValueError, "different model"),
        ):
            ask(args, [], "")
