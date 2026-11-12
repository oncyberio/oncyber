import { passwordRefusalMessage } from "@components/_3DExhibit-v2/utils/gating";
import { goToExperience } from "@utils/experienceNavigation";
import React, { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useRouter } from "next/router";
import dynamic from "next/dynamic";
import styled, { createGlobalStyle } from "styled-components";
import { readVoiceDebug } from "@utils/voiceChat/levels";
import { useMultiplayer } from "@components/_3DExhibit-v2/context/MultiplayerProvider";
import {
    connectionRecovery,
    isEndReason,
    type MultiplayerConnection,
} from "@components/_3DExhibit-v2/context/multiplayerConnection";
import { useWorld } from "@components/_3DExhibit-v2/hooks/useWorld";
import {
    Mode,
    usePanel,
} from "@components/_3DExhibit-v2/ui/ControlPanel/context/PanelProvider";
import type { SpacePanel } from "@components/_3DExhibit-v2/ui/ControlPanel/context/spacePanelMachine";
import { EMOTES } from "@components/_3DExhibit-v2/three/factory/player/instanceavatarvrm/constants";
import { showPrompt } from "@components/Dialogs";
import { useMediaQuery } from "@components/hooks/useMediaQuery";
import {
    nativeCompactControlsQuery,
    nativePhoneControlsQuery,
} from "./experienceChrome";
import EmotePanel from "@features/lobby/EmotePanel";
import {
    mobileDockPanelLayout,
    mobileDockPanelMotion,
    lobbyPanelIconButton,
} from "@features/lobby/lobbyPanelStyles";
import LobbyExplorePanel from "@features/lobby/LobbyExplorePanel";
import type { LobbyDestination } from "@features/lobby/sceneTypes";
import NativeVisitorPanel, {
    nativePanelTitles,
    nativeUtilitySurface,
} from "./NativeVisitorPanel";
import ExperienceShell, {
    ExperienceIcon,
    ExperiencePanel,
    ExperienceShellAction,
    ExperienceShellProps,
} from "./ExperienceShell";

/**
 * Why the visitor is offline, for each way a connection can end. The action
 * that goes with it comes from `connectionRecovery`.
 */
const OFFLINE_REASON: Partial<Record<MultiplayerConnection, string>> = {
    failed: "Couldn’t connect.",
    lost: "Connection lost.",
    removed: "The owner removed you from this world.",
    "password-changed": "The password changed. Enter the new one.",
    inactive: "You were away for a while.",
};

// How long a notice above the dock stays when nothing else clears it.
const NOTICE_MS = 8000;

// The voice level readout, for tuning who counts as speaking. Loaded only
// for a visit whose URL has `?voiceDebug`; every other visit never fetches it.
const VoiceLevelDebug = dynamic(
    () => import("@utils/voiceChat/VoiceLevelDebug"),
    { ssr: false }
);

