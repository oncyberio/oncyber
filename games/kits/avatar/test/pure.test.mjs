import assert from "node:assert/strict";
import { test } from "node:test";
import {
    EMOTE_ORDER,
    clipRate,
    clipWeights,
    poseCode,
    readPoseCode,
} from "../src/motion.ts";
import {
    ARRIVAL_RISE_SECONDS,
    arrivalFraming,
    createArrival,
    crouchPose,
    faces,
    headingToward,
    readArrivalView,
} from "../src/arrival.ts";
import { pushSample, readPeer, samplePose } from "../src/peers.ts";
import {
    arrivalProblems,
    enteredProblems,
    othersProblems,
    readAvatarRule,
    NO_AVATARS,
} from "../src/facts.js";
import {
    answerInspect,
    pageAvatarService,
    INSPECT_REQUEST,
    INSPECT_RESULT,
} from "../src/page.ts";

test("pose codes fit the room's 0..31 and round-trip", () => {
    assert.equal(poseCode({}), 0);
    assert.equal(poseCode({ speed: 1.5 }), 1);
    assert.equal(poseCode({ speed: 5 }), 2);
    assert.equal(poseCode({ air: true, speed: 5 }), 3);
    assert.equal(poseCode({ wave: true }), 4);
    for (const emote of EMOTE_ORDER) {
        const code = poseCode({ emote });
        assert.ok(code >= 8 && code <= 31);
        assert.equal(readPoseCode(code).emote, emote);
    }
    assert.deepEqual(readPoseCode(99), { speed: 0 });
    assert.deepEqual(readPoseCode("1"), { speed: 0 });
    assert.ok(readPoseCode(2).speed >= 2.8);
    assert.equal(poseCode(readPoseCode(1)), 1);
});

test("clip weights always sum to one", () => {
    for (const motion of [
        {},
        { speed: 0.9 },
        { speed: 2 },
        { speed: 3.5 },
        { speed: 9 },
        { air: true },
        { wave: true },
        { emote: "HIPHOP" },
    ]) {
        const sum = Object.values(clipWeights(motion)).reduce(
            (a, b) => a + b,
            0
        );
        assert.ok(Math.abs(sum - 1) < 1e-9, JSON.stringify(motion));
    }
    // An emote the game didn't ship falls back to standing.
    assert.deepEqual(clipWeights({ emote: "HIPHOP" }, false), { IDLE: 1 });
    assert.ok(clipRate("WALK", 3) > clipRate("WALK", 1.5));
    assert.equal(clipRate("IDLE", 9), 1);
});

const VIEW = {
    cameraOffset: { x: 0, y: 2, z: -4 },
    cameraTargetOffset: { x: 0, y: 1.2, z: 0 },
    avatarRotation: 0,
    avatarHeight: 1.8,
    fov: 55,
};

test("arrival: crouched until entered, then standing after the rise", () => {
    const arrival = createArrival();
    assert.equal(arrival.phase, "none");
    arrival.enter();
    assert.equal(arrival.phase, "none");
    arrival.stage(readArrivalView(VIEW));
    assert.equal(arrival.phase, "crouched");
    assert.equal(arrival.crouch, 1);
    assert.equal(arrival.handsEmpty, true);
    arrival.update(5);
    assert.equal(arrival.crouch, 1, "stays down until the page says entered");
    arrival.enter();
    assert.equal(arrival.phase, "rising");
    arrival.update(ARRIVAL_RISE_SECONDS / 2);
    assert.ok(arrival.crouch > 0.4 && arrival.crouch < 0.6);
    arrival.update(ARRIVAL_RISE_SECONDS);
    assert.equal(arrival.phase, "standing");
    assert.equal(arrival.crouch, 0);
    arrival.fillHands();
    assert.equal(arrival.handsEmpty, false);
});

test("arrival: no lobby view, or already entered", () => {
    const direct = createArrival();
    direct.stage(null);
    assert.equal(direct.phase, "standing");
    assert.equal(direct.handsEmpty, true);
    const late = createArrival();
    late.stage(readArrivalView(VIEW), { entered: true });
    assert.equal(late.phase, "rising");
});

