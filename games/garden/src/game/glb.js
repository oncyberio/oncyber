import * as THREE from "three/webgpu";

// A small DOM-free glTF 2.0 (GLB) reader for VRM avatars, so avatars load in
// any WebGPU host: no GLTFLoader, no fetch, no Blob URLs, no WASM. Images are
// decoded by the host (graphics.decodeImage). Supports what Oncyber's avatar
// catalogue uses: uncompressed skinned meshes, PNG/JPEG textures, VRM 0.x and
// VRM 1.0 humanoid bones. Compressed extensions are refused, so the caller
// can fall back to a simple body.

const SUPPORTED = new Set([
    "VRM",
    "VRMC_vrm",
    "VRMC_materials_mtoon",
    "KHR_materials_unlit",
    "KHR_texture_transform",
    "VRMC_springBone",
    "VRMC_node_constraint",
    "KHR_materials_emissive_strength",
]);

const TYPES = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
const ARRAYS = {
    5120: Int8Array,
    5121: Uint8Array,
    5122: Int16Array,
    5123: Uint16Array,
    5125: Uint32Array,
    5126: Float32Array,
};

export function parseGLB(buffer) {
    const view = new DataView(buffer);
    if (view.getUint32(0, true) !== 0x46546c67) throw new Error("NOT_GLB");
    let offset = 12;
    let json = null;
    let bin = null;
    while (offset < buffer.byteLength) {
        const length = view.getUint32(offset, true);
        const type = view.getUint32(offset + 4, true);
        const start = offset + 8;
        if (type === 0x4e4f534a) {
            json = JSON.parse(bytesToText(buffer.slice(start, start + length)));
        } else if (type === 0x004e4942) bin = buffer.slice(start, start + length);
        offset = start + length;
    }
    if (!json || !bin) throw new Error("GLB_INCOMPLETE");
    for (const ext of json.extensionsRequired || [])
        if (!SUPPORTED.has(ext)) throw new Error(`GLB_UNSUPPORTED_${ext}`);
    return { json, bin };
}

function readAccessor(json, bin, index) {
    const acc = json.accessors[index];
    const size = TYPES[acc.type];
    const Arr = ARRAYS[acc.componentType];
    const count = acc.count;
    if (acc.bufferView === undefined) return { array: new Arr(count * size), size, normalized: !!acc.normalized };
    const bv = json.bufferViews[acc.bufferView];
    const base = (bv.byteOffset || 0) + (acc.byteOffset || 0);
    const elem = Arr.BYTES_PER_ELEMENT * size;
    const stride = bv.byteStride || elem;
    let array;
    if (stride === elem && base % Arr.BYTES_PER_ELEMENT === 0) {
        array = new Arr(bin, base, count * size).slice();
    } else {
        array = new Arr(count * size);
        const dv = new DataView(bin);
        const get = {
            5120: (o) => dv.getInt8(o),
            5121: (o) => dv.getUint8(o),
            5122: (o) => dv.getInt16(o, true),
            5123: (o) => dv.getUint16(o, true),
            5125: (o) => dv.getUint32(o, true),
            5126: (o) => dv.getFloat32(o, true),
        }[acc.componentType];
        for (let i = 0; i < count; i++)
            for (let k = 0; k < size; k++)
                array[i * size + k] = get(base + i * stride + k * Arr.BYTES_PER_ELEMENT);
    }
    return { array, size, normalized: !!acc.normalized };
}

const WRAP = {
    33071: THREE.ClampToEdgeWrapping,
    33648: THREE.MirroredRepeatWrapping,
    10497: THREE.RepeatWrapping,
};

/**
 * Build the scene. `decodeImage(bytes, mime)` returns a host image source.
 * `makeMaterial(params)` turns glTF material params into a node material.
 */
