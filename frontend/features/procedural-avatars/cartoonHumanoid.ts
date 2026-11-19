import { drawMarkedShirt } from "./shirtMark";
import * as T from "three/webgpu";
import {
    Drawing,
    curve,
    headDepth,
    frontOfLoft,
    profileDepth,
    sectionPoint,
    type Section,
    type XY,
    type Depth,
} from "./drawing";
import {
    fittedArmX,
    proportions,
    type CartoonDesign,
    type Seam,
} from "./cartoonCast";
import portraits from "./cartoon-portraits.json";
import { drawHead, drawRadialCrown } from "./heads";
import {
    headSections,
    drawBobHead,
    fittedOrbits,
    scaleEyeDepth,
    sideAt,
    bobDepth,
    bobTangent,
    partedTemple,
    fittedNose,
    fitBobDepth,
    hairBehindEars,
    fittedEar,
    turnBobLocks,
    fitBobBack,
    turnCrown,
} from "./fittedHead";
import { drawCartoonBrow, drawCartoonEye } from "./cartoonEye";
import {
    fitPartDepth,
    drawFittedHand,
    classicEyeDepthRatio,
} from "./humanoidParts";
import { trouserLeg, trouserShin } from "./shapeRecipe";
import { cranialDepth, cranialStations, cranialSurfaces } from "./cranialBase";
import { drawHouseholdHead } from "./householdHead";
import { turnContours } from "./turnContours";
import { coatShirtSection, drawOpenCoat } from "./openCoat";
import { avatarStyles } from "./styles";
import type { Point } from "./sculpt";
import { finish } from "./surfaces";
import {
    crownStations,
    drawMeasuredForelock,
    partBob,
    partStations,
    sweptForelock,
} from "./partedBob";
import { drawFittedSmile, drawNoseCrease } from "./skinCrease";

const ink = "#443830",
    ivory = "#fff9e9";
const between = (a: Point, b: Point, t: number): Point =>
    a.map((v, i) => T.MathUtils.lerp(v, b[i], t)) as Point;
const swatch = (s: string, target: string, t: number) =>
    "#" + new T.Color(s).lerp(new T.Color(target), t).getHexString();
const loop = (n: number, fn: (angle: number) => Point) =>
    Array.from({ length: n + 1 }, (_, i) => fn(((i % n) * 2 * Math.PI) / n));