test("arrival view: malformed input is refused, the framing faces the camera", () => {
    assert.equal(readArrivalView(null), null);
    assert.equal(readArrivalView({ ...VIEW, fov: 500 }), null);
    assert.equal(
        readArrivalView({ ...VIEW, cameraOffset: { x: NaN, y: 0, z: 0 } }),
        null
    );
    assert.equal(
        readArrivalView({ ...VIEW, avatarHeight: 0 }).avatarHeight,
        1.8
    );
    const framing = arrivalFraming(readArrivalView(VIEW), 1.8);
    // The lobby camera at -z of an avatar with rotation 0 lands on +z: in front.
    assert.ok(
        Math.abs(framing.offset[0]) < 1e-9 &&
            Math.abs(framing.offset[2] - 4) < 1e-9
    );
    assert.equal(framing.fov, 55);
    assert.ok(
        faces({ x: 0, z: 0 }, 0, { x: framing.offset[0], z: framing.offset[2] })
    );
    assert.equal(arrivalFraming(readArrivalView(VIEW), 0.9).offset[1], 1);
    // A camera inside the avatar falls back to a usable view.
    const inside = arrivalFraming(
        readArrivalView({ ...VIEW, cameraOffset: { x: 0, y: 0.1, z: 0.1 } }),
        1.8
    );
    assert.deepEqual(inside.offset, [0, 2.3, 4.8]);
    assert.deepEqual(arrivalFraming(null, 1.8).look, [0, 1.25, 0]);
});

test("heading helpers", () => {
    assert.ok(
        Math.abs(headingToward({ x: 0, z: 0 }, { x: 1, z: 0 }) - Math.PI / 2) <
            1e-9
    );
    assert.ok(faces({ x: 0, z: 0 }, Math.PI / 2, { x: 5, z: 0 }));
    assert.ok(!faces({ x: 0, z: 0 }, -Math.PI / 2, { x: 5, z: 0 }));
});

test("crouch keeps the feet planted under the hips", () => {
    const upper = 0.42,
        lower = 0.4;
    for (const amount of [0.25, 0.6, 1]) {
        const pose = crouchPose(amount, upper, lower);
        // Forward kinematics in the y/z plane: thigh then shin, rotated about x.
        const thigh = pose.upperLeg,
            shin = pose.upperLeg + pose.lowerLeg;
        const y = -upper * Math.cos(thigh) - lower * Math.cos(shin);
        const z = -upper * Math.sin(thigh) - lower * Math.sin(shin);
        assert.ok(Math.abs(z) < 1e-6, `foot stays under the hip at ${amount}`);
        assert.ok(
            Math.abs(-y + pose.drop - (upper + lower)) < 1e-6,
            `foot stays on the floor at ${amount}`
        );
        assert.ok(
            Math.abs(pose.upperLeg + pose.lowerLeg + pose.foot) < 1e-9,
            "foot stays flat"
        );
        assert.ok(pose.upperLeg < 0, "knees go forward");
    }
    assert.deepEqual(
        Object.values(crouchPose(0, upper, lower)).map(Math.abs),
        [0, 0, 0, 0, 0, 0, 0, 0, 0]
    );
});

test("peers: sanitized, and interpolated between samples", () => {
    assert.equal(readPeer({ name: "x" }), null);
    const peer = readPeer({
        id: "a",
        name: "  Ada ",
        vrm: "/a.vrm",
        x: 1,
        y: "no",
        z: 3,
        h: 0.5,
        a: 99,
        talking: true,
    });
    assert.deepEqual(peer, {
        id: "a",
        name: "Ada",
        vrm: "/a.vrm",
        talking: true,
        fresh: false,
        pose: { x: 1, y: 0, z: 3, h: 0.5, a: 31 },
    });
    assert.equal(readPeer({ id: "b", avatarUrl: "/b.vrm" }).vrm, "/b.vrm");
    const samples = [];
    pushSample(samples, { x: 0, y: 0, z: 0, h: 3, a: 0 }, 1);
    pushSample(samples, { x: 0, y: 0, z: 0, h: 3, a: 0 }, 1.1);
    assert.equal(samples.length, 1, "an unchanged pose adds nothing");
    pushSample(samples, { x: 2, y: 0, z: 0, h: -3, a: 1 }, 2);
    assert.equal(samplePose([], 1), null);
    assert.equal(samplePose(samples, 0.5).x, 0);
    const mid = samplePose(samples, 1.5);
    assert.ok(Math.abs(mid.x - 1) < 1e-9 && Math.abs(mid.speed - 2) < 1e-9);
    assert.ok(Math.abs(mid.h) > 3, "turns the short way through pi");
    assert.equal(samplePose(samples, 9).x, 2);
});

