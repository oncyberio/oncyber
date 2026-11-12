import * as THREE from "three";
import { createWorldCubeReveal } from "./worldCubeReveal";
import {
    WORLD_STAND_UP_FLOOR_RADIUS_M,
    WORLD_TILE_REVEAL_MS,
    worldStandUpProgress,
} from "./worldTileMotion";
import { TRAVEL_ARRIVAL_MS } from "./travelAnimationSequence";

describe("worldStandUpProgress", () => {
    test("a stand-up that fits in the reveal starts so both end together", () => {
        const start = worldStandUpProgress(0.1, TRAVEL_ARRIVAL_MS);
        expect(start).toBeCloseTo(1 - TRAVEL_ARRIVAL_MS / WORLD_TILE_REVEAL_MS);
        // 805 ms of the 1,000 ms reveal: the whole stand-up is saved.
        expect((1 - start) * WORLD_TILE_REVEAL_MS).toBeCloseTo(
            TRAVEL_ARRIVAL_MS
        );
    });
    test("never before the floor around the travellers has assembled", () => {
        expect(worldStandUpProgress(0.8, TRAVEL_ARRIVAL_MS)).toBe(0.8);
        expect(worldStandUpProgress(1, TRAVEL_ARRIVAL_MS)).toBe(1);
    });
    test("unknown or invalid inputs fall back to standing up after the reveal", () => {
        expect(worldStandUpProgress(NaN, TRAVEL_ARRIVAL_MS)).toBe(1);
        expect(worldStandUpProgress(undefined, TRAVEL_ARRIVAL_MS)).toBe(1);
        expect(worldStandUpProgress(0.1, NaN)).toBe(1);
        expect(worldStandUpProgress(0.1, 0)).toBe(1);
    });
    test("a handoff longer than the reveal starts once the floor is ready", () => {
        expect(worldStandUpProgress(0.3, WORLD_TILE_REVEAL_MS * 2)).toBe(0.3);
    });
});

describe("world reveal completeWithin", () => {
    function floorReveal() {
        const scene = new THREE.Scene();
        const floor = new THREE.Mesh(
            new THREE.PlaneGeometry(24, 24).rotateX(-Math.PI / 2),
            new THREE.MeshBasicMaterial()
        );
        scene.add(floor);
        scene.updateMatrixWorld(true);
        const effect = createWorldCubeReveal(THREE, [floor], {
            scene,
            anchor: { x: 0, y: 0, z: 0 },
            cellSize: 1,
            radius: 18,
        });
        const container = scene.getObjectByName("native-world-cube-reveal");
        return { effect, schedule: container.userData.worldRevealSchedule };
    }

    test("near cells finish first, and the reported progress covers every one of them", () => {
        const { effect, schedule } = floorReveal();
        const near = effect.completeWithin(WORLD_STAND_UP_FLOOR_RADIUS_M);
        const all = effect.completeWithin(Infinity);
        expect(near).toBeGreaterThan(0);
        expect(near).toBeLessThan(all);
        for (const step of schedule)
            if (step.distance <= WORLD_STAND_UP_FLOOR_RADIUS_M)
                expect(step.delay + step.span).toBeLessThanOrEqual(near + 1e-9);
        // On this 24 m floor the 3 m ring is assembled at about 44% of the
        // reveal, so the stand-up starts there and most of it overlaps.
        const start = worldStandUpProgress(near, TRAVEL_ARRIVAL_MS);
        expect(start).toBe(near);
        expect((1 - start) * WORLD_TILE_REVEAL_MS).toBeGreaterThan(500);
        expect((1 - start) * WORLD_TILE_REVEAL_MS).toBeLessThan(
            TRAVEL_ARRIVAL_MS
        );
        effect.dispose();
    });

    test("with nothing near the anchor, nothing stands up early", () => {
        const { effect } = floorReveal();
        effect.setRevealAnchor({ x: 0, y: 40, z: 0 });
        expect(effect.completeWithin(WORLD_STAND_UP_FLOOR_RADIUS_M)).toBe(1);
        effect.dispose();
    });
});
