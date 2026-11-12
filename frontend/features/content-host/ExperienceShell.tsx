import dynamic from "next/dynamic";
import ImmersiveViewportStyle from "./ImmersiveViewportStyle";
import React, { useEffect, useId, useRef, useState } from "react";
import styled from "styled-components";
import Header from "@features/landing-carousel/components/Header";
import Icon from "@features/landing-carousel/components/Icon";
import ConnectionStatus, {
    type ConnectionStatusProps,
} from "@ui/components/ConnectionStatus";
import InlineError from "@ui/components/InlineError";
import ExperienceControlIcon, {
    experienceControlIconAsset,
} from "@ui/components/ExperienceControlIcon";
import { brandFoundation } from "@styles/brand";
import { goToLobby, goToPreviousExperience } from "@utils/experienceNavigation";
import { experienceControl } from "./experienceChrome";
import PointerLockHint, { usePointerLocked } from "./PointerLockHint";
// Loaded on first open: it pulls in account, bookmark and guestbook code.
const SpaceInfoSidebar = dynamic(
    () => import("@features/space-info/SpaceInfoSidebar"),
    { ssr: false }
);

export interface ExperienceShellAction {
    id: string;
    label: string;
    icon?: string;
    active?: boolean;
    expanded?: boolean;
    controls?: string;
    disabled?: boolean;
    /** Keep the dock item mounted while it animates out of view. */
    concealed?: boolean;
    badge?: number | string;
    onClick(): void;
    buttonRef?: React.Ref<HTMLButtonElement>;
}

/**
 * Why the last dock action did not go through, said just above the dock
 * (docs/feedback.md). `onRetry` when running it again can help.
 */
export interface ExperienceShellNotice {
    message: React.ReactNode;
    onRetry?(): void;
}

export interface ExperienceShellChat {
    open: boolean;
    onToggle(): void;
    messages: {
        id: string;
        name: string;
        text: string;
        avatar?: string;
        own?: boolean;
    }[];
    value: string;
    onChange(value: string): void;
    onSend(): void;
    disabled?: boolean;
    notice?: string;
    onFocus?(): void;
    onBlur?(): void;
    onKeyDown?(event: React.KeyboardEvent<HTMLInputElement>): void;
    inputRef?: React.RefObject<HTMLInputElement>;
}

export interface ExperienceShellProps {
    title: string;
    onExit(): void;
    exitLabel?: string;
    /** A line about the place itself, such as "Ready to enter". */
    status?: string;
    /**
     * The visitor's link to the people here, in the lobby's words. Shown in
     * the same line when there is no `status`; omit it where nobody else
     * can be present. While offline it can carry why, and the way back.
     */
    connection?: Pick<
        ConnectionStatusProps,
        "state" | "count" | "reason" | "action"
    >;
    actions?: ExperienceShellAction[];
    /** A failure of one of `actions`, shown above the dock. */
    notice?: ExperienceShellNotice;
    chat?: ExperienceShellChat;
    children?: React.ReactNode;
    showHeader?: boolean;
    /**
     * The space connection machine's own state (multiplayerConnection.ts),
     * shown as `data-state` for browser tests and agents to wait on.
     */
    connectionState?: string;
    /** Makes the top-left title open the space info sidebar for this space. */
    spaceId?: string;
    /** Runs when the title opens the sidebar (e.g. to close other panels). */
    onTitleClick?(): void;
    /** Native scenes: invite mouse users to click in and look around. */
    lookHint?: boolean;
    onConnected?: (
        userData: any,
        account: string,
        token: string
    ) => void | Promise<void>;
}

export function ExperienceIcon({
    name,
    size,
}: {
    name: string;
    size?: number;
}) {
    if (experienceControlIconAsset(name))
        return (
            <ExperienceControlIcon
                name={name}
                size={size}
                className="experience-icon"
            />
        );
    return (
        <img
            className="experience-icon"
            src={`/icons/${name}.svg`}
            alt=""
            aria-hidden="true"
            width={size ?? 18}
            height={size ?? 18}
            draggable={false}
        />
    );
}

