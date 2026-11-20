import {
    ACTION_REST,
    readPlayAction,
    type ActionPoint,
} from "../../../multiplayer/protocol/play-action";
import { BODY, BONES, actionPose, jointOf } from "./rig";

const distance = (a: ActionPoint, b: ActionPoint) =>
    Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

const spike = readPlayAction({
    name: "Spike!",
    seconds: 0.7,
    moments: [
        {
            at: 0.3,
            ease: "out",
            rightHand: [0.35, 1.85, -0.35],
            hips: [0, 0.8, -0.05],
            lean: -15,
            twist: -30,
        },
        { at: 0.5, ease: "in", rightHand: "target", lean: 25, twist: 25 },
        { at: 0.7, ease: "out", rightHand: [-0.1, 0.9, 0.45], lean: 35 },
    ],
});

describe("readPlayAction", () => {
    it("names it, orders its moments and finds the contact", () => {
        const action = readPlayAction({
            name: "  Over-Hand THROW!! ",
            seconds: 99,
            moments: [
                { at: 0.8, rightHand: [0, 1, 0.5] },
                { at: 0.2, rightHand: "target", ease: "bounce" },
                { at: 0.5, nothing: true },
                "junk",
            ],
        });
        expect(action.name).toBe("over-hand-throw");
        expect(action.seconds).toBe(3);
        expect(action.moments.map((moment) => moment.at)).toEqual([0.2, 0.8]);
        expect(action.moments[0].ease).toBe("in-out");
        expect(action.contact).toBe(0.2);
    });

    it("clamps every position and turn", () => {
        const action = readPlayAction({
            moments: [
                {
                    at: 5,
                    rightHand: [50, -3, 9],
                    leftFoot: [0, 99, 0],
                    hips: [0, -1, 0],
                    lean: 500,
                    twist: -500,
                },
            ],
        });
        expect(action.moments[0]).toEqual({
            at: 1,
            ease: "in-out",
            rightHand: [1.1, 0, 1.2],
            leftFoot: [0, 1.3, 0],
            hips: [0, 0.3, 0],
            lean: 70,
            twist: -80,
        });
        expect(action.contact).toBeNull();
    });

    it("is nothing without a moment that places something", () => {
        for (const value of [
            null,
            [],
            {},
            { moments: [] },
            { moments: [{ at: 0.5 }] },
        ])
            expect(readPlayAction(value)).toBeNull();
    });
});

