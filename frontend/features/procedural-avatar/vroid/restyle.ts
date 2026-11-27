import * as THREE from "three/webgpu";
import {
    dot,
    float as f32,
    max,
    mix,
    normalWorld,
    positionGeometry,
    saturate,
    smoothstep,
    texture,
    vec3,
} from "three/tsl";
import { rgb } from "../kernel/build";
import { KEY, REAR, SUN } from "../shading";
import { VROID_SKIN, VroidRecipe } from "./recipe";

/**
 * Turn a loaded VRoid base model into the character a recipe describes.
 *
 * Nothing is added: the base's triangles, skin weights and face morphs are
 * kept. Its proportions change through its own skeleton (each bone scales
 * the part of the body it carries, and its children move with it), the
 * face is lengthened below the eyes, an expression is baked in as the
 * resting face, and its materials are replaced by soft-shaded ones tinted
 * to the recipe's palette.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Node = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Vrm = any;

type V3 = [number, number, number];

const ONE: V3 = [1, 1, 1];

/** Where each bone of a skeleton rests, in the space its meshes are in. */
function restPositions(skeleton: THREE.Skeleton): V3[] {
    const m = new THREE.Matrix4();
    return skeleton.boneInverses.map((inverse) => {
        m.copy(inverse).invert();
        return [m.elements[12], m.elements[13], m.elements[14]];
    });
}

export interface Reshape {
    /** Rest position of each bone before and after. */
    from: V3[];
    to: V3[];
    scale: V3[];
}

/**
 * Work out where every bone goes: a bone's children keep their offsets
 * from it, multiplied by its scale.
 */
export function planReshape(
    parents: number[],
    from: V3[],
    scale: V3[]
): Reshape {
    const to: V3[] = [];
    const place = (i: number): V3 => {
        if (to[i]) return to[i];
        const p = parents[i];
        if (p < 0) return (to[i] = [...from[i]] as V3);
        const base = place(p);
        return (to[i] = [
            base[0] + (from[i][0] - from[p][0]) * scale[p][0],
            base[1] + (from[i][1] - from[p][1]) * scale[p][1],
            base[2] + (from[i][2] - from[p][2]) * scale[p][2],
        ]);
    };
    from.forEach((_, i) => place(i));
    return { from, to, scale };
}

/** Move a rest-pose point as its bones move it. */
export function reshapePoint(
    plan: Reshape,
    p: V3,
    bones: ArrayLike<number>,
    weights: ArrayLike<number>,
    offset: number
): V3 {
    const out: V3 = [0, 0, 0];
    let total = 0;
    for (let k = 0; k < 4; k++) {
        const w = weights[offset + k];
        if (!w) continue;
        const b = bones[offset + k];
        const s = plan.scale[b];
        for (let a = 0; a < 3; a++)
            out[a] += w * (plan.to[b][a] + (p[a] - plan.from[b][a]) * s[a]);
        total += w;
    }
    if (!total) return [...p] as V3;
    return [out[0] / total, out[1] / total, out[2] / total];
}

