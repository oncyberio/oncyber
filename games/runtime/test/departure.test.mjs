import assert from "node:assert/strict";
import test from "node:test";
import {
    avatarOnScreen,
    createDeparture,
    departureProblem,
    departureView,
    readTravelView,
} from "../src/departure.ts";

const shot = {
    camera: {
        position: { x: 10, y: 2.3, z: 24.8 },
        target: { x: 10, y: 1.25, z: 20 },
        fov: 50,
    },
    avatar: { feet: { x: 10, y: 0, z: 20 }, yaw: Math.PI, height: 1.75 },
};
const close = (a, b, eps = 1e-9) =>
    assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

test("the view is the camera relative to the feet, never world coordinates", () => {
    const view = departureView(shot);
    close(view.cameraOffset.x, 0);
    close(view.cameraOffset.y, 2.3);
    close(view.cameraOffset.z, 4.8);
    close(view.cameraTargetOffset.y, 1.25);
    close(view.cameraTargetOffset.z, 0);
    assert.equal(view.avatarHeight, 1.75);
    assert.equal(view.fov, 50);
    // Moving the whole shot elsewhere in the world changes nothing.
    const moved = structuredClone(shot);
    for (const p of [
        moved.camera.position,
        moved.camera.target,
        moved.avatar.feet,
    ])
        p.x -= 400;
    close(departureView(moved).cameraOffset.x, 0);
    close(departureView(moved).cameraOffset.z, 4.8);
});

test("facing maps to the lobby's yaw: 0 faces -z", () => {
    const yaw = (facing) =>
        departureView({
            ...shot,
            avatar: { ...shot.avatar, yaw: undefined, facing },
        }).avatarRotation;
    close(yaw({ x: 0, z: -1 }), 0);
    close(Math.abs(yaw({ x: 0, z: 1 })), Math.PI);
    close(yaw({ x: -1, z: 0 }), Math.PI / 2);
});

test("malformed views are refused", () => {
    const view = departureView(shot);
    assert.deepEqual(readTravelView(view), view);
    assert.notEqual(readTravelView(view), view);
    assert.equal(readTravelView(null), null);
    assert.equal(readTravelView({ ...view, fov: 0 }), null);
    assert.equal(readTravelView({ ...view, avatarHeight: 40 }), null);
    assert.equal(
        readTravelView({ ...view, cameraOffset: { x: 0, y: NaN, z: 1 } }),
        null
    );
    assert.equal(
        readTravelView({ ...view, cameraOffset: { x: 0, y: 0, z: 5000 } }),
        null
    );
    assert.throws(
        () => departureView({ ...shot, camera: { ...shot.camera, fov: 400 } }),
        /DEPARTURE_VIEW_INVALID/
    );
});

test("avatarOnScreen projects feet and head like a perspective camera", () => {
    // Camera level with the avatar's middle, 4 m back, 90 degree fov:
    // the half-height of the frame at 4 m is 4 m, so 2 m spans a quarter.
    const box = avatarOnScreen(
        {
            cameraOffset: { x: 0, y: 1, z: 4 },
            cameraTargetOffset: { x: 0, y: 1, z: 0 },
            avatarRotation: 0,
            avatarHeight: 2,
            fov: 90,
        },
        16 / 9
    );
    close(box.x, 0.5);
    close(box.top, 0.375);
    close(box.bottom, 0.625);
    close(box.height, 0.25);
    // Turning the whole composition about the avatar leaves the frame alone.
    const turned = avatarOnScreen(
        {
            cameraOffset: { x: 4, y: 1, z: 0 },
            cameraTargetOffset: { x: 0, y: 1, z: 0 },
            avatarRotation: 1,
            avatarHeight: 2,
            fov: 90,
        },
        16 / 9
    );
    close(turned.height, 0.25);
    close(turned.x, 0.5);
    // A camera aimed to the avatar's side moves it across the frame.
    const aside = avatarOnScreen(
        {
            cameraOffset: { x: 0, y: 1, z: 4 },
            cameraTargetOffset: { x: 1, y: 1, z: 0 },
            avatarRotation: 0,
            avatarHeight: 2,
            fov: 90,
        },
        1
    );
    assert.ok(aside.x < 0.45);
});

