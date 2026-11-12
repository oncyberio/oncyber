import {
    mobileDockPanelLayout,
    lobbyPanelSurface,
} from "@features/lobby/lobbyPanelStyles";
import React, { useEffect, useRef } from "react";
import { useMediaQuery } from "@components/hooks/useMediaQuery";
import { nativePhoneControlsQuery } from "@features/content-host/experienceChrome";
import styled, { css } from "styled-components";
import { usePanel } from "../context/PanelProvider";
import IconImg from "@ui/components/IconImg";
import ExperienceControlIcon from "@ui/components/ExperienceControlIcon";
import { brandFoundation } from "@styles/brand";
import VrmsSelection from "./Vrm/Selection";
import Settings from "../Settings";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import NewUploadVrm from "./Vrm/NewUpload";
import { useCyberTranslation } from "@components/context/I18nContext";
import { useVrm } from "@components/context/VrmContext";
import { useWorldState } from "@components/_3DExhibit-v2/hooks/useWorldState";
import { useEventCallback } from "@components/hooks/useEventCallback";

export default function Profile({
    isMobile = false,
    isShowing,
    allowUpload = true,
}) {
    const { clickRef, setCurrentTab, activeProfileTab, setActiveProfileTab } =
        usePanel();
    const { t } = useCyberTranslation();
    const { currentModal, disableCancel, onCancel, onUploadVrm } = useVrm();
    const isUpload = currentModal.type !== "none";
    const worldState = useWorldState();
    const reducedMotion = useReducedMotion();
    const phone = useMediaQuery(nativePhoneControlsQuery);
    const tabsRef = useRef<HTMLDivElement>(null);
    const closeRef = useRef<HTMLButtonElement>(null);

    const onDrop = useEventCallback((event: DragEvent) => {
        if (!allowUpload || worldState.mode !== "display") return;
        event.preventDefault();
        const file = event.dataTransfer.files[0];
        if (file?.name.endsWith(".vrm")) {
            setCurrentTab("profile");
            onUploadVrm(file);
        }
    }, []);
    const onDragOver = useEventCallback((event: DragEvent) => {
        if (worldState.mode === "display") event.preventDefault();
    }, []);

    useEffect(() => {
        document.addEventListener("dragover", onDragOver);
        document.addEventListener("drop", onDrop);
        return () => {
            document.removeEventListener("dragover", onDragOver);
            document.removeEventListener("drop", onDrop);
        };
    }, []);

    useEffect(() => {
        if (!isShowing || isMobile) return;
        const opener = document.activeElement as HTMLElement;
        const frame = requestAnimationFrame(() => {
            const selected = tabsRef.current?.querySelector<HTMLElement>(
                '[aria-selected="true"]'
            );
            (selected || closeRef.current)?.focus();
        });
        return () => {
            cancelAnimationFrame(frame);
            if (opener?.isConnected) opener.focus();
        };
    }, [isShowing, isMobile]);

    const content = (
        <Container
            ref={isMobile ? null : clickRef}
            $embedded={isMobile}
            role={isMobile ? undefined : "dialog"}
            aria-label={isMobile ? undefined : "Avatar and settings"}
            onWheel={(event) => event.stopPropagation()}
            onTouchMove={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
                // Keep native world shortcuts away from focused panel controls.
                event.stopPropagation();
                if (
                    event.key === "Escape" &&
                    !disableCancel &&
                    !event.nativeEvent.isComposing &&
                    event.nativeEvent.keyCode !== 229 &&
                    !event.repeat &&
                    !event.altKey &&
                    !event.ctrlKey &&
                    !event.metaKey &&
                    !event.shiftKey
                ) {
                    event.preventDefault();
                    if (isUpload) onCancel();
                    else setCurrentTab("");
                }
            }}
        >
            {!isMobile && (
                <>
                    <Header>
                        <div className="profile-heading">
                            {isUpload ? (
                                <button
                                    type="button"
                                    aria-label="Back to avatars"
                                    disabled={disableCancel}
                                    onClick={onCancel}
                                >
                                    <IconImg
                                        name="arrow-left"
                                        mode="light"
                                        size={18}
                                    />
                                </button>
                            ) : (
                                <ExperienceControlIcon
                                    name="avatar"
                                    size={24}
                                />
                            )}
                            <h2>
                                {isUpload ? t`CUSTOM_VRM_MODEL` : t`PROFILE`}
                            </h2>
                        </div>
                        <button
                            type="button"
                            ref={closeRef}
                            aria-label="Close avatar and settings"
                            disabled={disableCancel}
                            onClick={() => setCurrentTab("")}
                        >
                            <IconImg name="x" mode="light" size={18} />
                        </button>
                    </Header>
                    {!isUpload && (
                        <Tabs
                            ref={tabsRef}
                            role="tablist"
                            aria-label="Profile options"
                        >
                            {[
                                { id: "profile", label: t`AVATARS` },
                                { id: "settings", label: t`SETTINGS` },
                            ].map(({ id, label }) => (
                                <button
                                    key={id}
                                    type="button"
                                    role="tab"
                                    id={`visitor-profile-tab-${id}`}
                                    aria-controls="visitor-profile-content"
                                    aria-selected={activeProfileTab === id}
                                    tabIndex={activeProfileTab === id ? 0 : -1}
                                    onClick={() => setActiveProfileTab(id)}
                                    onKeyDown={(event) => {
                                        if (
                                            ![
                                                "ArrowLeft",
                                                "ArrowRight",
                                                "Home",
                                                "End",
                                            ].includes(event.key)
                                        )
                                            return;
                                        event.preventDefault();
                                        const next =
                                            event.key === "Home"
                                                ? "profile"
                                                : event.key === "End"
                                                ? "settings"
                                                : id === "profile"
                                                ? "settings"
                                                : "profile";
                                        setActiveProfileTab(next);
                                        tabsRef.current
                                            ?.querySelector<HTMLElement>(
                                                `#visitor-profile-tab-${next}`
                                            )
                                            ?.focus();
                                    }}
                                >
                                    {label}
                                </button>
                            ))}
                        </Tabs>
                    )}
                </>
            )}
            <Body
                className="scrollbar-hidden"
                id="visitor-profile-content"
                role={!isMobile && !isUpload ? "tabpanel" : undefined}
                aria-labelledby={
                    !isMobile && !isUpload
                        ? `visitor-profile-tab-${activeProfileTab}`
                        : undefined
                }
            >
                {activeProfileTab === "profile" ? (
                    isUpload ? (
                        <NewUploadVrm />
                    ) : (
                        <VrmsSelection allowUpload={allowUpload} />
                    )
                ) : (
                    <Settings />
                )}
            </Body>
        </Container>
    );

    if (isMobile) return isShowing ? content : null;
    return (
        <AnimatePresence>
            {isShowing && (
                <Sidebar
                    initial={{
                        opacity: 0,
                        x: reducedMotion || phone ? 0 : 16,
                        y: !reducedMotion && phone ? 10 : 0,
                    }}
                    animate={{ opacity: 1, x: 0, y: 0 }}
                    exit={{
                        opacity: 0,
                        x: reducedMotion || phone ? 0 : 12,
                        y: !reducedMotion && phone ? 10 : 0,
                    }}
                    transition={{
                        duration: reducedMotion ? 0 : 0.22,
                        ease: [0.2, 0.8, 0.2, 1],
                    }}
                >
                    {content}
                </Sidebar>
            )}
        </AnimatePresence>
    );
}

