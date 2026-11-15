import { findSharedPageGame } from "./catalog";
import {
    fetchGameRelease,
    resolveGamePause,
    type GamePause,
} from "./gameDisabled";
import {
    committedFrame,
    frameBase,
    releaseBase,
    type GameFrame,
} from "./gameRelease";
import {
    gameMessageTypes,
    readGameMessage,
    type GameDialect,
} from "./gameContract";

/**
 * Prepares a game while the visitor is still in the lobby.
 *
 * A trip mounts the destination page only once the avatar is seated, and
 * the game's own frame inside it later still. This starts earlier: the
 * moment a game is chosen, the lobby loads the game's frame hidden, in the
 * same sandbox the game page uses. The game downloads its files, builds its
 * scene, compiles its shaders and draws one frame; then the frame is
 * removed. The trip's own frame finds those files in the browser's cache
 * and the shaders in the GPU process's cache, so it reaches its first frame
 * sooner (measurements: docs/games/loading-and-pausing.md).
 *
 * The hidden frame is the game and nothing else: an opaque origin, no
 * identity (it gets a guest), no room, no saved data, no audio (it never
 * receives a gesture). It cannot be handed to the trip, because a frame
 * does not survive a move between documents.
 *
 * A game the kill switch has paused (gameDisabled.ts) is not prepared: the
 * lobby asks the site first, and loads nothing when it can't tell. The same
 * answer says where the game's frame loads from (gameRelease.ts): the
 * hosted release its pointer names, or the committed build, exactly as the
 * game page will load it, so the files prepared are the files played.
 */
const GAME_HREF = /^\/games\/([a-z0-9][a-z0-9-]{0,62})\/?$/;
/** A prepared game stays warm this long before it is prepared again. */
export const PREPARE_AGAIN_AFTER_MS = 5 * 60 * 1000;
/** A game that hasn't drawn by now is left to the trip itself. */
export const PREPARE_TIMEOUT_MS = 20000;

/** The id of the shared-page game `href` opens, or null. */
export function gameDestinationId(href: string, origin: string): string | null {
    let url: URL;
    try {
        url = new URL(href, origin);
    } catch {
        return null;
    }
    if (url.origin !== origin) return null;
    const id = GAME_HREF.exec(url.pathname)?.[1];
    return id && findSharedPageGame(id) ? id : null;
}

/** The frame the site named, if it is one the game page would load too. */
function preparedFrame(id: string, frame: unknown): GameFrame {
    const named = frame as GameFrame | null;
    if (
        named?.source === "hosted" &&
        typeof named.src === "string" &&
        typeof named.release === "string"
    ) {
        const base = releaseBase(
            id,
            named.release,
            frameBase(id, named),
            process.env.NODE_ENV === "development"
        );
        if (base && named.src === `${base}index.html`)
            return { src: named.src, release: named.release, source: "hosted" };
    }
    return committedFrame(id);
}

/** False: don't load the game. True: the committed build. A frame: that one. */
type PrepareAnswer = boolean | GameFrame;

/**
 * Whether the kill switch lets this game load, as the game page decides it
 * (`GAMES_DISABLED`, read by /api/games/paused on every request), and the
 * frame the game's pointer names.
 */
async function gamePlayable(id: string): Promise<PrepareAnswer> {
    const response = await fetch(`/api/games/paused?game=${id}`, {
        cache: "no-store",
    });
    if (!response.ok) return false;
    const answer = (await response.json()) as GamePause & { frame?: unknown };
    const frame = preparedFrame(id, answer.frame);
    // A hosted release was decided by the site, by the pointer's id; the
    // committed build's id is in its release.json.
    const play =
        (await resolveGamePause(answer, () =>
            frame.release
                ? Promise.resolve(frame.release)
                : fetchGameRelease(id)
        )) === "play";
    return play && frame;
}
let playable: (id: string) => PrepareAnswer | Promise<PrepareAnswer> =
    gamePlayable;
