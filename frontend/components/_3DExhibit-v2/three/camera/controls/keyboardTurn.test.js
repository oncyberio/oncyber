import { Euler, PerspectiveCamera, Vector3 } from "three";
import PlayerControls from "./wasdcontrols";
import FlyControls from "./flycontrols";
import Players from "@3factory/player";
import { applyKeyboardTurn } from "./keyboardTurn";

jest.mock(
    "@3constants",
    () => ({
        IS_FIRST_PERSON: true,
        IS_MOBILE: false,
        IS_TOUCH: false,
        IS_POINTER_LOCK: () => false,
        ORIENTATION: "landscape",
        PORTRAIT: "portrait",
    }),
    { virtual: true }
);
jest.mock("@3emitter", () => ({ on: jest.fn(), off: jest.fn() }), {
    virtual: true,
});
jest.mock("@3events", () => ({}), { virtual: true });
jest.mock("@3factory/player", () => ({ main: { deactivated: false } }), {
    virtual: true,
});
jest.mock("@components/_3DExhibit-v2/three/factory/player", () =>
    require("@3factory/player")
);
jest.mock("@3gl/utils/params", () => ({}), { virtual: true });
jest.mock("@3utils/math/smoothstep", () => () => 0, { virtual: true });
jest.mock(
    "@3utils/math/clamp",
    () => (min, max, n) => Math.max(min, Math.min(max, n)),
    { virtual: true }
);
jest.mock("dat.gui", () => ({}));
jest.mock("gsap", () => ({}));
jest.mock("./abstract", () => ({
    AbstractControls: class {
        emit() {}
    },
}));
jest.mock("../constants", () => {
    const { Vector3 } = require("three");
    return {
        DIRECTION: {
            FORWARD: new Vector3(0, 0, 1),
            BACKWARD: new Vector3(0, 0, -1),
            LEFT: new Vector3(1, 0, 0),
            RIGHT: new Vector3(-1, 0, 0),
        },
        JOYSTICK_DIRECTIONS: {},
        IS_FLY: false,
    };
});
jest.mock("./physics", () => ({
    Physics: class {
        constructor(opts) {
            const { PlayerState } = require("./physics/playerstate");
            this.playerState = new PlayerState();
            this.playerState.speed = 10;
            this.playerState.playerOnFloor = true;
            this.update = (delta) =>
                this.playerState.keyControls(delta, opts.camera);
        }
    },
}));

function controls(fly = false) {
    const camera = new PerspectiveCamera();
    camera.rotation.order = "YXZ";
    camera.updateMatrixWorld(true);
    const walk = new PlayerControls({ camera, roomParameters: {} });
    return fly
        ? new FlyControls({ camera, world: walk.world, roomParameters: {} })
        : walk;
}
const press = (c, code) => c._handleKeyDown({ code });
const release = (c, code) => c._handleKeyUp({ code });
const yaw = (c) => new Euler().setFromQuaternion(c.camera.quaternion, "YXZ").y;
beforeEach(() => {
    Players.main.deactivated = false;
});

test.each([false, true])(
    "arrow keys turn while walking forward, including fly=%s",
    (fly) => {
        const c = controls(fly);
        press(c, "ArrowUp");
        press(c, "ArrowRight");
        c.update(1 / 60, 0);
        expect(yaw(c)).toBeLessThan(0);
        const velocity = c.playerState.veclocity;
        expect(velocity.x).toBeGreaterThan(0);
        expect(velocity.z).toBeLessThan(0);
        // No arrow strafing: movement follows the turned camera, even on this frame.
        expect(
            velocity
                .clone()
                .normalize()
                .dot(c.camera.getWorldDirection(new Vector3()))
        ).toBeCloseTo(1);
        release(c, "ArrowRight");
        const before = yaw(c);
        c.update(1 / 60, 0);
        expect(yaw(c)).toBeCloseTo(before);
    }
);

test("turning in place does not move sideways; A/D still strafe", () => {
    const c = controls();
    press(c, "ArrowLeft");
    c.update(1 / 60, 0);
    expect(yaw(c)).toBeGreaterThan(0);
    expect(c.playerState.veclocity.length()).toBe(0);
    release(c, "ArrowLeft");
    press(c, "KeyD");
    const before = yaw(c);
    c.update(1 / 60, 0);
    expect(yaw(c)).toBeCloseTo(before);
    expect(c.playerState.veclocity.length()).toBeGreaterThan(0);
});

test.each([30, 60, 144])(
    "turn speed is independent of frame/key repeat rate at %i fps",
    (fps) => {
        const c = controls();
        press(c, "ArrowLeft");
        for (let i = 0; i < fps; i++) c.update(1 / fps, i / fps);
        expect(yaw(c)).toBeCloseTo(Math.PI / 2);
    }
);

test("opposing arrows cancel, and pausing clears held turning keys", () => {
    const c = controls();
    press(c, "ArrowLeft");
    press(c, "ArrowRight");
    c.update(1 / 60, 0);
    expect(yaw(c)).toBe(0);
    release(c, "ArrowRight");
    c.update(1 / 60, 0);
    const before = yaw(c);
    c.handlePause();
    c.update(1 / 60, 0);
    expect(yaw(c)).toBeCloseTo(before);
    press(c, "ArrowLeft");
    Players.main.deactivated = true;
    c.update(1 / 60, 0);
    expect(yaw(c)).toBeCloseTo(before);
});

test("keyboard turning preserves mouse pitch and bounds long suspended frames", () => {
    const c = controls();
    c.camera.rotation.x = 0.4;
    press(c, "ArrowRight");
    c.update(10, 0);
    expect(yaw(c)).toBeCloseTo(-Math.PI / 20);
    expect(c.camera.rotation.x).toBeCloseTo(0.4);
});

test("third-person turning uses the orbit camera's angle and sensitivity", () => {
    const c = controls();
    c.camera.sensitivity = { x: 0.5 };
    c.camera.theta = 0;
    c.camera.move = (dx) => {
        c.camera.theta -= (dx * c.camera.sensitivity.x) / 2;
    };
    press(c, "ArrowLeft");
    for (let i = 0; i < 60; i++) applyKeyboardTurn(c, 1 / 60, true);
    expect(c.camera.theta).toBeCloseTo(90);
});
