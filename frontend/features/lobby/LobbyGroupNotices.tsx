import React, { useEffect, useState } from "react";
import type {
    LobbyGroup,
    LobbyGroupInvitation,
    LobbyGroupTravelWait,
} from "../../../multiplayer/protocol/lobby-groups";
import { isLobbyTravelLive } from "../../../multiplayer/protocol/lobby-groups";
import type { GroupAction } from "./LobbyGroupsModal";
import InlineError from "@ui/components/InlineError";
import { lobbyErrorMessage } from "./lobbyErrors";

/** The server's clock as last heard, and when (on `performance.now()`). */
type ServerClock = { serverNow: number; receivedAt: number } | null;

/**
 * A traveller's connection dropped and the trip is holding their place. The
 * countdown is drawn but not announced: a screen reader hears the sentence
 * once, not a number every second.
 */
function ReconnectWait({
    waitingFor,
    clock,
}: {
    waitingFor: LobbyGroupTravelWait[];
    clock?: ServerClock;
}) {
    const until = Math.max(...waitingFor.map((entry) => entry.until));
    const serverNow = clock?.serverNow,
        receivedAt = clock?.receivedAt;
    const [seconds, setSeconds] = useState<number | null>(null);
    useEffect(() => {
        if (serverNow === undefined) return setSeconds(null);
        const left = () =>
            setSeconds(
                Math.max(
                    0,
                    Math.ceil(
                        (until - (serverNow + performance.now() - receivedAt)) /
                            1000
                    )
                )
            );
        left();
        const timer = window.setInterval(left, 250);
        return () => window.clearInterval(timer);
    }, [until, serverNow, receivedAt]);
    const names = waitingFor.map((entry) => entry.name);
    return (
        <>
            Waiting for{" "}
            {names.length > 2 ? `${names.length} people` : names.join(" and ")}{" "}
            to reconnect…
            {seconds !== null && <span aria-hidden="true"> {seconds}s</span>}
        </>
    );
}

