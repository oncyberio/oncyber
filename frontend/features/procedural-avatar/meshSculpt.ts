import * as THREE from "three/webgpu";
import {
    Fn,
    attribute,
    cameraPosition,
    float as f32,
    normalLocal,
    normalize,
    positionLocal,
    positionWorld,
} from "three/tsl";
import { meshField } from "./kernel/mesher";
import type { Vec3 } from "./kernel/sdf";
import type { Sculpt, SculptLayer, SculptMaterial } from "./sculpts/types";
import { HAIR_STRAND, surfaceColour } from "./shading";

/**
 * A sculpt turned into ordinary meshes, to be drawn the usual way.
 *
 * The traced reference pays for the whole sculpt at every pixel. Here the
 * sculpt is only consulted once, when the avatar is built: each layer is
 * cut into triangles, and what the tracer worked out per pixel by sampling
 * the field (how open each point is to the light, which lock of hair it
 * lies on and how far along) is stored on the vertices instead. The same
 * shading code then runs on the mesh, with no textures and no tracing.
 */

/** Edge length of a triangle on each kind of surface at detail 1, metres. */
export const SCULPT_CELL: Record<SculptMaterial, number> = {
    skin: 0.0026,
    eye: 0.002,
    hair: 0.003,
    cotton: 0.005,
    tie: 0.003,
    wool: 0.006,
    knit: 0.004,
    black: 0.004,
    badge: 0.003,
};

/** One layer of a sculpt as triangles, with what shading needs per vertex. */
export interface MeshedLayer {
    material: SculptMaterial;
    positions: Float32Array;
    normals: Float32Array;
    indices: Uint32Array;
    /** 1 in the open, 0 buried in a crease. */
    open: Float32Array;
    /** For hair: direction, coordinate across the lock, distance along. */
    hair?: Float32Array;
}

export interface MeshSculptOptions {
    /**
     * Triangle size relative to the finest build: 1 is for close-ups, 2 has
     * a quarter of the triangles, and so on.
     */
    coarseness?: number;
}

/** How much room there is along the normal at each vertex. */
function openness(
    layers: SculptLayer[],
    positions: Float32Array,
    normals: Float32Array
): Float32Array {
    const out = new Float32Array(positions.length / 3);
    const reach = [0.004, 0.013, 0.022, 0.031, 0.04];
    const margin = 0.045;
    for (let v = 0; v < out.length; v++) {
        const px = positions[v * 3];
        const py = positions[v * 3 + 1];
        const pz = positions[v * 3 + 2];
        // Only layers whose box the samples can come near.
        const near = layers.filter(
            (l) =>
                px > l.min[0] - margin &&
                px < l.max[0] + margin &&
                py > l.min[1] - margin &&
                py < l.max[1] + margin &&
                pz > l.min[2] - margin &&
                pz < l.max[2] + margin
        );
        let occluded = 0;
        let weight = 1;
        for (const h of reach) {
            const x = px + normals[v * 3] * h;
            const y = py + normals[v * 3 + 1] * h;
            const z = pz + normals[v * 3 + 2] * h;
            let d = h;
            for (const l of near) d = Math.min(d, l.shape.eval(x, y, z));
            occluded += (h - d) * weight;
            weight *= 0.8;
        }
        out[v] = Math.min(1, Math.max(0, 1 - occluded * 20));
    }
    return out;
}

/** Which lock each vertex of the hair lies on, and where on it. */
function hairFrames(
    sculpt: Sculpt,
    positions: Float32Array,
    normals: Float32Array
): Float32Array {
    const out = new Float32Array((positions.length / 3) * 4);
    const segments = sculpt.hair.segments.map((seg) => {
        const ba: Vec3 = [
            seg.b[0] - seg.a[0],
            seg.b[1] - seg.a[1],
            seg.b[2] - seg.a[2],
        ];
        return {
            seg,
            ba,
            l2: ba[0] * ba[0] + ba[1] * ba[1] + ba[2] * ba[2] || 1e-9,
        };
    });
    const unit = (x: number, y: number, z: number): Vec3 => {
        const l = Math.hypot(x, y, z) || 1;
        return [x / l, y / l, z / l];
    };
    for (let v = 0; v < positions.length / 3; v++) {
        const px = positions[v * 3];
        const py = positions[v * 3 + 1];
        const pz = positions[v * 3 + 2];
        let best = Infinity;
        let tangent: Vec3 = [0, -1, 0];
        let coord = 0;
        let run = 0.5;
        for (const { seg, ba, l2 } of segments) {
            const ax = px - seg.a[0];
            const ay = py - seg.a[1];
            const az = pz - seg.a[2];
            let k = (ax * ba[0] + ay * ba[1] + az * ba[2]) / l2;
            k = k < 0 ? 0 : k > 1 ? 1 : k;
            const qx = ax - ba[0] * k;
            const qy = ay - ba[1] * k;
            const qz = az - ba[2] * k;
            const out3 = unit(
                seg.out[0] + (seg.outEnd[0] - seg.out[0]) * k,
                seg.out[1] + (seg.outEnd[1] - seg.out[1]) * k,
                seg.out[2] + (seg.outEnd[2] - seg.out[2]) * k
            );
            const r = seg.ra + (seg.rb - seg.ra) * k;
            const thin = r * seg.flat;
            const o = qx * out3[0] + qy * out3[1] + qz * out3[2];
            const rx = qx - out3[0] * o;
            const ry = qy - out3[1] * o;
            const rz = qz - out3[2] * o;
            const wide2 = rx * rx + ry * ry + rz * rz;
            const k0 = Math.sqrt(wide2 / (r * r) + (o * o) / (thin * thin));
            const k1 = Math.sqrt(
                wide2 / (r * r * r * r) + (o * o) / (thin * thin * thin * thin)
            );
            const d = k1 < 1e-9 ? -thin : (k0 * (k0 - 1)) / k1;
            if (d >= best) continue;
            best = d;
            tangent = unit(
                seg.ta[0] + (seg.tb[0] - seg.ta[0]) * k,
                seg.ta[1] + (seg.tb[1] - seg.ta[1]) * k,
                seg.ta[2] + (seg.tb[2] - seg.ta[2]) * k
            );
            const across = unit(
                seg.sa[0] + (seg.sb[0] - seg.sa[0]) * k,
                seg.sa[1] + (seg.sb[1] - seg.sa[1]) * k,
                seg.sa[2] + (seg.sb[2] - seg.sa[2]) * k
            );
            coord =
                (qx * across[0] + qy * across[1] + qz * across[2]) /
                    HAIR_STRAND +
                seg.lock * 37.7;
            run = seg.va + (seg.vb - seg.va) * k;
        }
        if (sculpt.hair.cap.eval(px, py, pz) < best - 0.0005) {
            // The undercoat is combed straight down.
            const nx = normals[v * 3];
            const ny = normals[v * 3 + 1];
            const nz = normals[v * 3 + 2];
            // n x (n x up)
            const cx = -nz;
            const cz = nx;
            tangent = unit(ny * cz, nz * cx - nx * cz, -ny * cx);
            coord = (Math.atan2(px, pz) * 0.085) / HAIR_STRAND;
            run = 0.9;
        }
        out[v * 4] = tangent[0];
        out[v * 4 + 1] = tangent[1];
        out[v * 4 + 2] = coord;
        out[v * 4 + 3] = run + (tangent[2] < 0 ? 2 : 0);
    }
    return out;
}

