/**
 * A game's whole contact with chat and voice. The page owns both: it keeps
 * the visitor's lobby chat and microphone running in the game's room, or the
 * party's room, with the game doing nothing. A game never builds its own.
 *
 * A game may do two things, both optional:
 *  - say where voices come from (`setPoses`), when the visitor hears from
 *    somewhere other than their room pose, or players stand where the room
 *    doesn't know (a seat, a court, a vehicle);
 *  - show who is talking (`onTalking`, `isTalking`).
 *
 * Player ids are room ids: the ones in the page's `peers` and `self`.
 * See docs/games/voice-chat.md.
 */
export interface VoicePoint {
    x: number;
    y: number;
    z: number;
}
/** Where the visitor hears from, usually the camera; `h` is its heading in radians. */
export interface VoiceListener extends VoicePoint {
    h?: number;
}
export interface VoicePlayer extends VoicePoint {
    id: string;
}
export interface VoicePort {
    /** Post one message to the page. */
    post(message: object): void;
    /** Hear the page's messages; returns how to stop. */
    listen(handler: (data: unknown) => void): () => void;
}

/** The page reads at most this many players from one message. */
export const VOICE_PLAYERS_MAX = 64;
/** Poses go to the page at most this often, however often they are set. */
export const VOICE_INTERVAL_MS = 100;

const finite = (value: unknown): value is number =>
    typeof value === "number" && Number.isFinite(value);
const round = (value: number) => Math.round(value * 100) / 100;

/** The `<id>:voice` message, or null when the listener is not a position. */
export function voiceMessage(
    gameId: string,
    listener: VoiceListener,
    players: Iterable<VoicePlayer>
) {
    if (
        !listener ||
        !finite(listener.x) ||
        !finite(listener.y) ||
        !finite(listener.z)
    )
        return null;
    const list: VoicePlayer[] = [];
    for (const player of players) {
        if (list.length >= VOICE_PLAYERS_MAX) break;
        if (
            typeof player?.id !== "string" ||
            !player.id ||
            !finite(player.x) ||
            !finite(player.y) ||
            !finite(player.z)
        )
            continue;
        list.push({
            id: player.id,
            x: round(player.x),
            y: round(player.y),
            z: round(player.z),
        });
    }
    return {
        type: `${gameId}:voice`,
        listener: {
            x: round(listener.x),
            y: round(listener.y),
            z: round(listener.z),
            h: finite(listener.h) ? round(listener.h) : 0,
        },
        players: list,
    };
}

/** The room ids in a `<id>:talking` message, or null when it is another message. */
export function readTalking(
    gameId: string,
    data: any
): { ids: string[]; self: boolean } | null {
    if (data?.type !== `${gameId}:talking` || !Array.isArray(data.ids))
        return null;
    return {
        ids: data.ids
            .filter((id: unknown) => typeof id === "string" && id)
            .slice(0, VOICE_PLAYERS_MAX + 1)
            .map((id: string) => id.slice(0, 64)),
        self: data.self === true,
    };
}

function windowPort(): VoicePort {
    return {
        post: (message) => {
            if (window.parent !== window)
                window.parent.postMessage(message, "*");
        },
        listen: (handler) => {
            const receive = (event: MessageEvent) => {
                if (event.source === window.parent) handler(event.data);
            };
            window.addEventListener("message", receive);
            return () => window.removeEventListener("message", receive);
        },
    };
}

export function connectVoice(
    gameId: string,
    options: { port?: VoicePort; now?: () => number } = {}
) {
    const port = options.port ?? windowPort();
    const now = options.now ?? (() => performance.now());
    const listeners = new Set<(ids: string[], self: boolean) => void>();
    let talking = new Set<string>(),
        self = false,
        sentAt = -Infinity,
        disposed = false;
    const stop = port.listen((data) => {
        const next = readTalking(gameId, data);
        if (!next || disposed) return;
        talking = new Set(next.ids);
        self = next.self;
        for (const listener of [...listeners])
            listener(next.ids.slice(), next.self);
    });
    return {
        /**
         * Where the visitor hears from and where each player's voice comes
         * from. Call it as often as you like (every frame is fine); a player
         * left out keeps the room's own rule. Returns true when it was sent.
         */
        setPoses(listener: VoiceListener, players: Iterable<VoicePlayer> = []) {
            const at = now();
            if (disposed || at - sentAt < VOICE_INTERVAL_MS) return false;
            const message = voiceMessage(gameId, listener, players);
            if (!message) return false;
            sentAt = at;
            port.post(message);
            return true;
        },
        /** Called with the room ids of everyone talking whenever that changes. */
        onTalking(listener: (ids: string[], self: boolean) => void) {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
        isTalking: (id: string) => talking.has(id),
        /** True while the visitor's own microphone picks up their voice. */
        get selfTalking() {
            return self;
        },
        get talking() {
            return [...talking];
        },
        dispose() {
            disposed = true;
            listeners.clear();
            talking.clear();
            self = false;
            stop();
        },
    };
}
