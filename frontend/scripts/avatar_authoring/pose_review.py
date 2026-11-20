"""Independent, confidence-filtered projected anatomy measurements on frozen full draws."""

import hashlib
from functools import lru_cache
from pathlib import Path
from time import monotonic

from PIL import Image, ImageOps
import numpy as np

from .fit import pixels

JOINTS = {
    "shoulder": (11, 12),
    "elbow": (13, 14),
    "wrist": (15, 16),
    "hip": (23, 24),
    "knee": (25, 26),
    "ankle": (27, 28),
}


@lru_cache(maxsize=1)
def pose_observer(model):
    try:
        import mediapipe as mp
    except ImportError as error:
        raise ValueError(
            "Pose review requires the optional mediapipe package"
        ) from error
    from mediapipe.tasks.python import BaseOptions, vision

    task = vision.PoseLandmarker.create_from_options(
        vision.PoseLandmarkerOptions(
            base_options=BaseOptions(model_asset_path=str(model))
        )
    )
    with model.open("rb") as stream:
        digest = hashlib.file_digest(stream, "sha256").hexdigest()
    return mp, task, digest


def project_pairs(points, width, height, mask):
    """Sort by image side, including mirror/back predictions on faceless orbs."""
    y, x = np.where(mask)
    scale = np.ptp(y)
    center = (x.max() + x.min()) / 2
    pairs = {}
    for joint, ids in JOINTS.items():
        if any(min(points[i].visibility, points[i].presence) < 0.8 for i in ids):
            continue
        pair = sorted([points[i] for i in ids], key=lambda p: p.x)
        if not all(0 <= p.x <= 1 and 0 <= p.y <= 1 for p in pair):
            continue
        pairs[joint] = [
            [
                round((p.x * (width - 1) - center) / scale, 5),
                round((p.y * (height - 1) - y.min()) / scale, 5),
            ]
            for p in pair
        ]
    return pairs


def compare_pose(model, reference, native):
    start = monotonic()
    mp, engine, digest = pose_observer(Path(model).resolve())

    def landmarks(path):
        _, mask = pixels(path, keep_components=True)
        with Image.open(path) as original:
            rgba = ImageOps.exif_transpose(original).convert("RGBA")
            img = Image.new("RGBA", rgba.size, "#e8e5dc")
            img.alpha_composite(rgba)
            img.thumbnail((1024, 1024), Image.Resampling.BICUBIC)
        result = engine.detect(
            mp.Image(
                image_format=mp.ImageFormat.SRGB, data=np.asarray(img.convert("RGB"))
            )
        )
        return (
            project_pairs(result.pose_landmarks[0], mask.shape[1], mask.shape[0], mask)
            if result.pose_landmarks
            else {}
        )

    a, b = landmarks(reference), landmarks(native)
    errors = {
        name: np.linalg.norm(np.array(a[name]) - np.array(b[name]), axis=1)
        .round(5)
        .tolist()
        for name in JOINTS
        if name in a and name in b
    }
    return {
        "observer": "MediaPipe Pose Landmarker",
        "version": mp.__version__,
        "weights_sha256": digest,
        "reference_sha256": hashlib.sha256(reference.read_bytes()).hexdigest(),
        "native_sha256": hashlib.sha256(native.read_bytes()).hexdigest(),
        "source": a,
        "native": b,
        "joint_error_in_statures": errors,
        "mean_error_in_statures": round(float(np.mean(list(errors.values()))), 5)
        if errors
        else None,
        "measured_joints": 2 * len(errors),
        "seconds": round(monotonic() - start, 3),
    }
