import * as THREE from "three/webgpu";
import {
    If,
    attribute,
    float as f32,
    int,
    mat4,
    normalLocal,
    positionLocal,
    texture,
    uniform,
    vec4,
} from "three/tsl";
import type { StyledFigure } from "./createFigure";
import { createFigureLooks, type FigureLooks } from "./looks";
import {
    beforePosition,
    blinkNode,
    createFigureMaterials,
    moveFace,
    tableCell,
} from "./shading";

/**
 * Many figures drawn as one. Every figure of a crowd is the same
 * character in the same three meshes, so the whole crowd is three draws
 * however many stand in it; what each figure has of its own is where it
 * stands, how it is posed, its look (skin, eyes, brows, underwear: see
 * looks.ts) and its face (when it blinks, how open its mouth is).
 *
 * Nothing is lost by it: a figure of a crowd is drawn by the same shaders
 * from the same numbers as one drawn alone.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Node = any;

/**
 * Poses for a crowd to stand in. Each is where every bone of the figure
 * is, kept as a row of a table the vertex shader reads; they are taken
 * from the figure itself, posed however the host likes (by hand, from an
 * animation), and shared by every figure of the crowd.
 */
export interface FigurePoses {
    /** One row a pose: four cells a bone, the columns of its matrix. */
    texture: THREE.DataTexture;
    /** Poses it has room for. */
    capacity: number;
    /** Bones in a pose. */
    bones: number;
    /**
     * Keep the figure's pose as it now stands in a row. Pose its bones
     * first (and call the VRM's `update(0)`, if they were posed through
     * its humanoid). Where the figure's scene is placed and turned in
     * what holds it is part of the pose.
     */
    capture(row: number): void;
    dispose(): void;
}

/** A table of `capacity` poses of a figure. */
export function createFigurePoses(
    figure: StyledFigure,
    capacity: number
): FigurePoses {
    if (!Number.isInteger(capacity) || capacity < 1)
        throw new RangeError("A table of poses holds one pose or more");
    const { body, face, ink } = figure.meshes;
    const { skeleton } = body;
    const bones = skeleton.bones.length;
    // One table poses all three meshes: they hang on the same bones.
    for (const mesh of [face, ink])
        if (
            mesh.skeleton.bones.length !== bones ||
            mesh.skeleton.bones.some((bone, i) => bone !== skeleton.bones[i])
        )
            throw new Error("The figure's meshes hang on different bones");
    const data = new Float32Array(capacity * bones * 16);
    const table = new THREE.DataTexture(
        data,
        bones * 4,
        capacity,
        THREE.RGBAFormat,
        THREE.FloatType
    );
    table.name = "figure-poses";
    table.minFilter = table.magFilter = THREE.NearestFilter;
    table.generateMipmaps = false;
    table.needsUpdate = true;
    const fromRoot = new THREE.Matrix4();
    const toRoot = new THREE.Matrix4();
    const matrix = new THREE.Matrix4();
    return {
        texture: table,
        capacity,
        bones,
        capture(row) {
            if (!Number.isInteger(row) || row < 0 || row >= capacity)
                throw new RangeError(`The table has no row ${row}`);
            // Where each vertex a bone carries goes, in the space the
            // whole figure is placed in: a figure of the crowd that is
            // left where it is stands where this one does.
            // (Top down, the way that also brings each mesh's binding
            // up to date.)
            figure.root.updateWorldMatrix(true, false);
            figure.root.updateMatrixWorld(true);
            const placedIn = figure.root.parent;
            if (placedIn) fromRoot.copy(placedIn.matrixWorld).invert();
            else fromRoot.identity();
            toRoot
                .multiplyMatrices(fromRoot, body.matrixWorld)
                .multiply(body.bindMatrixInverse);
            skeleton.bones.forEach((bone, i) => {
                matrix
                    .copy(toRoot)
                    .multiply(bone.matrixWorld)
                    .multiply(skeleton.boneInverses[i])
                    .multiply(body.bindMatrix);
                matrix.toArray(data, (row * bones + i) * 16);
            });
            table.needsUpdate = true;
        },
        dispose() {
            table.dispose();
        },
    };
}

