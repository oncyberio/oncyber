/**
 * Makes the hair figures wear (see hair.ts beside this folder): reads the
 * figure, takes each cut from its model, sets it on the figure's head, cuts it
 * down to a few thousand triangles, works out how open each point is to
 * the light, and writes one small GLB per cut.
 *
 * Bundled and run by ../hair.ts; not run directly.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import * as THREE from "three/webgpu";
import { VRMLoaderPlugin } from "@pixiv/three-vrm";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptSimplifier } from "meshoptimizer";
import { styleFigure } from "../../../frontend/features/procedural-avatar/figure/createFigure";
import { STAGEHAND_STYLE } from "../../../frontend/features/procedural-avatar/figure/style";
import {
    TriangleTree,
    bakeOpenness,
    weld,
} from "../../../frontend/features/procedural-avatar/figure/bake";
import { HAIR_FILES } from "../../../frontend/features/procedural-avatar/figure/hairFiles";
import { readGlb, worldOf } from "../vrmFile";

declare const process: { argv: string[]; env: Record<string, string> };

const ROOT = process.env.HAIR_ROOT;
const FIGURE = path.join(ROOT, "frontend/public/models/figure_male.vrm");
const OUT = path.join(ROOT, "frontend/public/models/hair");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

/** Plain triangles in the figure's bind pose. */
interface Mesh {
    positions: Float32Array;
    normals: Float32Array;
    /** Light and shade, 0 to 1, to be tinted. */
    shade: Float32Array;
    indices: Uint32Array;
}

// --- The figure -------------------------------------------------------------

async function loadFigure() {
    const file = readFileSync(FIGURE);
    const loader = new GLTFLoader();
    loader.register((p) => new VRMLoaderPlugin(p));
    const gltf = await loader.parseAsync(
        file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength),
        ""
    );
    const vrm = gltf.userData.vrm;
    vrm.scene.updateMatrixWorld(true);
    const figure = styleFigure(vrm, STAGEHAND_STYLE, { form: "basic" });
    const at = (bone: string) =>
        vrm.humanoid
            .getRawBoneNode(bone)
            .getWorldPosition(new THREE.Vector3()) as THREE.Vector3;
    const { body, face } = figure.meshes;
    // Everything of the skin, as one surface, for shading the hair by.
    const parts = [body, face].map((mesh) => ({
        positions: mesh.geometry.getAttribute("position").array as Float32Array,
        indices: Uint32Array.from(mesh.geometry.index.array),
    }));
    let offset = 0;
    const positions = new Float32Array(
        parts.reduce((n, p) => n + p.positions.length, 0)
    );
    const indices: number[] = [];
    for (const part of parts) {
        positions.set(part.positions, offset * 3);
        for (const i of part.indices) indices.push(i + offset);
        offset += part.positions.length / 3;
    }
    return {
        head: at("head"),
        eye: at("leftEye"),
        skin: { positions, indices: Uint32Array.from(indices) },
    };
}

// --- Another model's hair --------------------------------------------------

/**
 * Everything of a model that is hair, made the size of the figure's head
 * and set on it: matched by how far the eye is from the head's joint, as
 * the compare command tries hair on.
 */
function donorHair(
    file: string,
    figure: { head: THREE.Vector3; eye: THREE.Vector3 }
): Mesh {
    const { json, accessor } = readGlb(readFileSync(file));
    const bones = Object.fromEntries(
        json.extensions.VRM.humanoid.humanBones.map((b: Json) => [
            b.bone,
            b.node,
        ])
    );
    const world = worldOf(json);
    const at = (node: number) =>
        new THREE.Vector3().setFromMatrixPosition(world(node));
    const head = at(bones.head);
    const scale =
        figure.head.distanceTo(figure.eye) / head.distanceTo(at(bones.leftEye));
    const positions: number[] = [];
    const normals: number[] = [];
    const indices: number[] = [];
    for (const mesh of json.meshes)
        for (const primitive of mesh.primitives) {
            const material = json.materials[primitive.material].name;
            if (!/hair/i.test(material)) continue;
            const base = positions.length / 3;
            const p = accessor(primitive.attributes.POSITION);
            const n = accessor(primitive.attributes.NORMAL);
            for (let i = 0; i < p.length; i += 3) {
                positions.push(
                    figure.head.x + (p[i] - head.x) * scale,
                    figure.head.y + (p[i + 1] - head.y) * scale,
                    figure.head.z + (p[i + 2] - head.z) * scale
                );
                normals.push(n[i], n[i + 1], n[i + 2]);
            }
            for (const i of accessor(primitive.indices)) indices.push(base + i);
        }
    return {
        positions: Float32Array.from(positions),
        normals: Float32Array.from(normals),
        shade: new Float32Array(positions.length / 3).fill(1),
        indices: Uint32Array.from(indices),
    };
}

