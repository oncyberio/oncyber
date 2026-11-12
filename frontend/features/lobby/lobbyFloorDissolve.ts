import { sampleWorldCell, WORLD_TILE_MAX_DELAY } from "./worldTileMotion";
import { createWorldTileBackMaterial } from "./worldTileBack";

/** A bounded adaptive mesh keeps the visible floor finely tiled without turning
 * the full 600m lobby plane into a million tiny quads. Distances are world metres. */
export const LOBBY_FLOOR_DISSOLVE = {
    extent: 300,
    radius: 90,
    nearRadius: 18,
    middleRadius: 44,
    nearSize: 0.625,
    middleSize: 1.25,
    outerSize: 5,
    farSize: 20,
    maxTiles: 16384,
    glow: [0.0075, 0.011, 0.02] as const,
};
export interface LobbyFloorTile {
    x: number;
    z: number;
    size: number;
    delay: number;
    seed: number;
}
const clamp = (value: number) =>
    Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;

export function buildLobbyFloorTiles(
    focusX: number,
    focusZ: number
): LobbyFloorTile[] {
    if (![focusX, focusZ].every(Number.isFinite))
        throw new Error("Lobby floor focus must be finite.");
    const config = LOBBY_FLOOR_DISSOLVE;
    const pending = [{ x: 0, z: 0, size: config.extent * 2 }];
    const tiles: LobbyFloorTile[] = [];
    while (pending.length) {
        const tile = pending.pop();
        const half = tile.size / 2;
        const distance = Math.hypot(
            Math.max(0, Math.abs(tile.x - focusX) - half),
            Math.max(0, Math.abs(tile.z - focusZ) - half)
        );
        const size =
            distance < config.nearRadius
                ? config.nearSize
                : distance < config.middleRadius
                ? config.middleSize
                : distance < config.radius
                ? config.outerSize
                : config.farSize;
        if (
            tile.size > size &&
            tiles.length + pending.length + 4 <= config.maxTiles
        ) {
            const quarter = half / 2;
            for (const x of [-quarter, quarter])
                for (const z of [-quarter, quarter])
                    pending.push({ x: tile.x + x, z: tile.z + z, size: half });
            continue;
        }
        const raw = Math.sin(tile.x * 127.1 + tile.z * 311.7) * 43758.5453;
        const seed = raw - Math.floor(raw);
        const base = Math.min(
            1,
            Math.hypot(tile.x - focusX, tile.z - focusZ) / config.radius
        );
        const fraction = clamp(
            Math.sqrt(base) +
                (seed - 0.5) * 0.035 * (1 - Math.abs(2 * base - 1))
        );
        tiles.push({ ...tile, seed, delay: fraction * WORLD_TILE_MAX_DELAY });
    }
    return tiles;
}

/** Real world-space triangles shared by WebGL and WebGPU. The caller owns the
 * floor material; this helper owns only its buffers and never touches avatars. */