/** Trusted host UI. Renderers own their scene and lifecycle; this owns no engine. */
export default function ExperienceShell({
    title,
    onExit,
    exitLabel = "Back to previous world",
    status,
    connection,
    actions = [],
    notice,
    chat,
    children,
    showHeader = true,
    connectionState,
    spaceId,
    onTitleClick,
    lookHint = false,
    onConnected,
}: ExperienceShellProps) {
    const locked = usePointerLocked();
    const [infoOpen, setInfoOpen] = useState(false);
    return (
        <Shell
            data-experience-chrome
            aria-label="Oncyber world controls"
            data-pointer-locked={locked || undefined}
        >
            <ImmersiveViewportStyle />
            {showHeader && (
                <Header
                    menu={null}
                    search={null}
                    immersive
                    onHome={() => goToLobby(onExit)}
                    onConnected={onConnected}
                />
            )}
            <div className="experience-place">
                <button
                    type="button"
                    className="experience-back"
                    aria-label={exitLabel}
                    onClick={() =>
                        goToPreviousExperience(() => goToLobby(onExit))
                    }
                >
                    <Icon name="back" size={17} />
                </button>
                <div
                    className="experience-title"
                    data-machine={connectionState && "space-connection"}
                    data-state={connectionState}
                >
                    {spaceId ? (
                        <button
                            type="button"
                            className="experience-title-button"
                            title={title}
                            aria-haspopup="dialog"
                            aria-expanded={infoOpen}
                            aria-label={`${title}, world info`}
                            onClick={() => {
                                onTitleClick?.();
                                setInfoOpen(true);
                            }}
                        >
                            <span className="experience-title-text">
                                {title}
                            </span>
                            <span
                                className="experience-title-info"
                                aria-hidden="true"
                            >
                                <ExperienceIcon name="info" size={14} />
                            </span>
                        </button>
                    ) : (
                        <span title={title}>{title}</span>
                    )}
                    {status ? (
                        <small role="status">{status}</small>
                    ) : (
                        connection?.state && (
                            <ConnectionStatus {...connection} />
                        )
                    )}
                </div>
            </div>
            {infoOpen && spaceId && (
                <SpaceInfoSidebar
                    id="space-info"
                    spaceId={spaceId}
                    fallback={{ title }}
                    onClose={() => setInfoOpen(false)}
                />
            )}
            {chat && <ExperienceChat chat={chat} />}
            {notice?.message && (
                <div className="experience-notice">
                    <InlineError
                        message={notice.message}
                        onRetry={notice.onRetry}
                    />
                </div>
            )}
            {actions.length > 0 && (
                <div
                    className="experience-dock"
                    role="toolbar"
                    aria-label="World actions"
                >
                    {actions.map((action) => (
                        <div
                            className="experience-dock-item"
                            key={action.id}
                            data-experience-action={action.id}
                            aria-hidden={action.concealed || undefined}
                        >
                            <span
                                className="experience-tooltip"
                                aria-hidden="true"
                            >
                                {action.label}
                            </span>
                            <button
                                type="button"
                                ref={action.buttonRef}
                                aria-label={action.label}
                                aria-pressed={
                                    action.expanded == null
                                        ? action.active
                                        : undefined
                                }
                                aria-expanded={action.expanded}
                                aria-controls={action.controls}
                                disabled={action.disabled || action.concealed}
                                tabIndex={action.concealed ? -1 : undefined}
                                onClick={action.onClick}
                            >
                                {action.icon ? (
                                    <ExperienceIcon name={action.icon} />
                                ) : (
                                    <span aria-hidden="true">
                                        {action.label.slice(0, 1)}
                                    </span>
                                )}
                            </button>
                            {action.badge != null && (
                                <span
                                    className="experience-badge"
                                    aria-hidden="true"
                                >
                                    {action.badge}
                                </span>
                            )}
                        </div>
                    ))}
                </div>
            )}
            <PointerLockHint
                locked={locked}
                lookHint={lookHint}
                paused={
                    !!chat?.open || actions.some((action) => action.expanded)
                }
            />
            {children}
        </Shell>
    );
}

