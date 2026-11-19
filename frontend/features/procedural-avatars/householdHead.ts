import { MathUtils } from "three/webgpu";
import type { CartoonDesign } from "./cartoonCast";
import { cranialStations } from "./cranialBase";
import { frontOfLoft, type Drawing, type Section } from "./drawing";
import type { Point } from "./sculpt";

/** A closed Rick-family skull for an intact cheek and a cap or tied hairstyle.
 * Both pigments terminate on the same boundary ring, including behind the ears. */
export function drawHouseholdHead(
    d: Drawing,
    g: CartoonDesign,
    sections: Section[]
) {
    const [width, height] = g.head;
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
    function point(angle: number, t: number): Point {
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
        const x = (r + reach) * Math.sin(angle) + lean;
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
        return [x, 12 + height * (t + drape - 0.042 * swept), depth];
    }
    // Lift the swept part above the floating brow. The cap and jaw still
    // use one continuous perimeter at the temples and behind both ears.
    // The traced lobe sits on the lateral meridian. Include both ear axes
    // and the sagittal axis exactly when sampling the two joined surfaces.
    const sides = g.household.ears
        ? d.s.detail === "crowd"
            ? 24
            : 32
        : d.s.detail === "crowd"
        ? 26
        : 38;
    const rings = (steps: number, hair: boolean) =>
        Array.from({ length: steps + 1 }, (_, i) =>
            Array.from({ length: sides + 1 }, (_, j): Point => {
                const a = ((j % sides) * Math.PI * 2) / sides;
                const u = 0.5 - 0.5 * Math.cos((Math.PI * i) / steps);
                return point(
                    a,
                    hair ? u * hem(a) : MathUtils.lerp(hem(a), 1, u)
                );
            })
        );
    const cap = rings(10, true),
        jaw = rings(13, false);
    jaw[0] = cap.at(-1);
    const seam = new Set(jaw[0].map((p) => p.map(Math.fround).join("/")));
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
    const boundary = cap.at(-1);
    const hairBand = boundary.map((_, j): Point => {
        const a = ((j % sides) * Math.PI * 2) / sides;
        return point(a, hem(a) - Math.min(0.0045, 0.55 / height));
    });
    const liftEdge = (p: Point, j: number): Point => {
        const a = ((j % sides) * Math.PI * 2) / sides;
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
        const segments = g.household.headband
            ? d.s.detail === "crowd"
                ? 10
                : 12
            : 24;
        const rows = g.household.fallRows.map(([t, outer, inner]) => {
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
                if (g.household.headband && t < 0.68) {
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
                d.s.detail === "crowd" || g.household.headband ? 5 : 7;
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
