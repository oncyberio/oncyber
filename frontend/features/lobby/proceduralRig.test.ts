import * as THREE from "three";
import { createProceduralRig, createCrowdPosture } from "./proceduralRig";
import { createLobbyPosture } from "./lobbyPosture";
import { createLobbyLocomotion } from "./locomotion";

const grounded = { speed: 0, grounded: true, quality: "full" as const };
function rig(displayScale = 1) {
    const root = new THREE.Group();
    root.scale.setScalar(displayScale);
    const bones: Record<string, THREE.Bone> = {};
    function add(
        name: string,
        parent: THREE.Object3D,
        x: number,
        y: number,
        z = 0
    ) {
        const bone = new THREE.Bone();
        bone.name = name;
        bone.position.set(x, y, z);
        parent.add(bone);
        return (bones[name] = bone);
    }
    const hips = add("hips", root, 0, 0.95);
    add("chest", hips, 0, 0.3);
    for (const [side, x] of [
        ["left", -0.12],
        ["right", 0.12],
    ] as const) {
        const upper = add(`${side}UpperLeg`, hips, x, 0);
        const lower = add(`${side}LowerLeg`, upper, 0, -0.43, -0.08);
        add(`${side}Foot`, lower, 0, -0.42, 0.08);
    }
    root.updateMatrixWorld(true);
    const controller = createProceduralRig(THREE, root, (name) => bones[name]);
    const step = (motion = grounded, dt = 1 / 60) => {
        controller.restore();
        controller.update(dt, motion);
    };
    return { root, bones, controller, step };
}
const position = (bone: THREE.Object3D) =>
    bone.getWorldPosition(new THREE.Vector3());

test.each([0.5, 1, 2])(
    "contact IK holds feet through body movement at scale %s without stretching bones",
    (scale) => {
        const r = rig(scale);
        for (let i = 0; i < 6; i++) r.step({ ...grounded, speed: 0.1 });
        const left = position(r.bones.leftFoot);
        const right = position(r.bones.rightFoot);
        const upperLength = position(r.bones.leftUpperLeg).distanceTo(
            position(r.bones.leftLowerLeg)
        );
        const lowerLength = position(r.bones.leftLowerLeg).distanceTo(left);
        r.root.position.x += 0.025 * scale;
        r.step({ ...grounded, speed: 0.2 });
        expect(position(r.bones.leftFoot).distanceTo(left)).toBeLessThan(
            0.0001
        );
        expect(position(r.bones.rightFoot).distanceTo(right)).toBeLessThan(
            0.0001
        );
        expect(
            position(r.bones.leftUpperLeg).distanceTo(
                position(r.bones.leftLowerLeg)
            )
        ).toBeCloseTo(upperLength, 6);
        expect(
            position(r.bones.leftLowerLeg).distanceTo(
                position(r.bones.leftFoot)
            )
        ).toBeCloseTo(lowerLength, 6);
    }
);

test("slow turns preserve foot orientation while the torso leads and pelvis follows", () => {
    const r = rig();
    for (let i = 0; i < 6; i++) r.step({ ...grounded, speed: 0.1 });
    const initial = r.bones.leftFoot.getWorldQuaternion(new THREE.Quaternion());
    r.root.rotation.y = 0.08;
    r.step({ ...grounded, turnRate: 0.8, headingError: 0.5 } as any);
    expect(
        r.bones.leftFoot
            .getWorldQuaternion(new THREE.Quaternion())
            .angleTo(initial)
    ).toBeLessThan(0.0001);
    expect(r.bones.hips.rotation.y).toBeLessThan(0);
    expect(r.bones.chest.rotation.y).toBeGreaterThan(0);
});

test("procedural rotations restore before sampling and never accumulate into authored clips", () => {
    const r = rig();
    for (let i = 0; i < 200; i++) {
        r.step({
            ...grounded,
            speed: (i % 30) / 10,
            turnRate: 1,
            headingError: 0.4,
        } as any);
        r.controller.restore();
        for (const bone of Object.values(r.bones))
            expect(
                bone.quaternion.angleTo(new THREE.Quaternion())
            ).toBeLessThan(1e-6);
    }
});