function reshapeMeshes(vrm: Vrm, recipe: VroidRecipe) {
    const meshes: THREE.SkinnedMesh[] = [];
    vrm.scene.traverse((object: THREE.Object3D) => {
        if ((object as THREE.SkinnedMesh).isSkinnedMesh)
            meshes.push(object as THREE.SkinnedMesh);
    });
    // Scales by node: the recipe names VRM bones or the nodes themselves.
    const byNode = new Map<THREE.Object3D, V3>();
    for (const [name, scale] of Object.entries(recipe.bones)) {
        const node =
            vrm.humanoid.getRawBoneNode(name) ||
            vrm.scene.getObjectByName(name);
        if (node) byNode.set(node, scale);
    }
    // Primitives of one mesh share their vertices: move each set once.
    const done = new Set<unknown>();
    const moved = new Set<THREE.Object3D>();
    const plans = new Map<THREE.Skeleton, Reshape>();
    for (const mesh of meshes) {
        const skeleton = mesh.skeleton;
        let plan = plans.get(skeleton);
        if (!plan) {
            const bones = skeleton.bones;
            const parents = bones.map((bone) =>
                bones.indexOf(bone.parent as THREE.Bone)
            );
            plan = planReshape(
                parents,
                restPositions(skeleton),
                bones.map((bone) => byNode.get(bone) || ONE)
            );
            plans.set(skeleton, plan);
        }
        const geometry = mesh.geometry;
        const position = geometry.attributes.position;
        if (done.has(position)) continue;
        done.add(position);
        const normal = geometry.attributes.normal;
        const index = geometry.attributes.skinIndex.array;
        const weight = geometry.attributes.skinWeight.array;
        const morphs = geometry.morphAttributes.position || [];
        for (let v = 0; v < position.count; v++) {
            const p = reshapePoint(
                plan,
                [position.getX(v), position.getY(v), position.getZ(v)],
                index,
                weight,
                v * 4
            );
            position.setXYZ(v, p[0], p[1], p[2]);
            // What scales the surface also scales its morphs and tips its
            // normals the other way.
            const s: V3 = [0, 0, 0];
            let total = 0;
            for (let k = 0; k < 4; k++) {
                const w = weight[v * 4 + k];
                const b = plan.scale[index[v * 4 + k]];
                for (let a = 0; a < 3; a++) s[a] += w * b[a];
                total += w;
            }
            for (let a = 0; a < 3; a++) s[a] = total ? s[a] / total : 1;
            if (normal) {
                const n = new THREE.Vector3(
                    normal.getX(v) / s[0],
                    normal.getY(v) / s[1],
                    normal.getZ(v) / s[2]
                ).normalize();
                normal.setXYZ(v, n.x, n.y, n.z);
            }
            for (const morph of morphs)
                morph.setXYZ(
                    v,
                    morph.getX(v) * s[0],
                    morph.getY(v) * s[1],
                    morph.getZ(v) * s[2]
                );
        }
        position.needsUpdate = true;
        if (normal) normal.needsUpdate = true;
    }
    // Then the bones themselves, and the bind that goes with them.
    for (const [skeleton, plan] of plans) {
        skeleton.bones.forEach((bone, i) => {
            if (moved.has(bone)) return;
            moved.add(bone);
            const parent = skeleton.bones.indexOf(bone.parent as THREE.Bone);
            if (parent < 0) return;
            const s = plan.scale[parent];
            bone.position.set(
                bone.position.x * s[0],
                bone.position.y * s[1],
                bone.position.z * s[2]
            );
            void i;
        });
    }
    vrm.scene.updateMatrixWorld(true);
    // The bind moves with each bone. It is kept in the space the meshes
    // were bound in, whatever has been done to the scene since.
    const shift = new THREE.Matrix4();
    for (const [skeleton, plan] of plans)
        skeleton.boneInverses.forEach((inverse, i) => {
            inverse.multiply(
                shift.makeTranslation(
                    plan.from[i][0] - plan.to[i][0],
                    plan.from[i][1] - plan.to[i][1],
                    plan.from[i][2] - plan.to[i][2]
                )
            );
        });
    return { meshes, plans };
}