export default function LobbyGroupNotices({
    groups,
    invitations,
    sessionId,
    clock,
    action,
    onSelected,
    onAccept,
    onDecline,
    onLaunch,
    onCancel,
}: {
    groups: LobbyGroup[];
    invitations: LobbyGroupInvitation[];
    sessionId: string;
    /** For the reconnect countdown; without it the wait shows no seconds. */
    clock?: ServerClock;
    action: GroupAction;
    onSelected: (id: string) => void;
    onAccept: (groupId: string, travelId: string) => Promise<unknown>;
    onDecline: (groupId: string, travelId: string) => Promise<unknown>;
    onLaunch: (groupId: string, travelId: string) => Promise<unknown>;
    onCancel: (groupId: string, travelId: string) => Promise<unknown>;
}) {
    const [pending, setPending] = useState("");
    const [error, setError] = useState("");
    /** The action that failed, for its error's Retry. */
    const [failed, setFailed] = useState<{
        id: string;
        task: () => Promise<unknown>;
    } | null>(null);
    const run = async (id: string, task: () => Promise<unknown>) => {
        if (pending) return;
        setPending(id);
        setError("");
        setFailed(null);
        try {
            await task();
        } catch (err) {
            setError(lobbyErrorMessage(err, "Couldn’t update the party."));
            setFailed({ id, task });
        } finally {
            setPending("");
        }
    };
    return (
        <div className="group-notices">
            {invitations.map((invitation) => (
                <article
                    className="group-notice"
                    key={invitation.id}
                    aria-label={`Invitation to ${invitation.groupName}`}
                >
                    <small>PARTY INVITE</small>
                    <p>
                        <strong>{invitation.inviter.name}</strong> invited you
                        to <strong>{invitation.groupName}</strong>.
                    </p>
                    <div>
                        <button
                            type="button"
                            className="notice-primary"
                            disabled={!!pending}
                            onClick={() =>
                                void run(invitation.id, async () => {
                                    const result = await action({
                                        action: "respond-invite",
                                        invitationId: invitation.id,
                                        accepted: true,
                                    });
                                    onSelected(
                                        result.groupId || invitation.groupId
                                    );
                                })
                            }
                        >
                            Join party
                        </button>
                        <button
                            type="button"
                            disabled={!!pending}
                            onClick={() =>
                                void run(invitation.id, () =>
                                    action({
                                        action: "respond-invite",
                                        invitationId: invitation.id,
                                        accepted: false,
                                    })
                                )
                            }
                        >
                            Not now
                        </button>
                    </div>
                </article>
            ))}
            {groups
                .filter(
                    (group) =>
                        group.travel && isLobbyTravelLive(group.travel.status)
                )
                .map((group) => {
                    const travel = group.travel;
                    const initiator = group.members.find(
                        (member) => member.id === travel.initiatorId
                    );
                    const mine = travel.initiatorId === sessionId;
                    const response = travel.responses[sessionId];
                    if (response === "declined" || (!response && !mine))
                        return null;
                    const accepted = travel.acceptedIds.length;
                    const ready = travel.readyIds.length;
                    const inviting = travel.status === "inviting";
                    return (
                        <article
                            className="group-notice"
                            key={travel.id}
                            aria-label={`Travel to ${travel.destination.title}`}
                        >
                            <small>
                                {group.name} ·{" "}
                                {inviting ? "NEXT STOP" : "GETTING READY"}
                            </small>
                            <p>
                                {mine ? (
                                    <>
                                        Invite your party to{" "}
                                        <strong>
                                            {travel.destination.title}
                                        </strong>
                                        .
                                    </>
                                ) : (
                                    <>
                                        <strong>
                                            {initiator?.name || "Your party"}
                                        </strong>{" "}
                                        is heading to{" "}
                                        <strong>
                                            {travel.destination.title}
                                        </strong>
                                        . Join them?
                                    </>
                                )}
                            </p>
                            {response === "pending" ? (
                                <div>
                                    <button
                                        type="button"
                                        className="notice-primary"
                                        disabled={!!pending}
                                        onClick={() =>
                                            void run(travel.id, async () => {
                                                await onAccept(
                                                    group.id,
                                                    travel.id
                                                );
                                                onSelected(group.id);
                                            })
                                        }
                                    >
                                        Join trip
                                    </button>
                                    <button
                                        type="button"
                                        disabled={!!pending}
                                        onClick={() =>
                                            void run(travel.id, () =>
                                                onDecline(group.id, travel.id)
                                            )
                                        }
                                    >
                                        Stay here
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <p className="notice-status" role="status">
                                        {travel.waitingFor?.length ? (
                                            <ReconnectWait
                                                waitingFor={travel.waitingFor}
                                                clock={clock}
                                            />
                                        ) : travel.status === "travelling" ? (
                                            "Going together…"
                                        ) : travel.status === "gathering" ? (
                                            "Gathering your party…"
                                        ) : (
                                            `${accepted} joining · ${ready} ready`
                                        )}
                                    </p>
                                    {inviting && (
                                        <div>
                                            {mine ? (
                                                <button
                                                    type="button"
                                                    className="notice-primary"
                                                    disabled={
                                                        !!pending || !ready
                                                    }
                                                    onClick={() =>
                                                        void run(
                                                            travel.id,
                                                            () =>
                                                                onLaunch(
                                                                    group.id,
                                                                    travel.id
                                                                )
                                                        )
                                                    }
                                                >
                                                    Go together
                                                </button>
                                            ) : (
                                                <span className="notice-status">
                                                    Waiting for{" "}
                                                    {initiator?.name ||
                                                        "your party"}
                                                </span>
                                            )}
                                            <button
                                                type="button"
                                                disabled={!!pending}
                                                onClick={() =>
                                                    void run(travel.id, () =>
                                                        onCancel(
                                                            group.id,
                                                            travel.id
                                                        )
                                                    )
                                                }
                                            >
                                                {mine
                                                    ? "Cancel"
                                                    : "Cancel trip"}
                                            </button>
                                        </div>
                                    )}
                                    {!inviting && (
                                        <div>
                                            <button
                                                type="button"
                                                disabled={!!pending}
                                                onClick={() =>
                                                    void run(travel.id, () =>
                                                        onCancel(
                                                            group.id,
                                                            travel.id
                                                        )
                                                    )
                                                }
                                            >
                                                Cancel trip
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}
                        </article>
                    );
                })}
            <InlineError
                message={!pending && error}
                onRetry={
                    failed ? () => void run(failed.id, failed.task) : undefined
                }
            />
        </div>
    );
}
