import { useEffect, useRef, type RefObject } from "react";
import { readGameMessage } from "./gameContract";

/**
 * Page menus pause the game under them. Anything the page opens over a
 * game (a menu, a dialog, a panel that takes the keyboard) holds a pause
 * while it is open:
 *
 *     useEffect(() => (open ? holdGamePause() : undefined), [open]);
 *
 * The page's own menu (Escape, GameInputLayer) is the first caller.
 * `useGamePause` (mounted by GamePage) tells the game: `pause` with the
 * first hold, `resume` when the last one is released, both with
 * `{ reason: "menu" }`. A solo game pauses; a multiplayer match keeps
 * playing (games/runtime/src/pausing.ts). The tab's visibility is not sent:
 * the game's own document sees it. Typing in the page stops the game's
 * input through `input` (gameInput.ts); what a game does with its clock
 * then is the game's to say.
 */
const holds = new Set<symbol>();
const listeners = new Set<(held: boolean) => void>();

/** Holds a pause until the returned function is called. */
export function holdGamePause(): () => void {
    const hold = Symbol("game-pause");
    const before = holds.size > 0;
    holds.add(hold);
    if (!before) listeners.forEach((listener) => listener(true));
    return () => {
        if (!holds.delete(hold) || holds.size) return;
        listeners.forEach((listener) => listener(false));
    };
}

export function gamePauseHeld(): boolean {
    return holds.size > 0;
}

/** Calls `listener` whenever the page starts or stops holding a pause. */
export function subscribeGamePause(listener: (held: boolean) => void) {
    listeners.add(listener);
    return () => void listeners.delete(listener);
}

/** Named `<game>:<kind>`, as the page's helpers do; GamePage's `send` puts it in the form the game speaks. */
export function gamePauseMessage(game: string, held: boolean) {
    return { type: `${game}:${held ? "pause" : "resume"}`, reason: "menu" };
}

/** Keeps the game in `frame` told about the page's pause holds. */
export function useGamePause(
    game: string,
    frame: RefObject<HTMLIFrameElement>,
    /** GamePage's way out to the game (`send.current`). */
    post: (message: object) => void
) {
    const out = useRef(post);
    out.current = post;
    useEffect(() => {
        const send = (held: boolean) =>
            out.current(gamePauseMessage(game, held));
        // A game starts listening some time before its first frame, so a
        // hold taken while it loads is repeated once it can hear it.
        const receive = (event: MessageEvent) => {
            if (
                event.source !== frame.current?.contentWindow ||
                event.origin !== "null"
            )
                return;
            const kind = readGameMessage(event.data?.type, game)?.kind;
            if ((kind === "first-frame" || kind === "ready") && gamePauseHeld())
                send(true);
        };
        window.addEventListener("message", receive);
        const unsubscribe = subscribeGamePause(send);
        if (gamePauseHeld()) send(true);
        return () => {
            window.removeEventListener("message", receive);
            unsubscribe();
        };
    }, [game, frame]);
}