test.each([
    undefined,
    { ...grounded, grounded: false, height: 1 },
    { ...grounded, quality: "crowd" },
    { ...grounded, procedural: false },
])(
    "jump, emote, reduced motion and crowd quality release contact (%j)",
    (motion) => {
        const r = rig();
        for (let i = 0; i < 6; i++) r.step({ ...grounded, speed: 0.1 });
        const before = position(r.bones.leftFoot);
        r.controller.restore();
        r.root.position.x += 0.05;
        r.controller.update(1 / 60, motion as any);
        expect(position(r.bones.leftFoot).x).toBeCloseTo(before.x + 0.05, 6);
    }
);

test("teleports and scale changes discard old contact anchors", () => {
    const r = rig();
    for (let i = 0; i < 6; i++) r.step({ ...grounded, speed: 0.1 });
    r.root.position.x = 20;
    r.step();
    expect(position(r.bones.leftFoot).x).toBeCloseTo(19.88, 4);
    r.root.scale.setScalar(2);
    r.step();
    expect(position(r.bones.leftFoot).x).toBeCloseTo(19.76, 4);
});

test("a lifting swing foot releases its old floor contact", () => {
    const r = rig();
    for (let i = 0; i < 6; i++) r.step({ ...grounded, speed: 0.1 });
    for (let i = 0; i < 12; i++) {
        r.controller.restore();
        r.bones.leftUpperLeg.rotation.x = -0.7;
        r.controller.update(1 / 60, { ...grounded, speed: 1 });
    }
    expect(position(r.bones.leftFoot).y).toBeGreaterThan(0.25);
});

test("missing or malformed leg chains degrade safely", () => {
    const root = new THREE.Group();
    const hips = new THREE.Bone();
    root.add(hips);
    const a = createProceduralRig(THREE, root, () => hips);
    const b = createProceduralRig(THREE, root, () => null);
    expect(() => {
        for (const dt of [0, NaN, -1, 200, 1 / 60]) {
            a.restore();
            a.update(dt, { ...grounded, speed: Infinity });
            b.restore();
            b.update(dt, grounded);
        }
    }).not.toThrow();
    expect(hips.quaternion.toArray().every(Number.isFinite)).toBe(true);
});

test("posture reacts to acceleration and braking, remains bounded and settles at constant speed", () => {
    const p = createLobbyPosture();
    p.update(1 / 60, grounded);
    expect(p.update(1 / 60, { ...grounded, speed: 2 }).pitch).toBeLessThan(0);
    for (let i = 0; i < 90; i++) p.update(1 / 60, { ...grounded, speed: 2 });
    expect(p.update(1 / 60, { ...grounded, speed: 2 }).pitch).toBeCloseTo(0, 6);
    expect(p.update(1 / 60, grounded).pitch).toBeGreaterThan(0);
    for (let i = 0; i < 90; i++) {
        const pose = p.update(1 / 60, {
            ...grounded,
            speed: i % 2 ? 12 : 0,
            turnRate: 200,
            headingError: 100,
        });
        expect(Math.abs(pose.pitch)).toBeLessThanOrEqual(0.085);
        expect(Math.abs(pose.roll)).toBeLessThanOrEqual(0.05);
        expect(Math.abs(pose.twist)).toBeLessThanOrEqual(0.21);
    }
});

test("crowd posture preserves source scale and rotation and clears after emotes", () => {
    const root = new THREE.Group();
    root.rotation.y = 0.5;
    root.scale.setScalar(2);
    const base = root.quaternion.clone();
    const update = createCrowdPosture(THREE, root);
    update(1 / 60, grounded);
    update(1 / 60, { ...grounded, speed: 1 });
    expect(root.quaternion.angleTo(base)).toBeGreaterThan(0);
    for (let i = 0; i < 100; i++) update(1 / 60);
    expect(root.quaternion.angleTo(base)).toBeLessThan(1e-5);
    expect(root.scale.toArray()).toEqual([2, 2, 2]);
});

