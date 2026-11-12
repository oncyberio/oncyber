/** @jest-environment jsdom */
import { AgoraChannel } from "./AgoraChannel";
import { AUDIO_LOW_BAR } from "./levels";
import { Events, TypedEmitter } from "./types";
import { WebRTCClient } from "./WebRTCClient";

jest.mock("./WebRTCClient", () => {
    const { EventEmitter } = require("events");
    const events = new EventEmitter();
    const client: any = {
        on: (event, callback) => {
            events.on(event, callback);
            return () => events.off(event, callback);
        },
        emit: (...args) => events.emit(...args),
        init: jest.fn(async (opts) => {
            client.uid = opts.userId;
        }),
        leave: jest.fn(() => events.removeAllListeners()),
        setRole: jest.fn(),
        publish: jest.fn(),
        unpublish: jest.fn(),
    };
    return { WebRTCClient: { instance: client } };
});

// A stream whose samples all have one amplitude: 0.1 is -20dB, level 0.8.
class Stream {
    tracks = [{ kind: "audio", readyState: "live", stop: jest.fn() }];
    constructor(public amplitude = 0) {}
    getTracks() {
        return [...this.tracks];
    }
    getAudioTracks() {
        return this.tracks.filter((track) => track.kind === "audio");
    }
    getVideoTracks() {
        return [];
    }
}
class FakeAnalyser {
    fftSize = 2048;
    input: FakeSource;
    connect = jest.fn();
    getFloatTimeDomainData = jest.fn((samples: Float32Array) => {
        samples.fill(this.input.stream.amplitude);
    });
}
class FakeSource {
    constructor(public stream: Stream) {}
    connect = jest.fn((node: FakeAnalyser) => {
        node.input = this;
    });
    disconnect = jest.fn();
}
class FakeAudioContext {
    static instances: FakeAudioContext[] = [];
    static initialState = "running";
    state = FakeAudioContext.initialState;
    destination = {};
    sources: FakeSource[] = [];
    analysers: FakeAnalyser[] = [];
    constructor() {
        FakeAudioContext.instances.push(this);
    }
    createMediaStreamSource(stream: Stream) {
        const source = new FakeSource(stream);
        this.sources.push(source);
        return source;
    }
    createAnalyser() {
        const analyser = new FakeAnalyser();
        this.analysers.push(analyser);
        return analyser;
    }
    resume = jest.fn(async () => {
        this.state = "running";
    });
    close = jest.fn(async () => {
        this.state = "closed";
    });
}

const client = WebRTCClient.instance as any;
const SAMPLE_MS = 250;
let emitter: TypedEmitter;
let channel: AgoraChannel;
let events: any[];

async function join(enableVolumeStats = true) {
    channel = new AgoraChannel(emitter, {
        type: "mic",
        isPrimary: true,
        enableVolumeStats,
    });
    await channel.join("self", "", {} as any);
}
function remotePublishes(uid: string, stream: Stream) {
    client.emit("user-published", { uid }, stream, "mic");
}
const lastVolumes = () => events[events.length - 1].volumes;

beforeEach(() => {
    jest.useFakeTimers();
    FakeAudioContext.instances = [];
    FakeAudioContext.initialState = "running";
    (globalThis as any).AudioContext = FakeAudioContext;
    emitter = new TypedEmitter();
    events = [];
    emitter.on(Events.VOLUME_INDICATOR, (info) => events.push(info));
});
afterEach(async () => {
    await channel.leave();
    delete (globalThis as any).AudioContext;
    jest.useRealTimers();
    jest.restoreAllMocks();
});

