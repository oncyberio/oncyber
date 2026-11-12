/** @jest-environment jsdom */
import { LOBBY_GUEST_PORTRAIT } from "./lobbyIdentity";
import { Client } from "colyseus.js";
import {
    LobbyConnection,
    LOBBY_ROOM,
    NATIVE_SOCIAL_ROOMS,
} from "./LobbyConnection";
import { WorldLobbyTransport } from "./WorldLobbyTransport";
import * as endpoints from "./lobbyEndpoints";
import { WebRTCClient } from "@utils/voiceChat/WebRTCClient";

jest.mock("colyseus.js", () => ({ Client: jest.fn() }));
jest.mock("@utils/voiceChat/WebRTCClient", () => ({ WebRTCClient: jest.fn() }));

function deferred<T>() {
    let resolve: (value: T) => void;
    const promise = new Promise<T>((next) => {
        resolve = next;
    });
    return { promise, resolve };
}

function makeRoom() {
    const messages = new Map<string, (data: any) => void>();
    let stateChange = () => {};
    let leave = (_code?: number) => {};
    const room: any = {
        sessionId: "self",
        state: {
            players: new Map([
                [
                    "self",
                    { username: "Guest A", space: LOBBY_ROOM, positionX: 0 },
                ],
                [
                    "peer",
                    {
                        username: "Real%20Name",
                        space: LOBBY_ROOM,
                        positionX: 3,
                        positionZ: -1,
                    },
                ],
            ]),
        },
        send: jest.fn(),
        leave: jest.fn(() => Promise.resolve()),
        onMessage: jest.fn((type, fn) => {
            messages.set(type, fn);
            return () => messages.delete(type);
        }),
        onStateChange: jest.fn((fn) => {
            stateChange = fn;
            return () => {
                stateChange = () => {};
            };
        }),
        onLeave: jest.fn((fn) => {
            leave = fn;
            return () => {
                leave = () => {};
            };
        }),
        onError: jest.fn(() => () => {}),
        deliver: (type, data) => messages.get(type)?.(data),
        patch: () => stateChange(),
        disconnect: (code?: number) => leave(code),
    };
    room.onStateChange.once = jest.fn();
    room.onStateChange.remove = jest.fn(() => {
        stateChange = () => {};
    });
    room.onLeave.remove = jest.fn(() => {
        leave = () => {};
    });
    room.onError.remove = jest.fn();
    return room;
}

const flush = async () => {
    for (let i = 0; i < 40; i++) await Promise.resolve();
};

const activeConnections: LobbyConnection[] = [];
function createConnection(
    ...args: ConstructorParameters<typeof LobbyConnection>
) {
    const connection = new LobbyConnection(...args);
    activeConnections.push(connection);
    return connection;
}