/** Adapt native gallery controls without replacing its engine, panels or admission. */
export default function NativeExperienceChrome({
    exhibit,
    children,
    mobile = false,
    onEmote,
}: {
    exhibit: { id?: string; info?: { headline?: string } };
    children?: React.ReactNode;
    mobile?: boolean;
    onEmote?: (index: number, name: string) => Promise<void> | void;
}) {
    const router = useRouter();
    const compactControls = useMediaQuery(nativeCompactControlsQuery);
    const phoneControls = useMediaQuery(nativePhoneControlsQuery);
    const world = useWorld();
    const { voice, room, chat, onConnect, connection, rejoin, enterPassword } =
        useMultiplayer();
    const {
        currentTab,
        setCurrentTab,
        spacePanel,
        dispatchSpacePanel,
        selectedMode,
        settings,
        handleSettings,
        addTogglerRef,
        setActiveProfileTab,
    } = usePanel();
    // One value says which panel is open, so opening one closes the others.
    const emotesOpen = spacePanel === "emotes";
    const moreOpen = spacePanel === "more";
    const searchOpen = spacePanel === "search";
    const setDockPanel =
        (panel: "emotes" | "more" | "search") => (open: boolean) =>
            dispatchSpacePanel(
                open ? { type: "open", panel } : { type: "close", panel }
            );
    const setEmotesOpen = setDockPanel("emotes");
    const setMoreOpen = setDockPanel("more");
    const setSearchOpen = setDockPanel("search");
    // Stays mounted after the first open so the query and results survive.
    const [searchMounted, setSearchMounted] = useState(false);
    const searchButton = useRef<HTMLButtonElement>(null);
    const searchPanel = useRef<HTMLDivElement>(null);
    const restoreSearchFocus = useRef(false);
    const emoteButton = useRef<HTMLButtonElement>(null);
    const moreButton = useRef<HTMLButtonElement>(null);
    const phoneChatOpen = phoneControls && chat.isMobileChatOpen;
    const chatButton = useRef<HTMLButtonElement>(null);
    const emoteReturnFocus = compactControls ? moreButton : emoteButton;
    const emotePanel = useRef<HTMLElement>(null);
    const restoreEmoteFocus = useRef(false);
    const morePanel = useRef<HTMLDivElement>(null);
    const closeEmotes = () => {
        restoreEmoteFocus.current = true;
        setEmotesOpen(false);
    };
    useEffect(() => {
        if (!emotesOpen && restoreEmoteFocus.current) {
            restoreEmoteFocus.current = false;
            emoteReturnFocus.current?.focus();
        }
    }, [emotesOpen, emoteReturnFocus]);
    const closePhoneChat = () => {
        if (!phoneControls) return;
        chat.setIsMobileChatOpen(false);
        chat.setIsTyping(false);
    };
    useEffect(() => {
        if (!phoneChatOpen) return;
        dispatchSpacePanel({ type: "close" });
    }, [phoneChatOpen]);
    const openSearch = () => {
        closePhoneChat();
        document.exitPointerLock?.();
        setSearchMounted(true);
        dispatchSpacePanel({ type: "open", panel: "search" });
    };
    const closeSearch = () => {
        // The dock is hidden while search is open; focus it once it returns.
        restoreSearchFocus.current = true;
        setSearchOpen(false);
    };
    useEffect(() => {
        if (!searchOpen && restoreSearchFocus.current) {
            restoreSearchFocus.current = false;
            searchButton.current?.focus();
        }
    }, [searchOpen]);
    const selectDestination = (destination: LobbyDestination) => {
        setSearchOpen(false);
        goToExperience(destination.href, (href) => router.push(href));
    };
    useEffect(() => {
        if (!searchOpen) return;
        const dismiss = (event: PointerEvent) => {
            const target = event.target as Node;
            if (
                [searchPanel, searchButton].some((ref) =>
                    ref.current?.contains(target)
                )
            )
                return;
            setSearchOpen(false);
        };
        document.addEventListener("pointerdown", dismiss);
        return () => document.removeEventListener("pointerdown", dismiss);
    }, [searchOpen]);
    // Why the last voice or sharing request could not be sent, said above
    // the dock (docs/feedback.md). It goes on the next dock action, when a
    // moderator arrives, or after a while.
    const [notice, setNotice] = useState("");
    const hasModerator = chat.admins?.length > 0;
    useEffect(() => {
        if (hasModerator) setNotice("");
    }, [hasModerator]);
    useEffect(() => {
        if (!notice) return;
        const timer = setTimeout(() => setNotice(""), NOTICE_MS);
        return () => clearTimeout(timer);
    }, [notice]);
    // Read after the first render, so the server and the browser agree.
    const [voiceDebug, setVoiceDebug] = useState(false);
    useEffect(() => {
        setVoiceDebug(readVoiceDebug(window.location.search) != null);
    }, []);
    const multiplayer = selectedMode === Mode.MULTIPLAYER;
    // The prompt stays open across renders: it calls the latest one.
    const submitPassword = useRef(enterPassword);
    submitPassword.current = enterPassword;
    const askPassword = () => {
        document.exitPointerLock?.();
        void showPrompt({
            type: "password",
            message: OFFLINE_REASON["password-changed"],
            onSubmit: async (value) => {
                const refused = await submitPassword.current(value);
                if (refused)
                    throw new Error(
                        refused === "password-error" ||
                        refused === "too-many-attempts-error"
                            ? passwordRefusalMessage(refused)
                            : "Couldn’t check the password. Try again."
                    );
            },
        });
    };
    const recovery = connectionRecovery(connection);
    const offline = OFFLINE_REASON[connection];
    // Solo has no connection, and "idle" has not tried one: say nothing
    // there rather than a false "offline". An ending the visitor did not
    // choose is explained in any mode: being away leaves the panel in solo.
    const presence: ExperienceShellProps["connection"] =
        !multiplayer && !isEndReason(connection)
            ? undefined
            : connection === "connected"
            ? { state: "connected", count: Math.max(1, room.numOfUsers || 0) }
            : connection === "connecting"
            ? { state: "connecting" }
            : offline
            ? {
                  state: "offline",
                  reason: offline,
                  action:
                      recovery === "password"
                          ? { label: "Enter password", onClick: askPassword }
                          : recovery === "rejoin"
                          ? {
                                label:
                                    connection === "failed"
                                        ? "Try again"
                                        : "Rejoin",
                                onClick: () => void rejoin(),
                            }
                          : undefined,
              }
            : undefined;
    const micOn =
        voice?.voiceState?.type === "enabled" &&
        !voice.voiceState.state.isMuted;
    const toggleTab = (panel: Exclude<SpacePanel, "">) => {
        closePhoneChat();
        document.exitPointerLock?.();
        dispatchSpacePanel({ type: "toggle", panel });
    };
    useEffect(() => {
        if (!emotesOpen && !moreOpen) return;
        const close = (event: KeyboardEvent) => {
            if (
                event.key !== "Escape" ||
                event.isComposing ||
                event.defaultPrevented
            )
                return;
            event.preventDefault();
            if (emotesOpen) closeEmotes();
            else {
                setMoreOpen(false);
                moreButton.current?.focus();
            }
        };
        const dismiss = (event: PointerEvent) => {
            const target = event.target as Node;
            if (
                [morePanel, emotePanel, moreButton, emoteButton].some((ref) =>
                    ref.current?.contains(target)
                )
            )
                return;
            dispatchSpacePanel({
                type: "close",
                panel: emotesOpen ? "emotes" : "more",
            });
        };
        window.addEventListener("keydown", close);
        document.addEventListener("pointerdown", dismiss);
        return () => {
            window.removeEventListener("keydown", close);
            document.removeEventListener("pointerdown", dismiss);
        };
    }, [emotesOpen, moreOpen]);
    useEffect(() => {
        if (!multiplayer) return;
        const key = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement;
            if (
                event.defaultPrevented ||
                event.repeat ||
                event.isComposing ||
                event.metaKey ||
                event.ctrlKey ||
                event.altKey ||
                target?.closest?.(
                    "input, textarea, select, button, [contenteditable='true']"
                )
            )
                return;
            if (
                event.key.toLowerCase() === "m" &&
                voice?.voiceState?.type === "enabled"
            )
                void voice.toggleMuted();
        };
        window.addEventListener("keydown", key);
        return () => window.removeEventListener("keydown", key);
    }, [multiplayer, voice]);
    const actions: ExperienceShellAction[] = [
        {
            id: "voice",
            label: !multiplayer
                ? "Voice is available in Multiplayer mode"
                : voice?.voiceState?.type === "pending"
                ? "Request sent · Cancel"
                : voice?.voiceState?.type === "disabled"
                ? "Request to speak"
                : micOn
                ? "Mute microphone"
                : "Enable microphone",
            icon: multiplayer && micOn ? "mic" : "mic-off",
            active: multiplayer && micOn,
            disabled: !multiplayer || !voice || voice.loading,
            onClick: () => {
                if (!multiplayer || !voice) return;
                if (voice.voiceState.type === "disabled") {
                    if (!chat.admins.length) {
                        setNotice(
                            "No moderator is available to allow voice right now."
                        );
                        return;
                    }
                    void voice.requestVoicePermission("mic");
                } else if (voice.voiceState.type === "pending")
                    void voice.cancelVoicePermissionRequest();
                else if (voice.voiceState.type === "enabled")
                    void voice.toggleMuted();
            },
        },
        ...(phoneControls && multiplayer
            ? [
                  {
                      id: "chat",
                      label: phoneChatOpen ? "Close chat" : "Open chat",
                      icon: phoneChatOpen ? "x" : "message-circle",
                      expanded: !!phoneChatOpen,
                      controls: "native-room-chat",
                      disabled: chat.active === false,
                      buttonRef: chatButton,
                      onClick: () => {
                          document.exitPointerLock?.();
                          // Commit before focusing so iOS opens its keyboard in this tap.
                          flushSync(() => {
                              dispatchSpacePanel({ type: "close" });
                              chat.setIsChatDisplayed(true);
                              chat.setIsMobileChatOpen(!phoneChatOpen);
                              if (phoneChatOpen) chat.setIsTyping(false);
                          });
                          if (!phoneChatOpen)
                              document
                                  .querySelector<HTMLInputElement>(
                                      ".chat-container input"
                                  )
                                  ?.focus();
                      },
                  },
              ]
            : []),
        {
            id: "avatar",
            label:
                phoneControls && currentTab === "profile"
                    ? "Close avatars"
                    : "Avatars",
            icon: phoneControls && currentTab === "profile" ? "x" : "user",
            active: currentTab === "profile",
            onClick: () => {
                setActiveProfileTab("profile");
                toggleTab("profile");
            },
        },
        {
            id: "emotes",
            label: phoneControls && emotesOpen ? "Close animations" : "Emotes",
            icon: phoneControls && emotesOpen ? "x" : "smile",
            active: emotesOpen,
            expanded: emotesOpen,
            controls: "native-emotes",
            buttonRef: emoteButton,
            onClick: () => {
                closePhoneChat();
                document.exitPointerLock?.();
                dispatchSpacePanel({ type: "toggle", panel: "emotes" });
            },
        },
        ...(multiplayer
            ? [
                  {
                      id: "people",
                      label: "Users list",
                      icon: "users",
                      active: currentTab === "users",
                      // Agrees with the line under the title: a count only
                      // while connected, a dash as in the lobby otherwise.
                      badge: !presence
                          ? room.numOfUsers
                          : presence.state === "connected"
                          ? presence.count
                          : "—",
                      onClick: () => toggleTab("users"),
                  },
              ]
            : []),
        {
            id: "search",
            label: "Search worlds",
            icon: "search",
            active: searchOpen,
            expanded: searchOpen,
            controls: "lobby-explore",
            buttonRef: searchButton,
            onClick: () => (searchOpen ? closeSearch() : openSearch()),
        },
        {
            id: "more",
            label: phoneControls && moreOpen ? "Close More" : "More",
            icon: phoneControls && moreOpen ? "x" : "dashboard",
            active: moreOpen,
            expanded: moreOpen,
            controls: "native-more-options",
            buttonRef: moreButton,
            onClick: () => {
                closePhoneChat();
                document.exitPointerLock?.();
                dispatchSpacePanel({ type: "toggle", panel: "more" });
            },
        },
    ];
    const secondaryActions = actions.filter(
        (action) =>
            (compactControls && ["avatar", "emotes"].includes(action.id)) ||
            (phoneControls && action.id === "people")
    );
    const dockActions = actions
        .filter((action) => !secondaryActions.includes(action))
        .map((action) => ({
            ...action,
            concealed: phoneChatOpen && !["voice", "chat"].includes(action.id),
        }));
    return (
        <NativeChromeFrame
            data-machine="space-panel"
            data-state={spacePanel || "none"}
            data-compact-controls={compactControls || undefined}
            data-phone-chat-open={phoneChatOpen || undefined}
            data-emotes-open={emotesOpen || undefined}
            data-search-open={searchOpen || undefined}
        >
            <ExperienceShell
                title={exhibit.info?.headline || "Untitled world"}
                spaceId={exhibit.id}
                onTitleClick={() => {
                    closePhoneChat();
                    dispatchSpacePanel({ type: "close" });
                }}
                onExit={() => void router.push("/")}
                connection={presence}
                connectionState={connection}
                onConnected={onConnect}
                lookHint
                notice={notice ? { message: notice } : undefined}
                actions={dockActions.map((action) => ({
                    ...action,
                    // Any other step replaces the old message.
                    onClick: () => {
                        setNotice("");
                        action.onClick();
                    },
                    buttonRef:
                        action.buttonRef ||
                        ((element) =>
                            addTogglerRef(`visitor-${action.id}`, element)),
                }))}
            >
                {children &&
                    [
                        "explore",
                        "audioSharing",
                        "select-media-placeholder",
                        "feedback",
                        "report",
                        "dashboard",
                        "settings",
                        "users",
                        "voiceRequests",
                        "profile-explore",
                    ].includes(currentTab) && (
                        <NativeVisitorPanel
                            key={currentTab}
                            className="visitor-native-panel"
                            title={
                                nativePanelTitles[currentTab] || "Space options"
                            }
                            returnFocusRef={moreButton}
                            onClose={() => setCurrentTab("")}
                            onBack={() => {
                                setCurrentTab("");
                                setMoreOpen(true);
                            }}
                        >
                            {children}
                        </NativeVisitorPanel>
                    )}
                {emotesOpen && (
                    <EmotePanelPosition>
                        <EmotePanel
                            id="native-emotes"
                            mobile={phoneControls}
                            items={EMOTES}
                            panelRef={emotePanel}
                            returnFocusRef={emoteReturnFocus}
                            onClose={closeEmotes}
                            onStop={() => {
                                world.current?.playEmote(-1);
                                closeEmotes();
                            }}
                            onSelect={async (index, name) => {
                                if (onEmote) await onEmote(index, name);
                                else {
                                    if (settings.camera !== "third_person")
                                        await handleSettings(
                                            "camera",
                                            "third_person"
                                        );
                                    world.current?.playEmote(index);
                                }
                                closeEmotes();
                            }}
                        />
                    </EmotePanelPosition>
                )}
                {voiceDebug && (
                    <VoiceLevelDebug voiceService={voice?.voiceService} />
                )}
                {searchOpen && <HideSearchObstructions />}
                {searchMounted && (
                    <SearchPanelPosition
                        ref={searchPanel}
                        data-active={searchOpen || undefined}
                    >
                        <LobbyExplorePanel
                            active={searchOpen}
                            context="space"
                            cards={[]}
                            onClose={closeSearch}
                            onSelect={selectDestination}
                        />
                    </SearchPanelPosition>
                )}
                {moreOpen && (
                    <MorePanel
                        id="native-more-options"
                        aria-label="More options"
                        ref={morePanel}
                        onWheel={(event) => event.stopPropagation()}
                        onTouchMove={(event) => event.stopPropagation()}
                        onPointerDown={(event) => event.stopPropagation()}
                        onMouseDown={(event) => event.stopPropagation()}
                    >
                        <div className="experience-panel-heading">
                            <h2>More</h2>
                            <button
                                aria-label="Close options"
                                onClick={() => {
                                    setMoreOpen(false);
                                    moreButton.current?.focus();
                                }}
                            >
                                <ExperienceIcon name="x" size={16} />
                            </button>
                        </div>
                        <div className="more-panel-body">
                            {secondaryActions.length > 0 && (
                                <div className="more-actions">
                                    {secondaryActions.map((action) => (
                                        <MoreAction
                                            key={action.id}
                                            icon={action.icon}
                                            label={action.label}
                                            onClick={action.onClick}
                                        />
                                    ))}
                                </div>
                            )}
                            <div className="more-actions">
                                <MoreAction
                                    icon="settings"
                                    label="Settings"
                                    onClick={() => toggleTab("settings")}
                                />
                                {!mobile && (
                                    <MoreAction
                                        icon="sliders"
                                        label="Space controls"
                                        onClick={() => toggleTab("dashboard")}
                                    />
                                )}
                                <MoreAction
                                    icon="camera"
                                    label="Take a photo"
                                    onClick={() => {
                                        setMoreOpen(false);
                                        world.current?.takeScreenshot({
                                            color: null,
                                            download: true,
                                        });
                                    }}
                                />
                            </div>
                            {multiplayer && (
                                <div className="more-actions">
                                    {!phoneControls && (
                                        <MoreAction
                                            icon="message-circle"
                                            label={
                                                chat.isChatDisplayed
                                                    ? "Hide chat"
                                                    : "Show chat"
                                            }
                                            onClick={() => {
                                                chat.setIsChatDisplayed(
                                                    !chat.isChatDisplayed
                                                );
                                                setMoreOpen(false);
                                            }}
                                        />
                                    )}
                                    {!mobile &&
                                        typeof navigator !== "undefined" &&
                                        typeof navigator.mediaDevices
                                            ?.getDisplayMedia ===
                                            "function" && (
                                            <MoreAction
                                                icon="share-2"
                                                label={
                                                    voice.voiceState.type ===
                                                        "enabled" &&
                                                    voice.voiceState.state
                                                        .isPlaying
                                                        ? "Stop sharing"
                                                        : "Share screen or audio"
                                                }
                                                disabled={
                                                    voice.loading ||
                                                    voice.voiceState.type ===
                                                        "pending"
                                                }
                                                onClick={() => {
                                                    if (
                                                        voice.voiceState
                                                            .type === "disabled"
                                                    ) {
                                                        if (
                                                            !chat.admins.length
                                                        ) {
                                                            // Said above the
                                                            // dock, where More
                                                            // was opened.
                                                            setMoreOpen(false);
                                                            setNotice(
                                                                "No moderator is available to allow sharing right now."
                                                            );
                                                            return;
                                                        }
                                                        void voice.requestVoicePermission(
                                                            "broadcast"
                                                        );
                                                        setMoreOpen(false);
                                                    } else if (
                                                        voice.voiceState
                                                            .type === "enabled"
                                                    ) {
                                                        if (
                                                            voice.voiceState
                                                                .state.isPlaying
                                                        ) {
                                                            void voice.togglePlaying(
                                                                false
                                                            );
                                                            setMoreOpen(false);
                                                        } else
                                                            toggleTab(
                                                                "audioSharing"
                                                            );
                                                    }
                                                }}
                                            />
                                        )}
                                    {!mobile &&
                                        voice.voiceState.type === "enabled" &&
                                        voice.voiceState.state.videoStreamState
                                            ?.hasVideo && (
                                            <MoreAction
                                                icon="sliders"
                                                label="Choose screen display"
                                                onClick={() =>
                                                    toggleTab(
                                                        "select-media-placeholder"
                                                    )
                                                }
                                            />
                                        )}
                                    {room.isMod && (
                                        <MoreAction
                                            icon="mic"
                                            label="Requests to speak"
                                            onClick={() =>
                                                toggleTab("voiceRequests")
                                            }
                                        />
                                    )}
                                </div>
                            )}
                            <div className="more-actions">
                                <MoreAction
                                    icon="info"
                                    label="Send feedback"
                                    onClick={() => toggleTab("feedback")}
                                />
                            </div>
                        </div>
                    </MorePanel>
                )}
            </ExperienceShell>
        </NativeChromeFrame>
    );
}