/** Cut every layer of a sculpt into triangles. Plain data: worker-safe. */
export function meshSculpt(
    sculpt: Sculpt,
    options: MeshSculptOptions = {}
): MeshedLayer[] {
    const coarseness = options.coarseness ?? 1;
    const pad = 0.006;
    return sculpt.layers.map((layer) => {
        const raw = meshField(layer.shape, {
            min: [layer.min[0] - pad, layer.min[1] - pad, layer.min[2] - pad],
            max: [layer.max[0] + pad, layer.max[1] + pad, layer.max[2] + pad],
            cell: SCULPT_CELL[layer.material] * coarseness,
        });
        return {
            material: layer.material,
            positions: raw.positions,
            normals: raw.normals,
            indices: raw.indices,
            open: openness(sculpt.layers, raw.positions, raw.normals),
            hair:
                layer.material === "hair"
                    ? hairFrames(sculpt, raw.positions, raw.normals)
                    : undefined,
        };
    });
}

/** A sculpt as meshes, shaded like its traced reference. */
export function createMeshedAvatar(
    sculpt: Sculpt,
    options: MeshSculptOptions = {}
) {
    const layers = meshSculpt(sculpt, options);
    const group = new THREE.Group();
    group.name = `meshed-${sculpt.id}`;
    // One material for each kind of surface, shared by every piece of it.
    const materials = new Map<SculptMaterial, THREE.MeshBasicNodeMaterial>();
    const materialFor = (kind: SculptMaterial) => {
        let material = materials.get(kind);
        if (!material) {
            material = new THREE.MeshBasicNodeMaterial();
            material.colorNode = Fn(() =>
                surfaceColour(sculpt, {
                    pos: positionLocal,
                    n: normalize(normalLocal),
                    paintNormal: normalize(normalLocal),
                    rd: normalize(positionWorld.sub(cameraPosition)),
                    // Shadows are not traced here: what is left of them is
                    // the openness stored on each vertex.
                    shadow: f32(1).toVar(),
                    open: attribute("open", "float"),
                    kind,
                    hair: () => attribute("hair", "vec4"),
                })
            )();
            materials.set(kind, material);
        }
        return material;
    };
    let triangles = 0;
    for (const layer of layers) {
        if (!layer.indices.length) continue;
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute(
            "position",
            new THREE.BufferAttribute(layer.positions, 3)
        );
        geometry.setAttribute(
            "normal",
            new THREE.BufferAttribute(layer.normals, 3)
        );
        geometry.setAttribute("open", new THREE.BufferAttribute(layer.open, 1));
        if (layer.hair)
            geometry.setAttribute(
                "hair",
                new THREE.BufferAttribute(layer.hair, 4)
            );
        geometry.setIndex(new THREE.BufferAttribute(layer.indices, 1));
        const mesh = new THREE.Mesh(geometry, materialFor(layer.material));
        mesh.name = `${sculpt.id}-${layer.material}`;
        group.add(mesh);
        triangles += layer.indices.length / 3;
    }
    return {
        group,
        triangles,
        /** Where the face is, for framing a camera. */
        focus: [0, sculpt.face.eye[1], 0] as Vec3,
        dispose() {
            group.traverse((object) => {
                const mesh = object as THREE.Mesh;
                if (mesh.isMesh) mesh.geometry.dispose();
            });
            for (const material of materials.values()) material.dispose();
        },
    };
}
