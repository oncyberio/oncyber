/** @jest-environment jsdom */
import { AgoraVoiceChatProvider } from "./AgoraVoiceChatProvider";
import { AgoraChannel } from "./AgoraChannel";
import { VoiceChatState } from "./VoiceChatProvider";
import { Events, TypedEmitter } from "./types";
import { WebRTCClient } from "./WebRTCClient";

jest.mock("./ColyseusSignaling", () => ({
    ColyseusSignaling: class {
        room: unknown;
        constructor(room: unknown) {
            this.room = room;
        }
    },
}));
jest.mock("./WebRTCClient", () => {
    const { EventEmitter } = require("events");
    const events = new EventEmitter();
    const client: any = {
        ready: null,
        nextReady: null,
        transport: null,
        published: [],
        on: (event, callback) => {
            events.on(event, callback);
            return () => events.off(event, callback);
        },
        emit: (...args) => events.emit(...args),
        init: jest.fn((opts) => {
            if (client.ready) return client.ready;
            client.transport = opts.transport;
            client.uid = opts.userId;
            client.ready = client.nextReady ?? Promise.resolve();
            client.nextReady = null;
            return client.ready;
        }),
        leave: jest.fn(() => {
            events.removeAllListeners();
            client.published.forEach(({ stream }) =>
                stream.getTracks().forEach((track) => track.stop())
            );
            client.published = [];
            client.ready = null;
            client.transport = null;
        }),
        setRole: jest.fn(),
        publish: jest.fn((stream, type) => {
            client.published.push({ stream, type });
        }),
        unpublish: jest.fn((stream) => {
            client.published = client.published.filter(
                (entry) => entry.stream !== stream
            );
            stream.getTracks().forEach((track) => track.stop());
        }),
        replaceLocalTrack: jest.fn(async (stream, track) => {
            stream.getTracks().forEach((old) => {
                old.stop();
                stream.removeTrack(old);
            });
            stream.addTrack(track);
        }),
        setMicGated: jest.fn(),
    };
    return { WebRTCClient: { instance: client } };
});

class Track {
    enabled = true;
    readyState = "live";
    stop = jest.fn(() => {
        this.readyState = "ended";
    });
    private handlers = new Map<string, Set<() => unknown>>();
    constructor(public kind = "audio") {}
    addEventListener(type: string, handler: () => unknown) {
        if (!this.handlers.has(type)) this.handlers.set(type, new Set());
        this.handlers.get(type).add(handler);
    }
    removeEventListener(type: string, handler: () => unknown) {
        this.handlers.get(type)?.delete(handler);
    }
    dispatchEvent(event: Event) {
        this.handlers.get(event.type)?.forEach((handler) => handler());
    }
    getSettings() {
        return { displaySurface: "browser" };
    }
}
class Stream {
    constructor(private tracks: Track[] = []) {}
    getTracks() {
        return [...this.tracks];
    }
    getAudioTracks() {
        return this.tracks.filter((t) => t.kind === "audio");
    }
    getVideoTracks() {
        return this.tracks.filter((t) => t.kind === "video");
    }
    addTrack(track: Track) {
        this.tracks.push(track);
    }
    removeTrack(track: Track) {
        this.tracks = this.tracks.filter((t) => t !== track);
    }
}
function deferred<T = any>() {
    let resolve: (value?: T) => void;
    let reject: (error: Error) => void;
    const promise = new Promise<T>((yes, no) => {
        resolve = yes;
        reject = no;
    });
    return { promise, resolve, reject };
}
async function flush() {
    for (let i = 0; i < 12; i++) await Promise.resolve();
}
const client = WebRTCClient.instance as any;
const tokens = { mic: "", stream: "" };
let provider: AgoraVoiceChatProvider;
let getUserMedia: jest.Mock;
let getDisplayMedia: jest.Mock;
function options(id = "one", isPublisher = true) {
    return {
        channelId: id,
        uid: `self-${id}`,
        spaceSlug: id,
        tokens,
        isPublisher,
        room: { sessionId: `self-${id}` } as any,
    };
}
function mic() {
    return new Stream([new Track()]);
}
function screen(withAudio = true) {
    return new Stream([
        new Track("video"),
        ...(withAudio ? [new Track("audio")] : []),
    ]);
}
beforeEach(() => {
    client.leave();
    client.nextReady = null;
    jest.clearAllMocks();
    provider = new AgoraVoiceChatProvider();
    getUserMedia = jest.fn();
    getDisplayMedia = jest.fn();
    Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: { getUserMedia, getDisplayMedia },
    });
    (globalThis as any).MediaStream = Stream;
});
afterEach(async () => {
    await provider.leave();
    jest.restoreAllMocks();
});

