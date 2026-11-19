"""Trace the visible front edges of an open, long-sleeved coat in a T-pose."""

import numpy as np


def measure_coat(rgb, figure, cx, shoulder, wrist, hem, ankle, paints, sy, scale):
    sx, shoulder_y = shoulder
    radius = sx - cx
    reach = wrist[0] - sx
    arm_patches = []
    for side in (-1, 1):
        a, b = sorted(round(cx + side * (radius + reach * t)) for t in (0.24, 0.55))
        y = round(radius * 0.35)
        patch = np.s_[max(0, shoulder_y-y):shoulder_y+y+1, max(0, a):min(b+1, figure.shape[1])]
        if figure[patch].sum() < 4:
            raise ValueError("The extended sleeves of the coat could not be sampled")
        arm_patches.append(np.median(rgb[patch][figure[patch]], axis=0))
    sleeve = np.mean(arm_patches, axis=0)
    if (np.linalg.norm(arm_patches[0] - arm_patches[1]) > 34
            or min(np.linalg.norm(sleeve - paints[part]) for part in ("shirt", "skin")) < 40):
        raise ValueError("The two coat sleeves must be distinguishable from the shirt and skin")
    cloth = figure & (np.linalg.norm(rgb-sleeve, axis=2) < 42)
    x = np.arange(figure.shape[1]) - cx
    scans = []
    for y in range(shoulder_y, ankle):
        edges = []
        for side in (-1, 1):
            distances = np.sort(side*x[cloth[y] & (side*x > radius*0.14) & (side*x < radius*3.4)])
            runs = np.split(distances, np.flatnonzero(np.diff(distances) > 1) + 1)
            bands = [r for r in runs if len(r) >= max(2, radius*0.07)]
            if not bands:
                break
            panel = bands[-1]  # The center below the crotch shows the rear lining.
            edges.extend([panel[0], panel[-1]])
        if len(edges) == 4:
            scans.append([y, *edges])
        elif y > hem and scans and y - scans[-1][0] > radius*0.10:
            break
    below = [r for r in scans if r[0] > hem + radius * 0.5]
    if not below or len(scans) < radius:
        raise ValueError("The open coat needs two visible panels continuing below the shirt")
    end = below[-1][0]
    # The horizontal arm masks the shoulder. Stop the coat at that shoulder
    # until its outside edge can be distinguished from the sleeve.
    stations = np.unique(np.r_[
        np.linspace(shoulder_y, hem, 11), np.linspace(hem, end, 9)[1:],
    ].round().astype(int))
    rows = []
    chest_pixels = []
    for target in stations:
        y, il, ol, ir, outer = min(scans, key=lambda row: abs(row[0]-target))
        if rows and sy(y) <= rows[-1][0]:
            continue
        if y-shoulder_y < radius*0.55:
            ol, outer = min(ol, radius*1.06), min(outer, radius*1.06)
        if il >= ol or ir >= outer:
            continue
        if shoulder_y+radius*0.55 < y < hem:
            chest_pixels.extend(rgb[y, [round(cx-(ol+il)/2), round(cx+(outer+ir)/2)]])
        rows.append([sy(y), -ol*scale, -il*scale, ir*scale, outer*scale])
    if len(rows) < 5 or not chest_pixels:
        raise ValueError("Insufficient visible edges for an open coat")
    def pigment(v):
        return "#" + "".join(f"{round(c):02x}" for c in v)
    # Keep a station only when any of the four painted edges bends away from
    # a straight drape. Pin the waist where the depth starts turning rearward.
    data = np.asarray(rows)
    def bends(start, stop):
        if stop <= start + 1:
            return []
        middle = data[start+1:stop]
        u = (middle[:, 0] - data[start, 0]) / (data[stop, 0] - data[start, 0])
        predicted = data[start, 1:] + u[:, None] * (data[stop, 1:] - data[start, 1:])
        delta = np.abs(predicted - middle[:, 1:]).max(axis=1)
        split = start + 1 + int(delta.argmax())
        if delta.max() <= max(0.65, radius * scale * 0.027):
            return []
        return [*bends(start, split), split, *bends(split, stop)]
    waist = int(np.argmin(abs(data[:, 0] - sy(hem))))
    last = len(data) - 1
    indices = sorted({0, *bends(0, waist), waist, *bends(waist, last), last})
    return {
        "rows": np.round(data[indices], 2).tolist(),
        "color": pigment(np.median(chest_pixels, axis=0)),
        "sleeves": pigment(sleeve),
    }, sleeve, cloth


def coat_agreement(images, masks, palette, shoulder, waist, ankle, native_panels=None):
    """Compare the sleeves, open shirt and long panels after standing-height registration."""
    from PIL import ImageColor

    paints = np.array([ImageColor.getrgb(color) for color in palette], dtype=float)
    cloths, shirts = [], []
    for image, figure in zip(images, masks):
        rgb = np.asarray(image, dtype=float)
        # Remove the baked light level from each swatch comparison. A dark
        # shoe must not match a white lining simply by reducing its intensity.
        best = np.full(figure.shape, np.inf)
        nearest = np.zeros(figure.shape, dtype=int)
        for i, paint in enumerate(paints):
            tone = np.clip((rgb * paint).sum(axis=2) / max(1, paint @ paint), 0.66, 1.17)
            cost = ((rgb - tone[:, :, None]*paint)**2).sum(axis=2)
            nearest[cost < best] = i
            best = np.minimum(best, cost)
        cloths.append(figure & (nearest < 2))
        shirts.append(figure & (nearest == 2))
    def overlap(pair, lo, hi):
        a, b = [v[max(0,lo):min(len(v),hi)] for v in pair]
        return round(float((a&b).sum() / max(1,(a|b).sum())), 4)
    shoulder_pad = max(2, round((waist-shoulder)*0.13))
    return {
        "sleeves": overlap(cloths, shoulder-shoulder_pad, shoulder+shoulder_pad),
        "panels": overlap([cloths[0], cloths[1] if native_panels is None else native_panels], shoulder+shoulder_pad, ankle),
        "visible_shirt": overlap(shirts, shoulder, waist),
    }
