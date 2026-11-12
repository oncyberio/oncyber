import React, { CSSProperties, useEffect, useRef, useState } from "react";
import styled, { css } from "styled-components";
import ReactDOM from "react-dom";
import { Theme } from "@ui/types";
import Icon from "../Icon";
import { useDialog } from "@components/Dialogs";
import { darkDialogSurface } from "@components/Dialogs/styles";
import { classes } from "@utils/js";
import {
    closesOnEscape,
    escapeInsideWindow,
    openWindow,
    StackedWindow,
} from "@utils/windowStack";

interface ModalProps {
    style?: CSSProperties;
    hasRoot?: boolean;
    setShow?: Function;
    animation?: string;
    isShowing?: boolean;
    isClearBg?: boolean;
    isBackdrop?: boolean;
    noBackdrop?: boolean;
    noShowClose?: boolean;
    isCloseRight?: boolean;
    hasBackground?: boolean;
    size?: "wide" | "medium" | "";
    isFullscreen?: boolean;
    isHalfScreen?: boolean;
    overlayStyle?: object;
    overrideTheme?: Theme;
    resetCallback?: Function;
    toggle?: (b?: boolean) => void;
    rootRef?: React.MutableRefObject<any>;
    forceOpen?: boolean;
    children: React.ReactNode;
    closeStyle?: CSSProperties;
    iconCloseSize?: string;
    isMobileResponsive?: boolean;
    className?: string;
    ariaLabel?: string;
    /**
     * Escape closes a window that shows a close button or a backdrop, by the
     * same path. Pass `false` while something irreversible is running, or
     * `true` when the only close control is inside the content.
     */
    closeOnEscape?: boolean;
    /** Set by AnimatedModal while the closing animation plays. */
    isExiting?: boolean;
}

type ModalCloseProps = {
    isRight: boolean;
    isClearBg: boolean;
    isFullscreen: boolean;
};

const Modal: React.FunctionComponent<ModalProps> = ({
    isShowing,
    children,
    style,
    toggle,
    setShow,
    isCloseRight,
    noShowClose,
    isClearBg,
    isBackdrop,
    isFullscreen,
    isHalfScreen,
    resetCallback,
    animation,
    rootRef,
    size,
    overlayStyle,
    overrideTheme,
    forceOpen,
    closeStyle = {},
    iconCloseSize = "14px",
    isMobileResponsive,
    className = "",
    ariaLabel,
    closeOnEscape,
    isExiting,
}) => {
    const modalRef = useRef<HTMLDivElement>();
    const dismissRef = useRef<() => void>();
    dismissRef.current = () => {
        resetCallback?.();
        if (toggle) toggle(false);
        else setShow?.(false);
    };

    const dialog = useDialog();

    // Escape closes the top-most open window by its own close path. A window
    // with no close control ignores it on purpose. See @utils/windowStack.
    const canEscapeRef = useRef(false);
    canEscapeRef.current = closesOnEscape({
        forceOpen,
        hasClosePath: !!(toggle || setShow),
        hasCloseButton: !!toggle && !noShowClose,
        hasBackdropClose: !!isBackdrop,
        labelled: !!ariaLabel,
        closeOnEscape,
    });
    const coveredRef = useRef(false);
    coveredRef.current = dialog.modals?.length > 0;
    const [stackedWindow] = useState<StackedWindow>(() => ({
        contains: (node) => !!modalRef.current?.contains(node),
        canClose: () => canEscapeRef.current,
        close: () => dismissRef.current?.(),
        // A shared dialog opened above this window closes first.
        isCovered: () => coveredRef.current,
    }));
    useEffect(() => {
        if (!isShowing || isExiting) return;
        return openWindow(stackedWindow);
    }, [isShowing, isExiting]);

    // Named dialogs opt into keyboard focus containment and focus return.
    useEffect(() => {
        if (!isShowing || !ariaLabel) return;
        const previousFocus = document.activeElement as HTMLElement;
        const container = modalRef.current;
        const focusable = () =>
            Array.from(
                container?.querySelectorAll<HTMLElement>(
                    'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]'
                ) || []
            ).filter((element) => element.getClientRects().length > 0);
        (focusable()[0] || container)?.focus();
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key !== "Tab") return;
            const elements = focusable();
            const first = elements[0];
            const last = elements[elements.length - 1];
            if (!first) {
                event.preventDefault();
                container?.focus();
            } else if (
                event.shiftKey &&
                (document.activeElement === first ||
                    !container?.contains(document.activeElement))
            ) {
                event.preventDefault();
                last.focus();
            } else if (
                !event.shiftKey &&
                (document.activeElement === last ||
                    !container?.contains(document.activeElement))
            ) {
                event.preventDefault();
                first.focus();
            }
        };
        document.addEventListener("keydown", handleKeyDown, true);
        return () => {
            document.removeEventListener("keydown", handleKeyDown, true);
            previousFocus?.focus();
        };
    }, [isShowing, ariaLabel, forceOpen]);

    useEffect(() => {
        if (isShowing || dialog.modals?.length > 0) {
            document.body.style.overflow = "hidden";
        }

        return () => {
            if (dialog.modals?.length === 0) {
                document.body.style.overflow = "unset";
            }
        };
    }, [isShowing, dialog.modals?.length]);

    useEffect(() => {
        const handleCloseModal = (event) => {
            if (
                setShow &&
                isShowing &&
                !modalRef?.current?.contains(event.target)
            ) {
                setShow(false);
                resetCallback?.();
            }
        };
        document.addEventListener("mousedown", handleCloseModal);
        return () =>
            document.removeEventListener("mousedown", handleCloseModal);
    }, [isShowing, setShow]);

    return isShowing
        ? ReactDOM.createPortal(
              <React.Fragment>
                  <Overlay
                      style={overlayStyle || {}}
                      onClick={() => {
                          if (!forceOpen && toggle) toggle(!isShowing);
                      }}
                      onTouchStart={() => {
                          if (!forceOpen && toggle) toggle(!isShowing);
                      }}
                      isBackdrop={isBackdrop}
                      className="overload"
                  />

                  <Container
                      isMobileResponsive={isMobileResponsive}
                      style={style}
                      forceOpen={forceOpen}
                      ref={modalRef}
                      size={size}
                      hasRoot={!!rootRef?.current}
                      isHalfScreen={isHalfScreen}
                      className={classes({
                          "modal-container": true,
                          [className]: !!className,
                      })}
                      isFullscreen={isFullscreen}
                      overrideTheme={overrideTheme}
                      animation={animation || "default"}
                      role="dialog"
                      aria-modal="true"
                      aria-label={ariaLabel}
                      tabIndex={-1}
                      onKeyDown={(event) =>
                          escapeInsideWindow(stackedWindow, event)
                      }
                  >
                      {toggle && !noShowClose && (
                          <CloseButton
                              type="button"
                              aria-label="Close dialog"
                              isClearBg={isClearBg}
                              isFullscreen={isFullscreen}
                              isRight={isCloseRight}
                              style={closeStyle}
                              onClick={() => {
                                  resetCallback?.();
                                  toggle();
                              }}
                          >
                              <Icon name="close" width={iconCloseSize} />
                          </CloseButton>
                      )}
                      {children}
                  </Container>
              </React.Fragment>,
              rootRef?.current || document?.body
          )
        : null;
};

