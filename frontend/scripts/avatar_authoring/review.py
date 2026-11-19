"""Render through Oncyber's native avatar loader and compare on a shared orthographic plane."""

import itertools
import json
import os
import shutil
from pathlib import Path
from runpy import run_path

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from playwright.sync_api import sync_playwright
from scipy import ndimage

from .eyes import compare_gaze, turned_eyes
from .fit import bounds, pixels
from .guide import head_region, suggested_landmarks
from .observation import image_landmarks
from .outerwear import coat_agreement


def iou(x, y):
    return round(float((x & y).sum() / max(1, (x | y).sum())), 4)


def native_page(pw, base, backend):
    flags = ["--enable-unsafe-swiftshader"]
    env = dict(os.environ)
    if backend == "auto" and Path("/usr/lib/chromium/vk_swiftshader_icd.json").exists():
        env.setdefault("VK_ICD_FILENAMES", "/usr/lib/chromium/vk_swiftshader_icd.json")
        flags += [
            "--enable-unsafe-webgpu",
            "--use-webgpu-adapter=swiftshader",
            "--enable-features=Vulkan",
            "--use-angle=swiftshader",
        ]
    browser = pw.chromium.launch(
        executable_path=shutil.which("chromium"), env=env, args=flags
    )
    page = browser.new_page(
        viewport={"width": 1200, "height": 900},
        user_agent="Oncyber local avatar review",
    )
    page.goto(
        base.rstrip("/") + "/dev/cartoon-author?renderer=" + backend,
        wait_until="domcontentloaded",
        timeout=120000,
    )
    page.locator('input[type="file"]:enabled').wait_for()
    return browser, page