test("a token result after leave cannot allocate voice or publish into a later room", async () => {
    const token = deferred();
    jest.spyOn(provider, "getToken").mockReturnValueOnce(token.promise);
    const first = provider.join({ ...options(), tokens: null }, null);
    const abandoned = expect(first).rejects.toThrow("voice join aborted");
    await flush();
    await provider.leave();
    const current = options("two", false);
    await provider.join(current, null);
    token.resolve(tokens);
    await abandoned;
    expect(client.init).toHaveBeenCalledTimes(2);
    expect(client.transport.room).toBe(current.room);
    expect(provider.state).toBe(VoiceChatState.Connected);
    expect(provider.role).toBe("audience");
});

test("a new room supersedes a pending TURN wait without old channel handlers or cleanup", async () => {
    const turn = deferred();
    client.nextReady = turn.promise;
    const first = provider.join(options(), null);
    const abandoned = expect(first).rejects.toThrow("voice join aborted");
    await flush();
    const current = options("two", false);
    await provider.join(current, null);
    const published = jest.fn();
    const joined = jest.fn();
    provider.on(Events.USER_PUBLISHED, published);
    provider.on(Events.USER_JOINED, joined);
    const leaves = client.leave.mock.calls.length;
    turn.resolve();
    await abandoned;
    client.emit("user-joined", { uid: "remote" });
    const stream = mic();
    client.emit("user-published", { uid: "remote" }, stream, "mic");
    expect(joined).toHaveBeenCalledTimes(1);
    expect(published).toHaveBeenCalledTimes(1);
    expect(provider.micStreams.remote).toBe(stream);
    expect(provider.state).toBe(VoiceChatState.Connected);
    expect(provider.channels.mic.roomId).toBe("two");
    expect(client.transport.room).toBe(current.room);
    expect(client.leave).toHaveBeenCalledTimes(leaves);
});

test("abort during TURN immediately leaves, and a late failure cannot disconnect the replacement", async () => {
    const turn = deferred();
    client.nextReady = turn.promise;
    const abort = new AbortController();
    const first = provider.join(options(), abort);
    const failed = expect(first).rejects.toThrow("TURN failed");
    await flush();
    abort.abort();
    expect(provider.state).toBe(VoiceChatState.Disconnected);
    await provider.join(options("two"), null);
    turn.reject(new Error("TURN failed"));
    await failed;
    expect(provider.state).toBe(VoiceChatState.Connected);
    expect(provider.channels.stream.roomId).toBe("two-stream");
});

test("duplicate joins to the same room wait for the existing admission", async () => {
    const turn = deferred();
    client.nextReady = turn.promise;
    const opts = options();
    const first = provider.join(opts, null);
    let finished = false;
    const duplicate = provider.join(opts, null).then(() => {
        finished = true;
    });
    await flush();
    expect(finished).toBe(false);
    turn.resolve();
    await Promise.all([first, duplicate]);
    expect(client.init).toHaveBeenCalledTimes(2);
    expect(provider.state).toBe(VoiceChatState.Connected);
});

test("leave completes channel cleanup before an immediate rejoin", async () => {
    await provider.join(options(), null);
    const leaving = provider.leave();
    const joining = provider.join(options("two"), null);
    await Promise.all([leaving, joining]);
    const stream = mic();
    client.emit("user-published", { uid: "remote" }, stream, "mic");
    expect(provider.channels.mic.uid).toBe("self-two");
    expect(provider.micStreams.remote).toBe(stream);
    expect(provider.state).toBe(VoiceChatState.Connected);
});

