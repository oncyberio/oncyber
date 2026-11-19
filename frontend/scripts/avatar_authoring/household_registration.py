"""Reuse a measured household cut when a new T-pose has the same proportions."""

import copy
import json
from pathlib import Path

import numpy as np
from PIL import Image

from .fit import bounds, pixels

HERE = Path(__file__).resolve().parent
VIEWS = HERE / "targets/household"
RECIPES = HERE.parents[1] / "public/lobby/procedural/recipes"


def frame(source):
    """A fixed figure-space crop keeps the two hands, crown and soles registered."""
    rgb, mask = pixels(source)
    l, t, r, b = bounds(mask)
    h = b - t - 1
    if h < 10:
        raise ValueError("No upright household silhouette")
    cx = (l + r - 1) / 2
    yy = np.rint(t + np.arange(257) * h / 256).astype(int)
    xx = np.rint(cx + (np.arange(321) - 160) * h / 256).astype(int)
    inside = (xx >= 0) & (xx < mask.shape[1])
    grid = np.ix_(yy, xx.clip(0, mask.shape[1] - 1))
    valid = mask[grid] & inside
    return np.dstack([np.where(valid[:, :, None], rgb[grid], 0), valid * 255]).astype(
        np.uint8
    )


def dye(value):
    return np.frombuffer(bytes.fromhex(value[1:]), dtype=np.uint8).astype(float)


def swatches(d):
    o = d["outfit"]
    headband = d["household"].get("headband")
    return [
        d["skin"],
        d["hair"]["color"],
        o["color"],
        o["trousers"],
        o["shoes"],
        o["trim"],
        *[band["color"] for band in o.get("bands", [])],
        *([headband["color"]] if headband else []),
    ]


def role_masks(reference, design):
    """Localize paints to their anatomy before comparing two lit surfaces."""
    yy, xx = np.indices(reference.shape[:2])
    xx = abs(xx - 160) / 256
    yy = yy / 256
    head = (design["head"][1] + 4) / (design["height"] - 12)
    h = (yy <= head) & (xx < 0.21)
    feet = yy >= 0.966
    hip = head + (1 - head) * 0.43
    torso = (yy > head * 0.94) & (yy < hip + 0.025)
    domains = [
        h | (torso & ((xx > 0.11) | (xx < 0.04))),
        h,
        torso,
        (yy > hip - 0.035) & ~feet,
        feet,
        torso & (yy < head + 0.05),
    ]
    for band in design["outfit"].get("bands", []):
        domains.append(
            torso
            & (xx < 0.105)
            & (yy > head + (hip - head) * (band["start"] - 0.06))
            & (yy < head + (hip - head) * (band["end"] + 0.06))
        )
    if design["household"].get("headband"):
        domains.append(h & (yy < head * 0.65))
    colors = np.array([dye(c) for c in swatches(design)])
    rgb = reference[:, :, :3].astype(float)
    # Fit hue and value separately to tolerate the renderer's normal-dependent shade.
    dist = np.linalg.norm(
        (rgb[:, :, None, :] - colors)
        - (rgb[:, :, None, :] - colors).mean(3, keepdims=True) * 0.55,
        axis=3,
    )
    dist = np.where(np.stack(domains, axis=2), dist, np.inf)
    best = dist.argmin(axis=2)
    return [
        (reference[:, :, 3] > 0) & (best == i) & (dist[:, :, i] < 55)
        for i in range(len(colors))
    ]


def match(source, measured, score):
    subject = frame(source)
    yy, xx = np.indices(subject.shape[:2])
    head = (yy < score["head_fraction"] * 256 + 2) & (abs(xx - 160) < 54)
    valid = subject[:, :, 3] > 0
    options = []
    for path in sorted(VIEWS.glob("*-front.webp")):
        registered = np.asarray(Image.open(path).convert("RGBA"))
        native = registered[:, :, 3] > 0

        def overlap(region, native=native):
            return ((native & valid) & region).sum() / max(
                1, ((native | valid) & region).sum()
            )

        body_iou, head_iou = overlap(~head), overlap(head)
        if body_iou < 0.925:
            continue
        slug = path.name.removesuffix("-front.webp")
        options.append((body_iou, head_iou, slug, registered))
    if not options:
        return None
    body_iou, head_iou, slug, reference = max(options, key=lambda v: v[:2])
    base = json.loads((RECIPES / (slug + ".json")).read_text())
    design = base["design"]
    masks = role_masks(reference, design)
    native = reference[:, :, :3].astype(float)
    target = subject[:, :, :3].astype(float)
    colors = []
    fits = []
    for value, mask in zip(swatches(design), masks):
        region = mask & valid
        differences = (target - native)[region]
        delta = np.median(differences, axis=0) if len(differences) >= 5 else np.zeros(3)
        consistency = (
            (np.linalg.norm(differences - delta, axis=1) < 45).mean()
            if len(differences) >= 5
            else 0
        )
        fits.append(float(consistency))
        colors.append(
            "#"
            + np.clip(np.rint(dye(value) + delta), 0, 255)
            .astype(np.uint8)
            .tobytes()
            .hex()
        )
    # Require the neckline, sleeves, trousers and every broad stripe to agree
    # independently. Distinct dye is fine when it follows the same cloth.
    outfit = design["outfit"]
    clothing_roles = 6 + len(outfit.get("bands", []))
    if min([fits[2], fits[3], *fits[6:clothing_roles]]) < 0.8:
        return None
    outfit.update(color=colors[2], trousers=colors[3], shoes=colors[4], trim=colors[5])
    for band, color in zip(outfit.get("bands", []), colors[6:]):
        band["color"] = color
    # A similar body can wear a different face. Compare facial boundaries at
    # figure scale before deciding which construction supplies hidden depth.
    ref_white = (
        head
        & (native.min(2) > 185)
        & (np.ptp(native, axis=2) < 25)
        & (reference[:, :, 3] > 0)
    )
    target_white = head & (target.min(2) > 185) & (np.ptp(target, axis=2) < 25) & valid
    eye_overlap = (ref_white & target_white).sum() / max(
        1, (ref_white | target_white).sum()
    )
    share_head = head_iou > 0.945 and min(fits[:2]) > 0.86 and eye_overlap > 0.83
    if share_head:
        design["skin"] = colors[0]
        design["hair"]["color"] = colors[1]
        band = design["household"].get("headband")
        if band and fits[-1] >= 0.8:
            band["color"] = colors[-1]
    else:
        portrait = copy.deepcopy(measured["design"])
        portrait["head"] = [
            round(v * (design["height"] - 12) / (portrait["height"] - 12), 3)
            for v in portrait["head"]
        ]
        portrait.update(
            height=design["height"],
            build=design["build"],
            stance=design["stance"],
            outfit=outfit,
        )
        portrait["household"].pop("body", None)
        base["design"] = portrait
    base["name"] = measured["name"]
    return base, {
        "body_base": slug,
        "head_base": slug if share_head else "measured",
        "body_iou": round(float(body_iou), 4),
        "head_iou": round(float(head_iou), 4),
    }