/** Lengthen the face below the eyes, shorten the skull above them. */
function reshapeFace(
    vrm: Vrm,
    recipe: VroidRecipe,
    meshes: THREE.SkinnedMesh[]
) {
    const head = vrm.humanoid.getRawBoneNode("head") as THREE.Bone;
    const eye =
        vrm.humanoid.getRawBoneNode("leftEye") ||
        vrm.scene.getObjectByName("J_Adj_L_FaceEye");
    // Primitives of one mesh share their vertices: move each set once.
    const done = new Set<unknown>();
    for (const mesh of meshes) {
        const geometry = mesh.geometry;
        if (done.has(geometry.attributes.position)) continue;
        done.add(geometry.attributes.position);
        const bones = mesh.skeleton.bones;
        const headIndex = bones.indexOf(head);
        const rest = restPositions(mesh.skeleton);
        const eyeY = rest[bones.indexOf(eye)][1];
        const chin = rest[headIndex][1] - 0.012;
        // Everything the head carries: its own vertices and its children's.
        const onHead = bones.map((bone) => {
            for (let b: THREE.Object3D | null = bone; b; b = b.parent)
                if (b === head) return true;
            return false;
        });
        const position = geometry.attributes.position;
        const index = geometry.attributes.skinIndex.array;
        const weight = geometry.attributes.skinWeight.array;
        const morphs = geometry.morphAttributes.position || [];
        const { above, below, jaw, width } = recipe.face;
        for (let v = 0; v < position.count; v++) {
            let share = 0;
            for (let k = 0; k < 4; k++)
                if (onHead[index[v * 4 + k]]) share += weight[v * 4 + k];
            if (share < 0.02) continue;
            const y = position.getY(v);
            const t = Math.min(1, Math.max(0, (y - eyeY + 0.012) / 0.024));
            const k = below + (above - below) * (t * t * (3 - 2 * t));
            // The jaw draws in towards the chin.
            const down = Math.min(
                1,
                Math.max(0, (eyeY - 0.015 - y) / (eyeY - 0.015 - chin))
            );
            const across = width * (1 + (jaw - 1) * down * down);
            const ny = eyeY + (y - eyeY) * k;
            position.setXYZ(
                v,
                position.getX(v) * (1 + (across - 1) * share),
                y + (ny - y) * share,
                position.getZ(v)
            );
            for (const morph of morphs)
                morph.setY(v, morph.getY(v) * (1 + (k - 1) * share));
        }
        position.needsUpdate = true;
    }
}

/** Make an expression the resting face. */
function bakeMorphs(recipe: VroidRecipe, meshes: THREE.SkinnedMesh[]) {
    // Primitives of one mesh share their vertices: move each set once.
    const done = new Set<unknown>();
    for (const mesh of meshes) {
        const geometry = mesh.geometry;
        const morphs = geometry.morphAttributes.position;
        const names: string[] | undefined =
            geometry.userData.targetNames || mesh.userData.targetNames;
        const position = geometry.attributes.position;
        if (!morphs || done.has(position)) continue;
        done.add(position);
        for (const [name, amount] of Object.entries(recipe.morphs)) {
            const i = names
                ? names.indexOf(name)
                : mesh.morphTargetDictionary?.[name] ?? -1;
            if (i < 0 || !morphs[i]) continue;
            const morph = morphs[i];
            for (let v = 0; v < position.count; v++)
                position.setXYZ(
                    v,
                    position.getX(v) + morph.getX(v) * amount,
                    position.getY(v) + morph.getY(v) * amount,
                    position.getZ(v) + morph.getZ(v) * amount
                );
        }
        position.needsUpdate = true;
    }
}

/**
 * Flatten the chest: nothing in front of the ribs may stand further
 * forward than the breastbone does at that height, less the ribcage's own
 * curve to the sides. Normals are rebuilt where the surface moved.
 */
