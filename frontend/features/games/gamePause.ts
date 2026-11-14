import { useEffect, type RefObject } from "react";

/**
 * Page menus pause the game under them. Anything the page opens over a
 * game (a menu, a dialog, a panel that takes the keyboard) holds a pause
 * while it is open:
 *
 *     useEffect(() => (open ? holdGamePause() : undefined), [open]);
 *
 * `useGamePause` (mounted by GamePage) tells the game: `<game>:pause` with
 * the first hold, `<game>:resume` when the last one is released, both with
 * `{ reason: "menu" }`. A solo game pauses; a multiplayer match keeps
 * playing (games/runtime/src/pausing.ts). The tab's visibility is not sent:
 * the game's own document sees it.
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

export function gamePauseMessage(game: string, held: boolean) {
    return { type: `${game}:${held ? "pause" : "resume"}`, reason: "menu" };
}

/** Keeps the game in `frame` told about the page's pause holds. */
export function useGamePause(
    game: string,
    frame: RefObject<HTMLIFrameElement>
) {
    useEffect(() => {
        const send = (held: boolean) =>
            // The frame's origin is opaque; the message names no secret.
            frame.current?.contentWindow?.postMessage(
                gamePauseMessage(game, held),
                "*"
            );
        // A game starts listening some time before its first frame, so a
        // hold taken while it loads is repeated once it can hear it.
        const receive = (event: MessageEvent) => {
            if (
                event.source !== frame.current?.contentWindow ||
                event.origin !== "null"
            )
                return;
            const type = event.data?.type;
            if (
                (type === `${game}:first-frame` || type === `${game}:ready`) &&
                gamePauseHeld()
            )
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
