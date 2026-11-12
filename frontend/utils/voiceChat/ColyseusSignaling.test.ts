import { ColyseusSignaling } from "./ColyseusSignaling";

// Minimal colyseus.js Room stub.
function makeRoom(sessionId: string, playerIds: string[] = []) {
    const handlers: Record<string, (msg: any) => void> = {};
    const stateCb: { fn: ((s: any) => void) | null } = { fn: null };

    const onStateChange: any = (fn: any) => {
        stateCb.fn = fn;
    };
    onStateChange.once = (fn: any) => {
        stateCb.fn = fn;
    };

    const room: any = {
        sessionId,
        state: { players: new Map(playerIds.map((id) => [id, {}])) },
        sent: [] as Array<{ type: string; payload?: any }>,
        leave: jest.fn(),
        onStateChange,
        onMessage(type: string, cb: (msg: any) => void) {
            handlers[type] = cb;
            return () => {
                if (handlers[type] === cb) delete handlers[type];
            };
        },
        send(type: string, payload?: any) {
            this.sent.push({ type, payload });
        },
        // drivers
        _deliver(type: string, msg: any) {
            handlers[type]?.(msg);
        },
        _fireState() {
            stateCb.fn?.({});
        },
        _has(type: string) {
            return !!handlers[type];
        },
        _handler(type: string) {
            return handlers[type];
        },
    };

    return room;
}

function makeHandlers() {
    return {
        onSignal: jest.fn(),
        onPeerJoin: jest.fn(),
        onPeerLeave: jest.fn(),
    };
}

describe("ColyseusSignaling", () => {
    test("sends rtc-ready on start, with handlers already registered", () => {
        const room = makeRoom("me", ["A"]);
        const sig = new ColyseusSignaling(room);

        sig.start(makeHandlers());

        // rtc-ready was sent...
        expect(room.sent).toEqual([{ type: "rtc-ready", payload: undefined }]);
        // ...and the inbound handlers exist (so a bounced-back offer is caught)
        expect(room._has("rtc-signal")).toBe(true);
        expect(room._has("rtc-join")).toBe(true);
        expect(room._has("rtc-leave")).toBe(true);
    });

    test("send() puts {to, payload} on the wire under rtc-signal", () => {
        const room = makeRoom("me");
        const sig = new ColyseusSignaling(room);
        sig.start(makeHandlers());

        sig.send("B", { kind: "offer" } as any);

        expect(room.sent).toContainEqual({
            type: "rtc-signal",
            payload: { to: "B", payload: { kind: "offer" } },
        });
    });

    test("filters our own sessionId on inbound events", () => {
        const room = makeRoom("me");
        const sig = new ColyseusSignaling(room);
        const h = makeHandlers();
        sig.start(h);

        room._deliver("rtc-join", { sessionId: "me" });
        room._deliver("rtc-signal", { from: "me", payload: { kind: "offer" } });
        room._deliver("rtc-leave", { sessionId: "me" });

        expect(h.onPeerJoin).not.toHaveBeenCalled();
        expect(h.onSignal).not.toHaveBeenCalled();
        expect(h.onPeerLeave).not.toHaveBeenCalled();

        room._deliver("rtc-join", { sessionId: "B" });
        room._deliver("rtc-signal", { from: "B", payload: { kind: "offer" } });
        expect(h.onPeerJoin).toHaveBeenCalledWith("B");
        expect(h.onSignal).toHaveBeenCalledWith("B", { kind: "offer" });
    });

    test("initialPeers excludes self", () => {
        const room = makeRoom("me", ["me", "A", "B"]);
        const sig = new ColyseusSignaling(room);
        expect(sig.initialPeers().sort()).toEqual(["A", "B"]);
    });

    test("replays the roster on first state when it started empty", () => {
        const room = makeRoom("me", []); // empty at start
        const sig = new ColyseusSignaling(room);
        const h = makeHandlers();
        sig.start(h);

        expect(h.onPeerJoin).not.toHaveBeenCalled();

        // state lands with peers
        room.state.players.set("A", {});
        room.state.players.set("me", {});
        room._fireState();

        expect(h.onPeerJoin).toHaveBeenCalledWith("A");
        expect(h.onPeerJoin).not.toHaveBeenCalledWith("me");
    });

    test("dispose unsubscribes and never leaves the room", () => {
        const room = makeRoom("me");
        const sig = new ColyseusSignaling(room);
        const h = makeHandlers();
        sig.start(h);

        sig.dispose();

        expect(room.leave).not.toHaveBeenCalled();
        expect(room._has("rtc-signal")).toBe(false);

        // a late delivery after dispose does nothing
        room._deliver("rtc-join", { sessionId: "B" });
        expect(h.onPeerJoin).not.toHaveBeenCalled();
    });

    test("a disposed transport cannot send, restart or deliver queued callbacks", () => {
        const room = makeRoom("me");
        const sig = new ColyseusSignaling(room);
        const h = makeHandlers();
        sig.start(h);
        const queuedSignal = room._handler("rtc-signal");
        const queuedJoin = room._handler("rtc-join");
        const queuedLeave = room._handler("rtc-leave");
        sig.dispose();
        const replacement = makeHandlers();
        sig.start(replacement);
        sig.send("B", { kind: "candidate", candidate: {} });
        queuedSignal({ from: "B", payload: { kind: "candidate" } });
        queuedJoin({ sessionId: "B" });
        queuedLeave({ sessionId: "B" });
        room.state.players.set("B", {});
        room._fireState();

        expect(room.sent).toEqual([{ type: "rtc-ready", payload: undefined }]);
        expect(sig.initialPeers()).toEqual([]);
        expect(h.onSignal).not.toHaveBeenCalled();
        expect(h.onPeerJoin).not.toHaveBeenCalled();
        expect(h.onPeerLeave).not.toHaveBeenCalled();
        expect(replacement.onPeerJoin).not.toHaveBeenCalled();
        expect(room.leave).not.toHaveBeenCalled();
    });

    test("starting twice does not announce twice or replace the original callbacks", () => {
        const room = makeRoom("me");
        const sig = new ColyseusSignaling(room);
        const first = makeHandlers();
        const second = makeHandlers();
        sig.start(first);
        sig.start(second);
        room._deliver("rtc-join", { sessionId: "B" });
        expect(first.onPeerJoin).toHaveBeenCalledWith("B");
        expect(second.onPeerJoin).not.toHaveBeenCalled();
        expect(room.sent).toHaveLength(1);
    });

    test("drops malformed sender IDs and unsupported signal messages", () => {
        const room = makeRoom("me");
        const sig = new ColyseusSignaling(room);
        const h = makeHandlers();
        sig.start(h);
        room._deliver("rtc-join", { sessionId: {} });
        room._deliver("rtc-leave", { sessionId: 42 });
        room._deliver("rtc-signal", { from: {}, payload: { kind: "offer" } });
        room._deliver("rtc-signal", { from: "B", payload: { kind: "unknown" } });
        expect(h.onPeerJoin).not.toHaveBeenCalled();
        expect(h.onPeerLeave).not.toHaveBeenCalled();
        expect(h.onSignal).not.toHaveBeenCalled();
    });
});
