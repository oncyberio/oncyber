import { useContext } from "react";
import {
    SnackbarContext,
    defaultDuration,
    defaultPosition,
    positions,
    SnackbarType,
    SnackbarPosition,
} from "./Snackbar";

export const DEFAULT_SNACKBAR_DURATION = defaultDuration;

/**
 * Toasts are for things that finished in the background. A failure of
 * something the visitor just did goes beside the control that caused it,
 * with `@ui/components/InlineError`. See docs/feedback.md.
 */
export const useSnackbar = ({
    position = defaultPosition as SnackbarPosition,
    style = {},
    closeStyle = {},
} = {}) => {
    const { openSnackbar, closeSnackbar } = useContext(SnackbarContext);

    if (!positions.includes(position)) {
        position = defaultPosition;
    }

    function open(
        text,
        duration = defaultDuration,
        callback: Function = null,
        type: SnackbarType = "default",
        update = false
    ) {
        openSnackbar(
            text,
            duration,
            position,
            style,
            closeStyle,
            callback,
            type,
            update
        );
    }

    return [open, closeSnackbar] as const;
};
