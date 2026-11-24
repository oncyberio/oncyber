/** @jest-environment node */
import { deserialize, serialize } from "v8";
import { joinRelayedRoom } from "./relayedRoom";
import { filterRoomSend, readRoomJoin } from "./roomRelay";
import { hostWorldRoom, type HostedRoom } from "./worldRoomHost";

/** A room as the room server gives one to the page. */
function fakeRoom(sessionId = "me") {
    const listeners = { state: [], message: [], leave: [] } as Record<
        string,
        ((...args: any[]) => void)[]
    >;
    const players = new Map<string, any>();
    const room = {
        sessionId,
        id: "room-1",
        state: { players },
        sent: [] as [string, unknown][],
        left: false,
        send: (name: string, data: unknown) =>
            void room.sent.push([name, data]),
        onStateChange: (l: any) => void listeners.state.push(l),
        onMessage: (_: "*", l: any) => void listeners.message.push(l),
        onLeave: (l: any) => void listeners.leave.push(l),
        leave: () => {
            room.left = true;
            return Promise.resolve();
        },
        // what the server does
        patch(next: Record<string, object>) {
            players.clear();
            for (const [id, player] of Object.entries(next))
                players.set(id, { sessionId: id, ...player });
            listeners.state.forEach((l) => l(room.state));
        },
        say: (name: string, data: unknown) =>
            listeners.message.forEach((l) => l(name, data)),
        drop: (code: number) => listeners.leave.forEach((l) => l(code)),
    };
    return room;
}

/** A world and the page around it, with the frame between them. */
function frame(
    who = { userId: "0xada", token: "page-secret", username: "ada" as string }
) {
    const rooms: ReturnType<typeof fakeRoom>[] = [];
    const joined: any[] = [];
    const toWorld = new Set<(kind: string, data: any) => void>();
    const crossed: string[] = [];
    // a frame hands over a structured clone of each message
    const cross = (data: object) =>
        deserialize(new Uint8Array(serialize(data)));
    const host = hostWorldRoom({
        post: (kind, data) => {
            crossed.push(kind);
            const copy = cross(data);
            [...toWorld].forEach((handler) => handler(kind, copy));
        },
        identify: async () => who,
        join: async (body) => {
            joined.push(body);
            if (body.label === "full") throw new Error("This room is full.");
            const room = fakeRoom();
            rooms.push(room);
            return room as unknown as HostedRoom;
        },
    });
    const link = {
        send: (kind: string, data: object = {}) =>
            host.receive(kind, cross(data)),
        listen: (handler: (kind: string, data: any) => void) => {
            toWorld.add(handler);
            return () => void toWorld.delete(handler);
        },
    };
    return { host, link, rooms, joined, crossed };
}

const options = {
    label: "starry-night",
    currentSpace: "abc",
    position: { x: 1, y: 2, z: 3 },
    rotationY: 0.5,
    username: "whatever the world says",
    avatar: "https://cdn.example/me.png",
    userId: "0xsomeone-else",
    token: "made up",
};

