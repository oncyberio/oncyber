import { Color, Line3, MathUtils, Vector3 } from "three/webgpu";
import type { CartoonDesign, EyeDepth } from "./cartoonCast";
import { curve, type Depth, type Drawing, type XY } from "./drawing";
import { fitEyeDepth, classicPupilOffset } from "./humanoidParts";
import type { Point } from "./sculpt";
import { pupilUVBase, insetPupilUVBase } from "./surfaces";

type Eye = {
    center: XY;
    radii: XY;
    side: number;
    gaze: number;
    aperture: CartoonDesign["eyes"];
    brow: CartoonDesign["brow"];
    skin: string;
    lashes?: boolean;
    /** A traced opening is already clipped to its lids. */
    opening?: XY[];
    /** Keep the entire traced opening clear of an intact rounded cheek. */
    closedSocket?: boolean;
    observedGaze?: [number, number];
    rimInk?: { width: number; color: string };
    outerRim?: boolean;
    lid?: XY[];
    pupil?: XY;
    pigment?: CartoonDesign["pupil"];
    pupilRadius?: number;
    globeDepth?: number;
    depthScale?: number;
    commonFront?: number;
    sideOrbit?: EyeDepth;
    turnedPupil?: number;
};

/** Measure the visible opening of a horizontal corneal loft. Opposite side
 * views share a projection. The two three-quarter views expose different
 * pieces of the dome when the eyelid or the gaze is asymmetric. */
function eyeScanlines(rows: Point[][]) {
    const angles = [0, -35, 35, 90];
    const top = rows[0][0][1],
        height = rows.at(-1)[0][1] - top;
    const scanlines = new Map<number, [number, number][]>();
    const view = angles.map((angle) => {
        const a = MathUtils.degToRad(angle);
        return (x: number, z: number) => x * Math.cos(a) + z * Math.sin(a);
    });
    for (const row of rows) {
        scanlines.set(
            Math.fround(row[0][1]),
            view.map((project) => {
                const xs = row.map(([x, , z]) => project(x, z));
                return [Math.min(...xs), Math.max(...xs)];
            })
        );
    }
    return (x: number, y: number, z: number) => {
        const spans = scanlines.get(Math.fround(y));
        const horiz = view.map((project, i) => {
            const [lo, hi] = spans[i];
            const u = hi - lo < 0.001 ? 0.5 : (project(x, z) - lo) / (hi - lo);
            return 0.1 + 0.8 * MathUtils.clamp(u, 0, 1);
        });
        return [0.1 + (0.8 * (y - top)) / height, ...horiz];
    };
}

/** Preserve the sharpest turn in any meridian or latitude first. The whole
 * grid takes the same cuts, keeping the globe sewn to its lid at this LOD. */
function cornealCuts(lines: Point[][], budget: number) {
    const last = lines[0].length - 1;
    const kept = [0, last];
    const chord = new Line3(),
        probe = new Vector3(),
        nearest = new Vector3();
    while (kept.length < Math.min(last + 1, budget)) {
        let split = -1,
            worst = -1,
            insert = 0;
        for (let n = 1; n < kept.length; n++) {
            const a = kept[n - 1],
                b = kept[n];
            for (const line of lines) {
                chord.start.set(...line[a]);
                chord.end.set(...line[b]);
                for (let j = a + 1; j < b; j++) {
                    probe.set(...line[j]);
                    chord.closestPointToPoint(probe, true, nearest);
                    const distance = nearest.distanceToSquared(probe);
                    if (distance > worst) {
                        worst = distance;
                        split = j;
                        insert = n;
                    }
                }
            }
        }
        if (split < 0) break;
        kept.splice(insert, 0, split);
    }
    return kept;
}

/** Frontal and side pupil marks may each fall inside their drawing yet
 * describe a point outside the globe when combined. Keep the pigment disk
 * inside the horizontal section so it stays legible on intermediate views. */
export function seatPupil(rim: XY[], target: XY, radius: number): XY {
    const center: XY = [0, 0];
    for (const [x, z] of rim) {
        center[0] += x / rim.length;
        center[1] += z / rim.length;
    }
    let reach = 1;
    for (let i = 0; i < rim.length; i++) {
        const a = rim[i],
            b = rim[(i + 1) % rim.length];
        const dx = b[0] - a[0],
            dz = b[1] - a[1];
        const length = Math.hypot(dx, dz);
        if (!length) continue;
        const clearance = ([x, z]: XY) =>
            ((x - a[0]) * dz - (z - a[1]) * dx) / length;
        const from = clearance(center);
        const to = clearance(target) * Math.sign(from);
        const room = Math.abs(from);
        const margin = Math.min(room, radius);
        if (to < margin) reach = Math.min(reach, (room - margin) / (room - to));
    }
    return [
        MathUtils.lerp(center[0], target[0], reach),
        MathUtils.lerp(center[1], target[1], reach),
    ];
}

/** With one view the horizontal gaze is observed and the depth is free.
 * Intersect a ray through the drawn pupil with the corneal section. */
