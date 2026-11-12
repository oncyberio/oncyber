import { useCallback, useContext, useRef } from "react";
import {
    SnackbarContext,
    defaultDuration,
    defaultPosition,
} from "@components/Snackbar/Snackbar";

/** How long a lobby toast stays before it goes away by itself. */
export const LOBBY_TOAST_MS = defaultDuration;

/**
 * The app's toast (`@components/Snackbar`), for news about work the visitor
 * is not watching: see docs/feedback.md. It goes away by itself.
 *
 * This reads the provider directly because `useSnackbar` throws without one.
 * Outside the app shell (a test, a dev harness) the returned function does
 * nothing. The toast has no live region of its own, so the caller also puts
 * the text in a `role="status"` element for screen readers.
 */
export default function useLobbyToast() {
    const snackbar = useContext(SnackbarContext);
    const latest = useRef(snackbar);
    latest.current = snackbar;
    return useCallback((text: string) => {
        latest.current?.openSnackbar(
            text,
            LOBBY_TOAST_MS,
            defaultPosition,
            {},
            {},
            null,
            "default"
        );
    }, []);
}