Modal.defaultProps = {
    resetCallback: () => {},
};

const Container = styled.div<ModalProps>`
    z-index: 100000;
    position: fixed;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    background: ${(props) => props.theme.background || "black"};
    opacity: 1;
    box-shadow: 0em 0.5em 1.5em rgba(124, 124, 124, 0.2);
    overflow-y: auto;
    background: ${({ theme, overrideTheme }) =>
        !overrideTheme
            ? theme.background
            : overrideTheme === "light"
            ? "#fff"
            : "#212127"};

    &::-webkit-scrollbar {
        width: 7px !important;
        background-color: transparent;
    }

    &::-webkit-scrollbar-thumb {
        width: 7px !important;
        border-radius: 8px;
        background: ${({ theme, overrideTheme }) =>
            (overrideTheme ? overrideTheme : theme.type) === "light"
                ? "#d0d3d4"
                : "#333333"};
    }

    &::-webkit-scrollbar-track {
        margin-top: 10px;
        margin-bottom: 10px;
    }

    ${(props) =>
        props.hasRoot &&
        css`
            position: absolute;
        `}

    ${(props) =>
        props.isFullscreen &&
        css`
            width: 100%;
            height: -moz-available; /* WebKit-based browsers will ignore this. */
            height: -webkit-fill-available; /* Mozilla-based browsers will ignore this. */
            height: fill-available;

            height: 100%;
        `}

    ${(props) =>
        props.size === "wide" &&
        css`
            width: 90%;
            top: 50%;
            max-width: 870px;
            margin-bottom: 30px;
            max-height: 934px;

            @media (max-width: 830px) {
                margin-left: 0;
                max-height: 90%;
                width: 95%;
            }
        `}

        ${(props) =>
        props.size === "medium" &&
        css`
            width: 90%;
            max-width: 600px;
            margin-bottom: 30px;
            top: 50%;
            max-height: 95vh;

            @media (max-width: 800px) {
                margin-left: 0;
                width: 95%;
            }
        `}


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

    @media (max-width: 450px) {
        ${(props) => {
            if (props.isMobileResponsive) {
                return css`
                    border-bottom-left-radius: 0 !important;
                    border-bottom-right-radius: 0 !important;
                    width: 100%;
                    bottom: 0;
                    transform: translate(-50%, 0);
                    margin-bottom: 0;
                    height: 80vh;
                    top: auto;
                `;
            }
        }}
    }

    /* The shared dark dialog surface: pass className="dialog-window". */
    &.dialog-window {
        ${darkDialogSurface}
    }
`;

const Overlay = styled.div<{ isBackdrop: boolean }>`
    position: fixed;
    width: 100%;
    height: 100vh;
    ${(props) =>
        props.isBackdrop &&
        css`
            background: rgba(0, 0, 0, 0.3);
        `}
    top: 0;
    left: 0;
    z-index: 99999;
`;

const CloseButton = styled.button<ModalCloseProps>`
    outline: none;
    border: none;
    padding: 10px 20px;
    color: white;
    cursor: pointer;
    position: absolute;
    height: 50px;
    width: 50px;
    border-radius: 50px;
    background: #fff;
    padding: 0;
    z-index: 101;
    left: 25px;
    top: 20px;

    &:focus-visible {
        outline: 2px solid #2567ff;
        outline-offset: 2px;
    }

    ${(props) =>
        props.isRight &&
        css`
            right: 25px;
            left: auto;
        `}

    ${(props) =>
        props.isClearBg &&
        css`
            background: transparent;
            img {
                filter: invert(1);
            }
        `}

    ${(props) =>
        !props?.isFullscreen &&
        css`
            height: 42px;
            width: 42px;
        `}

    @media (max-width: 800px) {
        width: 40px;
        height: 40px;
        background: white;
        padding: 2px;

        ${(props) =>
            props.isClearBg &&
            css`
                background: transparent;
            `}
    }
`;

export default Modal;

Modal.defaultProps = { size: "", isFullscreen: false };