def render(recipe, dest, base, motion=False, backend="webgl", *, gaze_only=False):
    dest.mkdir(parents=True, exist_ok=True)
    set_angle = run_path(
        str(Path(__file__).resolve().parents[1] / "capture-procedural-avatars.py")
    )["set_angle"]
    with sync_playwright() as pw:
        browser, page = native_page(pw, base, backend)
        page.get_by_label("Open cartoon recipe").set_input_files(recipe)
        page.wait_for_function(
            """()=>document.querySelector('.stage canvas')?.dataset.framing==='authored/0/body'||document.querySelector('header p[role=alert]')""",
            timeout=120000,
        )
        if page.locator("header p[role=alert]").count():
            raise ValueError(page.locator("header p[role=alert]").inner_text())
        stage = page.locator(".stage canvas")
        result = {
            "triangles": int(
                page.locator("small")
                .inner_text()
                .split(" triangles")[0]
                .replace(",", "")
            ),
            "backend": stage.get_attribute("data-backend"),
        }
        sections = (
            json.loads(Path(recipe).read_text())
            .get("design", {})
            .get("fit", {})
            .get("sections", {})
        )
        cameras = {}
        for angle, title in (
            []
            if gaze_only
            else [
                (0, "front"),
                (35, "quarter"),
                (90, "profile"),
                (180, "back"),
            ]
        ):
            set_angle(page.get_by_label("Rotation", exact=False), angle)
            page.wait_for_function(
                "a=>document.querySelector('.stage canvas').dataset.framing==='authored/'+a+'/body'",
                arg=angle,
            )
            stage.screenshot(path=dest / (title + ".png"))
            if title == "front":
                cameras["body"] = json.loads(stage.get_attribute("data-review-camera"))
            page.get_by_role("button", name="Compare silhouettes").click()
            page.wait_for_function(
                "()=>document.querySelector('.stage canvas').dataset.silhouette==='true'"
            )
            mask_name = "mask.png" if title == "front" else f"{title}-mask.png"
            stage.screenshot(path=dest / mask_name)
            page.get_by_role("button", name="Show paint").click()
            page.wait_for_function(
                "()=>document.querySelector('.stage canvas').dataset.silhouette==='false'"
            )
            if sections.get("coat"):
                isolate = page.get_by_role(
                    "button", name="Isolate coat panels", exact=True
                )
                isolate.click()
                page.wait_for_function(
                    "()=>document.querySelector('.stage canvas').dataset.coatMask==='true'"
                )
                stage.screenshot(path=dest / f"{title}-coat.png")
                isolate.click()
                page.wait_for_function(
                    "()=>document.querySelector('.stage canvas').dataset.coatMask==='false'"
                )
        page.get_by_role("button", name="Portrait", exact=True).click()
        for angle, title in (
            [(35, "portrait-quarter")]
            if gaze_only
            else [
                (0, "portrait"),
                (35, "portrait-quarter"),
                (90, "portrait-profile"),
                (145, "portrait-rear-quarter"),
                (180, "portrait-back"),
                (-145, "portrait-other-rear"),
                (-90, "portrait-other-profile"),
                (-35, "portrait-other-quarter"),
            ]
        ):
            set_angle(page.get_by_label("Rotation", exact=False), angle)
            page.wait_for_function(
                "a=>document.querySelector('.stage canvas').dataset.framing==='authored/'+a+'/portrait'",
                arg=angle,
            )
            box = stage.bounding_box()
            if title == "portrait":
                cameras["portrait"] = json.loads(
                    stage.get_attribute("data-review-camera")
                )
            side = min(box["width"], box["height"])
            clip = {
                "x": box["x"] + (box["width"] - side) / 2,
                "y": box["y"],
                "width": side,
                "height": side,
            }
            page.screenshot(clip=clip, path=dest / (title + ".png"))
            gaze = page.get_by_role("slider", name="Gaze pose", exact=True)
            if title == "portrait-quarter" and gaze.count():
                for weight in (1, 0):
                    set_angle(gaze, weight)
                    page.wait_for_function(
                        "w=>document.querySelector('.stage canvas').dataset.gaze===String(w)",
                        arg=weight,
                    )
                    if weight:
                        page.screenshot(
                            clip=clip, path=dest / "portrait-quarter-gaze.png"
                        )
        if gaze_only:
            browser.close()
            return result
        turns = Image.new("RGB", (1040, 560), "#f7f4ef")
        labels = ImageDraw.Draw(turns)
        for i, (view, label) in enumerate(
            [
                ("portrait", "Front"),
                ("portrait-quarter", "35°"),
                ("portrait-profile", "90°"),
                ("portrait-rear-quarter", "145°"),
                ("portrait-back", "Back"),
                ("portrait-other-rear", "−145°"),
                ("portrait-other-profile", "−90°"),
                ("portrait-other-quarter", "−35°"),
            ]
        ):
            x, y = (i % 4) * 260, (i // 4) * 280
            with Image.open(dest / (view + ".png")) as im:
                turns.paste(
                    im.resize((260, 260), Image.Resampling.LANCZOS), (x, y + 20)
                )
            labels.text(
                (x + 6, y + 3),
                label,
                fill="#25211e",
                font=ImageFont.truetype("DejaVuSans.ttf", 14),
            )
        turns.save(dest / "turnaround.png")
        (dest / "camera.json").write_text(json.dumps(cameras))
        page.get_by_role("button", name="Full body", exact=True).click()
        if motion:
            set_angle(page.get_by_label("Rotation", exact=False), 22)
            page.get_by_label("Motion", exact=True).select_option("WALK")
            page.wait_for_function(
                "()=>document.querySelector('.stage canvas').dataset.pose==='WALK'"
            )
            page.get_by_role("button", name="Hold microphone").click()
            page.wait_for_function(
                "()=>document.querySelector('.stage canvas').dataset.grip==='right'"
            )
            page.get_by_role("button", name="Pause", exact=True).click()
            from io import BytesIO

            def gait_frames():
                frames = []
                step = int(stage.get_attribute("data-motion-step"))
                for _ in range(12):
                    page.get_by_role("button", name="Advance 90 ms").click()
                    step += 1
                    page.wait_for_function(
                        "n=>document.querySelector('.stage canvas').dataset.motionStep===String(n)",
                        arg=step,
                    )
                    im = Image.open(BytesIO(stage.screenshot())).convert("RGB")
                    im.thumbnail((720, 480))
                    frames.append(im)
                return frames

            frames = gait_frames()
            differences = [
                (
                    np.abs(np.array(a, dtype="int16") - np.array(b, dtype="int16")).max(
                        axis=2
                    )
                    > 15
                ).sum()
                for a, b in itertools.pairwise(frames)
            ]
            if sum(v > 90 for v in differences) < 9:
                raise ValueError("Native walk did not advance consistently")
            frames[0].save(
                dest / "walk.webp",
                save_all=True,
                append_images=frames[1:],
                loop=0,
                duration=90,
            )
            result["moving_steps"] = int(sum(v > 90 for v in differences))
            if sections.get("coat"):
                set_angle(page.get_by_label("Rotation", exact=False), 180)
                page.wait_for_function(
                    "()=>document.querySelector('.stage canvas').dataset.framing==='authored/180/body'"
                )
                rear_frames = gait_frames()
                rear_frames[0].save(
                    dest / "walk-back.webp",
                    save_all=True,
                    append_images=rear_frames[1:],
                    loop=0,
                    duration=90,
                )
            result["hand"] = "right"
            set_angle(page.get_by_label("Rotation", exact=False), 35)
            page.get_by_label("Motion", exact=True).select_option("Crouch")
            page.wait_for_function(
                "document.querySelector('.stage canvas').dataset.pose==='Crouch' && document.querySelector('.stage canvas').dataset.grip==='right'"
            )
            stage.screenshot(path=dest / "crouch.png")
            _, standing_mask = pixels(dest / "front.png", keep_components=True)
            _, crouch_mask = pixels(dest / "crouch.png", keep_components=True)
            height = lambda mask: int(np.ptp(np.where(mask)[0])) + 1
            result["crouch_height_ratio"] = round(
                height(crouch_mask) / height(standing_mask), 4
            )

        return result


def source_portrait(data, mask, observations, box, canvas_width, width, height):
    left, top, right, bottom = box
    landmarks = image_landmarks(observations)

    def coordinate(name):
        x = landmarks[name]["x"] * (mask.shape[1] - 1) / 1000
        y = landmarks[name]["y"] * (mask.shape[0] - 1) / 1000
        return int(
            (canvas_width - width) // 2 + (x - left) * width / (right - left)
        ), int((y - top) * height / (bottom - top))

    face_left, _ = coordinate("leftCheek")
    face_right, _ = coordinate("rightCheek")
    _, eye = coordinate("leftEye")
    _, chin = coordinate("chin")
    face_top = max(0, int(eye - 0.46 * (chin - eye)))
    face_slice = np.s_[
        face_top:chin, max(0, face_left) : min(canvas_width, face_right + 1)
    ]
    ref_head = Image.fromarray(data.astype("uint8"))
    cx = (
        (landmarks["leftCheek"]["x"] + landmarks["rightCheek"]["x"])
        * 0.0005
        * (mask.shape[1] - 1)
    )
    head_height = (
        (landmarks["chin"]["y"] - landmarks["crown"]["y"]) * (mask.shape[0] - 1) / 1000
    )
    cy = landmarks["chin"]["y"] * (mask.shape[0] - 1) / 1000 - head_height * 0.48
    half = head_height * 0.74
    cy = max(half, min(mask.shape[0] - half, cy))
    cx = max(half, min(mask.shape[1] - half, cx))
    head_box = (cx - half, cy - half, cx + half, cy + half)
    head_crop = ref_head.crop(head_box)
    nose_fraction = (coordinate("noseTip")[1]) / height

    def paint(name):
        swatch = observations["samples"][name]
        return data[
            round(swatch["y"] * (mask.shape[0] - 1) / 1000),
            round(swatch["x"] * (mask.shape[1] - 1) / 1000),
        ]

    skin_sample, hair_sample = paint("skin"), paint("hair")
    return face_slice, head_crop, head_box, nose_fraction, skin_sample, hair_sample


def detached_parts(mask):
    """Count sizable foreground islands disconnected from the posed body."""
    labels, count = ndimage.label(mask, np.ones((3, 3)))
    if not count:
        return 0
    sizes = np.bincount(labels.ravel())[1:]
    return max(0, int(np.count_nonzero(sizes >= max(10, mask.sum() * 0.0003)) - 1))


def painted_face_iou(source, native, skin, hair, chin, backdrops=None):
    """Compare visible skin independently of the surrounding hair and neck."""
    separation = np.linalg.norm(skin - hair)
    if separation < 60:
        return None
    masks = []
    for i, im in enumerate((source, native)):
        colors = np.asarray(im.convert("RGB"), dtype=float)[:chin]
        backdrop = backdrops[i] if backdrops is not None else colors[0, 0]
        near = np.max(abs(colors - backdrop), axis=2) < 16
        rim = np.zeros_like(near)
        rim[[0, -1]] = near[[0, -1]]
        rim[:, [0, -1]] = near[:, [0, -1]]
        outside = ndimage.binary_propagation(rim, mask=near)
        ds = np.linalg.norm(colors - skin, axis=2)
        dh = np.linalg.norm(colors - hair, axis=2)
        masks.append(~outside & (ds < max(48, separation * 0.48)) & (ds < dh * 0.70))
    a, b = masks
    if a.sum() < 60:
        return None
    return round(float((a & b).sum() / (a | b).sum()), 4)


def hair_coverage(images, masks, skin, hair, end_row):
    """Compare the painted scalp on the aligned frontal plane."""
    separation = np.linalg.norm(hair - skin)
    if separation < 65:
        return None
    painted = []
    for im, mask in zip(images, masks):
        rgb = np.asarray(im, dtype=float)[:end_row]
        hair_error = np.linalg.norm(rgb - hair, axis=2)
        skin_error = np.linalg.norm(rgb - skin, axis=2)
        painted.append(
            mask[:end_row]
            & (hair_error < 0.73 * skin_error)
            & (hair_error < max(57, 0.56 * separation))
        )
    source, native = painted
    if source.sum() < 40:
        return None
    recall = (
        source & ndimage.binary_dilation(native, iterations=2)
    ).sum() / source.sum()
    return round(float(recall), 4)


def evaluate(source, render_path, dest, observations, design=None):
    ims = []
    masks = []
    for path in [source, render_path]:
        if path == render_path:
            data = np.asarray(Image.open(path).convert("RGB"))
            mask = np.asarray(Image.open(dest / "mask.png").convert("L")) > 127
        else:
            data, mask = pixels(path)
            source_backdrop = data[0, 0]
        left, top, right, bottom = bounds(mask)
        # Uniform scale to the same standing height; keep width and limb lengths measurable.
        height = 500
        width = round((right - left) * height / (bottom - top))
        canvasW = 800
        if width > canvasW:
            raise ValueError("Figure too wide for T-pose comparison")
        local = (
            Image.fromarray(data.astype("uint8"))
            .crop((left, top, right, bottom))
            .resize((width, height), Image.Resampling.LANCZOS)
        )
        alpha = (
            Image.fromarray(mask)
            .crop((left, top, right, bottom))
            .resize((width, height), Image.Resampling.NEAREST)
        )
        if path == source:
            source_h, source_w = mask.shape
            source_eyes = suggested_landmarks(data, mask, head_region(mask))
            source_bounds = (left, top, right, bottom)
            face_slice, head_crop, head_box, nose_fraction, skin_sample, hair_sample = (
                source_portrait(
                    data,
                    mask,
                    observations,
                    (left, top, right, bottom),
                    canvasW,
                    width,
                    height,
                )
            )
        canvas = Image.new("RGB", (canvasW, height), "#f7f4ef")
        canvas.paste(local, ((canvasW - width) // 2, 0), alpha)
        m = Image.new("1", (canvasW, height))
        m.paste(alpha, ((canvasW - width) // 2, 0))
        ims.append(canvas)
        masks.append(np.array(m))
    a, b = masks

    err = np.abs(np.array(ims[0], float) - np.array(ims[1], float))
    common = a & b
    face_common = common[face_slice]
    if not face_common.any():
        raise ValueError("Eyes and chin do not enclose a visible face")
    edges = []
    for image in ims:
        gray = np.array(image.convert("L"), dtype=float)[face_slice]
        gray = ndimage.gaussian_filter(gray, 0.65)
        gradient = np.hypot(ndimage.sobel(gray, axis=0), ndimage.sobel(gray, axis=1))
        edges.append(
            (gradient > 120) & ndimage.binary_erosion(face_common, iterations=2)
        )

    def nearby(reference, candidate):
        if not reference.any() or not candidate.any():
            return 0.0
        return float(
            np.mean(ndimage.distance_transform_edt(~candidate)[reference] <= 1.5)
        )

    edge_match = (nearby(*edges) + nearby(*reversed(edges))) / 2
    profile = np.array(Image.open(dest / "profile.png").convert("RGB"), dtype=float)
    profile_mask = dest / "profile-mask.png"
    silhouette = (
        np.asarray(Image.open(profile_mask).convert("L")) > 127
        if profile_mask.exists()
        else np.abs(profile - profile[0, 0]).max(axis=2) > 20
    )
    _, y0, _, y1 = bounds(silhouette)
    nose_y = int(y0 + nose_fraction * (y1 - y0))
    tip = []
    for y in range(max(0, nose_y - 3), min(len(profile), nose_y + 4)):
        xx = np.flatnonzero(silhouette[y])
        if len(xx) > 5:
            tip.extend(profile[y, xx[-5:-1]])

    # The portrait turns to screen-right at +90 degrees. Compare the pigment
    # on the foremost contour at the nose with the source skin and hair.
    def chroma(c):
        return c / np.maximum(np.linalg.norm(c, axis=-1, keepdims=True), 1)

    separation = np.linalg.norm(chroma(skin_sample) - chroma(hair_sample))
    exposed = None
    if tip and separation > 0.13:
        reference = chroma(np.array(tip))
        exposed = bool(
            np.mean(
                np.linalg.norm(reference - chroma(skin_sample), axis=1)
                < np.linalg.norm(reference - chroma(hair_sample), axis=1)
            )
            >= 0.5
        )
    chin_y = image_landmarks(observations)["chin"]["y"] * (source_h - 1) / 1000
    head_end = int(
        np.clip(
            (chin_y - source_bounds[1])
            * height
            / (source_bounds[3] - source_bounds[1]),
            1,
            height,
        )
    )
    stats = {
        "detached_parts": detached_parts(mask),
        "hair_coverage": hair_coverage(ims, masks, skin_sample, hair_sample, head_end),
        "profile_nose_visible": exposed,
        "face_rgb_mae": round(float(err[face_slice][face_common].mean()), 2),
        "face_edge_agreement": round(edge_match, 4),
        "silhouette_iou": iou(a, b),
        "foreground_rgb_mae": round(float(err[common].mean()), 2),
        "regions": {
            name: iou(a[start:end], b[start:end])
            for name, start, end in [
                ("upper_quarter", 0, 125),
                ("arms_and_chest", 125, 225),
                ("waist_and_legs", 225, 500),
            ]
        },
    }
    coat = (design or {}).get("fit", {}).get("sections", {}).get("coat")
    if coat:
        outfit = design["outfit"]
        palette = [
            coat["color"],
            coat["sleeves"],
            outfit["color"],
            design["skin"],
            outfit["trousers"],
            outfit["shoes"],
            design["hair"]["color"],
        ]

        def row(mark):
            y = observations["landmarks"][mark]["y"] * (source_h - 1) / 1000
            return round(
                (y - source_bounds[1]) * height / (source_bounds[3] - source_bounds[1])
            )

        panel_image = Image.open(dest / "front-coat.png").convert("L")
        panel_image = panel_image.crop((left, top, right, bottom)).resize(
            (width, height), Image.Resampling.NEAREST
        )
        panel_matte = Image.new("L", (canvasW, height))
        panel_matte.paste(panel_image, ((canvasW - width) // 2, 0))
        stats["coat"] = coat_agreement(
            ims,
            masks,
            palette,
            row("shoulder"),
            row("hem"),
            row("ankle"),
            native_panels=np.asarray(panel_matte) > 127,
        )
        if min(stats["coat"].values()) < 0.58:
            stats["coat_feedback"] = (
                "Check the sleeve cuff, the opening over the shirt and the two panels below the waist against the front drawing."
            )
    overlay = np.full((*a.shape, 3), [247, 244, 239], dtype="uint8")
    overlay[a & ~b] = [230, 117, 74]
    overlay[b & ~a] = [46, 133, 161]
    overlay[common] = [74, 65, 68]
    frames = ims + [Image.fromarray(overlay)]
    card = Image.new("RGB", (3 * 410, 302), "#f7f4ef")
    draw = ImageDraw.Draw(card)
    for i, (im, title) in enumerate(
        zip(
            frames,
            ["Input T-pose", "Procedural T-pose", "Overlap · source orange, mesh blue"],
        )
    ):
        im.thumbnail((405, 255), Image.Resampling.LANCZOS)
        card.paste(im, (i * 410 + (410 - im.width) // 2, 30))
        draw.text(
            (i * 410 + 7, 8),
            title,
            fill="#25211e",
            font=ImageFont.truetype("DejaVuSans.ttf", 14),
        )
    card.save(dest / "comparison.png")
    portraits = Image.new("RGB", (4 * 260, 288), "#f7f4ef")
    draw = ImageDraw.Draw(portraits)
    images = [head_crop] + [
        Image.open(dest / (name + ".png"))
        for name in ("portrait", "portrait-quarter", "portrait-profile")
    ]
    # Put the same square of the source's full-body plane under every portrait.
    # A fixed world-space close-up otherwise makes short heads look too small.
    camera_path = dest / "camera.json"
    if camera_path.exists():
        cameras = json.loads(camera_path.read_text())
        body_camera, portrait_camera = cameras["body"], cameras["portrait"]
        body_pixel = body_camera["height"] / body_camera["pixels"]
        portrait_pixel = portrait_camera["height"] / portrait_camera["pixels"]
        sl, st, sr, sb = source_bounds
        scale = (bottom - top) / (sb - st)

        def project(px, py):
            bx = (left + right) / 2 + (px - (sl + sr) / 2) * scale
            by = top + (py - st) * scale
            wx = (bx - mask.shape[1] / 2) * body_pixel
            wy = body_camera["center"] + (mask.shape[0] / 2 - by) * body_pixel
            return (
                images[1].width / 2 + wx / portrait_pixel,
                portrait_camera["pixels"] / 2
                + (portrait_camera["center"] - wy) / portrait_pixel,
            )

        x0, y0 = project(*head_box[:2])
        x1, y1 = project(*head_box[2:])

        def crop_turn(image):
            original = image.convert("RGB")
            # EXTENT also fills any area outside the captured canvas.
            return original.transform(
                (400, 400),
                Image.Transform.EXTENT,
                (x0, y0, x1, y1),
                Image.Resampling.BICUBIC,
                fillcolor=original.getpixel((0, 0)),
            )

        studio = images[1].convert("RGB").getpixel((0, 0))
        images[1:] = [crop_turn(im) for im in images[1:]]
        marks = image_landmarks(observations)
        points = (
            np.array(source_eyes)
            if source_eyes
            else np.array(
                [
                    [
                        marks[k]["x"] * (source_w - 1) / 1000,
                        marks[k]["y"] * (source_h - 1) / 1000,
                    ]
                    for k in ("leftEye", "rightEye")
                ]
            )
        )
        bounds_xy = np.array(head_box)
        anchors = (points - bounds_xy[:2]) * 400 / (bounds_xy[2:] - bounds_xy[:2])
        reference = head_crop.resize((400, 400), Image.Resampling.LANCZOS)
        chin = round((chin_y - head_box[1]) * 400 / (head_box[3] - head_box[1]))
        stats["painted_face_iou"] = painted_face_iou(
            reference,
            images[1],
            skin_sample,
            hair_sample,
            int(np.clip(chin, 1, 400)),
            (source_backdrop, studio),
        )
        stats["eyes"] = compare_gaze(
            images[0].resize((400, 400), Image.Resampling.LANCZOS), images[1], anchors
        )
        frontal = stats["eyes"]["native"]
        if all(frontal):
            # Measure the ink at native resolution. Resampling the head for
            # the comparison sheet can turn a lid corner into a false pupil.
            xy = np.array([x0, y0])
            scale = np.array([x1 - x0, y1 - y0]) / 400
            frontal_px = [
                {
                    **e,
                    "center": xy + np.array(e["center"]) * scale,
                    "size": np.array(e["size"]) * scale,
                }
                for e in frontal
            ]
            eye_stats = stats["eyes"]
            turns = {}
            source_has_pupils = all(e and e["pupil"] for e in eye_stats["source"])
            typical = np.median([e["size"][0] for e in frontal_px])
            for angle, name in [
                (35, "quarter"),
                (90, "profile"),
                (-35, "other-quarter"),
                (-90, "other-profile"),
            ]:
                path = dest / f"portrait-{name}.png"
                if not path.exists():
                    continue
                with Image.open(path) as image:
                    turn = turned_eyes(image, frontal_px)
                turns[str(angle)] = turn
                if not source_has_pupils:
                    continue
                # A narrow far sliver may legitimately lose its dot behind
                # the nose. A clearly exposed eye should retain visible ink.
                for e in turn.get("screen_eyes", []):
                    if e["size"][0] < typical * 0.48 or e["pupil"] is not None:
                        continue
                    eye_stats["status"] = "revise"
                    eye_stats["feedback"].append(
                        f"At {angle}° the exposed eye at x={e['center'][0]:.0f}px has no visible pupil."
                    )
            eye_stats["turns"] = turns
        if source_eyes:
            stats["eyes"]["suggested_eye_centers"] = (
                np.rint(points * 1000 / [source_w - 1, source_h - 1])
                .astype(int)
                .tolist()
            )
    for i, (im, label) in enumerate(zip(images, ["Source", "Front", "35°", "Profile"])):
        im.thumbnail((260, 260), Image.Resampling.LANCZOS)
        portraits.paste(im, (i * 260 + (260 - im.width) // 2, 26))
        draw.text(
            (i * 260 + 8, 5),
            label,
            fill="#25211e",
            font=ImageFont.truetype("DejaVuSans.ttf", 14),
        )
    portraits.save(dest / "portrait-review.png")
    return stats