test("detailed slow pivots take small steps and stop stepping when rotation stops", () => {
    const c = createLobbyLocomotion({});
    let time = 0;
    for (let i = 0; i < 30; i++) {
        const p = c.update(1 / 60, { ...grounded, turnRate: 1 });
        expect(p.primary.name).toBe("IDLE");
        expect(p.secondary.name).toBe("WALK");
        expect(p.blend).toBeLessThanOrEqual(0.4);
        time = p.secondary.time;
    }
    expect(time).toBeGreaterThan(0.05);
    for (let i = 0; i < 30; i++) c.update(1 / 60, grounded);
    expect(c.update(0, grounded).blend).toBe(0);
    for (const opt of [
        { quality: "crowd" as const },
        { procedural: false },
        { grounded: false },
    ]) {
        const p = createLobbyLocomotion({}).update(1 / 60, {
            ...grounded,
            turnRate: 1,
            ...opt,
        });
        expect(p.primary.name).not.toBe("WALK");
        if (p.blend > 0) expect(p.secondary.name).not.toBe("WALK");
    }
});

test("untouched idle remains authored and straight-leg contacts bend forward, not sideways", () => {
    const r = rig();
    r.bones.leftLowerLeg.position.z = 0;
    r.bones.leftFoot.position.z = 0;
    for (let i = 0; i < 20; i++) r.step();
    expect(
        r.bones.leftUpperLeg.quaternion.angleTo(new THREE.Quaternion())
    ).toBeLessThan(1e-6);
    for (let i = 0; i < 6; i++) r.step({ ...grounded, speed: 0.1 });
    r.root.position.x = 0.01;
    r.bones.hips.position.y -= 0.02;
    r.step({ ...grounded, speed: 0.1 });
    const hip = position(r.bones.leftUpperLeg),
        knee = position(r.bones.leftLowerLeg);
    expect(knee.z).toBeLessThan(hip.z - 0.05);
    expect(Math.abs(knee.x - hip.x)).toBeLessThan(0.015);
});

test("stride and orientation warping adjust swing feet while preserving segment lengths", () => {
    const r = rig();
    r.bones.leftUpperLeg.rotation.x = -0.4;
    r.root.updateMatrixWorld(true);
    const before = position(r.bones.leftFoot);
    const hip = position(r.bones.leftUpperLeg);
    const upperLength = hip.distanceTo(position(r.bones.leftLowerLeg));
    r.controller.update(
        1 / 60,
        { ...grounded, speed: 2, warping: true, headingError: 0.4 },
        {
            primary: { name: "WALK", time: 0.2 },
            secondary: { name: "WALK", time: 0.2 },
            blend: 0,
            strideScale: 0.82,
        }
    );
    const after = position(r.bones.leftFoot);
    expect(Math.abs(after.z - hip.z)).toBeLessThan(Math.abs(before.z - hip.z));
    expect(Math.abs(after.x - before.x)).toBeGreaterThan(0.03);
    expect(
        position(r.bones.leftUpperLeg).distanceTo(
            position(r.bones.leftLowerLeg)
        )
    ).toBeCloseTo(upperLength, 6);
    r.controller.restore();
    expect(position(r.bones.leftFoot).distanceTo(before)).toBeLessThan(1e-6);
});

test("authored turn weight suppresses duplicate crowd lean and native torso twist", () => {
    const root = new THREE.Group(),
        crowd = createCrowdPosture(THREE, root);
    const motion = {
        ...grounded,
        speed: 3.2,
        turnRate: 0.9,
        headingError: 0.5,
    };
    const pose = {
        primary: { name: "TURN_RUN_L", time: 0.2 },
        secondary: { name: "TURN_RUN_L", time: 0.2 },
        blend: 0,
        turnWeight: 1,
    };
    for (let i = 0; i < 120; i++) crowd(1 / 60, motion, pose);
    expect(root.quaternion.angleTo(new THREE.Quaternion())).toBeLessThan(1e-6);
    const r = rig();
    for (let i = 0; i < 120; i++) {
        r.controller.restore();
        r.controller.update(1 / 60, motion, pose);
    }
    expect(
        r.bones.hips.quaternion.angleTo(new THREE.Quaternion())
    ).toBeLessThan(1e-6);
    expect(
        r.bones.chest.quaternion.angleTo(new THREE.Quaternion())
    ).toBeLessThan(1e-6);
});