function scalp(
    d: Drawing,
    g: CartoonDesign,
    sections: Section[],
    face: Depth,
    skullBack?: Depth
) {
    const [w, h] = g.head,
        cut = g.hair.cut,
        paint = g.hair.color;
    const y0 = sections[0][0];
    const capProfile = g.fit?.sections?.hair;
    const spikedCrown = g.fit?.sections?.radialCrown;
    if (cut === "spikes" && spikedCrown) {
        drawRadialCrown(d, spikedCrown, sections, paint);
        return;
    }
    if (capProfile) {
        const bob = g.fit?.sections?.nape;
        const ears =
            g.fit?.sections?.sideGuide?.ear && g.fit.sections.ears?.length
                ? [-1, 1].map((s) => fittedEar(g, s))
                : undefined;
        const cheekKnots = ears
            ? [1 / 6, 2 / 6, 3 / 6, 4 / 6, 5 / 6]
            : [0.25, 0.5, 0.75];
        const depthAt = skullBack ? face : profileDepth(sections, 1, true),
            rearAt = skullBack ?? profileDepth(sections, -1, true);
        const ring = (
            row: [number, number, number, number, number],
            inner: boolean
        ): Point[] => {
            const [y, left, right, openLeft, openRight] = row,
                mid = (left + right) * 0.5,
                r = Math.max(0.35, (right - left) * 0.5);
            const norm = (x: number) => T.MathUtils.clamp((x - mid) / r, -1, 1);
            const first = Math.asin(norm(openRight)),
                last = Math.PI * 2 + Math.asin(norm(openLeft));
            const angles = [
                first,
                ...Array.from(
                    { length: 13 },
                    (_, i) => Math.PI * 0.5 + (i * Math.PI) / 12
                ),
                last,
            ];
            // Distribute knots along both cheeks as well as the rear hemisphere.
            angles.splice(
                1,
                0,
                ...cheekKnots.map((t) =>
                    T.MathUtils.lerp(first, Math.PI * 0.5, t)
                )
            );
            angles.splice(
                -1,
                0,
                ...cheekKnots.map((t) =>
                    T.MathUtils.lerp(Math.PI * 1.5, last, t)
                )
            );
            if (bob) {
                // The frontal drawing gives x/y along each lock. Its leading
                // edge runs from the fringe, past the temple, behind the jaw.
                // Keeping that whole edge on a forward ellipse forms a hood.
                const t =
                    (y - capProfile[0][0]) /
                    (capProfile.at(-1)[0] - capProfile[0][0]);
                const dome = Math.sqrt(1 - Math.max(0, 1 - t / 0.51) ** 2);
                const atTemple = T.MathUtils.smoothstep(t, 0.25, 0.59);
                const fall = T.MathUtils.smoothstep(t, 0.57, 1);
                const guide = sideAt(g, y);
                const temple = guide && partedTemple(g, y, guide);
                const tangent = guide && bobTangent(g, y, guide);
                const xl = sectionPoint(sections, -Math.PI / 2, y)[0];
                const xr = sectionPoint(sections, Math.PI / 2, y)[0];
                const center = guide
                    ? (guide[1] + guide[2]) / 2
                    : w * (0.12 - 0.25 * atTemple);
                const rear = guide
                    ? center - guide[1]
                    : w * dome * (0.64 - 0.19 * fall);
                const front = w * dome * 0.59;
                return angles.map((a) => {
                    const sn = Math.sin(a),
                        c = Math.cos(a);
                    const x = mid + r * sn;
                    let z = center + c * (c < 0 ? rear : front);
                    if (c > 0) {
                        const vault = Math.max(z, depthAt(x, y) + 2.5);
                        const cheek = center + w * (0.25 - 0.16 * fall) * c;
                        z = T.MathUtils.lerp(vault, cheek, atTemple);
                        // The fringe overlaps the forehead. Its broad upper
                        // surface must clear even an asymmetric, forward temple.
                        const clear =
                            (1 -
                                T.MathUtils.smoothstep(
                                    t,
                                    guide ? 0.12 : 0.27,
                                    guide ? 0.36 : 0.52
                                )) *
                            T.MathUtils.smoothstep(c, 0, 0.21) *
                            T.MathUtils.smoothstep(
                                Math.min(x - xl, xr - x),
                                -4,
                                1
                            );
                        z = T.MathUtils.lerp(
                            z,
                            Math.max(z, depthAt(x, y) + 4.2),
                            clear
                        );
                    }
                    if (guide)
                        z = bobDepth(a, first, last, guide, temple, tangent);
                    const lock =
                        Math.sin(5 * a + 0.8 * t) * Math.sin(a * 2) ** 2 * fall;
                    z += w * 0.024 * lock;
                    const shrink = inner ? 0.92 : 1;
                    let across = mid + r * sn * shrink;
                    let along = center + (z - center) * shrink;
                    const ear = ears?.[across < 0 ? 0 : 1];
                    if (ear) {
                        if (
                            g.fit.sections.sideGuide.inferred &&
                            g.fit.sections.ears.length === 2
                        ) {
                            // Hair visible outside an exposed lobe in the front
                            // drawing passes behind it. Preserve its traced width.
                            const overEar = T.MathUtils.smoothstep(
                                Math.abs(across) - ear.root,
                                -ear.rx,
                                ear.reach
                            );
                            const level = Math.abs((y - ear.y) / ear.ry);
                            const tuck =
                                overEar *
                                (1 - T.MathUtils.smoothstep(level, 0.75, 1.8));
                            along = T.MathUtils.lerp(
                                along,
                                Math.min(along, ear.z - ear.depth),
                                tuck
                            );
                            return [across, y, along];
                        }
                        // Tuck both hair surfaces beneath the rounded outer ear.
                        const radius = Math.hypot(
                            (y - ear.y) / ear.ry,
                            (along - ear.z) / ear.depth
                        );
                        const pinna =
                            ear.root +
                            ear.reach *
                                Math.sqrt(Math.max(0, 1 - radius * radius));
                        const inset = Math.min(
                            Math.abs(across),
                            pinna - ear.rx * 0.4
                        );
                        // A coarse hair triangle can bridge the back of the ear
                        // even when its vertices are clear. Tuck its neighbours
                        // behind the lobe, retaining the lock at the forward root.
                        const rear = T.MathUtils.smoothstep(
                            (ear.z - along) / ear.depth,
                            -0.25,
                            0.65
                        );
                        across =
                            Math.sign(across) *
                            T.MathUtils.lerp(
                                inset,
                                Math.abs(across),
                                T.MathUtils.smoothstep(
                                    radius,
                                    0.92 + 0.24 * rear,
                                    1.32 + 0.37 * rear
                                )
                            );
                    }
                    return [across, y, along];
                });
            }
            // Fit a continuous elliptical arc to the front and rear extents of
            // the skull. Projecting every strand onto its face produces grooves
            // above the brow and lets the forehead cut through the fringe.
            let frontRadius = Math.min(r * 0.53, w * 0.24),
                rearRadius = Math.min(r * 0.82, w * 0.59);
            for (const a of angles) {
                const c = Math.cos(a),
                    x = mid + r * Math.sin(a);
                if (c > 0.2)
                    frontRadius = Math.max(
                        frontRadius,
                        (depthAt(x, y) + 3.8) / c
                    );
                if (c < -0.2)
                    rearRadius = Math.max(rearRadius, (rearAt(x, y) - 3.8) / c);
            }
            // A short lock can be nearly tangent to the face. Dividing its
            // depth by that tangent must not stretch the entire cross-section.
            // A tuft above the crown has its own narrow cross-section.
            // Only the skull beneath that slice can require additional depth.
            const scalpFront = Math.max(0, depthAt(mid, y));
            const scalpRear = Math.max(0, -rearAt(mid, y));
            frontRadius = Math.min(
                frontRadius,
                w * 0.53 + 4,
                Math.max(r * 0.84, scalpFront) + 3.8
            );
            rearRadius = Math.min(
                rearRadius,
                w * 0.67 + 4,
                Math.max(r, scalpRear) + 3.8
            );
            const round = inner ? 0.91 : 1;
            return angles.map((a) => {
                const c = Math.cos(a),
                    sn = Math.sin(a);
                const flow =
                    1 +
                    0.027 *
                        Math.sin(5 * a + (y / h) * 2.3) *
                        T.MathUtils.smoothstep(y / h, 0.25, 0.79);
                const ends = T.MathUtils.smoothstep(
                    y,
                    capProfile.at(-1)[0] - h * 0.23,
                    capProfile.at(-1)[0]
                );
                const napeLift =
                    ends *
                    h *
                    ((cut === "bob" ? 0.025 : 0.075) * Math.max(0, -c) +
                        (cut === "bob" ? 0.005 : 0.025) *
                            (1 - Math.cos(a * 6)));
                const side = inner && c > 0 ? 1 + 0.035 * c : round;
                const x = mid + r * sn;
                let z = (c >= 0 ? frontRadius : rearRadius) * c * flow;
                const blend = T.MathUtils.smoothstep(Math.abs(c), 0.03, 0.28);
                z = T.MathUtils.lerp(
                    z,
                    c >= 0
                        ? Math.max(z, depthAt(x, y) + 2.8)
                        : Math.min(z, rearAt(x, y) - 2.8),
                    blend
                );
                return [mid + r * sn * side, y - napeLift, z * round];
            });
        };
        const crown = g.fit?.sections?.crown;
        const fittedCrown =
            crown && crown.base < capProfile.length - 1 ? crown : undefined;
        const part = bob && !fittedCrown ? g.fit.sections.sidePart : undefined;
        const sideProfile = fittedCrown
            ? capProfile.slice(fittedCrown.base)
            : part
            ? crownStations(partStations(capProfile, part))
            : capProfile;
        const outer = sideProfile.map((r) => ring(r, false)),
            inside = sideProfile.map((r) => ring(r, true));
        if (bob) turnCrown(g, outer, inside);
        const partTone =
            part &&
            partBob(sideProfile, outer, inside, part, 1 + cheekKnots.length, w);
        // Round the last strip over the nape. Its two hems follow the actual
        // visible locks, dipped in front and shorter behind the neck.
        if (bob) {
            const end = sideProfile.at(-1)[0];
            for (const sheet of [outer, inside])
                sheet.forEach((row, index) => {
                    const weight = T.MathUtils.smoothstep(
                        sideProfile[index][0],
                        end - h * 0.21,
                        end
                    );
                    if (!weight) return;
                    for (const [column, p] of row.entries()) {
                        const j = bob.findIndex((r) => r[0] >= p[0]);
                        const i = j < 0 ? bob.length - 1 : Math.max(1, j);
                        const a = bob[i - 1],
                            b = bob[i];
                        const hem = T.MathUtils.lerp(
                            a[1],
                            b[1],
                            T.MathUtils.clamp(
                                (p[0] - a[0]) / (b[0] - a[0]),
                                0,
                                1
                            )
                        );
                        const rear = T.MathUtils.smoothstep(
                            -p[2],
                            w * 0.04,
                            w * 0.67
                        );
                        const profile = g.fit.sections.sideGuide?.hem;
                        let sideHem = end;
                        if (profile) {
                            const k = profile.findIndex((v) => v[0] >= p[2]);
                            const j =
                                k < 0 ? profile.length - 1 : Math.max(1, k);
                            const a = profile[j - 1],
                                b = profile[j];
                            sideHem = T.MathUtils.lerp(
                                a[1],
                                b[1],
                                T.MathUtils.clamp(
                                    (p[2] - a[0]) / (b[0] - a[0]),
                                    0,
                                    1
                                )
                            );
                        }
                        // The three tangent meridians already contain the measured
                        // back and side silhouettes at this height. Drape the
                        // material between them without lifting those points twice.
                        const flank = 1 + cheekKnots.length;
                        const rearColumn = flank + 6;
                        const tangentDistance = Math.min(
                            Math.abs(column - flank),
                            Math.abs(column - rearColumn),
                            Math.abs(column - (row.length - 1 - flank))
                        );
                        const between = profile
                            ? T.MathUtils.smoothstep(tangentDistance, 0, 2)
                            : 1;
                        p[1] +=
                            between *
                            weight *
                            (T.MathUtils.lerp(hem, sideHem, rear) - end);
                    }
                });
        }
        if (bob) {
            turnBobLocks(g, outer, inside);
            fitBobBack(g, outer, inside);
        }
        const tone = d.s.tone;
        d.s.tone = (x, y, z) => {
            const a = Math.atan2(x, z),
                sweep = a * 7.5 + (y / h) * 1.8;
            return (
                (0.98 +
                    0.047 * Math.cos(sweep) -
                    0.13 * T.MathUtils.smoothstep(y / h, 0.8, 1.08)) *
                (partTone?.(x, y, z) ?? 1)
            );
        };
        const top = outer[0];
        let hairShell: Point[][];
        if (fittedCrown) {
            const [seam, left, right] = sideProfile[0];
            const profile = fittedCrown.rim;
            const columns = Array.from(
                new Set([
                    ...top.map((p) => p[0]),
                    ...profile.map((p) => T.MathUtils.clamp(p[0], left, right)),
                ])
            ).sort((a, b) => a - b);
            const sections = columns.map((x) => {
                const depths: number[] = [];
                for (let i = 1; i < top.length; i++) {
                    const [ax, , az] = top[i - 1],
                        [bx, , bz] = top[i];
                    if (Math.abs(ax - x) < 1e-5) depths.push(az);
                    if (Math.abs(bx - x) < 1e-5) depths.push(bz);
                    if ((ax < x && x < bx) || (bx < x && x < ax))
                        depths.push(
                            T.MathUtils.lerp(az, bz, (x - ax) / (bx - ax))
                        );
                }
                const next = profile.findIndex(([px]) => px >= x);
                let crest = seam;
                if (next > 0) {
                    const [ax, ay] = profile[next - 1],
                        [bx, by] = profile[next];
                    crest = Math.min(
                        seam,
                        T.MathUtils.lerp(ay, by, (x - ax) / (bx - ax))
                    );
                }
                return {
                    x,
                    crest,
                    front: depths.length ? Math.max(...depths) : 0,
                    back: depths.length ? Math.min(...depths) : 0,
                };
            });
            const bands = d.s.detail === "crowd" ? 3 : 4;
            const dome = Array.from({ length: bands + 1 }, (_, i) =>
                sections.map(({ x, crest, front, back }): Point => {
                    const arc = (Math.PI * i) / bands;
                    return [
                        x,
                        T.MathUtils.lerp(seam, crest, Math.sin(arc)),
                        T.MathUtils.lerp(
                            back,
                            front,
                            (1 + Math.cos(arc)) * 0.5
                        ),
                    ];
                })
            );
            d.s.surface(dome, paint, true, "both");
            hairShell = d.s.surface(outer, paint, true, "start");
        } else {
            const peak: Point = [
                (capProfile[0][1] + capProfile[0][2]) / 2,
                capProfile[0][0] - 1.8,
                0,
            ];
            if (bob) d.s.preserveVertex = turnContours(outer, w * 0.0048);
            hairShell = d.s.surface(
                [top.map(() => peak), ...outer],
                paint,
                true,
                undefined,
                bob ? 0.49 : undefined
            );
            d.s.preserveVertex = undefined;
        }
        const temple = g.fit?.sections?.sideGuide?.templeEdge;
        if ((part || g.fit.sections.foreheadLock) && temple?.roll) {
            const side = g.fit.sections.sideGuide.forelockSide ?? temple.side;
            drawMeasuredForelock(
                d,
                temple.roll,
                side,
                sideProfile,
                w,
                h,
                capProfile[0][0],
                g.face?.eyeHeight ?? 0.5,
                (y) => sideAt(g, y)[3],
                face,
                paint,
                g.skin,
                Boolean(part) && side === temple.side
            );
        } else if (part && g.fit.sections.sideGuide) {
            const lock = sweptForelock(
                sideProfile,
                outer,
                part,
                g.head,
                g.face?.eyeHeight ?? 0.5,
                g.fit.sections.sideGuide.turnedCrown
                    ? "turned"
                    : g.fit.sections.eyes?.some((eye) => eye.browOccluded)
                    ? "covered-brow"
                    : "front",
                g.hair.fringeDepthScale ?? 1,
                face
            );
            if (lock) d.s.surface(lock, paint, true);
        }
        d.s.tone = () => 0.82;
        // The material shades both sides. The scalp already backs the outer
        // sheet; only the fringe, hem and their returns are exposed.

        for (const j of [0, outer[0].length - 1]) {
            const returnStrip = outer.map((row, i) => {
                const root = row[j],
                    inner = inside[i][j];
                if (
                    !bob ||
                    !g.fit?.sections?.sideGuide ||
                    root[1] > 12 + h * 0.6
                )
                    return [root, inner];
                // Roll the fringe onto the skin. The hidden return closes
                // the front seam even when retopology moves the inner scalp.
                const x = root[0] + (j === 0 ? -1 : 1) * 0.72;
                return [
                    root,
                    [
                        x,
                        root[1] + 0.35,
                        Math.min(root[2], face(x, root[1] + 0.35)) - 0.55,
                    ] as Point,
                ];
            });
            d.s.surface(returnStrip, paint, true);
        }
        for (const i of bob ? [outer.length - 1] : [0, outer.length - 1])
            d.s.surface(
                [
                    outer[i],
                    inside[i],
                    inside[i].map(
                        ([x, y, z]): Point => [
                            x * 0.86,
                            y + (i === 0 ? -1.3 : 1.3),
                            z * 0.7,
                        ]
                    ),
                ],
                paint,
                true
            );
        if (bob && !g.fit.sections.sideGuide) {
            const seam = sideProfile.findIndex((r) => r[4] - r[3] > w * 0.025);
            if (seam >= 0) {
                for (const j of [0, outer[0].length - 1]) {
                    const path = outer.slice(seam).map((r) => r[j]);
                    d.s.line(path, 0.61, swatch(paint, "#101418", 0.75));
                }
            }
        }
        const lock = g.fit.sections.foreheadLock;
        if (lock) {
            const surface = frontOfLoft(hairShell);
            const rows = lock.map(([y, left, right]) => {
                const mid = (left + right) / 2,
                    radius = (right - left) / 2;
                return loop(8, (a) => {
                    const x = mid + Math.sin(a) * radius;
                    const skin = face(x, y);
                    const base = Math.max(skin + 0.45, surface(x, y) - 0.7);
                    return [
                        x,
                        y,
                        base + Math.cos(a) * Math.max(0.7, radius * 0.59),
                    ];
                });
            });
            const cap = (ring: Point[], lift: number) => {
                const front = ring[0],
                    back = ring[4];
                const pole: Point = [
                    front[0],
                    front[1] + lift,
                    (front[2] + back[2]) / 2,
                ];
                return ring.map(() => pole);
            };
            d.s.surface(
                [cap(rows[0], -0.4), ...rows, cap(rows.at(-1), 0.4)],
                paint,
                true,
                "perimeter",
                0.2
            );
        }
        const strands = g.fit?.sections?.locks;
        if (strands?.length) {
            // A ray in drawing space attaches the line to whichever curved
            // lock is foremost, even where several strands overlap.
            const surface = frontOfLoft(hairShell);
            for (const stroke of strands) {
                const points = curve(stroke, false, false)
                    .map(([x, y]): Point => [x, y, surface(x, y) + 0.76])
                    .filter((p) => Number.isFinite(p[2]));
                if (points.length >= 2)
                    d.s.ribbon(points, 0.6, swatch(paint, "#0b1214", 0.83));
            }
        }
        const sideLocks = g.fit?.sections?.sideGuide?.locks;
        if (sideLocks?.length)
            for (const side of [-1, 1]) {
                const flank = frontOfLoft(
                    hairShell.map((row) =>
                        row.map(([x, y, z]): Point => [z, y, side * x])
                    )
                );
                for (const stroke of sideLocks) {
                    const strip = stroke
                        .map(([z, y], i) => {
                            const r =
                                0.24 +
                                0.43 *
                                    Math.sin(
                                        (Math.PI * i) / (stroke.length - 1)
                                    );
                            return [-r, r].map(
                                (dz) =>
                                    [
                                        side * (flank(z + dz, y) + 0.8),
                                        y,
                                        z + dz,
                                    ] as Point
                            );
                        })
                        .filter((row) =>
                            row.every((p) => Number.isFinite(p[0]))
                        );
                    if (strip.length > 1)
                        d.s.surface(
                            strip,
                            swatch(paint, "#101517", 0.84),
                            true
                        );
                }
            }
        d.s.tone = tone;
        return;
    }
    const radial = (angle: number, t: number): Point => {
        const y = y0 + t * h;
        let i = 1;
        while (i < sections.length - 1 && sections[i][0] < y) i++;
        const l = sections[i - 1],
            r = sections[i],
            v = T.MathUtils.clamp((y - l[0]) / (r[0] - l[0]), 0, 1);
        const width = T.MathUtils.lerp(l[2], r[2], v),
            depth = T.MathUtils.lerp(l[3], r[3], v);
        const c = Math.cos(angle);
        return [
            (width + 3.1) * Math.sin(angle),
            y - 1.2,
            T.MathUtils.lerp(l[4] ?? 0, r[4] ?? 0, v) +
                (depth + 3.8) * headDepth(y, sections, c >= 0 ? 1 : -1, c * c),
        ];
    };
    const hem = (a: number) => {
        const front = Math.max(0, Math.cos(a)),
            side = Math.sin(a);
        const part = cut === "waves" || cut === "part" || cut === "quiff";
        let edge = 0.69 - 0.5 * Math.pow(front, 0.69);
        if (part)
            edge +=
                front *
                ((cut === "part" ? 0.033 : 0.068) * Math.sin(a * 2 + 0.7) +
                    0.028 * Math.sin(a * 3 - 0.5) -
                    (cut === "part" ? 0.06 : 0));
        if (cut === "bob")
            edge =
                0.81 - 0.52 * Math.pow(front, 0.43) + 0.027 * Math.cos(a * 7);
        if (cut === "curls")
            edge += 0.038 * Math.cos(11 * a + 0.42) + 0.012 * Math.cos(6 * a);
        if (cut === "crop")
            edge += 0.025 * Math.sin(5 * a) + 0.018 * Math.sin(8 * a);
        if (cut === "ponytail" || cut === "bun") edge += front * 0.07 * side;
        if (g.hairline && g.hairline.length >= 2 && Math.cos(a) >= 0) {
            const angle = Math.atan2(Math.sin(a), Math.cos(a));
            const u = (angle / Math.PI + 0.5) * (g.hairline.length - 1),
                i = Math.min(g.hairline.length - 2, Math.max(0, Math.floor(u)));
            edge = T.MathUtils.clamp(
                T.MathUtils.lerp(g.hairline[i], g.hairline[i + 1], u - i),
                0.03,
                0.95
            );
        }
        return edge;
    };
    if (cut === "bob" || cut === "waves") {
        // Bangs, temples and the shoulder-length fall share one surface. A cap
        // layered over a separate bob creates a shelf in the side silhouette.
        const waves = cut === "waves";
        const section = (u: number, inset = 0) =>
            loop(64, (a) => {
                const angle = Math.atan2(Math.sin(a), Math.cos(a));
                const turn = T.MathUtils.smoothstep(
                    Math.abs(angle),
                    waves ? (angle < 0 ? 0.44 : 0.81) : 0.8,
                    waves ? (angle < 0 ? 0.89 : 1.2) : 1.07
                );
                const ends =
                    g.fit?.hairLength ??
                    (waves
                        ? 1.04 + 0.06 * Math.cos(2 * a + 0.5)
                        : 0.84 + 0.045 * Math.cos(3 * a));
                const depth = T.MathUtils.lerp(hem(a), ends, turn) * u;
                const p = radial(a, Math.min(depth, 0.75));
                const fall = T.MathUtils.smoothstep(depth, 0.28, 0.78) * turn;
                const wave =
                    (waves ? 0.09 : 0.025) *
                    Math.exp(-((depth - 0.84) ** 2) / 0.024);
                const radius =
                    w *
                    (0.5 +
                        wave +
                        0.021 * Math.cos(5 * a + depth * 3) -
                        0.076 * T.MathUtils.smoothstep(u, 0.91, 1)) *
                    (g.fit?.hairWidth ?? 1);
                const curl =
                    a +
                    fall * (waves ? 0.068 : 0.035) * Math.sin(Math.PI * depth);
                return [
                    T.MathUtils.lerp(p[0], radius * Math.sin(curl), fall) *
                        (1 - inset),
                    y0 + depth * h - 2.1 - (1 - u) * 1.5 + (inset ? 0.55 : 0),
                    T.MathUtils.lerp(
                        p[2],
                        radius * 1.05 * Math.cos(curl) - w * 0.07,
                        fall
                    ) *
                        (1 - inset),
                ];
            });
        const ends = section(1, 0.1);
        const inner = ends.map(
            ([x, y, z]): Point => [x * 0.82, y - h * 0.052, z * 0.82]
        );
        d.s.surface(
            [
                ...Array.from({ length: 16 }, (_, i) => section(i / 15)),
                ends,
                inner,
            ],
            paint,
            true
        );
        return;
    }
    const cap = [0, 0.05, 0.11, 0.21, 0.34, 0.51, 0.68, 0.85, 1].map((t) =>
        loop(cut === "curls" ? 72 : 40, (a) => {
            const p = radial(a, t * hem(a));
            if (cut === "curls" && t > 0) {
                const lobe = 0.5 + 0.5 * Math.cos(11 * a + 1.7 * (1 - t));
                const puff =
                    w * (0.032 + 0.065 * lobe) * Math.sin(t * Math.PI * 0.88);
                p[0] += Math.sin(a) * puff;
                p[2] += Math.cos(a) * puff;
                p[1] -=
                    h *
                    ((0.016 + 0.046 * lobe) * Math.sin(t * Math.PI) +
                        0.054 * (1 - t) ** 2);
            }
            if (cut === "quiff") {
                // The lift sweeps across the crown and rolls into the hairline.
                // Keep every longitude on the same cap so the profile has no spike.
                const root = (1 - t) ** 1.55,
                    wave =
                        Math.sin(Math.PI * t) * Math.max(0, Math.cos(a - 0.45));
                const volume = w * wave * (0.1 + 0.055 * Math.sin(a)) * (1 - t);
                p[0] += Math.sin(a) * volume;
                p[2] += Math.cos(a) * volume;
                p[1] -= h * (0.064 * root + 0.105 * wave * (1 - t));
                if (t === 0) return [0, y0 - h * 0.064 - 1.2, -1];
            }
            // Grow a swept part from the cap itself so the crown has a continuous silhouette.
            if (cut === "part") {
                const crown = (1 - t) ** 1.6;
                p[0] *= 1 + 0.04 * crown;
                p[1] -=
                    h *
                    (0.048 + 0.055 * Math.sin(a) * Math.sin(Math.PI * t)) *
                    crown;
            }
            if (t === 0)
                return cut === "part"
                    ? [0, y0 - h * 0.048, -1]
                    : [0, y0 - (cut === "curls" ? h * 0.054 + 3.4 : 3.4), -1];
            return p;
        })
    );
    cap.push(
        loop(cut === "curls" ? 72 : 40, (a) => {
            const p = radial(a, hem(a));
            return [p[0] * 0.946, p[1] + 0.75, p[2] * 0.943];
        })
    );
    const scalpTone = d.s.tone;
    if (cut === "curls")
        d.s.tone = (x, y, z) => {
            const whorl = Math.cos(11 * Math.atan2(x, z) + (1 - y / h) * 2.4);
            return 0.94 + 0.12 * whorl;
        };
    d.s.surface(cap, paint, true);
    d.s.tone = scalpTone;
    if (cut === "ponytail" || cut === "bun") {
        const at: Point = [-w * 0.25, y0 + h * 0.3, -w * 0.37];
        d.s.oval(at, [w * 0.102, h * 0.088, w * 0.102], g.outfit.trim);
        if (cut === "bun")
            d.s.oval(
                [-w * 0.28, y0 + h * 0.2, -w * 0.48],
                [w * 0.237, h * 0.208, w * 0.23],
                paint
            );
        else {
            const tail: Point[] = [
                at,
                [-w * 0.46, y0 + h * 0.39, -w * 0.45],
                [-w * 0.67, y0 + h * 0.53, -w * 0.47],
                [-w * 0.84, y0 + h * 0.7, -w * 0.44],
                [-w * 0.91, y0 + h * 0.84, -w * 0.4],
            ];
            const angle = (g.hair.fall ?? 0) * 0.74,
                c = Math.cos(angle),
                s = Math.sin(angle);
            d.s.sweep(
                tail.map(
                    ([x, y, z]): Point => [
                        at[0] + (x - at[0]) * c + (y - at[1]) * s,
                        at[1] - (x - at[0]) * s + (y - at[1]) * c,
                        z,
                    ]
                ),
                [w * 0.09, w * 0.15, w * 0.136, w * 0.08, 0],
                paint,
                10
            );
        }
    }
}
function drawNose(d: Drawing, g: CartoonDesign, face: Depth) {
    const [w, h] = g.head,
        y0 = 12;
    const traced = g.fit?.sections?.nose;
    if (traced) {
        const { stroke, lift, lo, hi, center, width } = fittedNose(g);
        if (g.fit.sections.nape && g.fit.sections.sideGuide) {
            drawNoseCrease(
                d,
                g,
                face,
                curve(stroke, false, false),
                traced.radius * 1.36,
                center,
                width
            );
            return;
        }
        const surface = (x: number, y: number) =>
            face(x, y) + lift(x, y) - 0.28;
        const bridge = Array.from({ length: 13 }, (_, i) => {
            const y = T.MathUtils.lerp(lo, hi, i / 12),
                c = center(y);
            return Array.from({ length: 11 }, (_, j): Point => {
                const x = c + width * (j / 5 - 1) * 1.52;
                return [x, y, surface(x, y)];
            });
        });
        // Smooth the bridge into the cheek using the same surface for
        // normals and ink. The nostril stays on its rounded tip in profile.
        d.s.surfaceNormal = (x, y) => [
            surface(x - 0.35, y) - surface(x + 0.35, y),
            surface(x, y - 0.35) - surface(x, y + 0.35),
            0.7,
        ];
        d.s.surface(bridge, g.skin, true, undefined, 0.37);
        d.s.surfaceNormal = undefined;
        d.stroke(
            stroke,
            (x, y) => Math.max(surface(x, y), face(x, y)) + 0.72,
            traced.radius,
            traced.ink
        );
        return;
    }
    const hooked = g.nose === "hooked";
    const ny = y0 + h * (g.face?.noseBase ?? 0.64),
        nx = w * 0.034,
        nr =
            w *
            { button: 0.064, straight: 0.084, hooked: 0.098 }[g.nose] *
            (g.face?.noseWidth ?? 1),
        base =
            ny - h * { button: 0.08, straight: 0.142, hooked: 0.161 }[g.nose],
        tip = ny + (hooked ? 0.32 : 0.15) * nr;
    const outline: XY[] = [
        [nx - nr * 0.18, base],
        [nx + nr * 0.1, base + 1],
        [nx + nr * 0.42, ny - nr * 0.65],
        [nx + nr * 0.74, ny - nr * 0.19],
        [nx + nr * 0.56, tip],
        [nx - nr * 0.51, ny + nr * 0.15],
        [nx - nr * 0.61, ny - nr * 0.06],
        [nx - nr * 0.22, ny - nr * 0.37],
    ];
    const relief = d.patch(
        outline,
        [nx + nr * (hooked ? 0.35 : 0.08), ny - nr * (hooked ? 0.03 : 0.15)],
        (x, y) => face(x, y) + 0.4,
        nr * (hooked ? 1.4 : 0.91) * (g.face?.noseProjection ?? 1),
        g.skin,
        { sharp: false }
    );
    const edge: XY[] = [
        [nx - nr * 0.5, ny + 0.1],
        [nx + nr * 0.29, tip + nr * 0.02],
        [nx + nr * (hooked ? 0.75 : 0.69), ny - nr * (hooked ? 0.03 : 0.07)],
        [nx + nr * 0.42, ny - nr * 0.66],
        [nx + 0.2, base + 2],
    ];
    d.s.ribbon(
        curve(edge, false, false).map(
            ([x, y]): Point => [x, y, relief(x, y) + 0.75]
        ),
        0.68,
        swatch(g.skin, ink, 0.7)
    );
}
function drawOpenMouth(
    d: Drawing,
    g: CartoonDesign,
    face: Depth,
    opening: NonNullable<
        NonNullable<CartoonDesign["fit"]>["sections"]
    >["openMouth"]
) {
    const paint = g.household?.mouthPaint;
    const rows = opening.rows;
    const [width, height] = g.head;
    const lift = paint ? width * 0.017 : 1.1;
    const drawPoint = (x: number, y: number, offset = 0): Point => [
        x,
        y,
        face(x, y) + lift + offset,
    ];
    const layers = Array.from({ length: 5 }, (_, i) =>
        rows.map((row) => drawPoint(row[0], row[i + 1]))
    );
    const colors = [
        opening.teeth,
        opening.interior,
        opening.tongue ?? opening.interior,
        opening.teeth,
    ];
    const lip = g.household?.lipColor;
    if (paint && lip) {
        const lips = g.household.lips;
        layers.unshift(
            lips.map(([x, upper]) => drawPoint(x * width, 12 + upper * height))
        );
        layers.push(
            lips.map(([x, , lower]) =>
                drawPoint(x * width, 12 + lower * height)
            )
        );
        colors.unshift(lip);
        colors.push(lip);
    }
    const normal = d.s.surfaceNormal;
    if (paint)
        d.s.surfaceNormal = (x, y) => [
            face(x - 0.25, y) - face(x + 0.25, y),
            face(x, y - 0.25) - face(x, y + 0.25),
            0.9,
        ];
    for (const [i, color] of colors.entries()) {
        const upper = layers[i],
            lower = layers[i + 1];
        if (!lower.some((p, j) => p[1] > upper[j][1])) continue;
        // Contact paint conforms to the curved jaw through the middle of
        // every band. Preserve common columns across teeth, lip and cavity.
        const curved =
            paint && lower.some((p, j) => p[1] - upper[j][1] > width * 0.037);
        const bands = curved
            ? [
                  upper,
                  upper.map(([x, y], j) => drawPoint(x, (y + lower[j][1]) / 2)),
                  lower,
              ]
            : [upper, lower];
        d.s.surface(bands, color, true, paint ? "perimeter" : undefined, 0.27);
    }
    if (paint && lip) {
        const ink = swatch(lip, opening.interior, 0.5);
        for (const edge of [layers[0], layers.at(-1)])
            d.s.ribbon(
                edge.map(([x, y]) => drawPoint(x, y, 0.23)),
                width * 0.0035,
                ink
            );
        // A dark gum line separates similarly light lip and enamel pigments.
        d.s.ribbon(
            rows.map(([x, y]) => drawPoint(x, y, 0.35)),
            width * 0.0055,
            swatch(lip, opening.interior, 0.8)
        );
    }
    for (const u of paint?.seams ?? []) {
        const x = T.MathUtils.lerp(rows[0][0], rows.at(-1)[0], u);
        const hi = rows.findIndex((row) => row[0] >= x);
        const a = rows[hi - 1],
            b = rows[hi];
        const t = (x - a[0]) / (b[0] - a[0]);
        const upper = T.MathUtils.lerp(a[1], b[1], t);
        const gum = T.MathUtils.lerp(a[2], b[2], t);
        const mark = [0.08, 0.52, 0.95].map((v) =>
            drawPoint(x, T.MathUtils.lerp(upper, gum, v), 0.48)
        );
        d.s.ribbon(
            mark,
            width * 0.005,
            swatch(paint.teeth, opening.interior, 0.8)
        );
    }
    d.s.surfaceNormal = normal;
}

