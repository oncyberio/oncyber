import React, { useContext, useEffect, useState } from "react";
import styled from "styled-components";
import { actionButton, blueAction } from "@styles/brand";
import { UserContext } from "@components/context/UserContext";
export interface PartyDestination {
    experienceId: string;
    instanceId: string;
    revision?: number;
    unavailableAt?: number;
    worldId?: string;
    url?: string;
}
interface PartyState {
    selfId?: string;
    party?: {
        id: string;
        leaderId: string;
        members: { id: string; name?: string; state?: "reserved" | "ready" | "entered" | "failed" | "declined" }[];
        destination?: PartyDestination;
    };
    invitations: {
        id: string;
        partyId: string;
        fromId: string;
        fromName?: string;
        expiresAt: number;
    }[];
}
const partyErrors: Record<string, string> = {
    FRIENDSHIP_REQUIRED: "Add each other as friends before sending a party invitation.",
    PARTY_CONTACT_DENIED: "This party invitation is no longer available.",
    PARTY_FULL: "This party is full. A party can have up to eight people.",
    INVITATION_EXPIRED: "This invitation expired. Ask your friend to send another.",
    MOVE_IN_PROGRESS: "Your party is already preparing a move. Try again shortly.",
    PARTY_INSTANCE_UNAVAILABLE: "This party room has ended. The leader can bring the party here again.",
    PARTY_ADMISSION_EXPIRED: "Your reserved seat expired. Ask the leader to bring the party here again.",
    PARTY_MEMBER_GATED: "Someone in your party does not have access to this world.",
    PARTY_DESTINATION_UNSUPPORTED: "Party travel is not available for this world yet. You can still visit it individually.",
    PARTY_SERVICE_UNAVAILABLE: "Parties are temporarily unavailable. Please try again.",
};
async function request(url: string, options: RequestInit = {}) {
    const response = await fetch(url, options),
        data = await response.json().catch(() => ({}));
    if (!response.ok)
        throw new Error(
            partyErrors[data.error] || (response.status === 401 ? "Please sign in again to update your party." : "Could not update your party. Please try again.")
        );
    return data;
}
export default function PartyPanel({
    experienceId,
    onTravel,
    onSignIn,
}: {
    experienceId: string;
    onTravel(destination: PartyDestination): void;
    onSignIn(): void;
}) {
    const { user, userData, authenticated, isAnonymous } =
        useContext(UserContext);
    const signedIn = authenticated && !isAnonymous && !!user?.id;
    const [state, setState] = useState<PartyState>({ invitations: [] });
    const [friends, setFriends] = useState<
        { accountId: string; name: string }[]
    >([]);
    const [invitee, setInvitee] = useState(""),
        [busy, setBusy] = useState("");
    const [error, setError] = useState(""),
        [loaded, setLoaded] = useState(false);
    useEffect(() => {
        if (!signedIn) return;
        let stopped = false,
            timer;
        const abort = new AbortController();
        setState({ invitations: [] });
        setLoaded(false);
        async function load() {
            try {
                const [next, people] = await Promise.all([
                    request("/api/social/parties", { signal: abort.signal }),
                    request("/api/social", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ operation: "snapshot" }), signal: abort.signal }),
                ]);
                if (!stopped) {
                    setState(next);
                    setFriends((people.friends || []).map((person) => ({ accountId: person.uid, name: person.name })));
                    setLoaded(true);
                }
            } catch (failure) {
                if (!stopped) {
                    setError(failure.message);
                    setLoaded(true);
                }
            }
            if (!stopped)
                timer = setTimeout(load, document.hidden ? 15000 : 4000);
        }
        load();
        return () => {
            stopped = true;
            abort.abort();
            clearTimeout(timer);
        };
    }, [signedIn, user?.id]);
    async function action(label: string, body: Record<string, unknown>) {
        if (busy) return;
        setBusy(label);
        setError("");
        try {
            await request("/api/social/parties", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    ...body,
                    requestId: crypto.randomUUID(),
                }),
            });
            setState(await request("/api/social/parties"));
            if (body.action === "invite") setInvitee("");
        } catch (failure) {
            setError(failure.message);
        } finally {
            setBusy("");
        }
    }
    const party = state.party;
    const candidates = friends.filter(
        (person) =>
            !party?.members.some((member) => member.id === person.accountId)
    );
    return (
        <PartySection aria-label="Party">
            <h3>Party</h3>
            {!signedIn ? (
                <button className="sign-in" onClick={onSignIn}>
                    Sign in to join a party
                </button>
            ) : !loaded ? (
                <p role="status">Loading your party…</p>
            ) : (
                <>
                    {!party ? (
                        <>
                            <p>Explore and play together.</p>
                            <button
                                disabled={!!busy}
                                onClick={() =>
                                    action("Creating…", { action: "create" })
                                }
                            >
                                Create party
                            </button>
                        </>
                    ) : (
                        <>
                            <ul>
                                {party.members.map((member) => (
                                    <li key={member.id}>
                                        {member.name || "Oncyber visitor"}
                                        {member.id === party.leaderId && (
                                            <small> Leader</small>
                                        )}
                                        {member.state && <small> · {{ reserved: "Seat reserved", ready: "Ready", entered: "Playing", failed: "Could not connect", declined: "Staying here" }[member.state]}</small>}
                                    </li>
                                ))}
                            </ul>
                            {party.leaderId ===
                                (state.selfId || userData?.id || user.id) && (
                                <>
                                    <label>
                                        Invite a friend
                                        <select
                                            aria-label="Invite to party"
                                            value={invitee}
                                            onChange={(event) =>
                                                setInvitee(event.target.value)
                                            }
                                            disabled={!!busy}
                                        >
                                            <option value="">
                                                Choose a person
                                            </option>
                                            {candidates.map((person) => (
                                                <option
                                                    key={person.accountId}
                                                    value={person.accountId}
                                                >
                                                    {person.name}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                    <button
                                        disabled={!!busy || !invitee}
                                        onClick={() =>
                                            action("Inviting…", {
                                                action: "invite",
                                                toId: invitee,
                                            })
                                        }
                                    >
                                        Send invitation
                                    </button>
                                    {experienceId && (
                                    <button
                                        disabled={!!busy}
                                        onClick={() =>
                                            action("Preparing world…", {
                                                action: "move",
                                                experienceId,
                                            })
                                        }
                                    >
                                        Bring party to this world
                                    </button>
                                    )}
                                </>
                            )}
                            {party.destination?.unavailableAt && (
                                <p role="status">
                                    Party session ended. The leader can move the
                                    party again.
                                </p>
                            )}
                            {party.destination &&
                                !party.destination.unavailableAt && (
                                    <button
                                        disabled={!!busy}
                                        onClick={() =>
                                            onTravel(party.destination)
                                        }
                                    >
                                        Join party's world
                                    </button>
                                )}
                            <button
                                disabled={!!busy}
                                onClick={() =>
                                    action("Leaving…", { action: "leave" })
                                }
                            >
                                Leave party
                            </button>
                        </>
                    )}
                    {(state.invitations || [])
                        .filter(
                            (invitation) => invitation.expiresAt > Date.now()
                        )
                        .map((invitation) => (
                            <div className="invitation" key={invitation.id}>
                                <p>
                                    {invitation.fromName || "An Oncyber player"}{" "}
                                    invited you to a party.
                                </p>
                                <div className="actions">
                                    <button
                                        disabled={!!busy || !!party}
                                        onClick={() =>
                                            action("Joining…", {
                                                action: "respond",
                                                invitationId: invitation.id,
                                                accept: true,
                                            })
                                        }
                                    >
                                        Accept invitation
                                    </button>
                                    <button
                                        disabled={!!busy}
                                        onClick={() =>
                                            action("Declining…", {
                                                action: "respond",
                                                invitationId: invitation.id,
                                                accept: false,
                                            })
                                        }
                                    >
                                        Decline
                                    </button>
                                </div>
                                {party && (
                                    <small>
                                        Leave your current party before
                                        accepting another.
                                    </small>
                                )}
                            </div>
                        ))}
                </>
            )}
            {busy && <small role="status">{busy}</small>}
            {error && <p role="alert">{error}</p>}
        </PartySection>
    );
}
const PartySection = styled.section`
    display: grid;
    gap: 12px;
    border-top: 1px solid #ffffff1c;
    padding-top: 16px;
    margin-top: 16px;
    h3,
    p {
        margin: 0;
    }
    h3 {
        font: inherit;
        font-weight: 500;
    }
    p,
    small {
        color: #aaa;
        font-size: 12px;
    }
    ul {
        padding-left: 16px;
        margin: 0;
        display: grid;
        gap: 6px;
    }
    button,
    select {
        border: 1px solid #ffffff26;
        border-radius: 10px;
        color: #eee;
        background: #242424;
        font: inherit;
        padding: 8px 10px;
        min-height: 38px;
        cursor: pointer;
    }
    button:disabled {
        opacity: 0.45;
        cursor: default;
    }
    select {
        width: 100%;
    }
    label {
        display: grid;
        gap: 6px;
        font-size: 12px;
    }
    .invitation {
        display: grid;
        gap: 8px;
        padding-top: 12px;
    }
    .actions {
        display: flex;
        gap: 8px;
    }
    :is(button, select):focus-visible {
        outline: 2px solid #3975ff;
        outline-offset: 2px;
    }
    /* Signing in is the important action: the shared blue button. */
    button.sign-in {
        ${actionButton}
        ${blueAction}
    }
`;
