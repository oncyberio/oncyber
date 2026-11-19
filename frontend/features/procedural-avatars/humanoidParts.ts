import * as T from "three/webgpu";
import classic from "./rick-classic.json";
import sunshine from "./sunshine.json";
import sunshineJoints from "./sunshine-rig.json";
import { headDepth, type Drawing, type Section, type XY } from "./drawing";
import type { Point } from "./sculpt";

export type PartSource = "classic" | "sunshine";
type Part = "thigh" | "shin" | "foot" | "palm";
export type PartFit = {
    skull?: PartSource;
    jaw?: PartSource;
    legs?: PartSource;
    feet?: PartSource;
    hands?: PartSource;
    /** Angle in degrees from palm down toward the drawing plane. */
    palmRoll?: number;
    handPitch?: number;
};

const shoulderReferences = [classic.joints, sunshineJoints].map((joints) => {
    const width = joints.leftUpperArm[0] - joints.neck[0];
    return {
        proportion: width / (joints.hips[1] - joints.neck[1]),
        depth: [joints.leftUpperArm, joints.leftLowerArm, joints.leftHand].map(
            (joint) => (joint[2] - joints.neck[2]) / width
        ),
    };
});

/** Infer the arm plane from the two measured T-poses. Narrow builds carry
 * their shoulders behind the neck. Broader builds approach Sunshine's stance. */
export function fittedArmPlane(shoulder: number, trunkHeight: number): Point {
    const [narrow, broad] = shoulderReferences;
    const mix = T.MathUtils.smoothstep(
        shoulder / trunkHeight,
        narrow.proportion,
        broad.proportion
    );
    return narrow.depth.map(
        (v, i) => shoulder * T.MathUtils.lerp(v, broad.depth[i], mix)
    ) as Point;
}

/** Both benchmark fits already contain the depth missing from a single
 * drawing. Read those existing contours once per part, in their own units. */
const profiles = new Map<string, Section[]>();
export function referenceSections(
    source: PartSource,
    part: Part
): readonly Section[] {
    const key = source + "/" + part;
    if (!profiles.has(key)) {
        let rows: Section[];
        if (source === "classic") {
            const name = {
                thigh: "thigh",
                shin: "shin",
                foot: "shoe",
                palm: "palm",
            }[part];
            rows = classic.lofts
                .find((loft) => loft.name === name)
                .rows.map(([along, ...coords]) => {
                    const across = coords.filter((_, i) => i % 2 === 0);
                    const depths = coords.filter((_, i) => i % 2 === 1);
                    const front = Math.max(...depths),
                        back = Math.min(...depths);
                    return [
                        along,
                        Math.min(...across),
                        Math.max(...across),
                        (front - back) / 2,
                        (front + back) / 2,
                    ];
                });
        } else {
            const bone = {
                thigh: "leftUpperLeg",
                shin: "leftLowerLeg",
                foot: "leftFoot",
                palm: "leftHand",
            }[part];
            const shape = sunshine.parts.find(
                (p) =>
                    p.bone === bone &&
                    (part === "palm" ? p.across : p.profile) &&
                    (part === "thigh"
                        ? p.name === "leftShort"
                        : part === "shin"
                        ? p.name === "leftSock"
                        : true)
            );
            rows = (shape.across ?? shape.profile) as Section[];
        }
        profiles.set(key, rows);
    }
    return profiles.get(key);
}

function sample(rows: readonly Section[], y: number): Section {
    const next = rows.findIndex((row) => row[0] >= y);
    const i = next < 0 ? rows.length - 1 : Math.max(1, next);
    const lo = rows[i - 1],
        hi = rows[i];
    const t = T.MathUtils.clamp((y - lo[0]) / (hi[0] - lo[0]), 0, 1);
    return lo.map((v, j) => T.MathUtils.lerp(v, hi[j], t)) as Section;
}

// Horizontal sections of the eye in Rick's fitted OBJ. Keep the slight
// fore–aft asymmetry of the upper and lower halves when fitting a new eye.
function globeSections(name: "eyes" | "pupils"): Section[] {
    return classic.lofts
        .find((part) => part.name === name)
        .rows.map(([y, ...coords]) => {
            const xs = coords.filter((_, i) => i % 2 === 0);
            const zs = coords.filter((_, i) => i % 2 === 1);
            const front = Math.max(...zs),
                back = Math.min(...zs);
            return [
                y,
                Math.min(...xs),
                Math.max(...xs),
                (front - back) / 2,
                (front + back) / 2,
            ];
        });
}
const widest = (sections: Section[]) =>
    sections.reduce((a, b) => (a[2] - a[1] > b[2] - b[1] ? a : b));