function ExperienceChat({ chat }: { chat: ExperienceShellChat }) {
    const logRef = useRef<HTMLDivElement>(null);
    const atBottom = useRef(true);
    const seen = useRef(new Set(chat.messages.map((message) => message.id)));
    const [unread, setUnread] = useState(false);
    const logId = useId();
    useEffect(() => {
        const newRemote = chat.messages.some(
            (message) => !seen.current.has(message.id) && !message.own
        );
        seen.current = new Set(chat.messages.map((message) => message.id));
        if (chat.open && atBottom.current) {
            const log = logRef.current;
            if (log) log.scrollTop = log.scrollHeight;
            setUnread(false);
        } else if (newRemote) setUnread(true);
    }, [chat.messages, chat.open]);
    return (
        <section className="experience-chat" aria-label="World chat">
            {chat.open && (
                <div
                    ref={logRef}
                    id={logId}
                    className="experience-chat-log"
                    role="log"
                    aria-label="Chat messages"
                    aria-live="polite"
                    onScroll={() => {
                        const log = logRef.current;
                        atBottom.current =
                            !log ||
                            log.scrollHeight -
                                log.scrollTop -
                                log.clientHeight <
                                24;
                        if (atBottom.current) setUnread(false);
                    }}
                >
                    {chat.messages.map((message) => (
                        <div
                            className="experience-chat-message"
                            key={message.id}
                        >
                            <span
                                className="experience-chat-avatar"
                                aria-hidden="true"
                            >
                                {message.avatar ? (
                                    <img src={message.avatar} alt="" />
                                ) : (
                                    message.name.slice(0, 1).toUpperCase()
                                )}
                            </span>
                            <p>
                                <strong>{message.name}</strong>
                                <span className="experience-chat-separator">
                                    {" "}
                                    ·{" "}
                                </span>
                                {message.text}
                            </p>
                        </div>
                    ))}
                </div>
            )}
            <form
                className="experience-chat-composer"
                onSubmit={(event) => {
                    event.preventDefault();
                    if (!chat.disabled && chat.value.trim()) chat.onSend();
                }}
            >
                <div className="experience-chat-input">
                    <ExperienceIcon name="message-square" size={16} />
                    <input
                        ref={chat.inputRef}
                        aria-label="Message everyone"
                        placeholder="Message everyone"
                        autoComplete="off"
                        maxLength={280}
                        value={chat.value}
                        disabled={chat.disabled}
                        onChange={(event) => chat.onChange(event.target.value)}
                        onFocus={chat.onFocus}
                        onBlur={chat.onBlur}
                        onKeyDown={(event) => {
                            event.stopPropagation();
                            chat.onKeyDown?.(event);
                            if (
                                !event.defaultPrevented &&
                                event.key === "Escape"
                            ) {
                                if (chat.open) chat.onToggle();
                                event.currentTarget.blur();
                            }
                        }}
                    />
                    {chat.value.trim() && (
                        <button
                            type="submit"
                            className="experience-chat-send"
                            aria-label="Send message"
                            disabled={chat.disabled}
                        >
                            <ExperienceIcon name="send" size={16} />
                        </button>
                    )}
                </div>
                <button
                    type="button"
                    className="experience-chat-toggle"
                    aria-label={
                        chat.open ? "Hide chat history" : "Show chat history"
                    }
                    aria-controls={logId}
                    aria-expanded={chat.open}
                    onClick={chat.onToggle}
                >
                    <Icon name="chevron" size={16} />
                    {unread && (
                        <>
                            <i
                                className="experience-unread"
                                aria-hidden="true"
                            />
                            <span className="experience-sr-only">
                                Unread messages
                            </span>
                        </>
                    )}
                </button>
            </form>
            {chat.notice && (
                <p className="experience-chat-notice" role="status">
                    {chat.notice}
                </p>
            )}
        </section>
    );
}

export const ExperiencePanel = styled.section`
    position: absolute;
    z-index: 6;
    bottom: max(82px, calc(env(safe-area-inset-bottom) + 74px));
    left: 50%;
    transform: translateX(-50%);
    width: 390px;
    max-width: calc(100% - 32px);
    max-height: calc(100svh - 190px);
    overflow: auto;
    color: #e8e9ec;
    background: #191919;
    border: 1px solid #ffffff12;
    border-radius: 24px;
    box-shadow: 0 12px 32px #00000026;
    pointer-events: auto;
    padding: 16px;
    box-sizing: border-box;
    h2 {
        font-size: 16px;
        font-weight: 500;
        margin: 0;
    }
    .experience-panel-heading {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 12px;
    }
    .experience-panel-heading > button {
        ${experienceControl} width: 32px;
        height: 32px;
    }
    .experience-panel-actions {
        display: grid;
        gap: 8px;
    }
    .experience-panel-actions > button {
        padding: 12px;
        border-radius: 12px;
        border: 1px solid #ffffff18;
        background: #242424;
        color: inherit;
        text-align: left;
        cursor: pointer;
    }
    @media (max-width: 680px) {
        border-radius: 16px;
    }
`;