const Sidebar = styled(motion.div)`
    position: fixed;
    z-index: 100000;
    top: 80px;
    right: 16px;
    bottom: max(82px, calc(env(safe-area-inset-bottom) + 70px));
    width: 360px;
    max-width: calc(100vw - 32px);
    pointer-events: auto;
    @media (max-width: 680px) {
        ${mobileDockPanelLayout}
        height: 60svh;
    }
`;

const Container = styled.div<{ $embedded: boolean }>`
    ${brandFoundation}
    ${lobbyPanelSurface}
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    min-height: 0;
    overflow: hidden;
    color: var(--oc-ink);
    text-shadow: none;
    @media (max-width: 680px) {
        border-radius: 16px;
    }
    button,
    input {
        font-family: inherit;
    }
    button {
        cursor: pointer;
    }
    button:disabled {
        cursor: default;
        opacity: 0.4;
    }
    button:focus-visible {
        outline: none;
        box-shadow: inset 0 0 0 1px #ffffff66;
        background-color: var(--oc-hover);
    }
    ${({ $embedded }) =>
        $embedded &&
        css`
            background: transparent;
            border: 0;
            border-radius: 0;
            box-shadow: none;
            height: auto;
            max-height: 100%;
        `}
`;

const Header = styled.header`
    @media (max-width: 680px) {
        && {
            padding: 8px 12px 8px 16px;
            min-height: 56px;
        }
        && h2 {
            font-size: 14px;
        }
        && button {
            width: 40px;
            height: 40px;
        }
    }
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
    padding: 16px 16px 12px 20px;
    .profile-heading {
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
    }
    h2 {
        margin: 0;
        font-size: 16px;
        font-weight: 500;
        line-height: 24px;
    }
    button {
        display: grid;
        place-items: center;
        flex-shrink: 0;
        width: 32px;
        height: 32px;
        padding: 0;
        border: 0;
        border-radius: 10px;
        background: transparent;
        color: var(--oc-secondary);
    }
    button:hover:not(:disabled) {
        background: var(--oc-surface);
    }
`;

const Tabs = styled.div`
    display: flex;
    flex-shrink: 0;
    gap: 4px;
    padding: 4px;
    margin: 0 20px 16px;
    border-radius: 12px;
    background: var(--oc-canvas);
    button {
        flex: 1;
        min-width: 0;
        min-height: 36px;
        padding: 8px 12px;
        border: 0;
        border-radius: 9px;
        color: var(--oc-muted);
        background: transparent;
        font-size: 13px;
        font-weight: 500;
        transition: color 120ms ease, background 120ms ease;
    }
    button[aria-selected="true"] {
        color: var(--oc-ink);
        background: var(--oc-surface);
    }
    button:hover {
        color: var(--oc-ink);
    }
    @media (prefers-reduced-motion: reduce) {
        button {
            transition: none;
        }
    }
`;

const Body = styled.div`
    flex: 1;
    min-height: 0;
    padding: 0 20px 20px;
    overflow-y: auto;
    overscroll-behavior: contain;
    scrollbar-width: none;
    &::-webkit-scrollbar {
        display: none;
    }
    > div {
        height: auto;
        max-height: none;
        overflow: visible;
    }
    h1 {
        font-size: 13px;
        font-weight: 500;
        text-transform: none;
    }
    /* Existing settings keep their actions and share this panel's quiet surfaces. */
    [class*="radio-circle-wrapper"] {
        border-color: var(--oc-line-strong);
    }
    [class*="radio-circle-wrapper"] + div {
        color: var(--oc-secondary);
    }
    .input {
        border-radius: 12px;
    }
`;