test("reports who is speaking at most four times a second", async () => {
    await join();
    const remote = new Stream(0.1);
    remotePublishes("remote", remote);
    channel.publish(new Stream(0) as any);

    jest.advanceTimersByTime(1000);
    expect(events).toHaveLength(4);
    expect(events[3].channel).toBe("mic");
    expect(Object.keys(lastVolumes()).sort()).toEqual(["remote", "self"]);
    expect(lastVolumes().remote.level).toBeCloseTo(0.8);
    expect(lastVolumes().remote).toMatchObject({
        isActive: true,
        inactiveTime: 0,
    });
    // A mic that has never been heard is not "recently speaking".
    expect(lastVolumes().self).toEqual({
        level: 0,
        isActive: false,
        inactiveTime: Infinity,
    });

    // Going quiet counts up towards the 1.5s and 2s the indicators wait.
    remote.amplitude = 0;
    jest.advanceTimersByTime(SAMPLE_MS);
    expect(lastVolumes().remote).toEqual({
        level: 0,
        isActive: false,
        inactiveTime: 0,
    });
    jest.advanceTimersByTime(2000);
    expect(lastVolumes().remote.inactiveTime).toBe(2000);
});

test("measuring a stream never routes it to the speakers", async () => {
    await join();
    remotePublishes("remote", new Stream(0.1));
    channel.publish(new Stream(0.1) as any);
    jest.advanceTimersByTime(SAMPLE_MS);

    const [context] = FakeAudioContext.instances;
    expect(FakeAudioContext.instances).toHaveLength(1);
    expect(context.sources).toHaveLength(2);
    context.sources.forEach((source) => {
        expect(source.connect).toHaveBeenCalledTimes(1);
        expect(source.connect.mock.calls[0][0]).toBeInstanceOf(FakeAnalyser);
    });
    context.analysers.forEach((analyser) => {
        expect(analyser.connect).not.toHaveBeenCalled();
    });
});

test("leaving stops the timer and releases the audio graph", async () => {
    await join();
    remotePublishes("remote", new Stream(0.1));
    jest.advanceTimersByTime(SAMPLE_MS);
    expect(events).toHaveLength(1);
    const [context] = FakeAudioContext.instances;

    await channel.leave();
    expect(jest.getTimerCount()).toBe(0);
    expect(context.sources[0].disconnect).toHaveBeenCalledTimes(1);
    expect(context.close).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(2000);
    expect(events).toHaveLength(1);
});

test("an unpublished or replaced mic is not measured from a stale source", async () => {
    await join();
    const remote = new Stream(0.1);
    remotePublishes("remote", remote);
    const local = new Stream(0.1);
    channel.publish(local as any);
    jest.advanceTimersByTime(SAMPLE_MS);
    const [context] = FakeAudioContext.instances;

    client.emit("user-unpublished", { uid: "remote" }, remote);
    // Changing the microphone swaps the track inside the same stream.
    local.tracks = [{ kind: "audio", readyState: "live", stop: jest.fn() }];
    local.amplitude = 0;
    jest.advanceTimersByTime(SAMPLE_MS);

    expect(Object.keys(lastVolumes())).toEqual(["self"]);
    expect(lastVolumes().self.isActive).toBe(false);
    expect(context.sources).toHaveLength(3);
    expect(context.sources[0].disconnect).toHaveBeenCalledTimes(1);
    expect(context.sources[1].disconnect).toHaveBeenCalledTimes(1);
    expect(context.sources[2].disconnect).not.toHaveBeenCalled();
});

test("a context created before any gesture resumes on the next one", async () => {
    FakeAudioContext.initialState = "suspended";
    await join();
    remotePublishes("remote", new Stream(0.1));
    jest.advanceTimersByTime(SAMPLE_MS);
    const [context] = FakeAudioContext.instances;
    expect(context.resume).not.toHaveBeenCalled();

    window.dispatchEvent(new Event("pointerdown"));
    expect(context.resume).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new Event("keydown"));
    expect(context.resume).toHaveBeenCalledTimes(1);

    await channel.leave();
    context.state = "suspended";
    window.dispatchEvent(new Event("pointerdown"));
    expect(context.resume).toHaveBeenCalledTimes(1);
});

test("a browser without AudioContext joins voice without a sampling timer", async () => {
    delete (globalThis as any).AudioContext;
    await join();
    remotePublishes("remote", new Stream(0.1));
    expect(jest.getTimerCount()).toBe(0);
    expect(channel.streams.remote).toBeDefined();
    jest.advanceTimersByTime(2000);
    expect(events).toHaveLength(0);
});

