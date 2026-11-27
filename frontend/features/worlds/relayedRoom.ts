/**
 * The world's side of the relayed room (./roomRelay): an object with the
 * parts of a room the engine and the in-world interface use, backed by
 * messages to the page that holds the real connection.
 */
import type { FrameLink } from "./frameLink";
import type { RoomPlayer } from "./roomRelay";

/** The frame link a relayed room speaks over (./worldDocument). */
/** The link a relayed room is written against (./frameLink.ts). */
export type RoomLink = FrameLink;

const JOIN_TIMEOUT_MS = 30_000;
let joins = 0;

/** A callable list of listeners, as a room exposes its events. */
function signal<A extends unknown[]>() {
    const listeners = new Set<(...args: A) => void>();
    const register = (listener: (...args: A) => void) => {
        listeners.add(listener);
        return () => void listeners.delete(listener);
    };
    return Object.assign(register, {
        once(listener: (...args: A) => void) {
            const off = register((...args) => {
                off();
                listener(...args);
            });
            return off;
        },
        invoke: (...args: A) =>
            [...listeners].forEach((listener) => listener(...args)),
        clear: () => listeners.clear(),
    });
}

/** The room's visitors by session, with the callbacks the engine sets. */
export class RelayedPlayers extends Map<string, RoomPlayer> {
    onAdd?: (player: RoomPlayer, sessionId: string) => void;
    onRemove?: (player: RoomPlayer, sessionId: string) => void;

    /** Brings the map to what the room now holds, keeping each object. */
    apply(players: RoomPlayer[]) {
        const present = new Set<string>();
        for (const next of players) {
            const id = String(next?.sessionId ?? "");
            if (!id) continue;
            present.add(id);
            const known = this.get(id);
            if (known) Object.assign(known, next);
            else {
                this.set(id, next);
                this.onAdd?.(next, id);
            }
        }
        for (const [id, player] of [...this]) {
            if (present.has(id)) continue;
            this.delete(id);
            this.onRemove?.(player, id);
        }
    }
}

export class RelayedRoom {
    readonly state = { players: new RelayedPlayers() };
    readonly onStateChange = signal<[typeof this.state]>();
    readonly onLeave = signal<[number]>();
    readonly onError = signal<[number, string?]>();
    private readonly messages = new Map<
        string,
        Set<(...args: any[]) => void>
    >();
    private open = true;

    constructor(
        private readonly link: RoomLink,
        private readonly seq: number,
        readonly sessionId: string,
        readonly id: string,
        private readonly stop: () => void
    ) {}
    get roomId() {
        return this.id;
    }

    send(name: string, data?: unknown) {
        if (this.open)
            this.link.send("room-send", { seq: this.seq, name, data });
    }

    onMessage(name: string, listener: (...args: any[]) => void) {
        const set = this.messages.get(name) ?? new Set();
        this.messages.set(name, set);
        set.add(listener);
        return () => void set.delete(listener);
    }

    leave(_consented = true) {
        if (this.open) {
            this.link.send("room-leave", { seq: this.seq });
            this.close(1000);
        }
        return Promise.resolve(1000);
    }

    removeAllListeners() {
        this.onStateChange.clear();
        this.onLeave.clear();
        this.onError.clear();
        this.messages.clear();
    }

    /** A message from the page for this join. */
    receive(kind: string, data: any) {
        if (!this.open) return;
        if (kind === "room-state" && Array.isArray(data.players)) {
            this.state.players.apply(data.players);
            this.onStateChange.invoke(this.state);
        } else if (kind === "room-message" && typeof data.name === "string") {
            this.messages
                .get(data.name)
                ?.forEach((listener) => listener(data.data));
            this.messages
                .get("*")
                ?.forEach((listener) => listener(data.name, data.data));
        } else if (kind === "room-left") this.close(Number(data.code) || 1006);
    }

    private close(code: number) {
        this.open = false;
        this.stop();
        this.onLeave.invoke(code);
    }
}

/**
 * Joins the room through the page. The page decides who is joining; the
 * world says where (the room's label, the visitor's place in it).
 */
export function joinRelayedRoom(
    link: RoomLink,
    options: object,
    abort?: AbortSignal
): Promise<RelayedRoom> {
    const seq = ++joins;
    return new Promise((resolve, reject) => {
        let room: RelayedRoom | null = null;
        const settle = (error?: Error) => {
            clearTimeout(timer);
            abort?.removeEventListener("abort", cancelled);
            if (error) {
                stop();
                reject(error);
            }
        };
        const stop = link.listen((kind, data) => {
            if (data?.seq !== seq) return;
            if (room) return room.receive(kind, data);
            if (kind === "room-joined" && typeof data.sessionId === "string") {
                room = new RelayedRoom(
                    link,
                    seq,
                    data.sessionId,
                    String(data.roomId ?? ""),
                    stop
                );
                settle();
                resolve(room);
            } else if (kind === "room-refused")
                settle(
                    new Error(
                        typeof data.message === "string" && data.message
                            ? data.message
                            : "Failed to join multiplayer room"
                    )
                );
        });
        const cancelled = () => {
            link.send("room-leave", { seq });
            settle(
                Object.assign(new Error("Room join cancelled"), {
                    name: "AbortError",
                })
            );
        };
        const timer = setTimeout(() => {
            link.send("room-leave", { seq });
            settle(new Error("Failed to join multiplayer room"));
        }, JOIN_TIMEOUT_MS);
        if (abort?.aborted) return cancelled();
        abort?.addEventListener("abort", cancelled);
        link.send("room-join", { seq, options });
    });
}