function flattenChest(
    vrm: Vrm,
    recipe: VroidRecipe,
    meshes: THREE.SkinnedMesh[]
) {
    if (!recipe.chest.flatten) return;
    const body = meshes.find((mesh) =>
        /Body/.test((mesh.material as THREE.Material).name || "")
    );
    if (!body) return;
    const bones = body.skeleton.bones;
    const rest = restPositions(body.skeleton);
    const at = (name: string) =>
        rest[bones.indexOf(vrm.humanoid.getRawBoneNode(name))];
    const low = at("chest")[1] - 0.07;
    const high = at("neck")[1] - 0.045;
    const position = body.geometry.attributes.position;
    const skinIndex = body.geometry.attributes.skinIndex.array;
    const skinWeight = body.geometry.attributes.skinWeight.array;
    // The bones of the ribcage, bust included: only what they carry moves.
    const ribs = bones.map((bone) => /Chest|Bust|Spine/.test(bone.name));
    // Which way the figure faces: its toes point there.
    const forward = Math.sign(at("leftToes")[2] - at("leftFoot")[2]) || 1;
    // The breastbone's profile: how far forward the middle of the chest
    // is at each height, as a smooth curve fitted through the vertices
    // down the middle of its front.
    const middle = (at("chest")[2] + at("upperChest")[2]) / 2;
    const samples: [number, number][] = [];
    for (let v = 0; v < position.count; v++) {
        const y = position.getY(v);
        const z = position.getZ(v) * forward;
        if (y < low || y > high || Math.abs(position.getX(v)) > 0.012) continue;
        if (z < middle * forward + 0.03) continue;
        samples.push([y - low, z]);
    }
    if (samples.length < 4) return;
    const profileAt = fitQuadratic(samples);
    const moved: number[] = [];
    const soft = 0.022;
    for (let v = 0; v < position.count; v++) {
        const y = position.getY(v);
        const x = position.getX(v);
        // The ribcage only, fading out before the arms.
        if (y < low || y > high || Math.abs(x) > 0.16) continue;
        const inside = Math.min(1, (0.16 - Math.abs(x)) / 0.03);
        const limit = profileAt(y - low) - recipe.chest.curve * x * x;
        const z = position.getZ(v) * forward;
        // A smooth minimum, so the flattened part has no edge.
        const h = Math.max(soft - Math.abs(z - limit), 0);
        const clamped = Math.min(z, limit) - (h * h) / (4 * soft);
        // Fade in at the top and bottom of the chest.
        let carried = 0;
        for (let k = 0; k < 4; k++)
            if (ribs[skinIndex[v * 4 + k]]) carried += skinWeight[v * 4 + k];
        const edge = Math.min(
            inside,
            (y - low) / 0.05,
            (high - y) / 0.03,
            Math.max(0, carried * 2 - 1) * 2
        );
        const nz = z + (clamped - z) * recipe.chest.flatten * Math.max(0, edge);
        if (Math.abs(nz - z) < 1e-5) continue;
        position.setZ(v, nz * forward);
        moved.push(v);
    }
    position.needsUpdate = true;
    smoothNormals(body.geometry, new Set(moved));
}

/** The parabola that best fits some points, by least squares. */
export function fitQuadratic(points: [number, number][]) {
    // Normal equations for z = a + b y + c y^2.
    const m = [0, 0, 0, 0, 0];
    const r = [0, 0, 0];
    for (const [y, z] of points) {
        let p = 1;
        for (let k = 0; k < 5; k++) {
            m[k] += p;
            if (k < 3) r[k] += p * z;
            p *= y;
        }
    }
    const det = (
        a: number,
        b: number,
        c: number,
        d: number,
        e: number,
        f: number,
        g: number,
        h: number,
        i: number
    ) => a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
    const d = det(m[0], m[1], m[2], m[1], m[2], m[3], m[2], m[3], m[4]);
    if (Math.abs(d) < 1e-18) {
        const mean = r[0] / (m[0] || 1);
        return () => mean;
    }
    const a = det(r[0], m[1], m[2], r[1], m[2], m[3], r[2], m[3], m[4]) / d;
    const b = det(m[0], r[0], m[2], m[1], r[1], m[3], m[2], r[2], m[4]) / d;
    const c = det(m[0], m[1], r[0], m[1], m[2], r[1], m[2], m[3], r[2]) / d;
    return (y: number) => a + b * y + c * y * y;
}

/**
 * Rebuild the normals of some vertices from the triangles round them,
 * treating vertices that share a position as one so no seam appears.
 */