test("a channel without volume stats never samples", async () => {
    await join(false);
    remotePublishes("remote", new Stream(0.1));
    expect(jest.getTimerCount()).toBe(0);
    jest.advanceTimersByTime(2000);
    expect(events).toHaveLength(0);
    expect(FakeAudioContext.instances).toHaveLength(0);
});

test("a failing analyser ends the indicators, not the voice channel", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    await join();
    remotePublishes("remote", new Stream(0.1));
    jest.advanceTimersByTime(SAMPLE_MS);
    expect(lastVolumes().remote.isActive).toBe(true);

    const [context] = FakeAudioContext.instances;
    context.analysers[0].getFloatTimeDomainData.mockImplementation(() => {
        throw new Error("analyser lost");
    });
    expect(() => jest.advanceTimersByTime(2000)).not.toThrow();

    // One last empty event clears every indicator, then sampling stops.
    expect(events).toHaveLength(2);
    expect(lastVolumes()).toEqual({});
    expect(jest.getTimerCount()).toBe(0);
    expect(warn).toHaveBeenCalledTimes(1);
    const published = jest.fn();
    emitter.on(Events.USER_PUBLISHED, published);
    remotePublishes("other", new Stream(0.1));
    expect(published).toHaveBeenCalledTimes(1);
});

test("a stream that cannot be measured reads as silent", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.spyOn(
        FakeAudioContext.prototype,
        "createMediaStreamSource"
    ).mockImplementation(() => {
        throw new Error("no audio track");
    });
    await join();
    remotePublishes("remote", new Stream(0.1));
    expect(() => jest.advanceTimersByTime(1000)).not.toThrow();

    expect(events).toHaveLength(4);
    expect(lastVolumes().remote).toEqual({
        level: 0,
        isActive: false,
        inactiveTime: Infinity,
    });
    // The failure is noted once, not retried on every sample.
    expect(warn).toHaveBeenCalledTimes(1);
});

test("a listener that throws does not stop later samples", async () => {
    const error = jest.spyOn(console, "error").mockImplementation(() => {});
    await join();
    emitter.on(Events.VOLUME_INDICATOR, () => {
        throw new Error("listener bug");
    });
    remotePublishes("remote", new Stream(0.1));
    expect(() => jest.advanceTimersByTime(500)).not.toThrow();
    expect(events).toHaveLength(2);
    expect(error).toHaveBeenCalledTimes(2);
});

test("each sample says which threshold it was judged against", async () => {
    await join();
    remotePublishes("remote", new Stream(0.1));
    jest.advanceTimersByTime(SAMPLE_MS);

    expect(channel.audioLowBar).toBe(AUDIO_LOW_BAR);
    expect(events[0].threshold).toBe(AUDIO_LOW_BAR);
});

test("another threshold can be tried, and applies from the next sample", async () => {
    await join();
    // 0.01 is -40dB, level 0.6: speaking at the 0.5 the code has
    remotePublishes("remote", new Stream(0.01));
    jest.advanceTimersByTime(SAMPLE_MS);
    expect(lastVolumes().remote.level).toBeCloseTo(0.6);
    expect(lastVolumes().remote.isActive).toBe(true);

    expect(channel.setAudioLowBar(0.7)).toBe(0.7);
    jest.advanceTimersByTime(SAMPLE_MS);
    expect(lastVolumes().remote.level).toBeCloseTo(0.6);
    expect(lastVolumes().remote.isActive).toBe(false);
    expect(events[1].threshold).toBe(0.7);
});

test("a threshold outside 0..1 is ignored", async () => {
    await join();

    expect(channel.setAudioLowBar(1.5)).toBe(AUDIO_LOW_BAR);
    expect(channel.setAudioLowBar(-0.1)).toBe(AUDIO_LOW_BAR);
    expect(channel.setAudioLowBar(NaN)).toBe(AUDIO_LOW_BAR);
    expect(channel.setAudioLowBar(undefined)).toBe(AUDIO_LOW_BAR);
    expect(channel.audioLowBar).toBe(AUDIO_LOW_BAR);
    expect(channel.setAudioLowBar(0)).toBe(0);
    expect(channel.setAudioLowBar(1)).toBe(1);
});