const NativeChromeFrame = styled.div`
    display: contents;
    &[data-compact-controls] .experience-dock,
    &[data-compact-controls] #native-more-options,
    &[data-compact-controls] [data-native-utility-panel] {
        left: auto;
        right: max(24px, env(safe-area-inset-right));
        transform: none;
    }
    @media (max-width: 680px) {
        .experience-dock {
            left: 50%;
            right: auto;
            width: max-content;
            max-width: calc(100vw - 32px);
            transform: translateX(-50%);
            display: flex;
            justify-content: center;
            gap: 8px;
            pointer-events: none;
            transition: left 240ms cubic-bezier(0.2, 0.8, 0.2, 1),
                transform 240ms cubic-bezier(0.2, 0.8, 0.2, 1);
        }
        .experience-dock-item {
            flex: 0 0 44px;
            pointer-events: auto;
            transition: opacity 160ms ease, transform 200ms ease, visibility 0s;
        }
        .experience-dock-item[aria-hidden="true"] {
            opacity: 0;
            visibility: hidden;
            pointer-events: none;
            transform: translateX(12px) scale(0.94);
            transition: opacity 120ms ease, transform 200ms ease,
                visibility 0s 120ms;
        }
        .experience-dock-item > button {
            width: 44px;
        }
        &[data-phone-chat-open] .experience-dock {
            left: max(16px, env(safe-area-inset-left));
            transform: none;
            justify-content: flex-start;
        }
        .experience-badge {
            right: 2px;
            top: -6px;
        }
        .experience-tooltip {
            display: none;
        }
        &[data-compact-controls] #native-more-options,
        &[data-compact-controls] [data-native-utility-panel] {
            left: 50%;
            right: auto;
            transform: translateX(-50%);
        }
    }
    @media (max-width: 360px) {
        .experience-dock {
            gap: 4px;
        }
        &[data-phone-chat-open] .experience-dock {
            gap: 8px;
        }
    }
    @media (prefers-reduced-motion: reduce) {
        .experience-dock,
        .experience-dock-item,
        .experience-dock-item[aria-hidden="true"] {
            transition: none;
        }
    }
    @media (min-width: 681px) {
        &[data-emotes-open] .experience-dock {
            visibility: hidden;
            pointer-events: none;
        }
    }
    &[data-search-open] .experience-dock {
        visibility: hidden;
        pointer-events: none;
    }
`;