test("peer disconnect unpublishes both mic and screen streams but reports one departure", async () => {
    await provider.join(options(), null);
    const remoteMic = mic(),
        remoteScreen = screen();
    const unpublished = jest.fn(),
        left = jest.fn();
    provider.on(Events.USER_UNPUBLISHED, unpublished);
    provider.on(Events.USER_LEFT, left);
    client.emit("user-published", { uid: "remote" }, remoteMic, "mic");
    client.emit("user-published", { uid: "remote" }, remoteScreen, "stream");
    expect(provider.micStreams.remote).toBe(remoteMic);
    expect(provider.loopbackStreams.remote).toBe(remoteScreen);

    client.emit("user-left", { uid: "remote" }, "disconnected");

    expect(provider.micStreams.remote).toBeUndefined();
    expect(provider.loopbackStreams.remote).toBeUndefined();
    expect(unpublished).toHaveBeenCalledTimes(2);
    expect(unpublished).toHaveBeenCalledWith("remote", {
        channel: "mic",
        mediaType: "audio",
        stream: remoteMic,
    });
    expect(unpublished).toHaveBeenCalledWith("remote", {
        channel: "stream",
        mediaType: "video",
        stream: remoteScreen,
    });
    expect(left).toHaveBeenCalledTimes(1);
    expect(left).toHaveBeenCalledWith("remote", { reason: "disconnected" });

    // A late clean-unpublish cannot tear down either surface a second time.
    client.emit("user-unpublished", { uid: "remote" }, remoteMic);
    client.emit("user-unpublished", { uid: "remote" }, remoteScreen);
    expect(unpublished).toHaveBeenCalledTimes(2);
});

test.each(["leave", "mute", "disable"])(
    "%s cancels a pending microphone permission without publishing it",
    async (action) => {
        await provider.join(options(), null);
        const permission = deferred();
        getUserMedia.mockReturnValueOnce(permission.promise);
        const enabling = provider.setMuted(false);
        if (action === "leave") {
            await provider.leave();
            await provider.join(options("two"), null);
        } else if (action === "mute") {
            await provider.setMuted(true);
        } else {
            await provider.disableVoice();
        }
        const stream = mic();
        permission.resolve(stream);
        await enabling;
        expect(stream.getTracks()[0].stop).toHaveBeenCalledTimes(1);
        expect(provider.localMicStream).toBeNull();
        expect(client.publish).not.toHaveBeenCalled();
    }
);

test("overlapping unmute requests keep only the newest captured stream", async () => {
    await provider.join(options(), null);
    const a = deferred(),
        b = deferred();
    getUserMedia.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
    const first = provider.setMuted(false);
    const second = provider.setMuted(false);
    const old = mic(),
        current = mic();
    b.resolve(current);
    await second;
    a.resolve(old);
    await first;
    expect(provider.localMicStream).toBe(current);
    expect(old.getTracks()[0].readyState).toBe("ended");
    expect(current.getTracks()[0].readyState).toBe("live");
    expect(client.publish).toHaveBeenCalledTimes(1);
});

test("an old device request cannot replace a microphone in a new room", async () => {
    await provider.join(options(), null);
    getUserMedia.mockResolvedValueOnce(mic());
    await provider.setMuted(false);
    const permission = deferred();
    getUserMedia.mockReturnValueOnce(permission.promise);
    const changing = provider.setMicrophoneDevice("old-device");
    await provider.leave();
    await provider.join(options("two"), null);
    const current = mic();
    getUserMedia.mockResolvedValueOnce(current);
    await provider.setMuted(false);
    const stale = mic();
    permission.resolve(stale);
    await changing;
    expect(stale.getTracks()[0].readyState).toBe("ended");
    expect(provider.localMicStream).toBe(current);
    expect(client.replaceLocalTrack).not.toHaveBeenCalled();
});

test("device replacement preserves a muted stream and its identity", async () => {
    await provider.join(options(), null);
    const original = mic();
    getUserMedia.mockResolvedValueOnce(original);
    await provider.setMuted(false);
    await provider.setMuted(true);
    const replacement = mic();
    const track = replacement.getTracks()[0];
    getUserMedia.mockResolvedValueOnce(replacement);
    await provider.setMicrophoneDevice("new-device");
    expect(provider.localMicStream).toBe(original);
    expect(original.getTracks()).toEqual([track]);
    expect(track.enabled).toBe(false);
    expect(getUserMedia).toHaveBeenLastCalledWith({
        audio: expect.objectContaining({ deviceId: "new-device" }),
    });
});

test("a stale role grant or revocation cannot change the next room's role", async () => {
    await provider.join(options("one", false), null);
    const refresh = deferred();
    jest.spyOn(provider.channels.mic, "refreshToken").mockReturnValueOnce(
        refresh.promise
    );
    const granting = provider.enableVoice(tokens);
    await provider.leave();
    await provider.join(options("two", false), null);
    refresh.resolve();
    await granting;
    expect(provider.role).toBe("audience");
    expect(client.setRole).toHaveBeenLastCalledWith("audience");
    await provider.enableVoice(tokens);
    const revoking = provider.disableVoice();
    await provider.leave();
    await provider.join(options("three"), null);
    await revoking;
    expect(provider.role).toBe("host");
    expect(client.setRole).toHaveBeenLastCalledWith("host");
});