function smoothNormals(geometry: THREE.BufferGeometry, which: Set<number>) {
    const position = geometry.attributes.position;
    const normal = geometry.attributes.normal;
    const index = geometry.index;
    if (!index || !normal) return;
    const key = (v: number) =>
        `${Math.round(position.getX(v) * 1e5)},${Math.round(
            position.getY(v) * 1e5
        )},${Math.round(position.getZ(v) * 1e5)}`;
    const sums = new Map<string, THREE.Vector3>();
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const c = new THREE.Vector3();
    for (let i = 0; i < index.count; i += 3) {
        const ids = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
        if (!ids.some((v) => which.has(v))) continue;
        a.fromBufferAttribute(position, ids[0]);
        b.fromBufferAttribute(position, ids[1]);
        c.fromBufferAttribute(position, ids[2]);
        const face = b.sub(a).cross(c.sub(a));
        for (const v of ids) {
            const k = key(v);
            sums.set(k, (sums.get(k) || new THREE.Vector3()).add(face));
        }
    }
    for (const v of which) {
        const sum = sums.get(key(v));
        if (!sum) continue;
        a.copy(sum).normalize();
        normal.setXYZ(v, a.x, a.y, a.z);
    }
    normal.needsUpdate = true;
}

/** The vertices each part of the face uses, by material name. */
function faceParts(meshes: THREE.SkinnedMesh[]) {
    const parts: { name: string; mesh: THREE.SkinnedMesh; own: number[] }[] =
        [];
    for (const mesh of meshes) {
        const name = (mesh.material as THREE.Material).name || "";
        const index = mesh.geometry.index;
        if (!index || !mesh.geometry.morphAttributes.position) continue;
        const own = new Set<number>();
        for (let i = 0; i < index.count; i++) own.add(index.getX(i));
        parts.push({ name, mesh, own: [...own] });
    }
    return parts;
}

type FaceParts = ReturnType<typeof faceParts>;

/** Find the landmarks of a VRoid face on its left side, from its parts. */
export function faceLandmarks(parts: FaceParts, forward: number) {
    const of = (pattern: RegExp) => parts.find((p) => pattern.test(p.name));
    const skin = of(/Face_00_SKIN/);
    const iris = of(/EyeIris/);
    const mouth = of(/FaceMouth/);
    if (!skin || !iris) return null;
    const position = skin.mesh.geometry.attributes.position;
    const point = (v: number): V3 => [
        position.getX(v),
        position.getY(v),
        position.getZ(v),
    ];
    const mean = (ids: number[]): V3 => {
        const sum: V3 = [0, 0, 0];
        for (const v of ids) {
            const p = point(v);
            for (let a = 0; a < 3; a++) sum[a] += p[a] / ids.length;
        }
        return sum;
    };
    const eye = mean(iris.own.filter((v) => position.getX(v) > 0));
    let nose: V3 = [0, 0, -Infinity];
    let chin: V3 = [0, Infinity, 0];
    let widest = 0;
    for (const v of skin.own) {
        const p = point(v);
        widest = Math.max(widest, Math.abs(p[0]));
        if (Math.abs(p[0]) < 0.004 && p[2] * forward > nose[2] * forward)
            nose = p;
        if (Math.abs(p[0]) < 0.01 && p[1] < chin[1] && p[2] * forward > 0.02)
            chin = p;
    }
    nose = [0, nose[1], nose[2]];
    chin = [0, chin[1], chin[2]];
    const ear = mean(skin.own.filter((v) => position.getX(v) > widest * 0.9));
    const mouthAt: V3 = mouth
        ? mean(mouth.own)
        : [0, (nose[1] + chin[1]) / 2, nose[2]];
    // The corner of the jaw: level with the mouth, under the ear.
    const jaw: V3 = [
        ear[0] * 0.72,
        mouthAt[1] + (chin[1] - mouthAt[1]) * 0.1,
        (ear[2] + nose[2]) / 2,
    ];
    return { eye, nose, chin, ear, jaw, mouth: [0, mouthAt[1], nose[2]] as V3 };
}

