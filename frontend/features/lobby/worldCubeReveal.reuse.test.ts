import * as THREE from "three";
import { createWorldCubeReveal } from "./worldCubeReveal";

function fixture() {
    const scene = new THREE.Scene();
    const root = new THREE.Group();
    const material = new THREE.MeshBasicMaterial({
        side: THREE.DoubleSide,
        map: new THREE.Texture(),
    });
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(8, 4), material);
    wall.position.set(0, 2, -4);
    root.add(wall);
    scene.add(root);
    const background = (scene.background = new THREE.Color(0x123456));
    const fog = (scene.fog = new THREE.Fog(0x123456, 1, 40));
    const originalHook = jest.fn();
    scene.onBeforeRender = originalHook;
    const effect = createWorldCubeReveal(THREE, [root], {
        scene,
        coverage: "all",
        anchor: { x: 0, y: 0, z: 0 },
        cellSize: 1,
    });
    const container = scene.getObjectByName("native-world-cube-reveal");
    const batch = container.children.find((object) =>
        object.name.startsWith("world-batch:")
    ) as THREE.Mesh;
    const position = batch.geometry.attributes
        .position as THREE.BufferAttribute;
    const draw = () =>
        scene.onBeforeRender(null, scene, null, null, null, null);
    return {
        scene,
        root,
        wall,
        material,
        effect,
        container,
        batch,
        position,
        background,
        fog,
        originalHook,
        draw,
    };
}
const departure = {
    mode: "dissolve" as const,
    direction: "inward" as const,
    anchor: { x: 3, y: 0, z: 2 },
};

test("parked arrival reuses exact buffers for inward departure with a new feet anchor and no clipping", () => {
    const f = fixture();
    f.effect.setProgress(1);
    const buffers = f.container.children.map(
        (mesh: THREE.Mesh) => mesh.geometry
    );
    const bufferDisposes = buffers.map((geometry) =>
        jest.spyOn(geometry, "dispose")
    );
    const clipTests = f.effect.stats.clipTests;
    const version = f.position.version;
    const initialSchedule = f.container.userData.worldRevealSchedule;
    const oldArray = f.position.array;
    expect(f.effect.park()).toBe(true);
    expect(f.container.parent).toBeNull();
    expect(f.scene.onBeforeRender).toBe(f.originalHook);
    expect(f.wall.visible).toBe(true);
    expect(f.effect.canReuse()).toBe(true);
    expect(f.effect.restart(departure)).toBe(true);
    expect(f.container.parent).toBe(f.scene);
    expect(f.wall.visible).toBe(true);
    expect(f.container.visible).toBe(false);
    expect(f.position.array).toBe(oldArray);
    expect(f.position.version).toBe(version);
    expect(
        f.container.children.map((mesh: THREE.Mesh) => mesh.geometry)
    ).toEqual(buffers);
    const steps = f.container.userData.worldRevealSchedule;
    expect(steps).not.toEqual(initialSchedule);
    const byDistance = [...steps].sort((a, b) => a.distance - b.distance);
    expect(byDistance[0].delay).toBeGreaterThan(
        byDistance[byDistance.length - 1].delay
    );
    f.effect.setProgress(0.5);
    expect(f.wall.visible).toBe(false);
    expect(f.container.visible).toBe(true);
    expect(f.effect.stats.clipTests).toBe(clipTests);
    f.effect.setProgress(1);
    expect(f.wall.visible).toBe(false);
    expect(f.container.visible).toBe(false);
    expect(bufferDisposes.every((spy) => !spy.mock.calls.length)).toBe(true);
    f.effect.park();
    expect(f.wall.visible).toBe(true);
    f.effect.dispose();
    f.effect.dispose();
    expect(bufferDisposes.every((spy) => spy.mock.calls.length === 1)).toBe(
        true
    );
    expect(f.position.array.length).toBe(0);
    expect(f.effect.canReuse()).toBe(false);
});

test("park and eviction leave later live visibility, sky, fog and hooks alone", () => {
    const f = fixture();
    f.effect.setProgress(1);
    f.effect.park();
    const background = (f.scene.background = new THREE.Color(0x654321));
    const fog = (f.scene.fog = new THREE.Fog(0x654321, 2, 50));
    const hook = (f.scene.onBeforeRender = jest.fn());
    f.wall.visible = false;
    f.effect.setProgress(0.5);
    f.effect.setRevealAnchor({ x: 0, y: 0, z: 5 });
    f.effect.park();
    f.effect.dispose();
    expect(f.wall.visible).toBe(false);
    expect(f.scene.background).toBe(background);
    expect(f.scene.fog).toBe(fog);
    expect(f.scene.onBeforeRender).toBe(hook);
});