const eyeSections = globeSections("eyes");
const equator = widest(eyeSections);
const pigment = widest(globeSections("pupils"));
const whiteAtPigment = sample(eyeSections, pigment[0]);
// Offset of the fitted pigment's center from the white, in pupil radii.
export const classicPupilOffset =
    (pigment[4] - whiteAtPigment[4] - whiteAtPigment[3]) /
    ((pigment[2] - pigment[1]) / 2);
const globeWidth = equator[2] - equator[1];
export const classicEyeDepthRatio = (2 * equator[3]) / globeWidth;

/** Clip the measured globe to this drawing's upper and lower lid. Place its
 * equator at the level of the two outermost points of the visible white. */
export function fitEyeDepth(
    outline: XY[],
    top: number,
    bottom: number,
    centerDepth: number,
    exposedDepth: number
): [number, number, number][] | undefined {
    if (!outline.length || bottom <= top || exposedDepth <= 0) return undefined;
    const left = outline.reduce((a, b) => (a[0] < b[0] ? a : b));
    const right = outline.reduce((a, b) => (a[0] > b[0] ? a : b));
    const scale = (right[0] - left[0]) / globeWidth;
    if (scale <= 0) return undefined;
    const centerY = (left[1] + right[1]) / 2;
    const stations = eyeSections.map(
        ([y]) => (centerY + (y - equator[0]) * scale - top) / (bottom - top)
    );
    const depthScale = exposedDepth / (2 * equator[3]);
    return [0, ...stations.filter((t) => t > 0.000001 && t < 0.999999), 1].map(
        (t) => {
            const y = T.MathUtils.lerp(top, bottom, t);
            const [, , , radius, center] = sample(
                eyeSections,
                equator[0] + (y - centerY) / scale
            );
            const z = centerDepth + (center - equator[4]) * depthScale;
            return [t, z - radius * depthScale, z + radius * depthScale];
        }
    );
}

// Use the intact vault and chin. The middle of the fitted Rick skull includes
// an open mouth and inset eye sockets, both drawn separately on a new face.
const skull = classic.lofts.find((part) => part.name === "skull").rows;
// Central bridge and eye apex at the same latitude in the fitted OBJ.
const bridge = skull.map(([y, , z]): Section => [y, z, z, 0]);
export const classicEyeProjection =
    (equator[3] + equator[4] - sample(bridge, equator[0])[1]) / globeWidth;
const crown = skull[0][0],
    chin = skull.at(-1)[0];
const skullProfile: Section[] = skull.flatMap(([y, ...pairs]) => {
    const t = (y - crown) / (chin - crown);
    if (t > 0.29 && t < 0.86) return [];
    const xs = pairs.filter((_, i) => i % 2 === 0);
    const zs = pairs.filter((_, i) => i % 2 === 1);
    return [[t, 0, 2 * Math.max(...xs), Math.min(...zs), Math.max(...zs)]];
});
const skullWidth = Math.max(...skullProfile.map((row) => row[2]));
export const classicSkullAspect =
    Math.max(
        ...skull.map(
            (row) => 2 * Math.max(...row.slice(1).filter((_, i) => i % 2 === 0))
        )
    ) /
    (chin - crown);

/** Preserve the drawn face width; fit its sagittal contour over the neck. */
export function fitSkullDepth(rows: Section[], width: number): Section[] {
    const top = rows[0][0],
        height = rows.at(-1)[0] - top;
    return rows.map(([y, left, right]) => {
        const t = (y - top) / height;
        const [, , , rear, front] = sample(skullProfile, t);
        // Both measured polar sections have finite area. Converge to their
        // measured center at the drawing's poles, including the forward chin.
        const pole = Math.min(1, Math.sqrt(Math.min(t, 1 - t) * 100));
        const span = (front - rear) * (width / skullWidth) * pole;
        const z = ((front + rear) * 0.5 * width) / skullWidth;
        const radius = span / (1 - headDepth(y, rows, -1, 1));
        return [y, left, right, radius, z + span * 0.5 - radius];
    });
}

/** The image supplies width and length. The reference supplies the instep,
 * calf and heel in depth, including their front-to-back centerline. */
export function fitPartDepth(
    rows: Section[],
    source: PartSource,
    part: Part,
    anchor = 0
): Section[] {
    const ref = referenceSections(source, part);
    const width = (s: readonly Section[]) =>
        Math.max(...s.map((r) => r[2] - r[1]));
    const first = ref[0],
        last = ref.at(-1);
    const scale = width(rows) / width(ref);
    const height = rows.at(-1)[0] - rows[0][0];
    return rows.map(([y, left, right]) => {
        const t = (y - rows[0][0]) / height;
        const s = sample(ref, T.MathUtils.lerp(first[0], last[0], t));
        return [
            y,
            left,
            right,
            Math.max(0.3, s[3] * scale),
            anchor + ((s[4] ?? 0) - (first[4] ?? 0)) * scale,
        ];
    });
}

