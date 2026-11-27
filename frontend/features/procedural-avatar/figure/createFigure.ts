import * as THREE from "three/webgpu";
import {
    FIGURE_FORMAT,
    FIGURE_MATERIALS,
    partId,
    type FigureInfo,
} from "./format";
import {
    BROW_SHADOW_REACH,
    createFigureMaterials,
    type FigureFrames,
} from "./shading";
import {
    depthFinder,
    eyeWarp,
    faceLevels,
    faceMarks,
    faceWarp,
    layBrow,
    levelsWarp,
    measureBrow,
    openingFrame,
    outlineWarp,
    renewNormals,
    roundEar,
    silhouette,
    warpGeometry,
    wearMorphs,
    type BrowLine,
    type EarFrame,
    type ShapeGeometry,
} from "./shape";
import type { FigureStyle } from "./style";

/** What this needs of a loaded VRM. */
interface Vrm {
    scene: THREE.Object3D;
    humanoid: { getRawBoneNode(name: string): THREE.Object3D | null };
}

/** Where the brow's line runs on the figure's own strip, by default. */
const OWN_BROW = [
    { along: 0.1, up: 0.44 },
    { along: 0.32, up: 0.49 },
    { along: 0.55, up: 0.5 },
    { along: 0.78, up: 0.46 },
    { along: 0.95, up: 0.38 },
];

const shapeOf = (mesh: THREE.Mesh): ShapeGeometry => ({
    position: mesh.geometry.attributes.position.array as Float32Array,
    morphs: (mesh.geometry.morphAttributes.position || []).map(
        (attribute) => attribute.array as Float32Array
    ),
});

/**
 * Make a loaded figure into a character: reshape its face, lay its brows
 * and replace its materials with ones that draw the style. The figure is
 * changed in place, so load one for each character.
 */