describe("landing lobby social lifecycle", () => {
    let room: ReturnType<typeof makeRoom>;
    let consume: jest.Mock;
    let media: jest.Mock;
    let voice: any;
    const identity = { userId: "Anon-test", username: "Guest A", token: "" };

    beforeEach(() => {
        room = makeRoom();
        consume = jest.fn().mockResolvedValue(room);
        (Client as jest.Mock).mockImplementation(() => ({
            consumeSeatReservation: consume,
        }));
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                success: true,
                reservation: { room: { roomId: "lobby" } },
            }),
        });
        media = jest.fn();
        Object.defineProperty(navigator, "mediaDevices", {
            configurable: true,
            value: { getUserMedia: media },
        });
        voice = {
            on: jest.fn(),
            init: jest.fn().mockResolvedValue(undefined),
            setRole: jest.fn(),
            publish: jest.fn(),
            unpublish: jest.fn(),
            leave: jest.fn(),
        };
        (WebRTCClient as unknown as jest.Mock).mockImplementation(() => voice);
    });
    afterEach(async () => {
        await Promise.all(
            activeConnections.splice(0).map((connection) => connection.close())
        );
        Object.defineProperty(document, "hidden", {
            configurable: true,
            value: false,
        });
        Object.defineProperty(navigator, "onLine", {
            configurable: true,
            value: true,
        });
        jest.useRealTimers();
        jest.clearAllMocks();
        jest.restoreAllMocks();
    });

    test("joins the shared CyberRoom as a guest, reads real players, and leaves mic untouched", async () => {
        const connection = createConnection(identity, jest.fn());
        await connection.connect();
        const request = JSON.parse((fetch as jest.Mock).mock.calls[0][1].body);
        expect(request).toMatchObject({
            label: LOBBY_ROOM,
            currentSpace: LOBBY_ROOM,
            userId: "Anon-test",
            token: "",
            username: "Guest%20A",
        });
        expect(request.avatar).toBeTruthy();
        expect(connection.snapshot.status).toBe("connected");
        expect(connection.snapshot.players).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    id: "peer",
                    name: "Real Name",
                    x: 3,
                    z: -1,
                    isLocal: false,
                }),
            ])
        );
        expect(media).not.toHaveBeenCalled();
        expect(WebRTCClient).not.toHaveBeenCalled();
        room.state.players.delete("peer");
        room.patch();
        expect(connection.snapshot.players).toHaveLength(1);
        await connection.close();
        expect(room.leave).toHaveBeenCalledWith(true);
    });

    test("chat uses the room relay and server sender instead of trusting a supplied name", async () => {
        const connection = createConnection(identity, jest.fn());
        await connection.connect();
        expect(connection.sendMessage(" Hello ")).toBe(true);
        expect(room.send).toHaveBeenCalledWith(
            "chat-channel",
            expect.objectContaining({ type: "MESSAGE", text: "Hello" })
        );
        expect(connection.snapshot.messages).toHaveLength(0);
        room.deliver("chat-channel", {
            from: "peer",
            server_ts: 123,
            data: { type: "MESSAGE", text: "hi", username: "Spoofed" },
        });
        expect(connection.snapshot.messages[0]).toMatchObject({
            name: "Real Name",
            text: "hi",
            sessionId: "peer",
            sentAt: 123,
        });
        room.deliver("chat-channel", {
            from: "unknown",
            data: { type: "MESSAGE", text: "hello" },
        });
        expect(connection.snapshot.messages).toHaveLength(1);
        await connection.close();
    });

    test("direct messages target a current person and stay out of the global channel", async () => {
        const connection = createConnection(identity, jest.fn());
        await connection.connect();
        room.send.mockClear();
        expect(connection.sendMessage("Hello", "missing")).toBe(false);
        expect(connection.sendMessage("Hello", "self")).toBe(false);
        expect(connection.sendMessage("Hello", "")).toBe(false);
        expect(room.send).not.toHaveBeenCalled();
        expect(connection.sendMessage(" Private hello ", "peer")).toBe(true);
        expect(room.send).toHaveBeenCalledTimes(1);
        expect(room.send).toHaveBeenCalledWith("chat-peer", {
            to: "peer",
            data: expect.objectContaining({
                type: "MESSAGE",
                text: "Private hello",
            }),
        });
        expect(connection.snapshot.messages[0]).toMatchObject({
            sessionId: "self",
            recipientId: "peer",
            text: "Private hello",
        });
        room.deliver("chat-peer", {
            from: "peer",
            to: "self",
            server_ts: 321,
            data: {
                type: "MESSAGE",
                text: "Only for you",
                username: "Spoofed",
                recipientId: "other",
            },
        });
        expect(connection.snapshot.messages[1]).toMatchObject({
            sessionId: "peer",
            recipientId: "self",
            name: "Real Name",
            text: "Only for you",
            sentAt: 321,
        });
        room.deliver("chat-peer", {
            from: "unknown",
            data: { type: "MESSAGE", text: "Unknown sender" },
        });
        room.deliver("chat-peer", {
            from: "peer",
            data: { type: "RTM_COMMAND", text: "Not a message" },
        });
        expect(connection.snapshot.messages).toHaveLength(2);
        room.deliver("chat-channel", {
            from: "peer",
            server_ts: 322,
            data: { type: "MESSAGE", text: "Public", recipientId: "self" },
        });
        expect(connection.snapshot.messages[2].recipientId).toBeUndefined();
    });

    test("global and private messages share the server's one-second send budget", async () => {
        const connection = createConnection(identity, jest.fn());
        await connection.connect();
        let now = 10000;
        jest.spyOn(Date, "now").mockImplementation(() => now);
        room.send.mockClear();

        expect(connection.sendMessage("Public first")).toBe(true);
        now += 600;
        expect(connection.sendMessage("Too soon", "peer")).toBe(false);
        expect(connection.snapshot.messages).toHaveLength(0);
        now += 400;
        expect(connection.sendMessage("Private second", "peer")).toBe(true);
        expect(connection.snapshot.messages).toHaveLength(1);
        now += 600;
        expect(connection.sendMessage("Public too soon")).toBe(false);
        now += 399;
        expect(connection.sendMessage("Private too soon", "peer")).toBe(false);
        expect(connection.snapshot.messages).toHaveLength(1);
        now += 1;
        expect(connection.sendMessage("Public third")).toBe(true);

        expect(room.send.mock.calls.map(([type]) => type)).toEqual([
            "chat-channel",
            "chat-peer",
            "chat-channel",
        ]);
    });

    test("private messages use the server profile when the sender is outside the visible roster", async () => {
        const connection = createConnection(identity, jest.fn());
        await connection.connect();
        room.deliver("chat-peer", {
            from: "far-peer",
            to: "self",
            server_ts: 400,
            profile: {
                username: "Far%20Friend",
                avatar: "https://example.com/avatar.png",
            },
            data: {
                type: "MESSAGE",
                text: "A private hello",
                username: "Spoofed",
            },
        });
        expect(connection.snapshot.messages[0]).toMatchObject({
            sessionId: "far-peer",
            recipientId: "self",
            name: "Far Friend",
            avatar: "https://example.com/avatar.png",
        });
        room.deliver("chat-channel", {
            from: "far-peer",
            profile: { username: "Far%20Friend" },
            data: { type: "MESSAGE", text: "Out of scope" },
        });
        expect(connection.snapshot.messages).toHaveLength(1);
    });

    test("keeps only the latest movement in each 100ms send window", async () => {
        const connection = createConnection(identity, jest.fn());
        await connection.connect();
        jest.useFakeTimers();
        room.send.mockClear();
        connection.updatePosition({ x: 1, y: 0, z: 2, rotation: 0 });
        connection.updatePosition({
            x: 3,
            y: 0,
            z: 4,
            rotation: 1,
            moving: true,
        });
        jest.advanceTimersByTime(100);
        expect(room.send).toHaveBeenCalledTimes(1);
        expect(room.send).toHaveBeenCalledWith("move", [3, 0, 4, 1, -1, true]);
        connection.updatePosition({ x: NaN, y: 0, z: 4, rotation: 1 });
        await connection.close();
        jest.advanceTimersByTime(100);
        expect(room.send).toHaveBeenCalledTimes(1);
    });

    test("closes a reservation that resolves after the visitor exits", async () => {
        const reservation = deferred<any>();
        consume.mockReturnValue(reservation.promise);
        const onChange = jest.fn();
        const connection = createConnection(identity, onChange);
        const joining = connection.connect();
        await flush();
        expect(consume).toHaveBeenCalledTimes(1);
        await connection.close();
        await joining;
        reservation.resolve(room);
        await flush();
        expect(room.leave).toHaveBeenCalledTimes(1);
        expect(onChange).not.toHaveBeenCalled();
    });

    test("times out a stuck socket reservation, then closes its late result", async () => {
        jest.useFakeTimers();
        const reservation = deferred<any>();
        consume.mockReturnValue(reservation.promise);
        const connection = createConnection(identity, jest.fn());
        const joining = connection.connect();
        await flush();
        jest.advanceTimersByTime(15000);
        await joining;
        expect(connection.snapshot.status).toBe("offline");
        reservation.resolve(room);
        await flush();
        expect(room.leave).toHaveBeenCalledTimes(1);
    });

    test("stops late microphone permission results without publishing after exit", async () => {
        const permission = deferred<MediaStream>();
        media.mockReturnValue(permission.promise);
        const connection = createConnection(identity, jest.fn());
        await connection.connect();
        const enabling = connection.toggleVoice();
        await flush();
        expect(media).toHaveBeenCalledTimes(1);
        await connection.close();
        const track = { stop: jest.fn() };
        permission.resolve({ getTracks: () => [track] } as any);
        await enabling;
        expect(track.stop).toHaveBeenCalledTimes(1);
        expect(voice.publish).not.toHaveBeenCalled();
        expect(voice.leave).toHaveBeenCalled();
    });

    test("disconnection clears live presence and releases voice and microphone", async () => {
        const track = {
            stop: jest.fn(),
            enabled: true,
            addEventListener: jest.fn(),
        };
        media.mockResolvedValue({
            getTracks: () => [track],
            getAudioTracks: () => [track],
        });
        const connection = createConnection(identity, jest.fn());
        await connection.connect();
        await connection.toggleVoice();
        expect(connection.snapshot.voiceState).toBe("live");
        await connection.toggleVoice();
        expect(track.enabled).toBe(false);
        expect(connection.snapshot.voiceState).toBe("muted");
        room.disconnect();
        await flush();
        expect(connection.snapshot).toMatchObject({
            status: "offline",
            players: [],
            voiceState: "off",
        });
        expect(track.stop).toHaveBeenCalled();
        expect(voice.leave).toHaveBeenCalledTimes(1);
    });

    test("a failed voice startup is released and the next tap initializes a fresh client", async () => {
        const failed = voice;
        failed.init.mockRejectedValueOnce(new Error("signaling unavailable"));
        const connection = createConnection(identity, jest.fn());
        await connection.connect();
        await connection.toggleVoice();
        expect(connection.snapshot.voiceState).toBe("off");
        expect(failed.leave).toHaveBeenCalledTimes(1);
        expect(media).not.toHaveBeenCalled();

        const replacement = {
            ...failed,
            on: jest.fn(),
            init: jest.fn().mockResolvedValue(undefined),
            publish: jest.fn(),
            leave: jest.fn(),
        };
        (WebRTCClient as unknown as jest.Mock).mockImplementation(
            () => replacement
        );
        const track = { stop: jest.fn(), addEventListener: jest.fn() };
        const stream = {
            getTracks: () => [track],
            getAudioTracks: () => [track],
        };
        media.mockResolvedValue(stream);
        await connection.toggleVoice();
        expect(replacement.init).toHaveBeenCalledTimes(1);
        expect(replacement.publish).toHaveBeenCalledWith(stream, "mic");
        expect(failed.publish).not.toHaveBeenCalled();
        expect(connection.snapshot.voiceState).toBe("live");
    });

    test("late unpublish and playback failures cannot remove or mark a replacement audio stream", async () => {
        const audios: any[] = [];
        let rejectFirstPlay: (reason: Error) => void;
        const firstPlay = new Promise<void>((_, reject) => {
            rejectFirstPlay = reject;
        });
        jest.spyOn(window, "Audio").mockImplementation(() => {
            const audio = {
                play: jest
                    .fn()
                    .mockReturnValue(
                        audios.length ? Promise.resolve() : firstPlay
                    ),
                pause: jest.fn(),
                srcObject: null,
                volume: 1,
            };
            audios.push(audio);
            return audio as any;
        });
        media.mockRejectedValue({ name: "NotAllowedError" });
        const connection = createConnection(identity, jest.fn());
        await connection.connect();
        await connection.toggleVoice();
        const published = voice.on.mock.calls.find(
            ([event]) => event === "user-published"
        )[1];
        const unpublished = voice.on.mock.calls.find(
            ([event]) => event === "user-unpublished"
        )[1];
        const oldStream = {} as MediaStream;
        const newStream = {} as MediaStream;
        published({ uid: "peer" }, oldStream, "mic");
        published({ uid: "peer" }, newStream, "mic");
        expect(audios[0].pause).toHaveBeenCalledTimes(1);
        expect(audios[1].srcObject).toBe(newStream);
        const errorBefore = connection.snapshot.voiceError;

        unpublished({ uid: "peer" }, oldStream);
        rejectFirstPlay(new Error("stale playback"));
        await flush();
        expect(audios[1].pause).not.toHaveBeenCalled();
        expect(audios[1].srcObject).toBe(newStream);
        expect(connection.snapshot.voiceError).toBe(errorBefore);
        unpublished({ uid: "peer" }, newStream);
        expect(audios[1].pause).toHaveBeenCalledTimes(1);
        expect(audios[1].srcObject).toBeNull();
    });
    test("initializes native avatar and scale without treating movement as an emote", async () => {
        const vrmUrl = "https://assets.example/avatar.glb";
        const connection = createConnection(
            { ...identity, vrmUrl, scale: 1.25 },
            jest.fn()
        );
        connection.updatePosition({
            x: 2,
            y: 0,
            z: 3,
            rotation: 1,
            moving: true,
            floor: false,
        });
        await connection.connect();
        const request = JSON.parse((fetch as jest.Mock).mock.calls[0][1].body);
        expect(request.VRM).toBe(vrmUrl);
        expect(room.send).toHaveBeenCalledWith("init", [
            2,
            0,
            3,
            1,
            1.25,
            LOBBY_ROOM,
            identity.userId,
            LOBBY_GUEST_PORTRAIT,
            "Guest%20A",
            2.8,
            false,
            -1,
            false,
            vrmUrl,
        ]);
        expect(room.send).toHaveBeenCalledWith("move", [2, 0, 3, 1, -1, false]);
        await connection.close();
    });

    test("replicates native emotes, avatar switches and scale without reconnecting", async () => {
        const connection = createConnection(identity, jest.fn());
        await connection.connect();
        jest.useFakeTimers();
        room.send.mockClear();
        connection.updateAvatar({
            vrmUrl: "https://assets.example/selected.glb",
            scale: 1.4,
        });
        connection.updateAvatar({
            vrmUrl: "https://assets.example/selected.glb",
            scale: 1.4,
        });
        connection.updatePosition({
            x: 1,
            y: 0,
            z: 2,
            rotation: 0,
            animation: 0,
            floor: true,
        });
        jest.advanceTimersByTime(100);
        expect(room.send.mock.calls).toEqual([
            ["VRM", "https://assets.example/selected.glb"],
            ["scale", 1.4],
            ["move", [1, 0, 2, 0, 0, true]],
        ]);
        expect(consume).toHaveBeenCalledTimes(1);
        await connection.close();
    });

    test("reads remote native avatar, animation and scale changes and normalizes malformed data", async () => {
        const connection = createConnection(identity, jest.fn());
        await connection.connect();
        const peer = room.state.players.get("peer");
        Object.assign(peer, {
            VRM: "https://assets.example/peer.glb",
            scale: 1.3,
            animation: 5,
            floor: false,
        });
        room.patch();
        expect(
            connection.snapshot.players.find((it) => it.id === "peer")
        ).toMatchObject({
            vrmUrl: "https://assets.example/peer.glb",
            scale: 1.3,
            animation: 5,
            floor: false,
        });
        Object.assign(peer, {
            VRM: "javascript:alert(1)",
            scale: NaN,
            animation: NaN,
            positionX: Infinity,
        });
        room.patch();
        expect(
            connection.snapshot.players.find((it) => it.id === "peer")
        ).toMatchObject({ vrmUrl: "", scale: 1, animation: -1, x: 0 });
        await connection.close();
    });

    test("message IDs keep advancing after the bounded chat log fills", async () => {
        const connection = createConnection(identity, jest.fn());
        await connection.connect();
        for (let index = 0; index < 64; index++) {
            room.deliver("chat-channel", {
                from: "peer",
                server_ts: 123,
                data: { type: "MESSAGE", text: `message ${index}` },
            });
        }
        expect(connection.snapshot.messages).toHaveLength(60);
        expect(
            new Set(connection.snapshot.messages.map((it) => it.id)).size
        ).toBe(60);
        expect(connection.snapshot.messages[59].text).toBe("message 63");
        await connection.close();
    });

    test("concurrent exit callers await the same room leave", async () => {
        const left = deferred<void>();
        room.leave.mockReturnValue(left.promise);
        const connection = createConnection(identity, jest.fn());
        await connection.connect();
        const first = connection.close();
        const second = connection.close();
        expect(second).toBe(first);
        expect(room.leave).toHaveBeenCalledTimes(1);
        left.resolve();
        await Promise.all([first, second]);
    });
    const useV1 = (flash = false) => {
        (fetch as jest.Mock).mockResolvedValue({
            ok: true,
            json: async () => ({
                success: true,
                lobbyProtocol: 1,
                reservation: {},
            }),
        });
        const original = room.send;
        room.send.mockImplementation((type, body) => {
            if (type === "lobby-ready")
                room.deliver("lobby-welcome", {
                    lobbyProtocol: 1,
                    flash,
                    region: "local",
                    position: [2, 0, 0, 0],
                });
        });
        return original;
    };

    test.each([false, true])(
        "signed-in lobby uses a scoped proof and keeps joining if proof lookup times out (%s)",
        async (timeout) => {
            jest.useFakeTimers();
            useV1();
            jest.spyOn(endpoints, "selectLobbyEndpoint").mockResolvedValue({
                id: "verified",
                protocol: 1,
                httpUrl: "https://lobby.example",
                wsUrl: "wss://lobby.example",
            });
            const joinResponse = {
                ok: true,
                json: async () => ({
                    success: true,
                    lobbyProtocol: 1,
                    reservation: {},
                }),
            };
            (fetch as jest.Mock).mockImplementation((url, options) => {
                if (url === "/api/social/lobby-identity")
                    return timeout
                        ? new Promise((_resolve, reject) =>
                              options.signal.addEventListener("abort", () =>
                                  reject(new Error("aborted"))
                              )
                          )
                        : Promise.resolve({
                              ok: true,
                              json: async () => ({
                                  token: "signed-scoped-proof",
                              }),
                          });
                return Promise.resolve(joinResponse);
            });
            const connection = createConnection(
                {
                    ...identity,
                    userId: "account-user",
                    token: "private-account-token",
                },
                jest.fn()
            );
            const connected = connection.connect();
            await flush();
            if (timeout) {
                jest.advanceTimersByTime(2001);
                await flush();
            }
            await connected;
            const request = (fetch as jest.Mock).mock.calls.find(
                ([url]) => url === "https://lobby.example/join"
            )[1];
            expect(JSON.parse(request.body)).toMatchObject({ token: "" });
            expect(JSON.parse(request.body).lobbyIdentityToken).toBe(
                timeout ? undefined : "signed-scoped-proof"
            );
            expect(request.body).not.toContain("private-account-token");
            expect(connection.snapshot.status).toBe("connected");
        }
    );

    test("v1 binds ready handshake, authoritative spawn and metadata without React motion traffic", async () => {
        jest.useFakeTimers();
        useV1();
        const changed = jest.fn();
        const connection = createConnection(identity, changed);
        await connection.connect();
        expect(
            JSON.parse((fetch as jest.Mock).mock.calls[0][1].body)
        ).toMatchObject({ lobbyProtocol: 1 });
        expect(
            JSON.parse((fetch as jest.Mock).mock.calls[0][1].body).region
        ).toBeUndefined();
        expect(room.send).toHaveBeenCalledWith("lobby-move", [
            1,
            2,
            0,
            0,
            0,
            -1,
            true,
        ]);
        expect(room.send).not.toHaveBeenCalledWith("init", expect.anything());
        expect(connection.consumeCorrection()).toMatchObject({
            x: 2,
            z: -4,
            hardSnap: true,
        });
        room.deliver("lobby-roster", {
            enter: [
                {
                    sessionId: "peer",
                    username: "Verified%20name",
                    partyIdentity: "B".repeat(43),
                    avatar: "",
                    VRM: "/avatar.vrm",
                    scale: 1.2,
                },
            ],
            leave: [],
            population: 800,
        });
        expect(connection.snapshot.population).toBe(800);
        expect(
            connection.snapshot.players.find((player) => player.id === "peer")
                .partyIdentity
        ).toBe("B".repeat(43));
        changed.mockClear();
        room.deliver("lobby-snapshot", {
            tick: 1,
            serverTime: 1000,
            poses: [["peer", 100, 0, 200, 1500, -1, 1]],
        });
        room.deliver("lobby-snapshot", {
            tick: 2,
            serverTime: 1050,
            poses: [["peer", 120, 0, 200, 1500, 0, 1]],
        });
        expect(changed).not.toHaveBeenCalled();
        expect(
            connection.sampleParticipants(performance.now() + 200)[0]
        ).toMatchObject({
            id: "peer",
            name: "Verified name",
            vrmUrl: "/avatar.vrm",
            scale: 1.2,
            animation: 0,
        });
        connection.updateAvatar({ vrmUrl: "/other.vrm", scale: 1.5 });
        expect(room.send).toHaveBeenCalledWith("lobby-profile", {
            VRM: "/other.vrm",
            scale: 1.5,
        });
        room.deliver("lobby-roster", {
            enter: [],
            leave: ["peer"],
            population: 799,
        });
        expect(connection.sampleParticipants()).toEqual([]);
        expect(connection.snapshot.population).toBe(799);
        await connection.close();
    });

    test("v1 movement acknowledges without replacing subsequent immediate movement", async () => {
        jest.useFakeTimers();
        useV1();
        const connection = createConnection(identity, jest.fn());
        await connection.connect();
        connection.consumeCorrection();
        connection.updatePosition({ x: 4, y: 0, z: 0, rotation: 0 });
        jest.advanceTimersByTime(50);
        connection.updatePosition({ x: 5, y: 0, z: 0, rotation: 0 });
        room.deliver("lobby-ack", {
            seq: 2,
            serverTime: 1000,
            position: [3, 0, 0, 0],
            corrected: true,
        });
        expect(connection.getPredictedPose().x).toBe(4);
        expect(connection.consumeCorrection()).toMatchObject({
            x: -1,
            hardSnap: false,
        });
        jest.advanceTimersByTime(50);
        expect(room.send).toHaveBeenCalledWith("lobby-move", [
            3,
            4,
            0,
            0,
            0,
            -1,
            true,
        ]);
        const ping = room.send.mock.calls.find(
            ([type]) => type === "lobby-ping"
        )[1];
        room.deliver("lobby-pong", { ...ping, serverTime: 1050 });
        expect(connection.getNetworkDiagnostics()).toMatchObject({
            protocol: "v1",
            region: "local",
            corrections: 2,
            rttMs: 100,
        });
        await connection.close();
    });

    test("retries a dropped room with fresh identity state and never reopens microphone", async () => {
        jest.useFakeTimers();
        const connection = createConnection(identity, jest.fn());
        await connection.connect();
        room.disconnect();
        await flush();
        expect(connection.snapshot.status).toBe("offline");
        jest.advanceTimersByTime(1000);
        await flush();
        expect(consume).toHaveBeenCalledTimes(2);
        expect(connection.snapshot.status).toBe("connected");
        expect(media).not.toHaveBeenCalled();
        room.disconnect();
        await flush();
        await connection.close();
        jest.advanceTimersByTime(60000);
        await flush();
        expect(consume).toHaveBeenCalledTimes(2);
    });

    test("pauses retry while hidden or offline and resumes only when available", async () => {
        jest.useFakeTimers();
        const connection = createConnection(identity, jest.fn());
        await connection.connect();
        room.disconnect();
        await flush();
        Object.defineProperty(document, "hidden", {
            configurable: true,
            value: true,
        });
        document.dispatchEvent(new Event("visibilitychange"));
        jest.advanceTimersByTime(60000);
        await flush();
        expect(consume).toHaveBeenCalledTimes(1);
        Object.defineProperty(document, "hidden", {
            configurable: true,
            value: false,
        });
        Object.defineProperty(navigator, "onLine", {
            configurable: true,
            value: false,
        });
        document.dispatchEvent(new Event("visibilitychange"));
        jest.advanceTimersByTime(60000);
        await flush();
        expect(consume).toHaveBeenCalledTimes(1);
        Object.defineProperty(navigator, "onLine", {
            configurable: true,
            value: true,
        });
        window.dispatchEvent(new Event("online"));
        jest.advanceTimersByTime(1000);
        await flush();
        expect(consume).toHaveBeenCalledTimes(2);
        await connection.close();
    });

    test("a microphone permission result from the previous connection cannot publish into its replacement", async () => {
        jest.useFakeTimers();
        const permission = deferred<MediaStream>();
        media.mockReturnValue(permission.promise);
        const connection = createConnection(identity, jest.fn());
        await connection.connect();
        const enabling = connection.toggleVoice();
        await flush();
        room.disconnect();
        await flush();
        jest.advanceTimersByTime(1000);
        await flush();
        const track = { stop: jest.fn() };
        permission.resolve({ getTracks: () => [track] } as any);
        await enabling;
        expect(track.stop).toHaveBeenCalledTimes(1);
        expect(voice.publish).not.toHaveBeenCalled();
        expect(connection.snapshot.voiceState).toBe("off");
        await connection.close();
    });

    test("legacy pose-only patches stay off React while roster and profile changes publish", async () => {
        const changed = jest.fn();
        const connection = createConnection(identity, changed);
        await connection.connect();
        changed.mockClear();
        room.state.players.get("peer").positionX = 4;
        room.patch();
        expect(changed).not.toHaveBeenCalled();
        room.state.players.get("peer").username = "Changed";
        room.patch();
        expect(changed).toHaveBeenCalledTimes(1);
        await connection.close();
    });

    test("v2 keeps shared-world chunks, prediction, chat and profile updates on the existing lobby API", async () => {
        jest.useFakeTimers();
        jest.spyOn(endpoints, "selectLobbyEndpoint").mockResolvedValue({
            id: "local",
            httpUrl: "http://127.0.0.1:2580",
            wsUrl: "ws://127.0.0.1:2581",
            protocol: 2,
        });
        (fetch as jest.Mock).mockResolvedValue({
            ok: true,
            json: async () => ({
                lobbyProtocol: 2,
                sessionId: "42",
                token: "ticket",
                roomId: "shared",
                region: "local",
                wsUrl: "ws://127.0.0.1:2581",
            }),
        });
        room.sessionId = "42";
        room.roomId = "shared";
        room.region = "local";
        room.transport = "webtransport";
        room.diagnostics = () => ({
            transport: "webtransport",
            sentDatagrams: 1,
        });
        const nativeConnect = jest
            .spyOn(WorldLobbyTransport, "connect")
            .mockResolvedValue(room);
        room.send.mockImplementation((type) => {
            if (type === "lobby-ready")
                room.deliver("lobby-welcome", {
                    lobbyProtocol: 2,
                    epoch: 9,
                    roomId: "shared",
                    region: "local",
                    position: [2, 0, 0, 0],
                    snapshotRates: { near: 20, mid: 5, far: 2 },
                    snapshotBands: [16, 48, 128],
                });
        });
        const changed = jest.fn();
        const connection = createConnection(identity, changed);
        await connection.connect();
        expect(connection.snapshot).toMatchObject({
            status: "connected",
            protocol: "v2",
            sessionId: "42",
            roomId: "shared",
        });
        expect(consume).not.toHaveBeenCalled();
        expect(
            JSON.parse((fetch as jest.Mock).mock.calls[0][1].body).lobbyProtocol
        ).toBe(2);
        expect(nativeConnect).toHaveBeenCalledTimes(1);
        room.deliver("lobby-roster", {
            enter: [
                { sessionId: "7", username: "Peer A" },
                { sessionId: "8", username: "Peer B" },
            ],
            leave: [],
            population: 10000,
        });
        changed.mockClear();
        room.deliver("lobby-snapshot-v2", {
            epoch: 9,
            tick: 10,
            serverTime: 500,
            poses: [[7, 10, 3, 0, 1, 0, -1, 1]],
        });
        room.deliver("lobby-snapshot-v2", {
            epoch: 9,
            tick: 10,
            serverTime: 500,
            poses: [[8, 10, 4, 0, 1, 0, -1, 1]],
        });
        room.deliver("lobby-snapshot-v2", {
            epoch: 8,
            tick: 11,
            serverTime: 550,
            poses: [[7, 11, 100, 0, 1, 0, -1, 1]],
        });
        expect(changed).not.toHaveBeenCalled();
        expect(
            connection.sampleParticipants().map((value) => [value.id, value.x])
        ).toEqual([
            ["7", 3],
            ["8", 4],
        ]);
        expect(connection.getNetworkDiagnostics()).toMatchObject({
            protocol: "v2",
            transport: "webtransport",
            population: 10000,
            snapshotRates: { near: 20, mid: 5, far: 2 },
        });
        const predictionBeforeBudget = connection.getPredictedPose();
        room.deliver("lobby-config", {
            aoiLimit: 64,
            snapshotRates: { near: 20, mid: 5, far: 2 },
            snapshotBands: [8, 32, 64],
        });
        expect(connection.getNetworkDiagnostics()).toMatchObject({
            networkAoiLimit: 64,
            snapshotBands: [8, 32, 64],
            population: 10000,
        });
        expect(connection.getPredictedPose()).toEqual(predictionBeforeBudget);
        expect(
            connection.sampleParticipants().map((value) => value.id)
        ).toEqual(["7", "8"]);
        room.deliver("lobby-roster", {
            enter: [],
            leave: ["8"],
            population: 10000,
        });
        expect(
            connection.sampleParticipants().map((value) => value.id)
        ).toEqual(["7"]);
        room.deliver("lobby-config", {
            aoiLimit: 128,
            snapshotRates: { near: 20, mid: 5, far: 2 },
            snapshotBands: [16, 48, 128],
        });
        expect(connection.getNetworkDiagnostics()).toMatchObject({
            networkAoiLimit: 128,
            snapshotBands: [16, 48, 128],
            population: 10000,
        });
        room.deliver("lobby-config", {
            aoiLimit: 4,
            snapshotRates: { near: Infinity, mid: 5, far: 2 },
            snapshotBands: [8, 32, 64],
        });
        expect(connection.getNetworkDiagnostics().networkAoiLimit).toBe(128);
        connection.consumeCorrection();
        connection.updatePosition({ x: 3, y: 0, z: 0, rotation: 0 });
        jest.advanceTimersByTime(50);
        connection.updatePosition({ x: 4, y: 0, z: 0, rotation: 0 });
        room.deliver("lobby-ack", { seq: 2, position: [2.5, 0, 0, 0] });
        expect(connection.getPredictedPose().x).toBe(3.5);
        connection.updateAvatar({ vrmUrl: "/chosen.vrm", scale: 1.2 });
        expect(room.send).toHaveBeenCalledWith("lobby-profile", {
            VRM: "/chosen.vrm",
            scale: 1.2,
        });
        expect(connection.sendMessage("Hello world")).toBe(true);
        expect(room.send).toHaveBeenCalledWith(
            "chat-channel",
            expect.objectContaining({ text: "Hello world" })
        );
        await connection.close();
        expect(room.leave).toHaveBeenCalledTimes(1);
    });

    test("native scope cannot be supplied as an arbitrary room name", () => {
        expect(() =>
            createConnection(identity, jest.fn(), {
                nativeSpace: "oncyber-lobby-v1" as any,
            })
        ).toThrow("Unsupported native social space");
    });

    test("failed reconnections stop after a bounded eight attempts", async () => {
        jest.useFakeTimers();
        (fetch as jest.Mock).mockRejectedValue(new Error("offline"));
        const connection = createConnection(identity, jest.fn());
        await connection.connect();
        for (let attempt = 0; attempt < 8; attempt++) {
            jest.advanceTimersByTime(40000);
            await flush();
        }
        expect(fetch).toHaveBeenCalledTimes(9);
        jest.advanceTimersByTime(300000);
        await flush();
        expect(fetch).toHaveBeenCalledTimes(9);
        expect(connection.snapshot).toMatchObject({
            status: "offline",
            error: "You’re exploring solo. Reconnect to join everyone.",
        });
        await connection.close();
    });
    test("drops right after admission keep backing off instead of looping", async () => {
        jest.useFakeTimers();
        const connection = createConnection(identity, jest.fn());
        await connection.connect();
        const waited: number[] = [];
        for (let drop = 0; drop < 8; drop++) {
            room.disconnect();
            await flush();
            const before = consume.mock.calls.length;
            let elapsed = 0;
            while (consume.mock.calls.length === before && elapsed < 60000) {
                jest.advanceTimersByTime(100);
                elapsed += 100;
                await flush();
            }
            waited.push(elapsed);
        }
        expect(waited[7]).toBeGreaterThan(waited[0] * 20);
        room.disconnect();
        await flush();
        jest.advanceTimersByTime(300000);
        await flush();
        expect(consume).toHaveBeenCalledTimes(9);
        expect(connection.snapshot).toMatchObject({
            status: "offline",
            error: "You’re exploring solo. Reconnect to join everyone.",
        });
    });

    test("a seat taken from another tab stops reconnecting and keeps its explanation", async () => {
        jest.useFakeTimers();
        const connection = createConnection(identity, jest.fn());
        await connection.connect();
        // The legacy room drops the older socket without a close code.
        room.disconnect(1005);
        await flush();
        jest.advanceTimersByTime(300000);
        await flush();
        expect(consume).toHaveBeenCalledTimes(1);
        const replaced = {
            status: "offline",
            stopped: "replaced",
            error: "You joined the lobby somewhere else. Reconnect to play here.",
        };
        expect(connection.snapshot).toMatchObject(replaced);
        // Returning to the tab or the network must not trade the seat back.
        window.dispatchEvent(new Event("online"));
        document.dispatchEvent(new Event("visibilitychange"));
        jest.advanceTimersByTime(300000);
        await flush();
        expect(consume).toHaveBeenCalledTimes(1);
        expect(connection.snapshot).toMatchObject(replaced);
    });
    test("a visitor removed from the lobby is not reconnected", async () => {
        jest.useFakeTimers();
        const connection = createConnection(identity, jest.fn());
        await connection.connect();
        room.deliver("kick", {});
        await flush();
        window.dispatchEvent(new Event("online"));
        jest.advanceTimersByTime(300000);
        await flush();
        expect(consume).toHaveBeenCalledTimes(1);
        // They are told they are on their own, without an invitation back.
        expect(connection.snapshot).toMatchObject({
            status: "offline",
            stopped: "removed",
            error: "You’re exploring solo.",
        });
    });

    test("a session that held for a while reconnects with a fresh backoff", async () => {
        jest.useFakeTimers();
        const connection = createConnection(identity, jest.fn());
        await connection.connect();
        for (let drop = 0; drop < 12; drop++) {
            jest.advanceTimersByTime(31000);
            room.disconnect();
            await flush();
            expect(connection.snapshot.error).toBe(
                "Connection lost. Reconnecting to everyone…"
            );
            jest.advanceTimersByTime(1000);
            await flush();
            expect(connection.snapshot.status).toBe("connected");
        }
        expect(consume).toHaveBeenCalledTimes(13);
    });

    test("a world reconnect names the seat it held, and asks for a plain seat once the server refuses", async () => {
        jest.useFakeTimers();
        jest.spyOn(endpoints, "selectLobbyEndpoint").mockResolvedValue({
            id: "local",
            httpUrl: "http://127.0.0.1:2580",
            wsUrl: "ws://127.0.0.1:2581",
            protocol: 2,
        });
        let tickets = 0;
        let refuse = false;
        (fetch as jest.Mock).mockImplementation(async () => ({
            ok: !refuse,
            json: async () => ({
                lobbyProtocol: 2,
                sessionId: String(40 + ++tickets),
                token: `ticket-${tickets}`,
                roomId: "shared",
                region: "local",
                wsUrl: "ws://127.0.0.1:2581",
            }),
        }));
        jest.spyOn(WorldLobbyTransport, "connect").mockResolvedValue(room);
        room.send.mockImplementation((type) => {
            if (type === "lobby-ready")
                room.deliver("lobby-welcome", {
                    lobbyProtocol: 2,
                    epoch: 9,
                    roomId: "shared",
                    region: "local",
                    position: [2, 0, 0, 0],
                    snapshotRates: { near: 20, mid: 5, far: 2 },
                    snapshotBands: [16, 48, 128],
                });
        });
        const named = () =>
            (fetch as jest.Mock).mock.calls
                .filter(([url]) => String(url).endsWith("/join"))
                .map(([, init]) => JSON.parse(init.body).replaceToken);
        // Time passes in small steps so a reconnect in flight is never
        // overtaken by its own timeout.
        const pass = async (ms: number) => {
            for (let elapsed = 0; elapsed < ms; elapsed += 250) {
                jest.advanceTimersByTime(250);
                await flush();
            }
        };
        const drop = async () => {
            // A session that held earns the shortest backoff again.
            await pass(31000);
            room.disconnect();
            await flush();
            await pass(1000);
        };
        const connection = createConnection(identity, jest.fn());
        await connection.connect();
        // The first seat replaces nothing.
        expect(named()).toEqual([undefined]);

        // The server keeps a traveller's place for whoever names their seat.
        await drop();
        expect(connection.snapshot.status).toBe("connected");
        expect(named()).toEqual([undefined, "ticket-1"]);
        await drop();
        expect(named().at(-1)).toBe("ticket-2");

        // A refusal is not repeated: one stuck seat cannot keep them out.
        refuse = true;
        await drop();
        expect(named().at(-1)).toBe("ticket-3");
        expect(connection.snapshot.status).not.toBe("connected");
        refuse = false;
        await pass(3000);
        expect(named().at(-1)).toBeUndefined();
        expect(connection.snapshot.status).toBe("connected");
        await connection.close();
    });

    test("a legacy seat taken by the same account elsewhere stops instead of evicting it back", async () => {
        jest.useFakeTimers();
        const connection = createConnection(identity, jest.fn());
        await connection.connect();
        room.disconnect(1005);
        await flush();
        jest.advanceTimersByTime(300000);
        await flush();
        expect(consume).toHaveBeenCalledTimes(1);
        expect(connection.snapshot).toMatchObject({
            status: "offline",
            error: "You joined the lobby somewhere else. Reconnect to play here.",
        });
    });
    const artwork = {
        id: "eth:art:1",
        title: "Blue study",
        imageUrl: "https://example.com/1.png",
        aspect: 1.5,
        nonce: "show-1",
        startedAt: 100,
    };
    test("queues a prepared Flash until welcome and suppresses repeated starts and stops", async () => {
        useV1(true);
        const connection = createConnection(identity, jest.fn());
        expect(connection.setFlash(artwork)).toBe(false);
        await connection.connect();
        expect(connection.snapshot.flashSupported).toBe(true);
        expect(
            room.send.mock.calls.filter(([type]) => type === "lobby-flash")
        ).toEqual([["lobby-flash", { flash: artwork }]]);
        connection.updatePosition(connection.getPredictedPose()); // Welcome changed the spawn.
        connection.setFlash(artwork);
        connection.setFlash(null);
        connection.setFlash(null);
        expect(
            room.send.mock.calls.filter(([type]) => type === "lobby-flash")
        ).toEqual([
            ["lobby-flash", { flash: artwork }],
            ["lobby-flash", { flash: null }],
        ]);
        expect(
            connection.setFlash({ ...artwork, imageUrl: "javascript:alert(1)" })
        ).toBe(false);
    });
    test.each(["legacy", "older-v1"])(
        "reports unsupported Flash on %s without sending an unknown control",
        async (protocol) => {
            if (protocol === "older-v1") useV1();
            const connection = createConnection(identity, jest.fn());
            await connection.connect();
            expect(connection.setFlash(artwork)).toBe(false);
            expect(connection.snapshot.flashSupported).toBe(false);
            expect(
                room.send.mock.calls.some(([type]) => type === "lobby-flash")
            ).toBe(false);
        }
    );
    test("updates both roster and imperative samples from validated Flash controls and late-join profiles", async () => {
        useV1(true);
        const connection = createConnection(identity, jest.fn());
        await connection.connect();
        room.deliver("lobby-roster", {
            enter: [{ sessionId: "peer", username: "Peer", flash: artwork }],
            leave: [],
            population: 2,
        });
        expect(
            connection.snapshot.players.find((p) => p.id === "peer").flash
        ).toEqual(artwork);
        room.deliver("lobby-snapshot", {
            tick: 1,
            serverTime: Date.now(),
            poses: [["peer", 0, 0, 0, 0, -1, 1]],
        });
        const samples = connection.sampleParticipants();
        room.deliver("lobby-flash", {
            sessionId: "peer",
            flash: { ...artwork, nonce: "show-2", startedAt: 300 },
        });
        expect(samples.find((p) => p.id === "peer").flash.nonce).toBe("show-2");
        room.deliver("lobby-flash", {
            sessionId: "peer",
            flash: { ...artwork, imageUrl: "data:text/html,bad" },
        });
        expect(
            connection.snapshot.players.find((p) => p.id === "peer").flash.nonce
        ).toBe("show-2");
        room.deliver("lobby-flash", { sessionId: "unseen", flash: artwork });
        expect(connection.snapshot.players.some((p) => p.id === "unseen")).toBe(
            false
        );
        room.deliver("lobby-flash", { sessionId: "peer", flash: null });
        expect(samples.find((p) => p.id === "peer").flash).toBeNull();
        room.deliver("lobby-roster", {
            enter: [
                {
                    sessionId: "peer",
                    username: "Peer",
                    flash: { ...artwork, nonce: "latest" },
                },
            ],
            leave: [],
            population: 2,
        });
        expect(samples.find((p) => p.id === "peer").flash.nonce).toBe("latest");
        room.deliver("lobby-roster", {
            enter: [],
            leave: ["peer"],
            population: 1,
        });
        expect(
            connection.sampleParticipants().some((p) => p.id === "peer")
        ).toBe(false);
    });
    test("movement, departure and close clear Flash immediately", async () => {
        useV1(true);
        const connection = createConnection(identity, jest.fn());
        await connection.connect();
        connection.setFlash(artwork);
        connection.updatePosition({
            ...connection.getPredictedPose(),
            moving: true,
        });
        expect(room.send).toHaveBeenLastCalledWith("lobby-flash", {
            flash: null,
        });
        connection.setFlash({ ...artwork, nonce: "second" });
        connection.setLobbyPresence(false);
        expect(room.send).toHaveBeenLastCalledWith("lobby-flash", {
            flash: null,
        });
        expect(connection.setFlash(artwork)).toBe(false);
        connection.setLobbyPresence(true);
        connection.setFlash({ ...artwork, nonce: "third" });
        await connection.close();
        expect(room.send).toHaveBeenLastCalledWith("lobby-flash", {
            flash: null,
        });
        expect(connection.setFlash(artwork)).toBe(false);
    });
    test("retains desired Flash across connection replacement but never revives an explicit stop", async () => {
        useV1(true);
        const connection = createConnection(identity, jest.fn());
        await connection.connect();
        connection.setFlash(artwork);
        // Exercise the same release/rejoin path used after transport loss.
        await (connection as any).releaseRoom();
        await connection.connect();
        expect(
            room.send.mock.calls.filter(
                ([type, data]) => type === "lobby-flash" && data.flash
            )
        ).toHaveLength(2);
        connection.setFlash(null);
        await (connection as any).releaseRoom();
        await connection.connect();
        expect(
            room.send.mock.calls.filter(
                ([type, data]) => type === "lobby-flash" && data.flash
            )
        ).toHaveLength(2);
    });
});