/** What one figure of a crowd has of its own. Left out, it stays. */
export interface CrowdFigure {
    /** Where it stands and which way it faces, in the crowd's space. */
    matrix?: THREE.Matrix4;
    /** Its look: a row of the crowd's table of looks. */
    look?: number;
    /**
     * Its pose: a row of the crowd's poses, or two rows and how far it
     * is from the first to the second, 0 to 1.
     */
    pose?: number | [from: number, to: number, mix: number];
    /** 0 to 1: what sets its blinks apart from the others'. */
    seed?: number;
    /** How open its mouth is, 0 to 1. */
    talk?: number;
}

export interface FigureCrowdOptions {
    /** The most figures it will hold. */
    capacity: number;
    poses: FigurePoses;
    /** How many looks it has room for: one each, if left out. */
    looks?: number;
}

/** Numbers each figure of a crowd has: its pose and look, then its face. */
const INSTANCE_SIZE = 6;

/**
 * A crowd of one character. `figure` must be in its basic form; it is
 * left as it is, and can still be drawn by itself.
 */
export function createFigureCrowd(
    figure: StyledFigure,
    options: FigureCrowdOptions
) {
    if (figure.form !== "basic")
        throw new Error("Only a figure in its basic form makes a crowd");
    const { capacity, poses } = options;
    if (!Number.isInteger(capacity) || capacity < 1)
        throw new RangeError("A crowd holds one figure or more");
    const looks: FigureLooks = createFigureLooks(
        figure.frames,
        options.looks ?? capacity
    );
    for (let row = 0; row < looks.capacity; row++) looks.set(row, figure.style);

    // Per figure: [pose, next pose, how far between, look], then
    // [blink seed, talk]. One buffer, so it costs one vertex buffer.
    const instances = new THREE.InstancedInterleavedBuffer(
        new Float32Array(capacity * INSTANCE_SIZE),
        INSTANCE_SIZE
    ).setUsage(THREE.DynamicDrawUsage);
    const own = new THREE.InterleavedBufferAttribute(instances, 4, 0);
    const ownFace = new THREE.InterleavedBufferAttribute(instances, 2, 4);
    const matrices = new THREE.InstancedBufferAttribute(
        new Float32Array(capacity * 16),
        16
    ).setUsage(THREE.DynamicDrawUsage);
    const identity = new THREE.Matrix4();
    for (let i = 0; i < capacity; i++) identity.toArray(matrices.array, i * 16);

    const instance = attribute("figureInstance", "vec4");
    const faceOf = attribute("figureFace", "vec2");
    const seconds = uniform(0);
    const materials = createFigureMaterials(figure.style, figure.frames, {
        looks,
        row: int(instance.w.add(0.5)),
    });

    // A vertex's place in a pose: its bones' matrices from the table,
    // by its weights.
    const table = texture(poses.texture);
    const indices = attribute("skinIndex", "uvec4");
    const weights = attribute("skinWeight", "vec4");
    // The installed types only declare a matrix from numbers; one from
    // four columns works the same.
    const columns = mat4 as unknown as (...columns: Node[]) => Node;
    const bone = (index: Node, row: Node): Node =>
        columns(
            ...[0, 1, 2, 3].map((k) =>
                tableCell(table, int(index).mul(4).add(k), row)
            )
        );
    // A vertex has room for four bones and seldom uses them all: the
    // face hangs on one, the body on two or so. A bone that is never
    // used is not fetched at all, and one a vertex does not use is
    // passed over, which changes nothing in the sum.
    const posed = (row: Node, bones: number): Node => {
        const matrix = bone(indices.x, row).mul(weights.x).toVar();
        for (const slot of (["y", "z", "w"] as const).slice(0, bones - 1))
            If(weights[slot].greaterThan(0), () => {
                matrix.addAssign(bone(indices[slot], row).mul(weights[slot]));
            });
        return matrix;
    };

    const make = (key: "body" | "face" | "ink") => {
        const source = figure.meshes[key].geometry;
        // The figure's own vertex data, shared, with the crowd's beside.
        const geometry = new THREE.BufferGeometry();
        geometry.setIndex(source.index);
        for (const [name, data] of Object.entries(source.attributes))
            geometry.setAttribute(name, data);
        geometry.setAttribute("figureInstance", own);
        geometry.setAttribute("figureFace", ownFace);
        const material = materials[key];
        const normals = geometry.hasAttribute("normal");
        const bones = bonesUsed(geometry);
        beforePosition(material, `figure-crowd-${bones}`, () => {
            const matrix = posed(int(instance.x.add(0.5)), bones);
            If(instance.z.greaterThan(0), () => {
                matrix.assign(
                    matrix
                        .mul(f32(1).sub(instance.z))
                        .add(
                            posed(int(instance.y.add(0.5)), bones).mul(
                                instance.z
                            )
                        )
                );
            });
            positionLocal.assign(matrix.mul(vec4(positionLocal, 1)).xyz);
            if (normals)
                normalLocal.assign(matrix.mul(vec4(normalLocal, 0)).xyz);
        });
        // The face moves first, where the figure rests; then it is posed.
        if (key !== "body")
            moveFace(material, {
                blink: blinkNode(seconds, faceOf.x),
                talk: faceOf.y,
            });
        const mesh = new THREE.InstancedMesh(geometry, material, capacity);
        mesh.name = `figure-crowd-${key}`;
        mesh.instanceMatrix = matrices;
        mesh.count = 0;
        // Its figures stand anywhere, in any pose: the host decides what
        // is in view.
        mesh.frustumCulled = false;
        return mesh;
    };
    const meshes = { body: make("body"), face: make("face"), ink: make("ink") };
    // Drawn after the faces it lies on.
    meshes.ink.renderOrder = 1;
    const object = new THREE.Group();
    object.name = "figure-crowd";
    object.add(meshes.body, meshes.face, meshes.ink);

    let count = 0;
    return {
        /** Add this to the scene. */
        object,
        meshes,
        materials,
        looks,
        poses,
        capacity,
        /** Triangles in one of its figures. */
        trianglesEach: figure.triangles,
        /** How many figures are drawn: the first `count` of them. */
        get count() {
            return count;
        },
        set count(value: number) {
            if (!Number.isInteger(value) || value < 0 || value > capacity)
                throw new RangeError(
                    `A crowd of ${capacity} cannot draw ${value}`
                );
            count = value;
            for (const mesh of Object.values(meshes)) mesh.count = value;
        },
        /** Set what a figure has of its own. */
        set(index: number, own: CrowdFigure) {
            if (!Number.isInteger(index) || index < 0 || index >= capacity)
                throw new RangeError(`The crowd has no figure ${index}`);
            const at = index * INSTANCE_SIZE;
            const values = instances.array;
            if (own.matrix) {
                own.matrix.toArray(matrices.array, index * 16);
                matrices.needsUpdate = true;
            }
            if (own.pose !== undefined) {
                const [from, to, mix] =
                    typeof own.pose === "number"
                        ? [own.pose, own.pose, 0]
                        : own.pose;
                for (const row of [from, to])
                    if (
                        !Number.isInteger(row) ||
                        row < 0 ||
                        row >= poses.capacity
                    )
                        throw new RangeError(`There is no pose ${row}`);
                values[at] = from;
                values[at + 1] = to;
                values[at + 2] = Math.min(1, Math.max(0, mix));
            }
            if (own.look !== undefined) {
                if (
                    !Number.isInteger(own.look) ||
                    own.look < 0 ||
                    own.look >= looks.capacity
                )
                    throw new RangeError(`There is no look ${own.look}`);
                values[at + 3] = own.look;
            }
            if (own.seed !== undefined) values[at + 4] = own.seed;
            if (own.talk !== undefined)
                values[at + 5] = Math.min(1, Math.max(0, own.talk));
            instances.needsUpdate = true;
        },
        /** Tell the crowd the time, seconds: it is what its figures blink by. */
        update(time: number) {
            seconds.value = time;
        },
        dispose() {
            object.removeFromParent();
            for (const mesh of Object.values(meshes)) mesh.dispose();
            materials.dispose();
            looks.dispose();
        },
    };
}

/** A crowd of one character. */
export type FigureCrowd = ReturnType<typeof createFigureCrowd>;

/**
 * How many of the four bones a vertex has room for a mesh uses anywhere:
 * the last place any of its vertices has a weight in.
 */
export function bonesUsed(geometry: THREE.BufferGeometry) {
    const weights = geometry.getAttribute("skinWeight");
    let used = 1;
    for (let v = 0; v < weights.count && used < 4; v++)
        for (let k = 3; k >= used; k--)
            if (weights.getComponent(v, k) > 0) {
                used = k + 1;
                break;
            }
    return used;
}