/** For tests: stand in for the site's answer. Null restores it. */
export function setGamePrepareGate(gate: typeof playable | null) {
    playable = gate ?? gamePlayable;
}

let current: { id: string; stop(): void } | null = null;
const prepared = new Map<string, number>();

/** Stops a preparation in flight (the visitor chose somewhere else). */
export function cancelGamePreparation() {
    current?.stop();
}

/**
 * Starts preparing the game `href` leads to. Safe to call often: one game
 * prepares at a time, and each at most once per PREPARE_AGAIN_AFTER_MS.
 * Returns whether the game is being (or was just) prepared.
 */
export function prepareGameDestination(href: string): boolean {
    if (typeof window === "undefined" || !document.body) return false;
    if ((navigator as any).connection?.saveData === true) return false;
    const id = gameDestinationId(href, window.location.origin);
    if (!id) return false;
    if (current?.id === id) return true;
    const last = prepared.get(id);
    if (last != null && performance.now() - last < PREPARE_AGAIN_AFTER_MS)
        return true;
    current?.stop();

    const frame = document.createElement("iframe");
    // The address is set when the site has answered (`mount`, below).
    // The game page's sandbox, without pointer lock: nobody plays this one.
    frame.setAttribute("sandbox", "allow-scripts");
    frame.setAttribute("referrerpolicy", "no-referrer");
    frame.setAttribute("aria-hidden", "true");
    frame.setAttribute("data-game-prepare", id);
    frame.tabIndex = -1;
    frame.inert = true;
    // On screen but invisible, so the browser still gives it frames; small,
    // because shaders compile the same at any size.
    frame.style.cssText =
        "position:fixed;left:0;top:0;width:320px;height:180px;border:0;" +
        "opacity:0;pointer-events:none;z-index:-1";
    // The game is answered in the form it greeted in (`oncyber:game:<kind>`,
    // or `<id>:<kind>` from an older build); before that, in both.
    let dialect: GameDialect | null = null;
    const post = (kind: string, data: object = {}) => {
        for (const type of gameMessageTypes(id, kind, dialect))
            frame.contentWindow?.postMessage({ type, ...data }, "*");
    };
    const receive = (event: MessageEvent) => {
        if (
            !frame.contentWindow ||
            event.source !== frame.contentWindow ||
            event.origin !== "null"
        )
            return;
        const message = readGameMessage(event.data?.type, id);
        if (!message) return;
        // A guest with nothing saved: the real identity goes to the trip,
        // and so does `enter`: this frame is never entered or revealed.
        if (message.kind === "hello") {
            dialect = message.dialect;
            post("identity", {
                name: "Guest",
                pfp: "",
                avatarUrl: "",
                storage: {},
            });
        } else if (message.kind === "first-frame" || message.kind === "ready") {
            prepared.set(id, performance.now());
            stop();
        } else if (message.kind === "error") stop();
    };
    const stop = () => {
        if (current !== session) return;
        current = null;
        clearTimeout(timer);
        window.removeEventListener("message", receive);
        post("dispose");
        frame.remove();
    };
    const session = { id, stop };
    const timer = setTimeout(stop, PREPARE_TIMEOUT_MS);
    current = session;
    window.addEventListener("message", receive);
    // Mounted only once the kill switch allows it; preparing is a head
    // start, so a game that can't be vouched for is left to the trip.
    const mount = (play: PrepareAnswer) => {
        if (current !== session) return;
        if (!play) return stop();
        const from = play === true ? committedFrame(id) : play;
        frame.src = `${from.src}?prepare`;
        if (from.release) frame.setAttribute("data-release", from.release);
        document.body.appendChild(frame);
    };
    let allowed: PrepareAnswer | Promise<PrepareAnswer>;
    try {
        allowed = playable(id);
    } catch {
        allowed = false;
    }
    if (allowed instanceof Promise)
        void allowed.then(mount, () => mount(false));
    else mount(allowed);
    return true;
}

/** For tests. */
export function resetGamePreparation() {
    current?.stop();
    prepared.clear();
}