/** Use the same pad, distal joint and rounded end from the fitted Rick hand.
 * The path can be mirrored from the OBJ or come from another humanoid rig. */
export function drawDigit(
    d: Drawing,
    side: string,
    name: string,
    path: Point[],
    radii: number[],
    paint: string,
    cap: number,
    sides = name === "Little" ? 4 : 5
) {
    const bones = (
        name === "Thumb"
            ? ["Metacarpal", "Proximal", "Distal"]
            : ["Proximal", "Intermediate", "Distal"]
    ).map((j) => side + name + j);
    const tip = new T.Vector3(...path.at(-1));
    const tangent = tip
        .clone()
        .sub(new T.Vector3(...path.at(-2)))
        .normalize();
    d.bind(bones[0]);
    d.s.sweep(
        [...path, tip.addScaledVector(tangent, cap).toArray() as Point],
        [...radii, 0],
        paint,
        sides,
        bones
    );
}

/** Scale the benchmark palm between this wrist and this set of knuckles;
 * the five articulated finger chains and the item socket use the same basis. */
export function drawFittedHand(
    d: Drawing,
    side: string,
    paint: string,
    source: PartSource,
    wristRadius: number
) {
    const joint = (bone: string) =>
        new T.Vector3(...d.sourceJoints.get(side + bone).point);
    const wrist = joint("Hand"),
        index = joint("IndexProximal"),
        little = joint("LittleProximal");
    const middle = index.clone().lerp(little, 0.5),
        along = middle.clone().sub(wrist).normalize();
    const across = index.clone().sub(little).normalize();
    across.addScaledVector(along, -across.dot(along)).normalize();
    const normal = along.clone().cross(across).normalize();
    const half = index.distanceTo(little) / 2;
    const fingerWidth = half * 0.38;
    const thumb = joint("ThumbMetacarpal").sub(wrist);
    const thumbT = thumb.dot(along) / wrist.distanceTo(middle);
    const profile = referenceSections(source, "palm");
    const maxWidth = Math.max(...profile.map((p) => (p[2] - p[1]) / 2));
    const maxDepth = Math.max(...profile.map((p) => p[3]));
    const sides = d.s.detail === "crowd" ? 6 : 8;
    const thenarReach = thumb.dot(across);
    const rows = [0, 0.24, 0.55, 0.8, 1].map((t) => {
        const [, left, right, depth] = sample(
            profile,
            T.MathUtils.lerp(profile[0][0], profile.at(-1)[0], t)
        );
        const axis = wrist.clone().lerp(middle, t * 1.1 - 0.035);
        const fade = T.MathUtils.smoothstep(t, 0, 0.34);
        const width = T.MathUtils.lerp(
            wristRadius,
            ((right - left) / (2 * maxWidth)) * (half + fingerWidth),
            fade
        );
        const thickness = T.MathUtils.lerp(
            wristRadius * 0.92,
            (depth / maxDepth) * Math.max(fingerWidth, half * 0.44),
            fade
        );
        return Array.from({ length: sides + 1 }, (_, i): Point => {
            const angle = (i * Math.PI * 2) / sides;
            const thenar =
                Math.max(0, thenarReach + fingerWidth - width) *
                Math.exp(-((t - thumbT) ** 2) / 0.08) *
                Math.max(0, Math.cos(angle));
            return axis
                .clone()
                .addScaledVector(across, (width + thenar) * Math.cos(angle))
                .addScaledVector(normal, thickness * Math.sin(angle))
                .toArray() as Point;
        });
    });
    const cap = middle.clone().lerp(wrist, -0.065).toArray() as Point;
    d.bind(side + "Hand");
    d.s.surface([...rows, rows.at(-1).map(() => cap)], paint);
    for (const finger of classic.fingers) {
        const names =
            finger.name === "Thumb"
                ? ["Metacarpal", "Proximal", "Distal"]
                : ["Proximal", "Intermediate", "Distal"];
        const path = names.map((b) => joint(finger.name + b));
        const end = path[2].clone().sub(path[1]).add(path[2]);
        const radii =
            source === "classic"
                ? finger.radii
                : sunshine.parts
                      .find(
                          (p) =>
                              p.bone === "left" + finger.name + names[0] &&
                              p.sweep
                      )
                      .widths.slice(0, 4);
        const radius = fingerWidth * (finger.name === "Little" ? 0.8 : 1);
        drawDigit(
            d,
            side,
            finger.name,
            [...path, end].map((v) => v.toArray() as Point),
            radii.map((value) =>
                Math.max(radius * 0.33, (value / radii[0]) * radius)
            ),
            paint,
            radius * 0.48,
            d.s.detail === "crowd" || radius < 2.6 || finger.name === "Little"
                ? 4
                : 5
        );
    }
}
