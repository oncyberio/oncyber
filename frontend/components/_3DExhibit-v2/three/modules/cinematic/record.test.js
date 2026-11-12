// The real cinematic module over a fake recorder: a recording always ends
// (done, cancelled or failed) and leaves nothing set behind it.

jest.mock(
    "@3constants",
    () => {
        const state = { recording: false };
        return {
            CINEMATIC: false,
            CURRENT_SPACE: {},
            DEBUG: false,
            ERROR_CODES: {},
            WEB_CODECS: true,
            // a live binding in the engine: read on every use
            get IS_RECORDING() {
                return state.recording;
            },
            SET_IS_RECORDING: (value) => {
                state.recording = value;
            },
        };
    },
    { virtual: true }
);
jest.mock("@3scene", () => ({ __esModule: true, default: {} }), {
    virtual: true,
});
jest.mock("@3events", () => ({ __esModule: true, default: {} }), {
    virtual: true,
});
jest.mock("@3emitter", () => ({ __esModule: true, default: {} }), {
    virtual: true,
});
jest.mock(
    "@3camera",
    () => ({ __esModule: true, default: { current: null } }),
    {
        virtual: true,
    }
);
jest.mock(
    "@3cameras/editcinematic.js",
    () => ({
        __esModule: true,
        default: { name: "edit", activate() {}, desactivate() {} },
    }),
    { virtual: true }
);
jest.mock(
    "@3cameras/cinematic.js",
    () => ({
        __esModule: true,
        default: { name: "display", activate() {}, desactivate() {} },
    }),
    { virtual: true }
);
jest.mock("@3gl/root", () => ({ __esModule: true, default: {} }), {
    virtual: true,
});
jest.mock("@3gl/globals/customGui", () => ({ cinematicGUI: {} }), {
    virtual: true,
});
jest.mock("@env", () => ({ nodeEnv: {} }));
jest.mock("three", () => ({ CameraHelper: class {} }));
jest.mock("gsap/CustomEase", () => ({
    __esModule: true,
    default: { create: () => "none" },
}));
jest.mock("./splines/editor", () => ({ __esModule: true, default: class {} }));
jest.mock("./splines/curve.js", () => ({
    __esModule: true,
    default: class {},
}));
jest.mock("./composer", () => ({
    __esModule: true,
    default: {
        active: false,
        reset: jest.fn(),
        layout: jest.fn(),
        dispose: jest.fn(),
        startTween: { play: jest.fn() },
    },
}));

import { IS_RECORDING, SET_IS_RECORDING } from "@3constants";
import Camera from "@3camera";
import EditCamera from "@3cameras/editcinematic.js";
import DisplayCamera from "@3cameras/cinematic.js";
import Composer from "./composer";
import Cinematic, { RECORD_STATUS } from "./index";

/** A recorder that renders nothing: the test plays its part. */
function fakeRecorder() {
    const recorder = {
        encoder: null,
        init: jest.fn(async () => {}),
        // like the real one: settles only when the video is done
        start: jest.fn(
            (tween, opts) =>
                new Promise((resolve, reject) => {
                    recorder.frame = opts.callback;
                    recorder.finish = () => {
                        SET_IS_RECORDING(false);
                        resolve();
                    };
                    recorder.fail = reject;
                    SET_IS_RECORDING(true);
                })
        ),
        stop: jest.fn(async () => {
            SET_IS_RECORDING(false);
        }),
    };
    return recorder;
}

const steps = () => new Promise((done) => setTimeout(done));
const PENDING = "pending";
const outcome = (promise) =>
    Promise.race([
        promise.then(
            (value) => value,
            (err) => err
        ),
        steps().then(() => PENDING),
    ]);

let recorder;
beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
    SET_IS_RECORDING(false);
    recorder = fakeRecorder();
    Cinematic.recorder = recorder;
    Cinematic.recording = null;
    Cinematic.recorderStopped = null;
    Cinematic.curves = [];
    Cinematic.edit = true;
    Composer.active = false;
});
afterEach(() => jest.restoreAllMocks());

function expectNothingLeftSet() {
    expect(IS_RECORDING).toBe(false);
    expect(Cinematic.recording).toBeNull();
    expect(Cinematic.recordRequested).toBe(false);
    expect(Cinematic.requestPlay).toBe(false);
    // the camera and the composer are back as they were before recording
    expect(Cinematic.edit).toBe(true);
    expect(Camera.current).toBe(EditCamera);
    expect(Composer.active).toBe(false);
}

