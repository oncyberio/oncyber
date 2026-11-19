"""Fit the native benchmark families in drawing coordinates from one front T-pose."""

import json
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage, optimize
from scipy.spatial import cKDTree

from .fit import pixels
from .sun_rays import fit_crew_to_orb, jersey_neck, measure_sun_rays, orb_swatches
from .tracing import registered_print, shirt_mark, traced_print
from .visor import measure_visor, visor_seed

HERE = Path(__file__).resolve().parent
FAMILIES = json.loads(
    (HERE.parents[1] / "features/procedural-avatars/families.json").read_text()
)
FAMILY_TOOL = {
    "name": "fit_avatar_family",
    "description": (
        "Fit an isolated front T-pose to a registered native family. "
        "Returns the compact recipe and a native turnaround when measurements agree. "
        "Use draw_cartoon for a different silhouette or wardrobe."
    ),
    "inputSchema": {
        "type": "object",
        "properties": {"family": {"type": "string", "enum": ["auto", *FAMILIES]}},
        "required": ["family"],
        "additionalProperties": False,
    },
}
SIDES = 384


class NoFamilySilhouette(ValueError):
    """The image cannot supply a measurable T-pose for the native family fit."""


def eye_assembly_scale(native, observed, pivot):
    """Fit the existing lateral eye control, requiring agreement in both whites."""
    cols = np.arange(native.shape[1])
    halves = [cols < pivot, cols >= pivot]
    if any(min(native[:, h].sum(), observed[:, h].sum()) < 12 for h in halves):
        return 1.0

    def agreement(scale):
        source = np.rint(pivot + (cols - pivot) / scale).astype(int)
        inside = (source >= 0) & (source < len(cols))
        warped = native[:, source.clip(0, len(cols) - 1)] & inside
        return min(
            (warped[:, h] & observed[:, h]).sum()
            / max(1, (warped[:, h] | observed[:, h]).sum())
            for h in halves
        )

    baseline = agreement(1)
    grid = np.arange(65, 151) / 100
    best = max(grid, key=lambda scale: (agreement(scale), -abs(scale - 1)))
    matched = agreement(best)
    return float(best) if matched >= 0.65 and matched >= baseline + 0.045 else 1.0


def compile_families(parts=None):
    built = subprocess.run(
        [
            "node",
            str(HERE / "compile-families.cjs"),
            *(["--fit-parts"] if parts else []),
        ],
        input=json.dumps(parts).encode() if parts else None,
        check=True,
        capture_output=True,
    )
    return json.loads(built.stdout)


