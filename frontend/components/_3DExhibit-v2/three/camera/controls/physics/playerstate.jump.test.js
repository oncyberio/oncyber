import { PerspectiveCamera } from "three";
import { PlayerState } from "./playerstate";

jest.mock("@3constants", () => ({ IS_FIRST_PERSON: false, IS_MOBILE: false }), {
    virtual: true,
});
jest.mock("@3emitter", () => ({ on: jest.fn(), off: jest.fn() }), {
    virtual: true,
});
jest.mock("@3events", () => ({}), { virtual: true });
jest.mock("@components/_3DExhibit-v2/three/factory/player", () => ({
    main: { deactivated: false },
}));

function fixture(opts = {}) {
    const state = new PlayerState(opts);
    state.jump = 8;
    state.setFloorContact(true);
    const camera = new PerspectiveCamera();
    return { state, tick: () => state.keyControls(1 / 60, camera) };
}

test("two presses launch twice; holding, a third press and holding through landing cannot relaunch", () => {
    const { state, tick } = fixture();
    state.keyStates.Space = true;
    tick();
    expect(state.jumpCount).toBe(1);
    expect(state.veclocity.y).toBe(8);
    state.setFloorContact(false);
    state.veclocity.y = 3;
    tick();
    expect(state.veclocity.y).toBe(3);
    state.keyStates.Space = false;
    tick();
    state.keyStates.Space = true;
    tick();
    expect(state.jumpCount).toBe(2);
    expect(state.veclocity.y).toBe(8);
    state.keyStates.Space = false;
    tick();
    state.veclocity.y = -2;
    state.keyStates.Space = true;
    tick();
    expect(state.jumpCount).toBe(2);
    expect(state.veclocity.y).toBe(-2);
    state.setFloorContact(true);
    tick();
    expect(state.jumpCount).toBe(0);
    expect(state.isJumping).toBe(false);
    expect(state.veclocity.y).toBe(-2);
    state.keyStates.Space = false;
    tick();
    state.keyStates.Space = true;
    tick();
    expect(state.jumpCount).toBe(1);
});

test("floor contact during upward takeoff does not replenish the air-jump allowance", () => {
    const { state, tick } = fixture();
    state.keyStates.Space = true;
    tick();
    state.setFloorContact(true);
    expect(state.jumpCount).toBe(1);
    expect(state.isJumping).toBe(true);
});

test("camera switches preserve jump state and respawns clear it", () => {
    const { state, tick } = fixture();
    state.keyStates.Space = true;
    tick();
    state.setFloorContact(false);
    const next = new PlayerState();
    next.copyFrom(state);
    expect(next.jumpCount).toBe(1);
    expect(next.jumpHeld).toBe(true);
    expect(next.isJumping).toBe(true);
    next.reset();
    expect(next.jumpCount).toBe(0);
    expect(next.jumpHeld).toBe(false);
    expect(next.isJumping).toBe(false);
});

test.each(["editor", "quidditch"])(
    "%s keeps its authored held-space behavior and jump strength",
    (mode) => {
        const { state, tick } = fixture({ editMode: mode === "editor" });
        state.quidditch = mode === "quidditch";
        state.jump = 12;
        state.keyStates.Space = true;
        tick();
        state.setFloorContact(false);
        state.veclocity.y = 1;
        tick();
        expect(state.veclocity.y).toBe(12);
    }
);

jest.mock("../../constants", () => {
    const { Vector3 } = require("three");
    return {
        DIRECTION: {
            FORWARD: new Vector3(0, 0, 1),
            BACKWARD: new Vector3(0, 0, -1),
            LEFT: new Vector3(1, 0, 0),
            RIGHT: new Vector3(-1, 0, 0),
        },
    };
});
