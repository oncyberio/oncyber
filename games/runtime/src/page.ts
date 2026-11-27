/**
 * The game's side of the page bridge, for any game. One prefix
 * (`oncyber:game:`), one handshake, and the page's facts about the visit
 * shaped for the lifecycle's `enter()`. Embedded, the game runs in an
 * opaque-origin sandbox with no storage of its own: the page keeps identity,
 * the room and the party. Standalone (a dev server), the same calls answer
 * with defaults. Saved values are saved.ts. See docs/games/contract.md; every
 * kind this file sends and hears is listed in games/runtime/messages.json.
 */
import {
    CONTRACT_VERSION,
    DIRECT_ENTER,
    GAME_MESSAGE_PREFIX,
    NAME_MAX,
    gameMessageKind,
    readEnterData,
    readTrip,
    type EnterData,
    type Trip,
} from "./contract.ts";
import type { ArrivalDeclaration, PartyDeclaration } from "./manifest.ts";

export interface PageIdentity {
    name: string;
    pfp: string;
    avatarUrl: string;
}
export interface PagePeer {
    id: string;
    name: string;
    [key: string]: unknown;
}
export interface PageOptions {
    /** From game.json, so the page knows how to reveal this game. */
    arrival?: ArrivalDeclaration;
    party?: PartyDeclaration;
    /** How long to wait for the page before playing with defaults. */
    identityTimeoutMs?: number;
    /** For tests: the window to talk through. */
    window?: Window;
}
type Events = {
    party: Trip | null;
    peers: PagePeer[];
    net: { from: string; data: unknown };
    self: string;
    revealed: void;
    /** The page asks for the last frame: see departure.ts. */
    departure: "self" | "party";
    dispose: void;
};

const text = (value: unknown, max: number) =>
    typeof value === "string" ? value.trim().slice(0, max) : "";