test("a finished recording resolves as done and hands everything back", async () => {
    const frames = [];
    const recording = Cinematic.record({
        playAll: true,
        callback: (frame) => frames.push(frame),
    });
    await steps();
    expect(recorder.start).toHaveBeenCalledTimes(1);
    expect(Cinematic.recordRequested).toBe(true);
    expect(Camera.current).toBe(DisplayCamera);
    expect(Composer.active).toBe(true);
    expect(await outcome(recording)).toBe(PENDING);

    recorder.frame({ progression: 0.5 });
    recorder.frame({ progression: 1, blobFile: "video" });
    recorder.finish();

    await expect(recording).resolves.toEqual({ status: RECORD_STATUS.DONE });
    expect(frames).toEqual([
        { progression: 0.5 },
        { progression: 1, blobFile: "video" },
    ]);
    // the recorder stopped by itself
    expect(recorder.stop).not.toHaveBeenCalled();
    expectNothingLeftSet();
});

test("cancelling while frames are rendered resolves as cancelled and stops the recorder", async () => {
    const recording = Cinematic.record({ playAll: true });
    await steps();
    expect(IS_RECORDING).toBe(true);

    Cinematic.cancel();

    // cleared at once, not when the recorder has finished stopping
    expectNothingLeftSet();
    expect(recorder.stop).toHaveBeenCalledTimes(1);
    await expect(recording).resolves.toEqual({
        status: RECORD_STATUS.CANCELLED,
    });
    expect(Composer.reset).toHaveBeenCalled();
});

test("cancelling while the recorder prepares never starts it", async () => {
    let prepared;
    recorder.init.mockReturnValueOnce(
        new Promise((done) => {
            prepared = done;
        })
    );
    const recording = Cinematic.record({ playAll: true });
    await steps();
    expect(recorder.init).toHaveBeenCalledTimes(1);

    Cinematic.cancel();
    await expect(recording).resolves.toEqual({
        status: RECORD_STATUS.CANCELLED,
    });
    prepared();
    await steps();

    expect(recorder.start).not.toHaveBeenCalled();
    expectNothingLeftSet();
});

test("cancelling while the recorder module loads never starts it", async () => {
    let loaded;
    jest.spyOn(Cinematic, "initRecorder").mockReturnValueOnce(
        new Promise((done) => {
            loaded = done;
        })
    );
    const recording = Cinematic.record({ playAll: true });
    await steps();

    Cinematic.cancel();
    await expect(recording).resolves.toEqual({
        status: RECORD_STATUS.CANCELLED,
    });
    loaded();
    await steps();

    expect(recorder.init).not.toHaveBeenCalled();
    expect(recorder.start).not.toHaveBeenCalled();
    expectNothingLeftSet();
});

test("a recorder that fails to prepare rejects, and the next recording works", async () => {
    recorder.init.mockRejectedValueOnce(new Error("no encoder module"));

    await expect(Cinematic.record({ playAll: true })).rejects.toThrow(
        "no encoder module"
    );
    expect(recorder.stop).toHaveBeenCalledTimes(1);
    expectNothingLeftSet();

    const next = Cinematic.record({ playAll: true });
    await steps();
    recorder.finish();
    await expect(next).resolves.toEqual({ status: RECORD_STATUS.DONE });
});

test("a recorder that fails while recording rejects and is stopped", async () => {
    const recording = Cinematic.record({ playAll: true });
    await steps();
    expect(IS_RECORDING).toBe(true);

    recorder.fail(new Error("encoder closed"));

    await expect(recording).rejects.toThrow("encoder closed");
    expect(recorder.stop).toHaveBeenCalledTimes(1);
    expectNothingLeftSet();
});

test("a recorder whose encoder will not end still hands the scene back", async () => {
    const recording = Cinematic.record({ playAll: true });
    await steps();
    recorder.encoder = { end: () => Promise.reject(new Error("closed")) };
    recorder.stop.mockImplementation(async () => {
        SET_IS_RECORDING(false);
        if (recorder.encoder) await recorder.encoder.end();
        recorder.handedBack = true;
    });

    Cinematic.cancel();
    await expect(recording).resolves.toEqual({
        status: RECORD_STATUS.CANCELLED,
    });
    await Cinematic.recorderStopped;

    expect(recorder.stop).toHaveBeenCalledTimes(2);
    expect(recorder.handedBack).toBe(true);
    expectNothingLeftSet();
});

