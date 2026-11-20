"""Fit the two visible globes of a registered scientist to its front drawing."""

import numpy as np
from PIL import Image
from scipy import ndimage

from .fit import pixels
from .eyes import measure_eye


def eye_measures(path, frame, *, lowered=False, neutral_core=False, allow_contact=False):
    image, mask = pixels(path, keep_components=True)
    yy, xx = np.nonzero(mask)
    cx, top, span = (xx.min() + xx.max()) * 0.5, yy.min(), float(np.ptp(yy))
    x0, y0, x1, y1 = frame
    x0, x1 = (
        max(0, round(cx + (x0 - 0.025) * span)),
        min(image.shape[1], round(cx + (x1 + 0.025) * span)),
    )
    y0, y1 = (
        max(0, round(top + (y0 - 0.018) * span)),
        min(image.shape[0], round(top + (y1 + 0.024) * span)),
    )
    patch = image[y0:y1, x0:x1]
    foreground = mask[y0:y1, x0:x1]
    if not patch.size:
        return
    if lowered:
        # A half-lidded pupil in a full-body render can cover a single black
        # pixel. Include its antialiased neighbours when estimating the center.
        scale = 3
        size = (patch.shape[1] * scale, patch.shape[0] * scale)
        patch = np.asarray(
            Image.fromarray(patch.astype(np.uint8)).resize(
                size, Image.Resampling.LANCZOS
            ),
            dtype=float,
        )
        foreground = foreground.repeat(scale, axis=0).repeat(scale, axis=1)
        x0, y0 = x0 * scale, y0 * scale
        cx, top = (cx + 0.5) * scale - 0.5, (top + 0.5) * scale - 0.5
        span *= scale
    # Pale skin can join the entire edge of a lowered eyelid. Isolate its
    # brighter white before measuring aperture and checking the enclosed pupil.
    white_min, chroma = (203, 28) if neutral_core else (186, 44)
    if lowered and foreground.any():
        white_peak = np.percentile(patch.min(2)[foreground], 98)
        white_min, chroma = np.clip(white_peak - 27, 200, 230), 25
    white = (patch.min(2) > white_min) & (np.ptp(patch, axis=2) < chroma) & foreground
    labels, count = ndimage.label(white)
    result = []
    for side in (-1, 1):
        options = []
        for i in range(1, count + 1):
            ys, xs = np.where(labels == i)
            if len(xs) < 12 or (np.mean(xs) + x0 - cx) * side < 0:
                continue
            w, h = np.ptp(xs) + 1, np.ptp(ys) + 1
            # A lowered lid exposes a narrow white slit with a real pupil.
            aspect_max, height_min = (4.1, 0.006) if lowered else (1.85, 0.014)
            if not 0.45 < w / h < aspect_max or not height_min < h / span < 0.085:
                continue
            if (
                min(
                    xs.min(),
                    ys.min(),
                    patch.shape[1] - xs.max() - 1,
                    patch.shape[0] - ys.max() - 1,
                )
                <= 0
            ):
                continue
            globe = ndimage.binary_fill_holes(labels == i)
            dark = globe & (patch.mean(2) < 95)
            islands, n = ndimage.label(dark)
            if n:
                dark = islands == (np.bincount(islands.ravel())[1:].argmax() + 1)
            if 1 <= dark.sum() < 0.23 * globe.sum():
                py, px = ndimage.center_of_mass(dark)
                size = np.sqrt(dark.sum())
            elif allow_contact:
                globe, dot = measure_eye(labels == i, patch)
                if dot is None:
                    continue
                px, py, radius = dot
                size = radius * np.sqrt(np.pi)
            else:
                continue
            band = (
                ndimage.binary_dilation(globe, iterations=max(1, round(h * 0.04)))
                & ~globe
            )
            ink = band & (patch.mean(2) < 95)
            fraction = ink.sum() / max(1, band.sum())
            pigment = (
                np.median(patch[ink], axis=0) if ink.any() else np.array([45, 40, 41])
            )
            options.append(
                (
                    len(xs),
                    np.array(
                        [
                            (xs.min() + xs.max()) / 2 + x0 - cx,
                            (ys.min() + ys.max()) / 2 + y0 - top,
                            w,
                            h,
                            size,
                            px + x0 - cx,
                            py + y0 - top,
                        ]
                    )
                    / span,
                    fraction,
                    pigment,
                )
            )
        if not options:
            return
        result.append(max(options, key=lambda o: o[0]))
    return (
        np.array([a[1] for a in result]),
        min(a[2] for a in result),
        np.mean([a[3] for a in result], axis=0),
    )


