import { Quaternion, Vector3, type Object3D } from "three";
import { NEUTRAL_EXPRESSION, type ToonExpression } from "../face";
import type { ToonLayout } from "../skeleton";

/**
 * Motion written as code: each move is a function of time that turns bones.
 * It runs on any skeleton whose bones use the VRM humanoid names and rest in
 * a T-pose, so the same moves fit every body the maker can produce.
 */
export const TOON_MOTIONS = [
    "idle",
    "walk",
    "run",
    "jump",
    "wave",
    "dance",
    "cheer",
] as const;
export type ToonMotion = (typeof TOON_MOTIONS)[number];

type Axis = "x" | "y" | "z";
const AXES: Record<Axis, Vector3> = {
    x: new Vector3(1, 0, 0),
    y: new Vector3(0, 1, 0),
    z: new Vector3(0, 0, 1),
};
const POSED = [
    "hips",
    "spine",
    "chest",
    "upperChest",
    "neck",
    "head",
    "leftShoulder",
    "leftUpperArm",
    "leftLowerArm",
    "leftHand",
    "rightShoulder",
    "rightUpperArm",
    "rightLowerArm",
    "rightHand",
    "leftUpperLeg",
    "leftLowerLeg",
    "leftFoot",
    "leftToes",
    "rightUpperLeg",
    "rightLowerLeg",
    "rightFoot",
    "rightToes",
] as const;
type PosedBone = (typeof POSED)[number];
type Side = "left" | "right";
const SIDES: [Side, 1 | -1][] = [
    ["left", 1],
    ["right", -1],
];

const scratch = new Quaternion();

class Pose {
    readonly rotation = new Map<PosedBone, Quaternion>(
        POSED.map((name) => [name, new Quaternion()])
    );
    readonly offset = new Vector3();
    readonly expression: ToonExpression = { ...NEUTRAL_EXPRESSION };

    reset() {
        for (const q of this.rotation.values()) q.identity();
        this.offset.set(0, 0, 0);
        Object.assign(this.expression, NEUTRAL_EXPRESSION);
    }

    /** Turns a bone about one of its parent's axes, after earlier turns. */
    turn(bone: PosedBone, axis: Axis, angle: number) {
        this.rotation
            .get(bone)!
            .premultiply(scratch.setFromAxisAngle(AXES[axis], angle));
    }

    copy(other: Pose) {
        for (const [name, q] of other.rotation)
            this.rotation.get(name)!.copy(q);
        this.offset.copy(other.offset);
        Object.assign(this.expression, other.expression);
    }

    blend(from: Pose, to: Pose, w: number) {
        for (const [name, q] of this.rotation)
            q.copy(from.rotation.get(name)!).slerp(to.rotation.get(name)!, w);
        this.offset.copy(from.offset).lerp(to.offset, w);
        for (const key of Object.keys(
            this.expression
        ) as (keyof ToonExpression)[])
            this.expression[key] =
                from.expression[key] +
                (to.expression[key] - from.expression[key]) * w;
    }
}

type Body = {
    /** How far the arms drop from the T-pose so the hands clear the hips. */
    hang: number;
    leg: number;
};

function measure(layout: ToonLayout): Body {
    const arm = layout.arm.upper + layout.arm.lower;
    const shoulder = layout.joints.leftUpperArm[0];
    const clear =
        Math.max(
            layout.torso.hips,
            layout.torso.waist + layout.torso.belly * 0.3
        ) *
            1.12 +
        layout.arm.radius * 2.2 -
        shoulder;
    const out = Math.asin(Math.min(0.75, Math.max(0.1, clear / arm)));
    return {
        hang: Math.PI / 2 - out,
        leg: layout.leg.upper + layout.leg.lower,
    };
}

/** Arms down by the sides, elbows barely bent: the start of most moves. */
function stand(pose: Pose, body: Body) {
    for (const [side, sign] of SIDES) {
        pose.turn(`${side}UpperArm`, "z", -sign * body.hang);
        pose.turn(`${side}LowerArm`, "y", -sign * 0.16);
        pose.turn(`${side}Hand`, "z", -sign * 0.08);
    }
}

/** Drops the hips by bending the knees, feet staying planted and flat. */
function crouch(pose: Pose, body: Body, depth: number) {
    const bend = Math.acos(Math.max(0.2, 1 - depth));
    for (const [side] of SIDES) {
        pose.turn(`${side}UpperLeg`, "x", -bend);
        pose.turn(`${side}LowerLeg`, "x", bend * 2);
        pose.turn(`${side}Foot`, "x", -bend);
    }
    pose.offset.y -= depth * body.leg;
}