export function styleFigure(vrm: Vrm, style: FigureStyle) {
    const info = vrm.scene.userData.figure as FigureInfo | undefined;
    if (!info || info.format !== FIGURE_FORMAT)
        throw new Error("Not a figure this version can style");
    const found: Partial<Record<"body" | "face" | "ink", THREE.SkinnedMesh>> =
        {};
    vrm.scene.traverse((object) => {
        const mesh = object as THREE.SkinnedMesh;
        if (!mesh.isSkinnedMesh) return;
        const name = (mesh.material as THREE.Material).name;
        for (const key of ["body", "face", "ink"] as const)
            if (name === FIGURE_MATERIALS[key]) found[key] = mesh;
    });
    const { body, face, ink } = found;
    if (!body || !face || !ink) throw new Error("The figure is incomplete");
    // Under the names the shaders read them by.
    for (const mesh of [body, face, ink]) {
        const { geometry } = mesh;
        if (geometry.hasAttribute("_part"))
            geometry.setAttribute("part", geometry.getAttribute("_part"));
        if (geometry.hasAttribute("_bake"))
            geometry.setAttribute("bake", geometry.getAttribute("_bake"));
    }

    const facePosition = face.geometry.attributes.position;
    const facePart = face.geometry.getAttribute("part");
    const isSkin = (v: number) =>
        Math.round(facePart.getX(v) * 255) === partId("skin");
    const { eyes, mouth } = info.landmarks;
    const mean = (vertices: number[], axis: number) =>
        vertices.reduce(
            (sum, v) => sum + facePosition.getComponent(v, axis),
            0
        ) / vertices.length;
    // The face is at the front of the head: the eyes are forward of the
    // head's middle.
    face.geometry.computeBoundingBox();
    const middleZ =
        (face.geometry.boundingBox.min.z + face.geometry.boundingBox.max.z) / 2;
    const forwardZ = Math.sign(mean(eyes.left.loop, 2) - middleZ) || 1;
    const leftSign = Math.sign(mean(eyes.left.loop, 0)) || 1;

    // Shape: the expressions the character always wears, then its own
    // features, applied to everything in reach.
    const names: string[] =
        (face.userData.targetNames as string[]) ||
        Object.keys(face.morphTargetDictionary || {});
    const shapes = [face, ink, body].map(shapeOf);
    for (const shape of shapes.slice(0, 2))
        wearMorphs(shape, names, style.shape.morphs, info.composites);
    const marksNow = () =>
        faceMarks(facePosition.array, isSkin, info.landmarks, forwardZ);
    /** An opening's first corner, and its width seen from the front. */
    const cornerOf = (rim: typeof mouth) => ({
        x: facePosition.getX(rim.loop[0]),
        y: facePosition.getY(rim.loop[0]),
        width: Math.abs(
            facePosition.getX(rim.loop[rim.turn]) -
                facePosition.getX(rim.loop[0])
        ),
    });
    // The figure's own eyes, before anything is reshaped: what a style
    // gives in eye widths is counted in these, made the style's size.
    const own = { left: cornerOf(eyes.left), right: cornerOf(eyes.right) };
    const eyeScale = style.eyes.outline ? style.eyes.size ?? 1 : 1;
    if (style.shape.features.length) {
        const marks = marksNow();
        const warp = faceWarp(style.shape.features, marks, forwardZ);
        for (const shape of shapes) warpGeometry(shape, warp);
    }

    // The head: how long the face is, then its outline. Only what the
    // head's bone carries is moved, the neck by as much as it follows
    // the head, and the skin's normals turn with it.
    const { head } = style.shape;
    let headNow: FigureHead | null = null;
    {
        const unit = ((own.left.width + own.right.width) / 2) * eyeScale;
        const centre = (own.left.x + own.right.x) / 2;
        const eyeLine =
            (own.left.y + own.right.y) / 2 +
            (style.eyes.outline ? style.eyes.inset?.[1] ?? 0 : 0) *
                ((own.left.width + own.right.width) / 2);
        const bone = vrm.humanoid.getRawBoneNode("head");
        const carried = [face, ink, body].map((mesh) => headShare(mesh, bone));
        const skinned = [
            { ...shapes[0], normal: normalsOf(face) },
            shapes[1],
            { ...shapes[2], normal: normalsOf(body) },
        ];
        const bodyPosition = body.geometry.attributes.position;
        const crownNow = () => {
            let top = -Infinity;
            for (let v = 0; v < facePosition.count; v++)
                top = Math.max(top, facePosition.getY(v));
            for (let v = 0; v < bodyPosition.count; v++)
                if (carried[2][v] > 0.999)
                    top = Math.max(top, bodyPosition.getY(v));
            return top;
        };
        const levelsNow = () =>
            faceLevels(
                facePosition.array,
                isSkin,
                info.landmarks,
                forwardZ,
                centre
            );
        const amount = head?.amount ?? 1;
        const towards = (own: number, wanted: number) =>
            own + (wanted - own) * amount;
        if (head?.levels) {
            const now = levelsNow();
            const want = head.levels;
            const from = [
                eyeLine + 1.05 * unit,
                eyeLine - 0.25 * unit,
                now.nose,
                now.mouth,
                now.chin,
            ];
            const to = [
                from[0],
                from[1],
                towards(now.nose, eyeLine - want.nose * unit),
                towards(now.mouth, eyeLine - want.mouth * unit),
                towards(now.chin, eyeLine - want.chin * unit),
            ];
            if (want.crown !== undefined) {
                from.push(crownNow());
                to.push(towards(from[5], eyeLine + want.crown * unit));
            }
            const warp = levelsWarp(from, to);
            skinned.forEach((shape, i) =>
                warpGeometry(shape, warp, carried[i])
            );
        }
        // The face's own outline: its skin without the ears; above the
        // eyes, the skull behind it as well.
        const ears = new Set<number>();
        for (const ear of [
            info.landmarks.ears.left,
            info.landmarks.ears.right,
        ]) {
            const root = new Set(ear.root);
            for (const v of ear.all) if (!root.has(v)) ears.add(v);
        }
        const widthNow = () => {
            const ofFace = silhouette(
                [
                    {
                        position: facePosition.array,
                        indices: face.geometry.index.array,
                        keep: (a, b, c) =>
                            isSkin(a) &&
                            !ears.has(a) &&
                            !ears.has(b) &&
                            !ears.has(c),
                    },
                ],
                centre
            );
            const ofSkull = silhouette(
                [
                    {
                        position: bodyPosition.array,
                        indices: body.geometry.index.array,
                        keep: (a, b, c) =>
                            carried[2][a] > 0.999 &&
                            carried[2][b] > 0.999 &&
                            carried[2][c] > 0.999,
                    },
                ],
                centre
            );
            return (y: number) => {
                const down = (eyeLine - y) / unit;
                const skull = down < 0.8 ? ofSkull(y) : 0;
                const fade = Math.min(1, Math.max(0, (0.8 - down) / 0.6));
                return Math.max(ofFace(y), skull * fade);
            };
        };
        if (head?.outline) {
            const width = widthNow();
            const wanted = (down: number) => {
                const points = head.outline;
                if (down <= points[0][1]) return points[0][0];
                for (let i = 1; i < points.length; i++)
                    if (down <= points[i][1]) {
                        const [a, b] = [points[i - 1], points[i]];
                        const t = (down - a[1]) / (b[1] - a[1] || 1);
                        return a[0] + (b[0] - a[0]) * t;
                    }
                return 0;
            };
            // How much wider at each height, evened out; where the head
            // is too narrow to say (the tip of the chin, the top of the
            // skull), as much as at the nearest height that can.
            const step = 0.002;
            const top = crownNow();
            const bottom = levelsNow().chin;
            const count = Math.ceil((top - bottom) / step) + 1;
            const atEyes = (wanted(0) * unit) / (width(eyeLine) || 1);
            // The outline runs down to its own chin; the face may end
            // higher or lower, and is set against it part for part.
            const reach =
                head.outline[head.outline.length - 1][1] /
                ((eyeLine - bottom) / unit);
            let widen = Array.from({ length: count }, (_, i) => {
                const y = bottom + i * step;
                const now = width(y);
                if (now < 0.25 * unit) return NaN;
                const down = (eyeLine - y) / unit;
                const ratio =
                    down < 0 ? atEyes : (wanted(down * reach) * unit) / now;
                return towards(1, Math.min(1.5, Math.max(0.75, ratio)));
            });
            const known = widen
                .map((w, i) => (Number.isNaN(w) ? -1 : i))
                .filter((i) => i >= 0);
            widen = widen.map((w, i) =>
                Number.isNaN(w)
                    ? known.length
                        ? widen[
                              known.reduce((a, b) =>
                                  Math.abs(b - i) < Math.abs(a - i) ? b : a
                              )
                          ]
                        : 1
                    : w
            );
            for (let pass = 0; pass < 3; pass++)
                widen = widen.map(
                    (w, i) =>
                        (widen[Math.max(0, i - 1)] +
                            2 * w +
                            widen[Math.min(count - 1, i + 1)]) /
                        4
                );
            const warp = outlineWarp({
                centre,
                width,
                widen: (y) => {
                    const at = (y - bottom) / step;
                    if (at <= 0 || at >= count - 1)
                        return at <= 0 ? 1 : widen[count - 1];
                    const i = Math.floor(at);
                    return widen[i] + (widen[i + 1] - widen[i]) * (at - i);
                },
                // Round the eyes most of the width stays as it is; the
                // forehead and the jaw give more.
                core: (y) => {
                    const down = (eyeLine - y) / unit;
                    const ramp = (a: number, b: number) =>
                        Math.min(1, Math.max(0, (down - a) / (b - a)));
                    return down < 0
                        ? 0.55 + 0.23 * ramp(-1.6, -1.1)
                        : 0.78 - 0.33 * ramp(0.3, 1);
                },
            });
            skinned.forEach((shape, i) =>
                warpGeometry(shape, warp, carried[i])
            );
        }
        if (head) {
            face.geometry.attributes.normal.needsUpdate = true;
            body.geometry.attributes.normal.needsUpdate = true;
        }
        // The head as it now is, in eye widths: what a style's own
        // numbers are set against.
        const levels = levelsNow();
        const width = widthNow();
        headNow = {
            levels: {
                nose: (eyeLine - levels.nose) / unit,
                mouth: (eyeLine - levels.mouth) / unit,
                chin: (eyeLine - levels.chin) / unit,
                crown: (crownNow() - eyeLine) / unit,
            },
            halfWidth: (down) => width(eyeLine - down * unit) / unit,
        };
    }

    // The ears, rounded off; their surface has turned, so its normals
    // are worked out again.
    const earFrames: EarFrame[] = [];
    if (style.shape.ears) {
        const { round, size, cup } = style.shape.ears;
        const facePositions = facePosition.array as Float32Array;
        for (const ear of [
            info.landmarks.ears.left,
            info.landmarks.ears.right,
        ]) {
            const frame = roundEar(
                facePositions,
                ear,
                forwardZ,
                round,
                size,
                cup
            );
            if (frame) earFrames.push(frame);
            const fixed = new Set(ear.root);
            renewNormals(
                facePositions,
                face.geometry.attributes.normal.array as Float32Array,
                face.geometry.index.array,
                ear.all.filter((v) => !fixed.has(v))
            );
        }
        face.geometry.attributes.normal.needsUpdate = true;
    }

    // The eyes' own outline: each rim is moved onto it.
    const { outline } = style.eyes;
    if (outline)
        for (const [rim, side, was] of [
            [eyes.left, leftSign, own.left],
            [eyes.right, -leftSign, own.right],
        ] as const) {
            // Its size and place are counted in the figure's own eye,
            // whatever the head's reshaping has since done to it.
            const grown = was.width / cornerOf(rim).width;
            const inset = style.eyes.inset ?? [0, 0];
            const warp = eyeWarp({
                rim: rim.loop.map((v) => [
                    facePosition.getX(v),
                    facePosition.getY(v),
                    facePosition.getZ(v),
                ]),
                turn: rim.turn,
                side,
                forwardZ,
                outline,
                size: (style.eyes.size ?? 1) * grown,
                inset: [inset[0] * grown, inset[1] * grown],
            });
            for (const shape of shapes) warpGeometry(shape, warp);
        }

    // Measure the face as it now is.
    const frameOf = (rim: typeof mouth) =>
        openingFrame(
            facePosition.array,
            face.geometry.attributes.normal.array,
            rim,
            forwardZ
        );
    const frames = {
        left: frameOf(eyes.left),
        right: frameOf(eyes.right),
        mouth: frameOf(mouth),
    };
    const eyeLine = (frames.left.centre[1] + frames.right.centre[1]) / 2;
    const eyeOut =
        (Math.abs(frames.left.centre[0]) + Math.abs(frames.right.centre[0])) /
        2;
    // Each eye's inner corner, and its width seen from the front; what a
    // style gives in eye widths is measured from there.
    const corners = { left: cornerOf(eyes.left), right: cornerOf(eyes.right) };
    const eyeWidth = (corners.left.width + corners.right.width) / 2;
    const mouthWidth = cornerOf(mouth).width;

    // The brows: on the figure's own strips, or laid along the style's.
    const inkPosition = ink.geometry.attributes.position;
    const inkPart = ink.geometry.getAttribute("part");
    const inkCoords = ink.geometry.attributes.uv.array;
    const browOn = (sign: number) => {
        const vertices: number[] = [];
        for (let v = 0; v < inkPosition.count; v++)
            if (
                Math.round(inkPart.getX(v) * 255) === partId("brow") &&
                Math.sign(inkPosition.getX(v)) === sign
            )
                vertices.push(v);
        return vertices;
    };
    let depth: ReturnType<typeof depthFinder> | null = null;
    const brow = (sign: number): BrowLine => {
        const vertices = browOn(sign);
        const from = sign === leftSign ? corners.left : corners.right;
        const widths = style.brows.width.map((w) => w * from.width);
        if (!style.brows.path) {
            const size = measureBrow(inkPosition.array, inkCoords, vertices);
            return {
                ...size,
                knots: OWN_BROW.map((knot, i) => ({
                    ...knot,
                    width: widths[
                        Math.min(
                            widths.length - 1,
                            Math.round(
                                (i / (OWN_BROW.length - 1)) *
                                    (widths.length - 1)
                            )
                        )
                    ],
                })),
            };
        }
        if (!depth) {
            // Only the skin is laid on: the first triangles of the face.
            const index = face.geometry.index.array;
            const skin: number[] = [];
            for (let t = 0; t < index.length; t += 3)
                if (isSkin(index[t]))
                    skin.push(index[t], index[t + 1], index[t + 2]);
            depth = depthFinder(
                facePosition.array as Float32Array,
                skin,
                forwardZ
            );
        }
        return layBrow({
            position: inkPosition.array as Float32Array,
            coords: inkCoords,
            vertices,
            side: sign,
            path: style.brows.path.map(([out, up]) => [
                Math.abs(from.x) + out * from.width,
                from.y + up * from.width,
            ]),
            widths,
            eyeLine: 0,
            depth,
            forwardZ,
            shadow: BROW_SHADOW_REACH * from.width,
            morphs: (ink.geometry.morphAttributes.position || []).map(
                (attribute) => attribute.array as Float32Array
            ),
        });
    };
    const brows = { left: brow(leftSign), right: brow(-leftSign) };

    // The irises: each is drawn round the middle of what its piece calls
    // [0, 0], so say where on the piece that is.
    for (const side of ["left", "right"] as const) {
        const from = corners[side];
        const sign = side === "left" ? leftSign : -leftSign;
        const cx = from.x + style.eyes.at[0] * from.width * sign;
        const cy = from.y + style.eyes.at[1] * from.width;
        const uv = ink.geometry.attributes.uv;
        for (let v = 0; v < inkPosition.count; v++)
            if (
                Math.round(inkPart.getX(v) * 255) === partId("iris") &&
                Math.sign(inkPosition.getX(v)) === sign
            )
                uv.setXY(v, inkPosition.getX(v) - cx, inkPosition.getY(v) - cy);
        uv.needsUpdate = true;
    }

    for (const mesh of [face, ink, body]) {
        mesh.geometry.attributes.position.needsUpdate = true;
        for (const morph of mesh.geometry.morphAttributes.position || [])
            morph.needsUpdate = true;
        mesh.geometry.computeBoundingBox();
        mesh.geometry.computeBoundingSphere();
    }

    const hips = vrm.humanoid.getRawBoneNode("hips");
    const measured: FigureFrames = {
        forwardZ,
        leftSign,
        eyes: { left: frames.left, right: frames.right },
        mouth: frames.mouth,
        brows,
        eyeWidth,
        mouthWidth,
        corners,
        ears:
            earFrames.length === 2
                ? { left: earFrames[0], right: earFrames[1] }
                : null,
        cheek: [
            eyeOut + 0.007,
            eyeLine - 0.032,
            (frames.left.centre[2] + frames.right.centre[2]) / 2,
        ],
        nose: marksNow().nose,
        // The hips' height in the figure's own space: its place under
        // the bones above it, which do not turn at rest.
        hips: hips ? restPlace(hips, vrm.scene, "y") : 1,
        hipsZ: hips ? restPlace(hips, vrm.scene, "z") : 0,
    };
    const materials = createFigureMaterials(style, measured);
    for (const mesh of [body, face, ink])
        (mesh.material as THREE.Material).dispose();
    body.material = materials.body;
    face.material = materials.face;
    ink.material = materials.ink;
    // Drawn after the face it lies on.
    ink.renderOrder = 1;
    const count = (mesh: THREE.Mesh) => mesh.geometry.index.count / 3;
    return {
        frames: measured,
        marks: marksNow(),
        head: headNow,
        materials,
        meshes: { body, face, ink },
        triangles: count(body) + count(face) + count(ink),
        dispose() {
            materials.body.dispose();
            materials.face.dispose();
            materials.ink.dispose();
        },
    };
}

