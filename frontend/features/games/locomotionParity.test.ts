// The games locomotion kit (games/kits/locomotion) copies the lobby's feel.
// This runs with the frontend's tests, so a change to the lobby's controls or
// movement that the kit has not followed fails here. The kit's own drift
// test (games/kits/locomotion/test/lobby-parity.test.mjs) also reads the
// camera numbers out of createLobbyScene.tsx.
import {
    createLobbyJumpInput,
    lobbyKeyCode,
    readLobbyKeyboard,
} from "@features/lobby/lobbyControls";
import {
    ACCELERATION,
    STEP,
    input,
    state,
    step,
} from "../../../multiplayer/protocol/movement";
import { MOTION } from "../../../games/kits/locomotion/src/constants";

// The kit is source for Node and Vite, which import "./file.ts" by its
// extension; loading it at run time keeps that out of this project's types.
const { createJumpInput, keyCode, readKeys } = jest.requireActual(
    "../../../games/kits/locomotion/src/input"
);
const { stepWalker, walkerState } = jest.requireActual(
    "../../../games/kits/locomotion/src/motion"
);

const CODES = [
    "KeyW",
    "KeyA",
    "KeyS",
    "KeyD",
    "ArrowUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "ShiftLeft",
    "ShiftRight",
    "Space",
];

describe("the locomotion kit matches the lobby", () => {
    it("reads every combination of keys the way the lobby does", () => {
        for (let mask = 0; mask < 1 << CODES.length; mask++) {
            const keys = new Set(CODES.filter((_, bit) => mask & (1 << bit)));
            const lobby = readLobbyKeyboard(keys, 0.016);
            const kit = readKeys(keys, 0.016);
            expect([kit.strafe, kit.forward, kit.turn]).toEqual([
                lobby.strafe,
                lobby.forward,
                lobby.turn,
            ]);
            expect(kit.running).toBe(
                keys.has("ShiftLeft") || keys.has("ShiftRight")
            );
        }
    });

    it("names keys the way the lobby does", () => {
        for (const event of [
            { code: "KeyW", key: "w" },
            { code: "", key: " " },
            { code: "", key: "Spacebar" },
            { code: "", key: "d" },
            { code: "", key: "Shift" },
            { code: "", key: "ArrowLeft" },
        ])
            expect(keyCode(event)).toBe(lobbyKeyCode(event));
    });

    it("queues jumps the way the lobby does", () => {
        const lobby = createLobbyJumpInput();
        const kit = createJumpInput();
        const presses = new Set([0, 1, 2, 9, 30, 31, 32, 33, 80]);
        for (let frame = 0; frame < 120; frame++) {
            if (presses.has(frame)) {
                lobby.queue();
                kit.queue();
            }
            const dt = frame % 3 ? 1 / 60 : 1 / 144;
            expect(kit.read(dt)).toBe(lobby.read(dt));
        }
    });

    it("moves the way the lobby does", () => {
        expect(MOTION.step).toBe(STEP);
        expect(MOTION.acceleration).toBe(ACCELERATION);
        const lobby = state();
        const kit = walkerState();
        for (let n = 0; n < 600; n++) {
            const controls = input({
                strafe: n % 200 < 100 ? 0 : 1,
                forward: n % 300 < 240 ? -1 : 0,
                yaw: Math.floor(n / 150) * 0.9,
                running: n > 300,
                jump: n % 97 < 2,
                animation: -1,
            });
            step(lobby, controls);
            stepWalker(kit, controls);
        }
        expect(Math.hypot(kit.x, kit.z)).toBeGreaterThan(5);
        for (const key of ["x", "y", "z", "rotation", "vx", "vz", "vy"])
            expect(kit[key]).toBeCloseTo(lobby[key], 9);
    });
});