export function connectPage(options: PageOptions = {}) {
    const win = options.window ?? window;
    const embedded = win.parent !== win;
    const listeners: {
        [K in keyof Events]?: Array<(value: Events[K]) => void>;
    } = {};
    let identity: PageIdentity | null = null,
        enter: EnterData | null = null,
        trip: Trip | null = null;
    let selfId = "",
        readyPosted = false,
        revealed = !embedded,
        helloTimer: ReturnType<typeof setInterval> | undefined;
    const waiting = {
        identity: [] as Array<(v: PageIdentity) => void>,
        enter: [] as Array<(v: EnterData) => void>,
    };
    const fire = <K extends keyof Events>(kind: K, value: Events[K]) =>
        listeners[kind]?.forEach((listener) => listener(value));
    // The frame's URL shares the page's origin even though its own origin is
    // opaque, so messages are sent to, and accepted from, that origin only.
    const post = (kind: string, data: object = {}) => {
        if (embedded)
            win.parent.postMessage(
                { type: GAME_MESSAGE_PREFIX + kind, ...data },
                win.location.origin
            );
    };
    const setTrip = (next: Trip | null) => {
        const before = JSON.stringify(trip);
        trip = next && { ...next, self: next.self || selfId };
        if (JSON.stringify(trip) !== before) fire("party", trip);
    };
    const receive = (event: MessageEvent) => {
        if (event.source !== win.parent || event.origin !== win.location.origin)
            return;
        const kind = gameMessageKind(event.data?.type);
        const data = event.data;
        if (kind === "identity") {
            identity = {
                name: text(data.name, NAME_MAX) || "You",
                pfp: text(data.pfp, 2048),
                avatarUrl: text(data.avatarUrl, 2048),
            };
            clearInterval(helloTimer);
            waiting.identity.splice(0).forEach((resolve) => resolve(identity!));
            // The page only accepts readiness after it has sent the identity.
            if (readyPosted) post("ready");
        } else if (kind === "enter") {
            enter = readEnterData(data);
            setTrip(enter.trip);
            waiting.enter
                .splice(0)
                .forEach((resolve) => resolve({ ...enter!, trip }));
        } else if (kind === "party") {
            setTrip(readTrip(data.party));
        } else if (kind === "self") {
            selfId = text(data.id, 64);
            fire("self", selfId);
            if (trip) setTrip({ ...trip, self: selfId });
        } else if (kind === "peers") {
            fire(
                "peers",
                (Array.isArray(data.players) ? data.players : [])
                    .slice(0, 32)
                    .filter((p: any) => p && typeof p.id === "string" && p.id)
                    .map((p: any) => ({
                        ...p,
                        id: p.id.slice(0, 64),
                        name: text(p.name, NAME_MAX) || "Player",
                    }))
            );
        } else if (kind === "net") {
            if (typeof data.from === "string")
                fire("net", {
                    from: data.from.slice(0, 64),
                    data: data.data ?? null,
                });
        } else if (kind === "entered") {
            revealed = true;
            fire("revealed", undefined);
        } else if (kind === "departure") {
            fire("departure", data.reason === "party" ? "party" : "self");
        } else if (kind === "dispose") fire("dispose", undefined);
    };
    win.addEventListener("message", receive);
    const hello = () =>
        post("hello", {
            contract: CONTRACT_VERSION,
            arrival: options.arrival ?? null,
            party: options.party ?? null,
        });
    return {
        embedded,
        get selfId() {
            return selfId;
        },
        get trip() {
            return trip;
        },
        /** False between a lobby arrival being staged and the lobby letting go. */
        get revealed() {
            return revealed;
        },
        on<K extends keyof Events>(
            kind: K,
            listener: (value: Events[K]) => void
        ) {
            (listeners[kind] ??= [] as any).push(listener);
        },
        /** Greets the page until it answers: it may attach its listener after this frame loads. */
        hello() {
            hello();
            if (!embedded) return;
            let tries = 0;
            helloTimer = setInterval(
                () =>
                    identity || ++tries > 40
                        ? clearInterval(helloTimer)
                        : hello(),
                250
            );
        },
        /** The visitor's public fields; defaults when standalone or the page is silent. */
        identity(): Promise<PageIdentity> {
            if (identity) return Promise.resolve(identity);
            return new Promise((resolve) => {
                waiting.identity.push(resolve);
                setTimeout(
                    () => {
                        if (identity) return;
                        identity = { name: "You", pfp: "", avatarUrl: "" };
                        waiting.identity
                            .splice(0)
                            .forEach((done) => done(identity!));
                    },
                    embedded ? options.identityTimeoutMs ?? 4000 : 0
                );
            });
        },
        /**
         * The visit's data for `enter()`. Direct visits get it with the
         * identity; a lobby trip gets it just before the reveal, after
         * `ready()`. Standalone, a direct solo visit at once.
         */
        enterData(): Promise<EnterData> {
            if (enter) return Promise.resolve({ ...enter, trip });
            if (!embedded) return Promise.resolve(DIRECT_ENTER);
            return new Promise((resolve) => waiting.enter.push(resolve));
        },
        /** Prepared: the game is built and can be entered. */
        ready() {
            readyPosted = true;
            post("ready");
        },
        /** The arrival frame is drawn; the lobby may let go. */
        arrivalReady() {
            post("arrival-ready");
        },
        fail(message: unknown) {
            post("error", { message: String(message).slice(0, 200) });
        },
        exit() {
            post("exit");
        },
        /** One message of another kind, for the runtime's helpers (createDeparture's `post`). */
        post(kind: string, data?: object) {
            post(kind, data);
        },
        pose(pose: object) {
            post("pose", pose);
        },
        net(data: unknown) {
            post("net", { data });
        },
        dispose() {
            clearInterval(helloTimer);
            win.removeEventListener("message", receive);
        },
    };
}
export type GamePageClient = ReturnType<typeof connectPage>;