function features(
    d: Drawing,
    g: CartoonDesign,
    face: Depth,
    orbits: ReturnType<typeof fittedOrbits>
) {
    const [w, h] = g.head,
        y0 = 12;
    const eyesY =
        y0 + h * (g.face?.eyeHeight ?? (g.skull === "round" ? 0.495 : 0.466));
    const rx = w * (g.face?.eyeRadius ?? (g.build === "child" ? 0.169 : 0.149)),
        ry =
            rx *
            (g.face?.eyeAspect ??
                (g.eyes === "wide"
                    ? 0.99
                    : g.eyes === "relaxed"
                    ? 0.94
                    : 0.93));
    const front = (x: number, y: number, lift = 0) => face(x, y) + lift;
    const line = (xy: XY[], color: string, width: number, lift = 1.2) =>
        d.s.ribbon(
            curve(xy, false, false).map(
                ([x, y]): Point => [x, y, front(x, y, lift)]
            ),
            width,
            color
        );
    const depthScale = g.face?.eyeDepthScale ?? 1;
    const guided = g.fit?.sections?.sideGuide;
    const sideGuide = guided
        ? orbits ?? scaleEyeDepth(guided, depthScale)
        : orbits?.roundPair
        ? orbits
        : undefined;
    const commonFront =
        !sideGuide && orbits
            ? orbits.eyeCenter + orbits.eyeSpan / 2
            : undefined;
    for (const crease of g.fit?.sections?.creases ?? [])
        line(crease.points, crease.color, crease.radius, 0.96);
    for (const s of [-1, 1]) {
        const eye = g.fit?.sections?.eyes?.[s < 0 ? 0 : 1];
        const traced = g.household?.orbits[s < 0 ? 0 : 1];
        const ex = eye
                ? eye.rim.reduce((a, p) => a + p[0], 0) / eye.rim.length
                : s *
                  w *
                  (g.face?.eyeSpacing ?? (g.build === "child" ? 0.207 : 0.196)),
            ey = eye
                ? eye.rim.reduce((a, p) => a + p[1], 0) / eye.rim.length
                : eyesY + h * (traced?.lift ?? s * 0.003);
        const actualRX = eye
            ? Math.max(...eye.rim.map(([x]) => Math.abs(x - ex)))
            : rx;
        const actualRY = eye
            ? Math.max(...eye.rim.map(([, y]) => Math.abs(y - ey)))
            : ry;
        // A lowered lid exposes a shallow slice of the globe. Keeping the
        // open-eye sagittal span would project a rectangular white ledge in profile.
        const exposedDepth = traced && g.eyes === "half-lidded" ? 0.65 : 1;
        // A fully exposed household globe keeps its sagittal white as the
        // head turns. Anchor the rim farther into its recessed temple.
        const recessed = g.household?.depth && g.eyes !== "half-lidded";
        const whiteRadius =
            g.household?.body && recessed
                ? actualRX - Math.max(0.78, actualRX * 0.075)
                : actualRX;
        const orbitSpan = (recessed ? 1.66 : 1.24) * whiteRadius * exposedDepth;
        const orbitCenter = traced
            ? face(ex, ey) + (recessed ? 0.14 : 0.28) * actualRX * exposedDepth
            : 0;
        const globeDepth = sideGuide?.eyeSpan
            ? T.MathUtils.clamp(
                  sideGuide.eyeSpan * 0.73,
                  actualRX * 0.65,
                  actualRX * 1.02
              )
            : actualRX * classicEyeDepthRatio * depthScale;
        const patch = g.household?.eyePatch;
        if (patch && (patch.side === "right" ? -1 : 1) === s) {
            const midY = ey + patch.lift * h;
            const rim: XY[] = [
                [-0.87, -0.74],
                [-0.54, -0.99],
                [0.17, -1],
                [0.77, -0.85],
                [1, -0.55],
                [0.94, 0.19],
                [0.6, 0.73],
                [0.14, 1],
                [-0.38, 0.93],
                [-0.81, 0.49],
                [-1, -0.13],
            ].map(([u, v]) => [
                ex + u * patch.width * w,
                midY + v * patch.height * h,
            ]);
            d.patch(
                rim,
                [ex, midY],
                (x, y) => face(x, y) + 0.8,
                actualRX * 0.37,
                patch.color,
                { edge: 0.65, ink: patch.strap, back: 1 }
            );
        } else
            drawCartoonEye(d, face, {
                center: [ex, ey],
                radii: [actualRX, actualRY],
                side: s,
                closedSocket: !!traced,
                observedGaze: traced?.observedGaze,
                gaze: g.gaze,
                aperture: g.eyes,
                globeDepth: traced
                    ? globeDepth * 0.64 * exposedDepth
                    : eye
                    ? globeDepth
                    : undefined,
                depthScale,
                sideOrbit: traced
                    ? {
                          eyeCenter: orbitCenter,
                          eyeSpan: orbitSpan,
                          // With no side study, place the pigment inside the volume so
                          // it has white on either side as the viewer passes the temple.
                          pupilDepth:
                              orbitCenter +
                              (recessed
                                  ? orbitSpan * 0.27
                                  : actualRX * 0.21 * exposedDepth),
                      }
                    : sideGuide,
                turnedPupil: guided?.turnedPupils?.[s < 0 ? 0 : 1],
                commonFront,
                brow: g.brow,
                skin: g.skin,
                lashes: g.lashes,
                opening:
                    eye?.rim ??
                    traced?.rim.map(
                        ([x, y]): XY => [ex + actualRX * x, ey + actualRY * y]
                    ),
                rimInk:
                    eye?.rimInk ??
                    (traced
                        ? {
                              width: Math.max(0.78, actualRX * 0.075),
                              color: "#352d29",
                          }
                        : undefined),
                lid:
                    eye?.lid ??
                    traced?.lid?.map(
                        ([x, y]): XY => [ex + actualRX * x, ey + actualRY * y]
                    ),
                pupil: eye
                    ? [eye.pupil[0], eye.pupil[1]]
                    : traced
                    ? [
                          ex +
                              actualRX *
                                  T.MathUtils.clamp(
                                      traced.pupil[0] + g.gaze,
                                      -0.78,
                                      0.78
                                  ),
                          ey + actualRY * traced.pupil[1],
                      ]
                    : undefined,
                pupilRadius: eye?.pupil[2],
                pigment: g.pupil,
            });
        const tilt =
            g.brow === "worried" ? 0.24 : g.brow === "knit" ? -0.22 : 0;
        const by = ey - ry - h * (g.eyes === "half-lidded" ? 0.022 : 0.044);
        const opposite =
            sideGuide && orbits && g.fit.sections.eyes[s < 0 ? 1 : 0];
        const browGuide =
            eye?.brow ??
            traced?.brow?.map(
                ([x, y]): XY => [ex + x * actualRX, ey + y * actualRY]
            ) ??
            opposite?.brow
                ?.map(([x, y]): XY => [2 * orbits.axis - x, y])
                .reverse();
        const otherRim = g.fit?.sections?.eyes?.[s < 0 ? 1 : 0]?.browRim;
        const joinedBrow =
            otherRim?.some(([x]) => x < ex) && otherRim.some(([x]) => x > ex);
        const rim =
            eye?.browRim ??
            traced?.browRim?.map(
                ([x, y]): XY => [ex + actualRX * x, ey + actualRY * y]
            );
        if (rim) {
            const center: XY = [
                rim.reduce((sum, p) => sum + p[0], 0) / rim.length,
                rim.reduce((sum, p) => sum + p[1], 0) / rim.length,
            ];
            d.patch(
                rim,
                center,
                (x, y) => face(x, y) + 1,
                0.55,
                eye?.browColor ?? traced?.browColor ?? g.hair.color,
                { edge: 0.46, ink }
            );
        } else if (browGuide && !eye?.browOccluded)
            drawCartoonBrow(
                d,
                face,
                browGuide,
                eye?.browWidth ?? 0.9,
                swatch(g.hair.color, ink, 0.76)
            );
        else if (!eye?.lid && !eye?.browOccluded && !joinedBrow) {
            const arch = g.brow === "arched" ? 0.32 : 0.15;
            const brow = Array.from({ length: 7 }, (_, i): XY => {
                const u = (i - 3) / 3;
                return [
                    ex + s * rx * 0.91 * u,
                    by + ry * (tilt * u - arch * (1 - u * u)),
                ];
            });
            drawCartoonBrow(
                d,
                face,
                brow,
                g.brow === "knit" ? 1.05 : 0.76,
                swatch(g.hair.color, ink, 0.76)
            );
        }
        const capEnd = g.fit?.sections?.hair?.at(-1)?.[0];
        const shortCap = capEnd != null && capEnd < eyesY + h * 0.2;
        const ax = s * w * (shortCap ? 0.425 : 0.49),
            ay = y0 + h * 0.61;
        const ear = fittedEar(g, s);
        if (ear) {
            const {
                visible,
                y,
                ry,
                rx,
                root,
                reach,
                depth,
                z,
                observed: measuredEar,
            } = ear;
            // Polar rings face the side camera. Their common outer ellipse
            // resolves the lobe in profile without a dense latitude grid.
            const count =
                d.s.detail === "crowd"
                    ? 14
                    : measuredEar
                    ? 24
                    : visible
                    ? 18
                    : 16;
            const meridians = [0, 0.48, 0.91, 1.23, Math.PI / 2];
            const rows = meridians.map((rho) =>
                loop(count, (phi) => [
                    s * (root + reach * Math.cos(rho)),
                    y + ry * Math.sin(rho) * Math.sin(phi),
                    z + depth * Math.sin(rho) * Math.cos(phi),
                ])
            );
            const smooth = d.s.surfaceNormal;
            d.s.surfaceNormal = (x, py, pz) => {
                const forward = (pz - z) / depth;
                const join = measuredEar
                    ? T.MathUtils.smoothstep(forward, 0.1, 0.86)
                    : 0;
                // The anterior root flows into the cheek. Only its rear edge
                // rolls back toward the hair and exposes a complete rim.
                return [
                    T.MathUtils.lerp(
                        (x - s * root) / (reach * reach),
                        s / reach,
                        join
                    ),
                    ((py - y) / (ry * ry)) * (1 - join),
                    (forward / depth) * (1 - join),
                ];
            };
            const originalTone = d.s.tone;
            if (measuredEar || g.household?.ears) {
                // The measured pinna meets the hair along its rear edge.
                // Bake that contact into the lobe so no floating ink shell is needed.
                d.s.tone = (x, py, pz) => {
                    const back = (z - pz) / depth;
                    const rim = Math.hypot(back, (py - y) / ry);
                    return (
                        (originalTone?.(x, py, pz) ?? 1) *
                        (1 -
                            0.31 *
                                T.MathUtils.smoothstep(back, -0.16, 0.72) *
                                T.MathUtils.smoothstep(rim, 0.65, 1))
                    );
                };
            }
            d.s.surface(rows, g.skin, true, "end");
            d.s.surfaceNormal = smooth;
            d.s.tone = originalTone;
            const fold: XY[] = [
                [0.37, -0.32],
                [0.53, -0.43],
                [0.69, -0.35],
                [0.77, -0.13],
            ];
            if (
                (g.fit?.sections?.sideGuide || g.household?.depth) &&
                !measuredEar
            ) {
                // A helix is seen edge-on from the front. Lay its crease on
                // the lateral pinna so it turns around the lobe with the head.
                const crease = curve(
                    [
                        [-0.64, 0.12],
                        [-0.66, -0.11],
                        [-0.48, -0.39],
                        [-0.16, -0.45],
                        [0.12, -0.29],
                        [0.17, -0.1],
                        [0.08, 0.02],
                        [0.25, 0.14],
                        [0.28, 0.31],
                    ],
                    false,
                    false,
                    7
                );
                const strip = crease.map(([u, v], i) => {
                    const a = crease[Math.max(0, i - 1)];
                    const b = crease[Math.min(crease.length - 1, i + 1)];
                    const dy = ry * (b[1] - a[1]),
                        dz = depth * (b[0] - a[0]);
                    const radius =
                        Math.min(depth, ry) *
                        (0.035 +
                            0.042 *
                                Math.sin((Math.PI * i) / (crease.length - 1)));
                    const step = radius / Math.max(1e-5, Math.hypot(dy, dz));
                    return [-1, 1].map((k) => {
                        const tu = u + (k * dy * step) / depth;
                        const tv = v - (k * dz * step) / ry;
                        const turn = g.household?.earTurn ?? 0;
                        const normal = Math.sqrt(
                            Math.max(0, 1 - tu * tu - tv * tv)
                        );
                        const outward =
                            normal * Math.cos(turn) - tu * Math.sin(turn);
                        const forward =
                            tu * Math.cos(turn) + normal * Math.sin(turn);
                        return [
                            s * (root + (reach + 0.38) * outward),
                            y + ry * tv,
                            z + (depth + 0.38) * forward,
                        ] as Point;
                    });
                });
                d.s.surface(
                    strip,
                    swatch(g.skin, ink, 0.71),
                    true,
                    "perimeter"
                );
            } else if (!measuredEar)
                d.s.ribbon(
                    curve(fold, false, false).map(
                        ([u, v]): Point => [
                            s * (root + reach * u),
                            y + ry * v,
                            z +
                                depth *
                                    Math.sqrt(Math.max(0, 1 - u * u - v * v)) +
                                0.45,
                        ]
                    ),
                    Math.max(0.4, rx * 0.052),
                    swatch(g.skin, ink, 0.68)
                );
        } else if (
            shortCap ||
            (g.hair.cut !== "bob" && g.hair.cut !== "waves")
        ) {
            d.s.oval(
                [ax, ay, 0],
                [w * 0.064, h * 0.078, w * 0.054],
                g.skin,
                -s * 0.18
            );
            d.s.ribbon(
                [
                    [ax - s * 1.9, ay - 2.6, w * 0.043],
                    [ax + s * 1.3, ay - 1, w * 0.05],
                    [ax - s * 0.6, ay + 2.7, w * 0.049],
                ],
                0.56,
                swatch(g.skin, ink, 0.45)
            );
        }
        if (g.freckles)
            for (const [dx, dy] of [
                [0, 1],
                [3, -1],
                [-2, -2],
                [5, 2],
            ]) {
                const x = s * w * 0.31 + dx,
                    y = eyesY + ry + 5 + dy;
                d.s.oval(
                    [x, y, front(x, y, 0.74)],
                    [0.95, 0.85, 0.72],
                    swatch(g.skin, "#9b6247", 0.6)
                );
            }
        if (g.spectacles) {
            const square = g.frames === "square";
            const corner = (v: number) =>
                Math.sign(v) * Math.abs(v) ** (square ? 0.68 : 1);
            const slope = T.MathUtils.clamp(
                (face(ex + 1, ey) - face(ex - 1, ey)) * 0.5,
                -0.38,
                0.38
            );
            const plane = front(ex, ey, rx * 0.99);
            const lens = loop(24, (a) => {
                const dx = rx * 1.16 * corner(Math.cos(a)),
                    dy = ry * (square ? 1.06 : 1.24) * corner(Math.sin(a));
                return [ex + dx, ey + dy, plane + dx * slope + dy * 0.035];
            });
            const wire = square ? "#67534c" : "#55453e";
            d.s.line(lens, 1, wire);
            const hinge = lens[s === 1 ? 0 : 12],
                inner = lens[s === 1 ? 12 : 0];
            if (s === 1) {
                const saddle: Point = [
                    0,
                    ey - ry * 0.09,
                    Math.max(inner[2], front(0, ey, w * 0.035)),
                ];
                d.s.line(
                    [[-inner[0], inner[1], inner[2]], saddle, inner],
                    0.93,
                    wire
                );
            }
            d.s.line(
                [
                    hinge,
                    [s * w * 0.485, ey - 0.5, w * 0.18],
                    [ax + s * 1.7, ay - 5.5, 1],
                    [ax, ay - 2.2, -4],
                ],
                0.82,
                wire
            );
        }
    }
    drawNose(d, g, face);
    const opening = g.fit?.sections?.openMouth;
    if (g.mouth === "speaking" && opening) {
        drawOpenMouth(d, g, face, opening);
        return;
    }
    const measuredMouth = g.fit?.sections?.mouth;
    if (measuredMouth && measuredMouth.expression === g.mouth) {
        const seam: Point[] = [];
        const lips = measuredMouth.rows.map(([x, middle, top, bottom]) => {
            const bulge = Math.min((bottom - top) * 0.22, h * 0.017);
            seam.push([x, middle, front(x, middle, 1.15 + bulge)]);
            return [top, middle, bottom].map(
                (y, i): Point => [
                    x,
                    y,
                    front(x, y, 0.7 + (i === 1 ? bulge : 0)),
                ]
            );
        });
        if (measuredMouth.color) d.s.surface(lips, measuredMouth.color, true);
        if (g.fit.sections.sideGuide) {
            const guide = g.fit.sections.sideGuide;
            const lateral = guide.mouthCorner;
            if (g.mouth === "smile" && !measuredMouth.color) {
                drawFittedSmile(d, g, face, seam);
                return;
            }
            if (lateral && measuredMouth.color && g.mouth === "smile") {
                const center = (seam[0][0] + seam.at(-1)[0]) * 0.5;
                const half = (seam.at(-1)[0] - seam[0][0]) * 0.5;
                const low = Math.max(...seam.map((p) => p[1]));
                for (const point of seam) {
                    const u = Math.abs(point[0] - center) / half;
                    const lip =
                        low - lateral[1] * T.MathUtils.smoothstep(u, 0.28, 1);
                    point[1] = Math.min(point[1], lip);
                    point[2] = front(point[0], point[1], 1.1);
                }
            }
            d.s.line(
                seam,
                measuredMouth.radius * 1.17,
                measuredMouth.ink,
                0.18
            );
        } else d.s.ribbon(seam, measuredMouth.radius, measuredMouth.ink);
        return;
    }
    const my = y0 + h * (g.face?.mouthHeight ?? 0.775),
        mw = w * (g.face?.mouthWidth ?? (g.mouth === "speaking" ? 0.14 : 0.16));
    // Even a closed cartoon mouth has a lower lip and a shadow where the lips meet.
    if (g.mouth === "smile" || g.mouth === "lips") {
        const lip: XY[] = [
            [-1, -0.04],
            [-0.54, 0.16],
            [0, 0.21],
            [0.53, 0.11],
            [1, -0.11],
            [0.46, 0.61],
            [-0.18, 0.7],
            [-0.64, 0.42],
        ].map(([x, y]) => [mw * x, my + y * h * 0.086]);
        d.patch(
            lip,
            [0, my + h * 0.027],
            (x, y) => face(x, y) + 0.8,
            h * 0.018,
            swatch(g.skin, "#a55550", g.mouth === "smile" ? 0.22 : 0.38)
        );
    }
    if (g.mouth === "speaking" || g.mouth === "lips") {
        const open = g.mouth === "speaking",
            mh = h * (g.household && open ? 0.033 : open ? 0.067 : 0.044);
        const path: XY[] = [
            [-1, 0],
            [-0.6, -0.7],
            [-0.12, -0.89],
            [0.36, -0.79],
            [0.81, -0.52],
            [1, 0.1],
            [0.66, 0.77],
            [0.12, 0.94],
            [-0.55, 0.74],
        ].map(([x, y]) => [mw * x, my + y * mh]);
        d.decal(
            path,
            (x, y) => face(x, y) + 1.15,
            open ? "#743f39" : "#cd607b"
        );
        if (open && !g.household) {
            const tooth: XY[] = [
                [-0.7, -0.51],
                [-0.05, -0.67],
                [0.58, -0.5],
                [0.47, -0.12],
                [-0.52, -0.08],
            ].map(([x, y]) => [mw * x, my + y * mh]);
            d.decal(tooth, (x, y) => face(x, y) + 1.55, "#eee0c2");
        } else if (!open)
            line(
                [
                    [-mw * 0.93, my],
                    [0, my - 0.3],
                    [mw * 0.94, my + 1],
                ],
                ink,
                0.65,
                1.75
            );
    } else {
        const m =
            g.mouth === "smile"
                ? [
                      [-1, -0.2],
                      [-0.5, 0.19],
                      [0.1, 0.29],
                      [0.7, 0.08],
                      [1, -0.28],
                  ]
                : g.mouth === "uncertain"
                ? [
                      [-1, 0.31],
                      [-0.85, -0.08],
                      [-0.23, -0.24],
                      [0.57, -0.17],
                      [0.97, 0.15],
                  ]
                : [
                      [-1, 0.1],
                      [-0.5, -0.02],
                      [0.27, -0.07],
                      [1, -0.03],
                  ];
        line(
            m.map(([x, y]): XY => [mw * x, my + y * h * 0.067]),
            ink,
            0.89
        );
        if (g.mouth === "uncertain" && g.skull === "long")
            for (const side of [-1, 1])
                line(
                    [
                        [side * mw * 1.14, my - 1.3],
                        [side * mw * 1.2, my + 1],
                        [side * mw * 1.13, my + 3.3],
                    ],
                    swatch(g.skin, ink, 0.49),
                    0.55
                );
    }
}
/** A contrasting outsole wraps from heel to toe at the height seen in the
 * drawing. Both pigments meet at the same ring, including underneath. */
