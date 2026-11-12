import {
    initialUploadState,
    shouldRun,
    uploadTransition as step,
    type UploadEvent,
    type UploadState,
    type UploadStatus,
    type UploadStep,
    type UploadStepStatus,
} from "./uploadMachine";

type Steps = [UploadStepStatus, UploadStepStatus, UploadStepStatus];
const at = (
    status: UploadStatus,
    [quality_model, upload_cdn, upload_db]: Steps = ["todo", "todo", "todo"],
    attempt = 0
): UploadState => ({
    status,
    steps: { quality_model, upload_cdn, upload_db },
    attempt,
});

const started = (s: UploadStep): UploadEvent => ({ type: "started", step: s });
const done = (s: UploadStep): UploadEvent => ({ type: "done", step: s });
const stopped = (s: UploadStep): UploadEvent => ({
    type: "failed-step",
    step: s,
});
const failed: UploadEvent = { type: "failed" };
const retry: UploadEvent = { type: "retry" };

test("the window opens deploying, every step waiting", () => {
    expect(initialUploadState).toEqual(at("deploying"));
});

test.each<[string, UploadState, UploadEvent, UploadState]>([
    [
        "the models are being prepared",
        at("deploying"),
        started("quality_model"),
        at("deploying", ["progress", "todo", "todo"]),
    ],
    [
        "they are ready",
        at("deploying", ["progress", "todo", "todo"]),
        done("quality_model"),
        at("deploying", ["success", "todo", "todo"]),
    ],
    [
        "the files reach the CDN",
        at("deploying", ["success", "progress", "todo"]),
        done("upload_cdn"),
        at("deploying", ["success", "success", "todo"]),
    ],
    [
        "the space is saved",
        at("deploying", ["success", "success", "progress"]),
        done("upload_db"),
        at("deployed", ["success", "success", "success"]),
    ],
    [
        "a step stops",
        at("deploying", ["success", "progress", "todo"]),
        stopped("upload_cdn"),
        at("deploying", ["success", "error", "todo"]),
    ],
    [
        "the attempt stops after it",
        at("deploying", ["success", "error", "todo"]),
        failed,
        at("failed", ["success", "error", "todo"]),
    ],
    ["or before any step", at("deploying"), failed, at("failed")],
    [
        "the window's owner refuses the result",
        at("deployed", ["success", "success", "success"]),
        stopped("upload_db"),
        at("deployed", ["success", "success", "error"]),
    ],
    [
        "and the attempt stops",
        at("deployed", ["success", "success", "error"]),
        failed,
        at("failed", ["success", "success", "error"]),
    ],
    [
        "Try again keeps finished ticks and waits on the failed step",
        at("failed", ["success", "error", "todo"]),
        retry,
        at("deploying", ["success", "todo", "todo"], 1),
    ],
    [
        "each press counts",
        at("failed", ["success", "success", "error"], 1),
        retry,
        at("deploying", ["success", "success", "todo"], 2),
    ],
])("%s", (_name, state, event, next) => {
    expect(step(state, event)).toEqual(next);
});

test.each<[string, UploadState, UploadEvent]>([
    ["no retry while deploying", at("deploying"), retry],
    [
        "no retry once deployed",
        at("deployed", ["success", "success", "success"]),
        retry,
    ],
    [
        "a stopped attempt reports no more steps",
        at("failed", ["error", "todo", "todo"]),
        started("upload_cdn"),
    ],
    ["nor a second failure", at("failed"), failed],
    [
        "a step already in progress",
        at("deploying", ["progress", "todo", "todo"]),
        started("quality_model"),
    ],
    ["an unknown event", at("deploying"), { type: "unknown" } as any],
])("%s returns the same state", (_name, state, event) => {
    expect(step(state, event)).toBe(state);
});

test.each<[UploadStepStatus, boolean]>([
    ["todo", true],
    ["progress", true],
    ["error", true],
    ["success", false],
])("a %s step runs again: %p", (status, runs) => {
    const state = at("deploying", [status, status, status]);
    expect(shouldRun(state, "quality_model")).toBe(runs);
    expect(shouldRun(state, "upload_cdn")).toBe(runs);
    // Saving always runs; whether it saved before is the window's to check.
    expect(shouldRun(state, "upload_db")).toBe(true);
});
