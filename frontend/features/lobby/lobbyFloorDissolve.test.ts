import * as THREE from "three";
import {
    buildLobbyFloorTiles,
    createLobbyFloorDissolve,
    LOBBY_FLOOR_DISSOLVE,
} from "./lobbyFloorDissolve";

function tileArea(position: THREE.BufferAttribute, index: number) {
    let area = 0;
    for (const first of [index * 6, index * 6 + 3]) {
        const a = new THREE.Vector3().fromBufferAttribute(position, first);
        const b = new THREE.Vector3()
            .fromBufferAttribute(position, first + 1)
            .sub(a);
        const c = new THREE.Vector3()
            .fromBufferAttribute(position, first + 2)
            .sub(a);
        area += b.cross(c).length() / 2;
    }
    return area;
}

test("adaptive square tiles exactly cover the original floor and retain a bounded near-field density", () => {
    for (const [x, z] of [
        [0, 0],
        [17.2, -42.5],
        [295, -295],
    ]) {
        const tiles = buildLobbyFloorTiles(x, z);
        expect(tiles.length).toBeLessThanOrEqual(LOBBY_FLOOR_DISSOLVE.maxTiles);
        expect(tiles.reduce((area, tile) => area + tile.size ** 2, 0)).toBe(
            600 ** 2
        );
        expect(buildLobbyFloorTiles(x, z)).toEqual(tiles);
        for (const tile of tiles) {
            expect(Math.abs(tile.x) + tile.size / 2).toBeLessThanOrEqual(300);
            expect(Math.abs(tile.z) + tile.size / 2).toBeLessThanOrEqual(300);
            if (Math.hypot(tile.x - x, tile.z - z) < 18)
                expect(tile.size).toBeLessThanOrEqual(0.625);
        }
    }
    expect(() => buildLobbyFloorTiles(NaN, 0)).toThrow(/finite/);
});

test("physical departure rotates a real frontier outward while the far floor stays intact", () => {
    const material = new THREE.MeshBasicMaterial({ side: THREE.FrontSide });
    const effect = createLobbyFloorDissolve(THREE, material);
    const focus = { x: 3, z: -2 };
    effect.prepare(focus);
    const tiles = buildLobbyFloorTiles(focus.x, focus.z);
    effect.setProgress(0, focus);
    expect(effect.mesh.visible).toBe(false);
    effect.setProgress(1e-8, focus);
    const geometry = effect.mesh.geometry;
    const position = geometry.getAttribute("position") as THREE.BufferAttribute;
    const surface = geometry.getAttribute(
        "lobbyFloorSurface"
    ) as THREE.BufferAttribute;
    expect(Array.from(position.array)).toEqual(Array.from(surface.array));
    const sourceCoordinates = Array.from(surface.array);
    effect.setProgress(0.5, focus);
    let rotated = 0,
        missing = 0,
        intact = 0;
    for (let i = 0; i < tiles.length; i++) {
        const tile = tiles[i],
            distance = Math.hypot(tile.x - focus.x, tile.z - focus.z);
        const area = tileArea(position, i);
        if (distance < 4) {
            expect(area).toBe(0);
            missing++;
        }
        if (distance > 60) {
            expect(area).toBeCloseTo(tile.size ** 2, 4);
            intact++;
        }
        const heights = Array.from({ length: 6 }, (_, vertex) =>
            position.getY(i * 6 + vertex)
        );
        if (Math.max(...heights) - Math.min(...heights) > 0.02) rotated++;
    }
    expect(missing).toBeGreaterThan(50);
    expect(intact).toBeGreaterThan(100);
    expect(rotated).toBeGreaterThan(100);
    expect(Array.from(surface.array)).toEqual(sourceCoordinates);
    expect(effect.mesh.geometry).toBe(geometry);
    effect.setProgress(1, focus);
    expect(effect.mesh.visible).toBe(false);
    effect.dispose();
    material.dispose();
});

test("scrubbing reverses geometry exactly, cancellation hides it, and only owned buffers are disposed", () => {
    const material = new THREE.MeshBasicMaterial();
    const materialDispose = jest.spyOn(material, "dispose");
    const effect = createLobbyFloorDissolve(THREE, material);
    const scene = new THREE.Scene();
    scene.add(effect.mesh);
    const focus = { x: 0, z: 0 };
    effect.setProgress(0.4, focus);
    const geometry = effect.mesh.geometry;
    const geometryDispose = jest.spyOn(geometry, "dispose");
    const before = Array.from(geometry.getAttribute("position").array);
    effect.setProgress(0.8, focus);
    effect.setProgress(0.4, focus);
    expect(Array.from(geometry.getAttribute("position").array)).toEqual(before);
    effect.setProgress(0, focus);
    expect(effect.mesh.visible).toBe(false);
    effect.setProgress(0.4, focus);
    expect(Array.from(geometry.getAttribute("position").array)).toEqual(before);
    effect.prepare({ x: 20, z: 10 });
    expect(geometryDispose).toHaveBeenCalledTimes(1);
    const nextDispose = jest.spyOn(effect.mesh.geometry, "dispose");
    effect.dispose();
    effect.dispose();
    effect.setProgress(0.5, focus);
    expect(nextDispose).toHaveBeenCalledTimes(1);
    expect(materialDispose).not.toHaveBeenCalled();
    expect(scene.children).toHaveLength(0);
    material.dispose();
});