test("restart refreshes cloned texture slots without needing material.version and restores the current sky on cancellation", () => {
    const f = fixture();
    f.effect.setProgress(1);
    f.effect.park();
    const materialVersion = f.material.version;
    const map = (f.material.map = new THREE.Texture());
    f.material.color.setRGB(0.4, 0.6, 0.8);
    const background = (f.scene.background = new THREE.Color(0x654321));
    const fog = (f.scene.fog = new THREE.Fog(0x654321, 2, 50));
    expect(f.material.version).toBe(materialVersion);
    expect(f.effect.restart(departure)).toBe(true);
    const clone = f.batch.material as THREE.MeshBasicMaterial;
    expect(clone.map).toBe(map);
    expect(clone.color).toEqual(f.material.color);
    expect(clone.side).toBe(THREE.DoubleSide);
    expect(f.material.side).toBe(THREE.DoubleSide);
    f.effect.setProgress(0.5);
    f.effect.dispose();
    expect(f.scene.background).toBe(background);
    expect(f.scene.fog).toBe(fog);
    expect(f.wall.visible).toBe(true);
});

test.each([
    ["transform", (f) => f.wall.position.set(1, 2, -4)],
    [
        "replaced geometry",
        (f) => (f.wall.geometry = new THREE.PlaneGeometry(8, 4)),
    ],
    [
        "updated vertices",
        (f) => (f.wall.geometry.attributes.position.needsUpdate = true),
    ],
    ["updated indices", (f) => (f.wall.geometry.index.needsUpdate = true)],
    ["draw range", (f) => f.wall.geometry.setDrawRange(0, 3)],
    ["groups", (f) => f.wall.geometry.addGroup(0, 3, 0)],
    [
        "material replacement",
        (f) => (f.wall.material = new THREE.MeshBasicMaterial()),
    ],
    ["material side", (f) => (f.wall.material.side = THREE.BackSide)],
    ["removal", (f) => f.root.remove(f.wall)],
    ["hidden source", (f) => (f.wall.visible = false)],
    ["hidden ancestor", (f) => (f.root.visible = false)],
    ["excluded source", (f) => (f.wall.userData.worldRevealExclude = true)],
    ["disposed geometry", (f) => f.wall.geometry.dispose()],
] as Array<[string, (f: ReturnType<typeof fixture>) => void]>)(
    "%s invalidates replay without touching the current scene",
    (_, mutate) => {
        const f = fixture();
        f.effect.setProgress(1);
        f.effect.park();
        mutate(f);
        const visible = f.wall.visible;
        const background = (f.scene.background = new THREE.Color(0x123));
        const fog = (f.scene.fog = new THREE.Fog(0x123, 1, 2));
        expect(f.effect.canReuse()).toBe(false);
        expect(f.effect.restart(departure)).toBe(false);
        expect(f.container.parent).toBeNull();
        expect(f.wall.visible).toBe(visible);
        expect(f.scene.background).toBe(background);
        expect(f.scene.fog).toBe(fog);
        expect(f.scene.onBeforeRender).toBe(f.originalHook);
        f.effect.dispose();
        expect(f.wall.visible).toBe(visible);
        expect(f.scene.background).toBe(background);
    }
);

test("late source additions are discoverable without invalidating or hiding the cached architecture", () => {
    const f = fixture();
    f.effect.setProgress(1);
    f.effect.park();
    const group = new THREE.Group();
    const added = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial()
    );
    const hidden = added.clone();
    hidden.visible = false;
    const excluded = new THREE.Group();
    excluded.userData.worldRevealExclude = true;
    excluded.add(added.clone());
    group.add(added, hidden, excluded);
    f.root.add(group);
    expect(f.effect.canReuse()).toBe(true);
    expect(f.effect.getAddedSources()).toEqual([added]);
    expect(f.effect.restart(departure)).toBe(true);
    f.effect.setProgress(0.5);
    f.draw();
    expect(added.visible).toBe(true);
    expect(f.wall.visible).toBe(false);
    f.effect.dispose();
});

