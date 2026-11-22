import {
    linearDye,
    shapeWeights,
    visiblePart,
    type Look,
    type Surface,
} from "./look";

export interface KitDocument {
    buffers: { uri?: string; byteLength: number }[];
    materials: {
        extras?: Surface;
        pbrMetallicRoughness: { baseColorFactor?: number[] };
    }[];
    meshes: {
        primitives: { material: number }[];
        extras?: { targetNames?: string[] };
        weights?: number[];
    }[];
    nodes: { mesh?: number; skin?: number }[];
    extensions: {
        VRMC_vrm: {
            meta: { name: string; authors: string[]; [key: string]: unknown };
        };
    };
}

/** Reuse the immutable geometry/texture buffer. All edits are standard glTF
 * material factors, morph weights and references to the selected primitives. */
export function dressDocument(template: KitDocument, look: Look): KitDocument {
    const materials = template.materials.map((m) => {
        const dye = m.extras?.studioColor;
        if (!dye) return m;
        return {
            ...m,
            pbrMetallicRoughness: {
                ...m.pbrMetallicRoughness,
                baseColorFactor: [
                    ...linearDye(dye, look),
                    m.pbrMetallicRoughness.baseColorFactor?.[3] ?? 1,
                ],
            },
        };
    });
    const shapes = shapeWeights(look);
    const remap = new Map<number, number>();
    const meshes: KitDocument["meshes"] = [];
    template.meshes.forEach((m, i) => {
        const primitives = m.primitives.filter((p) =>
            visiblePart(materials[p.material].extras ?? {}, look)
        );
        if (!primitives.length) return;
        remap.set(i, meshes.length);
        const names = m.extras?.targetNames;
        meshes.push({
            ...m,
            primitives,
            ...(names?.length
                ? {
                      weights: names.map(
                          (name, j) => shapes[name] ?? m.weights?.[j] ?? 0
                      ),
                  }
                : {}),
        });
    });
    const nodes = template.nodes.map((n) => {
        if (n.mesh === undefined) return n;
        if (remap.has(n.mesh)) return { ...n, mesh: remap.get(n.mesh) };
        const { mesh, skin, ...group } = n;
        return group;
    });
    return { ...template, materials, meshes, nodes };
}

/** Pack the same playable document into a portable, self-contained VRM 1.0. */
export function packVrm(doc: KitDocument, binary: ArrayBuffer, name: string) {
    if (
        doc.buffers.length !== 1 ||
        binary.byteLength !== doc.buffers[0].byteLength
    )
        throw Error("Incomplete avatar geometry");
    const vrm = doc.extensions.VRMC_vrm;
    const json = new TextEncoder().encode(
        JSON.stringify({
            ...doc,
            buffers: [{ byteLength: binary.byteLength }],
            extensions: {
                ...doc.extensions,
                VRMC_vrm: { ...vrm, meta: { ...vrm.meta, name } },
            },
        })
    );
    const jsonSize = Math.ceil(json.length / 4) * 4;
    const binSize = Math.ceil(binary.byteLength / 4) * 4;
    const header = new ArrayBuffer(20);
    const fields = new DataView(header);
    [0x46546c67, 2, 28 + jsonSize + binSize, jsonSize, 0x4e4f534a].forEach(
        (v, i) => fields.setUint32(i * 4, v, true)
    );
    const binHeader = new DataView(new ArrayBuffer(8));
    binHeader.setUint32(0, binSize, true);
    binHeader.setUint32(4, 0x004e4942, true);
    return new Blob(
        [
            header,
            json,
            new Uint8Array(jsonSize - json.length).fill(32),
            binHeader.buffer,
            binary,
            new Uint8Array(binSize - binary.byteLength),
        ],
        { type: "model/gltf-binary" }
    );
}
export async function downloadLook(url: string, name: string) {
    const response = await fetch(url);
    if (!response.ok) throw Error("Could not load this build");
    const doc: KitDocument = await response.json();
    const geo = await fetch(doc.buffers[0].uri);
    if (!geo.ok) throw Error("Could not load the avatar geometry");
    const href = URL.createObjectURL(
        packVrm(doc, await geo.arrayBuffer(), name)
    );
    const link = document.createElement("a");
    link.href = href;
    link.download =
        (name.replace(/[^\p{L}\p{N} _-]/gu, "").slice(0, 40) || "Avatar") +
        ".vrm";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(href), 10000);
}
