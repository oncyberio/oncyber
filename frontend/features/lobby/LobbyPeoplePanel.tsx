import React, { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import Icon from "../landing-carousel/components/Icon";
import {
    lobbyPanelHeading,
    lobbyPanelIconButton,
    lobbyPanelSurface,
    lobbyPanelTokens,
} from "./lobbyPanelStyles";
import { baseTokens as base, lobbyTokens as lobby } from "@styles/tokens";
import type {
    LobbyAdminAction,
    LobbyRole,
    LobbyStage,
    LobbyVoiceState,
} from "./LobbyConnection";

type Person = {
    id: string;
    name: string;
    avatar?: string;
    isLocal?: boolean;
    role?: LobbyRole;
};
/** Lobby voice, modelled on worlds: admins put people on voice for everyone nearby. */
export type LobbyVoiceControls = {
    stage: LobbyStage;
    voiceState: LobbyVoiceState;
    onListen(): void;
    onRequest(cancel?: boolean): void;
    onLeave(): void;
    onAdmin(action: LobbyAdminAction, sessionId: string): Promise<string>;
};

type Props = {
    players: readonly Person[];
    population: number;
    status: string;
    onClose(): void;
    returnFocusRef?: { current: HTMLElement | null };
    voice?: LobbyVoiceControls | null;
    /** Lets you add people to your party from the list. */
    party?: {
        memberIds: readonly string[];
        onAdd(id: string): Promise<void>;
        /** Who can be added; everyone when left out. */
        canAdd?(id: string): boolean;
    };
    /** Closest people first, or by name when switched off. */
    sort?: { nearby: boolean; onToggle(): void };
    children?: React.ReactNode;
};

const roleLabel = (role?: LobbyRole) =>
    role === "owner" ? "Main admin" : role === "admin" ? "Admin" : "";

function VoiceSection({
    voice,
    selfId,
    onError,
}: {
    voice: LobbyVoiceControls;
    selfId?: string;
    onError(message: string): void;
}) {
    const { stage } = voice;
    const admin = !!stage.role;
    const onStage = stage.speakers.some((s) => s.sessionId === selfId);
    const act = async (action: LobbyAdminAction, id: string) =>
        onError(await voice.onAdmin(action, id));
    return (
        <section className="people-voice" aria-label="Lobby voice">
            <div className="voice-heading">
                <h3>
                    On voice · {stage.speakers.length}/{stage.limit}
                </h3>
                {voice.voiceState === "off" && stage.speakers.length > 0 && (
                    <button type="button" onClick={voice.onListen}>
                        Listen
                    </button>
                )}
            </div>
            {stage.speakers.length ? (
                <ul aria-label="Speakers">
                    {stage.speakers.map((speaker) => (
                        <li key={speaker.sessionId}>
                            <span className="person-dot live" aria-hidden />
                            <span className="person-name">{speaker.name}</span>
                            {speaker.sessionId === selfId ? (
                                <button type="button" onClick={voice.onLeave}>
                                    Leave voice
                                </button>
                            ) : (
                                admin && (
                                    <button
                                        type="button"
                                        onClick={() =>
                                            act(
                                                "stage-remove",
                                                speaker.sessionId
                                            )
                                        }
                                    >
                                        Remove
                                    </button>
                                )
                            )}
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="voice-note">
                    {admin
                        ? "Add someone from the list below. Up to 50 people nearest each speaker hear them."
                        : "Nobody is on voice right now."}
                </p>
            )}
            {onStage && !stage.muted && voice.voiceState !== "live" && (
                <p className="voice-note">
                    You’re on voice. Turn on your microphone to be heard.
                </p>
            )}
            {stage.muted && (
                <p className="voice-note">
                    An admin muted you. You can still listen.
                </p>
            )}
            {!admin && !onStage && !stage.muted && (
                <button
                    type="button"
                    className="voice-request"
                    onClick={() => voice.onRequest(stage.requested)}
                >
                    {stage.requested
                        ? "Request sent · Cancel"
                        : "Request to speak"}
                </button>
            )}
            {admin && stage.requests.length > 0 && (
                <>
                    <h3>Requests to speak</h3>
                    <ul aria-label="Requests to speak">
                        {stage.requests.map((request) => (
                            <li key={request.sessionId}>
                                <span className="person-name">
                                    {request.name}
                                </span>
                                <button
                                    type="button"
                                    onClick={() =>
                                        act("stage-add", request.sessionId)
                                    }
                                >
                                    Add to voice
                                </button>
                                <button
                                    type="button"
                                    onClick={() =>
                                        act(
                                            "decline-request",
                                            request.sessionId
                                        )
                                    }
                                >
                                    Decline
                                </button>
                            </li>
                        ))}
                    </ul>
                </>
            )}
        </section>
    );
}

function AdminActions({
    person,
    voice,
    onError,
}: {
    person: Person;
    voice: LobbyVoiceControls;
    onError(message: string): void;
}) {
    const { stage } = voice;
    const owner = stage.role === "owner";
    const speaking = stage.speakers.some((s) => s.sessionId === person.id);
    const muted = stage.mutedPeople.includes(person.id);
    const act = async (action: LobbyAdminAction) =>
        onError(await voice.onAdmin(action, person.id));
    // Mirrors the server: admins can't moderate admins; the main admin can.
    if (person.role === "owner" || (person.role && !owner)) return null;
    return (
        <div className="person-actions">
            {!muted && (
                <button
                    type="button"
                    onClick={() => act(speaking ? "stage-remove" : "stage-add")}
                >
                    {speaking ? "Remove from voice" : "Add to voice"}
                </button>
            )}
            {!person.isLocal && (
                <>
                    <button
                        type="button"
                        onClick={() => act(muted ? "unmute" : "mute")}
                    >
                        {muted ? "Unmute" : "Mute"}
                    </button>
                    <button type="button" onClick={() => act("kick")}>
                        Remove from lobby
                    </button>
                    {owner && (
                        <button
                            type="button"
                            onClick={() =>
                                act(
                                    person.role ? "revoke-admin" : "grant-admin"
                                )
                            }
                        >
                            {person.role ? "Remove admin" : "Make admin"}
                        </button>
                    )}
                </>
            )}
        </div>
    );
}

export default function LobbyPeoplePanel({
    players,
    population,
    status,
    onClose,
    returnFocusRef,
    voice,
    party,
    sort,
    children,
}: Props) {
    const [query, setQuery] = useState("");
    const wanted = query.trim().toLowerCase();
    const listed = wanted
        ? players.filter((player) => player.name.toLowerCase().includes(wanted))
        : players;
    const [adding, setAdding] = useState<string[]>([]);
    const [invited, setInvited] = useState<string[]>([]);
    const addToParty = (id: string) => {
        if (!party || adding.includes(id)) return;
        setError("");
        setAdding((ids) => [...ids, id]);
        party
            .onAdd(id)
            .then(() => setInvited((ids) => [...ids, id]))
            .catch((failure) =>
                setError(failure?.message || "Couldn’t add them to the party.")
            )
            .finally(() => setAdding((ids) => ids.filter((x) => x !== id)));
    };
    const panel = useRef<HTMLElement>(null);
    const [open, setOpen] = useState<string | null>(null);
    const [error, setError] = useState("");
    const selfId = players.find((player) => player.isLocal)?.id;
    const admin = !!voice?.stage.role;
    const close = useRef<HTMLButtonElement>(null);
    useEffect(() => {
        const element = panel.current;
        const opener =
            returnFocusRef?.current || (document.activeElement as HTMLElement);
        close.current?.focus({ preventScroll: true });
        return () => {
            if (
                !document.activeElement ||
                document.activeElement === document.body ||
                element?.contains(document.activeElement)
            )
                queueMicrotask(() => {
                    if (
                        opener?.isConnected &&
                        (!document.activeElement ||
                            document.activeElement === document.body)
                    )
                        opener.focus({ preventScroll: true });
                });
        };
    }, []);
    const nearbyStatus = players.length
        ? population > players.length
            ? `${population} in this lobby · showing people near you`
            : `${population} in this lobby`
        : status === "connecting"
        ? "Joining the room…"
        : "Reconnect to see who’s here.";

    return (
        <Panel
            ref={panel}
            id="lobby-people"
            role="dialog"
            aria-labelledby="lobby-people-title"
            aria-describedby="lobby-people-status"
            onKeyDown={(event) => {
                if (
                    event.nativeEvent.isComposing ||
                    event.keyCode === 229 ||
                    event.ctrlKey ||
                    event.metaKey ||
                    event.altKey
                )
                    return;
                if (event.key === "Escape") {
                    event.preventDefault();
                    event.stopPropagation();
                    onClose();
                }
            }}
        >
            <header>
                <h2 id="lobby-people-title">People</h2>
                <button
                    ref={close}
                    type="button"
                    className="people-close"
                    onClick={onClose}
                    aria-label="Close people"
                >
                    <Icon name="close" size={16} />
                </button>
            </header>
            <div className="people-tools">
                <label className="people-search">
                    <Icon name="search" size={14} />
                    <input
                        type="search"
                        value={query}
                        placeholder="Search people"
                        aria-label="Search people"
                        onChange={(event) => setQuery(event.target.value)}
                    />
                </label>
            </div>
            {sort && (
                <div
                    className="people-sort"
                    role="group"
                    aria-label="Sort people"
                >
                    <span>Sort by:</span>
                    <button
                        type="button"
                        aria-pressed={sort.nearby}
                        onClick={() => !sort.nearby && sort.onToggle()}
                    >
                        nearest people first
                    </button>
                    <span aria-hidden="true">|</span>
                    <button
                        type="button"
                        aria-pressed={!sort.nearby}
                        title="Who arrived last, first"
                        onClick={() => sort.nearby && sort.onToggle()}
                    >
                        last
                    </button>
                </div>
            )}
            <div className="people-content">
                <p id="lobby-people-status" role="status">
                    {nearbyStatus}
                </p>
                {voice && (
                    <VoiceSection
                        voice={voice}
                        selfId={selfId}
                        onError={setError}
                    />
                )}
                {error && (
                    <p className="people-error" role="alert">
                        {error}
                    </p>
                )}
                {children && <div className="people-party">{children}</div>}
                {!!players.length && !listed.length && (
                    <p className="people-empty">Nobody here by that name.</p>
                )}
                {!!listed.length && (
                    <ul aria-label="People" className="people-list">
                        {listed.map((player) => (
                            <li key={player.id}>
                                <div className="person-row">
                                    {player.avatar ? (
                                        <img
                                            className="person-photo"
                                            src={player.avatar}
                                            alt=""
                                            loading="lazy"
                                        />
                                    ) : (
                                        <span
                                            className="person-dot"
                                            aria-hidden="true"
                                        />
                                    )}
                                    <span className="person-name">
                                        {player.name}
                                    </span>
                                    {roleLabel(player.role) && (
                                        <em>{roleLabel(player.role)}</em>
                                    )}
                                    {player.isLocal && <small>You</small>}
                                    {party &&
                                        !player.isLocal &&
                                        party.canAdd?.(player.id) !== false &&
                                        (party.memberIds.includes(player.id) ? (
                                            <small className="person-state">
                                                In party
                                            </small>
                                        ) : invited.includes(player.id) ? (
                                            <small className="person-state pending">
                                                Invited
                                            </small>
                                        ) : (
                                            <button
                                                type="button"
                                                className="person-add"
                                                disabled={adding.includes(
                                                    player.id
                                                )}
                                                aria-label={`Add ${player.name} to your party`}
                                                title="Add to party"
                                                onClick={() =>
                                                    addToParty(player.id)
                                                }
                                            >
                                                {adding.includes(player.id)
                                                    ? "…"
                                                    : "+"}
                                            </button>
                                        ))}
                                    {admin && (
                                        <button
                                            type="button"
                                            className="person-more"
                                            aria-expanded={open === player.id}
                                            aria-label={`Manage ${player.name}`}
                                            onClick={() =>
                                                setOpen((value) =>
                                                    value === player.id
                                                        ? null
                                                        : player.id
                                                )
                                            }
                                        >
                                            •••
                                        </button>
                                    )}
                                </div>
                                {admin && open === player.id && (
                                    <AdminActions
                                        person={player}
                                        voice={voice}
                                        onError={setError}
                                    />
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </Panel>
    );
}

const Panel = styled.section`
    ${lobbyPanelTokens}
    ${lobbyPanelSurface}
    --people-bottom: max(82px, calc(env(safe-area-inset-bottom) + 74px));
    position: absolute;
    z-index: 22;
    left: 50%;
    bottom: var(--people-bottom);
    transform: translateX(-50%);
    width: min(var(--lobby-panel-compact-width), calc(100% - 32px));
    max-height: min(460px, calc(100dvh - var(--people-bottom) - 16px));
    display: flex;
    flex-direction: column;
    gap: var(--lobby-panel-gap);
    padding: 8px 0;
    pointer-events: auto;
    header {
        ${lobbyPanelHeading}
    }
    .people-close {
        ${lobbyPanelIconButton}
        margin-left: auto;
    }
    .people-content {
        min-height: 0;
        overflow-y: auto;
        overscroll-behavior: contain;
        padding: 0 16px 8px;
        scrollbar-width: thin;
        scrollbar-color: #ffffff24 transparent;
    }
    #lobby-people-status {
        margin: 0 0 8px;
        color: #c2c2bd;
        font-size: 11px;
        line-height: 1.5;
    }
    .people-party {
        margin-bottom: 12px;
    }
    .people-content ul {
        list-style: none;
        margin: 0;
        padding: 0;
    }
    .people-voice li,
    .person-row {
        display: flex;
        align-items: center;
        gap: 10px;
        min-height: 40px;
        padding: 4px 2px;
        box-sizing: border-box;
        font-size: 12px;
    }
    .people-content > ul > li + li {
        border-top: 1px solid #ffffff0a;
    }
    .people-voice {
        margin-bottom: 12px;
        padding-bottom: 8px;
        border-bottom: 1px solid #ffffff14;
    }
    .people-voice h3 {
        margin: 0;
        color: #c2c2bd;
        font: 500 11px/20px var(--oc-font, sans-serif);
    }
    .voice-heading {
        display: flex;
        align-items: center;
        justify-content: space-between;
        min-height: 32px;
    }
    .voice-note,
    .people-error {
        margin: 4px 0 8px;
        color: #93938e;
        font-size: 11px;
        line-height: 1.5;
    }
    .people-error {
        color: #ff8a7a;
    }
    .people-content button:not(.people-close) {
        flex-shrink: 0;
        min-height: 28px;
        padding: 0 10px;
        border: 1px solid #ffffff2e;
        border-radius: 8px;
        background: transparent;
        color: #f3f3f1;
        font: 11px var(--oc-font, sans-serif);
        cursor: pointer;
        &:hover {
            border-color: #ffffff66;
        }
        &:focus-visible {
            outline: 2px solid var(--oc-accent, #2567ff);
            outline-offset: 2px;
        }
    }
    .people-voice li button:first-of-type,
    .person-row .person-more {
        margin-left: auto;
    }
    .people-content .voice-request {
        width: 100%;
        margin-top: 4px;
    }
    .people-content .person-more {
        min-width: 32px;
        padding: 0 6px;
        border-color: transparent;
        color: #c2c2bd;
        letter-spacing: 1px;
    }
    .people-tools {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 0 16px;
    }
    .people-search {
        position: relative;
        display: flex;
        align-items: center;
        flex: 1;
        min-width: 0;
        color: ${lobby.color.secondary};
    }
    .people-search svg {
        position: absolute;
        left: 10px;
        pointer-events: none;
    }
    .people-search input {
        width: 100%;
        height: 32px;
        box-sizing: border-box;
        padding: 0 10px 0 30px;
        border: 1px solid ${lobby.panel.border};
        border-radius: ${lobby.panel.iconRadius}px;
        background: ${base.color.line.faint};
        color: ${lobby.color.ink};
        font: 12px var(--oc-font, sans-serif);
        outline: none;
        &::placeholder {
            color: ${lobby.color.secondary};
        }
        &:focus-visible {
            border-color: ${lobby.panel.cardHover};
        }
    }
    .people-sort {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px 16px 0;
        color: ${lobby.color.secondary};
        font-size: 12px;
        button {
            padding: 0;
            border: 0;
            background: none;
            color: ${lobby.color.secondary};
            font: inherit;
            cursor: pointer;
            &[aria-pressed="true"] {
                color: ${lobby.color.ink};
            }
            &:hover {
                color: ${lobby.color.ink};
            }
            &:focus-visible {
                outline: 1px solid ${lobby.panel.cardHover};
                outline-offset: 2px;
            }
        }
    }
    .people-empty {
        margin: 12px 0;
        color: ${lobby.color.secondary};
        font-size: 12px;
    }
    .person-name {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 13px;
    }
    .person-photo {
        width: 26px;
        height: 26px;
        border-radius: 50%;
        object-fit: cover;
        flex: none;
        background: ${base.color.line.faint};
    }
    .people-content .person-add {
        display: grid;
        place-items: center;
        width: 28px;
        min-width: 28px;
        height: 28px;
        min-height: 28px;
        margin-left: auto;
        padding: 0;
        border-radius: 50%;
        border-color: ${lobby.panel.border};
        color: ${lobby.color.ink};
        font-size: 16px;
        line-height: 1;
        &:hover:not(:disabled) {
            border-color: ${lobby.panel.cardSelected};
            background: ${base.color.line.faint};
        }
    }
    .person-row .person-state {
        margin-left: auto;
        color: ${lobby.color.ink};
        font-size: 11px;
    }
    .person-row .person-state.pending {
        color: ${lobby.color.secondary};
    }
    .person-add + .person-more,
    .person-state + .person-more {
        margin-left: 0;
    }
    .person-row small + .person-more {
        margin-left: 0;
    }
    .person-row em {
        color: #2cf8d5;
        font: normal 10px var(--oc-mono, monospace);
    }
    .person-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        padding: 0 2px 10px 18px;
    }
    .person-dot.live {
        background: #ff5a4f;
    }
    .person-name {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .person-dot {
        width: 6px;
        height: 6px;
        flex-shrink: 0;
        border-radius: 50%;
        background: #2cf8d5;
    }
    .people-content > ul small {
        margin-left: auto;
        color: #93938e;
        font: 10px var(--oc-mono, monospace);
    }
    @media (max-width: 850px) {
        --people-bottom: max(146px, calc(env(safe-area-inset-bottom) + 138px));
    }
`;