class Family:
    def __init__(self, key, data):
        self.key = key
        self.crown_center = data.get("crownCenter")
        self.points = np.asarray(data["points"]).reshape(-1, 3)
        self.faces = np.asarray(data["index"]).reshape(-1, 3)
        self.hip = data["hip"][1]
        self.jaw = data["jaw"][:2]
        self.head = np.zeros(len(self.points), dtype=bool)
        self.eye = np.zeros(len(self.head), dtype=bool)
        self.moving_eye = np.zeros(len(self.head), dtype=bool)
        self.crown = np.zeros(len(self.head), dtype=bool)
        self.roles = [""] + list(FAMILIES[key]["paints"])
        self.paint = np.zeros(len(self.head), dtype=int)
        for run in data["runs"]:
            region = slice(run["start"], run["start"] + run["count"])
            self.head[region] = run["bone"] == "head"
            self.crown[region] = run.get("crown", False)
            self.eye[region] = run["eyes"] or (
                run["bone"] == "head" and run["color"] in FAMILIES[key]["eyePaints"]
            )
            self.moving_eye[region] = run["eyes"] and run["bone"] == "head"
            for i, role in enumerate(self.roles[1:], 1):
                if run["color"] in FAMILIES[key]["paints"][role]:
                    self.paint[region] = i
                    break
        self.rgb = np.asarray(data["rgb"])
        self.height = np.ptp(self.points[:, 1])
        self.center = (self.points[:, 0].max() + self.points[:, 0].min()) / 2
        self.bottom = self.points[:, 1].max()
        self.order = np.argsort(self.points[self.faces, 2].mean(axis=1), kind="stable")

    def raster(self, xy, values, size):
        image = Image.new("I", size)
        draw = ImageDraw.Draw(image)
        for f, v in zip(
            xy[self.faces[self.order]].round().astype(int), values[self.order]
        ):
            draw.polygon(f.flatten().tolist(), fill=int(v))
        return np.asarray(image)

    def warp(self, points, head, params, crown=False, crown_profile=None):
        # These are the same head / pelvis pivots as recipeTransform. Global
        # scale and frame translation belong to the photograph alone.
        scale, dx, dy, build, legs, head_w, head_h, crown_length, jaw_width = params
        x, y = points[:, 0], points[:, 1]
        cx, cy, rx, ry = FAMILIES[self.key]["crownRoot"]
        u, v = (x - cx) / rx, (y - cy) / ry
        radius = np.maximum(1, np.hypot(u, v))
        if crown_profile is not None:
            angle = np.mod(np.arctan2(v, u) * 4 / np.pi, 8)
            local = np.interp(angle, np.arange(8), crown_profile, period=8)
            crown_length = np.clip(crown_length * local, 0.45, 1.65)
        stretch = np.where(crown, (crown_length - 1) * (1 - 1 / radius), 0)
        x = x + (x - cx) * stretch
        y = y + (y - cy) * stretch
        eye_line = FAMILIES[self.key]["eyeLine"]
        lower_face = np.clip((y - eye_line) / max(1, self.jaw[1] - eye_line), 0, 1)
        head_scale = head_w * (1 + lower_face * (jaw_width - 1))
        x = np.where(head, self.jaw[0] + (x - self.jaw[0]) * head_scale, x)
        y = np.where(head, self.jaw[1] + (y - self.jaw[1]) * head_h, y)
        y = (np.maximum(y, self.hip) - self.bottom) * legs + np.minimum(y - self.hip, 0)
        return np.column_stack(((x - self.center) * build * scale + dx, y * scale + dy))

    def fit_eyes(self, image, mask, xy, pivot, ox, oy, unit):
        if not self.moving_eye.any():
            return 1.0
        eyes = xy[self.moving_eye]
        radius = np.max(abs(eyes[:, 0] - pivot))
        if radius < 1 or np.ptp(eyes[:, 1]) < 1:
            return 1.0
        top = eyes[:, 1].min() - 2
        left = pivot - radius * 1.55
        zoom = 220 / (radius * 3.1)
        size = (221, max(3, round((eyes[:, 1].max() + 2 - top) * zoom)))
        cols = np.rint(ox + (left + np.arange(size[0]) / zoom) * unit).astype(int)
        rows = np.rint(oy + (top + np.arange(size[1]) / zoom) * unit).astype(int)
        if (
            cols.min() < 0
            or rows.min() < 0
            or cols.max() >= image.shape[1]
            or rows.max() >= image.shape[0]
        ):
            return 1.0
        region = np.ix_(rows, cols)
        patch = image[region]
        white = mask[region] & (patch.min(2) > 178) & (np.ptp(patch, axis=2) < 45)
        pale = self.moving_eye[self.faces[:, 0]] & (
            self.rgb[self.faces].min(axis=(1, 2)) > 178
        )
        projected = self.raster((xy - [left, top]) * zoom, pale, size).astype(bool)
        return eye_assembly_scale(projected, white, (pivot - left) * zoom)

    def trace_hair(
        self, image, mask, params, ox, oy, unit, xy, target, valid, face_map
    ):
        """Measure the exposed hair rim in the native scalp plane of this family."""
        projected_hair = valid & self.crown[self.faces[np.maximum(face_map, 0), 0]]
        core = ndimage.binary_erosion(projected_hair & target, iterations=2)
        yy, xx = np.where(core)
        if len(xx) < 40:
            return
        xp = np.rint(ox + xx * unit).astype(int).clip(0, image.shape[1] - 1)
        yp = np.rint(oy + yy * unit).astype(int).clip(0, image.shape[0] - 1)
        hair = np.median(image[yp, xp], axis=0)
        # Crop to the head and classify the source at its original resolution.
        top = max(0, int(oy + (min(10, xy[self.head, 1].min()) - 4) * unit))
        bottom = min(image.shape[0], int(oy + xy[self.head, 1].max() * unit))
        yy, xx = np.where(mask[top:bottom])
        yy += top
        if not len(yy):
            return
        near = np.linalg.norm(image[yy, xx] - hair, axis=1) < 60
        # A lapel or shoulder can share the hair color. Identify the connected
        # locks at the scalp before measuring any polar radius.
        pigment = np.zeros((bottom - top, image.shape[1]), dtype=bool)
        pigment[yy[near] - top, xx[near]] = True
        labels, count = ndimage.label(ndimage.binary_closing(pigment, iterations=2))
        if not count:
            return
        votes = np.bincount(
            labels[(yp - top).clip(0, bottom - top - 1), xp], minlength=count + 1
        )
        if not votes[1:].any():
            return
        near &= labels[yy - top, xx] == 1 + np.argmax(votes[1:])
        # Undo the fitted camera, then the native head and jaw transforms.
        scale, dx, dy, build, legs, w, h, _, jaw = params
        sy = (
            ((yy - oy) / unit - dy) / scale - legs * (self.hip - self.bottom) + self.hip
        )
        y = self.jaw[1] + (sy - self.jaw[1]) / h
        eye = FAMILIES[self.key]["eyeLine"]
        lower = np.clip((y - eye) / max(1, self.jaw[1] - eye), 0, 1)
        sx = ((xx - ox) / unit - dx) / (scale * build) + self.center
        x = self.jaw[0] + (sx - self.jaw[0]) / (w * (1 + lower * (jaw - 1)))
        cx, cy = self.crown_center
        rx, ry = FAMILIES[self.key]["crownRoot"][2:]
        u, v = (x - cx) / rx, (y - cy) / ry
        angles = np.mod(np.arctan2(v, u), 2 * np.pi)
        bins = np.rint(angles * 240 / (2 * np.pi)).astype(int) % 240
        radii = np.hypot(u, v)
        observed = np.zeros(240)
        allowed = near & (radii < 3.8)
        np.maximum.at(observed, bins[allowed], radii[allowed])
        # Use the scalp behind the jaw where the face hides the hair.
        angle = np.arange(240) * (2 * np.pi / 240)
        support = 0.70 + 0.25 * np.maximum(0, np.sin(angle))
        evidence = observed > support
        if evidence.sum() < 75:
            return
        outline_r = np.maximum(support, ndimage.median_filter(observed, 3, mode="wrap"))
        rim = outline_r[:, None] * np.column_stack((np.cos(angle), np.sin(angle)))
        # Retain silhouette corners. Angular registration to the family supplies
        # every rear and root depth for these sparse points.
        keep = set(range(0, 240, 30))

        def refine(a, b):
            idx = np.arange(a + 1, b)
            if not len(idx):
                return
            start, end = rim[a % 240], rim[b % 240]
            chord = end - start
            v = rim[idx % 240] - start
            t = np.clip(v @ chord / (chord @ chord), 0, 1)
            errors = np.linalg.norm(v - t[:, None] * chord, axis=1)
            pos = int(np.argmax(errors))
            if errors[pos] > 0.032:
                middle = int(idx[pos])
                keep.add(middle % 240)
                refine(a, middle)
                refine(middle, b)

        for a in range(0, 240, 30):
            refine(a, a + 30)
        if 8 <= len(keep) <= 80:
            return rim[sorted(keep)].round(3).tolist()

    def fit(self, image, mask, fit_hair=True, custom_jersey=False, fitted_orb=None):
        ys, xs = np.nonzero(mask)
        unit = (ys.max() - ys.min()) / (SIDES - 32)
        # Leave enough horizontal room for long arms and retain image aspect.
        width = int(np.ceil(np.ptp(xs) / unit)) + 33
        ox, oy = xs.min() - 16 * unit, ys.min() - 16 * unit
        cols = np.clip(
            np.round(ox + np.arange(width) * unit).astype(int), 0, mask.shape[1] - 1
        )
        rows = np.clip(
            np.round(oy + np.arange(SIDES) * unit).astype(int), 0, mask.shape[0] - 1
        )
        target = mask[np.ix_(rows, cols)].copy()
        target[
            (oy + np.arange(SIDES) * unit < 0)
            | (oy + np.arange(SIDES) * unit > mask.shape[0] - 1)
        ] = False
        target[
            :,
            (ox + np.arange(width) * unit < 0)
            | (ox + np.arange(width) * unit > mask.shape[1] - 1),
        ] = False
        photo = image[np.ix_(rows, cols)]
        size = (width, SIDES)
        initial_scale = (SIDES - 32) / self.height
        initial = np.array(
            [initial_scale, (width - 1) / 2, SIDES - 17, 1, 1, 1, 1, 1, 1]
        )
        # Extract the reference silhouette in its own frame so an unfamiliar
        # input cannot crop away a hand before the optimiser even sees it.
        own_w = int(np.ceil(np.ptp(self.points[:, 0]) * initial_scale)) + 40
        basis = initial.copy()
        basis[1] = (own_w - 1) / 2
        native = self.warp(self.points, self.head, basis, self.crown)
        face_ids = np.arange(1, len(self.faces) + 1)
        ref = self.raster(native, face_ids, (own_w, SIDES))

        def outline(binary):
            yy, xx = np.nonzero(binary & ~ndimage.binary_erosion(binary))
            stride = max(1, int(np.ceil(len(yy) / 2100)))
            return np.column_stack((xx[::stride], yy[::stride]))

        curve = outline(ref > 0)
        idx = ref[curve[:, 1], curve[:, 0]] - 1
        head = self.head[self.faces[idx, 0]]
        crown = self.crown[self.faces[idx, 0]]
        source = np.column_stack(
            (
                (curve[:, 0] - basis[1]) / initial_scale + self.center,
                (curve[:, 1] - basis[2]) / initial_scale + self.bottom,
            )
        )
        observed = outline(target)
        tree = cKDTree(observed)

        def residual(params):
            drawn = self.warp(source, head, params, crown)
            near = tree.query(drawn)[0]
            inv = cKDTree(drawn).query(observed)[0]
            # A tie between neighbouring contour pixels must have the same
            # residual from either side during numerical differentiation.
            return np.concatenate((near, inv, 6 * (params[3:] - 1)))

        lo = [
            initial_scale * 0.68,
            initial[1] - width * 0.12,
            initial[2] - 50,
            0.65,
            0.65,
            0.65,
            0.65,
            0.45,
            0.65,
        ]
        hi = [
            initial_scale * 1.45,
            initial[1] + width * 0.12,
            initial[2] + 50,
            1.5,
            1.5,
            1.5,
            1.5,
            1.65,
            1.5,
        ]

        def solve(fn, start, low, high):
            return optimize.least_squares(
                fn,
                start,
                bounds=(low, high),
                loss="soft_l1",
                f_scale=4.0,
                x_scale="jac",
                diff_step=0.0002,
                max_nfev=80,
            )

        fixed_jaw = solve(
            lambda p: residual(np.append(p, 1)), initial[:-1], lo[:-1], hi[:-1]
        )
        params = np.append(fixed_jaw.x, 1)
        fitted_jaw = solve(residual, initial, lo, hi)
        # On a round head the jaw and overall width are almost interchangeable.
        # Keep the simpler fit unless a distinct taper improves the contour.
        if (
            abs(fitted_jaw.x[-1] - 1) > 0.045
            and fitted_jaw.cost < fixed_jaw.cost * 0.98
        ):
            params = fitted_jaw.x
        offset = None
        if fitted_orb is not None:
            cx, cy, rx, ry = FAMILIES[self.key]["crownRoot"]
            # The torso fixes the drawing scale. The visor and both intact
            # arcs independently fix the height, breadth and pivot of the orb.
            scale = params[0] * unit
            params[5:7] = np.clip(
                fitted_orb[2:] / [rx * scale * params[3], ry * scale], 0.65, 1.5
            )
            params[7:] = 1
            drawn = self.warp(np.array([[cx, cy]]), True, params)[0] * unit + [ox, oy]
            projected = (
                np.array([rx * params[3] * params[5], ry * params[6]]) * params[0]
            )
            offset = np.clip((fitted_orb[:2] - drawn) / unit / projected, -0.35, 0.35)
        xy = self.warp(self.points, self.head, params, self.crown)
        if offset is not None:
            xy[self.head] += offset * projected
        valid = self.raster(xy, face_ids, size) > 0
        cranial = np.arange(SIDES)[:, None] <= xy[self.head, 1].max()

        def cranial_overlap(projection):
            return (target & projection & cranial).sum() / max(
                1, ((target | projection) & cranial).sum()
            )

        overlap_before = cranial_overlap(valid)
        profile = None
        if 0.64 <= overlap_before < 0.96:
            # Isolate the outline belonging to the crown. Fit the tips to
            # nearby observed edges while retaining roots and all other parts.
            base_curve = self.warp(source, head, params, crown)
            distances, nearest = cKDTree(base_curve).query(observed)
            observed_tips = observed[crown[nearest] & (distances < 27)]
            if crown.sum() >= 24 and len(observed_tips) >= 24:
                tips = source[crown]
                observed_tree = cKDTree(observed_tips)

                def tip_residual(sectors):
                    drawn = self.warp(tips, True, params, True, sectors)
                    return np.concatenate(
                        (
                            observed_tree.query(drawn)[0],
                            cKDTree(drawn).query(observed_tips)[0],
                            5 * (sectors - 1),
                            3 * (sectors - np.roll(sectors, 1)),
                        )
                    )

                initial_profile = np.ones(8)
                fitted = solve(tip_residual, initial_profile, 0.5, 1.5).x.round(3)
                proposal = self.warp(self.points, self.head, params, self.crown, fitted)
                projected = self.raster(proposal, face_ids, size) > 0
                if (
                    abs(fitted - 1).max() > 0.12
                    and cranial_overlap(projected) > overlap_before + 0.013
                ):
                    xy, profile = proposal, fitted.tolist()
        pivot = self.warp(np.asarray([self.jaw]), True, params)[0, 0]
        eye_scale = self.fit_eyes(image, mask, xy, pivot, ox, oy, unit)
        xy[self.moving_eye, 0] = pivot + (xy[self.moving_eye, 0] - pivot) * eye_scale
        face_map = self.raster(xy, face_ids, size) - 1
        valid = face_map >= 0
        ids = np.maximum(0, face_map)
        labels = self.paint[self.faces[ids, 0]]
        flat = self.rgb[self.faces].mean(axis=1)[ids]
        palette = {}
        coverage = {}
        probes = {}
        for i, key in enumerate(self.roles[1:], 1):
            interior = (
                ndimage.binary_erosion(valid & (labels == i), iterations=2) & target
            )
            if interior.sum() < 12:
                continue
            # Near-neutral shadows shift the brightness within a paint. A
            # component-wise median estimates a single new pigment robustly.
            delta = np.median(photo[interior] - flat[interior], axis=0)
            coverage[key] = int(interior.sum())
            py, px = np.nonzero(interior)
            which = np.linspace(0, len(px) - 1, min(96, len(px))).astype(int)
            probes[key] = (
                (
                    np.column_stack((px[which] - (width - 1) / 2, py[which] - 16))
                    / (SIDES - 32)
                )
                .round(5)
                .tolist()
            )
            original = bytes.fromhex(FAMILIES[self.key]["paints"][key][0][1:])
            tint = (
                np.clip(np.frombuffer(original, dtype="uint8") + delta, 0, 255)
                .round()
                .astype("uint8")
            )
            if abs(delta).max() > 8:
                palette[key] = "#" + tint.tobytes().hex()

        def overlap(a, b):
            return round(float((a & b).sum() / max(1, (a | b).sum())), 4)

        top = xy[self.head, 1].max()
        cranial = np.arange(SIDES)[:, None] < top
        # Resolve each paint as a single convex fill in the review. Native
        # previews retain the full procedural surface, normals and light.
        overlay = np.full((SIDES, width, 3), [246, 243, 238], dtype="uint8")
        overlay[target & valid] = [75, 89, 86]
        overlay[target & ~valid] = [39, 153, 158]
        overlay[~target & valid] = [204, 108, 57]
        transforms = dict(
            zip(
                ("build", "legLength", "headWidth", "headHeight", "crownLength", "jaw"),
                params[3:].round(4).tolist(),
            )
        )
        if profile is not None:
            transforms["crownProfile"] = profile
        if transforms["jaw"] == 1:
            del transforms["jaw"]
        if eye_scale != 1:
            transforms["eyes"] = eye_scale
        recipe = {
            "version": 1,
            "style": "family",
            "family": self.key,
            "proportions": transforms,
            "paints": palette,
        }
        if offset is not None:
            recipe["orbOffset"] = offset.round(4).tolist()
        shirt_frame = None
        if custom_jersey and self.key == "sunshine":
            recipe["plainJersey"] = True
        if FAMILIES[self.key]["plainShirt"] or recipe.get("plainJersey"):
            box = np.asarray(FAMILIES[self.key]["shirtBox"]).reshape(2, 2)
            rect = self.warp(box, np.zeros(2, dtype=bool), params)
            # Source registration in normalized full-height coordinates. This
            # allows the native review to inspect the same garment region.
            shirt_frame = (
                ((rect - [(width - 1) / 2, 16]) / (SIDES - 32))
                .ravel()
                .round(5)
                .tolist()
            )
            mark = shirt_mark(
                image,
                np.where(valid, labels, 0),
                self.roles.index("shirt"),
                rect,
                ox,
                oy,
                unit,
            )
            if recipe.get("plainJersey"):
                window, patch, motif = registered_print(image, mask, shirt_frame)
                mark = traced_print(patch, motif, window) or mark
            if mark:
                recipe["shirtMark"] = mark
        eyes = xy[self.eye]
        midpoint = (width - 1) / 2
        eye_frame = [
            float((eyes[:, 0].min() - midpoint) / (SIDES - 32)),
            float((eyes[:, 1].min() - 16) / (SIDES - 32)),
            float((eyes[:, 0].max() - midpoint) / (SIDES - 32)),
            float((eyes[:, 1].max() - 16) / (SIDES - 32)),
        ]
        metrics = {
            "shirt_frame": shirt_frame,
            "hip_fraction": round(
                float(
                    (
                        self.warp(np.array([[self.center, self.hip]]), False, params)[
                            0, 1
                        ]
                        - 16
                    )
                    / (SIDES - 32)
                ),
                4,
            ),
            "eye_frame": [round(v, 5) for v in eye_frame],
            "silhouette_iou": overlap(target, valid),
            "head_iou": overlap(target & cranial, valid & cranial),
            "head_fraction": round(
                float(np.clip((top - 16) / (SIDES - 32), 0.10, 0.48)), 4
            ),
            "geometry_triangles": len(self.faces),
            "paint_samples": coverage,
            "paint_probes": probes,
        }
        if fit_hair and self.key == "sunshine" and metrics["head_iou"] < 0.97:
            cx, cy, rx, ry = FAMILIES[self.key]["crownRoot"]
            orb = self.warp(
                np.asarray([[cx, cy], [cx + rx, cy], [cx, cy + ry]]), True, params
            )
            center = orb[0] * unit + [ox, oy]
            size = (orb[[1, 2], [0, 1]] - orb[0]) * unit
            seed = visor_seed(image, mask)
            if seed:
                center, radius = seed
                size = [radius, radius]
            result = measure_sun_rays(image, mask, center, size)
            if result:
                rays, swatch = result
                ellipse = measure_sun_rays(image, mask, center, size, orb_only=True)
                visor = measure_visor(image, mask, ellipse)
                source = compile_families(
                    {"family": self.key, "sunRays": rays, "visor": visor}
                )[self.key]
                updated, measured, view = Family(self.key, source).fit(
                    image,
                    mask,
                    fit_hair=False,
                    custom_jersey=custom_jersey,
                    fitted_orb=ellipse if visor else None,
                )
                if (
                    measured["head_iou"] > metrics["head_iou"] + 0.024
                    and measured["silhouette_iou"] >= metrics["silhouette_iou"]
                ):
                    if visor:
                        updated["visor"] = visor
                        colors = orb_swatches(image, ellipse).round().astype("uint8")
                        updated["orbPaint"] = {
                            k: "#" + c.tobytes().hex()
                            for k, c in zip(("top", "bottom"), colors)
                        }
                        neck = jersey_neck(image, mask, ellipse)
                        if neck:
                            updated["orbCollar"] = neck[0]
                    updated["sunRays"] = rays
                    updated["paints"]["rays"] = swatch
                    measured["original_head_iou"] = metrics["head_iou"]
                    return updated, measured, view
        if fit_hair and self.crown_center and metrics["head_iou"] < 0.88:
            body_match = overlap(target & ~cranial, valid & ~cranial)
            if (
                body_match >= 0.86
                and metrics["head_iou"] >= 0.60
                and (eye_scale != 1 or body_match >= 0.89)
            ):
                rim = self.trace_hair(
                    image, mask, params, ox, oy, unit, xy, target, valid, face_map
                )
                if rim is not None:
                    parts = {"family": self.key, "crownOutline": rim}
                    source = compile_families(parts)[self.key]
                    updated, measured, view = Family(self.key, source).fit(
                        image, mask, fit_hair=False, custom_jersey=custom_jersey
                    )
                    if measured["head_iou"] > metrics["head_iou"] + 0.03 and (
                        measured["silhouette_iou"] >= metrics["silhouette_iou"]
                    ):
                        updated["crownOutline"] = rim
                        measured["original_head_iou"] = metrics["head_iou"]
                        return updated, measured, view
        return recipe, metrics, Image.fromarray(overlay)