/** A figure's head, measured in eye widths. */
export interface FigureHead {
    /**
     * How far below the eyes' inner corners the nose ends, the mouth is
     * and the chin ends; and how far above them the skull's top is.
     */
    levels: { nose: number; mouth: number; chin: number; crown: number };
    /** Half the face's width at a depth below the eyes. */
    halfWidth: (down: number) => number;
}

const normalsOf = (mesh: THREE.Mesh) =>
    mesh.geometry.attributes.normal.array as Float32Array;

/** For each vertex, how much of it the head's bone carries, 0 to 1. */
function headShare(mesh: THREE.SkinnedMesh, head: THREE.Object3D | null) {
    const count = mesh.geometry.attributes.position.count;
    const share = new Float32Array(count);
    if (!head) return share.fill(1);
    const carried = new Set<THREE.Object3D>();
    head.traverse((bone) => carried.add(bone));
    const { skinIndex, skinWeight } = mesh.geometry.attributes;
    for (let v = 0; v < count; v++)
        for (let k = 0; k < 4; k++)
            if (carried.has(mesh.skeleton.bones[skinIndex.getComponent(v, k)]))
                share[v] += skinWeight.getComponent(v, k);
    return share;
}

/** Where a bone rests along one axis, from the root of the figure. */
function restPlace(
    bone: THREE.Object3D,
    root: THREE.Object3D,
    axis: "y" | "z"
) {
    let place = 0;
    for (
        let at: THREE.Object3D | null = bone;
        at && at !== root;
        at = at.parent
    )
        place += at.position[axis];
    return place;
}