test.each(["leave", "stop"])(
    "%s cancels a pending screen capture and releases every returned track",
    async (action) => {
        await provider.join(options(), null);
        const permission = deferred();
        getDisplayMedia.mockReturnValueOnce(permission.promise);
        const sharing = provider.setPlaying(true);
        if (action === "leave") {
            await provider.leave();
            await provider.join(options("two"), null);
        } else {
            await provider.setPlaying(false);
        }
        const captured = screen();
        permission.resolve(captured);
        await sharing;
        expect(
            captured.getTracks().every((t) => t.readyState === "ended")
        ).toBe(true);
        expect(provider.isPlaying()).toBe(false);
        expect(client.publish).not.toHaveBeenCalled();
    }
);

test("screen sharing keeps audio/video and an old ended event cannot stop the new share", async () => {
    await provider.join(options(), null);
    const old = screen(),
        current = screen();
    getDisplayMedia.mockResolvedValueOnce(old).mockResolvedValueOnce(current);
    await provider.setPlaying(true);
    expect(provider.localLoopbackStream.getTracks()).toHaveLength(2);
    expect(provider.localLoopbackStream.getTracks()).toEqual(
        expect.arrayContaining(old.getTracks())
    );
    expect(client.publish).toHaveBeenLastCalledWith(
        provider.localLoopbackStream,
        "stream"
    );
    await provider.setPlaying(false);
    await provider.setPlaying(true);
    const stopped = jest.fn();
    provider.on(Events.SHARING_STOPPED, stopped);
    old.getVideoTracks()[0].dispatchEvent(new Event("ended"));
    await flush();
    expect(provider.isPlaying()).toBe(true);
    expect(current.getTracks().every((t) => t.readyState === "live")).toBe(
        true
    );
    expect(stopped).not.toHaveBeenCalled();
    current.getVideoTracks()[0].dispatchEvent(new Event("ended"));
    await flush();
    expect(provider.isPlaying()).toBe(false);
    expect(current.getTracks().every((t) => t.readyState === "ended")).toBe(
        true
    );
    expect(stopped).toHaveBeenCalledTimes(1);
});

test("audio-only sharing retains capture cleanup and rejects missing audio", async () => {
    await provider.join(options(), null);
    const captured = screen();
    getDisplayMedia.mockResolvedValueOnce(captured);
    await provider.setPlaying(true, true);
    expect(provider.localLoopbackStream.getTracks()).toEqual(
        captured.getAudioTracks()
    );
    await provider.setPlaying(false);
    expect(captured.getTracks().every((t) => t.readyState === "ended")).toBe(
        true
    );
    const silent = screen(false);
    getDisplayMedia.mockResolvedValueOnce(silent);
    await expect(provider.setPlaying(true, true)).rejects.toThrow(
        "No Audio was shared"
    );
    expect(silent.getTracks()[0].readyState).toBe("ended");
    expect(provider.isPlaying()).toBe(false);
});

test("a channel cannot install stale listeners after leave or retain duplicate captures", async () => {
    const emitter = new TypedEmitter();
    const channel = new AgoraChannel(emitter, {
        type: "mic",
        isPrimary: true,
        enableVolumeStats: false,
    });
    const turn = deferred();
    client.nextReady = turn.promise;
    const pending = channel.join("one", "", {} as any);
    const abandoned = expect(pending).rejects.toThrow("voice join aborted");
    await channel.leave();
    turn.resolve();
    await abandoned;
    const published = jest.fn();
    emitter.on(Events.USER_PUBLISHED, published);
    client.emit("user-published", { uid: "remote" }, mic(), "mic");
    expect(published).not.toHaveBeenCalled();
    const late = mic();
    channel.publish(late as any);
    expect(late.getTracks()[0].readyState).toBe("ended");
    await channel.join("two", "", {} as any);
    const first = mic(),
        duplicate = mic();
    const cleanup = jest.fn();
    channel.publish(first as any, cleanup);
    channel.publish(duplicate as any);
    expect(duplicate.getTracks()[0].readyState).toBe("ended");
    await channel.unpublish();
    await channel.leave();
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(first.getTracks()[0].readyState).toBe("ended");
});
