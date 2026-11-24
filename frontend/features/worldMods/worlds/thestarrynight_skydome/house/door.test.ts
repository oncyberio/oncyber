/** @jest-environment node */
import {
    DOOR_CLOSED,
    DOOR_RULES,
    easedSwing,
    transition,
    type DoorState,
} from "./door";

const frame = (distance: number, seconds = 0.1) =>
    ({ type: "frame", seconds, distance } as const);

/** Runs the door for `seconds` with the visitor at `distance`. */
function run(state: DoorState, distance: number, seconds: number) {
    for (let t = 0; t < seconds; t += 0.1)
        state = transition(state, frame(distance));
    return state;
}

const near = DOOR_RULES.openWithin - 1;
const between = (DOOR_RULES.openWithin + DOOR_RULES.closeBeyond) / 2;
const far = DOOR_RULES.closeBeyond + 1;

test.each([
    ["closed", "nobody near", far, "closed"],
    ["closed", "a visitor comes near", near, "opening"],
    ["closed", "a visitor is on the way but not near yet", between, "closed"],
    ["open", "the visitor steps back a little", between, "open"],
    ["open", "the visitor has gone", far, "closing"],
    ["open", "the visitor is in the room", 0, "open"],
] as const)("%s, %s: %s", (from, _what, distance, to) => {
    const start: DoorState =
        from === "open" ? { phase: "open", swing: 1 } : DOOR_CLOSED;
    expect(transition(start, frame(distance)).phase).toBe(to);
});

test("opens all the way in its swing time, then stays", () => {
    const opened = run(DOOR_CLOSED, near, DOOR_RULES.swingSeconds + 0.2);
    expect(opened).toEqual({ phase: "open", swing: 1 });
    // nothing changes: the same object, so the owner can skip its work
    expect(transition(opened, frame(near))).toBe(opened);
});

test("shuts behind a visitor who has left, and stays shut", () => {
    const open: DoorState = { phase: "open", swing: 1 };
    const shut = run(open, far, DOOR_RULES.swingSeconds + 0.2);
    expect(shut).toEqual({ phase: "closed", swing: 0 });
    expect(transition(shut, frame(far))).toBe(shut);
});

test("turns back mid-swing when the visitor does", () => {
    const half = run(DOOR_CLOSED, near, DOOR_RULES.swingSeconds / 2);
    expect(half.phase).toBe("opening");
    const back = transition(half, frame(far));
    expect(back.phase).toBe("closing");
    expect(back.swing).toBeLessThan(half.swing);
    // and between the two distances it carries on closing
    expect(transition(back, frame(between)).phase).toBe("closing");
});

test("a long frame cannot swing it past its stops", () => {
    expect(transition(DOOR_CLOSED, frame(near, 30)).swing).toBe(1);
    expect(transition({ phase: "open", swing: 1 }, frame(far, 30)).swing).toBe(
        0
    );
    expect(transition(DOOR_CLOSED, frame(near, -1)).swing).toBe(0);
});

test("the swing eases in and out between its stops", () => {
    expect(easedSwing(0)).toBe(0);
    expect(easedSwing(1)).toBe(1);
    expect(easedSwing(0.5)).toBeCloseTo(0.5);
    expect(easedSwing(0.1)).toBeLessThan(0.1);
    expect(easedSwing(0.9)).toBeGreaterThan(0.9);
});