/** Apply the recipe's local changes to the face. */
function sculptFace(recipe: VroidRecipe, parts: FaceParts, forward: number) {
    const marks = faceLandmarks(parts, forward);
    if (!marks || !parts.length) return marks;
    const position = parts[0].mesh.geometry.attributes.position;
    for (const feature of recipe.features) {
        const base = marks[feature.at];
        const offset = feature.offset || [0, 0, 0];
        const scale = feature.scale || ONE;
        const move = feature.move || [0, 0, 0];
        const touched = new Set<number>();
        for (const part of parts)
            if (!feature.parts || feature.parts.test(part.name))
                for (const v of part.own) touched.add(v);
        // On the middle of the face once; elsewhere on both sides.
        const sides = Math.abs(base[0] + offset[0]) < 1e-6 ? [1] : [1, -1];
        for (const side of sides) {
            const centre: V3 = [
                (base[0] + offset[0]) * side,
                base[1] + offset[1],
                base[2] + offset[2] * forward,
            ];
            for (const v of touched) {
                const d: V3 = [
                    position.getX(v) - centre[0],
                    position.getY(v) - centre[1],
                    position.getZ(v) - centre[2],
                ];
                const t = Math.hypot(d[0], d[1], d[2]) / feature.radius;
                if (t >= 1) continue;
                const w = (1 - t * t) ** 2;
                position.setXYZ(
                    v,
                    position.getX(v) +
                        w * ((scale[0] - 1) * d[0] + move[0] * side),
                    position.getY(v) + w * ((scale[1] - 1) * d[1] + move[1]),
                    position.getZ(v) +
                        w * ((scale[2] - 1) * d[2] + move[2] * forward)
                );
            }
        }
    }
    position.needsUpdate = true;
    return faceLandmarks(parts, forward);
}

/**
 * Draw the brows: the base's brow strips are laid along the recipe's path
 * at its thickness, kept on the face's surface, and filled in solid.
 */
function drawBrows(
    recipe: VroidRecipe,
    parts: FaceParts,
    eyeY: number,
    forward: number
) {
    const brow = parts.find((part) => /FaceBrow/.test(part.name));
    if (!brow) return;
    const geometry = brow.mesh.geometry;
    const position = geometry.attributes.position;
    const uv = geometry.attributes.uv;
    const { path, width } = recipe.brow;
    /** The path and its thickness at a fraction of the way along. */
    const along = (t: number) => {
        const f = Math.min(
            path.length - 1 - 1e-6,
            Math.max(0, t * (path.length - 1))
        );
        const i = Math.floor(f);
        const u = f - i;
        return {
            x: path[i][0] + (path[i + 1][0] - path[i][0]) * u,
            y: path[i][1] + (path[i + 1][1] - path[i][1]) * u,
            thick: width[i] + (width[i + 1] - width[i]) * u,
        };
    };
    for (const side of [1, -1]) {
        const own = brow.own.filter((v) => position.getX(v) * side > 0);
        if (!own.length) continue;
        // Its columns run from the nose out; its rows from bottom to top.
        const columns = new Map<number, number[]>();
        for (const v of own) {
            const key = Math.round(uv.getX(v) * 1000);
            columns.set(key, [...(columns.get(key) || []), v]);
        }
        const ordered = [...columns.values()].sort(
            (a, b) =>
                Math.abs(position.getX(a[0])) - Math.abs(position.getX(b[0]))
        );
        // How the face's surface lies under the strip: depth at each
        // column, and how it changes with height.
        const surface = ordered.map((column) => {
            // Bottom row first, by the strip's own layout: morphs may
            // have moved the vertices past each other.
            const rows = [...column].sort((a, b) => uv.getY(b) - uv.getY(a));
            const low = rows[0];
            const high = rows[rows.length - 1];
            const dy = position.getY(high) - position.getY(low) || 1e-6;
            return {
                x: Math.abs(position.getX(low)),
                y: position.getY(low),
                z: position.getZ(low),
                slope: (position.getZ(high) - position.getZ(low)) / dy,
                rows,
            };
        });
        const depthAt = (x: number, y: number) => {
            let i = 0;
            while (i + 2 < surface.length && surface[i + 1].x < x) i++;
            const a = surface[i];
            const b = surface[i + 1];
            const t = (x - a.x) / (b.x - a.x || 1e-6);
            const za = a.z + (y - a.y) * a.slope;
            const zb = b.z + (y - b.y) * b.slope;
            return za + (zb - za) * t;
        };
        surface.forEach((column, c) => {
            const at = along(c / (surface.length - 1));
            column.rows.forEach((v, r) => {
                const across =
                    column.rows.length === 1
                        ? 0
                        : r / (column.rows.length - 1) - 0.5;
                const y = eyeY + at.y + across * at.thick;
                // Just proud of the skin, so it never dips into it.
                position.setXYZ(
                    v,
                    at.x * side,
                    y,
                    depthAt(at.x, y) + 0.0009 * forward
                );
            });
        });
    }
    position.needsUpdate = true;
    brow.mesh.userData.solid = true;
}

