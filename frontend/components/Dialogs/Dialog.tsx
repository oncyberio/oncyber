import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import styled from "styled-components";
import ReactDOM from "react-dom";
import { noop } from "@utils/js";
import { useEventCallback } from "@components/hooks/useEventCallback";
import {
    escapeInsideWindow,
    openWindow,
    StackedWindow,
} from "@utils/windowStack";
import {
    ColorScheme,
    ColorSchemeName,
    DialogTheme,
    DIALOG_COLOR_SCHEMES,
    darkDialogContainer,
    dialogSurface,
} from "./styles";

export interface UserDialogProps {
    id?: any;
    style?: object;
    overlayStyle?: object;
    isModal?: boolean;
    className?: string;
    /** The container's colour scheme. `showModal` defaults to the page's. */
    theme?: DialogTheme;
    /**
     * What Escape answers for a dialog that a click outside cannot dismiss:
     * a confirm answers "no", a prompt answers "cancelled". Leave unset and
     * a modal dialog ignores Escape (for example while work is in progress).
     */
    escape?: { result: unknown };
}

export interface DialogProps extends UserDialogProps {
    show?: boolean;
    onHide?: () => unknown;
    /** Runs `escape`'s answer; set by the provider. */
    onEscape?: () => unknown;
    children: React.ReactNode;
}

let dialogRoot: HTMLDivElement;

function getDialogRoot() {
    //
    if (dialogRoot == null) {
        dialogRoot = document.createElement("div");
        dialogRoot.id = "dialogs-root";
        document.body.appendChild(dialogRoot);
    }

    return dialogRoot;
}

export function Dialog({
    style = {},
    overlayStyle = {},
    show = true,
    onHide = noop,
    onEscape,
    isModal = false,
    // Dialogs are dark everywhere; light is opt-in.
    theme = DIALOG_COLOR_SCHEMES.dark,
    children,
    className = "",
}: DialogProps) {
    //

    if (!show) return null;

    const handleHide = useEventCallback(() => {
        //
        if (!isModal) {
            onHide();
        }
    }, []);

    const cssVars = useMemo(() => {
        return typeof theme === "string" ? DIALOG_COLOR_SCHEMES[theme] : theme;
    }, [theme]);

    // Escape does what a click outside does: it dismisses the dialog. One a
    // click cannot dismiss answers Escape only if it says how (`escape`).
    // Dialogs join the same stack as the other windows, so the top-most one
    // answers first (see @utils/windowStack).
    const containerRef = useRef<HTMLDivElement>(null);
    const latest = useRef({ isModal, onEscape });
    latest.current = { isModal, onEscape };
    const [stackedWindow] = useState<StackedWindow>(() => ({
        contains: (node) => !!containerRef.current?.contains(node),
        canClose: () => !latest.current.isModal || !!latest.current.onEscape,
        close: () =>
            latest.current.onEscape ? latest.current.onEscape() : handleHide(),
    }));
    useEffect(() => openWindow(stackedWindow), []);

    return ReactDOM.createPortal(
        <>
            <Overlay
                style={overlayStyle || {}}
                onClick={handleHide}
                onTouchStart={handleHide}
            />
            <Container
                ref={containerRef}
                style={{ ...style, ...cssVars }}
                className={className}
                onKeyDown={(event) => escapeInsideWindow(stackedWindow, event)}
            >
                {children}
            </Container>
        </>,

        getDialogRoot()
    );
}

const Overlay = styled.div`
    position: fixed;
    width: 100%;
    top: 0;
    left: 0;
    height: 100vh;
    background: none;
    backdrop-filter: brightness(70%);
`;

const Container = styled.div<DialogProps>`
    //

    position: fixed;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    margin: 0;
    padding: 0;

    ${dialogSurface}

    /* Content that is dark on every page (DARK_DIALOG_CONTENT). */
    &:has(> [data-dialog-surface="dark"]) {
        ${darkDialogContainer}
    }

    overflow: auto;
    max-width: 90%;
    max-height: 95vh;

    & .dialog-icon {
        filter: invert(var(--img-invert));
    }

    @media (max-width: 800px) {
        max-width: 95%;
    }

    &::-webkit-scrollbar {
        width: 7px !important;
        background-color: transparent;
    }

    &::-webkit-scrollbar-thumb {
        width: 7px !important;
        border-radius: 8px;
        background: var(--field-border-color, #d0d3d4);
    }

    &::-webkit-scrollbar-track {
        margin-top: 10px;
        margin-bottom: 10px;
    }

    @keyframes show {
        0% {
            opacity: 0;
        }

        100% {
            opacity: 1;
        }
    }
    @keyframes toTop {
        0% {
            opacity: 0;
            top: 150%;
        }
        70% {
            opacity: 1;
        }
        100% {
            opacity: 1;
            top: 50%;
        }
    }
`;
