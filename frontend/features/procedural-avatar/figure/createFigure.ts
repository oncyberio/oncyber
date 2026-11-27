import * as THREE from "three/webgpu";
import {
    FIGURE_FORMAT,
    FIGURE_MATERIALS,
    partId,
    type FigureInfo,
} from "./format";
import { createFigureMaterials, type FigureFrames } from "./shading";
import {
    depthFinder,
    eyeWarp,
    faceMarks,
    faceWarp,
    layBrow,
    measureBrow,
    openingFrame,
    warpGeometry,
    wearMorphs,
    type BrowLine,
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
        wearMorphs(shape, names, style.shape.morphs);
    const marksNow = () =>
        faceMarks(facePosition.array, isSkin, info.landmarks, forwardZ);
    if (style.shape.features.length) {
        const marks = marksNow();
        const warp = faceWarp(style.shape.features, marks, forwardZ);
        for (const shape of shapes) warpGeometry(shape, warp);
    }

    // The eyes' own outline: each rim is moved onto it.
    const { outline } = style.eyes;
    if (outline)
        for (const [rim, side] of [
            [eyes.left, leftSign],
            [eyes.right, -leftSign],
        ] as const) {
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
                size: style.eyes.size ?? 1,
                inset: style.eyes.inset ?? [0, 0],
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
    const corner = (rim: typeof mouth) => ({
        x: facePosition.getX(rim.loop[0]),
        y: facePosition.getY(rim.loop[0]),
        width: Math.abs(
            facePosition.getX(rim.loop[rim.turn]) -
                facePosition.getX(rim.loop[0])
        ),
    });
    const corners = { left: corner(eyes.left), right: corner(eyes.right) };
    const eyeWidth = (corners.left.width + corners.right.width) / 2;
    const mouthWidth = corner(mouth).width;

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