test("game.json rule: avatars and the arrival pose unless the game says why not", () => {
    assert.deepEqual(readAvatarRule({}), {
        others: "avatar",
        why: "",
        arrival: "pose",
        arrivalWhy: "",
        problems: [],
    });
    assert.deepEqual(
        readAvatarRule({ avatars: { others: "avatar", arrival: "pose" } })
            .problems,
        []
    );
    assert.match(
        readAvatarRule({ avatars: { others: "sprites" } }).problems[0],
        /avatars\.others/
    );
    assert.match(readAvatarRule({ avatars: [] }).problems[0], /object/);
    assert.match(
        readAvatarRule({ avatars: { others: "other" } }).problems[0],
        /avatars\.why/
    );
    assert.match(
        readAvatarRule({ avatars: { others: "other", why: "because" } })
            .problems[0],
        /avatars\.why/
    );
    assert.match(
        readAvatarRule({ avatars: { arrival: "none" } }).problems[0],
        /arrivalWhy/
    );
    const rule = readAvatarRule({
        avatars: {
            others: "other",
            why: "Everyone is a chess piece; the board is the game.",
            arrival: "none",
            arrivalWhy: "The board is seen from above, with no body.",
        },
    });
    assert.deepEqual(rule.problems, []);
    assert.equal(rule.others, "other");
    assert.equal(rule.arrival, "none");
});

test("check assertions on the facts", () => {
    assert.deepEqual(arrivalProblems(null), [
        "the game reported no avatar facts",
    ]);
    assert.equal(arrivalProblems(NO_AVATARS).length, 5);
    const arrived = {
        ...NO_AVATARS,
        avatarSelf: "vrm",
        avatarSelfInFrame: true,
        avatarArrival: "crouched",
        avatarFacingCamera: true,
        avatarHandsEmpty: true,
    };
    assert.deepEqual(arrivalProblems(arrived), []);
    assert.equal(enteredProblems(arrived).length, 1);
    assert.deepEqual(
        enteredProblems({ ...arrived, avatarArrival: "standing" }),
        []
    );
    assert.equal(othersProblems(arrived, 1, 1).length, 2);
    assert.deepEqual(
        othersProblems(
            {
                ...arrived,
                avatarOthers: 1,
                avatarOthersDrawn: 1,
                avatarOthersVrm: 1,
            },
            1,
            1
        ),
        []
    );
    assert.match(
        othersProblems(
            { ...arrived, avatarOthersDrawn: 1, avatarOthersVrm: 0 },
            1,
            1
        )[0],
        /Oncyber avatar/
    );
    assert.deepEqual(othersProblems(null, 1, 1), [
        "the game reported no avatar facts",
    ]);
});

test("page avatar service: only vouched refs, size capped, a copy per caller", async () => {
    let fetches = 0;
    const service = pageAvatarService({
        maxBytes: 8,
        fetch: async (ref) => {
            fetches++;
            return {
                ok: !ref.includes("missing"),
                status: 404,
                arrayBuffer: async () =>
                    new ArrayBuffer(ref.includes("big") ? 9 : 4),
            };
        },
    });
    await assert.rejects(service.avatar("/a.vrm"), /AVATAR_NOT_VOUCHED/);
    service.vouch("/a.vrm");
    service.vouch("/big.vrm");
    service.vouch("/missing.vrm");
    service.vouch(42);
    const [one, two] = await Promise.all([
        service.avatar("/a.vrm"),
        service.avatar("/a.vrm"),
    ]);
    assert.equal(fetches, 1);
    assert.notEqual(one, two);
    assert.equal(one.byteLength, 4);
    await assert.rejects(service.avatar("/big.vrm"), /AVATAR_TOO_LARGE/);
    await assert.rejects(service.avatar("/missing.vrm"), /AVATAR_HTTP_404/);
});

test("answerInspect: only with ?check, only to the parent", () => {
    const sent = [];
    const parent = { postMessage: (message) => sent.push(message) };
    const listeners = [];
    const page = (search) => ({
        location: { search },
        parent,
        addEventListener: (_, f) => listeners.push(f),
        removeEventListener() {},
    });
    answerInspect(() => ({ a: 1 }), page(""));
    assert.equal(listeners.length, 0);
    answerInspect(() => ({ a: 1, skip: undefined }), page("?check&party=2"));
    listeners[0]({ source: {}, data: { type: INSPECT_REQUEST } });
    assert.equal(sent.length, 0);
    listeners[0]({ source: parent, data: { type: INSPECT_REQUEST, nonce: 7 } });
    assert.deepEqual(sent, [
        { type: INSPECT_RESULT, nonce: 7, inspect: { a: 1 } },
    ]);
});