export async function buildGLB({ json, bin }, { decodeImage, makeMaterial }) {
    // Textures (decoded once each).
    const images = await Promise.all(
        (json.images || []).map(async (img) => {
            if (img.bufferView === undefined) return null;
            const bv = json.bufferViews[img.bufferView];
            const bytes = bin.slice(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength);
            try {
                return await decodeImage(bytes, img.mimeType || "image/png");
            } catch {
                return null;
            }
        })
    );
    const textures = (json.textures || []).map((t) => {
        const image = images[t.source];
        if (!image) return null;
        const tex = new THREE.Texture(image);
        tex.flipY = false;
        tex.colorSpace = THREE.SRGBColorSpace;
        const s = json.samplers?.[t.sampler] || {};
        tex.wrapS = WRAP[s.wrapS] ?? THREE.RepeatWrapping;
        tex.wrapT = WRAP[s.wrapT] ?? THREE.RepeatWrapping;
        tex.magFilter = s.magFilter === 9728 ? THREE.NearestFilter : THREE.LinearFilter;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.generateMipmaps = true;
        tex.needsUpdate = true;
        return tex;
    });
    const materials = (json.materials || []).map((m) => {
        const pbr = m.pbrMetallicRoughness || {};
        const f = pbr.baseColorFactor || [1, 1, 1, 1];
        return makeMaterial({
            color: new THREE.Color().setRGB(f[0], f[1], f[2], THREE.LinearSRGBColorSpace),
            opacity: f[3],
            map: pbr.baseColorTexture ? textures[pbr.baseColorTexture.index] : null,
            emissive: m.emissiveFactor ? new THREE.Color().setRGB(...m.emissiveFactor, THREE.LinearSRGBColorSpace) : null,
            emissiveMap: m.emissiveTexture ? textures[m.emissiveTexture.index] : null,
            alphaMode: m.alphaMode || "OPAQUE",
            alphaCutoff: m.alphaCutoff ?? 0.5,
            doubleSided: !!m.doubleSided,
        });
    });
    const fallback = makeMaterial({ color: new THREE.Color(0xcccccc), opacity: 1, alphaMode: "OPAQUE", doubleSided: false });

    // Nodes: joints become Bones.
    const jointSet = new Set();
    for (const skin of json.skins || []) for (const j of skin.joints) jointSet.add(j);
    const nodes = (json.nodes || []).map((n, i) => {
        const o = jointSet.has(i) ? new THREE.Bone() : new THREE.Group();
        o.name = n.name || `node${i}`;
        if (n.matrix) {
            new THREE.Matrix4().fromArray(n.matrix).decompose(o.position, o.quaternion, o.scale);
        } else {
            if (n.translation) o.position.fromArray(n.translation);
            if (n.rotation) o.quaternion.fromArray(n.rotation);
            if (n.scale) o.scale.fromArray(n.scale);
        }
        return o;
    });
    (json.nodes || []).forEach((n, i) => {
        for (const c of n.children || []) nodes[i].add(nodes[c]);
    });

    // Meshes.
    const skinned = [];
    (json.nodes || []).forEach((n, i) => {
        if (n.mesh === undefined) return;
        const mesh = json.meshes[n.mesh];
        for (const prim of mesh.primitives) {
            if (prim.mode !== undefined && prim.mode !== 4) continue;
            const geo = new THREE.BufferGeometry();
            const a = prim.attributes;
            const attr = (name, key) => {
                if (a[key] === undefined) return;
                const { array, size, normalized } = readAccessor(json, bin, a[key]);
                geo.setAttribute(name, new THREE.BufferAttribute(array, size, normalized));
            };
            attr("position", "POSITION");
            attr("normal", "NORMAL");
            attr("uv", "TEXCOORD_0");
            attr("skinIndex", "JOINTS_0");
            attr("skinWeight", "WEIGHTS_0");
            if (prim.indices !== undefined) {
                const { array } = readAccessor(json, bin, prim.indices);
                geo.setIndex(new THREE.BufferAttribute(array, 1));
            }
            if (!geo.attributes.normal) geo.computeVertexNormals();
            const material = materials[prim.material] || fallback;
            const isSkinned = n.skin !== undefined && geo.attributes.skinIndex;
            const m = isSkinned ? new THREE.SkinnedMesh(geo, material) : new THREE.Mesh(geo, material);
            m.name = mesh.name || "mesh";
            nodes[i].add(m);
            if (isSkinned) skinned.push({ mesh: m, skin: json.skins[n.skin] });
        }
    });

    const scene = new THREE.Group();
    const roots = json.scenes?.[json.scene || 0]?.nodes || nodes.map((_, i) => i).filter((i) => !nodes[i].parent);
    for (const r of roots) scene.add(nodes[r]);
    scene.updateMatrixWorld(true);
    for (const { mesh, skin } of skinned) {
        const bones = skin.joints.map((j) => nodes[j]);
        const inverses = [];
        if (skin.inverseBindMatrices !== undefined) {
            const { array } = readAccessor(json, bin, skin.inverseBindMatrices);
            for (let k = 0; k < bones.length; k++) inverses.push(new THREE.Matrix4().fromArray(array, k * 16));
        } else for (let k = 0; k < bones.length; k++) inverses.push(new THREE.Matrix4());
        mesh.bind(new THREE.Skeleton(bones, inverses), mesh.matrixWorld);
    }
    return { scene, nodes };
}

/** VRM humanoid bone map: name -> node index, for VRM 0.x and 1.0. */
export function humanBones(json) {
    const out = {};
    const v0 = json.extensions?.VRM?.humanoid?.humanBones;
    if (Array.isArray(v0)) for (const b of v0) out[b.bone] = b.node;
    const v1 = json.extensions?.VRMC_vrm?.humanoid?.humanBones;
    if (v1) for (const [name, b] of Object.entries(v1)) out[name] = b.node;
    return out;
}

export function vrmVersion(json) {
    return json.extensions?.VRMC_vrm ? "1" : json.extensions?.VRM ? "0" : null;
}

/** UTF-8 bytes to a string, without TextDecoder (not in every JS host). */
export function bytesToText(buffer) {
    const bytes = new Uint8Array(buffer);
    let out = "";
    for (let i = 0; i < bytes.length; ) {
        const c = bytes[i++];
        let cp = c;
        if (c >= 0xf0) cp = ((c & 7) << 18) | ((bytes[i++] & 63) << 12) | ((bytes[i++] & 63) << 6) | (bytes[i++] & 63);
        else if (c >= 0xe0) cp = ((c & 15) << 12) | ((bytes[i++] & 63) << 6) | (bytes[i++] & 63);
        else if (c >= 0xc0) cp = ((c & 31) << 6) | (bytes[i++] & 63);
        out += String.fromCodePoint(cp);
    }
    return out;
}