test("a skipped placeholder becoming supported is delegated as a new source", () => {
    const scene = new THREE.Scene();
    const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(),
        new THREE.ShaderMaterial()
    );
    scene.add(mesh);
    const effect = createWorldCubeReveal(THREE, [scene], {
        scene,
        anchor: { x: 0, y: 0, z: 0 },
    });
    effect.setProgress(1);
    effect.park();
    expect(effect.getAddedSources()).toEqual([]);
    mesh.material = new THREE.MeshBasicMaterial() as any;
    expect(effect.getAddedSources()).toEqual([mesh]);
    expect(effect.canReuse()).toBe(true);
    expect(effect.restart(departure)).toBe(true);
    effect.setProgress(0.5);
    scene.onBeforeRender(null, scene, null, null, null, null);
    expect(mesh.visible).toBe(true);
    effect.dispose();
});

test("renderer wrappers around an old hook remain safe across repeated restarts", () => {
    const f = fixture();
    const old = f.scene.onBeforeRender;
    const wrapper = jest.fn(function (this: unknown, ...args: any[]) {
        old.apply(this, args);
    });
    f.scene.onBeforeRender = wrapper;
    f.effect.setProgress(1);
    f.effect.park();
    expect(f.scene.onBeforeRender).toBe(wrapper);
    for (let i = 0; i < 3; i++) {
        expect(f.effect.restart(departure)).toBe(true);
        f.effect.setProgress(0.5);
        f.wall.visible = true;
        f.draw();
        expect(f.wall.visible).toBe(false);
        f.effect.park();
        expect(f.scene.onBeforeRender).toBe(wrapper);
        f.draw();
        expect(f.wall.visible).toBe(true);
    }
    expect(wrapper).toHaveBeenCalledTimes(6);
    expect(f.originalHook).toHaveBeenCalledTimes(6);
    f.effect.dispose();
});

test("instance color/transform uploads invalidate retained virtual geometry", () => {
    for (const changed of ["instanceMatrix", "instanceColor"]) {
        const scene = new THREE.Scene();
        const mesh = new THREE.InstancedMesh(
            new THREE.PlaneGeometry(),
            new THREE.MeshBasicMaterial(),
            1
        );
        mesh.setColorAt(0, new THREE.Color(1, 0.5, 0.25));
        scene.add(mesh);
        const effect = createWorldCubeReveal(THREE, [mesh], {
            scene,
            anchor: { x: 0, y: 0, z: 0 },
        });
        effect.setProgress(1);
        effect.park();
        expect(effect.canReuse()).toBe(true);
        mesh[changed].needsUpdate = true;
        expect(effect.canReuse()).toBe(false);
        effect.dispose();
    }
});

test("invalid restart coordinates do not disturb a parked controller", () => {
    const f = fixture();
    f.effect.setProgress(1);
    f.effect.park();
    expect(
        f.effect.restart({ ...departure, anchor: { x: NaN, y: 0, z: 0 } })
    ).toBe(false);
    expect(f.container.parent).toBeNull();
    expect(f.effect.canReuse()).toBe(true);
    expect(f.effect.restart(departure)).toBe(true);
    f.effect.dispose();
});

test("reanchored separately prepared media accepts the updated room wave extent without rebuilding", () => {
    const f = fixture();
    const original = f.position.array;
    const triangles = f.effect.stats.triangles;
    const clips = f.effect.stats.clipTests;
    f.effect.setProgress(0.4);
    f.effect.setRevealAnchor({ x: 1, y: 0, z: 0 }, 50);
    const schedule = f.container.userData.worldRevealSchedule;
    expect(Math.max(...schedule.map((step) => step.delay))).toBeLessThan(0.5);
    expect(f.position.array).toBe(original);
    expect(f.effect.stats.triangles).toBe(triangles);
    expect(f.effect.stats.clipTests).toBe(clips);
    expect(() =>
        f.effect.setRevealAnchor({ x: NaN, y: 0, z: 0 }, 100)
    ).toThrow();
    expect(f.container.userData.worldRevealSchedule).toBe(schedule);
    f.effect.dispose();
});

test("cache miss diagnostics identify the first source change and clear after validity returns", () => {
    const f = fixture();
    f.wall.name = "wanimal-wall";
    f.root.name = "room";
    f.effect.setProgress(1);
    f.effect.park();
    f.wall.position.x = 1;
    expect(f.effect.canReuse()).toBe(false);
    expect(f.effect.stats.reuseMiss).toBe("wanimal-wall state[21]:0->1");
    f.wall.position.x = 0;
    expect(f.effect.canReuse()).toBe(true);
    expect(f.effect.stats.reuseMiss).toBe("");
    f.root.visible = false;
    expect(f.effect.canReuse()).toBe(false);
    expect(f.effect.stats.reuseMiss).toBe("wanimal-wall hidden:room");
    f.effect.dispose();
});