function drawSole(
    d: Drawing,
    shoe: Section[],
    outsole: NonNullable<
        NonNullable<NonNullable<CartoonDesign["fit"]>["sections"]>["outsole"]
    >,
    center: number,
    sign: number,
    paint: string
) {
    const front = profileDepth(shoe),
        rear = profileDepth(shoe, -1);
    const left = outsole.rows[0][0],
        right = outsole.rows.at(-1)[0];
    const upper: Point[][] = [],
        wall: Point[][] = [];
    for (const [offset, top, seam, base] of outsole.rows) {
        const x = center + sign * offset,
            t = (offset - left) / (right - left);
        const turn = Math.sqrt(Math.max(0, Math.sin(Math.PI * t)));
        const y = (top + base) * 0.5;
        const z = (front(x, y) + rear(x, y)) / 2;
        const depth =
            Math.max(
                0,
                Math.min(
                    (right - left) * 0.47,
                    (front(x, y) - rear(x, y)) * 0.65
                )
            ) * turn;
        const section = (height: number, r: number): Point => [
            x,
            height,
            z + r * depth,
        ];
        const sides = [-1, -0.72, 0, 0.72, 1].map((a) =>
            section(seam - (seam - top) * Math.sqrt(Math.max(0, 1 - a * a)), a)
        );
        upper.push(sides);
        wall.push([
            sides[0],
            section(base, -0.97),
            section(base, 0.97),
            sides.at(-1),
        ]);
    }
    d.s.surface(upper, paint, true, "perimeter");
    d.s.surface(wall, outsole.color, true, "perimeter");
    d.s.line(
        wall.map((r) => r.at(-1)),
        0.54,
        swatch(outsole.color, ink, 0.78)
    );
}
/** The instep, toe cap and outsole follow the same section profile used by the foot. */
function shoeDetails(
    d: Drawing,
    shoe: Section[],
    paint: string,
    style: "sneaker" | "flat" | "boot"
) {
    const front = profileDepth(shoe),
        top = shoe[0][0],
        height = shoe.at(-1)[0] - top;
    const arc = (
        t: number,
        width: number,
        bend: number,
        color: string,
        r: number
    ) => {
        const y = top + t * height;
        let i = 1;
        while (i < shoe.length - 1 && shoe[i][0] < y) i++;
        const lo = shoe[i - 1],
            hi = shoe[i],
            u = T.MathUtils.clamp((y - lo[0]) / (hi[0] - lo[0]), 0, 1);
        const left = T.MathUtils.lerp(lo[1], hi[1], u),
            right = T.MathUtils.lerp(lo[2], hi[2], u);
        const path = [-1, -0.65, 0, 0.65, 1].map((v) => {
            const x = (left + right) / 2 + v * width * (right - left) * 0.5,
                py = y + bend * (1 - v * v);
            return [x, py, front(x, py) + 0.75] as Point;
        });
        d.s.ribbon(path, r, color);
    };
    arc(0.88, 0.94, height * 0.018, swatch(paint, ink, 0.48), 0.66);
    if (style === "sneaker") {
        for (const at of [0.35, 0.46, 0.57])
            arc(at, 0.54, -height * 0.045, swatch(paint, ink, 0.32), 0.8);
        arc(0.73, 0.84, -height * 0.065, swatch(paint, ink, 0.3), 0.52);
    } else if (style === "boot")
        arc(0.21, 0.82, -height * 0.022, swatch(paint, ink, 0.38), 0.72);
}
function stitchLines(d: Drawing, lines: Seam[], depth: Depth) {
    for (const seam of lines) {
        let run: Point[] = [];
        const finish = () => {
            if (run.length >= 2) d.s.ribbon(run, seam.radius, seam.color);
            run = [];
        };
        for (const [x, y] of curve(seam.points, false, false)) {
            const z = depth(x, y);
            if (Number.isFinite(z)) run.push([x, y, z + 0.74]);
            else finish();
        }
        finish();
    }
}
function clothing(d: Drawing, g: CartoonDesign) {
    const { jaw, neck, hip, shoulder, waist } = proportions(g),
        o = g.outfit,
        depth = shoulder * 0.64;
    const bodyLength = hip - neck,
        chest = neck + bodyLength * 0.27;
    const jacket = o.top === "cardigan",
        placket = o.top === "polo";
    const openingDepth = jacket
        ? 0.64
        : T.MathUtils.clamp(o.placketDepth ?? 0.18, 0.1, 0.4);
    const softWaist =
        g.build === "regular" || g.build === "broad" ? 1.15 : 0.98;
    const hemWidth = g.build === "lean" ? waist * 1.09 : waist;
    const measured = g.fit?.sections;
    const pelvisX = measured?.pelvisX ?? 0;
    const centerAt = (y: number) =>
        T.MathUtils.lerp(
            measured?.crew?.center ?? 0,
            pelvisX,
            T.MathUtils.smoothstep(y, neck, hip)
        );
    const crew = o.top === "crew" ? measured?.crew : undefined;
    const shirtSides = measured && o.top === "crew" ? 16 : 24;
    const rows: Section[] = measured
        ? measured.torso.map(
              ([y, r]): Section => [
                  y,
                  centerAt(y) - r,
                  centerAt(y) + r,
                  depth *
                      Math.max(
                          g.household && y > hip - 8 ? 0.89 : 0.48,
                          Math.min(r / shoulder, 1)
                      ),
              ]
          )
        : [
              [neck - 1, -shoulder * 0.46, shoulder * 0.46, depth * 0.48],
              [neck + 5, -shoulder * 0.75, shoulder * 0.75, depth * 0.69],
              [neck + 11, -shoulder * 0.94, shoulder * 0.94, depth * 0.86],
              [chest, -shoulder, shoulder, depth],
              [
                  neck + bodyLength * 0.6,
                  -waist * softWaist,
                  waist * softWaist,
                  depth * softWaist,
              ],
              [hip - 23, -hemWidth * 0.986, hemWidth * 0.986, depth * 0.91],
              [hip - 14, -hemWidth, hemWidth, depth * 0.95],
              [hip + 4, -hemWidth * 0.98, hemWidth * 0.98, depth * 0.92],
          ];
    if (measured?.coat)
        for (const [i, row] of rows.entries())
            rows[i] = coatShirtSection(row, neck, hip, shoulder);
    d.s.tone = (_, y) =>
        0.99 - 0.23 * Math.exp(-((y - jaw - 3) ** 2) / (2 * 8 ** 2));
    d.drape("head", "upperChest", jaw - 5, neck + 1);
    const throat = crew ? crew.radius * 0.81 : 10.4;
    const throatDepth = crew
        ? Math.min(throat, Math.max(14, depth * 0.55) * 0.88)
        : 10.8;
    const bottom = crew
        ? Math.max(crew.top + crew.drop + 2, jaw + 1)
        : neck + 9;
    const neckRows: Section[] = crew
        ? [
              [
                  jaw - Math.max(14, g.head[1] * 0.14),
                  crew.center - throat,
                  crew.center + throat,
                  throatDepth,
              ],
              [
                  jaw - 3,
                  crew.center - throat,
                  crew.center + throat,
                  throatDepth,
              ],
              [
                  bottom,
                  crew.center - throat * 1.08,
                  crew.center + throat * 1.08,
                  throatDepth,
              ],
          ]
        : [
              [jaw - 13, -10, 10, 11],
              [jaw - 5, -10.7, 10.7, 10.6],
              [neck - 3, -10.4, 10.4, 10.8],
              [neck + 9, -15, 15, 14],
          ];
    d.body(neckRows, g.skin, false, crew ? 16 : 14);
    d.torso();
    d.s.tone = (x, y, z) => {
        const t = (y - neck) / bodyLength,
            flank = Math.abs(x) / shoulder;
        return (
            1 -
            0.12 *
                Math.exp(-((flank - 0.79) ** 2) / 0.032) *
                T.MathUtils.smoothstep(t, 0, 0.24) -
            0.13 * Math.exp(-((y - hip + 3) ** 2) / 26) -
            0.08 * T.MathUtils.smoothstep(-z, 0, depth) -
            0.21 *
                Math.exp(
                    -((flank - 0.78) ** 2) / 0.047 - (t - 0.24) ** 2 / 0.018
                ) -
            0.12 * Math.exp(-((t - 0.86 + flank * 0.1) ** 2) / 0.0008) * flank -
            0.1 *
                Math.exp(
                    -((t - 0.096) ** 2) / 0.014 - (x / (shoulder * 0.54)) ** 2
                )
        );
    };
    const front = profileDepth(rows);
    // Join the crew opening to the upper chest below its lowest front edge.
    // A horizontal cap at the throat folds the collar back into the shirt.
    const crewJoinY = rows[0][0] + Math.min(18, bodyLength * 0.09);
    const crewJoin = (a: number) => {
        if (!crew) return crewJoinY;
        const c = Math.cos(a);
        // The chest starts below the outer binding at every azimuth.
        // A join that climbs above an offset collar can fold over its side.
        const bandBottom =
            crew.top +
            Math.max(0, c) * (crew.drop + crew.binding) +
            Math.max(0, -c) * 1.8;
        return Math.max(
            bandBottom + 2,
            T.MathUtils.lerp(neck + 3.5, crewJoinY, c * c)
        );
    };
    const edge = (a: number) => {
        const x = Math.abs(Math.sin(a)),
            f = Math.cos(a) > 0;
        if (o.top === "tank") {
            if (x < 0.65) return neck + (f ? 27 : 13) * (1 - (x / 0.65) ** 3);
            return neck + 2 + (x > 0.82 ? 28 * ((x - 0.82) / 0.18) ** 1.5 : 0);
        }
        if (jacket || placket)
            return (
                neck -
                1 +
                (f ? openingDepth * bodyLength * Math.max(0, 1 - x / 0.64) : 0)
            );
        return crewJoin(a);
    };
    if (o.top === "crew") {
        const neckShape = {
            ...avatarStyles.cartoon.neckline,
            frontDrop: crew?.drop ?? Math.min(9, bodyLength * 0.05),
            backDrop: 1.8,
        };
        const rx =
            (crew?.radius ?? Math.max(12.3, shoulder * 0.35)) / neckShape.width;
        const rz = Math.max(14, depth * 0.55) / neckShape.depth;
        const cut: Section = [crew?.top ?? rows[0][0] - 0.8, -rx, rx, rz];
        const seam = loop(shirtSides, (a) =>
            sectionPoint(rows, a, crewJoin(a))
        );
        d.crewCollar(
            cut,
            seam,
            neckShape,
            o.color,
            crew ? o.trim : swatch(o.trim, ink, 0.14),
            g.skin,
            crew?.center,
            crew && { width: crew.binding, ink: crew.ink }
        );
    } else {
        const [y, l, r, rz] = rows[0],
            skin = jacket ? o.trim : g.skin;
        const shoulder = loop(24, (a) => [
            (l + r) / 2 + (r - l) * 0.5 * Math.sin(a),
            y,
            rz * Math.cos(a),
        ]);
        const throat = loop(24, (a) => [
            10.5 * Math.sin(a),
            y + 0.7,
            10 * Math.cos(a),
        ]);
        d.s.surface(
            [throat.map((): Point => [0, y + 2, 0]), throat, shoulder],
            skin,
            true
        );
        d.wrap(rows, () => y, edge, skin, 0, false, "end");
    }
    // Each stripe is part of the continuous shirt. Adjacent colors meet
    // on the same section, including at the side and back.
    const hemEdge = (a: number) =>
        hip + 4 - (measured?.hemRise ?? 0) * Math.sin(a) ** 2;
    let previous = edge;
    if (o.bands?.length) {
        for (const band of o.bands) {
            const prior = previous;
            const boundary = (a: number, level: number) =>
                Math.min(
                    hemEdge(a),
                    Math.max(
                        prior(a),
                        neck +
                            bodyLength *
                                (level + (band.bend ?? 0) * Math.sin(a) ** 2)
                    )
                );
            const top = (a: number) => boundary(a, band.start),
                bottom = (a: number) => boundary(a, band.end);
            d.wrap(rows, previous, top, o.color, 0, false, "both", shirtSides);
            d.wrap(rows, top, bottom, band.color, 0, false, "both", shirtSides);
            previous = bottom;
        }
    } else if (o.stripes?.length) {
        const stripeTop = () => neck + bodyLength * 0.54;
        d.wrap(
            rows,
            previous,
            stripeTop,
            o.color,
            0,
            false,
            "both",
            shirtSides
        );
        previous = stripeTop;
        o.stripes.forEach((paint, i) => {
            const lower = () => neck + bodyLength * (0.54 + (i + 1) * 0.075);
            d.wrap(rows, previous, lower, paint, 0, false, "both", shirtSides);
            previous = lower;
        });
    }
    const fabric = () =>
        d.wrap(rows, previous, hemEdge, o.color, 0, false, "both", shirtSides);
    const mark = measured?.shirtMark;
    if (mark) drawMarkedShirt(d, mark, fabric, mark.box);
    else fabric();
    if (measured?.hemRise)
        d.wrap(
            rows,
            hemEdge,
            () => hip + 4,
            o.trousers,
            0,
            false,
            "both",
            shirtSides
        );
    if (jacket || placket) {
        for (const sign of [-1, 1]) {
            // Sample the same angular knots as the fabric at the open placket.
            const rim = [3, 2, 1, 0].map((n) => {
                const a = (sign * n * Math.PI) / 12;
                return sectionPoint(rows, a, edge(a), 0.44);
            });
            if (jacket) {
                d.s.ribbon(rim, 0.85, swatch(o.color, ink, 0.36));
            } else if (o.buttons) {
                // A turned-down collar has a point on the chest. Its inner
                // edge follows the open neckline all the way to the placket.
                const inner = rim.map(
                    ([x, y]): Point => [x, y, front(x, y) + 0.9]
                );
                const wing = inner.map(([x, y], i): Point => {
                    const outward = [0, 0.22, 0.34, 0][i];
                    const drop = [0, 0.08, 0.115, 0][i];
                    const px = x + sign * shoulder * outward;
                    const py = y + bodyLength * drop;
                    return [px, py, front(px, py) + 1.55];
                });
                d.s.surface(
                    [inner, wing],
                    swatch(o.color, o.trim, 0.3),
                    true,
                    "perimeter"
                );
                d.s.ribbon(wing, 0.83, swatch(o.color, ink, 0.67));
                d.s.ribbon(inner, 0.76, swatch(o.color, ink, 0.56));
            } else {
                const [atNeck, fold, end] = rim;
                const x = fold[0] + sign * shoulder * 0.23,
                    y = fold[1] + bodyLength * 0.062;
                const point: Point = [x, y, front(x, y) + 1.4];
                d.s.surface(
                    [
                        [atNeck, atNeck],
                        [fold, point],
                        [end, end],
                    ],
                    swatch(o.color, ink, 0.14),
                    true
                );
                d.s.ribbon(
                    [atNeck, point, end],
                    0.52,
                    swatch(o.color, ink, 0.42)
                );
            }
        }
        if (placket && o.buttons) {
            const seamX = -shoulder * 0.035;
            const levels = [
                edge(0),
                ...rows.map(([y]) => y).filter((y) => y > edge(0)),
            ];
            d.s.ribbon(
                levels.map((y) => [seamX, y, front(seamX, y) + 0.65]),
                0.55,
                swatch(o.color, ink, 0.48)
            );
            const dye = swatch(o.trim, ink, 0.68);
            for (const at of o.buttons) {
                const y = neck + bodyLength * at;
                const radius = shoulder * 0.043;
                const center: Point = [0, y, front(0, y) + 1.15];
                const border = loop(8, (a) => {
                    const x = radius * Math.cos(a),
                        py = y + radius * Math.sin(a);
                    return [x, py, front(x, py) + 0.93];
                });
                d.s.surface(
                    [border, border.map(() => center)],
                    dye,
                    true,
                    "perimeter"
                );
            }
        }
        if (jacket) {
            for (const dy of [0.71, 0.81, 0.91]) {
                const y = neck + bodyLength * dy;
                d.s.oval([0, y, front(0, y) + 1.8], [1.9, 1.9, 1.0], o.trim);
            }
        }
    }
    if (measured?.seams?.shirt) stitchLines(d, measured.seams.shirt, front);
    if (measured?.hemRise) {
        const edge = loop(shirtSides, (a) =>
            sectionPoint(rows, a, hemEdge(a), 0.32)
        );
        d.s.line(edge, 0.6, swatch(o.color, ink, 0.67));
    }
    if (measured?.coat) {
        drawOpenCoat(d, measured.coat, neck, hip, shoulder, depth, front);
    }
    d.s.endTorso();
    d.s.tone = undefined;
    const layout = d.sourceJoints;
    const point = (bone: string) => layout.get(bone).point;
    for (const side of ["right", "left"]) {
        const a = point(side + "UpperArm"),
            e = point(side + "LowerArm"),
            w = point(side + "Hand");
        const arm =
                g.fit?.armRadius ??
                shoulder * (g.build === "broad" ? 0.2 : 0.205),
            long = jacket;
        d.drape(side + "UpperArm", side + "LowerArm", e[1] - arm, e[1] + arm);
        if (measured) {
            const sign = side === "right" ? -1 : 1;
            d.s.drape.weight = (x) =>
                T.MathUtils.smoothstep(
                    sign * x,
                    sign * e[0] - arm,
                    sign * e[0] + arm
                );
            const armDepth = (x: number) => {
                const along = sign * x;
                const [start, end] =
                    along <= sign * a[0]
                        ? [[0, 0, 0], a]
                        : along <= sign * e[0]
                        ? [a, e]
                        : [e, w];
                return T.MathUtils.lerp(
                    start[2],
                    end[2],
                    T.MathUtils.clamp(
                        (along - sign * start[0]) /
                            Math.max(0.001, sign * (end[0] - start[0])),
                        0,
                        1
                    )
                );
            };
            const ring = ([x, y, r]: [number, number, number]) => {
                const along = fittedArmX(g, sign, x);
                const z = armDepth(along);
                return loop(12, (t) => [
                    along,
                    y + r * Math.sin(t),
                    z + r * 0.94 * Math.cos(t),
                ]);
            };
            const fabric = measured.coat?.sleeves ?? o.color;
            const cut = o.top === "tank" ? 0 : measured.sleeve;
            const sleeve = measured.arm.filter((row) => row[0] <= cut + 0.02),
                skin = measured.arm.filter((row) => row[0] >= cut - 0.02);
            if (sleeve.length > 1) {
                const first = sleeve[0];
                const innerX = crew
                    ? Math.min(
                          first[0],
                          Math.max(
                              first[0] * 0.55,
                              sign * crew.center + crew.radius + crew.binding
                          )
                      )
                    : first[0] * 0.55;
                d.s.surface(
                    [
                        ring([innerX, first[1], first[2] * 0.65]),
                        ...sleeve.map(ring),
                    ],
                    fabric
                );
            }
            if (sleeve.length > 1 && skin.length > 1) {
                const [x, y, r] = sleeve.at(-1);
                d.s.surface(
                    [
                        ring([x - 0.55, y, r * 1.012]),
                        ring([x + 0.35, y, r * 1.02]),
                        ring([x + 0.35, y, r * 0.93]),
                    ],
                    swatch(fabric, ink, 0.45),
                    true,
                    "both"
                );
            }
            if (skin.length > 1) {
                const rings = skin.map(ring);
                const [x, y] = skin.at(-1);
                rings.push(
                    rings
                        .at(-1)
                        .map((): Point => [fittedArmX(g, sign, x), y, w[2]])
                );
                d.s.surface(rings, g.skin);
            }
        } else {
            if (o.top === "tank") {
                const cap: Point = [a[0] * 0.72, a[1] + 5, a[2]];
                d.s.sweep(
                    [
                        cap,
                        between(a, e, 0.12),
                        between(a, e, 0.5),
                        e,
                        between(e, w, 0.57),
                        w,
                    ],
                    [
                        arm * 0.5,
                        arm,
                        arm * 0.96,
                        arm * 0.84,
                        arm * 0.79,
                        arm * 0.55,
                    ],
                    g.skin,
                    10
                );
            } else if (long) {
                d.s.sweep(
                    [between(e, w, 0.84), w],
                    [arm * 0.65, arm * 0.54],
                    g.skin,
                    9
                );
            } else {
                const cuff = between(a, e, g.fit?.sleeveFraction ?? 0.57);
                d.s.tone = (_x, y) =>
                    1 -
                    0.27 *
                        Math.exp(
                            -((y - cuff[1] - 1) ** 2) / (arm * arm * 0.57)
                        );
                d.s.sweep(
                    [
                        between(a, e, (g.fit?.sleeveFraction ?? 0.57) * 0.81),
                        between(a, e, 0.73),
                        between(a, e, 0.95),
                        e,
                        between(e, w, 0.105),
                        between(e, w, 0.32),
                        between(e, w, 0.7),
                        w,
                    ],
                    [
                        arm * 0.89,
                        arm * 0.95,
                        arm * 0.86,
                        arm * 0.86,
                        arm * 0.9,
                        arm * 0.96,
                        arm * 0.67,
                        arm * 0.55,
                    ],
                    g.skin,
                    9
                );
            }
            if (o.top !== "tank") {
                const end = long
                    ? between(e, w, 0.93)
                    : between(a, e, g.fit?.sleeveFraction ?? 0.57);
                const shirt = arm * 1.49;
                const inset: Point = [a[0] * 0.46, a[1] + shirt * 0.18, a[2]];
                const cuff = between(a, end, 0.93);
                d.s.tone = (x, y, z) => {
                    const t = T.MathUtils.smoothstep(y, a[1], end[1]);
                    const sideShadow = T.MathUtils.smoothstep(
                        arm - Math.abs(x - a[0]),
                        0,
                        arm
                    );
                    return (
                        1 -
                        0.22 * sideShadow * Math.sin(Math.PI * t) -
                        0.16 * Math.exp(-((t - 0.93) ** 2) / 0.002) -
                        0.07 * T.MathUtils.smoothstep(-z, 0, arm)
                    );
                };
                const shoulderCap: Point = [
                    a[0] * 0.9,
                    a[1] + shirt * 0.57,
                    a[2],
                ];
                const path: Point[] = [
                    inset,
                    shoulderCap,
                    between(a, e, 0.21),
                    long ? e : between(a, end, 0.63),
                    long ? between(e, w, 0.81) : cuff,
                    end,
                    between(long ? e : a, end, 0.985),
                ];
                const radii = [
                    0.36,
                    0.85,
                    1,
                    1.015,
                    long ? 0.7 : 0.96,
                    long ? 0.67 : 0.96,
                    long ? 0.58 : 0.83,
                ];
                const rings = path.map((p, i) => {
                    const prev = path[Math.max(0, i - 1)],
                        next = path[Math.min(i + 1, path.length - 1)];
                    // The last row turns into the cuff, keeping the same axis as the mouth.
                    const tangent =
                        i === path.length - 1 || i === path.length - 2
                            ? new T.Vector3(...end)
                                  .sub(new T.Vector3(...path[path.length - 3]))
                                  .normalize()
                            : new T.Vector3(...next)
                                  .sub(new T.Vector3(...prev))
                                  .normalize();
                    const right = new T.Vector3()
                        .crossVectors(tangent, new T.Vector3(0, 0, 1))
                        .normalize();
                    const forward = right.clone().cross(tangent).normalize();
                    return loop(
                        12,
                        (angle) =>
                            new T.Vector3(...p)
                                .addScaledVector(
                                    right,
                                    shirt * radii[i] * Math.sin(angle)
                                )
                                .addScaledVector(
                                    forward,
                                    shirt * radii[i] * Math.cos(angle)
                                )
                                .toArray() as Point
                    );
                });
                // Skin both sides of the upper-arm seam from the very same ring.
                // The inner shoulder follows the chest when the elbow swings.
                d.drape("upperChest", side + "UpperArm", 0, 1);
                d.s.drape.weight = (x, y) =>
                    Math.max(
                        T.MathUtils.smoothstep(
                            Math.abs(x),
                            Math.abs(a[0]) * 0.48,
                            Math.abs(a[0]) * 0.93
                        ),
                        T.MathUtils.smoothstep(
                            y,
                            a[1] + 1,
                            path[2][1] - arm * 0.1
                        )
                    );
                d.s.surface(rings.slice(0, 3), o.color, true, "end");
                d.drape(
                    side + "UpperArm",
                    side + "LowerArm",
                    e[1] - arm,
                    e[1] + arm
                );
                d.s.surface(rings.slice(2), o.color, true, "start");
            }
        }
        d.s.tone = undefined;
        drawFittedHand(
            d,
            side,
            g.skin,
            g.parts?.hands ?? "classic",
            measured?.arm.at(-1)[2] ?? arm * 0.55
        );
        const sign = side === "right" ? -1 : 1;
        const thigh = point(side + "UpperLeg"),
            knee = point(side + "LowerLeg"),
            ankle = point(side + "Foot");
        const leg = g.fit?.legRadius ?? waist * 0.47;
        const section = (p: Point, r: number): Section => [
            p[1],
            p[0] - r,
            p[0] + r,
            r,
            p[2],
        ];
        const rows: Section[] = measured
            ? measured.leg.map(([y, c, r]) =>
                  section([pelvisX + sign * c, y, 0], r)
              )
            : [
                  section(between(thigh, knee, 0.23), leg * 1.04),
                  section(between(thigh, knee, 0.54), leg),
                  section(knee, leg * 0.85),
                  section(between(knee, ankle, 0.5), leg * 0.82),
                  section(ankle, leg * 0.68),
              ];
        const waistRadius = Math.min(
            measured?.pelvis[0][1] ?? waist * 0.87,
            (measured?.torso.at(-1)[1] ?? waist) * 0.91
        );
        const waistY = Math.min(
            measured?.pelvis[0][0] ?? hip,
            rows[0][0] - 2,
            hip - (measured?.hemRise ?? 0) - 1.5
        );
        const top: Section = [
            waistY,
            pelvisX + (sign < 0 ? -waistRadius : 0),
            pelvisX + (sign > 0 ? waistRadius : 0),
            depth * 0.8,
            0,
        ];
        const forkY = T.MathUtils.clamp(
            measured?.pelvis.at(-1)[0] ?? hip + leg * 0.94,
            waistY + 0.5,
            rows[1][0] - 1.5
        );
        const split: Section = [...rows[0]];
        split[0] = Math.max(rows[0][0], forkY + 0.65);
        const next = rows.findIndex((r) => r[0] >= knee[1]);
        const k = T.MathUtils.clamp(
            next < 0 ? rows.length - 2 : next,
            1,
            rows.length - 2
        );
        const upper = [top, split, ...rows.slice(1, k + 1)];
        const source = g.parts?.legs ?? "classic";
        const fitted = fitPartDepth(upper, source, "thigh");
        fitted[0] = top;
        const join = fitted.at(-1);
        const lower = fitPartDepth(rows.slice(k), source, "shin", join[4]);
        lower[0] = join;
        const thighBone = side + "UpperLeg",
            shinBone = side + "LowerLeg";
        // Slender trouser legs need fewer meridians than a wide or baggy cut.
        const sides =
            d.s.detail === "crowd"
                ? 8
                : g.household?.portraitPreset === "lean-teen"
                ? 10
                : 12;
        trouserLeg(
            d,
            {
                bone: thighBone,
                profile: fitted,
                inseam: { center: pelvisX, drop: forkY - waistY },
            },
            o.trousers,
            true,
            sides,
            measured?.seams?.trousers
                ? (rings) =>
                      stitchLines(
                          d,
                          measured.seams.trousers,
                          frontOfLoft(rings)
                      )
                : undefined
        );
        trouserShin(d, lower, thighBone, shinBone, o.trousers, leg, sides);
        d.bind(side + "Foot");
        if (measured) {
            const sideSign = sign;
            const outline = measured.shoe.map(
                ([y, c, r], i): Section => [
                    y,
                    pelvisX + sideSign * c - r,
                    pelvisX + sideSign * c + r,
                    r * 1.2,
                    3 + (7 * i) / (measured.shoe.length - 1),
                ]
            );
            const shoe = fitPartDepth(
                outline,
                g.parts?.feet ??
                    (o.footwear === "sneaker" ? "sunshine" : "classic"),
                "foot",
                2
            );
            const start = shoe[0],
                end = rows.at(-1);
            const floor = measured.outsole
                ? Math.max(
                      start[0] + 3,
                      Math.min(...measured.outsole.rows.map((r) => r[1])) + 10
                  )
                : start[0] + 3;
            const ankleRows = measured.ankle?.map(([y, c, r]) =>
                section([pelvisX + sign * c, y, 0], r)
            );
            if (ankleRows) {
                const a: Section = [...ankleRows[0]],
                    b: Section = [...ankleRows.at(-1)];
                a[0] = Math.min(end[0] - 2, a[0] - 1);
                b[0] = Math.max(b[0] + 1, floor);
                d.body([a, ...ankleRows, b], g.skin, false, 12);
            } else {
                const a = (end[1] + end[2]) / 2,
                    b = (start[1] + start[2]) / 2;
                d.body(
                    [
                        section([a, end[0] - 2, 0], (end[2] - end[1]) * 0.35),
                        section([b, floor, 1], (start[2] - start[1]) * 0.35),
                    ],
                    g.skin,
                    false,
                    12
                );
            }
            if (measured.outsole)
                drawSole(d, shoe, measured.outsole, pelvisX, sideSign, o.shoes);
            else {
                d.s.paintBand = {
                    height: shoe.at(-1)[0] - 3,
                    color: swatch(o.shoes, ink, 0.46),
                };
                d.body(shoe, o.shoes, false, 16);
                d.s.paintBand = undefined;
                shoeDetails(d, shoe, o.shoes, o.footwear ?? "flat");
            }
            continue;
        }
        const x = ankle[0],
            floor = g.height;
        const outline: Section[] = [
            [floor - 26, x - leg * 0.55, x + leg * 0.55, leg * 0.75, 1],
            [floor - 17, x - leg * 0.73, x + leg * 0.73, leg * 0.99, 4],
            [floor - 10, x - leg * 0.91, x + leg * 0.91, leg * 1.45, 9],
            [floor - 4, x - leg * 0.94, x + leg * 0.94, leg * 1.45, 9],
            [floor, x - leg * 0.9, x + leg * 0.9, leg * 1.38, 9],
        ];
        if (g.fit)
            for (const row of outline)
                row[0] = floor + ((row[0] - floor) * g.fit.cuffHeight) / 20;
        const shoe = fitPartDepth(
            outline,
            g.parts?.feet ??
                (o.footwear === "sneaker" ? "sunshine" : "classic"),
            "foot",
            ankle[2]
        );
        d.s.paintBand = {
            height: floor - 3.5,
            color: swatch(o.shoes, ink, 0.46),
        };
        d.body(shoe, o.shoes, false, 14);
        d.s.paintBand = undefined;
        shoeDetails(d, shoe, o.shoes, o.footwear ?? "flat");
    }
}
export function drawCartoonHumanoid(d: Drawing, design: CartoonDesign) {
    const g = hairBehindEars(fitBobDepth(design));
    const [w, h] = g.head,
        { jaw, neck, shoulder, hip } = proportions(g);
    d.s.sculptedCartoon = true;
    d.s.penOutline = !!g.household?.penOutline;
    d.s.inkedPortrait =
        !!g.household || !!g.fit?.sections?.eyes?.some((eye) => eye.rimInk);
    d.s.triangleBudget = g.fit?.triangleBudget;
    d.s.simplification = g.fit?.sections
        ? { error: 0.024, relative: 0.084, fraction: 0.32 }
        : { error: 0.018, relative: 0.065, fraction: 0.38 };
    const coat = g.fit?.sections?.coat;
    d.s.palette({
        ...(coat && {
            [coat.color]: finish.cloth,
            [coat.sleeves]: finish.cloth,
        }),
        [g.skin]: finish.skin,
        [g.hair.color]: finish.fiber,
        [g.outfit.color]: finish.cloth,
        [g.outfit.trousers]: finish.cloth,
        [g.outfit.shoes]: finish.cloth,
        [ivory]: finish.enamel,
    });
    d.s.ambientByPaint = {
        ...(coat && { [coat.color]: 0.91, [coat.sleeves]: 0.89 }),
        [g.skin]: g.fit?.sections ? 0.94 : 0.74,
        [g.hair.color]: g.fit?.sections ? 0.93 : 0.72,
        [ivory]: 0.98,
        [g.outfit.color]: g.fit?.sections ? 0.9 : 0.76,
        [g.outfit.trousers]: 0.73,
    };
    d.s.skinShadows = [
        { center: [0, jaw + 2, 4], radii: [20, 15, 22], opacity: 0.24 },
        { center: [0, neck + 2, 2], radii: [21, 9, 18], opacity: 0.18 },
        ...[-1, 1].map((s) => ({
            center: [s * shoulder, neck + (hip - neck) * 0.35, 0] as Point,
            radii: [18, 14, 20] as Point,
            opacity: 0.18,
        })),
    ];
    clothing(d, g);
    d.bind("head");
    d.s.cheeks = [-1, 1].map((s) => ({
        x: s * w * 0.32,
        y: 12 + h * 0.66,
        rx: w * 0.125,
        ry: h * 0.079,
        strength: 0.39,
    }));
    if (g.portraitStudy) {
        d.s.fineDetail = true;
        // A measured portrait is a reusable feature block in the same outfit
        // recipe. Fit its drawing coordinates to the new skull and jaw landmarks.
        const sheet = portraits[g.portraitStudy].sections;
        const left = Math.min(...sheet.map((r) => r[1])),
            right = Math.max(...sheet.map((r) => r[2]));
        const y = sheet[0][0],
            scale = w / (right - left);
        d.s.referenceFrame = new T.Matrix4()
            .makeTranslation(0, 12, 0)
            .multiply(
                new T.Matrix4().makeScale(
                    scale,
                    h / (sheet.at(-1)[0] - y),
                    scale
                )
            )
            .multiply(
                new T.Matrix4().makeTranslation(-(left + right) / 2, -y, 0)
            );
        drawHead(
            d,
            g.portraitStudy,
            { skin: g.skin, hair: g.hair.color },
            {
                gaze: g.gaze,
                pupil: g.pupil,
                brow: g.brow,
                mouth: g.mouth,
                skull: g.skull,
                tailFall: g.hair.fall,
                noseProjection: g.face?.noseProjection,
            }
        );
        d.s.referenceFrame = undefined;
        return;
    }
    d.s.fineDetail = true;
    const sections = headSections(g),
        under = profileDepth(sections, 1, true);
    const mark = (
        xf: number,
        yf: number,
        rx: number,
        ry: number,
        opacity: number
    ) => {
        const x = w * xf,
            y = 12 + h * yf;
        return {
            center: [x, y, under(x, y) + 1] as Point,
            radii: [rx * w, ry * h, w * 0.16] as Point,
            opacity,
        };
    };
    const eyeY = g.face?.eyeHeight ?? 0.47,
        eyeX = g.face?.eyeSpacing ?? 0.196;
    d.s.skinShadows.push(
        ...[-1, 1].flatMap((s) => [
            mark(s * eyeX, eyeY - 0.075, 0.18, 0.055, 0.21),
            mark(s * eyeX, eyeY + 0.095, 0.18, 0.047, 0.14),
        ]),
        mark(0.025, g.face?.noseBase ?? 0.64, 0.105, 0.047, 0.25),
        mark(0, (g.face?.mouthHeight ?? 0.775) + 0.044, 0.15, 0.035, 0.16)
    );
    const jawInk = !g.fit?.sections?.sideGuide && g.fit?.sections?.chin;
    d.s.tone = (x, y, z) => {
        const tone =
            1 -
            0.12 *
                T.MathUtils.smoothstep(y, 12 + h * 0.7, jaw) *
                T.MathUtils.smoothstep(-z, -w * 0.45, 0);
        if (!jawInk || x < jawInk[0][0] || x > jawInk.at(-1)[0]) return tone;
        // The frontal ink follows the occlusion boundary between jaw and neck.
        // Bake its shadow into the jaw so a turn cannot expose a floating line.
        const i = Math.max(
            1,
            jawInk.findIndex((p) => p[0] >= x)
        );
        const [x0, y0] = jawInk[i - 1],
            [x1, y1] = jawInk[i];
        const edge = T.MathUtils.lerp(
            y0,
            y1,
            (x - x0) / Math.max(0.01, x1 - x0)
        );
        return (
            tone *
            (1 - 0.24 * T.MathUtils.smoothstep(y, edge - h * 0.044, edge))
        );
    };
    if (g.household) {
        const face = drawHouseholdHead(d, g, sections);
        d.s.tone = undefined;
        features(d, g, face, undefined);
        d.s.fineDetail = false;
        return;
    }
    const stations = cranialStations(g, sections);
    const bob = g.fit?.sections?.nape && g.fit.sections.hair;
    const skull =
        stations && !bob ? cranialSurfaces(d, stations, g.skin) : undefined;
    const base = skull?.front ?? (stations ? cranialDepth(stations, 1) : under);
    const orbits = scaleEyeDepth(fittedOrbits(g, base), g.face?.eyeDepthScale);
    const face =
        skull?.front ??
        (bob
            ? drawBobHead(d, g, sections, orbits, stations)
            : d.paintedHead(sections, g.skin));
    d.s.tone = (x, y, z) =>
        0.93 +
        0.07 * Math.cos((2.8 * x) / w + (2 * y) / h) -
        0.16 *
            T.MathUtils.smoothstep(y, 12 + h * 0.63, jaw) *
            T.MathUtils.smoothstep(-z, -w * 0.35, w * 0.28);
    scalp(d, g, sections, face, skull?.back);
    d.s.tone = undefined;
    features(d, g, face, orbits);
    d.s.fineDetail = false;
}