export function seatFrontalPupil(rim: XY[], [x, z]: XY, radius: number): XY {
    const hits: number[] = [];
    for (let i = 0; i < rim.length; i++) {
        const a = rim[i],
            b = rim[(i + 1) % rim.length];
        if (a[0] > x === b[0] > x) continue;
        hits.push(MathUtils.lerp(a[1], b[1], (x - a[0]) / (b[0] - a[0])));
    }
    if (hits.length < 2) return seatPupil(rim, [x, z], radius * 0.25);
    const low = Math.min(...hits),
        high = Math.max(...hits);
    const margin = Math.min(radius * 1.35, (high - low) * 0.5);
    return [x, MathUtils.clamp(z, low + margin, high - margin)];
}

/** Cross-sections of a closed globe. Each lid meets the white at the same
 * latitude. Turning the head exposes the side of the globe and the lid margin. */
export function drawCartoonEye(d: Drawing, face: Depth, e: Eye) {
    const [cx, cy] = e.center,
        [rx, ry] = e.radii;
    const sleepy = e.aperture === "half-lidded";
    const rz = rx * (sleepy ? 0.56 : 0.92) * (e.depthScale ?? 1);
    const cz =
        Math.max(face(cx, cy), face(cx - e.side * rx * 0.63, cy)) -
        rx * (sleepy ? 0.24 : 0.32);
    const upper = sleepy
        ? -0.18
        : e.aperture === "relaxed"
        ? -0.77
        : e.brow === "level" || e.brow === "arched"
        ? -1
        : -0.79;
    const lower = sleepy ? 0.67 : 1;
    const tilt = e.brow === "worried" ? 0.34 : e.brow === "knit" ? -0.39 : 0;
    const crowd = d.s.detail === "crowd";
    const divisions = crowd ? 12 : 18;
    const white = "#fffdf8",
        ink = "#493b35";
    const clamp = MathUtils.clamp;
    const contour = e.opening;
    const crossSection = (u: number) => {
        const x = cx + rx * u,
            r = Math.sqrt(Math.max(0, 1 - u * u));
        const hi = upper + tilt * e.side * u + (sleepy ? 0.12 * u * u : 0);
        const lo = lower - (sleepy ? 0.28 * u * u : 0);
        const top = r ? Math.asin(clamp(hi / r, -1, 1)) : 0;
        const bottom = r ? Math.asin(clamp(lo / r, -1, 1)) : 0;
        return { x, r, top, bottom, highCut: hi, lowCut: lo };
    };
    // Longitude rings keep an evenly sampled silhouette as a character
    // turns. Solve the latitude where each meridian crosses its eyelid.
    const halfPi = Math.PI / 2;
    const eyelidLatitude = (longitude: number, above: boolean) => {
        let lo = -halfPi,
            hi = halfPi;
        for (let i = 0; i < 14; i++) {
            const mid = (lo + hi) / 2;
            const s = crossSection(Math.sin(longitude) * Math.cos(mid));
            const raw = above ? s.highCut : s.lowCut;
            if (Math.sin(mid) < raw) lo = mid;
            else hi = mid;
        }
        const angle = (lo + hi) / 2;
        return Math.abs(angle) > halfPi - 0.004
            ? Math.sign(angle) * halfPi
            : angle;
    };
    const position = (longitude: number, latitude: number): Point => {
        const c = Math.cos(latitude);
        return [
            cx + rx * c * Math.sin(longitude),
            cy + ry * Math.sin(latitude),
            cz + rz * c * Math.cos(longitude),
        ];
    };
    const pupilRadius = clamp(
        e.pupilRadius ?? rx * (e.pigment?.radius ?? 0.12),
        rx * 0.06,
        e.globeDepth && e.pupilRadius ? Math.min(rx, ry) * 0.58 : rx * 0.24
    );
    const pupilY =
        e.pupil?.[1] ??
        cy + ry * (e.pigment?.height ?? (sleepy ? 0.16 : -0.055));
    // The nasal bridge can cover more of the medial white. Measure the
    // exposed horizontal chord to align both pupils within their openings.
    const v = (pupilY - cy) / ry;
    const visible = Array.from({ length: 65 }, (_, i) =>
        crossSection((i - 32) / 32)
    ).filter((s) => {
        const z = cz + rz * Math.sqrt(Math.max(0, s.r * s.r - v * v));
        return (
            v >= s.r * Math.sin(s.top) &&
            v <= s.r * Math.sin(s.bottom) &&
            z > face(s.x, pupilY) + 0.045 * rx
        );
    });
    const left = visible[0]?.x ?? cx - rx,
        right = visible.at(-1)?.x ?? cx + rx;
    const pupilX =
        e.pupil?.[0] ??
        MathUtils.lerp(left, right, 0.5 + 0.5 * clamp(e.gaze, -0.68, 0.68));
    const oldOcclusion = d.s.occluded;
    d.s.occluded = (x, y, z) =>
        z < face(x, y) - rx * 0.18 || !!oldOcclusion?.(x, y, z);
    d.s.eyes = true;
    d.s.surfaceNormal = (x, y, z) => [
        (x - cx) / (rx * rx),
        (y - cy) / (ry * ry),
        (z - cz) / (rz * rz),
    ];
    const pupilHeight =
        pupilRadius * (e.pigment?.aspect ?? (contour ? 1.04 : 1.16));
    const whiteSurface =
        (front: boolean) =>
        (x: number, y: number, z: number): [number, number, number, number] => {
            const s = crossSection(clamp((x - cx) / rx, -1, 1));
            const v = (y - cy) / ry;
            const margin = Math.min(
                s.top > -1.565 ? v - s.r * Math.sin(s.top) : 2,
                s.bottom < 1.565 ? s.r * Math.sin(s.bottom) - v : 2
            );
            return [
                front ? (x - pupilX) / pupilRadius : 8,
                front ? (y - pupilY) / pupilHeight : 8,
                clamp(0.5 + (0.42 * (z - face(x, y))) / rx, 0.02, 1),
                clamp(0.25 + margin * 0.65, 0.02, 1),
            ];
        };
    const normal = d.s.surfaceNormal;
    const tracedLashes: Point[] = [];
    if (contour) {
        // The measured contour cuts the globe at its lids. The socket joins
        // that rim to the surrounding skin, including on the temple side.
        const outline = curve(
            contour,
            true,
            false,
            Math.min(
                contour.length * 2,
                e.globeDepth ? (crowd ? 18 : 32) : crowd ? 22 : 32
            )
        );
        const clearances = new Map<string, number>();
        const vertexKey = (x: number, y: number) =>
            [Math.fround(x), Math.fround(y)].join("/");
        const slope = (dx: number, dy: number) =>
            clamp(
                (face(cx + dx, cy + dy) - face(cx - dx, cy - dy)) /
                    (2 * Math.hypot(dx, dy)),
                -0.72,
                0.72
            );
        const sx = slope(rx * 0.35, 0),
            sy = slope(0, ry * 0.35);
        const centerDepth = face(cx, cy);
        const orbit = e.sideOrbit;
        const dome = e.globeDepth ?? rx * 0.38;
        const advance =
            e.commonFront == null
                ? 0
                : e.commonFront - centerDepth - dome - rx * 0.038;
        const socket = (x: number, y: number) => {
            if (orbit?.eyeCenter != null && orbit.eyeSpan && e.globeDepth) {
                const temple = MathUtils.smoothstep(
                    (e.side * (x - cx)) / rx,
                    0.26,
                    1
                );
                return (
                    orbit.eyeCenter +
                    orbit.eyeSpan / 2 -
                    e.globeDepth -
                    Math.max(0, orbit.eyeSpan - e.globeDepth) * temple +
                    sy * (y - cy) * 0.3
                );
            }
            const cheek = face(x, y);
            const plane = centerDepth + sx * (x - cx) + sy * (y - cy);
            return (
                cheek +
                clamp(plane - cheek, 0, rx * 0.18) +
                rx * 0.038 +
                advance
            );
        };
        const rise = (t: number) =>
            e.globeDepth
                ? dome * Math.sqrt(Math.max(0, 1 - t * t))
                : dome * (1 - t * t);
        const ys = outline.map((p) => p[1]);
        const top = Math.min(...ys),
            bottom = Math.max(...ys);
        const sideRows =
            orbit?.eyeRows ??
            (orbit?.eyeCenter != null && orbit.eyeSpan
                ? fitEyeDepth(
                      outline,
                      top,
                      bottom,
                      orbit.eyeCenter,
                      orbit.eyeSpan
                  )
                : undefined);
        const profileAt = (y: number) => {
            const v = clamp((y - top) / (bottom - top), 0, 1);
            const next = sideRows.findIndex((row) => row[0] >= v);
            const hi = next < 0 ? sideRows.length - 1 : Math.max(1, next);
            const a = sideRows[hi - 1],
                b = sideRows[hi];
            const f = clamp((v - a[0]) / (b[0] - a[0]), 0, 1);
            return {
                back: MathUtils.lerp(a[1], b[1], f),
                front: MathUtils.lerp(a[2], b[2], f),
            };
        };
        // Every longitude on a latitude uses the same traced endpoints.
        const spans = new Map<number, [number, number]>();
        const rangeAt = (y: number): [number, number] => {
            const cached = spans.get(y);
            if (cached) return cached;
            const yy = clamp(y, top + 0.04, bottom - 0.04);
            const xs = outline.slice(1).flatMap(([bx, by], i) => {
                const [ax, ay] = outline[i];
                return (ay <= yy && yy < by) || (by <= yy && yy < ay)
                    ? [ax + ((yy - ay) / (by - ay)) * (bx - ax)]
                    : [];
            });
            const lo = xs.length ? Math.min(...xs) : cx - rx,
                right = xs.length ? Math.max(...xs) : cx + rx;
            const span: [number, number] = [lo, right];
            spans.set(y, span);
            return span;
        };
        // For a pupil near both measured silhouettes, the white must reach
        // that point in both projections. Fit only its half of the cornea.
        // Front and profile outlines keep their measured extents.
        let pupilBand: { u: number; exponent: number } | undefined;
        if (sideRows && orbit?.pupilDepth != null) {
            const [left, right] = rangeAt(pupilY);
            const u = clamp(
                (pupilX - left) / Math.max(0.1, right - left),
                0,
                1
            );
            const offset = Math.abs(2 * u - 1);
            const { back, front } = profileAt(pupilY);
            const required = clamp(
                (orbit.pupilDepth - back) / Math.max(0.1, front - back),
                0,
                1
            );
            let exponent = 2;
            while (
                exponent < 10 &&
                (1 - offset ** exponent) ** (1 / exponent) < required
            )
                exponent++;
            pupilBand = { u, exponent };
        }
        const cornea = (x: number, y: number, t: number) => {
            if (!sideRows) return socket(x, y) + rise(t);
            const { back, front } = profileAt(y);
            const [lo, right] = rangeAt(y);
            const u = clamp((x - lo) / Math.max(0.1, right - lo), 0, 1);
            const offset = Math.abs(2 * u - 1);
            const medial = e.side < 0 ? u : 1 - u;
            // The bridge rounds the nasal end. More of the temporal globe
            // remains exposed underneath the upper lid on an oblique turn.
            let exponent = MathUtils.lerp(4.8, 2.1, medial);
            if (pupilBand) {
                const sameSide = MathUtils.smoothstep(
                    (2 * u - 1) * Math.sign(2 * pupilBand.u - 1),
                    0,
                    0.67
                );
                const level =
                    1 -
                    MathUtils.smoothstep(Math.abs(y - pupilY) / ry, 0.34, 1.1);
                exponent = MathUtils.lerp(
                    exponent,
                    Math.max(exponent, pupilBand.exponent),
                    level * sameSide
                );
            }
            const arc = Math.max(0, 1 - offset ** exponent) ** (1 / exponent);
            // A measured sagittal opening ends at the temporal rim. The
            // medial rim sits farther forward against the nasal bridge.
            const rim = 0.02 + 0.02 * medial;
            const z = MathUtils.lerp(back, front, rim + (1 - rim) * arc);
            return e.closedSocket ? Math.max(z, face(x, y) + rx * 0.075) : z;
        };
        const ring = (t: number) =>
            outline.map(([ox, oy]): Point => {
                const x = MathUtils.lerp(cx, ox, t),
                    y = MathUtils.lerp(cy, oy, t);
                const z = cornea(x, y, t);
                return [x, y, z];
            });
        d.s.surfaceNormal = (x, y) => [
            -sx + (0.86 * (x - cx)) / rx,
            -sy + (0.86 * rx * (y - cy)) / (ry * ry),
            1,
        ];
        // Join the drawn opening to its inferred or observed side sections.
        // Longitude samples resolve the rounded temporal rim on a turn.
        let sections: Point[][];
        if (sideRows) {
            // A latitude sampled at uniform x misses the small radius where
            // the front of a wide cartoon globe rolls around the temple.
            const latitudes = [
                ...new Set([
                    0,
                    0.025,
                    0.055,
                    0.14,
                    0.3,
                    0.5,
                    0.7,
                    0.86,
                    0.945,
                    0.975,
                    1,
                    ...sideRows.map((row) => row[0]),
                ]),
            ].sort((a, b) => a - b);
            const grid = latitudes.map((v) => {
                const y = MathUtils.lerp(top, bottom, v);
                const [lo, hi] = rangeAt(y);
                return Array.from({ length: 49 }, (_, i): Point => {
                    const cos = Math.cos((i * Math.PI) / 48);
                    const u =
                        (1 - Math.sign(cos) * Math.abs(cos) ** 0.45) * 0.5;
                    const x = MathUtils.lerp(lo, hi, u);
                    return [x, y, cornea(x, y, 1)];
                });
            });
            const longitude = cornealCuts(
                grid,
                crowd ? 7 : e.closedSocket ? 13 : 11
            );
            const latitude = cornealCuts(
                longitude.map((j) => grid.map((row) => row[j])),
                crowd ? 7 : e.closedSocket ? 17 : 12
            );
            sections = latitude.map((i) => longitude.map((j) => grid[i][j]));
        }
        // Join the eyelid and its ink to the very same boundary vertices.
        const outer = sections
            ? [
                  ...sections[0],
                  ...sections.slice(1).map((r) => r.at(-1)),
                  ...sections.at(-1).slice(0, -1).reverse(),
                  ...sections
                      .slice(0, -1)
                      .reverse()
                      .map((r) => r[0]),
              ]
            : ring(1);
        // An oblique, lowered lid can start at a single corner. Horizontal
        // scanlines there collapse over the white and leave a diagonal streak.
        // Use distance from the sewn edge for this aperture.
        const scanInk =
            e.rimInk && e.globeDepth && !(e.closedSocket && sleepy && !e.lid);
        if (sections && !scanInk) {
            // A steeply turning globe can travel far in depth between two
            // almost coincident frontal samples. Measure the ink margin on
            // the surface so it keeps its width in the side view as well.
            const points = outer.map((p) => new Vector3(...p));
            const edges = points
                .slice(1)
                .flatMap((end, i) =>
                    points[i].equals(end) ? [] : [new Line3(points[i], end)]
                );
            const vertex = new Vector3(),
                onEdge = new Vector3();
            for (const row of sections) {
                for (const p of row) {
                    vertex.set(...p);
                    let nearest = rx * rx;
                    for (const edge of edges) {
                        edge.closestPointToPoint(vertex, true, onEdge);
                        nearest = Math.min(
                            nearest,
                            vertex.distanceToSquared(onEdge)
                        );
                    }
                    clearances.set(
                        vertexKey(p[0], p[1]),
                        Math.sqrt(nearest) / rx
                    );
                }
            }
        }
        if (e.lashes)
            for (const u of [0.84, 0.965]) {
                const x = cx + e.side * u * rx;
                const heights = outline.slice(1).flatMap(([bx, by], i) => {
                    const [ax, ay] = outline[i];
                    return (ax <= x && x < bx) || (bx <= x && x < ax)
                        ? [ay + ((by - ay) * (x - ax)) / (bx - ax)]
                        : [];
                });
                if (heights.length) {
                    const y = Math.min(...heights);
                    tracedLashes.push([x, y, cornea(x, y, 1)]);
                }
            }
        if (e.globeDepth) {
            // Keep the measured gaze inside the visible opening as the head turns.
            const xs = outline.map((p) => p[0]);
            // A pupil drawn against the rim wraps around the exposed side.
            // Its measured center is clipped in the front view.
            const fullyVisible =
                Math.min(pupilX - Math.min(...xs), Math.max(...xs) - pupilX) >=
                pupilRadius * 1.45;
            const inferDepth = orbit?.pupilDepth == null && fullyVisible;
            const inset =
                Math.min(pupilRadius, rx * 0.24) *
                (sideRows && inferDepth ? 0.4 : 1.28);
            const irisX = clamp(
                pupilX,
                Math.min(...xs) + inset,
                Math.max(...xs) - inset
            );
            const pupilT = Math.hypot((irisX - cx) / rx, (pupilY - cy) / ry);
            const atPupil = socket(irisX, pupilY) + rise(Math.min(1, pupilT));
            const recess = pupilRadius * 0.65;
            const socketCenter = socket(cx, cy);
            const nearest =
                orbit?.eyeCenter != null
                    ? MathUtils.lerp(
                          atPupil - recess,
                          socketCenter + dome * 0.59,
                          0.46
                      )
                    : atPupil - recess;
            const back =
                orbit?.eyeCenter != null && orbit.eyeSpan
                    ? orbit.eyeCenter - orbit.eyeSpan / 2
                    : socket(irisX, pupilY) - pupilRadius;
            const centerZ =
                orbit?.pupilDepth != null && orbit.eyeSpan
                    ? clamp(
                          orbit.pupilDepth,
                          back,
                          sideRows
                              ? profileAt(pupilY).front
                              : orbit.eyeCenter + orbit.eyeSpan / 2
                      )
                    : sideRows
                    ? cornea(irisX, pupilY, Math.min(1, pupilT)) +
                      pupilRadius * classicPupilOffset
                    : clamp(
                          socketCenter + dome * 0.58,
                          Math.min(back, nearest),
                          nearest
                      );
            let at: XY = [irisX, centerZ];
            if (sections) {
                const next = sections.findIndex((row) => row[0][1] >= pupilY);
                const hi = next < 0 ? sections.length - 1 : Math.max(1, next);
                const a = sections[hi - 1],
                    b = sections[hi];
                const t = clamp(
                    (pupilY - a[0][1]) / Math.max(0.01, b[0][1] - a[0][1]),
                    0,
                    1
                );
                const rim = a.map(
                    ([x, , z], i): XY => [
                        MathUtils.lerp(x, b[i][0], t),
                        MathUtils.lerp(z, b[i][2], t),
                    ]
                );
                at = inferDepth
                    ? seatFrontalPupil(rim, at, pupilRadius)
                    : seatPupil(rim, at, pupilRadius * 0.25);
                if (e.observedGaze) {
                    const [yaw, fraction] = e.observedGaze;
                    const angle = MathUtils.degToRad(yaw),
                        c = Math.cos(angle),
                        s = Math.sin(angle);
                    const limits = sections.flatMap((row) =>
                        row.map(([x, , z]) => c * x + s * z)
                    );
                    const target = MathUtils.lerp(
                        Math.min(...limits),
                        Math.max(...limits),
                        clamp(fraction + e.gaze * 0.5, 0, 1)
                    );
                    const depths = rim.map((p) => p[1]);
                    const back = Math.min(...depths),
                        front = Math.max(...depths);
                    // The painter's white begins inside the inked rim. Reserve
                    // enough side clearance for a full pupil, then recover its
                    // horizontal position from the actual portrait camera.
                    const clearance = Math.min(
                        (front - back) * 0.45,
                        pupilRadius * 2.25 + (e.rimInk?.width ?? 0)
                    );
                    const z = clamp(at[1], back + clearance, front - clearance);
                    at = seatPupil(
                        rim,
                        [(target - s * z) / c, z],
                        pupilRadius * 1.45
                    );
                }
                if (e.turnedPupil != null) {
                    const angle = MathUtils.degToRad(35);
                    const project = ([x, z]: XY) =>
                        x * Math.cos(angle) + z * Math.sin(angle);
                    const ordered = [...rim].sort(
                        (a, b) => project(a) - project(b)
                    );
                    const left = ordered[0],
                        right = ordered.at(-1);
                    const target = MathUtils.lerp(
                        project(left),
                        project(right),
                        e.turnedPupil
                    );
                    const start = project(at);
                    const end = target > start ? right : left;
                    const t =
                        project(end) === start
                            ? 0
                            : clamp(
                                  (target - start) / (project(end) - start),
                                  0,
                                  1
                              );
                    d.s.pupilShift = [
                        ((end[0] - at[0]) * t) / pupilRadius,
                        0,
                        ((end[1] - at[1]) * t) / pupilRadius,
                    ];
                }
            }
            const offset = (x: number, y: number, z: number): Point => [
                (x - at[0]) / pupilRadius,
                (y - pupilY) / pupilHeight,
                (z - at[1]) / pupilRadius,
            ];
            // Store the unit offset and its length in the existing normal and UV.
            // Skinning then rotates the internal pupil with its own head in a crowd.
            d.s.surfaceNormal = offset;
            // The vertex paint holds four horizontal coordinates on the same
            // globe. The fractional V coordinate is latitude. Its integer
            // carries RGB444 ink and stroke width as a fraction of eye height.
            let inkCode = 0;
            const scanline = scanInk && sections && eyeScanlines(sections);
            if (scanline) {
                const dye = new Color(e.rimInk.color);
                const nibble = (v: number) => Math.round(15 * Math.sqrt(v));
                const weight = Math.round(
                    512 * clamp(e.rimInk.width / (bottom - top), 0.004, 0.125)
                );
                inkCode =
                    2 +
                    4096 * weight +
                    256 * nibble(dye.r) +
                    16 * nibble(dye.g) +
                    nibble(dye.b);
            }
            const rimScale = e.rimInk
                ? clamp((rx * 0.052) / e.rimInk.width, 0.4, 2.5)
                : 1;
            d.s.eyeSample = (x, y, z) => {
                const along =
                    insetPupilUVBase -
                    pupilUVBase +
                    Math.hypot(...offset(x, y, z));
                if (scanline) {
                    const [height, front, left, right, side] = scanline(
                        x,
                        y,
                        z
                    );
                    return [along, inkCode + height, left, right, side, front];
                }
                const elevation = clamp((z - socket(x, y)) / dome, 0, 1);
                const rimDistance = sideRows
                    ? clearances.get(vertexKey(x, y)) ?? 0
                    : 1 - Math.sqrt(1 - elevation * elevation);
                const light = clamp(
                    0.55 -
                        (0.22 * (x - cx)) / rx -
                        (0.32 * (y - cy)) / ry +
                        0.22 * elevation,
                    0,
                    1
                );
                return [along, light, 1, 0.5 + 0.5 * rimDistance * rimScale];
            };
        } else {
            const irisSlope =
                socket(pupilX + 0.5, pupilY) -
                socket(pupilX - 0.5, pupilY) -
                (2 * dome * (pupilX - cx)) / (rx * rx);
            const irisScale = clamp(Math.hypot(1, irisSlope), 1, 3);
            d.s.eyeSample = (x, y, z) => {
                const t = Math.sqrt(clamp(1 - (z - socket(x, y)) / dome, 0, 1));
                return [
                    ((x - pupilX) * irisScale) / pupilRadius,
                    (y - pupilY) / pupilHeight,
                    1,
                    0.25 + 0.75 * (1 - t),
                ];
            };
        }
        const globe =
            sections ??
            (e.globeDepth
                ? [outer, ring(0.96), ring(0.81), ring(0.52), ring(0)]
                : [outer, ring(0.82), ring(0.52), ring(0)]);
        d.s.cornealSurface = !!(sections && e.globeDepth);
        d.s.surface(globe, white, true, "perimeter");
        d.s.cornealSurface = false;
        d.s.pupilShift = undefined;

        d.s.eyeSample = undefined;
        d.s.surfaceNormal = undefined;
        // Flesh between the rim and temple closes the socket in profile.
        const seat = outer.map(([x, y, z]): Point => {
            const dx = x - cx,
                dy = y - cy;
            if (e.closedSocket) {
                const ox = x - dx * 0.08,
                    oy = y - dy * 0.08;
                return [ox, oy, Math.min(z - 0.4, face(ox, oy) - rx * 0.14)];
            }
            const roll = sideRows
                ? clamp((z - face(x, y)) / (rx * 1.8), 0, 0.28)
                : 0;
            // The temporal wall narrows into the skull behind the globe.
            // An outward flare here projects across the hair like a second lobe.
            const temporal = sideRows
                ? MathUtils.smoothstep((e.side * dx) / rx, 0.12, 0.91)
                : 0;
            const sx = dx * (0.08 + roll * 0.25 - temporal * 0.84);
            const sy = dy * (0.08 + roll * (dy > 0 ? 1 : 0.35));
            const ox = x + sx,
                oy = y + sy;
            const contact = face(ox, oy) - rx * 0.035;
            return [ox, oy, contact];
        });
        const inked = d.s.inkedPortrait;
        if (e.closedSocket) {
            d.s.inkedPortrait = false;
            d.s.surfaceNormal = (x, y) => [
                face(x - 0.4, y) - face(x + 0.4, y),
                face(x, y - 0.4) - face(x, y + 0.4),
                0.8,
            ];
        }
        let socketEdge = outer;
        if (e.outerRim && e.rimInk) {
            // The detected white ends at the inner edge of the ink. Sew the
            // measured stroke onto the socket so it stays seated in profile.
            const width = e.rimInk.width;
            socketEdge = outer.map(([x, y, z]): Point => {
                const ox = x + ((x - cx) * width) / rx;
                const oy = y + ((y - cy) * width) / ry;
                return [ox, oy, Math.max(face(ox, oy) + 0.4, z - width * 0.55)];
            });
            d.s.surface([outer, socketEdge], e.rimInk.color, true, "perimeter");
        }
        d.s.surface([socketEdge, seat], e.skin, true, "perimeter");
        d.s.inkedPortrait = inked;
        d.s.surfaceNormal = undefined;
        if (e.lid) {
            const sorted = outer
                .map(([x, y]): XY => [x, y])
                .sort((a, b) => a[0] - b[0]);
            const lo = sorted[0],
                hi = sorted.at(-1);
            const fold = [
                lo,
                ...e.lid.filter((p) => p[0] > lo[0] && p[0] < hi[0]),
                hi,
            ];
            const profile = curve(fold, false, false);
            // The temporal rim turns steeply in depth. Sample the actual
            // white boundary when sewing the lid, including its depth at
            // each rim corner. Re-evaluating the dome at interpolated x/y
            // lets the upper lid cut diagonally through the white on a turn.
            const boundaryAt = (x: number): Point => {
                let upper: Point;
                for (let i = 1; i < outer.length; i++) {
                    const a = outer[i - 1],
                        b = outer[i];
                    if (x < Math.min(a[0], b[0]) || x > Math.max(a[0], b[0]))
                        continue;
                    const t =
                        b[0] === a[0]
                            ? Number(b[1] < a[1])
                            : (x - a[0]) / (b[0] - a[0]);
                    const y = MathUtils.lerp(a[1], b[1], t),
                        z = MathUtils.lerp(a[2], b[2], t);
                    if (
                        !upper ||
                        y < upper[1] ||
                        (y === upper[1] && z > upper[2])
                    )
                        upper = [x, y, z];
                }
                return upper;
            };
            const xs = new Set(profile.map(([x]) => clamp(x, lo[0], hi[0])));
            for (const [x, y] of outer) {
                if (Math.abs(boundaryAt(x)[1] - y) < 0.001) xs.add(x);
            }
            const crestAt = (x: number) => {
                const i = profile.findIndex((p) => p[0] >= x);
                if (i <= 0) return profile[i < 0 ? profile.length - 1 : 0][1];
                const [ax, ay] = profile[i - 1],
                    [bx, by] = profile[i];
                return MathUtils.lerp(
                    ay,
                    by,
                    (x - ax) / Math.max(0.001, bx - ax)
                );
            };
            const crown: Point[] = [];
            const rows = [...xs]
                .sort((a, b) => a - b)
                .map((x) => {
                    const [, rim, rimZ] = boundaryAt(x);
                    const top = Math.min(crestAt(x), rim);
                    const across = clamp(
                        (x - lo[0]) / Math.max(0.01, hi[0] - lo[0]),
                        0,
                        1
                    );
                    const sagittal = orbit?.lidSpan;
                    const crest = Math.max(
                        face(x, top) + 0.93,
                        sagittal
                            ? MathUtils.lerp(
                                  sagittal[0],
                                  sagittal[1],
                                  e.side < 0 ? across : 1 - across
                              )
                            : -Infinity
                    );
                    const cols = [0, 0.44, 1].map((t) => {
                        const py = MathUtils.lerp(top, rim, t);
                        const z =
                            MathUtils.lerp(crest, rimZ, t) +
                            0.18 * (rim - top) * Math.sin(Math.PI * t);
                        return [x, py, z] as Point;
                    });
                    crown.push(cols[0]);
                    return cols;
                });
            d.s.surface(rows, e.skin, true, undefined, 0.2);
            if (orbit?.lidSpan) {
                // The visible crease is ink on the rolled lid. A narrow strip
                // sharing its slope stays seated as the cornea turns in profile.
                const crease = rows.map(([crest, mid]): Point[] => {
                    const dy = mid[1] - crest[1],
                        dz = mid[2] - crest[2];
                    const u = Math.min(
                        1,
                        (rx * 0.08) / Math.max(0.01, Math.hypot(dy, dz))
                    );
                    return [
                        [crest[0], crest[1], crest[2] + 0.42],
                        [mid[0], crest[1] + dy * u, crest[2] + dz * u + 0.42],
                    ];
                });
                d.s.surface(crease, "#30231f", true, undefined, 0.16);
            } else {
                const foldInk = crown.map(
                    ([x, y, z]): Point => [x, y, z + 0.42]
                );
                d.s.ribbon(foldInk, rx * 0.037, "#30231f");
            }
        }
        // A thin painted margin joins the sclera to the lid and temple.
        // It keeps a consistent stroke at three-quarter angles and at a
        // distance where a grazing-normal silhouette alone disappears.
        if (!(sections && e.rimInk && e.globeDepth)) {
            const width = e.rimInk?.width;
            const margin = outer.map(([x, y, z]): [Point, Point] => {
                const ox = x + (x - cx) * (width ? width / rx : 0.059);
                const oy = y + (y - cy) * (width ? width / ry : 0.062);
                return [
                    [x, y, z + 0.24],
                    [ox, oy, Math.max(face(ox, oy) + 0.49, z - 0.08)],
                ];
            });
            d.s.surface(
                margin,
                e.rimInk?.color ?? "#30231f",
                true,
                undefined,
                0.15
            );
        }
    } else {
        for (const front of [true, false]) {
            const segments = front ? divisions : crowd ? 8 : 10;
            const rings = Array.from({ length: segments + 1 }, (_, i) => {
                const longitude =
                    (front ? -halfPi : halfPi) + (Math.PI * i) / segments;
                return {
                    longitude,
                    top: eyelidLatitude(longitude, true),
                    bottom: eyelidLatitude(longitude, false),
                };
            });
            const strip = (
                part: "white" | "upper" | "lower",
                steps: number,
                paint: string
            ) => {
                const upper = part === "upper",
                    lid = part !== "white";
                if (
                    lid &&
                    !rings.some((r) =>
                        upper
                            ? r.top > -halfPi + 0.005
                            : r.bottom < halfPi - 0.005
                    )
                )
                    return;
                const rows = Array.from({ length: steps + 1 }, (_, i) =>
                    rings.map((r) => {
                        const t = i / steps;
                        const start = part === "lower" ? r.bottom : r.top;
                        const end = upper ? -halfPi : lid ? halfPi : r.bottom;
                        const point = position(
                            r.longitude,
                            MathUtils.lerp(start, end, t)
                        );
                        if (lid) {
                            const cheek = face(point[0], point[1]);
                            point[2] -=
                                Math.max(0, point[2] - cheek) *
                                0.42 *
                                MathUtils.smoothstep(t, 0, 1);
                        }
                        return point;
                    })
                );
                d.s.surface(rows, paint, true, "perimeter");
            };
            d.s.surfaceNormal = normal;
            d.s.eyeSample = whiteSurface(front);
            strip("white", crowd ? 7 : 11, white);
            d.s.eyeSample = undefined;

            // The short arc above a relaxed or wide eye takes fewer cuts
            // than the broad upper lid of a half-closed eye.
            const capSteps = sleepy ? (crowd ? 2 : 4) : crowd ? 1 : 2;
            strip("upper", capSteps, e.skin);
            strip("lower", capSteps, e.skin);
        }
    }
    d.s.surfaceNormal = undefined;
    if (e.lashes) {
        const roots = contour
            ? tracedLashes
            : [0.32, 0.6, 0.82].map((u) => {
                  const a = e.side * Math.asin(u);
                  return position(a, eyelidLatitude(a, true));
              });
        for (const [x, y, z] of roots) {
            d.s.ribbon(
                [
                    [x, y, z + rx * 0.012],
                    [
                        x + e.side * rx * (contour ? 0.19 : 0.08),
                        y - ry * 0.075,
                        z + rx * 0.035,
                    ],
                    [
                        x + e.side * rx * (contour ? 0.35 : 0.17),
                        y - ry * 0.225,
                        z + rx * 0.025,
                    ],
                ],
                rx * 0.032,
                ink
            );
        }
    }
    d.s.occluded = oldOcclusion;
    d.s.eyes = false;
}

/** A tapered brow follows the forehead through the same expression as the lid. */
export function drawCartoonBrow(
    d: Drawing,
    face: Depth,
    path: XY[],
    width: number,
    paint: string
) {
    const points = curve(path, false, false);
    const rows = points.map(([x, y], i) => {
        const prev = points[Math.max(0, i - 1)],
            next = points[Math.min(points.length - 1, i + 1)];
        const dx = next[0] - prev[0],
            dy = next[1] - prev[1],
            length = Math.max(0.01, Math.hypot(dx, dy));
        const t = i / (points.length - 1),
            r = width * (0.23 + 0.77 * Math.sin(t * Math.PI) ** 0.42);
        return [-1, 1].map((side) => {
            const bx = x - (side * r * dy) / length,
                by = y + (side * r * dx) / length;
            return [bx, by, face(bx, by) + 0.95] as Point;
        });
    });
    d.s.surface(rows, paint, true, undefined, width * 0.19);
}