const SearchPanelPosition = styled.div`
    position: absolute;
    left: 0;
    right: 0;
    bottom: max(20px, calc(env(safe-area-inset-bottom) + 8px));
    pointer-events: none;
    &:not([data-active]) {
        visibility: hidden;
        transition: visibility 0s 240ms;
    }
`;

// Search owns the bottom of the viewport; unmounting restores normal controls.
const HideSearchObstructions = createGlobalStyle`
    .chat-container,
    [data-world-tips],
    .mobile-joystick,
    .jump-btn {
        visibility: hidden;
        pointer-events: none;
    }
`;

const EmotePanelPosition = styled.div`
    position: absolute;
    left: 0;
    right: 0;
    bottom: max(20px, calc(env(safe-area-inset-bottom) + 8px));
    @media ${nativeCompactControlsQuery} {
        bottom: max(80px, calc(env(safe-area-inset-bottom) + 68px));
    }
    @media (max-width: 680px) {
        bottom: max(82px, calc(env(safe-area-inset-bottom) + 70px));
    }
`;

function MoreAction({
    icon,
    label,
    onClick,
    disabled = false,
}: {
    icon: string;
    label: string;
    onClick(): void;
    disabled?: boolean;
}) {
    return (
        <button
            type="button"
            aria-label={label}
            disabled={disabled}
            onClick={onClick}
        >
            <ExperienceIcon name={icon} size={20} />
            <span>{label}</span>
        </button>
    );
}

