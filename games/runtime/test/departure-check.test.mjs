import assert from "node:assert/strict";
import test from "node:test";
import { avatarOnScreen, readTravelView } from "../src/departure.ts";
import {
    compareAvatar,
    judgeDeparture,
    judgeSeam,
    lobbyAvatarBox,
    readView,
    DEPARTURE_WAIT_MS,
} from "../../../scripts/games/departure-check.mjs";

const view = {
    cameraOffset: { x: 0.4, y: 2.3, z: 4.8 },
    cameraTargetOffset: { x: 0, y: 1.25, z: 0 },
    avatarRotation: 0,
    avatarHeight: 1.75,
    fov: 50,
};
const aspect = 16 / 9;
const box = lobbyAvatarBox(view, aspect);
const frames = [
    { ms: 0, phase: "playing", lit: 1 },
    { ms: 300, phase: "leaving", lit: 0.4 },
    { ms: 600, phase: "last", lit: 0.02 },
];
const seen = (b = box, outside = 0) => ({
    lit: 0.02,
    outside,
    box: { ...b, width: 0.1 },
});
const judge = (over = {}) =>
    judgeDeparture({
        answerMs: 480,
        answer: { view },
        frames,
        last: seen(),
        held: seen(),
        aspect,
        ...over,
    });

test("the check projects the lobby's frame exactly as the runtime does", () => {
    for (const v of [
        view,
        { ...view, cameraOffset: { x: -3, y: 4, z: -2 }, fov: 72 },
        { ...view, cameraTargetOffset: { x: 1, y: 0.4, z: -1 } },
    ])
        for (const a of [16 / 9, 9 / 19.5])
            assert.deepEqual(lobbyAvatarBox(v, a), avatarOnScreen(v, a));
    assert.equal(readView({ ...view, fov: 0 }), null);
    assert.equal(readTravelView({ ...view, fov: 0 }), null);
});

test("a matched departure passes and reports both avatars", () => {
    const result = judge();
    assert.equal(result.status, "passed");
    assert.equal(result.lobbyFrame, "projected");
    assert.deepEqual(result.lobbyAvatar, box);
});

test("no answer, a late answer and a missing view fail", () => {
    assert.equal(judge({ answerMs: null }).code, "DEPARTURE_NO_ANSWER");
    assert.equal(
        judge({ answerMs: DEPARTURE_WAIT_MS + 1 }).code,
        "DEPARTURE_SLOW"
    );
    // A slow check browser gets a few frames of slack, a slow game does not.
    assert.equal(
        judge({ answerMs: DEPARTURE_WAIT_MS + 900, frameMs: 400 }).status,
        "passed"
    );
    assert.equal(
        judge({ answerMs: DEPARTURE_WAIT_MS + 4000, frameMs: 400 }).code,
        "DEPARTURE_SLOW"
    );
    assert.equal(
        judge({
            answer: { view: null, problem: "DEPARTURE_AVATAR_BEHIND_CAMERA" },
        }).code,
        "DEPARTURE_NO_VIEW"
    );
});

test("any black frame fails, at any point of leaving", () => {
    const result = judge({
        frames: [
            frames[0],
            { ms: 300, phase: "leaving", lit: 0.0002 },
            frames[2],
        ],
    });
    assert.equal(result.code, "DEPARTURE_BLACK_FRAME");
    assert.match(result.error, /300 ms/);
});

test("an avatar-less last frame fails", () => {
    assert.equal(
        judge({ last: { lit: 0.3, outside: 0.3, box: null } }).code,
        "DEPARTURE_NO_AVATAR"
    );
});

test("a world or interface left on screen fails", () => {
    assert.equal(
        judge({ last: seen(box, 0.35) }).code,
        "DEPARTURE_WORLD_VISIBLE"
    );
});

test("an avatar in the wrong place or at the wrong size fails", () => {
    const moved = judge({ last: seen({ ...box, x: box.x + 0.1 }) });
    assert.equal(moved.code, "DEPARTURE_MISMATCH");
    assert.match(moved.error, /right of where the lobby draws it/);
    const big = judge({
        last: seen({ ...box, top: box.top - 0.2, height: box.height + 0.2 }),
    });
    assert.equal(big.code, "DEPARTURE_MISMATCH");
    assert.match(big.error, /x the size/);
    assert.deepEqual(compareAvatar(box, box), []);
});

test("the frame must hold after the game answers", () => {
    assert.equal(
        judge({ held: { lit: 0, outside: 0, box: null } }).code,
        "DEPARTURE_NOT_HELD"
    );
    assert.equal(
        judge({ held: seen({ ...box, x: box.x + 0.03 }) }).code,
        "DEPARTURE_NOT_HELD"
    );
});

test("a recorded seam compares the game's last frame with the lobby's first", () => {
    const frame = (side, b = box, lit = 0.02) => ({
        side,
        lit,
        outside: 0,
        box: b && { ...b, width: 0.1 },
    });
    const seam = [frame("game"), frame("game"), frame("lobby"), frame("lobby")];
    const result = judgeSeam(seam);
    assert.equal(result.status, "passed");
    assert.equal(result.lobbyFrame, "recorded");
    assert.equal(judgeSeam([frame("game")]).code, "DEPARTURE_NO_SEAM");
    // One black frame between the two is a failure, on either side.
    assert.equal(
        judgeSeam([frame("game"), frame("lobby", null, 0), frame("lobby")])
            .code,
        "DEPARTURE_BLACK_FRAME"
    );
    assert.equal(
        judgeSeam([frame("game", null, 0), frame("lobby")]).code,
        "DEPARTURE_BLACK_FRAME"
    );
    const jump = judgeSeam([
        frame("game"),
        frame("lobby", { ...box, bottom: box.bottom + 0.1 }),
    ]);
    assert.equal(jump.code, "DEPARTURE_MISMATCH");
    assert.match(jump.error, /feet/);
});
