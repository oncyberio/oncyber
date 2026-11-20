import { MathUtils } from "three/webgpu";
import type { CartoonDesign } from "./cartoonCast";
import { cranialStations } from "./cranialBase";
import { frontOfLoft, type Drawing, type Section } from "./drawing";
import type { Point } from "./sculpt";
import { sweptCrown } from "./sweptCrown";

/** Place both edges of short sideburns on the existing longitude budget. */
function placeFringeMeridians(
    angles: number[],
    knots: number[][],
    hasLobes: boolean
) {
    const sides = angles.length;
    const bend = knots.map(([a, t], i) => {
        if (!i || i === knots.length - 1) return 1;
        const [l, y0] = knots[i - 1],
            [r, y1] = knots[i + 1];
        return Math.abs(t - MathUtils.lerp(y0, y1, (a - l) / (r - l)));
    });
    // Reserve a meridian for both ends of a narrow lock. Two sharp
    // corners can be closer than the spacing of the regular head grid.
    const lateral = Math.round(sides / 4);
    for (const side of [-1, 1]) {
        const arc = [0, Math.PI / 2];
        if (hasLobes) {
            const edge = Math.max(...knots.map(([a]) => side * a));
            const span = Math.PI / 2 - edge;
            const divisions = Math.ceil(span / 0.36);
            for (let j = 1; j < divisions; j++)
                arc.push(edge + (j * span) / divisions);
        }
        const candidates = knots
            .map(([a], i) => ({ angle: side * a, bend: bend[i] }))
            .filter(({ angle }) => angle > 0 && angle < Math.PI / 2)
            .sort((a, b) => b.bend - a.bend);
        for (const { angle } of candidates) {
            if (arc.length > lateral) break;
            if (arc.every((a) => Math.abs(a - angle) > 0.015)) arc.push(angle);
        }
        arc.sort((a, b) => a - b);
        while (arc.length <= lateral) {
            let widest = 1;
            for (let i = 2; i < arc.length; i++) {
                if (arc[i] - arc[i - 1] > arc[widest] - arc[widest - 1])
                    widest = i;
            }
            arc.splice(widest, 0, (arc[widest] + arc[widest - 1]) / 2);
        }
        for (let i = 1; i <= lateral; i++)
            angles[side > 0 ? i : sides - i] =
                side > 0 ? arc[i] : 2 * Math.PI - arc[i];
    }
}

/** A closed Rick-family skull for an intact cheek and a cap or tied hairstyle.
 * Both pigments terminate on the same boundary ring, including behind the ears. */
