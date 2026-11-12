import React from "react";
import styled from "styled-components";
import { baseTokens as base } from "@styles/tokens/base";

/** What a visitor can be told about their link to the people in a place. */
export type ConnectionState = "connecting" | "connected" | "offline";

/** What the visitor can do about being offline: "Rejoin", for example. */
export interface ConnectionStatusAction {
    label: string;
    onClick(): void;
    disabled?: boolean;
}

export interface ConnectionStatusProps {
    state?: ConnectionState;
    /** People here, as the host counts them. Shown while connected. */
    count?: number;
    /** Why the visitor is offline, when the host knows. */
    reason?: string;
    /** The way back, shown under the reason. Only while offline. */
    action?: ConnectionStatusAction;
    /** Words the host has already chosen; used instead of `state`. */
    label?: string;
}

/** The same three wordings in the lobby, in spaces and in embedded worlds. */
export function connectionStatusLabel(state: ConnectionState, count = 0) {
    return state === "connected"
        ? `${count} here`
        : state === "connecting"
        ? "Connecting…"
        : "You’re offline";
}

/**
 * The line under a place's title that says whether the visitor is connected.
 *
 * The count changes often, so the visible line is never a live region. When
 * `state` is given, a hidden one says only that the state changed
 * ("Connecting…", "Connected", "You’re offline" and the reason), which keeps
 * screen readers quiet while people come and go.
 *
 * While offline, `action` adds the way back as a button under the reason.
 * It is a real control, so it is reached and named like any other button.
 */
export default function ConnectionStatus({
    state,
    count,
    reason,
    action,
    label,
}: ConnectionStatusProps) {
    if (label === undefined && !state) return null;
    const why = state === "offline" && reason ? reason : "";
    // The hidden line repeats these two states word for word.
    const spoken = !!state && state !== "connected";
    return (
        <>
            <Line className="presence-status" aria-hidden={spoken || undefined}>
                {label !== undefined
                    ? label
                    : connectionStatusLabel(state, count)}
            </Line>
            {why && (
                <Reason className="presence-reason" title={why} aria-hidden>
                    {why}
                </Reason>
            )}
            {action && state === "offline" && (
                <Action
                    type="button"
                    className="presence-action"
                    disabled={action.disabled}
                    onClick={action.onClick}
                >
                    {action.label}
                </Action>
            )}
            {state && (
                <Announcement className="presence-announcement" role="status">
                    {state === "connected"
                        ? "Connected"
                        : why
                        ? `${connectionStatusLabel(state)}. ${why}`
                        : connectionStatusLabel(state)}
                </Announcement>
            )}
        </>
    );
}

// The lobby's presence line, moved here unchanged. #969aa3 is not a token
// yet: lobbyTokens.color.meta (#969daa) is one step away.
const Line = styled.span`
    display: block;
    margin-top: 4px;
    font-size: 11px;
    color: #969aa3;
`;

// Never wider than the title, so a long reason does not grow over the
// controls beside it. It wraps instead: a reason cut short explains nothing.
const Reason = styled(Line)`
    margin-top: 0;
    max-width: 100%;
    overflow-wrap: anywhere;
`;

// A small outline button, as the action of InlineError.
const Action = styled.button`
    display: block;
    min-height: 28px;
    margin: 6px 0 0;
    padding: 0 12px;
    border: 1px solid ${base.color.line.strong};
    border-radius: ${base.radius.inset}px;
    background: transparent;
    color: ${base.color.ink};
    white-space: nowrap;
    cursor: pointer;
    pointer-events: auto;
    transition: border-color ${base.motion.fast}ms ${base.motion.ease};

    /* Doubled, so a host's own "button { font: inherit }" keeps the size. */
    && {
        font: inherit;
        font-size: ${base.font.size.xs}px;
        font-weight: ${base.font.weight.medium};
        line-height: 16px;
    }

    &:hover:not(:disabled) {
        border-color: ${base.color.line.hover};
    }
    &:focus-visible {
        outline: ${base.focus.width}px solid ${base.color.accent};
        outline-offset: ${base.focus.offset}px;
    }
    &:disabled {
        opacity: 0.45;
        cursor: default;
    }
    @media (prefers-reduced-motion: reduce) {
        transition: none;
    }
`;

const Announcement = styled.span`
    position: absolute;
    width: 1px;
    height: 1px;
    clip-path: inset(50%);
    overflow: hidden;
    white-space: nowrap;
`;
