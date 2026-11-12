import {
    IDLE_SPACE_SWITCH as idle,
    spaceSwitchBackTarget,
    spaceSwitchTransition as step,
    type SpaceSwitchEvent,
    type SpaceSwitchState,
} from "./spaceSwitchMachine";

const a = { id: "a" } as any;
const b = { id: "b" } as any;
const c = { id: "c" } as any;

const start = (target, from = null, isAnon = false): SpaceSwitchEvent => ({
    type: "start",
    target,
    from,
    isAnon,
});
const succeed: SpaceSwitchEvent = { type: "succeed" };
const fail: SpaceSwitchEvent = { type: "fail" };

const switching = (target, from = null, isAnon = false): SpaceSwitchState => ({
    status: "switching",
    target,
    from,
    isAnon,
});
const failed = (target, from = null, isAnon = false): SpaceSwitchState => ({
    status: "failed",
    target,
    from,
    isAnon,
});

test.each<[string, SpaceSwitchState, SpaceSwitchEvent, SpaceSwitchState]>([
    ["a switch starts", idle, start(b, a), switching(b, a)],
    [
        "a guest's switch is marked",
        idle,
        start(b, a, true),
        switching(b, a, true),
    ],
    ["a switch with nothing open", idle, start(b), switching(b)],
    ["it ends when the space opens", switching(b, a), succeed, idle],
    [
        "it keeps the space that would not open",
        switching(b, a),
        fail,
        failed(b, a),
    ],
    ["Retry runs the same switch", failed(b, a), start(b, b), switching(b, a)],
    [
        "a retry that fails is the same failure",
        switching(b, a),
        fail,
        failed(b, a),
    ],
    ["a retry that works clears it", switching(b, a), succeed, idle],
    ["Back opens the space they left", failed(b, a), start(a), switching(a, a)],
    [
        "another space after a failure",
        failed(b, a),
        start(c, b),
        switching(c, a),
    ],
])("%s", (_name, state, event, next) => {
    expect(step(state, event)).toEqual(next);
});

test.each<[string, SpaceSwitchState, SpaceSwitchEvent]>([
    ["a second switch waits for the first", switching(b, a), start(c, a)],
    ["nothing to finish when idle", idle, succeed],
    ["nothing to fail when idle", idle, fail],
    ["a late success after a failure", failed(b, a), succeed],
    ["a late failure after a failure", failed(b, a), fail],
    ["an unknown event", switching(b, a), { type: "nope" } as any],
])("%s changes nothing", (_name, state, event) => {
    // The same object, so the owner can skip the update.
    expect(step(state, event)).toBe(state);
});

test.each<[string, SpaceSwitchState, unknown]>([
    ["a failed switch goes back to the space it left", failed(b, a), a],
    ["nothing was open before", failed(b), null],
    ["going back is what failed", failed(a, a), null],
    ["a guest has one draft", failed(b, a, true), null],
    ["a running switch", switching(b, a), null],
    ["no switch", idle, null],
])("the way back: %s", (_name, state, back) => {
    expect(spaceSwitchBackTarget(state)).toBe(back);
});

it("carries a whole journey: fail, retry, fail, back", () => {
    const journey = [start(b, a), fail, start(b), fail, start(a), succeed];
    const seen = journey.reduce(
        (states, event) => [...states, step(states[states.length - 1], event)],
        [idle]
    );
    expect(seen.map((state) => state.status)).toEqual([
        "idle",
        "switching",
        "failed",
        "switching",
        "failed",
        "switching",
        "idle",
    ]);
});