export function drawHouseholdHead(
    d: Drawing,
    g: CartoonDesign,
    sections: Section[]
) {
    const [width, height] = g.head;
    const sweep = g.household.crownEdges && sweptCrown(g.household.crownEdges);
    const stations = cranialStations(g, sections);
    const tOf = (y: number) => MathUtils.clamp((y - 12) / height, 0, 1);
    const levels = stations.map((row, k) => {
        const t = tOf(row[0]);
        const span = Math.sqrt(4 * t * (1 - t));
        // Smooth the sampled sagittal sections across Rick's empty mouth and
        // sockets before adding this drawing's nose, lids and lip separately.
        let sum = 0,
            front = 0,
            back = 0;
        for (const other of stations) {
            const weight = Math.exp(-0.5 * ((tOf(other[0]) - t) / 0.095) ** 2);
            front += weight * (other[4] + other[3]);
            back += weight * (other[4] - other[3]);
            sum += weight;
        }
        // A front-only household fit inherits a jaw that advances towards the
        // chin. Tapering both sagittal radii about the neck recedes like a sphere.
        const profile = g.household.depth;
        const chin =
            width * (profile?.chin ?? 0) * MathUtils.smoothstep(t, 0.53, 1);
        const cheek = profile
            ? width *
              (profile.forehead * Math.exp(-0.5 * ((t - 0.32) / 0.15) ** 2) +
                  profile.cheek * Math.exp(-0.5 * ((t - 0.75) / 0.15) ** 2)) *
              Math.min(1, span * 3)
            : 0;
        const center = width * 0.035;
        const pole = Math.min(1, span * 2.6);
        const zf = MathUtils.lerp(
            center + width * 0.46 * span,
            (front / sum) * pole,
            0.31
        );
        const zb = MathUtils.lerp(
            center - width * 0.51 * span,
            (back / sum) * pole,
            0.31
        );
        const nape = g.household.nape;
        const fullness =
            nape && profile
                ? width *
                  MathUtils.smoothstep(nape, 0.68, 0.93) *
                  MathUtils.smoothstep(t, 0.56, 0.84) *
                  (1 - MathUtils.smoothstep(t, nape, 1)) *
                  0.24
                : 0;
        return [
            t,
            (sections[k][2] - sections[k][1]) / 2,
            zf + chin + cheek,
            zb + chin - fullness,
        ];
    });
    function level(t: number) {
        let k = 1;
        while (k < levels.length - 1 && t > levels[k][0]) k++;
        const lo = levels[k - 1],
            hi = levels[k];
        const u = MathUtils.clamp((t - lo[0]) / (hi[0] - lo[0]), 0, 1);
        return [
            Math.sqrt(MathUtils.lerp(lo[1] ** 2, hi[1] ** 2, u)),
            MathUtils.lerp(lo[2], hi[2], u),
            MathUtils.lerp(lo[3], hi[3], u),
        ];
    }
    function hem(angle: number) {
        const a = Math.atan2(Math.sin(angle), Math.cos(angle));
        const line = g.hairline;
        if (line?.length && Math.abs(a) <= Math.PI / 2) {
            const u = (a / Math.PI + 0.5) * (line.length - 1);
            const i = Math.min(line.length - 2, Math.floor(u));
            return MathUtils.lerp(line[i], line[i + 1], u - i);
        }
        const side = line?.[a < 0 ? 0 : line.length - 1] ?? 0.65;
        const rear = Math.max(0, -Math.cos(a));
        if (g.household.rearHairline !== undefined) {
            // Front art reveals the temple over the ear. Let the posterior
            // edge descend along the occiput into the neck on a separate arc.
            return MathUtils.lerp(
                side,
                g.household.rearHairline,
                MathUtils.smoothstep(rear, 0.03, 0.64)
            );
        }
        if (g.household.nape !== undefined) {
            // Continue the temple over the pinna, then drop behind the ear.
            // A long crop shows its underside beside the cheek from the front.
            return MathUtils.lerp(
                side,
                g.household.nape,
                MathUtils.smoothstep(rear, 0.03, 0.46)
            );
        }
        return MathUtils.lerp(side, 0.72, rear);
    }
    function point(angle: number, t: number, hair = false): Point {
        const [r, front, back] = level(t);
        const z = (front + back) / 2,
            dz = (front - back) / 2;
        const parted = g.hair.cut === "part";
        // A single cap rolls forward above the temple and recedes into the
        // hairline. The fold belongs to the skull silhouette on every turn.
        const swept =
            parted && t < 0.3
                ? Math.exp(
                      2.8 * (Math.cos(angle - 0.92) - 1) -
                          0.5 * ((t - 0.112) / 0.057) ** 2
                  ) *
                  MathUtils.smoothstep(t, 0, 0.038) *
                  MathUtils.smoothstep(hem(angle) - t, 0, 0.075)
                : 0;
        const reach = width * 0.19 * swept;
        const lean = parted ? width * 0.11 * Math.max(0, 1 - t * 2.8) ** 2 : 0;
        let cheekRadius = r;
        const jawWidths = g.household.jawWidths;
        if (!hair && jawWidths && t > 0.56) {
            const station = MathUtils.clamp(
                (t - 0.6) / 0.05,
                0,
                jawWidths.length - 1
            );
            const i = Math.floor(station);
            const measured =
                width *
                0.5 *
                Math.sqrt(MathUtils.clamp((1 - t) / 0.05, 0, 1)) *
                MathUtils.lerp(
                    jawWidths[i],
                    jawWidths[Math.min(i + 1, jawWidths.length - 1)],
                    station - i
                );
            const visible = MathUtils.smoothstep(t, 0.56, 0.67);
            cheekRadius = MathUtils.lerp(r, Math.min(r, measured), visible);
        }
        let x = (cheekRadius + reach) * Math.sin(angle) + lean;
        const crown = g.household.crownSides;
        if (crown && t < 0.44) {
            const u = (t / 0.44) * (crown.length - 1);
            const k = Math.min(crown.length - 2, Math.floor(u));
            const left = MathUtils.lerp(crown[k][0], crown[k + 1][0], u - k);
            const right = MathUtils.lerp(crown[k][1], crown[k + 1][1], u - k);
            const axis = (width * (left + right)) / 2;
            const radius = Math.max(
                cheekRadius * 0.97,
                (width * (right - left)) / 2
            );
            x = MathUtils.lerp(
                axis + radius * Math.sin(angle),
                x,
                MathUtils.smoothstep(t, 0.34, 0.44)
            );
        }
        // A front drawing measures x and y at the temple, even where the cap
        // continues behind an ear. Displace only its depth on this meridian.
        const nape = g.household.nape;
        const wrap =
            nape && g.household.ears
                ? 0.45 *
                  MathUtils.smoothstep(nape, 0.69, 0.9) *
                  MathUtils.smoothstep(t, 0.14, 0.42) *
                  (1 - MathUtils.smoothstep(t, 0.78, 1)) *
                  Math.sin(angle) ** 2
                : 0;
        let depth =
            z +
            (dz + reach) * Math.cos(angle + Math.sign(Math.sin(angle)) * wrap);
        if (g.household.depth) {
            // Recess the intact bone under each measured globe. This seats
            // its optical center behind the brow in either side view.
            const rx = width * g.face.eyeRadius;
            const u = (Math.abs(x) - width * g.face.eyeSpacing) / (1.48 * rx);
            const v =
                ((t - g.face.eyeHeight) * height) /
                (rx * (g.face.eyeAspect ?? 1) * 1.36);
            const temporal = MathUtils.smoothstep(u, 0.04, 0.83);
            depth -=
                width *
                (0.09 + 0.11 * temporal) *
                Math.exp(-0.5 * (u * u + v * v)) *
                MathUtils.smoothstep(Math.cos(angle), 0.08, 0.54);
        }
        const drape =
            nape && g.household.ears
                ? 0.07 *
                  MathUtils.smoothstep(nape, 0.69, 0.9) *
                  MathUtils.smoothstep(-Math.cos(angle), 0.04, 0.55) *
                  MathUtils.smoothstep(t, 0.69, nape) *
                  (1 - MathUtils.smoothstep(t, nape, 1))
                : 0;
        const y = t + drape - 0.042 * swept;
        return [x, 12 + height * y, depth];
    }
    // Lift the swept part above the floating brow. The cap and jaw still
    // use one continuous perimeter at the temples and behind both ears.
    // The traced lobe sits on the lateral meridian. Include both ear axes
    // and the sagittal axis exactly when sampling the two joined surfaces.
    const sides =
        g.household.ears || sweep
            ? d.s.detail === "crowd"
                ? 24
                : 32
            : d.s.detail === "crowd"
            ? 26
            : 38;
    const angles = Array.from(
        { length: sides },
        (_, j) => (j * 2 * Math.PI) / sides
    );
    const cuts = angles.map(hem);
    const fringe = g.household.fringe;
    const displacements: Point[] = [];
    if (fringe) {
        // Lay the frontal outline on a fixed chart. The outline can bend
        // vertically at a sideburn, where an ellipse at the tip is much
        // narrower than one at the root. Sorting by the inferred longitude
        // there would reverse the two corners of the lock.
        const half = Math.max(0.5, ...fringe.map(([u]) => Math.abs(u) + 0.01));
        const knots = fringe.map(([u, t]) => [Math.asin(u / half), t]);
        placeFringeMeridians(angles, knots, !!g.household.pinnae?.length);
        for (let j = 0; j < sides; j++) {
            const a = Math.atan2(Math.sin(angles[j]), Math.cos(angles[j]));
            if (Math.abs(a) > Math.PI / 2 + 1e-8) continue;
            let u = half * Math.sin(a);
            let t: number;
            if (u < fringe[0][0] - 1e-8 || u > fringe.at(-1)[0] + 1e-8) {
                const [edge, y] = a < 0 ? knots[0] : knots.at(-1);
                const end = (Math.sign(a) * Math.PI) / 2;
                const across = (a - edge) / (end - edge);
                t = MathUtils.lerp(
                    y,
                    hem(end),
                    MathUtils.smoothstep(across, 0, 1)
                );
                const start = Math.abs(half * Math.sin(edge));
                const temple = Math.abs(point(end, hem(end), true)[0]) / width;
                u =
                    Math.sign(a) *
                    MathUtils.lerp(
                        start,
                        Math.max(start, temple),
                        Math.sin((across * Math.PI) / 2)
                    );
            } else {
                const i = Math.max(
                    1,
                    fringe.findIndex(([x]) => x + 1e-8 >= u)
                );
                const [x0, y0] = fringe[i - 1],
                    [x1, y1] = fringe[i];
                t = MathUtils.lerp(
                    y0,
                    y1,
                    MathUtils.clamp((u - x0) / (x1 - x0), 0, 1)
                );
            }
            cuts[j] = t;
            let lo = -Math.PI / 2,
                hi = Math.PI / 2;
            for (let k = 0; k < 12; k++) {
                const mid = (lo + hi) / 2;
                if (point(mid, t, true)[0] < u * width) lo = mid;
                else hi = mid;
            }
            const base = point(a, t, true);
            displacements[j] = [
                u * width - base[0],
                12 + height * t - base[1],
                point((lo + hi) / 2, t, true)[2] - base[2],
            ];
        }
    }
    const temples = g.household.pinnae
        ?.map((p) => g.household.ears?.find(([x]) => Math.sign(x) === p.side))
        .filter(Boolean);
    const seatTemple = (p: Point): Point => {
        const ear = temples?.find(([x]) => Math.sign(x) === Math.sign(p[0]));
        if (!ear) return p;
        const [x, y, rx, ry] = ear;
        const v = Math.abs((tOf(p[1]) - y) / ry);
        if (v >= 1.32) return p;
        const blend = 1 - MathUtils.smoothstep(v, 0.7, 1.32);
        const shoulder =
            Math.abs(x) -
            rx * 0.78 * Math.sqrt(Math.max(0, 1 - (v / 1.32) ** 2));
        const extent = Math.abs(p[0]) / width;
        const front = MathUtils.smoothstep(p[2] / width, 0.015, 0.13);
        const excess = Math.max(0, extent - shoulder);
        return [
            p[0] - Math.sign(x) * width * blend * front * excess,
            p[1],
            p[2],
        ];
    };
    const sewnPoint = (j: number, t: number, hair: boolean): Point => {
        const k = j % sides,
            angle = angles[k],
            p = point(angle, t, hair);
        if (sweep && hair && t < 0.54) {
            // Register the fringe on its original skull. Roll the upper cap
            // into that seam using each meridian's actual cut, including the
            // low edge of a sideburn and the high part above the eyebrow.
            const y = (p[1] - 12) / height;
            const [u, v] = sweep.project(Math.sin(angle), t, p[0] / width, y);
            const weight = MathUtils.smoothstep(cuts[k] - t, 0.012, 0.15);
            p[0] = MathUtils.lerp(p[0], width * u, weight);
            p[1] = 12 + height * MathUtils.lerp(y, v, weight);
        }
        if (!displacements[k]) return seatTemple(p);
        const w = 1 - MathUtils.smoothstep(Math.abs(t - cuts[k]), 0, 0.22);
        return seatTemple([
            p[0] + w * displacements[k][0],
            p[1] + w * displacements[k][1],
            p[2] + w * displacements[k][2],
        ]);
    };
    const capSteps = sweep ? 11 : g.household.crownSides ? 16 : 10;
    const stops =
        sweep && angles.map((a, i) => sweep.knots(a, cuts[i], capSteps));
    const rings = (steps: number, hair: boolean) =>
        Array.from({ length: steps + 1 }, (_, i) =>
            Array.from({ length: sides + 1 }, (_, j): Point => {
                const u = 0.5 - 0.5 * Math.cos((Math.PI * i) / steps);
                return sewnPoint(
                    j,
                    hair
                        ? stops?.[j % sides][i] ?? u * cuts[j % sides]
                        : MathUtils.lerp(cuts[j % sides], 1, u),
                    hair
                );
            })
        );
    const cap = rings(capSteps, true),
        jaw = rings(13, false);
    if (sweep) {
        // A short fringe can displace the top row differently by meridian.
        // Weld the fan to one measured summit before computing its normals.
        const [u, v] = g.household.crownEdges[0][0];
        cap[0].fill([width * u, 12 + height * v, point(0, 0, true)[2]]);
    }
    if (g.household.jawWidths) {
        // Close the hair overhang in its own pigment. Skin spanning this rim
        // would create false cheek panels below the ears in a front view.
        cap.push(jaw[0]);
    } else jaw[0] = cap.at(-1);
    const seam = new Set(jaw[0].map((p) => p.map(Math.fround).join("/")));
    if (sweep || g.household.crownSides) {
        for (const row of cap)
            for (const j of [
                Math.round(sides / 4),
                Math.round((3 * sides) / 4),
            ]) {
                const p = row[j];
                if (tOf(p[1]) < 0.44) seam.add(p.map(Math.fround).join("/"));
            }
    }
    const preserve = d.s.preserveVertex,
        normal = d.s.surfaceNormal,
        tone = d.s.tone;
    d.s.surfaceNormal = (x, y, z) => {
        const t = tOf(y),
            step = 0.011;
        if (t < 0.004 || t > 0.996) return [0, t < 0.5 ? -1 : 1, 0];
        const [r, f, b] = level(t),
            dz = (f - b) / 2;
        const s = x / Math.max(0.01, r),
            c = (z - (f + b) / 2) / Math.max(0.01, dz);
        const lo = level(t - step),
            hi = level(t + step);
        const scale = 1 / (2 * step * height);
        const dr = (hi[0] - lo[0]) * scale;
        const df = (hi[1] - lo[1]) * scale,
            db = (hi[2] - lo[2]) * scale;
        return [
            s / r,
            (-s * s * dr) / r - (c * (df + db + c * (df - db))) / (2 * dz),
            c / dz,
        ];
    };
    d.s.preserveVertex = (x, y, z) =>
        seam.has([x, y, z].map(Math.fround).join("/")) || !!preserve?.(x, y, z);
    d.s.tone = (x, y, z) =>
        0.94 +
        0.07 * (1 - tOf(y)) +
        0.025 * Math.cos((3 * x) / width + z / width);
    const skinNormal = d.s.surfaceNormal;
    // The renderer derives normals from the rolled meridians of a parted
    // cap. Other caps share the analytic curvature of the cheek.
    if (g.hair.cut === "part") d.s.surfaceNormal = undefined;
    d.s.surface(cap, g.hair.color, true, undefined, 0.22);
    d.s.surfaceNormal = skinNormal;
    // Give the temple boundary the fine painted edge of the source drawing.
    // Both edges follow the skull, including the side hidden in a single still.
    const boundary = cap.at(g.household.jawWidths ? -2 : -1);
    const hairBand = boundary.map(
        (_, j): Point =>
            sewnPoint(
                j,
                cuts[j % sides] - Math.min(0.0045, 0.55 / height),
                true
            )
    );
    const liftEdge = (p: Point, j: number): Point => {
        const a = angles[j % sides];
        return [p[0] + 0.22 * Math.sin(a), p[1], p[2] + 0.22 * Math.cos(a)];
    };
    d.s.surface(
        [hairBand.map(liftEdge), boundary.map(liftEdge)],
        "#61432c",
        true,
        "perimeter"
    );
    d.s.tone = tone;
    d.s.surface(jaw, g.skin, true, undefined, 0.22);
    d.s.surfaceNormal = normal;
    d.s.preserveVertex = preserve;
    if (g.hair.cut === "ponytail") {
        const root = point(-2.6, 0.19);
        const rows = [
            [0, 0.04, 0.045, 0.08, 0.075],
            [-0.065, 0, -0.045, 0.13, 0.1],
            [-0.12, 0.055, -0.13, 0.185, 0.155],
            [-0.16, 0.175, -0.175, 0.2, 0.17],
            [-0.16, 0.33, -0.175, 0.16, 0.14],
            [-0.15, 0.52, -0.13, 0.11, 0.1],
            [-0.18, 0.64, -0.095, 0.075, 0.055],
            [-0.28, 0.72, -0.055, 0, 0],
        ].map(([x, y, z, rx, rz]) =>
            Array.from({ length: 17 }, (_, i): Point => {
                const a = (i * 2 * Math.PI) / 16;
                return [
                    root[0] + width * (x + rx * Math.sin(a)),
                    root[1] + height * y,
                    root[2] + width * (z + rz * Math.cos(a)),
                ];
            })
        );
        d.s.surface(rows, g.hair.color, true, "start", 0.2);
    }
    if (g.hair.cut === "waves" && g.household.fallRows) {
        // A closed horseshoe section leaves room for the neck. The back and both
        // side locks share vertices around the bend, including at shoulder height.
        const measured = g.household.fallRows;
        const shortBob = measured.at(-1)[0] < 1.05;
        const segments =
            g.household.headband || shortBob
                ? d.s.detail === "crowd"
                    ? 10
                    : 12
                : 24;
        // The upper curtain sits inside the cap. Its hidden intermediate
        // rings cost triangles without contributing to the crown silhouette.
        const levels = shortBob
            ? measured.filter(([t], i) => i === 0 || t > 0.48 || i % 2 === 0)
            : measured;
        const rows = levels.map(([t, outer, inner]) => {
            const arc = (j: number, inside: boolean): Point => {
                // A band draws the two curtains behind the ears. Leave the
                // lower flared ends free where the band releases their tension.
                const tuck = g.household.headband
                    ? MathUtils.smoothstep(t, 0.1, 0.38) *
                      (1 - MathUtils.smoothstep(t, 0.72, 1.15))
                    : 0;
                const start = MathUtils.lerp(
                    Math.asin(inner / outer),
                    1.87,
                    tuck
                );
                const a = start + ((Math.PI * 2 - start * 2) * j) / segments;
                const front = Math.max(0, Math.cos(a));
                const side = Math.abs(Math.sin(a));
                const curl = MathUtils.smoothstep(t, 0.68, 1.15);
                const taper = MathUtils.lerp(1, 0.76, curl);
                const radius = inside ? outer * 0.78 : outer;
                const x = Math.sin(a) * radius;
                const rise = MathUtils.smoothstep(t, 0.09, 0.44);
                const base = MathUtils.smoothstep(t, 0.92, 1.23);
                const reach = 0.16 + 0.34 * rise - 0.29 * base;
                const z =
                    Math.cos(a) * reach * (inside ? 0.72 : 1) * taper +
                    front * 0.046 * side -
                    0.04;
                // The long curtain grows out from beneath the cap. Where a
                // band holds it down, its upper rows must stay inside the
                // scalp even between two successive sections of the curtain.
                let lateral = x * width,
                    forward = z * width;
                if (shortBob) {
                    // The jaw-length locks turn behind the pinna. Their front
                    // silhouette still follows the measured inner and outer
                    // edges, while the rear meridian keeps its full depth.
                    forward -=
                        width *
                        MathUtils.smoothstep(t, 0.35, 0.61) *
                        (0.2 + 0.2 * Math.cos(a));
                }
                if ((g.household.headband || shortBob) && t < 0.68) {
                    const [r, nose, nape] = level(t);
                    const middle = (nose + nape) / 2;
                    const radial = Math.hypot(
                        lateral / r,
                        (forward - middle) / ((nose - nape) / 2)
                    );
                    const clip = Math.min(1, 0.95 / Math.max(radial, 0.01));
                    const scale = MathUtils.lerp(
                        clip,
                        1,
                        MathUtils.smoothstep(t, 0.45, 0.68)
                    );
                    lateral *= scale;
                    forward = middle + (forward - middle) * scale;
                }
                return [
                    lateral,
                    12 + height * (t - curl * 0.08 * (1 - side)),
                    forward,
                ];
            };
            const outside = Array.from({ length: segments + 1 }, (_, j) =>
                arc(j, false)
            );
            // The concave inner shell is visible along the opening and hem.
            // Its broad rear surface needs fewer meridians than the silhouette.
            const innerSegments =
                d.s.detail === "crowd" || g.household.headband || shortBob
                    ? 5
                    : 7;
            const inside = Array.from({ length: segments + 1 }, (_, j) => {
                const u =
                    Math.round((1 - j / segments) * innerSegments) /
                    innerSegments;
                return arc(u * segments, true);
            });
            return [...outside, ...inside, outside[0]];
        });
        d.s.surface(rows, g.hair.color, true, "both", 0.25);
        for (const ring of [rows[0], rows.at(-1)]) {
            const outside = ring.slice(0, segments + 1);
            const inside = ring
                .slice(segments + 1, 2 * (segments + 1))
                .reverse();
            d.s.surface(
                ring === rows[0] ? [inside, outside] : [outside, inside],
                g.hair.color,
                true,
                "perimeter"
            );
        }
    }
    const patch = g.household.eyePatch;
    const band = g.household.headband;
    if (band) {
        // A strip of constant angular width lies on a tilted great circle.
        // Its two ends descend behind the temples and rotate with the skull.
        const steps = d.s.detail === "crowd" ? 16 : 20;
        const ring = (edge: number) =>
            Array.from({ length: steps + 1 }, (_, i): Point => {
                const arc = (i / steps - 0.5) * 3.62;
                const across = band.width * edge - 0.1 * Math.sin(arc) ** 2;
                const up = Math.cos(across) * Math.cos(arc);
                const x = Math.cos(across) * Math.sin(arc);
                const forward =
                    up * Math.sin(band.tilt) +
                    Math.sin(across) * Math.cos(band.tilt);
                const vertical =
                    -up * Math.cos(band.tilt) +
                    Math.sin(across) * Math.sin(band.tilt);
                const t = (1 + vertical) * 0.5;
                const angle = Math.atan2(x, forward);
                const p = point(angle, t);
                const lift = width * (0.01 + 0.004 * (1 - edge * edge));
                return [
                    p[0] + lift * x,
                    p[1] + lift * vertical,
                    p[2] + lift * forward,
                ];
            });
        const rim = [-1, -0.81, 0, 0.81, 1].map(ring);
        d.s.surface([rim[0], rim[1]], "#5a5556", true);
        d.s.surface(rim.slice(1, 4), band.color, true);
        d.s.surface([rim[3], rim[4]], "#5a5556", true);
    }
    if (patch) {
        const side = patch.side === "right" ? -1 : 1;
        // Both strap edges lie on the same scalp and join behind the head.
        const strap = [-1, 1].map((edge) =>
            Array.from({ length: 73 }, (_, j): Point => {
                const a = ((j % 72) * Math.PI) / 36;
                const y =
                    g.face.eyeHeight +
                    patch.lift -
                    patch.height * 0.44 -
                    side * Math.sin(a) * 0.014 +
                    edge * 0.012;
                const p = point(a, y);
                return [
                    p[0] + Math.sin(a) * 0.55,
                    p[1],
                    p[2] + Math.cos(a) * 0.55,
                ];
            })
        );
        d.s.surface(strap, patch.strap, true, "both");
    }
    const hit = frontOfLoft([...cap, ...jaw.slice(1)]);
    return (x: number, y: number) => {
        const z = hit(x, y);
        if (Number.isFinite(z)) return z;
        const [, front, back] = level(tOf(y));
        return (front + back) / 2;
    };
}
