import * as THREE from "three";
import { createWorldCubeReveal } from "./worldCubeReveal";
import { createWorldTransitionMedia } from "./worldTransitionMedia";

const materials: Array<[string, () => THREE.Material | THREE.Material[]]> = [
    ["lit", () => new THREE.MeshStandardMaterial()],
    ["shader", () => new THREE.ShaderMaterial()],
    [
        "multiple materials",
        () => [new THREE.MeshBasicMaterial(), new THREE.MeshStandardMaterial()],
    ],
];

function fixture() {
    const scene = new THREE.Scene();
    const room = new THREE.Group();
    const wall = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial()
    );
    room.add(wall);
    scene.add(room);
    return { scene, room, wall };
}

function options(scene: THREE.Scene, mode: "reveal" | "dissolve" = "reveal") {
    return { scene, mode, anchor: { x: 0, y: 0, z: 0 }, cellSize: 2 };
}

const departure = {
    mode: "dissolve" as const,
    anchor: { x: 0, y: 0, z: 0 },
};

describe.each(["reveal", "dissolve"] as const)(
    "%s background exclusions",
    (mode) => {
        test.each(materials)(
            "explicit %s backdrop stays outside the geometry effect",
            (_, makeMaterial) => {
                const { scene, room, wall } = fixture();
                const backdrop = new THREE.Mesh(
                    new THREE.BoxGeometry(2, 2, 2),
                    makeMaterial()
                );
                backdrop.userData.worldTravelBackground = true;
                room.add(backdrop);
                const onSkip = jest.fn();
                const effect = createWorldCubeReveal(THREE, [room], {
                    ...options(scene, mode),
                    onSkip,
                });
                expect(effect.stats.cells).toBeGreaterThan(0);
                effect.setProgress(0.5);
                expect(wall.visible).toBe(false);
                expect(backdrop.visible).toBe(true);
                expect(onSkip).not.toHaveBeenCalled();
                effect.dispose();
                expect(wall.visible).toBe(true);
                expect(backdrop.visible).toBe(true);
            }
        );

        test("a tagged group excludes descendants even when a child is a separate root", () => {
            const { scene, room, wall } = fixture();
            const sky = new THREE.Group();
            sky.userData.worldTravelBackground = true;
            const backdrop = new THREE.Mesh(
                new THREE.BoxGeometry(),
                new THREE.ShaderMaterial()
            );
            sky.add(backdrop);
            room.add(sky);
            const onSkip = jest.fn();
            const effect = createWorldCubeReveal(THREE, [room, backdrop], {
                ...options(scene, mode),
                onSkip,
            });
            effect.setProgress(0.5);
            expect(wall.visible).toBe(false);
            expect(sky.visible).toBe(true);
            expect(backdrop.visible).toBe(true);
            expect(onSkip).not.toHaveBeenCalled();
            effect.dispose();
        });

        test("media roots beneath a tagged background are not hidden", () => {
            const { scene, wall } = fixture();
            const sky = new THREE.Group();
            sky.userData.worldTravelBackground = true;
            const backdrop = wall.clone();
            sky.add(backdrop);
            scene.add(sky);
            const effect = createWorldTransitionMedia(
                THREE,
                [sky, backdrop],
                options(scene, mode)
            );
            expect(effect.stats.cells).toBe(0);
            effect.setProgress(0.5);
            scene.onBeforeRender(null, scene, null, null, null, null);
            expect(sky.visible).toBe(true);
            expect(backdrop.visible).toBe(true);
            effect.dispose();
            expect(sky.visible).toBe(true);
            expect(backdrop.visible).toBe(true);
        });
    }
);

test.each(["source", "ancestor"])(
    "adding a background tag to a prepared %s invalidates cached tiles",
    (kind) => {
        const { scene, room, wall } = fixture();
        const effect = createWorldCubeReveal(THREE, [wall], options(scene));
        effect.setProgress(1);
        effect.park();
        (kind === "source" ? wall : room).userData.worldTravelBackground = true;
        expect(effect.canReuse()).toBe(false);
        expect(effect.restart(departure)).toBe(false);
        expect(effect.getAddedSources()).toEqual([]);
        expect(wall.visible).toBe(true);
        effect.dispose();
    }
);

test("late tagged groups stay outside media additions while new room geometry is discoverable", () => {
    const { scene, room, wall } = fixture();
    const effect = createWorldCubeReveal(THREE, [room], options(scene));
    effect.setProgress(1);
    effect.park();
    const sky = new THREE.Group();
    sky.userData.worldTravelBackground = true;
    const backdrop = wall.clone();
    sky.add(backdrop);
    const sculpture = wall.clone();
    room.add(sky, sculpture);
    expect(effect.getAddedSources()).toEqual([sculpture]);
    expect(effect.canReuse()).toBe(true);
    expect(effect.restart(departure)).toBe(true);
    effect.setProgress(0.5);
    expect(wall.visible).toBe(false);
    expect(backdrop.visible).toBe(true);
    expect(sky.visible).toBe(true);
    effect.dispose();
});

test("removing an explicit background tag makes the mesh discoverable as new geometry", () => {
    const { scene, room, wall } = fixture();
    const backdrop = wall.clone();
    backdrop.userData.worldTravelBackground = true;
    room.add(backdrop);
    const effect = createWorldCubeReveal(THREE, [room], options(scene));
    effect.setProgress(1);
    effect.park();
    backdrop.userData.worldTravelBackground = false;
    expect(effect.getAddedSources()).toEqual([backdrop]);
    expect(effect.canReuse()).toBe(true);
    effect.dispose();
});
