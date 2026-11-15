// Screen space: the Oncyber page floats its own controls over this frame
// and sends safe-area insets. The watcher turns them into the
// --oncyber-safe-* CSS variables style.css lays the HUD and menus out with;
// inspect() reports where those are, for `pnpm games:check`.
// See docs/games/safe-area.md.
import {
    answerHudRequests,
    hudRects,
    watchSafeArea,
} from "@oncyber/game-runtime/safe-area";

/**
 * `screen` returns the name of the screen that is showing. Called as the
 * host's script starts, before the game exists: the page sends the insets
 * as soon as the game says hello. Ace speaks the contract prefix, so the
 * watcher needs no game id.
 */
export function createHud(screen) {
    const safeArea = watchSafeArea();
    // Every screen's HUD and menus, not just the one showing: the
    // `hud-measure` class lays the hidden screens out for this one reading
    // (nothing is painted in between).
    const inspect = () => {
        document.body.classList.add("hud-measure");
        try {
            return { screen: screen(), hud: hudRects() };
        } finally {
            document.body.classList.remove("hud-measure");
        }
    };
    const stop = answerHudRequests(inspect, { insets: () => safeArea.insets });
    return {
        inspect,
        get insets() {
            return safeArea.insets;
        },
        dispose() {
            stop();
            safeArea.dispose();
        },
    };
}
