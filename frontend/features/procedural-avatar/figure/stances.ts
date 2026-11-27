import * as THREE from "three/webgpu";

/**
 * A few ways for a figure to stand, for pictures and checks. In a world a
 * figure's poses come from the animations there; these are only so that
 * one can be looked at out of the pose it is modelled in, arms out.
 *
 * Angles are degrees, and say what the limb does rather than which axis
 * turns: they come out the same whichever way a model faces.
 */
export interface Stance {
    /** Each arm: how far it hangs below level (negative: raised). */
    armsDown?: [left: number, right: number];
    /** How far each arm swings forward from the shoulder. */
    armsForward?: [left: number, right: number];
    /** How far each elbow bends, the forearm coming forward. */
    elbows?: [left: number, right: number];
    /** How far each forearm is lifted from the elbow, the hand going up. */
    handsUp?: [left: number, right: number];
    /** How far each leg swings forward from the hip (negative: back). */
    legsForward?: [left: number, right: number];
    /** How far each knee bends. */
    knees?: [left: number, right: number];
    /** The head: turned to its left, and tipped to its left shoulder. */
    head?: [turn: number, tip: number];
    /** The chest, the same. */
    chest?: [turn: number, tip: number];
}

export const STANCES: Record<string, Stance> = {
    stand: { armsDown: [72, 72], elbows: [14, 14] },
    easy: {
        armsDown: [66, 76],
        elbows: [24, 8],
        head: [10, -4],
        chest: [4, 2],
        legsForward: [3, -2],
    },
    look: {
        armsDown: [74, 70],
        elbows: [10, 18],
        head: [-24, 3],
        chest: [-8, 0],
    },
    // A wave: the upper arm out level, the hand up beside the head.
    wave: {
        armsDown: [72, 6],
        elbows: [14, 12],
        handsUp: [0, 84],
        head: [-6, -5],
        chest: [0, -3],
    },
    stride: {
        armsDown: [70, 70],
        armsForward: [-20, 24],
        elbows: [18, 30],
        legsForward: [24, -16],
        knees: [8, 30],
        chest: [-5, 0],
    },
    stridden: {
        armsDown: [70, 70],
        armsForward: [24, -20],
        elbows: [30, 18],
        legsForward: [-16, 24],
        knees: [30, 8],
        chest: [5, 0],
    },
};

/** What this needs of a loaded VRM. */
interface Posable {
    humanoid: { getNormalizedBoneNode(name: string): THREE.Object3D | null };
    update(delta: number): void;
}

const X = new THREE.Vector3(1, 0, 0);
const Y = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);

/**
 * Stand a figure in a stance. `forwardZ` is which way it faces along z in
 * its own space, as its measurements say (`frames.forwardZ`).
 */
export function standFigure(vrm: Posable, stance: Stance, forwardZ: number) {
    const bone = (name: string) => vrm.humanoid.getNormalizedBoneNode(name);
    const radians = THREE.MathUtils.degToRad;
    const turn = new THREE.Quaternion();
    /** Turn a bone from rest: about each axis in order, degrees. */
    const set = (name: string, turns: [THREE.Vector3, number][]) => {
        const node = bone(name);
        if (!node) return;
        node.quaternion.identity();
        for (const [axis, degrees] of turns)
            node.quaternion.multiply(
                turn.setFromAxisAngle(axis, radians(degrees))
            );
    };
    (["left", "right"] as const).forEach((side, i) => {
        // Which way this arm points at rest: along x, one way or the other.
        const out = Math.sign(bone(`${side}LowerArm`)?.position.x || 1);
        set(`${side}UpperArm`, [
            [Y, -forwardZ * out * (stance.armsForward?.[i] ?? 0)],
            [Z, -out * (stance.armsDown?.[i] ?? 0)],
        ]);
        set(`${side}LowerArm`, [
            [Y, -forwardZ * out * (stance.elbows?.[i] ?? 0)],
            [Z, out * (stance.handsUp?.[i] ?? 0)],
        ]);
        set(`${side}UpperLeg`, [
            [X, -forwardZ * (stance.legsForward?.[i] ?? 0)],
        ]);
        set(`${side}LowerLeg`, [[X, forwardZ * (stance.knees?.[i] ?? 0)]]);
    });
    // To its left is towards the hand its left arm ends in.
    const left = Math.sign(bone("leftLowerArm")?.position.x || 1);
    for (const [name, value] of [
        ["head", stance.head],
        ["chest", stance.chest],
    ] as const)
        set(name, [
            [Y, forwardZ * left * (value?.[0] ?? 0)],
            [Z, -forwardZ * left * (value?.[1] ?? 0)],
        ]);
    vrm.update(0);
}