function breathe(pose: Pose, t: number) {
    const breath = Math.sin(t * 1.7);
    pose.turn("chest", "x", breath * 0.018);
    pose.turn("upperChest", "x", breath * 0.014);
    pose.turn("neck", "x", -breath * 0.012);
    for (const [side, sign] of SIDES)
        pose.turn(`${side}UpperArm`, "z", sign * breath * 0.014);
}

function stride(
    pose: Pose,
    body: Body,
    phase: number,
    o: {
        swing: number;
        knee: number;
        arm: number;
        elbow: number;
        bounce: number;
        twist: number;
    }
) {
    for (const [side, sign] of SIDES) {
        const p = phase + (sign > 0 ? 0 : Math.PI);
        const forward = Math.sin(p) * o.swing;
        // The knee folds while the leg travels forward, then straightens to land.
        const lift = Math.max(0, Math.cos(p));
        const fold = 0.1 + o.knee * lift * lift;
        pose.turn(`${side}UpperLeg`, "x", -forward - fold * 0.35);
        pose.turn(`${side}LowerLeg`, "x", fold);
        pose.turn(`${side}Foot`, "x", (forward - fold * 0.65) * 0.55);
        pose.turn(`${side}Toes`, "x", -Math.max(0, -Math.sin(p)) * 0.35);

        const reach = -Math.sin(p) * o.arm;
        pose.turn(`${side}UpperArm`, "x", -reach);
        pose.turn(
            `${side}LowerArm`,
            "y",
            -sign * (o.elbow + Math.max(0, reach) * 0.5)
        );
    }
    const sway = Math.sin(phase);
    pose.turn("hips", "y", -sway * o.twist);
    pose.turn("hips", "z", Math.cos(phase) * 0.03);
    pose.turn("spine", "y", sway * o.twist * 0.9);
    pose.turn("chest", "y", sway * o.twist * 0.8);
    pose.turn("head", "y", -sway * o.twist * 0.5);
    pose.offset.y += (Math.cos(phase * 2) * 0.5 - 0.3) * o.bounce * body.leg;
}

