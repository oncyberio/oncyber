import {
    createLobbyJumpInput,
    lobbyKeyCode,
    readLobbyKeyboard,
} from "./lobbyControls";
import { LobbyInputPrediction } from "./LobbyInputPrediction";

test.each([30, 60, 144])(
    "arrows steer at the native quarter-turn per second at %i Hz",
    (hz) => {
        const keys = new Set(["ArrowUp", "ArrowRight"]);
        const prediction = new LobbyInputPrediction();
        let yaw = 0;
        for (let frame = 0; frame < hz; frame++) {
            const keyboard = readLobbyKeyboard(keys, 1 / hz);
            yaw += keyboard.turn;
            expect(keyboard.strafe).toBe(0);
            expect(keyboard.forward).toBe(-1);
            prediction.advance(1 / hz, {
                ...keyboard,
                yaw,
                running: false,
                jump: false,
                animation: -1,
            });
        }
        expect(yaw).toBeCloseTo(-Math.PI / 2);
        expect(prediction.state.x).toBeGreaterThan(0.5);
        expect(prediction.state.z).toBeLessThan(-0.5);
    }
);

test("turning alone stays in place, opposing arrows cancel, and WASD retains strafing", () => {
    expect(readLobbyKeyboard(new Set(["ArrowLeft"]), 1)).toEqual({
        strafe: 0,
        forward: 0,
        turn: Math.PI / 20,
    });
    expect(
        readLobbyKeyboard(new Set(["ArrowLeft", "ArrowRight"]), 0.1).turn
    ).toBe(0);
    expect(readLobbyKeyboard(new Set(["KeyD", "KeyW"]), 0.1)).toEqual({
        strafe: 1,
        forward: -1,
        turn: 0,
    });
    expect(readLobbyKeyboard(new Set(["ArrowDown"]), 0.1).forward).toBe(1);
});

test.each([30, 60, 144])(
    "two Space taps between frames survive prediction at %i Hz without a third jump",
    (hz) => {
        const jumps = createLobbyJumpInput();
        const prediction = new LobbyInputPrediction();
        const controls = {
            strafe: 0,
            forward: 0,
            yaw: 0,
            running: false,
            animation: -1,
        };
        // Both down/up pairs happen before the next rendered frame.
        jumps.queue();
        jumps.queue();
        const counts = new Set<number>();
        let launches = 0;
        let previous = 0;
        for (let frame = 0; frame < hz * 2; frame++) {
            if (frame === Math.ceil(hz / 5)) jumps.queue();
            const state = prediction.advance(1 / hz, {
                ...controls,
                jump: jumps.read(1 / hz),
            });
            counts.add(state.jumpCount);
            if (state.jumpCount > previous) launches++;
            previous = state.jumpCount;
            expect(state.jumpCount).toBeLessThanOrEqual(2);
        }
        expect(counts).toContain(2);
        expect(launches).toBe(2);
        expect(prediction.state).toMatchObject({ y: 0, vy: 0, jumpCount: 0 });
    }
);

test("holding Space queues only one jump, and clearing cancels pending jumps", () => {
    const jumps = createLobbyJumpInput();
    jumps.queue();
    const edges: boolean[] = [];
    for (let frame = 0; frame < 120; frame++) edges.push(jumps.read(1 / 60));
    expect(edges.filter(Boolean)).toHaveLength(1);
    jumps.queue();
    jumps.queue();
    jumps.clear();
    expect(jumps.pending).toBe(false);
    expect(jumps.read(1 / 60)).toBe(false);
});

test.each([
    ["", "ArrowUp", "ArrowUp"],
    ["", " ", "Space"],
    ["", "w", "KeyW"],
    ["", "D", "KeyD"],
    ["", "Shift", "ShiftLeft"],
    ["", "3", "Digit3"],
    ["KeyW", "z", "KeyW"],
])("normalizes keyboard events (%s, %s)", (code, key, expected) => {
    expect(lobbyKeyCode({ code, key })).toBe(expected);
});
