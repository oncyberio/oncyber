import * as THREE from "three";
import { createWorldCubeReveal } from "./worldCubeReveal";

// Native ESM Three uses ObsVector3 for Object3D.position, unlike its CJS build.
// Its clone keeps prototype accessors and enumerable _x/_y/_z storage.
class NativePosition {
    constructor(private _x = 0, private _y = 0, private _z = 0) {}
    get x() {
        return this._x;
    }
    set x(value: number) {
        this._x = value;
    }
    get y() {
        return this._y;
    }
    set y(value: number) {
        this._y = value;
    }
    get z() {
        return this._z;
    }
    set z(value: number) {
        this._z = value;
    }
    clone() {
        return new NativePosition(this.x, this.y, this.z);
    }
}
function fixture() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x123456);
    scene.fog = new THREE.Fog(0x123456, 2, 30);
    const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(2, 2),
        new THREE.MeshBasicMaterial()
    );
    mesh.position.set(4, 2, 1);
    scene.add(mesh);
    return { scene, mesh };
}
function positionBuffer(scene: THREE.Scene) {
    let position: THREE.BufferAttribute;
    scene.traverse((object) => {
        if (object.name.startsWith("world-batch:"))
            position = (object as THREE.Mesh).geometry.getAttribute(
                "position"
            ) as THREE.BufferAttribute;
    });
    return position;
}

describe("native getter-backed world reveal anchors", () => {
    test("initial and staged native position clones preserve coordinates without retaining mutable inputs", () => {
        const { scene, mesh } = fixture();
        const feet = new NativePosition(4, 2, 0).clone();
        expect(Object.keys(feet)).toEqual(["_x", "_y", "_z"]);
        expect({ ...feet }).not.toHaveProperty("x");
        const effect = createWorldCubeReveal(THREE, [mesh], {
            scene,
            anchor: feet,
            cellSize: 0.5,
            radius: 18,
        });
        expect(effect.stats.cells).toBeGreaterThan(0);
        const container = scene.getObjectByName("native-world-cube-reveal");
        const position = positionBuffer(scene);
        effect.setProgress(0.4);
        const initial = container.userData.worldRevealSchedule;
        const staged = new NativePosition(6, 2, 0).clone();
        effect.setRevealAnchor(staged);
        const rescheduled = container.userData.worldRevealSchedule;
        expect(positionBuffer(scene)).toBe(position);
        expect(
            rescheduled.some((step, i) => step.distance !== initial[i].distance)
        ).toBe(true);
        const snapshot = Array.from(position.array);
        staged.x = NaN;
        feet.y = Infinity;
        effect.setProgress(0.5);
        effect.setProgress(0.4);
        expect(Array.from(position.array)).toEqual(snapshot);
        expect(Array.from(position.array).every(Number.isFinite)).toBe(true);
        effect.setProgress(1);
        expect(mesh.visible).toBe(true);
        effect.dispose();
        expect(scene.children).toEqual([mesh]);
    });

    test.each([
        undefined,
        null,
        { x: NaN, y: 0, z: 0 },
        { x: 0, y: Infinity, z: 0 },
        { x: 0, y: 0, z: "1" },
    ])(
        "rejects an invalid initial anchor before changing the scene: %p",
        (anchor) => {
            const { scene, mesh } = fixture();
            const background = scene.background,
                fog = scene.fog;
            const update = jest.spyOn(scene, "updateMatrixWorld");
            expect(() =>
                createWorldCubeReveal(THREE, [mesh], {
                    scene,
                    anchor: anchor as any,
                })
            ).toThrow("Reveal anchor needs finite coordinates.");
            expect(update).not.toHaveBeenCalled();
            expect(scene.children).toEqual([mesh]);
            expect(scene.background).toBe(background);
            expect(scene.fog).toBe(fog);
            expect(mesh.visible).toBe(true);
        }
    );

    test("a rejected staged anchor preserves the active schedule, buffers and lifecycle", () => {
        const { scene, mesh } = fixture();
        const background = scene.background,
            fog = scene.fog;
        const effect = createWorldCubeReveal(THREE, [mesh], {
            scene,
            anchor: new NativePosition(4, 2, 0),
            cellSize: 0.5,
        });
        effect.setProgress(0.45);
        const container = scene.getObjectByName("native-world-cube-reveal");
        const schedule = container.userData.worldRevealSchedule;
        const position = positionBuffer(scene);
        const snapshot = Array.from(position.array),
            version = position.version;
        const activeBackground = scene.background;
        expect(() =>
            effect.setRevealAnchor(new NativePosition(4, NaN, 0))
        ).toThrow("Reveal anchor needs finite coordinates.");
        expect(container.userData.worldRevealSchedule).toBe(schedule);
        expect(Array.from(position.array)).toEqual(snapshot);
        expect(position.version).toBe(version);
        expect(scene.background).toBe(activeBackground);
        expect(scene.fog).toBeNull();
        expect(mesh.visible).toBe(false);
        effect.setProgress(1);
        expect(mesh.visible).toBe(true);
        effect.dispose();
        expect(scene.children).toEqual([mesh]);
        expect(scene.background).toBe(background);
        expect(scene.fog).toBe(fog);
    });
});