test("recording without a recorder rejects instead of waiting forever", async () => {
    Cinematic.recorder = null;
    jest.spyOn(Cinematic, "initRecorder").mockResolvedValue(undefined);

    await expect(Cinematic.record({ playAll: true })).rejects.toThrow(
        "cannot record"
    );
    expectNothingLeftSet();
});

test("a second recording during the first one is told it is busy and changes nothing", async () => {
    const first = Cinematic.record({ playAll: true });
    await steps();

    await expect(Cinematic.record({ playAll: true })).resolves.toEqual({
        status: RECORD_STATUS.BUSY,
    });
    expect(recorder.start).toHaveBeenCalledTimes(1);
    expect(await outcome(first)).toBe(PENDING);

    recorder.finish();
    await expect(first).resolves.toEqual({ status: RECORD_STATUS.DONE });
});

test("a recorder that gets going after its recording was cancelled is stopped at its first frame", async () => {
    const frames = [];
    const recording = Cinematic.record({
        playAll: true,
        callback: (frame) => frames.push(frame),
    });
    await steps();
    Cinematic.cancel();
    await recording;
    expect(recorder.stop).toHaveBeenCalledTimes(1);

    // the encoder was still being created at the time: the recorder starts
    SET_IS_RECORDING(true);
    recorder.frame({ progression: 0 });
    await steps();

    expect(frames).toEqual([]);
    expect(recorder.stop).toHaveBeenCalledTimes(2);
    expect(IS_RECORDING).toBe(false);
});

test("a frame handler that throws ends the recording as failed", async () => {
    const recording = Cinematic.record({
        playAll: true,
        callback: () => {
            throw new Error("preview is gone");
        },
    });
    await steps();

    recorder.frame({ progression: 0 });

    await expect(recording).rejects.toThrow("preview is gone");
    expect(recorder.stop).toHaveBeenCalledTimes(1);
    expectNothingLeftSet();
});

test("the next recording waits until the cancelled one has handed the scene back", async () => {
    let stopped;
    recorder.stop.mockImplementationOnce(() => {
        SET_IS_RECORDING(false);
        return new Promise((done) => {
            stopped = done;
        });
    });
    const first = Cinematic.record({ playAll: true });
    await steps();
    Cinematic.cancel();
    await first;

    const second = Cinematic.record({ playAll: true });
    await steps();
    expect(recorder.init).toHaveBeenCalledTimes(1);

    stopped();
    await steps();
    expect(recorder.init).toHaveBeenCalledTimes(2);
    expect(recorder.start).toHaveBeenCalledTimes(2);
    recorder.finish();
    await expect(second).resolves.toEqual({ status: RECORD_STATUS.DONE });
});

test("cancelling with no recording stops a recorder that was left running", () => {
    SET_IS_RECORDING(true);

    Cinematic.cancel();

    expect(recorder.stop).toHaveBeenCalledTimes(1);
    expect(IS_RECORDING).toBe(false);
});

test("recording stops a recorder that was left running, then records", async () => {
    SET_IS_RECORDING(true);

    const recording = Cinematic.record({ playAll: true });
    expect(recorder.stop).toHaveBeenCalledTimes(1);
    await steps();
    expect(recorder.start).toHaveBeenCalledTimes(1);

    recorder.finish();
    await expect(recording).resolves.toEqual({ status: RECORD_STATUS.DONE });
    expectNothingLeftSet();
});

test("cancelling with nothing going on does nothing", () => {
    Cinematic.cancel();

    expect(recorder.stop).not.toHaveBeenCalled();
    expect(Composer.reset).not.toHaveBeenCalled();
});

test("leaving the cinematic mid-recording stops the recorder but neither takes the camera nor completes the caller", async () => {
    const recording = Cinematic.record({ playAll: true });
    await steps();
    Cinematic.splineEditor = null;
    Cinematic.data = { export: [] };
    const elsewhere = { name: "space camera" };
    Camera.current = elsewhere;

    Cinematic.dispose();

    expect(recorder.stop).toHaveBeenCalledTimes(1);
    expect(IS_RECORDING).toBe(false);
    expect(Cinematic.recording).toBeNull();
    expect(Cinematic.recordRequested).toBe(false);
    expect(Composer.active).toBe(false);
    expect(Camera.current).toBe(elsewhere);
    // see endRecording(): settling would finish a transition into the
    // cinematic state that the app has already left
    expect(await outcome(recording)).toBe(PENDING);
});
