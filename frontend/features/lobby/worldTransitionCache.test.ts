import * as THREE from "three";
import { createWorldCubeReveal } from "./worldCubeReveal";
import {
    clearWorldTransitionCache,
    rememberWorldTransition,
    takeWorldTransition,
} from "./worldTransitionCache";

const details = {
    cellSize: 1,
    triangleBudget: 3000,
    refinement: undefined,
};
const effects: ReturnType<typeof createWorldCubeReveal>[] = [];

function fixture() {
    const scene = new THREE.Scene();
    const room = new THREE.Group();
    const surface = new THREE.Mesh(
        new THREE.PlaneGeometry(4, 3),
        new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })
    );
    surface.position.set(2, 1.5, -4);
    room.add(surface);
    scene.add(room);
    const effect = createWorldCubeReveal(THREE, [room], {
        scene,
        anchor: { x: 0, y: 0, z: 0 },
        coverage: "all",
        cellSize: details.cellSize,
        maxTriangles: details.triangleBudget,
    });
    effects.push(effect);
    effect.setProgress(1);
    const container = scene.getObjectByName("native-world-cube-reveal");
    const batch = container.children.find((child) =>
        child.name.startsWith("world-batch:")
    ) as THREE.Mesh;
    return { scene, room, surface, effect, container, batch };
}

afterEach(() => {
    clearWorldTransitionCache();
    for (const effect of effects.splice(0)) effect.dispose();
    jest.restoreAllMocks();
});

test("arrival ownership is taken once and departure reuses the exact geometry and attribute buffers", () => {
    const f = fixture();
    const geometry = f.batch.geometry;
    const attributes = Object.fromEntries(
        Object.entries<THREE.BufferAttribute>(geometry.attributes).map(
            ([name, attribute]) => [name, { attribute, array: attribute.array }]
        )
    );
    expect(rememberWorldTransition(f.room, f.effect, details)).toBe(true);
    expect(f.container.parent).toBeNull();
    expect(f.surface.visible).toBe(true);
    // Moving players/cameras outside the static room is not a cache invalidation.
    const player = new THREE.Object3D();
    player.position.set(9, 0, 4);
    f.scene.add(player);
    const cached = takeWorldTransition(f.room);
    expect(cached).toEqual({
        scene: f.room,
        effect: f.effect,
        details,
    });
    expect(takeWorldTransition(f.room)).toBeUndefined();
    expect(
        cached.effect.restart({
            mode: "dissolve",
            direction: "inward",
            anchor: { x: 9, y: 0, z: 4 },
        })
    ).toBe(true);
    expect(f.container.parent).toBe(f.scene);
    expect(f.batch.geometry).toBe(geometry);
    for (const [name, previous] of Object.entries(attributes)) {
        expect(geometry.attributes[name]).toBe(previous.attribute);
        expect(geometry.attributes[name].array).toBe(previous.array);
    }
    expect(f.surface.visible).toBe(true);
    cached.effect.setProgress(0.5);
    expect(f.surface.visible).toBe(false);
    // Cache cleanup no longer owns a checked-out effect.
    clearWorldTransitionCache();
    expect(f.container.parent).toBe(f.scene);
    cached.effect.dispose();
    expect(f.surface.visible).toBe(true);
});

test("parking another scene evicts the single previous entry without disposing shared source resources", () => {
    const first = fixture();
    const cutDispose = jest.spyOn(first.batch.geometry, "dispose");
    const sourceDispose = jest.spyOn(first.surface.geometry, "dispose");
    const second = fixture();
    expect(rememberWorldTransition(first.room, first.effect, details)).toBe(
        true
    );
    expect(rememberWorldTransition(second.room, second.effect, details)).toBe(
        true
    );
    expect(cutDispose).toHaveBeenCalledTimes(1);
    expect(sourceDispose).not.toHaveBeenCalled();
    expect(takeWorldTransition(second.room)?.effect).toBe(second.effect);
    expect(takeWorldTransition(first.room)).toBeUndefined();
});

