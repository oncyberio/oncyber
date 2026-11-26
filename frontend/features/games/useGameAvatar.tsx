import { useEffect, useRef, type RefObject } from "react";
import {
    AVATAR_KIND,
    AVATAR_PICKER_KIND,
    avatarMessage,
} from "@features/avatar-picker/pageAvatar";
import { usePageAvatarPicker } from "@features/avatar-picker/usePageAvatarPicker";
import { readGameMessage } from "./gameContract";
import { holdGamePause } from "./gamePause";

/**
 * Changing avatar from inside a game (docs/games/avatar-kit.md). The picker
 * is the page's, the same one a framed world gets (features/avatar-picker):
 * it lists the visitor's own avatars, saves the choice to their account and
 * keeps it for the visit. A game only asks and wears:
 *
 *   game -> page  `avatar-picker`  show the picker (no payload)
 *   page -> game  `avatar`         `{ avatarUrl, avatarId, avatarName,
 *                                  avatarScale? }`: what the visitor chose
 *
 * Returns the picker to draw. `onChosen` is where the page keeps the new
 * avatar as its own: in the identity it hands a game, and in the room.
 */
export function useGameAvatar(options: {
    game: string;
    frame: RefObject<HTMLIFrameElement>;
    /** Vouches that a message came from the game's frame. */
    fromGame(event: MessageEvent): boolean;
    /** GamePage's way out to the game, by kind. */
    post(kind: string, data?: object): void;
    /** The game may ask once it has been told who is visiting. */
    allowed(): boolean;
    /** The address of the avatar the visitor chose. */
    onChosen(avatarUrl: string): void;
}) {
    const latest = useRef(options);
    latest.current = options;
    const picker = usePageAvatarPicker((avatar) => {
        const message = avatarMessage(avatar);
        latest.current.onChosen(message.avatarUrl);
        latest.current.post(AVATAR_KIND, message);
    });
    const open = useRef(picker.open);
    open.current = picker.open;
    const { game } = options;
    useEffect(() => {
        const receive = (event: MessageEvent) => {
            if (!latest.current.fromGame(event)) return;
            const kind = readGameMessage(event.data?.type, game)?.kind;
            if (kind !== AVATAR_PICKER_KIND || !latest.current.allowed())
                return;
            // The picker needs the pointer the game may be holding.
            document.exitPointerLock?.();
            open.current();
        };
        window.addEventListener("message", receive);
        return () => window.removeEventListener("message", receive);
    }, [game]);
    // A panel over the game holds the page's pause (gamePause.ts); when it
    // closes, the keys go back to the game.
    useEffect(() => {
        if (!picker.isOpen) return;
        const resume = holdGamePause();
        return () => {
            resume();
            latest.current.frame.current?.focus();
        };
    }, [picker.isOpen]);
    return picker.picker;
}
