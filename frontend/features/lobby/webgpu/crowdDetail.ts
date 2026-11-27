import type * as THREE from "three/webgpu";

/**
 * A crowd's far mesh: each avatar part again with fewer triangles, drawn
 * for visitors far enough off that the difference is smaller than a
 * pixel or so. A crowd of a hundred is mostly people a long way off, so
 * most of it is drawn with this.
 *
 * The parts are cut down once per avatar, when it is first prepared, and
 * the far mesh keeps every vertex of the near one (only the triangles
 * change), so it shares the near mesh's buffers and skinning.
 */

/** Parts smaller than this are drawn whole at any distance. */
export const FAR_MIN_TRIANGLES = 1500;
/** Aim for this share of a part's triangles. */
export const FAR_SHARE = 0.25;
/** But never move the surface more than this share of the part's size. */
export const FAR_MAX_ERROR = 0.012;
/** Keep the far mesh only if it saves at least this share of triangles. */
export const FAR_MIN_SAVING = 0.3;
/** Draw a visitor far when the far mesh is off by at most this many pixels. */
export const FAR_PIXELS = 1.5;

export interface FarPart {
    index: Uint32Array;
    triangles: number;
}

export interface FarMesh {
    /** One per part, null where the part is drawn whole. */
    parts: (FarPart | null)[];
    /** How far its surface may be from the near mesh's, in model units. */
    error: number;
    /** Triangles saved for each visitor drawn far. */
    saved: number;
}

/**
 * Cut every part of an avatar down for distance, or null when nothing
 * would be saved: small avatars are drawn whole.
 */
export async function createFarMesh(
    geometries: THREE.BufferGeometry[]
): Promise<FarMesh | null> {
    const triangles = (geometry: THREE.BufferGeometry) =>
        (geometry.index?.count ?? geometry.getAttribute("position").count) / 3;
    if (!geometries.some((g) => g.index && triangles(g) >= FAR_MIN_TRIANGLES))
        return null;
    const { MeshoptSimplifier } = await import("meshoptimizer");
    await MeshoptSimplifier.ready;
    let error = 0;
    let saved = 0;
    const parts = geometries.map((geometry) => {
        const index = geometry.index;
        const count = triangles(geometry);
        if (!index || count < FAR_MIN_TRIANGLES) return null;
        // Read through the attribute: it may be interleaved or quantized.
        const position = geometry.getAttribute("position");
        const positions = new Float32Array(position.count * 3);
        for (let v = 0; v < position.count; v++) {
            positions[v * 3] = position.getX(v);
            positions[v * 3 + 1] = position.getY(v);
            positions[v * 3 + 2] = position.getZ(v);
        }
        const [cut, partError] = MeshoptSimplifier.simplify(
            Uint32Array.from(index.array as ArrayLike<number>),
            positions,
            3,
            Math.floor(count * FAR_SHARE) * 3,
            FAR_MAX_ERROR
        );
        const kept = cut.length / 3;
        if (kept > count * (1 - FAR_MIN_SAVING)) return null;
        // The error is relative to the part's size: make it model units.
        error = Math.max(
            error,
            partError * MeshoptSimplifier.getScale(positions, 3)
        );
        saved += count - kept;
        return { index: cut, triangles: kept };
    });
    return saved ? { parts, error: Math.max(error, 1e-5), saved } : null;
}

/**
 * Whether a visitor this far from the camera may be drawn with the far
 * mesh: its error, in world metres, covers no more than `FAR_PIXELS` of a
 * view `height` pixels tall with a vertical field of view of `fov`
 * degrees.
 */
export function drawFar(
    error: number,
    distance: number,
    fov: number,
    height: number
) {
    if (!(error > 0) || !(height > 0)) return false;
    const pixel =
        (2 * distance * Math.tan(((fov || 50) * Math.PI) / 360)) / height;
    return error <= FAR_PIXELS * pixel;
}