const MorePanel = styled(ExperiencePanel)`
    ${nativeUtilitySurface}
    position: absolute;
    width: 296px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    .more-panel-body {
        min-height: 0;
        overflow-y: auto;
        overscroll-behavior: contain;
        scrollbar-width: thin;
    }
    .experience-panel-heading > button {
        ${lobbyPanelIconButton}
    }
    @media (max-width: 680px) {
        ${mobileDockPanelLayout}
        ${mobileDockPanelMotion}
        .experience-panel-heading {
            min-height: 44px;
        }
        .experience-panel-heading > button {
            width: 40px;
            height: 40px;
        }
        .more-actions > button {
            min-height: 44px;
        }
    }
    .experience-panel-heading {
        flex-shrink: 0;
        margin: 0 0 6px;
        padding-left: 10px;
    }
    .experience-panel-heading h2 {
        font-size: 14px;
        color: #a8a9ae;
    }
    .more-actions {
        display: grid;
        gap: 2px;
    }
    .more-actions + .more-actions {
        margin-top: 6px;
        padding-top: 6px;
        border-top: 1px solid #ffffff0e;
    }
    .more-actions > button {
        display: flex;
        align-items: center;
        gap: 12px;
        width: 100%;
        min-height: 42px;
        padding: 10px;
        border: 0;
        border-radius: 12px;
        background: transparent;
        color: #e8e9ec;
        font: inherit;
        font-size: 13px;
        text-align: left;
        cursor: pointer;
        transition: background 140ms ease;
        &:hover:not(:disabled),
        &:focus-visible {
            background: #ffffff0b;
        }
        &:focus-visible {
            outline: 1px solid #ffffff38;
            outline-offset: -1px;
        }
        &:disabled {
            opacity: 0.4;
            cursor: default;
        }
    }
    .more-actions img.experience-icon {
        opacity: 0.8;
    }
    @media (prefers-reduced-motion: reduce) {
        .more-actions > button {
            transition: none;
        }
    }
`;