// --- Making it light -------------------------------------------------------

/** One vertex for each place: seams joined, their normals averaged. */
function joined(mesh: Mesh): Mesh {
    const welded = weld(mesh.positions, 1e-5);
    const positions = new Float32Array(welded.count * 3);
    const normals = new Float32Array(welded.count * 3);
    const shade = new Float32Array(welded.count);
    const members = new Float32Array(welded.count);
    for (let v = 0; v < welded.of.length; v++) {
        const w = welded.of[v];
        members[w]++;
        shade[w] += mesh.shade[v];
        for (let k = 0; k < 3; k++) {
            positions[w * 3 + k] = mesh.positions[v * 3 + k];
            normals[w * 3 + k] += mesh.normals[v * 3 + k];
        }
    }
    for (let w = 0; w < welded.count; w++) {
        shade[w] /= members[w];
        const l =
            Math.hypot(
                normals[w * 3],
                normals[w * 3 + 1],
                normals[w * 3 + 2]
            ) || 1;
        for (let k = 0; k < 3; k++) normals[w * 3 + k] /= l;
    }
    const indices = mesh.indices.map((i) => welded.of[i]);
    return { positions, normals, shade, indices };
}

/** At most `triangles` triangles, losing as little shape as it can. */
function simplified(mesh: Mesh, triangles: number): Mesh {
    let indices = mesh.indices;
    for (const error of [0.002, 0.005, 0.01, 0.02, 0.04]) {
        if (indices.length / 3 <= triangles) break;
        [indices] = MeshoptSimplifier.simplify(
            mesh.indices,
            mesh.positions,
            3,
            triangles * 3,
            error
        );
    }
    // Keep only the vertices still used.
    const [remap, count] = MeshoptSimplifier.compactMesh(
        Uint32Array.from(indices)
    );
    void remap;
    const used = new Map<number, number>();
    const order: number[] = [];
    const out = Uint32Array.from(indices, (i) => {
        if (!used.has(i)) {
            used.set(i, order.length);
            order.push(i);
        }
        return used.get(i);
    });
    void count;
    const pick = (data: Float32Array, width: number) => {
        const result = new Float32Array(order.length * width);
        order.forEach((v, i) => {
            for (let k = 0; k < width; k++)
                result[i * width + k] = data[v * width + k];
        });
        return result;
    };
    return {
        positions: pick(mesh.positions, 3),
        normals: pick(mesh.normals, 3),
        shade: pick(mesh.shade, 1),
        indices: out,
    };
}

/**
 * Darken what the light can't reach: under other locks, against the
 * scalp. Worked out against the hair and the head together.
 */
function shaded(
    mesh: Mesh,
    skin: { positions: Float32Array; indices: Uint32Array }
): Mesh {
    const count = mesh.positions.length / 3;
    const positions = new Float32Array(
        mesh.positions.length + skin.positions.length
    );
    positions.set(mesh.positions);
    positions.set(skin.positions, mesh.positions.length);
    const indices = new Uint32Array(mesh.indices.length + skin.indices.length);
    indices.set(mesh.indices);
    for (let i = 0; i < skin.indices.length; i++)
        indices[mesh.indices.length + i] = skin.indices[i] + count;
    const tree = new TriangleTree(positions, indices);
    const identity = {
        of: Uint32Array.from({ length: count }, (_, i) => i),
        count,
    };
    const open = bakeOpenness(
        {
            positions: mesh.positions,
            normals: mesh.normals,
            indices: mesh.indices,
        },
        identity,
        tree,
        { samples: 64, reach: 0.05 }
    );
    const shade = mesh.shade.map(
        (s, i) => s * (0.32 + 0.68 * Math.pow(open[i], 1.3))
    );
    return { ...mesh, shade };
}