const Shell = styled.div`
    ${brandFoundation}
    position: fixed;
    inset: 0;
    z-index: 10010;
    pointer-events: none;
    color: #e8e9ec;
    --landing-header-height: 88px;
    --accent: #d3ec42;
    > header {
        margin: 0 24px;
        pointer-events: none;
    }
    /* While looking around, the top bar steps aside until Esc. */
    > header,
    .experience-place {
        transition: opacity 180ms ease, transform 180ms ease;
    }
    &[data-pointer-locked] > header,
    &[data-pointer-locked] .experience-place {
        opacity: 0;
        transform: translateY(-8px);
        visibility: hidden;
        pointer-events: none;
    }
    @media (prefers-reduced-motion: reduce) {
        > header,
        .experience-place {
            transition: none;
        }
    }
    > header .brand,
    > header .account-actions {
        pointer-events: auto;
    }
    button,
    input {
        font: inherit;
    }
    button:focus-visible,
    a:focus-visible {
        outline: 2px solid #e8e9ec;
        outline-offset: 3px;
    }
    .experience-icon {
        display: block;
        flex-shrink: 0;
    }
    img.experience-icon {
        filter: invert(1);
    }
    .experience-place {
        position: absolute;
        top: 24px;
        left: 24px;
        display: flex;
        align-items: center;
        gap: 12px;
        max-width: calc(50% - 110px);
        pointer-events: auto;
    }
    .experience-back {
        ${experienceControl}
    }
    .experience-title {
        min-width: 0;
        font-size: 14px;
        font-weight: 400;
        /* Even line boxes stay on whole pixels beside the 40/44px controls. */
        line-height: 20px;
    }
    .experience-title > span,
    .experience-title-text {
        display: block;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .experience-title-button {
        display: inline-flex;
        align-items: center;
        gap: 6px;
    }
    .experience-title-text {
        min-width: 0;
    }
    .experience-title-info {
        display: grid;
        place-items: center;
        flex: 0 0 auto;
        opacity: 0.6;
        transition: opacity 0.15s;
    }
    .experience-title-info .experience-icon {
        width: 14px;
        height: 14px;
    }
    .experience-title-button:hover .experience-title-info,
    .experience-title-button:focus-visible .experience-title-info {
        opacity: 1;
    }
    .experience-title-button {
        /* The negative margins keep the text aligned; give them back here. */
        max-width: calc(100% + 12px);
        margin: -2px -6px;
        padding: 2px 6px;
        border: 0;
        border-radius: 6px;
        background: transparent;
        color: inherit;
        font: inherit;
        line-height: inherit;
        text-align: left;
        cursor: pointer;
    }
    .experience-title-button:hover {
        background: #ffffff14;
    }
    .experience-title-button:focus-visible {
        outline: 2px solid #e8e9ec;
        outline-offset: 1px;
    }
    .experience-title small {
        display: block;
        margin-top: 4px;
        color: #969aa3;
        font-size: 11px;
        line-height: 16px;
    }
    /* The shared connection line sits where the status line does. */
    .experience-title .presence-status,
    .experience-title .presence-reason {
        line-height: 16px;
    }
    .experience-dock {
        position: absolute;
        left: 50%;
        bottom: max(20px, calc(env(safe-area-inset-bottom) + 8px));
        transform: translateX(-50%);
        display: flex;
        gap: 8px;
        max-width: calc(100% - 24px);
        pointer-events: auto;
    }
    .experience-dock-item {
        position: relative;
    }
    /* Above the dock, where the open panels sit. */
    .experience-notice {
        position: absolute;
        z-index: 7;
        left: 50%;
        bottom: max(82px, calc(env(safe-area-inset-bottom) + 74px));
        transform: translateX(-50%);
        width: max-content;
        max-width: min(390px, calc(100% - 32px));
        pointer-events: auto;
    }
    .experience-notice > [role="alert"] {
        background: #14161be6;
    }
    .experience-dock-item > button {
        ${experienceControl}
    }
    .experience-tooltip {
        position: absolute;
        bottom: calc(100% + 12px);
        left: 50%;
        transform: translateX(-50%);
        padding: 5px 8px;
        color: #ccc;
        font-size: 11px;
        background: #14161be6;
        border-radius: 6px;
        white-space: nowrap;
        opacity: 0;
        visibility: hidden;
        pointer-events: none;
    }
    /* Show on hover or keyboard focus only (a clicked button keeps focus, so
       :focus-within left labels stuck), and fade out after a few seconds. */
    .experience-dock-item:hover .experience-tooltip,
    .experience-dock-item:has(:focus-visible) .experience-tooltip {
        animation: experience-tooltip-life 2.6s ease forwards;
    }
    @keyframes experience-tooltip-life {
        0% {
            opacity: 0;
            visibility: visible;
        }
        6%,
        88% {
            opacity: 1;
            visibility: visible;
        }
        100% {
            opacity: 0;
            visibility: hidden;
        }
    }
    .experience-badge {
        position: absolute;
        right: -6px;
        top: -7px;
        min-width: 18px;
        padding: 1px 4px;
        text-align: center;
        color: #c2c5cc;
        font: 9px var(--oc-mono);
        background: #14161b;
        border: 1px solid #ffffff18;
        border-radius: 6px;
        pointer-events: none;
    }
    .experience-chat {
        position: absolute;
        bottom: max(20px, calc(env(safe-area-inset-bottom) + 8px));
        left: 24px;
        width: 280px;
        max-width: calc(100% - 32px);
        pointer-events: auto;
    }
    .experience-chat-log {
        overflow: auto;
        max-height: 36vh;
        scrollbar-width: thin;
        padding: 6px 0;
        margin-bottom: 6px;
        overflow-anchor: none;
    }
    .experience-chat-message {
        display: flex;
        align-items: flex-start;
        gap: 6px;
        padding: 3px 4px;
        font-size: 12px;
        line-height: 18px;
        text-shadow: 0 1px 3px #000000b3;
    }
    .experience-chat-message p {
        margin: 0;
        overflow-wrap: anywhere;
        white-space: pre-wrap;
    }
    .experience-chat-message strong {
        color: #c2cef0;
        font-weight: 500;
    }
    .experience-chat-separator {
        color: #969aa3;
    }
    .experience-chat-avatar {
        width: 18px;
        height: 18px;
        flex: 0 0 18px;
        display: grid;
        place-items: center;
        overflow: hidden;
        border-radius: 50%;
        background: #ffffff12;
        color: #969aa3;
        font-size: 10px;
    }
    .experience-chat-avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }
    .experience-chat-composer {
        display: flex;
        height: 40px;
        gap: 8px;
    }
    .experience-chat-input {
        display: flex;
        flex: 1;
        min-width: 0;
        align-items: center;
        padding: 0 10px;
        background: #14161bcc;
        border: 1px solid #ffffff18;
        border-radius: 12px;
    }
    .experience-chat-input:focus-within {
        background: #1b1e24e6;
        border-color: #ffffff45;
        box-shadow: 0 0 0 2px #ffffff0a;
    }
    .experience-chat-input > img {
        opacity: 0.65;
    }
    .experience-chat-input input {
        width: 100%;
        min-width: 0;
        height: 100%;
        margin-left: 8px;
        padding: 0;
        border: 0;
        color: #fff;
        background: transparent;
        outline: none;
        font-size: 13px;
    }
    .experience-chat-input input::placeholder {
        color: #969aa3;
    }
    .experience-chat-send {
        display: grid;
        place-items: center;
        flex-shrink: 0;
        width: 28px;
        height: 28px;
        background: transparent;
        border: 0;
        border-radius: 8px;
        cursor: pointer;
    }
    .experience-chat-toggle {
        ${experienceControl} position: relative;
    }
    .experience-chat-toggle[aria-expanded="false"] svg {
        transform: rotate(180deg);
    }
    .experience-unread {
        position: absolute;
        top: -3px;
        right: -3px;
        width: 8px;
        height: 8px;
        background: var(--oc-accent-create);
        border: 2px solid #14161b;
        border-radius: 50%;
    }
    .experience-sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        clip-path: inset(50%);
        overflow: hidden;
    }
    .experience-chat-notice {
        font-size: 11px;
        padding: 6px 10px;
        border-radius: 8px;
        background: #14161be6;
        margin: 6px 0 0;
    }
    @media (max-width: 960px) {
        .experience-chat {
            bottom: max(80px, calc(env(safe-area-inset-bottom) + 68px));
        }
    }
    @media (max-width: 680px) {
        > header {
            margin: 0 16px;
        }
        .experience-place {
            top: 22px;
            left: 16px;
            max-width: calc(50% - 35px);
            gap: 8px;
        }
        .experience-title {
            font-size: 12px;
            line-height: 18px;
        }
        .experience-dock {
            gap: 6px;
        }
        .experience-chat {
            left: 16px;
        }
        .experience-chat-composer {
            height: 44px;
        }
        .experience-chat-input input {
            font-size: 16px;
        }
    }
`;
