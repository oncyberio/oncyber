/**
 * The page's side of the relayed room (./roomRelay): it holds the real
 * connection for the world in its frame, joined as the page's own visitor,
 * and passes the room's state and messages down and the world's own moves
 * up. Voice signalling stays out of the relay: voice is the page's.
 */
import {
    filterRoomSend,
    readRoomJoin,
    readRoomPlayers,
    type RoomIdentity,
    type RoomJoinRequest,
} from "./roomRelay";

/** The parts of a room the host uses. */
export interface HostedRoom {
    sessionId: string;
    id?: string;
    state?: unknown;
    send(name: string, data?: unknown): void;
    onStateChange(listener: (state: unknown) => void): unknown;
    onMessage(
        name: "*",
        listener: (name: unknown, data: unknown) => void
    ): unknown;
    onLeave(listener: (code: number) => void): unknown;
    leave(consented?: boolean): unknown;
}

export interface WorldRoomHostOptions {
    /** To the world in the frame. */
    post(kind: string, data: object): void;
    /** Who the page joins this room as. */
    identify(label: string): Promise<RoomIdentity> | RoomIdentity;
    join(
        body: RoomJoinRequest & RoomIdentity,
        signal: AbortSignal
    ): Promise<HostedRoom>;
}

interface Session {
    seq: number;
    room: HostedRoom | null;
    who: RoomIdentity | null;
    abort: AbortController;
}

const quietly = (leaving: unknown) =>
    void Promise.resolve(leaving).catch(() => {});

export function hostWorldRoom({ post, identify, join }: WorldRoomHostOptions) {
    let current: Session | null = null;

    const end = () => {
        const session = current;
        current = null;
        session?.abort.abort();
        if (session?.room) quietly(session.room.leave(true));
    };

    async function start(seq: number, asked: unknown) {
        end();
        const session: Session = (current = {
            seq,
            room: null,
            who: null,
            abort: new AbortController(),
        });
        const live = () => current === session;
        try {
            const request = readRoomJoin(asked);
            if (!request) throw new Error("Failed to join multiplayer room");
            const who = await identify(request.label);
            if (!live()) return;
            const room = await join(
                {
                    ...request,
                    ...who,
                    // The room server reads the name URI-encoded.
                    username: encodeURIComponent(
                        who.username ?? request.username
                    ),
                },
                session.abort.signal
            );
            if (!live()) return quietly(room.leave(true));
            session.room = room;
            session.who = who;
            const state = (value: unknown) => {
                if (live())
                    post("room-state", {
                        seq,
                        players: readRoomPlayers(value),
                    });
            };
            room.onStateChange(state);
            room.onMessage("*", (name, data) => {
                // Voice is the page's own; its signalling is not relayed.
                if (live() && typeof name === "string" && !/^rtc-/.test(name))
                    post("room-message", { seq, name, data });
            });
            room.onLeave((code) => {
                if (!live()) return;
                current = null;
                post("room-left", { seq, code });
            });
            post("room-joined", {
                seq,
                sessionId: room.sessionId,
                roomId: room.id ?? "",
            });
            if (room.state) state(room.state);
        } catch (error) {
            if (!live()) return;
            current = null;
            post("room-refused", {
                seq,
                message:
                    error instanceof Error && error.name !== "AbortError"
                        ? error.message
                        : "",
            });
        }
    }

    return {
        /** A `room-*` message from the world. */
        receive(kind: string, data: any) {
            const seq = data?.seq;
            if (!Number.isSafeInteger(seq)) return;
            if (kind === "room-join") return void start(seq, data.options);
            if (!current || current.seq !== seq) return;
            if (kind === "room-leave") return end();
            if (kind === "room-send" && current.room && current.who) {
                const passed = filterRoomSend(
                    data.name,
                    data.data,
                    current.who
                );
                if (passed) current.room.send(passed.name, passed.data);
            }
        },
        /** The room the page holds now, for the page's own use of it. */
        room: () => current?.room ?? null,
        dispose: end,
    };
}