// --- Writing ---------------------------------------------------------------

/** A GLB holding one mesh: positions, normals, shade (as a grey colour). */
function glb(mesh: Mesh, name: string) {
    const count = mesh.positions.length / 3;
    const colours = new Uint8Array(count * 4);
    mesh.shade.forEach((s, i) => {
        const v = Math.round(Math.min(1, Math.max(0, s)) * 255);
        colours.set([v, v, v, 255], i * 4);
    });
    const wide = count > 65535;
    const index = wide
        ? Uint32Array.from(mesh.indices)
        : Uint16Array.from(mesh.indices);
    const chunks = [mesh.positions, mesh.normals, colours, index].map(
        (a) => new Uint8Array(a.buffer, a.byteOffset, a.byteLength)
    );
    const views: Json[] = [];
    let length = 0;
    for (const chunk of chunks) {
        views.push({ buffer: 0, byteOffset: length, byteLength: chunk.length });
        length += Math.ceil(chunk.length / 4) * 4;
    }
    const bin = new Uint8Array(length);
    chunks.forEach((chunk, i) => bin.set(chunk, views[i].byteOffset));
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < count; i++)
        for (let k = 0; k < 3; k++) {
            min[k] = Math.min(min[k], mesh.positions[i * 3 + k]);
            max[k] = Math.max(max[k], mesh.positions[i * 3 + k]);
        }
    const json = {
        asset: { version: "2.0", generator: "tasks/avatar-figure hair" },
        scene: 0,
        scenes: [{ nodes: [0] }],
        nodes: [{ name, mesh: 0 }],
        meshes: [
            {
                name,
                primitives: [
                    {
                        attributes: { POSITION: 0, NORMAL: 1, COLOR_0: 2 },
                        indices: 3,
                    },
                ],
            },
        ],
        accessors: [
            {
                bufferView: 0,
                componentType: 5126,
                count,
                type: "VEC3",
                min,
                max,
            },
            { bufferView: 1, componentType: 5126, count, type: "VEC3" },
            {
                bufferView: 2,
                componentType: 5121,
                normalized: true,
                count,
                type: "VEC4",
            },
            {
                bufferView: 3,
                componentType: wide ? 5125 : 5123,
                count: mesh.indices.length,
                type: "SCALAR",
            },
        ],
        bufferViews: views,
        buffers: [{ byteLength: length }],
    };
    let text = Buffer.from(JSON.stringify(json));
    if (text.length % 4)
        text = Buffer.concat([text, Buffer.alloc(4 - (text.length % 4), " ")]);
    const header = Buffer.alloc(12);
    header.writeUInt32LE(0x46546c67, 0);
    header.writeUInt32LE(2, 4);
    header.writeUInt32LE(12 + 8 + text.length + 8 + bin.length, 8);
    const chunk = (type: number, data: Uint8Array) => {
        const head = Buffer.alloc(8);
        head.writeUInt32LE(data.length, 0);
        head.writeUInt32LE(type, 4);
        return [head, Buffer.from(data)];
    };
    return Buffer.concat([
        header,
        ...chunk(0x4e4f534a, text),
        ...chunk(0x004e4942, bin),
    ]);
}

// --- Every cut -------------------------------------------------------------

const models = process.argv[2];
const only = process.argv[3];
await MeshoptSimplifier.ready;
const figure = await loadFigure();
mkdirSync(OUT, { recursive: true });
for (const file of Object.values(HAIR_FILES)) {
    if (only && file.id !== only) continue;
    const from = path.join(models, file.model);
    if (!existsSync(from)) {
        console.log(`${file.id}: skipped, no ${file.model} in ${models}`);
        continue;
    }
    const started = Date.now();
    const mesh = donorHair(from, figure);
    const before = mesh.indices.length / 3;
    const made = shaded(simplified(joined(mesh), file.triangles), figure.skin);
    writeFileSync(path.join(OUT, `${file.id}.glb`), glb(made, file.id));
    console.log(
        `${file.id}: ${before} → ${made.indices.length / 3} triangles, ` +
            `${made.positions.length / 3} vertices, sha256 of the model ` +
            createHash("sha256").update(readFileSync(from)).digest("hex") +
            `, ${((Date.now() - started) / 1000).toFixed(1)} s`
    );
}