test("failed parking leaves the current entry owned by the cache", () => {
    const f = fixture();
    rememberWorldTransition(f.room, f.effect, details);
    const failed = { park: jest.fn(() => false), dispose: jest.fn() };
    expect(rememberWorldTransition({}, failed as any, details)).toBe(false);
    expect(failed.dispose).not.toHaveBeenCalled();
    expect(takeWorldTransition(f.room)?.effect).toBe(f.effect);
});

test("a different scene cannot consume the old scene's buffers", () => {
    const f = fixture();
    const dispose = jest.spyOn(f.batch.geometry, "dispose");
    rememberWorldTransition(f.room, f.effect, details);
    expect(takeWorldTransition(new THREE.Group())).toBeUndefined();
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(takeWorldTransition(f.room)).toBeUndefined();
});

test.each(["geometry", "transform", "parent visibility"])(
    "%s mutation safely invalidates a parked room",
    (change) => {
        const f = fixture();
        const cutDispose = jest.spyOn(f.batch.geometry, "dispose");
        const originalGeometry = f.surface.geometry;
        const sourceDispose = jest.spyOn(originalGeometry, "dispose");
        rememberWorldTransition(f.room, f.effect, details);
        if (change === "geometry")
            f.surface.geometry = new THREE.PlaneGeometry(7, 2);
        else if (change === "transform") f.surface.position.x += 2;
        else f.room.visible = false;
        const currentGeometry = f.surface.geometry;
        const currentPosition = f.surface.position.clone();
        const currentRoomVisibility = f.room.visible;
        expect(takeWorldTransition(f.room)).toBeUndefined();
        expect(cutDispose).toHaveBeenCalledTimes(1);
        expect(sourceDispose).not.toHaveBeenCalled();
        expect(f.surface.geometry).toBe(currentGeometry);
        expect(f.surface.position.equals(currentPosition)).toBe(true);
        expect(f.room.visible).toBe(currentRoomVisibility);
    }
);

test("texture-only upgrades stay reusable and refresh cloned maps even without a material version change", () => {
    const f = fixture();
    const source = f.surface.material as THREE.MeshBasicMaterial;
    const clone = f.batch.material as THREE.MeshBasicMaterial;
    expect(clone).not.toBe(source);
    rememberWorldTransition(f.room, f.effect, details);
    const version = source.version;
    const upgraded = new THREE.Texture();
    source.map = upgraded;
    expect(source.version).toBe(version);
    const cached = takeWorldTransition(f.room);
    expect(cached?.effect).toBe(f.effect);
    expect(
        cached.effect.restart({
            mode: "dissolve",
            anchor: { x: 0, y: 0, z: 0 },
        })
    ).toBe(true);
    expect(clone.map).toBe(upgraded);
    expect(clone.side).toBe(THREE.DoubleSide);
    expect(source.side).toBe(THREE.DoubleSide);
});

test("clearing a parked entry frees owned buffers without restoring stale sky, hooks or visibility", () => {
    const f = fixture();
    const cutDispose = jest.spyOn(f.batch.geometry, "dispose");
    rememberWorldTransition(f.room, f.effect, details);
    const nextBackground = new THREE.Color("#102030");
    const nextFog = new THREE.Fog("#102030", 1, 40);
    const nextHook = jest.fn();
    f.scene.background = nextBackground;
    f.scene.fog = nextFog;
    f.scene.onBeforeRender = nextHook;
    f.surface.visible = false;
    clearWorldTransitionCache();
    clearWorldTransitionCache();
    expect(cutDispose).toHaveBeenCalledTimes(1);
    expect(f.scene.background).toBe(nextBackground);
    expect(f.scene.fog).toBe(nextFog);
    expect(f.scene.onBeforeRender).toBe(nextHook);
    expect(f.surface.visible).toBe(false);
});