test("views the lobby can't frame are named", () => {
    const view = departureView(shot);
    assert.equal(departureProblem(view), null);
    assert.equal(departureProblem(null), "DEPARTURE_VIEW_INVALID");
    assert.equal(
        departureProblem({ ...view, cameraOffset: { x: 0, y: 0.2, z: 0.1 } }),
        "DEPARTURE_CAMERA_INSIDE_AVATAR"
    );
    // First person: looking away from the avatar.
    assert.equal(
        departureProblem({
            ...view,
            cameraOffset: { x: 0, y: 1.6, z: -1 },
            cameraTargetOffset: { x: 0, y: 1.6, z: -9 },
        }),
        "DEPARTURE_AVATAR_BEHIND_CAMERA"
    );
    assert.equal(
        departureProblem({ ...view, cameraOffset: { x: 0, y: 30, z: 200 } }),
        "DEPARTURE_AVATAR_TOO_SMALL"
    );
    assert.equal(
        departureProblem({
            ...view,
            cameraTargetOffset: { x: 30, y: 1, z: 0 },
        }),
        "DEPARTURE_AVATAR_OFF_SCREEN"
    );
});

function harness(stage) {
    const sent = [];
    let frames = 0;
    const departure = createDeparture({
        post: (kind, data) => sent.push({ kind, ...data }),
        stage,
        frame: async () => void frames++,
    });
    return { departure, sent, frames: () => frames };
}
const settle = () => new Promise((resolve) => setTimeout(resolve, 5));

test("leave asks once; the page's departure stages and answers with the view", async () => {
    const reasons = [];
    const { departure, sent, frames } = harness(
        (reason) => (reasons.push(reason), shot)
    );
    departure.leave();
    departure.leave();
    assert.deepEqual(sent, [{ kind: "exit" }]);
    assert.equal(departure.receive("peers"), false);
    assert.equal(departure.receive("departure", { reason: "self" }), true);
    await settle();
    assert.deepEqual(reasons, ["self"]);
    assert.equal(frames(), 2, "two frames are drawn in the final view first");
    assert.deepEqual(
        sent.map((m) => m.kind),
        ["exit", "departure-staging", "departure-ready"]
    );
    assert.deepEqual(sent[2].view, departureView(shot));
    assert.equal(departure.phase, "staged");
    // A second request answers from the same frame without staging again.
    departure.receive("departure");
    await settle();
    assert.deepEqual(reasons, ["self"]);
    assert.equal(sent.length, 4);
    assert.equal(sent[3].kind, "departure-ready");
});

test("a party departure reaches the game without the game asking", async () => {
    const reasons = [];
    const { departure, sent } = harness(
        async (reason) => (reasons.push(reason), departureView(shot))
    );
    departure.receive("departure", { reason: "party" });
    await settle();
    assert.deepEqual(reasons, ["party"]);
    assert.deepEqual(
        sent.map((m) => m.kind),
        ["departure-staging", "departure-ready"]
    );
    assert.ok(sent[1].view);
});

test("a failed or unusable stage still answers, with no view", async () => {
    const thrown = harness(() => {
        throw new Error("no avatar");
    });
    thrown.departure.receive("departure");
    await settle();
    assert.deepEqual(thrown.sent[1], {
        kind: "departure-ready",
        view: null,
        problem: "no avatar",
    });
    const firstPerson = harness(() => ({
        ...shot,
        camera: {
            position: { x: 10, y: 1.6, z: 19 },
            target: { x: 10, y: 1.6, z: 10 },
            fov: 70,
        },
    }));
    firstPerson.departure.receive("departure");
    await settle();
    assert.equal(firstPerson.sent[1].view, null);
    assert.equal(firstPerson.sent[1].problem, "DEPARTURE_AVATAR_BEHIND_CAMERA");
});
