import {
    trialOwes,
    trialSettled,
    trialTransition,
    TRIAL_FLOOD,
    TRIAL_REPLACED,
    TRIAL_SILENT,
    type TrialEvent,
    type TrialState,
} from "./trial";

const opening: TrialState = { phase: "opening" };
const starting: TrialState = { phase: "starting" };
const running = (ticks = 0): TrialState => ({ phase: "running", ticks });
const passed: TrialState = { phase: "passed" };

describe("a new version's trial", () => {
    test.each<[string, TrialState, TrialEvent, TrialState]>([
        ["its frame opens", opening, { type: "booted" }, starting],
        ["it starts", starting, { type: "started" }, running()],
        [
            "what it sends while starting is not a frame",
            starting,
            { type: "ops", seq: -1 },
            starting,
        ],
        [
            "its start's own answer is not a frame either",
            running(),
            { type: "ops", seq: -1 },
            running(),
        ],
        ["a frame answered", running(1), { type: "ops", seq: 9 }, running(2)],
        ["the last frame", running(2), { type: "ops", seq: 12 }, passed],
        [
            "it throws while starting",
            starting,
            { type: "error", text: "TypeError: x" },
            { phase: "failed", reason: "TypeError: x", fault: "script" },
        ],
        [
            "it is stopped for hanging",
            running(1),
            { type: "stopped", reason: "It stopped answering." },
            {
                phase: "failed",
                reason: "It stopped answering.",
                fault: "script",
            },
        ],
        [
            "it floods",
            running(1),
            { type: "flood" },
            { phase: "failed", reason: TRIAL_FLOOD, fault: "script" },
        ],
        [
            "it goes silent",
            starting,
            { type: "silent" },
            { phase: "failed", reason: TRIAL_SILENT, fault: "world" },
        ],
        [
            "its frame never opens",
            opening,
            { type: "unopened", reason: "The script frame did not open." },
            {
                phase: "failed",
                reason: "The script frame did not open.",
                fault: "world",
            },
        ],
        [
            "something newer takes its place",
            running(2),
            { type: "closed" },
            {
                phase: "failed",
                reason: TRIAL_REPLACED,
                fault: "world",
                closed: true,
            },
        ],
        [
            "closed before its frame opened",
            opening,
            { type: "closed" },
            {
                phase: "failed",
                reason: TRIAL_REPLACED,
                fault: "world",
                closed: true,
            },
        ],
    ])("%s", (_name, state, event, expected) => {
        expect(trialTransition(state, event, 3)).toEqual(expected);
    });

    test("a settled trial hears nothing more, and says so by returning itself", () => {
        const failed = trialTransition(running(), { type: "closed" });
        for (const state of [passed, failed])
            for (const event of [
                { type: "started" },
                { type: "ops", seq: 3 },
                { type: "error", text: "late" },
                { type: "closed" },
                { type: "silent" },
            ] as TrialEvent[])
                expect(trialTransition(state, event)).toBe(state);
        expect(trialSettled(passed)).toBe(true);
        expect(trialSettled(failed)).toBe(true);
        expect(trialSettled(running(5))).toBe(false);
    });

    test("an event that does not apply returns the same state", () => {
        expect(trialTransition(starting, { type: "booted" })).toBe(starting);
        const state = running(1);
        expect(trialTransition(state, { type: "started" })).toBe(state);
        expect(trialTransition(state, { type: "ops", seq: NaN })).toBe(state);
    });

    test("silence is the version's only while it owes its start or a frame", () => {
        expect(trialOwes(opening, false)).toBe(false);
        expect(trialOwes(starting, false)).toBe(true);
        // No frame was drawn, so none was asked: a tab in the background.
        expect(trialOwes(running(4), false)).toBe(false);
        expect(trialOwes(running(4), true)).toBe(true);
        expect(trialOwes(passed, true)).toBe(false);
    });
});
