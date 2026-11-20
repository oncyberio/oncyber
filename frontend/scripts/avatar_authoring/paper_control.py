"""Measure how the paper around a Sunshine crown affects a front comparison."""

import numpy as np
from PIL import Image
from scipy import ndimage

from .fit import pixels
from .sun_rays import measure_sun_rays
from .visor import visor_seed


def clear_crown_paper(rgb, mask, tolerance):
    """Trim only low-contrast paper connected to the exterior of the crown."""
    strip = min(8, rgb.shape[1] // 5)
    left = np.median(rgb[:, :strip], axis=1)[:, None]
    right = np.median(rgb[:, -strip:], axis=1)[:, None]
    u = np.linspace(0, 1, rgb.shape[1])[None, :, None]
    paper = left * (1 - u) + right * u
    near = np.max(np.abs(rgb - paper), axis=2) < tolerance
    seeds = np.zeros_like(near)
    seeds[0] = near[0]
    seeds[:, 0] = near[:, 0]
    seeds[:, -1] = near[:, -1]
    return mask & ~ndimage.binary_propagation(seeds, mask=near)


def crown_mattes(path, last_row=None):
    rgb, mask = pixels(path, keep_components=True)
    seed = visor_seed(rgb, mask)
    if not seed:
        return None
    center, radius = seed
    orb = measure_sun_rays(rgb, mask, center, [radius, radius], orb_only=True)
    if orb is None:
        return None
    ox, oy, rx, ry = orb
    lo, hi = round(ox - 2.6 * rx), round(ox + 2.6 * rx) + 1
    chin = round(oy + 1.01 * ry)
    if not (0 <= lo < hi <= mask.shape[1] and hi - lo >= 40 and 1 < chin < len(mask)):
        return None
    ys, xs = np.where(mask)
    scale = np.ptp(ys) / 384
    axis = (xs.min() + xs.max()) / 2
    last = (
        int(np.floor((chin - 1 - ys.min()) / scale)) if last_row is None else last_row
    )
    # Lock both frames to the original figure before changing any background pixels.
    yy = np.rint(ys.min() + np.arange(last + 1) * scale).astype(int)
    xx = np.rint(axis + np.arange(-100, 101) * scale).astype(int)
    inside = ((xx >= 0) & (xx < mask.shape[1]))[None, :] & (yy < len(mask))[:, None]
    grid = np.ix_(np.clip(yy, 0, len(mask) - 1), xx.clip(0, mask.shape[1] - 1))
    with Image.open(path) as im:
        alpha = im.convert("RGBA").getchannel("A")
        transparent = np.mean(np.asarray(alpha) < 10) > 0.05
    mattes = {0: mask[grid] & inside}
    for tolerance in (12, 19, 27):
        trimmed = mask.copy()
        if not transparent:
            trimmed[:chin, lo:hi] = clear_crown_paper(
                rgb[:chin, lo:hi], mask[:chin, lo:hi], tolerance
            )
        mattes[tolerance] = trimmed[grid] & inside
    return mattes


def crown_paper_control(reference, native):
    """Supplement the frozen score with a self-comparison under three paper tolerances."""
    source = crown_mattes(reference)
    if source is None:
        return None
    rendered = crown_mattes(native, len(source[0]) - 1)
    if rendered is None:
        return None

    def iou(a, b):
        return round(float((a & b).sum() / max(1, (a | b).sum())), 4)

    return {
        "registered_crown_iou": iou(source[0], rendered[0]),
        "tolerances": {
            str(t): {
                "source_self_iou": iou(source[0], source[t]),
                "native_self_iou": iou(rendered[0], rendered[t]),
                "painted_crown_iou": iou(source[t], rendered[t]),
            }
            for t in (12, 19, 27)
        },
    }
