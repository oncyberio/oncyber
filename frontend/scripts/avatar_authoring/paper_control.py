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


def clear_arm_paper(rgb, mask, tolerance):
    """Trim paper along each T-pose arm normal up to the first painted edge."""
    top = np.median(rgb[:3], axis=0)
    bottom = np.median(rgb[-3:], axis=0)
    v = np.linspace(0, 1, len(rgb))[:, None, None]
    paper = (1 - v) * top + v * bottom
    near = np.max(abs(rgb - paper), axis=2) < tolerance
    above = np.logical_and.accumulate(near, axis=0)
    below = np.logical_and.accumulate(near[::-1], axis=0)[::-1]
    return mask & ~(above | below)


def arm_paper_control(reference, native):
    """Compare exposed forearms at fixed fractions of full T-pose stature."""

    def mattes(path):
        rgb, mask = pixels(path, keep_components=True)
        yy, xx = np.nonzero(mask)
        if len(yy) == 0:
            return None
        height = np.ptp(yy)
        axis = (xx.min() + xx.max()) / 2
        # Sample both bare forearms between the outer sleeve and wrist.
        columns = np.arange(94, 126)
        xs = np.rint(axis + np.r_[-columns[::-1], columns] * height / 384).astype(int)
        ys = np.rint(yy.min() + np.arange(77, 163) * height / 384).astype(int)
        if xs.min() < 0 or xs.max() >= mask.shape[1] or ys.max() >= len(mask):
            return None
        grid = np.ix_(ys, xs)
        arm, art = mask[grid], rgb[grid]
        if (arm[:3] | arm[-3:]).any() or not arm.any(axis=0).all():
            return None
        with Image.open(path) as im:
            has_alpha = np.mean(np.asarray(im.convert("RGBA"))[:, :, 3] < 10) > 0.05
        return {
            t: arm if t == 0 or has_alpha else clear_arm_paper(art, arm, t)
            for t in (0, 12, 19, 27)
        }

    source, rendered = mattes(reference), mattes(native)
    if source is None or rendered is None:
        return None
    return {
        str(t): {
            "iou": round(float((a & b).sum() / max(1, (a | b).sum())), 4),
            "reference_median_rows": float(np.median(a.sum(axis=0))),
            "native_median_rows": float(np.median(b.sum(axis=0))),
        }
        for t, a in source.items()
        for b in [rendered[t]]
    }


def painted_figure(rgb, mask):
    """Cut an isolated painted figure from nonuniform paper using a seeded graph cut."""
    import cv2

    strip = max(2, round(mask.shape[1] * 0.015))
    margins = (rgb[:, :strip], rgb[:, -strip:])
    left, right = [
        ndimage.median_filter(np.median(margin, axis=1), size=(11, 1))
        for margin in margins
    ]
    u = np.linspace(0, 1, mask.shape[1])[None, :, None]
    paper = left[:, None] * (1 - u) + right[:, None] * u
    distance = abs(rgb - paper).max(2)
    noise = np.percentile(
        np.column_stack((distance[:, :strip], distance[:, -strip:])), 99
    )
    trimap = np.full(mask.shape, cv2.GC_BGD, dtype=np.uint8)
    outer = ndimage.binary_dilation(mask, iterations=max(2, round(len(mask) * 0.007)))
    trimap[outer] = cv2.GC_PR_BGD
    trimap[mask & (distance > max(9, noise * 1.5))] = cv2.GC_PR_FGD
    core = mask & (distance > max(42, noise * 6))
    if core.sum() < 5 or np.sum(~outer) < 5:
        raise ValueError("Paint and exposed paper must both be measurable")
    trimap[core] = cv2.GC_FGD
    cv2.setRNGSeed(0)
    cv2.grabCut(
        rgb.astype(np.uint8),
        trimap,
        None,
        np.zeros((1, 65)),
        np.zeros((1, 65)),
        4,
        cv2.GC_INIT_WITH_MASK,
    )
    cut = np.isin(trimap, (cv2.GC_FGD, cv2.GC_PR_FGD))
    # Exterior paper can run between limbs and individual hair tips. A
    # black rim around a white eye or jersey traps a pale region inside
    # the figure. Preserve that region when it belonged to the input matte.
    return cut | (ndimage.binary_fill_holes(cut) & mask)


def painted_reference(reference, destination):
    """Preserve input alpha when supplied and return the measured paper-area change."""
    with Image.open(reference) as art:
        has_alpha = np.mean(np.asarray(art.convert("RGBA"))[:, :, 3] < 10) > 0.05
    rgb, raw = pixels(reference, keep_components=True)
    painted = raw if has_alpha else painted_figure(rgb, raw)
    trim = Image.fromarray(rgb.astype(np.uint8)).convert("RGBA")
    trim.putalpha(Image.fromarray(painted.astype(np.uint8) * 255))
    trim.save(destination)
    return {
        "reference_has_alpha": bool(has_alpha),
        "removed_area_fraction": round(1 - float(painted.sum() / raw.sum()), 5),
    }