const MOVES: Record<ToonMotion, (pose: Pose, t: number, body: Body) => void> = {
    idle(pose, t, body) {
        stand(pose, body);
        breathe(pose, t);
        const shift = Math.sin(t * 0.55);
        pose.offset.x += shift * 0.012;
        pose.turn("hips", "z", shift * 0.025);
        pose.turn("spine", "z", -shift * 0.03);
        pose.turn(
            "head",
            "y",
            Math.sin(t * 0.37) * 0.14 + Math.sin(t * 0.9) * 0.03
        );
        pose.turn("head", "z", Math.sin(t * 0.5 + 1) * 0.035);
        for (const [side, sign] of SIDES) {
            pose.turn(`${side}UpperArm`, "x", Math.sin(t * 0.55 + sign) * 0.04);
            pose.turn(`${side}UpperLeg`, "z", -shift * 0.025);
        }
    },
    walk(pose, t, body) {
        stand(pose, body);
        pose.turn("spine", "x", 0.05);
        pose.turn("head", "x", -0.03);
        stride(pose, body, (t / 0.95) * Math.PI * 2, {
            swing: 0.5,
            knee: 0.95,
            arm: 0.45,
            elbow: 0.2,
            bounce: 0.035,
            twist: 0.1,
        });
    },
    run(pose, t, body) {
        stand(pose, body);
        pose.turn("hips", "x", 0.1);
        pose.turn("spine", "x", 0.1);
        pose.turn("head", "x", -0.14);
        for (const [side, sign] of SIDES)
            pose.turn(`${side}LowerArm`, "y", -sign * 1.1);
        stride(pose, body, (t / 0.6) * Math.PI * 2, {
            swing: 0.9,
            knee: 1.7,
            arm: 0.95,
            elbow: 0.25,
            bounce: 0.075,
            twist: 0.16,
        });
        pose.expression.brows = -0.3;
    },
    jump(pose, t, body) {
        stand(pose, body);
        const u = (t % 1.3) / 1.3;
        const wind =
            Math.sin(Math.min(1, u / 0.28) * Math.PI) * (u < 0.28 ? 1 : 0);
        const air =
            u > 0.28 && u < 0.72 ? Math.sin(((u - 0.28) / 0.44) * Math.PI) : 0;
        const land =
            u >= 0.72 ? Math.sin(Math.min(1, (u - 0.72) / 0.28) * Math.PI) : 0;
        crouch(pose, body, wind * 0.22 + land * 0.16 + air * 0.08);
        pose.offset.y += air * body.leg * 0.55;
        pose.turn("spine", "x", wind * 0.3 + land * 0.2 - air * 0.08);
        for (const [side, sign] of SIDES) {
            pose.turn(`${side}UpperArm`, "x", wind * 0.7 - air * 0.4);
            pose.turn(`${side}UpperArm`, "z", sign * air * 2.1);
            pose.turn(`${side}LowerArm`, "y", -sign * land * 0.5);
        }
        pose.expression.brows = air;
        pose.expression.talk = air * 0.6;
    },
    wave(pose, t, body) {
        MOVES.idle(pose, t, body);
        const arm = pose.rotation.get("rightUpperArm")!;
        arm.identity();
        pose.turn("rightUpperArm", "z", -0.85);
        pose.turn("rightUpperArm", "x", -0.2);
        pose.rotation.get("rightLowerArm")!.identity();
        pose.turn("rightLowerArm", "z", -(0.75 + Math.sin(t * 9) * 0.42));
        pose.turn("rightHand", "z", -Math.sin(t * 9 + 0.6) * 0.3);
        pose.turn("head", "z", -0.12);
        pose.turn("spine", "z", 0.05);
        pose.expression.smile = 0.8;
        pose.expression.brows = 0.4;
    },
    dance(pose, t, body) {
        stand(pose, body);
        const beat = (t / 0.52) * Math.PI * 2;
        const groove = Math.sin(beat / 2);
        crouch(pose, body, 0.045 + Math.abs(Math.sin(beat / 2)) * 0.07);
        pose.offset.x += groove * 0.05;
        pose.turn("hips", "z", groove * 0.13);
        pose.turn("hips", "y", Math.sin(beat / 4) * 0.25);
        pose.turn("spine", "z", -groove * 0.1);
        pose.turn("chest", "z", -groove * 0.08);
        pose.turn("head", "x", Math.sin(beat) * 0.1);
        pose.turn("head", "z", groove * 0.1);
        for (const [side, sign] of SIDES) {
            const pump = Math.sin(beat + (sign > 0 ? 0 : Math.PI));
            pose.turn(`${side}UpperArm`, "z", sign * 0.55);
            pose.turn(`${side}UpperArm`, "x", -0.5 - pump * 0.45);
            pose.turn(`${side}LowerArm`, "y", -sign * (1.35 + pump * 0.3));
        }
        pose.expression.smile = 0.7;
    },
    cheer(pose, t, body) {
        stand(pose, body);
        const hop = Math.abs(Math.sin(t * 5.2));
        crouch(pose, body, (1 - hop) * 0.07);
        pose.offset.y += hop * body.leg * 0.1;
        pose.turn("spine", "x", -0.08);
        pose.turn("head", "x", -0.15);
        for (const [side, sign] of SIDES) {
            pose.turn(
                `${side}UpperArm`,
                "z",
                sign * (body.hang + 1.0 + hop * 0.2)
            );
            pose.turn(
                `${side}LowerArm`,
                "z",
                sign * (0.25 + Math.sin(t * 10.4) * 0.2)
            );
        }
        pose.expression.smile = 1;
        pose.expression.brows = 0.6;
        pose.expression.talk = 0.5 + hop * 0.4;
    },
};

export type BoneLookup = (name: string) => Object3D | null | undefined;

/**
 * Keeps a face alive: blinks every few seconds and lets the eyes dart to a
 * new spot now and then. `mood` is whatever the current move or the host
 * wants on top (a smile while waving, an open mouth while talking).
 */
export class ToonFaceAnimator {
    readonly expression: ToonExpression = { ...NEUTRAL_EXPRESSION };
    /** 0..1, set from a voice level to move the mouth. */
    talk = 0;

    private blinkIn = 1.5;
    private blink = 0;
    private glanceIn = 2;
    private glance = { x: 0, y: 0, tx: 0, ty: 0 };

    constructor(private random: () => number = Math.random) {}

    update(dt: number, mood: Partial<ToonExpression> = {}) {
        this.blinkIn -= dt;
        if (this.blinkIn <= 0) {
            this.blink = 0.16;
            this.blinkIn = 1.6 + this.random() * 3.6;
        }
        this.blink = Math.max(0, this.blink - dt);
        const closed = Math.sin((this.blink / 0.16) * Math.PI);

        this.glanceIn -= dt;
        if (this.glanceIn <= 0) {
            const away = this.random() < 0.6;
            this.glance.tx = away ? (this.random() * 2 - 1) * 0.8 : 0;
            this.glance.ty = away ? (this.random() * 2 - 1) * 0.35 : 0;
            this.glanceIn = 0.7 + this.random() * 2.6;
        }
        // Eyes dart: fast approach, then hold.
        const k = 1 - Math.exp(-dt * 22);
        this.glance.x += (this.glance.tx - this.glance.x) * k;
        this.glance.y += (this.glance.ty - this.glance.y) * k;

        this.expression.blinkLeft = this.expression.blinkRight = closed;
        this.expression.lookX = this.glance.x;
        this.expression.lookY = this.glance.y;
        this.expression.talk = Math.min(1, (mood.talk ?? 0) + this.talk);
        this.expression.smile = mood.smile ?? 0;
        this.expression.brows = mood.brows ?? 0;
        return this.expression;
    }
}

