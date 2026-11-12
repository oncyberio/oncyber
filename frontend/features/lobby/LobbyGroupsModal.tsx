import { groupLocationLabel } from "./lobbyGroupPresence";
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styled from "styled-components";
import Icon from "../landing-carousel/components/Icon";
import LobbyDockIcon from "./LobbyDockIcon";
import { LOBBY_GUEST_PORTRAIT } from "./lobbyIdentity";
import InlineError from "@ui/components/InlineError";
import { lobbyErrorMessage } from "./lobbyErrors";
import type {
    LobbyGroup,
    LobbyGroupAction,
    LobbyGroupResult,
} from "../../../multiplayer/protocol/lobby-groups";

export type GroupAction = (
    action: Omit<LobbyGroupAction, "requestId">
) => Promise<LobbyGroupResult>;
/** A dead profile picture shows the guest portrait, as spaces do. */
function showGuestPortrait(event: React.SyntheticEvent<HTMLImageElement>) {
    const img = event.currentTarget;
    if (img.src !== LOBBY_GUEST_PORTRAIT) img.src = LOBBY_GUEST_PORTRAIT;
}

export default function LobbyGroupsModal({
    group,
    players,
    sessionId,
    action,
    onClose,
    onSelected,
    joinCode,
}: {
    group?: LobbyGroup;
    players: Array<{ id: string; name: string; avatar?: string }>;
    sessionId: string;
    action: GroupAction;
    onClose: () => void;
    onSelected: (id: string) => void;
    joinCode?: string;
}) {
    const [name, setName] = useState("");
    const [query, setQuery] = useState("");
    const [selected, setSelected] = useState<string[]>([]);
    const [invited, setInvited] = useState<string[]>([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [copied, setCopied] = useState(false);
    const dialog = useRef<HTMLDivElement>(null);
    const mounted = useRef(true);
    useEffect(() => {
        mounted.current = true;
        const previous = document.activeElement as HTMLElement;
        document.exitPointerLock?.();
        dialog.current?.querySelector<HTMLElement>("input, button")?.focus();
        return () => {
            mounted.current = false;
            if (previous?.isConnected) previous.focus({ preventScroll: true });
        };
    }, []);
    const members = new Set(
        group?.members.map((member) => member.id) || [sessionId]
    );
    const candidates = players.filter(
        (person) =>
            !members.has(person.id) &&
            person.name.toLowerCase().includes(query.trim().toLowerCase())
    );
    const run = async (task: () => Promise<void>) => {
        if (busy) return;
        setError("");
        setBusy(true);
        try {
            await task();
        } catch (err) {
            if (mounted.current)
                setError(
                    lobbyErrorMessage(
                        err,
                        "Couldn’t update the party. Try again."
                    )
                );
        } finally {
            if (mounted.current) setBusy(false);
        }
    };
    return createPortal(
        <Backdrop
            onPointerDown={(event) => {
                if (event.target === event.currentTarget && !busy) onClose();
            }}
        >
            <div
                className="group-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="group-dialog-title"
                ref={dialog}
                onKeyDown={(event) => {
                    event.stopPropagation();
                    if (
                        event.key === "Escape" &&
                        !event.nativeEvent.isComposing
                    ) {
                        event.preventDefault();
                        if (!busy) onClose();
                    }
                    if (event.key !== "Tab") return;
                    const targets = Array.from(
                        dialog.current.querySelectorAll<HTMLElement>(
                            'button:not(:disabled), input:not(:disabled), a[href], [tabindex="0"]'
                        )
                    );
                    const first = targets[0],
                        last = targets[targets.length - 1];
                    if (event.shiftKey && document.activeElement === first) {
                        event.preventDefault();
                        last?.focus();
                    }
                    if (!event.shiftKey && document.activeElement === last) {
                        event.preventDefault();
                        first?.focus();
                    }
                }}
            >
                <header>
                    <div className="group-mark">
                        <LobbyDockIcon name="people" />
                    </div>
                    <button
                        className="icon-button"
                        type="button"
                        aria-label="Close party"
                        onClick={onClose}
                        disabled={busy}
                    >
                        <Icon name="close" size={17} />
                    </button>
                </header>
                <h2 id="group-dialog-title">
                    {joinCode
                        ? "Join a party"
                        : group?.name || "A little company"}
                </h2>
                <p className="subtitle">
                    {joinCode
                        ? "Join the shared conversation and explore worlds together."
                        : group
                        ? `${group.members.length} of 8 people · Chat and go places together`
                        : "Start a party. Chat, invite friends, and travel together."}
                </p>
                {joinCode ? (
                    <button
                        className="primary"
                        disabled={busy}
                        onClick={() =>
                            void run(async () => {
                                const result = await action({
                                    action: "join",
                                    code: joinCode,
                                });
                                onSelected(result.groupId);
                                onClose();
                            })
                        }
                    >
                        {busy ? "Joining…" : "Join party"}
                    </button>
                ) : (
                    <>
                        {group ? (
                            <>
                                <div
                                    className="members"
                                    aria-label="Party members"
                                >
                                    {group.members.map((member) => (
                                        <div className="member" key={member.id}>
                                            <span className="portrait">
                                                {member.avatar ? (
                                                    <img
                                                        src={member.avatar}
                                                        alt=""
                                                        onError={
                                                            showGuestPortrait
                                                        }
                                                    />
                                                ) : (
                                                    member.name.slice(0, 1)
                                                )}
                                            </span>
                                            <span className="member-identity">
                                                <span>{member.name}</span>
                                                {member.location && (
                                                    <small>
                                                        {groupLocationLabel(
                                                            member.location
                                                        )}
                                                    </small>
                                                )}
                                            </span>
                                            <small>
                                                {member.id === sessionId
                                                    ? "You"
                                                    : member.id ===
                                                      group.ownerId
                                                    ? "Created party"
                                                    : ""}
                                            </small>
                                        </div>
                                    ))}
                                </div>
                                <button
                                    className="share"
                                    disabled={busy}
                                    onClick={() =>
                                        void run(async () => {
                                            const url = new URL(
                                                "/",
                                                window.location.origin
                                            );
                                            url.searchParams.set("lobby", "1");
                                            url.searchParams.set(
                                                "group",
                                                group.joinCode
                                            );
                                            await navigator.clipboard.writeText(
                                                url.href
                                            );
                                            setCopied(true);
                                        })
                                    }
                                >
                                    <svg
                                        width="16"
                                        height="16"
                                        viewBox="0 0 16 16"
                                        fill="none"
                                        aria-hidden="true"
                                    >
                                        <path
                                            d="M6 10l4-4M6.5 5.5l1.8-1.8a2.83 2.83 0 014 4l-1.8 1.8m-1 1-1.8 1.8a2.83 2.83 0 01-4-4l1.8-1.8"
                                            stroke="currentColor"
                                            strokeWidth="1.5"
                                            strokeLinecap="round"
                                        />
                                    </svg>
                                    {copied
                                        ? "Invite link copied"
                                        : "Copy invite link"}
                                </button>
                            </>
                        ) : (
                            <label className="field">
                                Party name
                                <input
                                    maxLength={48}
                                    placeholder="Friday explorers"
                                    value={name}
                                    onChange={(event) =>
                                        setName(event.target.value)
                                    }
                                />
                            </label>
                        )}
                        {(!group || group.ownerId === sessionId) && (
                            <>
                                <label className="field">
                                    {group
                                        ? "Invite someone"
                                        : "Invite people here"}
                                    <span className="search">
                                        <Icon name="search" size={16} />
                                        <input
                                            value={query}
                                            onChange={(event) =>
                                                setQuery(event.target.value)
                                            }
                                            placeholder="Search people…"
                                        />
                                    </span>
                                </label>
                                <div
                                    className="candidates"
                                    role="group"
                                    aria-label="People to invite"
                                >
                                    {candidates.map((person) => {
                                        const pending = invited.includes(
                                            person.id
                                        );
                                        return (
                                            <button
                                                type="button"
                                                className="candidate"
                                                aria-label={`Invite ${person.name}`}
                                                key={person.id}
                                                disabled={
                                                    busy ||
                                                    pending ||
                                                    (members.size +
                                                        selected.length >=
                                                        8 &&
                                                        !selected.includes(
                                                            person.id
                                                        ))
                                                }
                                                aria-pressed={
                                                    group
                                                        ? undefined
                                                        : selected.includes(
                                                              person.id
                                                          )
                                                }
                                                onClick={() => {
                                                    if (group)
                                                        void run(async () => {
                                                            await action({
                                                                action: "invite",
                                                                groupId:
                                                                    group.id,
                                                                inviteeId:
                                                                    person.id,
                                                            });
                                                            setInvited(
                                                                (previous) => [
                                                                    ...previous,
                                                                    person.id,
                                                                ]
                                                            );
                                                        });
                                                    else
                                                        setSelected(
                                                            (previous) =>
                                                                previous.includes(
                                                                    person.id
                                                                )
                                                                    ? previous.filter(
                                                                          (
                                                                              id
                                                                          ) =>
                                                                              id !==
                                                                              person.id
                                                                      )
                                                                    : [
                                                                          ...previous,
                                                                          person.id,
                                                                      ]
                                                        );
                                                }}
                                            >
                                                <span className="portrait">
                                                    {person.avatar ? (
                                                        <img
                                                            src={person.avatar}
                                                            alt=""
                                                            onError={
                                                                showGuestPortrait
                                                            }
                                                        />
                                                    ) : (
                                                        person.name.slice(0, 1)
                                                    )}
                                                </span>
                                                <span>{person.name}</span>
                                                <small>
                                                    {pending
                                                        ? "Invited"
                                                        : group
                                                        ? "Invite"
                                                        : selected.includes(
                                                              person.id
                                                          )
                                                        ? "Selected"
                                                        : "+"}
                                                </small>
                                            </button>
                                        );
                                    })}
                                    {!candidates.length && (
                                        <p className="empty">
                                            {query
                                                ? "No people match your search."
                                                : "You can invite more people with your party link."}
                                        </p>
                                    )}
                                </div>
                            </>
                        )}
                        {group ? (
                            <footer>
                                <button
                                    disabled={busy}
                                    onClick={() =>
                                        void run(async () => {
                                            await action({
                                                action: "leave",
                                                groupId: group.id,
                                            });
                                            onClose();
                                        })
                                    }
                                >
                                    Leave party
                                </button>
                                <button
                                    className="primary"
                                    disabled={busy}
                                    onClick={() => {
                                        onSelected(group.id);
                                        onClose();
                                    }}
                                >
                                    Open chat
                                </button>
                            </footer>
                        ) : (
                            <button
                                className="primary"
                                disabled={busy || !name.trim()}
                                onClick={() =>
                                    void run(async () => {
                                        const result = await action({
                                            action: "create",
                                            name: name.trim(),
                                            memberIds: selected,
                                        });
                                        onSelected(result.groupId);
                                        onClose();
                                    })
                                }
                            >
                                {busy
                                    ? "Creating…"
                                    : `Create party${
                                          selected.length
                                              ? ` · ${selected.length + 1}`
                                              : ""
                                      }`}
                            </button>
                        )}
                    </>
                )}
                {/* Under the button that failed; pressing it again retries. */}
                <InlineError message={!busy && error} />
            </div>
        </Backdrop>,
        document.body
    );
}
const Backdrop = styled.div`
    position: fixed;
    inset: 0;
    z-index: 150;
    display: grid;
    place-items: center;
    padding: 20px;
    background: #03050880;
    backdrop-filter: blur(12px);
    font-family: var(--oc-font);
    color: #eceef2;
    * {
        box-sizing: border-box;
    }
    .group-dialog {
        width: min(400px, 100%);
        max-height: min(740px, calc(100dvh - 40px));
        overflow-y: auto;
        padding: 24px;
        background: #191b20f5;
        border: 1px solid #ffffff12;
        border-radius: 24px;
        box-shadow: 0 24px 90px #0008;
    }
    header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 20px;
    }
    .group-mark {
        display: grid;
        place-items: center;
        height: 40px;
        width: 40px;
        border-radius: 13px;
        background: #ffffff09;
    }
    h2 {
        margin: 0 0 8px;
        font-size: 23px;
        font-weight: 500;
        letter-spacing: -0.5px;
    }
    .subtitle {
        color: #a0a5af;
        font-size: 13px;
        line-height: 1.6;
        margin: 0 0 22px;
    }
    button,
    input {
        font: inherit;
        color: inherit;
    }
    button {
        cursor: pointer;
        border: 0;
        background: #ffffff08;
        border-radius: 10px;
        padding: 10px 13px;
        font-size: 12px;
    }
    button:hover {
        background: #ffffff12;
    }
    button:disabled {
        opacity: 0.4;
        cursor: default;
    }
    button:focus-visible,
    input:focus-visible {
        outline: 2px solid #ffffff65;
        outline-offset: 2px;
    }
    .icon-button {
        display: grid;
        place-items: center;
        padding: 8px;
        background: transparent;
    }
    .primary {
        background: #eceef2;
        color: #191b20;
        width: 100%;
        font-weight: 600;
        margin-top: 16px;
    }
    .primary:hover {
        background: white;
    }
    .field {
        display: flex;
        flex-direction: column;
        gap: 9px;
        font-size: 12px;
        color: #a0a5af;
        margin-bottom: 18px;
    }
    input {
        width: 100%;
        border-radius: 11px;
        padding: 12px;
        border: 1px solid #ffffff0e;
        background: #090c1133;
        color: #eceef2;
        font-size: 13px;
    }
    .search {
        position: relative;
        display: flex;
        align-items: center;
    }
    .search > svg {
        position: absolute;
        left: 12px;
    }
    .search input {
        padding-left: 37px;
    }
    .members,
    .candidates {
        display: flex;
        flex-direction: column;
        gap: 4px;
        max-height: 220px;
        overflow: auto;
        scrollbar-width: thin;
    }
    .member,
    .candidate {
        display: flex;
        align-items: center;
        gap: 10px;
        text-align: left;
        min-height: 42px;
        padding: 6px 9px;
        background: transparent;
        font-size: 13px;
    }
    .candidate[aria-pressed="true"] {
        background: #ffffff0c;
    }
    .member small,
    .candidate small {
        margin-left: auto;
        color: #9299a5;
        font-size: 11px;
    }
    .member-identity {
        display: flex;
        flex-direction: column;
        gap: 3px;
        min-width: 0;
    }
    .member-identity small {
        margin-left: 0;
        overflow-wrap: anywhere;
    }
    .portrait {
        width: 27px;
        height: 27px;
        flex-shrink: 0;
        display: grid;
        place-items: center;
        background: #ffffff10;
        border-radius: 50%;
        overflow: hidden;
    }
    .portrait img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }
    .share {
        width: 100%;
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 8px;
        margin: 14px 0 22px;
    }
    footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        margin-top: 18px;
    }
    footer .primary {
        width: auto;
        margin: 0;
    }
    footer > button:first-child {
        background: transparent;
        color: #999fa9;
    }
    .empty {
        font-size: 12px;
        line-height: 1.6;
        color: #9ba1ac;
    }
`;