export function createLobbyFloorDissolve(THREE: any, material: any) {
    let geometry = new THREE.BufferGeometry();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = "lobby-departure-tiles";
    mesh.frustumCulled = false;
    mesh.visible = false;
    const backMaterial = createWorldTileBackMaterial(THREE);
    const back = new THREE.Mesh(geometry, backMaterial.material);
    back.name = "lobby-tile-backs";
    back.frustumCulled = false;
    mesh.add(back);
    let tiles: LobbyFloorTile[] = [];
    let positions: any;
    let normals: any;
    let glow: any;
    let surface: any;
    let samples: Array<ReturnType<typeof sampleWorldCell>> = [];
    let motions: Array<Parameters<typeof sampleWorldCell>[1]> = [];
    let phases: string[] = [];
    let focus: { x: number; z: number } | undefined;
    let lastProgress = -1;
    let mode: "dissolve" | "reveal" = "dissolve";
    let disposed = false;
    const vertices = [
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
    ];
    const rotation = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const euler = new THREE.Euler();
    const prepare = (next: { x: number; z: number }) => {
        if (disposed || (focus?.x === next.x && focus?.z === next.z)) return;
        tiles = buildLobbyFloorTiles(next.x, next.z);
        focus = { x: next.x, z: next.z };
        const count = tiles.length * 6;
        const nextGeometry = new THREE.BufferGeometry();
        positions = new THREE.BufferAttribute(new Float32Array(count * 3), 3);
        normals = new THREE.BufferAttribute(new Float32Array(count * 3), 3);
        glow = new THREE.BufferAttribute(new Float32Array(count), 1);
        surface = new THREE.BufferAttribute(new Float32Array(count * 3), 3);
        const uv = new THREE.BufferAttribute(new Float32Array(count * 2), 2);
        positions.setUsage(THREE.DynamicDrawUsage);
        normals.setUsage(THREE.DynamicDrawUsage);
        glow.setUsage(THREE.DynamicDrawUsage);
        nextGeometry.setAttribute("uv", uv);
        nextGeometry.setAttribute("position", positions);
        nextGeometry.setAttribute("normal", normals);
        nextGeometry.setAttribute("lobbyTileGlow", glow);
        nextGeometry.setAttribute("lobbyFloorSurface", surface);
        motions = tiles.map((tile, index) => {
            for (let vertex = 0; vertex < 6; vertex++) {
                const offset = (index * 6 + vertex) * 3;
                uv.array[(index * 6 + vertex) * 2] =
                    (vertices[vertex][0] + 1) / 2;
                uv.array[(index * 6 + vertex) * 2 + 1] =
                    (vertices[vertex][1] + 1) / 2;
                surface.array[offset] =
                    tile.x + (vertices[vertex][0] * tile.size) / 2;
                surface.array[offset + 2] =
                    tile.z + (vertices[vertex][1] * tile.size) / 2;
            }
            return {
                center: { x: tile.x, y: 0, z: tile.z },
                anchor: { x: focus.x, y: 0, z: focus.z },
                delay: tile.delay,
                // Coarser horizon tiles retain the same restrained lift distance.
                cellSize: Math.min(1, tile.size),
                seed: tile.seed,
                mode,
            };
        });
        geometry.dispose();
        geometry = nextGeometry;
        mesh.geometry = geometry;
        back.geometry = geometry;
        mesh.userData.tiles = tiles.length;
        samples = [];
        phases = [];
        lastProgress = -1;
    };
    const setProgress = (
        value: number,
        nextFocus: { x: number; z: number },
        nextMode: "dissolve" | "reveal" = "dissolve"
    ) => {
        if (disposed) return;
        if (mode !== nextMode) {
            mode = nextMode;
            for (const motion of motions) motion.mode = mode;
            samples = [];
            phases = [];
            lastProgress = -1;
        }
        const progress = clamp(value);
        mesh.visible = progress > 0 && progress < 1;
        if (!mesh.visible) {
            lastProgress = -1;
            return;
        }
        prepare(nextFocus);
        if (progress === lastProgress) return;
        lastProgress = progress;
        let changed = false;
        for (let index = 0; index < tiles.length; index++) {
            const tile = tiles[index];
            const sample = sampleWorldCell(
                progress,
                motions[index],
                samples[index]
            );
            samples[index] = sample;
            const phase = !sample.visible
                ? "hidden"
                : sample.phase === "complete"
                ? "intact"
                : "moving";
            if (phase !== "moving" && phase === phases[index]) continue;
            phases[index] = phase;
            changed = true;
            euler.set(sample.rotation.x, sample.rotation.y, sample.rotation.z);
            quaternion.setFromEuler(euler);
            rotation.makeRotationFromQuaternion(quaternion);
            const m = rotation.elements;
            for (let vertex = 0; vertex < 6; vertex++) {
                const n = index * 6 + vertex,
                    offset = n * 3;
                const x =
                    ((vertices[vertex][0] * tile.size) / 2) * sample.scale;
                const z =
                    ((vertices[vertex][1] * tile.size) / 2) * sample.scale;
                positions.array[offset] =
                    tile.x + sample.offset.x + m[0] * x + m[8] * z;
                positions.array[offset + 1] =
                    sample.offset.y + m[1] * x + m[9] * z;
                positions.array[offset + 2] =
                    tile.z + sample.offset.z + m[2] * x + m[10] * z;
                normals.array[offset] = m[4];
                normals.array[offset + 1] = m[5];
                normals.array[offset + 2] = m[6];
                glow.array[n] = sample.glow;
            }
        }
        if (changed) {
            positions.needsUpdate = true;
            normals.needsUpdate = true;
            glow.needsUpdate = true;
        }
    };
    return {
        mesh,
        prepare,
        setProgress,
        dispose() {
            if (disposed) return;
            disposed = true;
            mesh.removeFromParent();
            geometry.dispose();
            backMaterial.dispose();
            tiles = [];
            motions = [];
            samples = [];
            phases = [];
        },
    };
}