test("the physical floor remains two bounded draws with inexpensive frontier updates", () => {
    const effect = createLobbyFloorDissolve(
        THREE,
        new THREE.MeshBasicMaterial()
    );
    const focus = { x: 0, z: 0 };
    const begin = performance.now();
    effect.prepare(focus);
    const buildMs = performance.now() - begin;
    const updateAt = performance.now();
    for (const progress of [0.25, 0.26, 0.27, 0.28])
        effect.setProgress(progress, focus);
    expect(
        effect.mesh.geometry.getAttribute("position").count
    ).toBeLessThanOrEqual(LOBBY_FLOOR_DISSOLVE.maxTiles * 6);
    expect(effect.mesh.children).toHaveLength(1);
    console.info("lobby-floor-tiles", {
        tiles: effect.mesh.userData.tiles,
        buildMs: Math.round(buildMs),
        updateMs: Math.round((performance.now() - updateAt) / 4),
    });
    effect.dispose();
    effect.mesh.material.dispose();
});

test("return reveal builds near tiles before far tiles and safely reuses departure buffers", () => {
    const material = new THREE.MeshBasicMaterial({ side: THREE.FrontSide });
    const effect = createLobbyFloorDissolve(THREE, material);
    const focus = { x: 0, z: 0 };
    const tiles = buildLobbyFloorTiles(0, 0);
    effect.setProgress(0.5, focus);
    const geometry = effect.mesh.geometry;
    const position = geometry.getAttribute("position") as THREE.BufferAttribute;
    const surface = geometry.getAttribute(
        "lobbyFloorSurface"
    ) as THREE.BufferAttribute;
    const departure = Array.from(position.array);
    effect.setProgress(0, focus, "reveal");
    expect(effect.mesh.visible).toBe(false);
    effect.setProgress(0.5, focus, "reveal");
    expect(effect.mesh.geometry).toBe(geometry);
    let near = 0,
        far = 0,
        moving = 0;
    for (let i = 0; i < tiles.length; i++) {
        const tile = tiles[i],
            distance = Math.hypot(tile.x, tile.z);
        if (distance < 4) {
            expect(tileArea(position, i)).toBeCloseTo(tile.size ** 2, 4);
            near++;
        }
        if (distance > 60) {
            expect(tileArea(position, i)).toBe(0);
            far++;
        }
        if (
            Array.from({ length: 6 }, (_, j) => position.getY(i * 6 + j)).some(
                (y) => Math.abs(y) > 0.02
            )
        )
            moving++;
    }
    expect(near).toBeGreaterThan(50);
    expect(far).toBeGreaterThan(100);
    expect(moving).toBeGreaterThan(100);
    effect.setProgress(1 - 1e-12, focus, "reveal");
    let maxError = 0;
    for (let i = 0; i < position.array.length; i++)
        maxError = Math.max(
            maxError,
            Math.abs(position.array[i] - surface.array[i])
        );
    expect(maxError).toBeLessThan(1e-6);
    effect.setProgress(1, focus, "reveal");
    expect(effect.mesh.visible).toBe(false);
    effect.setProgress(0.5, focus);
    expect(Array.from(position.array)).toEqual(departure);
    effect.dispose();
    material.dispose();
});

test("neutral reverse faces share the real tile transforms, use local UVs and release their owned resources once", () => {
    const front = new THREE.MeshBasicMaterial({ side: THREE.FrontSide });
    const frontDispose = jest.spyOn(front, "dispose");
    const effect = createLobbyFloorDissolve(THREE, front);
    effect.setProgress(0.5, { x: 0, z: 0 }, "reveal");
    const back = effect.mesh.getObjectByName("lobby-tile-backs") as THREE.Mesh;
    expect(back.geometry).toBe(effect.mesh.geometry);
    const material = back.material as THREE.MeshBasicMaterial;
    expect(material.side).toBe(THREE.BackSide);
    expect(material.name).toBe("world-tile-dark-back");
    expect(material.depthTest).toBe(true);
    expect(material.depthWrite).toBe(true);
    expect(material.transparent).toBe(false);
    expect(material.map.name).toBe("world-tile-dark-back-gradient");
    const uv = back.geometry.getAttribute("uv");
    expect(Array.from(uv.array).slice(0, 12)).toEqual([
        0, 0, 0, 1, 1, 0, 1, 0, 0, 1, 1, 1,
    ]);
    const materialDispose = jest.spyOn(material, "dispose");
    const textureDispose = jest.spyOn(material.map, "dispose");
    const oldGeometry = back.geometry;
    const geometryDispose = jest.spyOn(oldGeometry, "dispose");
    effect.prepare({ x: 10, z: 10 });
    expect(back.geometry).toBe(effect.mesh.geometry);
    expect(back.geometry).not.toBe(oldGeometry);
    expect(geometryDispose).toHaveBeenCalledTimes(1);
    expect(materialDispose).not.toHaveBeenCalled();
    effect.dispose();
    effect.dispose();
    expect(materialDispose).toHaveBeenCalledTimes(1);
    expect(textureDispose).toHaveBeenCalledTimes(1);
    expect(frontDispose).not.toHaveBeenCalled();
    front.dispose();
});
