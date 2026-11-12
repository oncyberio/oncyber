import dynamic from "next/dynamic";
import React, { createContext, CSSProperties, useRef, useState } from "react";
import { CSSTransition } from "react-transition-group";

const Portal = dynamic(import("./Portal"), { ssr: false });

// Snackbar default values
export const defaultPosition = "top-right" as const;
export const defaultDuration = 5000;
export const defaultInterval = 250;
export const positions = [
    "top-left",
    "top-center",
    "top-right",
    "bottom-left",
    "bottom-center",
    "bottom-right",
] as const;

export interface SnackbarContextState {
    openSnackbar: (
        text: string,
        duration: number,
        position: SnackbarPosition,
        style: CSSProperties,
        closeStyle: CSSProperties,
        callback: Function,
        type: SnackbarType,
        update?: boolean
    ) => void;
    closeSnackbar: () => void;
}

export const SnackbarContext = createContext<SnackbarContextState>(null);

export type SnackbarType = "default" | "error" | "warning" | "success" | "info";

export type SnackbarPosition = typeof positions[number];

export default function Snackbar({ children }) {
    const [open, setOpen] = useState(false);
    const [timeoutId, setTimeoutId] = useState(null);
    const [text, setText] = useState("");
    const [duration, setDuration] = useState(defaultDuration);
    const [position, setPosition] = useState<SnackbarPosition>(defaultPosition);
    const [customStyles, setCustomStyles] = useState<CSSProperties>({});
    const [closeCustomStyles, setCloseCustomStyles] = useState<CSSProperties>(
        {}
    );

    const [snackbarType, setSnackbarType] = useState<SnackbarType>("default");

    const [hasUndo, setHasUndo] = useState(false);

    const buttonRef = useRef(null);

    const triggerSnackbar = (
        text: string,
        duration: number,
        position: SnackbarPosition,
        style: CSSProperties,
        closeStyle: CSSProperties,
        callback: Function,
        type: SnackbarType
    ) => {
        setText(text);
        setDuration(duration);
        setPosition(position);
        setCustomStyles(style);
        setCloseCustomStyles(closeStyle);
        setOpen(true);
        setSnackbarType(type);

        if (callback) {
            setHasUndo(true);
            // buttonRef.current.addEventListener("click", async () => {
            //     callback();
            //     closeSnackbar();
            // });
        } else {
            setHasUndo(false);
        }
    };

    const openSnackbar = (
        value: string | Error,
        duration: number,
        position: SnackbarPosition,
        style: CSSProperties,
        closeStyle: CSSProperties,
        callback: Function,
        type: SnackbarType,
        update = false
    ) => {
        const msg = (
            type === "error" && value instanceof Error ? value?.message : value
        ) as string;

        if (open === true && !update) {
            setOpen(false);
            setTimeout(() => {
                triggerSnackbar(
                    msg,
                    duration,
                    position,
                    style,
                    closeStyle,
                    callback,
                    type
                );
            }, defaultInterval);
        } else {
            triggerSnackbar(
                msg,
                duration,
                position,
                style,
                closeStyle,
                callback,
                type
            );
        }
    };

    const closeSnackbar = () => {
        setOpen(false);
    };

    const { top, left, right, bottom, ...rest } = customStyles;

    let containerStyle = {
        ...(top && { top }),
        ...(left && { left }),
        ...(right && { right }),
        ...(bottom && { bottom }),
    };

    return (
        <SnackbarContext.Provider value={{ openSnackbar, closeSnackbar }}>
            {children}

            <Portal>
                <CSSTransition
                    in={open}
                    timeout={150}
                    mountOnEnter
                    unmountOnExit
                    onEnter={() => {
                        clearTimeout(timeoutId);
                        setTimeoutId(
                            setTimeout(() => setOpen(false), duration)
                        );
                    }}
                    className={`snackbar-wrapper snackbar-wrapper-${position}`}
                    classNames={{
                        enter: `snackbar-enter snackbar-enter-${position}`,
                        enterActive: `snackbar-enter-active snackbar-enter-active-${position}`,
                        exitActive: `snackbar-exit-active snackbar-exit-active-${position}`,
                    }}
                    style={containerStyle}
                >
                    <div>
                        <div
                            className={`snackbar snackbar-${snackbarType}`}
                            style={rest}
                        >
                            <div className="snackbar__text">{text}</div>

                            {/* {hasUndo ? (
                            <button
                                className="snackbar__close undo"
                                ref={buttonRef}
                            >
                                Undo
                            </button>
                        ) : null} */}

                            <button
                                onClick={closeSnackbar}
                                className="snackbar__close"
                                style={closeCustomStyles}
                            >
                                <CloseIcon />
                            </button>
                        </div>
                    </div>
                </CSSTransition>
            </Portal>
        </SnackbarContext.Provider>
    );
}

// CloseIcon SVG is styled with font properties
const CloseIcon = () => (
    <svg width="1em" height="1em" viewBox="0 0 12 12">
        <path
            fill="currentColor"
            d="M11.73 1.58L7.31 6l4.42 4.42-1.06 1.06-4.42-4.42-4.42 4.42-1.06-1.06L5.19 6 .77 1.58 1.83.52l4.42 4.42L10.67.52z"
            fillRule="evenodd"
        />
    </svg>
);