const colour = (hex: string) => {
    const c = rgb(hex);
    return vec3(c[0], c[1], c[2]);
};

/** Soft-shaded materials over the base's own textures, in the palette. */
function restyleMaterials(
    vrm: Vrm,
    recipe: VroidRecipe,
    meshes: THREE.SkinnedMesh[],
    waistY: number
) {
    const p = recipe.palette;
    const base = rgb(VROID_SKIN);
    const skin = rgb(p.skin);
    const skinTint = vec3(
        skin[0] / base[0],
        skin[1] / base[1],
        skin[2] / base[2]
    );
    const shade = rgb(p.skinShade);
    const shadeTint = vec3(
        shade[0] / skin[0],
        shade[1] / skin[1],
        shade[2] / skin[2]
    );
    // A soft key from the front and a weaker one behind, as on the sheet.
    const lit = () => {
        const n = normalWorld;
        const key = max(dot(n, KEY), saturate(dot(n, REAR)).mul(0.9));
        return smoothstep(-0.35, 0.75, key);
    };
    const made = new Map<THREE.Material, THREE.Material>();
    const make = (source: THREE.MeshStandardMaterial) => {
        const name = source.name || "";
        const material = new THREE.MeshBasicNodeMaterial();
        material.name = name;
        material.side = source.side;
        material.transparent = source.transparent;
        material.alphaTest = source.alphaTest;
        material.depthWrite = source.depthWrite;
        const map = source.map;
        const tex: Node = map ? texture(map) : null;
        let rgbNode: Node = tex ? tex.rgb : vec3(1);
        if (/_SKIN/.test(name)) {
            // Underwear is painted into the body's texture as near-black:
            // above the waist it is painted out, below it is recoloured.
            const brightest = tex ? max(tex.r, max(tex.g, tex.b)) : f32(1);
            const dark = smoothstep(0.22, 0.1, brightest);
            // The painted-out top takes its soft edge with it.
            const darkish = smoothstep(0.8, 0.5, brightest);
            const top = smoothstep(
                waistY - 0.01,
                waistY + 0.01,
                positionGeometry.y
            );
            // The torso's painted shading belongs to the base's bust: most
            // of it goes too.
            const skinColour = mix(
                rgbNode,
                vec3(base[0], base[1], base[2]),
                max(darkish, f32(/Body/.test(name) ? 0.8 : 0)).mul(top)
            ).mul(skinTint);
            const shaded = skinColour.mul(mix(shadeTint, SUN, lit()));
            const shorts = colour(p.underwear).mul(
                mix(f32(0.55), f32(1), lit())
            );
            rgbNode = /Body/.test(name)
                ? mix(shaded, shorts, dark.mul(f32(1).sub(top)))
                : shaded;
        } else if (/EyeIris/.test(name)) {
            // Keep the painted iris's light and dark, in the new colour.
            const light = dot(rgbNode, vec3(0.3, 0.6, 0.1)).div(0.022);
            rgbNode = colour(p.iris).mul(light.min(3.5));
        } else if (/FaceBrow/.test(name)) rgbNode = colour(p.brow);
        else if (/Eyeline|Eyelash/.test(name)) rgbNode = colour(p.lash);
        else if (/_HAIR/.test(name)) {
            const light = dot(rgbNode, vec3(0.3, 0.6, 0.1)).div(0.072);
            rgbNode = colour(p.hair)
                .mul(light.min(3))
                .mul(mix(f32(0.6), f32(1.15), lit()));
        } else if (/FaceMouth/.test(name))
            rgbNode = rgbNode.mul(skinTint).mul(1.05);
        material.colorNode = rgbNode;
        if (tex && !/FaceBrow/.test(name))
            material.opacityNode = tex.a.mul(source.opacity);
        if (/FaceBrow/.test(name)) {
            // Drawn brows are solid shapes, not a texture's stroke.
            material.transparent = false;
            material.alphaTest = 0;
            material.depthWrite = true;
        }
        return material;
    };
    for (const mesh of meshes) {
        const swap = (source: THREE.Material) => {
            let material = made.get(source);
            if (!material) {
                material = make(source as THREE.MeshStandardMaterial);
                made.set(source, material);
            }
            return material;
        };
        mesh.material = Array.isArray(mesh.material)
            ? mesh.material.map(swap)
            : swap(mesh.material);
    }
    return [...made.values()];
}