describe("a room relayed through the page", () => {
    test("the world joins where it says, as who the page says", async () => {
        const f = frame();
        const room = await joinRelayedRoom(f.link, options);
        expect(f.joined[0]).toEqual({
            label: "starry-night",
            currentSpace: "abc",
            position: { x: 1, y: 2, z: 3 },
            rotationY: 0.5,
            avatar: "https://cdn.example/me.png",
            userId: "0xada",
            token: "page-secret",
            username: "ada",
        });
        expect(room.sessionId).toBe("me");
        expect(room.id).toBe("room-1");
        // the session never crossed into the world
        expect(JSON.stringify(room)).not.toContain("page-secret");
        expect(f.crossed.join()).toBe("room-joined,room-state");
    });

    test("the world sees who is in the room, patch by patch", async () => {
        const f = frame();
        const room = await joinRelayedRoom(f.link, options);
        const added: string[] = [];
        const removed: string[] = [];
        const patches: number[] = [];
        room.state.players.onAdd = (_, id) => void added.push(id);
        room.state.players.onRemove = (_, id) => void removed.push(id);
        room.onStateChange((state) => void patches.push(state.players.size));

        f.rooms[0].patch({
            me: { username: "ada", positionX: 1, isAdmin: true },
            bob: { username: "bob", positionX: 5, secret: "not relayed" },
        });
        const bob = room.state.players.get("bob");
        expect(bob).toMatchObject({ username: "bob", positionX: 5 });
        expect(bob).not.toHaveProperty("secret");
        expect(room.state.players.get("me").isAdmin).toBe(true);

        f.rooms[0].patch({ me: { username: "ada" }, bob: { positionX: 9 } });
        // the same object moves, as the engine's own references expect
        expect(room.state.players.get("bob")).toBe(bob);
        expect(bob.positionX).toBe(9);

        f.rooms[0].patch({ me: { username: "ada" } });
        expect(added).toEqual(["me", "bob"]);
        expect(removed).toEqual(["bob"]);
        expect(patches).toEqual([2, 2, 1]);
    });

    test("the world's moves reach the room; its identity does not", async () => {
        const f = frame();
        const room = await joinRelayedRoom(f.link, options);
        room.send("move", [1, 2, 3, 0, 4, true]);
        room.send("username", "mallory");
        room.send("login", ["stolen", "mallory"]);
        room.send("rtc-signal", { to: "bob" });
        room.send("kick", "bob");
        room.send("init", [
            1,
            2,
            3,
            0,
            1,
            "abc",
            "0xmallory",
            "pic",
            "mallory",
        ]);
        room.send("voice-range", [12, "made up"]);
        expect(f.rooms[0].sent).toEqual([
            ["move", [1, 2, 3, 0, 4, true]],
            ["init", [1, 2, 3, 0, 1, "abc", "0xada", "pic", "ada"]],
            ["voice-range", [12, "page-secret"]],
        ]);
    });

    test("the room's messages reach the world, except voice signalling", async () => {
        const f = frame();
        const room = await joinRelayedRoom(f.link, options);
        const chat: unknown[] = [];
        const all: unknown[] = [];
        room.onMessage("chat-channel", (data) => void chat.push(data));
        room.onMessage("*", (name, data) => void all.push([name, data]));
        f.rooms[0].say("chat-channel", { text: "hi" });
        f.rooms[0].say("rtc-signal", { sdp: "..." });
        expect(chat).toEqual([{ text: "hi" }]);
        expect(all).toEqual([["chat-channel", { text: "hi" }]]);
    });

    test("leaving, either way round", async () => {
        const f = frame();
        const first = await joinRelayedRoom(f.link, options);
        const left: number[] = [];
        first.onLeave((code) => void left.push(code));
        await first.leave();
        expect(f.rooms[0].left).toBe(true);
        expect(left).toEqual([1000]);
        first.send("move", [0, 0, 0]);
        expect(f.rooms[0].sent).toEqual([]);

        const second = await joinRelayedRoom(f.link, options);
        second.onLeave((code) => void left.push(code));
        f.rooms[1].drop(4000);
        expect(left).toEqual([1000, 4000]);
    });

    test("a new join leaves the room before it, and its late words are dropped", async () => {
        const f = frame();
        const first = await joinRelayedRoom(f.link, options);
        const seen: number[] = [];
        first.onStateChange((state) => void seen.push(state.players.size));
        const second = await joinRelayedRoom(f.link, options);
        expect(f.rooms[0].left).toBe(true);
        f.rooms[0].patch({ ghost: {} });
        f.rooms[1].patch({ me: {}, bob: {} });
        expect(seen).toEqual([]);
        expect(second.state.players.size).toBe(2);
        first.send("move", [9, 9, 9]);
        expect(f.rooms[1].sent).toEqual([]);
    });

    test("a refused join says why; a cancelled one lets go of its seat", async () => {
        const f = frame();
        await expect(
            joinRelayedRoom(f.link, { ...options, label: "full" })
        ).rejects.toThrow("This room is full.");
        await expect(joinRelayedRoom(f.link, { label: "" })).rejects.toThrow(
            "Failed to join multiplayer room"
        );

        const abort = new AbortController();
        const joining = joinRelayedRoom(f.link, options, abort.signal);
        abort.abort();
        await expect(joining).rejects.toMatchObject({ name: "AbortError" });
        await Promise.resolve();
        await Promise.resolve();
        expect(f.rooms.at(-1)?.left ?? true).toBe(true);
    });
});

describe("what a world may ask of the room", () => {
    test("a join names a room and a place, nothing about the account", () => {
        expect(readRoomJoin(options)).toEqual({
            label: "starry-night",
            currentSpace: "abc",
            position: { x: 1, y: 2, z: 3 },
            rotationY: 0.5,
            username: "whatever the world says",
            avatar: "https://cdn.example/me.png",
        });
        expect(readRoomJoin({ ...options, position: { x: "a" } })).toBeNull();
        expect(readRoomJoin({ ...options, label: "x".repeat(300) })).toBeNull();
        expect(readRoomJoin(null)).toBeNull();
    });

    test("a guest may name themselves; a signed-in visitor is who the page says", () => {
        const guest = { userId: "Anon-1", token: "" };
        expect(filterRoomSend("username", "zed", guest)).toEqual({
            name: "username",
            data: "zed",
        });
        expect(
            filterRoomSend("username", "zed", { ...guest, username: "ada" })
        ).toBeUndefined();
        expect(filterRoomSend("attr-voice", 1, guest)).toEqual({
            name: "attr-voice",
            data: 1,
        });
        expect(filterRoomSend("enable-voice", "bob", guest)).toBeUndefined();
        expect(filterRoomSend(7, null, guest)).toBeUndefined();
    });
});