def eye_edits(source, native, frame, recipe):
    target, drawn = (eye_measures(p, frame) for p in (source, native))
    if target is None or drawn is None:
        return []
    target, ink, pigment = target
    drawn, native_ink, _ = drawn
    spacing = np.ptp(target[:, 0]) / np.ptp(drawn[:, 0])
    widths, heights = target[:, 2] / drawn[:, 2], target[:, 3] / drawn[:, 3]
    # Both eyes must support a common adjustment. An asymmetric squint needs
    # its own construction; a shared scale would damage the more accurate eye.
    if np.ptp(widths) > 0.25 or np.ptp(heights) > 0.25:
        return []
    base = recipe.get("eyeShape", {"width": 1, "height": 1, "lift": 0, "pupil": 1})
    width, height = widths.mean(), heights.mean()
    shape = {
        "width": round(float(np.clip(base["width"] * width / spacing, 0.7, 1.5)), 3),
        "height": round(float(np.clip(base["height"] * height, 0.7, 1.5)), 3),
        "lift": round(
            float(
                np.clip(
                    base["lift"]
                    + 2
                    * base["height"]
                    * (target[:, 1] - drawn[:, 1]).mean()
                    / drawn[:, 3].mean(),
                    -0.55,
                    0.55,
                )
            ),
            3,
        ),
        "pupil": round(
            float(
                np.clip(
                    base["pupil"]
                    * np.mean(target[:, 4] / drawn[:, 4])
                    / np.sqrt(width * height),
                    0.65,
                    2.2,
                )
            ),
            3,
        ),
    }
    eyes = recipe["proportions"].get("eyes", 1)
    edits = []
    if not recipe.get("eyeInk") and ink >= 0.18 and ink > native_ink + 0.1:
        paint = "#" + pigment.round().astype("uint8").tobytes().hex()
        edits.append({"field": "eyeInk", "value": paint})
    if abs(spacing - 1) > 0.018:
        edits.append(
            {
                "field": "proportions.eyes",
                "value": round(float(np.clip(eyes * spacing, 0.65, 1.5)), 3),
            }
        )
    if max(abs(shape[k] - base[k]) for k in shape) > 0.035:
        edits.append({"field": "eyeShape", "value": shape})
    return edits


def eye_agreement(source, native, frame, *, lowered=False):
    ref, drawn = [
        eye_measures(path, frame, lowered=lowered) for path in (source, native)
    ]
    if not lowered and (ref is None or drawn is None):
        # A pale cheek can connect both whites across the bridge of the nose.
        # Compare both images with the same tighter neutral pigment mask.
        core, candidate = [
            eye_measures(path, frame, neutral_core=True) for path in (source, native)
        ]
        if core is not None:
            ref, drawn = core, candidate
    if ref is None or drawn is None:
        # When the dot meets the outer stroke it leaves no enclosed black
        # island. Measure its thickness and surrounding white on both images.
        # An unbroken outline alone contains no such disk.
        contact, candidate = [
            eye_measures(path, frame, lowered=lowered, allow_contact=True)
            for path in (source, native)
        ]
        if contact is not None:
            ref, drawn = contact, candidate
    if ref is None:
        return
    if drawn is None:
        return {"paired_pupils": False}
    expected, ink, _ = ref
    actual, native_ink, _ = drawn
    dims = expected[:, 2:4]
    position = np.max(abs(actual[:, :2] - expected[:, :2]) / dims)
    shape = np.max(abs(np.log(actual[:, 2:4] / dims)))
    gaze = np.max(
        abs(
            (expected[:, 5:7] - expected[:, :2]) / dims
            - (actual[:, 5:7] - actual[:, :2]) / actual[:, 2:4]
        )
    )
    size = np.max(
        abs(
            np.log(
                (actual[:, 4] / np.sqrt(actual[:, 2] * actual[:, 3]))
                / (expected[:, 4] / np.sqrt(dims[:, 0] * dims[:, 1]))
            )
        )
    )
    return {
        k: round(float(v), 4)
        for k, v in {
            "position": position,
            "aperture_log_error": shape,
            "gaze": gaze,
            "pupil_log_error": size,
            "source_ink": ink,
            "native_ink": native_ink,
        }.items()
    }