/** Plays the moves on a skeleton and cross-fades between them. */
export class ToonAnimator {
    readonly face: ToonFaceAnimator;
    motion: ToonMotion = "idle";

    private body: Body;
    private restHips = new Vector3();
    private time = 0;
    private fade = 1;
    private fadeDuration = 0.25;
    private target = new Pose();
    private from = new Pose();
    private applied = new Pose();

    constructor(
        private bone: BoneLookup,
        layout: ToonLayout,
        random: () => number = Math.random
    ) {
        this.face = new ToonFaceAnimator(random);
        this.body = measure(layout);
        this.setLayout(layout);
    }

    /** The expression to draw this frame. */
    get expression() {
        return this.face.expression;
    }

    /** Call after the avatar is rebuilt with new proportions. */
    setLayout(layout: ToonLayout) {
        this.body = measure(layout);
        const [x, y, z] = layout.joints.hips;
        this.restHips.set(x, y, z);
    }

    play(motion: ToonMotion, fade = 0.25) {
        if (motion === this.motion) return;
        this.motion = motion;
        this.from.copy(this.applied);
        this.fade = 0;
        this.fadeDuration = Math.max(0.001, fade);
    }

    update(dt: number) {
        const step = Math.min(Math.max(dt, 0), 0.1);
        this.time += step;
        this.target.reset();
        MOVES[this.motion](this.target, this.time, this.body);
        if (this.fade < 1) {
            this.fade = Math.min(1, this.fade + step / this.fadeDuration);
            const w = this.fade * this.fade * (3 - 2 * this.fade);
            this.applied.blend(this.from, this.target, w);
        } else this.applied.copy(this.target);

        for (const [name, q] of this.applied.rotation)
            this.bone(name)?.quaternion.copy(q);
        this.bone("hips")
            ?.position.copy(this.restHips)
            .add(this.applied.offset);
        this.face.update(step, this.applied.expression);
    }
}

/**
 * Makes hair tails and coat tails trail behind movement. Reads how the head
 * and hips moved since the last frame and leans the two tail bones against
 * it on a damped spring.
 */
export class ToonSecondaryMotion {
    private parts: {
        bone: Object3D;
        anchor: Object3D;
        last: Vector3;
        angle: Vector3;
        speed: Vector3;
        gain: number;
    }[] = [];
    private world = new Vector3();
    private velocity = new Vector3();
    private rootQuaternion = new Quaternion();

    constructor(private root: Object3D, bone: BoneLookup) {
        for (const [tail, anchor, gain] of [
            ["hairTail", "head", 0.22],
            ["coatTail", "hips", 0.12],
        ] as const) {
            const a = bone(tail);
            const b = bone(anchor);
            if (a && b)
                this.parts.push({
                    bone: a,
                    anchor: b,
                    last: new Vector3(NaN),
                    angle: new Vector3(),
                    speed: new Vector3(),
                    gain,
                });
        }
    }

    /** Call after the skeleton has been posed for this frame. */
    update(dt: number) {
        if (dt <= 0) return;
        const step = Math.min(dt, 0.05);
        this.root.getWorldQuaternion(this.rootQuaternion).invert();
        for (const part of this.parts) {
            part.anchor.getWorldPosition(this.world);
            if (Number.isNaN(part.last.x)) part.last.copy(this.world);
            this.velocity
                .copy(this.world)
                .sub(part.last)
                .divideScalar(step)
                .applyQuaternion(this.rootQuaternion)
                .clampLength(0, 6);
            part.last.copy(this.world);
            // Forward motion throws the tail back, sideways motion to the other side.
            const targetX =
                this.velocity.z * part.gain - this.velocity.y * part.gain * 0.6;
            const targetZ = -this.velocity.x * part.gain;
            for (const [axis, target] of [
                ["x", targetX],
                ["z", targetZ],
            ] as const) {
                const clamped = Math.max(-0.9, Math.min(0.9, target));
                const pull =
                    (clamped - part.angle[axis]) * 70 - part.speed[axis] * 9;
                part.speed[axis] += pull * step;
                part.angle[axis] += part.speed[axis] * step;
            }
            part.bone.quaternion
                .setFromAxisAngle(AXES.x, part.angle.x)
                .multiply(scratch.setFromAxisAngle(AXES.z, part.angle.z));
        }
    }
}
