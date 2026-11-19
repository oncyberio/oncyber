"""Fit closed, rounded ShapeRecipe sections from registered orthographic silhouettes."""

import numpy as np


def shell(sections, sides, curvature=None):
    """Same circumference as a ShapeRecipe profile, with two fan caps."""
    y, left, right, depth, center = np.asarray(sections).T
    angle = np.arange(sides) * 2 * np.pi / sides
    widest, power = (np.asarray(curvature).T if curvature is not None
                     else (np.full_like(y, 0.5), np.full_like(y, 2.0)))
    sin, cos = np.sin(angle), np.cos(angle)
    x = ((right + left)[:, None] + (right - left)[:, None] *
         np.sign(sin) * abs(sin)**(2/power[:, None])) / 2
    tangent = center + (2*widest-1)*depth
    radius = np.where(cos >= 0, (center + depth - tangent)[:, None],
                      (tangent - center + depth)[:, None])
    z = tangent[:, None] + radius * np.sign(cos) * abs(cos)**(2/power[:, None])
    return np.stack([x, np.broadcast_to(y[:, None], x.shape), z], axis=2)



def fit_curvature(sections, measured, sides):
    """Fit the visible near and far supports of an oblique silhouette."""
    angle = np.deg2rad(35)
    # Each row keeps the four measured cardinal extents. Two inexpensive
    # parameters control the anterior and posterior oblique tangents.
    grid = np.array([(w, p) for w in np.linspace(0.10, 0.90, 33)
                     for p in np.linspace(1.25, 4.0, 34)])
    candidates = []
    for row, extrema in zip(sections, measured):
        mesh = shell(np.broadcast_to(row, (len(grid), 5)), sides, grid)
        projected = mesh[:, :, 0] * np.cos(angle) + mesh[:, :, 2] * np.sin(angle)
        error = (projected.min(1)-extrema[0])**2 + (projected.max(1)-extrema[1])**2
        size = max(1, row[2] - row[1])
        # Prefer a smooth, round section at an underdetermined pole.
        loss = error/size**2 + 0.000025*((grid[:, 0]-0.5)**2 + (grid[:, 1]/2-1)**2)
        candidates.append(grid[np.argmin(loss)])
    return np.round(candidates, 4)



def outline(mask, height, center_y, axis_center):
    """Map a silhouette to the drawing frame using its vertical span and image center."""
    ys = np.flatnonzero(mask.any(axis=1))
    if len(ys) < 3:
        raise ValueError("A silhouette needs at least three occupied rows")
    units = height / (ys[-1] - ys[0])
    x0 = (mask.shape[1] - 1) / 2
    left = mask[ys].argmax(axis=1)
    right = mask.shape[1] - 1 - mask[ys, ::-1].argmax(axis=1)
    level = (ys - (ys[0]+ys[-1])/2) * units + center_y
    return np.stack([level, (left - x0)*units + axis_center, (right - x0)*units + axis_center], axis=1)


def fit_masks(front, side, quarter, height, center, stations=16, sides=24):
    if not np.isfinite(height) or height <= 0 or not np.isfinite(center).all():
        raise ValueError("The size and center of the part must be finite and its height positive")
    cx, cy, cz = center
    front = outline(front, height, cy, cx)
    side = outline(side, height, cy, cz)
    t = (1 - np.cos(np.linspace(0, np.pi, stations))) / 2
    y = cy + (t-0.5)*height
    def edges(view):
        return tuple(np.interp(y, view[:, 0], view[:, i]) for i in (1, 2))
    left, right = edges(front)
    back, fore = edges(side)
    sections = np.stack([y, left, right, (fore-back)/2, (fore+back)/2], axis=1).round(4)
    if quarter is None:
        return sections, None
    a = np.deg2rad(35)
    turn = outline(quarter, height, cy, cx*np.cos(a) + cz*np.sin(a))
    return sections, fit_curvature(sections, np.stack(edges(turn), axis=1), sides)


def shape_recipe(sections, curvature, color, sides=24, bone="head", name="skull"):
    part = {"name": name, "bone": bone, "sides": sides, "caps": "both", "paint": "surface"}
    if curvature is None:
        part["profile"] = sections.tolist()
    else:
        part["roundedProfile"] = np.column_stack((sections, curvature)).tolist()
    return {"palette": {"surface": {"color": color, "finish": "skin"}}, "parts": [part]}


def register_cranium(recipe, head):
    """Register a fitted single skull to the front drawing. Original Z=0 is the neck plane."""
    parts = recipe.get("parts", [])
    if len(parts) != 1 or parts[0].get("bone") != "head":
        raise ValueError("The skull part must be one closed head profile")
    part = parts[0]
    if part.get("caps", "both") != "both":
        raise ValueError("The skull part must have both caps")
    if "roundedProfile" in part:
        rows = np.asarray(part["roundedProfile"], dtype=float)
    elif "profile" in part:
        profile = np.asarray(part["profile"], dtype=float)
        if profile.ndim != 2 or profile.shape[1] != 5:
            raise ValueError("Expected five values per profile section")
        rows = np.column_stack((profile, np.full(len(profile), 0.5), np.full(len(profile), 2)))
    else:
        raise ValueError("The skull part needs roundedProfile or profile sections")
    if (rows.ndim != 2 or rows.shape[1] != 7 or not 3 <= len(rows) <= 32 or
        not np.isfinite(rows).all() or np.any(np.diff(rows[:, 0]) <= 0) or
        np.any(rows[:, 2] < rows[:, 1]) or np.any(rows[:, 3] < 0) or
        np.any((rows[:, 5] < 0.02) | (rows[:, 5] > 0.98)) or
        np.any((rows[:, 6] < 1) | (rows[:, 6] > 5))):
        raise ValueError("Invalid fitted skull section")
    left, right = rows[:, 1].min(), rows[:, 2].max()
    if right <= left:
        raise ValueError("The skull part must have nonzero width")
    scale = head[0] / (right - left)
    rows[:, 0] = 12 + (rows[:, 0] - rows[0, 0]) * head[1] / np.ptp(rows[:, 0])
    rows[:, 1:3] = (rows[:, 1:3] - (left+right)/2)*scale
    rows[:, 3:5] *= scale
    return rows.round(4).tolist()