/** Reshape and restyle a loaded VRoid base model in place. */
export function restyleVroid(vrm: Vrm, recipe: VroidRecipe) {
    const { meshes } = reshapeMeshes(vrm, recipe);
    reshapeFace(vrm, recipe, meshes);
    flattenChest(vrm, recipe, meshes);
    bakeMorphs(recipe, meshes);
    const parts = faceParts(meshes);
    // Which way the figure faces in the space its meshes are in: its
    // toes point there.
    const stance = restPositions(meshes[0].skeleton);
    const bone = (name: string) =>
        stance[
            meshes[0].skeleton.bones.indexOf(vrm.humanoid.getRawBoneNode(name))
        ];
    const facing = Math.sign(bone("leftToes")[2] - bone("leftFoot")[2]) || 1;
    const marks = sculptFace(recipe, parts, facing);
    if (marks) drawBrows(recipe, parts, marks.eye[1], facing);
    // Stand it on the floor again, and find its new waist.
    let floor = Infinity;
    let top = -Infinity;
    for (const mesh of meshes) {
        const position = mesh.geometry.attributes.position;
        for (let v = 0; v < position.count; v++) {
            floor = Math.min(floor, position.getY(v));
            top = Math.max(top, position.getY(v));
        }
        mesh.geometry.computeBoundingBox();
        mesh.geometry.computeBoundingSphere();
    }
    const body = meshes[0];
    const rest = restPositions(body.skeleton);
    const spine = body.skeleton.bones.indexOf(
        vrm.humanoid.getRawBoneNode("spine")
    );
    const materials = restyleMaterials(
        vrm,
        recipe,
        meshes,
        rest[spine][1] + 0.06
    );
    vrm.scene.position.y -= floor;
    vrm.scene.updateMatrixWorld(true);
    let triangles = 0;
    for (const mesh of meshes)
        triangles += mesh.geometry.index
            ? mesh.geometry.index.count / 3
            : mesh.geometry.attributes.position.count / 3;
    return { height: top - floor, triangles, materials };
}