def fit_family(path, family="auto", name=None, bases=None, *, custom_jersey=False):
    try:
        image, mask = pixels(path, keep_components=True)
    except ValueError as exc:
        raise NoFamilySilhouette(str(exc)) from exc
    y, x = np.nonzero(mask)
    height = np.ptp(y)
    if height < 2 or np.ptp(x) > 4 * height:
        raise NoFamilySilhouette(
            "The outline is outside the proportions of the registered T-poses"
        )
    candidates = {}
    if family != "auto" and family not in FAMILIES:
        raise ValueError("Unknown avatar family")
    for key, data in (bases if bases is not None else compile_families()).items():
        if family == "auto" or family == key:
            candidates[key] = Family(key, data).fit(
                image, mask, custom_jersey=custom_jersey
            )
    best = max(
        candidates,
        key=lambda k: min(
            candidates[k][1]["silhouette_iou"], candidates[k][1]["head_iou"]
        ),
    )
    recipe, _metrics, overlay = candidates[best]
    if best == "sunshine" and custom_jersey:
        seed = visor_seed(image, mask)
        if seed:
            center, radius = seed
            orb = measure_sun_rays(image, mask, center, [radius, radius], orb_only=True)
            if orb is not None:
                fit_crew_to_orb(image, mask, orb, recipe, FAMILIES[best]["crownRoot"])
    recipe["name"] = (name or path.stem.replace("-", " ").strip() or "Family avatar")[
        :60
    ]
    return recipe, {k: v[1] for k, v in candidates.items()}, overlay