describe("actionPose", () => {
    it("stands still with no action, and at both ends of one", () => {
        const still = actionPose(null, 0);
        expect(
            distance(jointOf(still, "hips"), [
                ...ACTION_REST.hips,
            ] as ActionPoint)
        ).toBeLessThan(1e-6);
        expect(
            distance(jointOf(still, "rightHand"), [
                ...ACTION_REST.rightHand,
            ] as ActionPoint)
        ).toBeLessThan(1e-3);
        // Feet are placed on the floor; the ankle joint sits just above.
        expect(jointOf(still, "leftFoot")[1]).toBeCloseTo(BODY.ankle);
        for (const t of [0, 1]) {
            const pose = actionPose(spike, t);
            still.forEach((value, i) => expect(pose[i]).toBeCloseTo(value, 5));
        }
    });

    it("keeps every limb its own length through the whole action", () => {
        const lengths = (pose: Float32Array) =>
            BONES.map(([a, b]) => distance(jointOf(pose, a), jointOf(pose, b)));
        const rest = lengths(actionPose(null, 0));
        for (let t = 0; t <= 1; t += 0.05) {
            const now = lengths(actionPose(spike, t, [0.3, 2.1, 0.6]));
            now.forEach((length, i) => {
                // The pelvis line is drawn between the hips, which only turn.
                expect(Math.abs(length - rest[i])).toBeLessThan(1e-3);
            });
        }
    });

    it("puts a hand exactly where a moment says, when the arm can reach", () => {
        const action = readPlayAction({
            moments: [
                {
                    at: 0.5,
                    rightHand: [0.3, 1.5, 0.4],
                    leftHand: [-0.3, 1.2, 0.3],
                },
            ],
        });
        const pose = actionPose(action, 0.5);
        expect(
            distance(jointOf(pose, "rightHand"), [0.3, 1.5, 0.4])
        ).toBeLessThan(1e-3);
        expect(
            distance(jointOf(pose, "leftHand"), [-0.3, 1.2, 0.3])
        ).toBeLessThan(1e-3);
    });

    it("stops at full stretch when the place is out of reach", () => {
        const action = readPlayAction({
            moments: [{ at: 0.5, rightHand: [1.1, 2.4, 1.2] }],
        });
        const pose = actionPose(action, 0.5);
        const reach = distance(
            jointOf(pose, "rightShoulder"),
            jointOf(pose, "rightHand")
        );
        expect(reach).toBeLessThanOrEqual(BODY.upperArm + BODY.forearm);
        expect(reach).toBeGreaterThan((BODY.upperArm + BODY.forearm) * 0.99);
    });

    it("sends a hand to the thing being hit at the contact", () => {
        const ball: ActionPoint = [0.25, 1.75, 0.3];
        const pose = actionPose(spike, spike.contact, ball);
        expect(distance(jointOf(pose, "rightHand"), ball)).toBeLessThan(1e-3);
        // Somewhere else next time, the same action reaches there.
        const other: ActionPoint = [0.05, 1.5, 0.45];
        expect(
            distance(
                jointOf(actionPose(spike, spike.contact, other), "rightHand"),
                other
            )
        ).toBeLessThan(1e-3);
    });

    it("bends knees forward and elbows back when crouching", () => {
        const crouch = readPlayAction({
            moments: [{ at: 0.5, hips: [0, 0.6, 0] }],
        });
        const pose = actionPose(crouch, 0.5);
        expect(jointOf(pose, "leftKnee")[2]).toBeGreaterThan(0.2);
        expect(jointOf(pose, "rightKnee")[2]).toBeGreaterThan(0.2);
        expect(jointOf(pose, "leftFoot")[1]).toBeCloseTo(BODY.ankle, 2);
        const still = actionPose(null, 0);
        expect(jointOf(still, "rightElbow")[2]).toBeLessThan(
            jointOf(still, "rightShoulder")[2]
        );
    });

    it("leans forward and twists to the left", () => {
        const lean = actionPose(
            readPlayAction({ moments: [{ at: 0.5, lean: 45 }] }),
            0.5
        );
        expect(jointOf(lean, "head")[2]).toBeGreaterThan(0.3);
        const twist = actionPose(
            readPlayAction({ moments: [{ at: 0.5, twist: 60 }] }),
            0.5
        );
        // Turning left brings the right shoulder forward.
        expect(jointOf(twist, "rightShoulder")[2]).toBeGreaterThan(0.1);
        expect(jointOf(twist, "leftShoulder")[2]).toBeLessThan(-0.1);
    });

    it("carries a hand in a curve through its moments, not corner to corner", () => {
        // Back, up, then forward: three moments in an arc.
        const action = readPlayAction({
            moments: [
                { at: 0.25, ease: "linear", rightHand: [0.3, 1.2, -0.3] },
                { at: 0.5, ease: "linear", rightHand: [0.3, 1.7, 0] },
                { at: 0.75, ease: "linear", rightHand: [0.3, 1.2, 0.3] },
            ],
        });
        // Halfway from the first to the second, a straight line would be at
        // z = -0.15; the curve is still swinging out behind.
        const hand = jointOf(actionPose(action, 0.375), "rightHand");
        expect(hand[2]).toBeLessThan(-0.16);
        expect(hand[1]).toBeGreaterThan(1.2);
        // It still passes exactly through each moment.
        expect(
            distance(
                jointOf(actionPose(action, 0.5), "rightHand"),
                [0.3, 1.7, 0]
            )
        ).toBeLessThan(1e-3);
    });

    it("bends the upper back more than the lower, and keeps the head more level", () => {
        const pose = actionPose(
            readPlayAction({ moments: [{ at: 0.5, lean: 50 }] }),
            0.5
        );
        const [hips, spine, chest, head] = (
            ["hips", "spine", "chest", "head"] as const
        ).map((joint) => jointOf(pose, joint));
        const tilt = (a: ActionPoint, b: ActionPoint) =>
            (Math.atan2(b[2] - a[2], b[1] - a[1]) * 180) / Math.PI;
        expect(tilt(hips, spine)).toBeLessThan(tilt(spine, chest));
        expect(tilt(chest, head)).toBeLessThan(tilt(spine, chest));
    });

    it("arrives the way the moment eases", () => {
        const at = (ease: string, t: number) =>
            jointOf(
                actionPose(
                    readPlayAction({
                        moments: [{ at: 1, ease, hips: [0, 0.55, 0] }],
                    }),
                    t
                ),
                "hips"
            )[1];
        // Halfway there in time: "in" has barely started, "out" is nearly done.
        expect(at("in", 0.5)).toBeGreaterThan(at("linear", 0.5));
        expect(at("out", 0.5)).toBeLessThan(at("linear", 0.5));
    });
});
