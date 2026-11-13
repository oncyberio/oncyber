import { groupDestinationHref } from "@utils/lobbyGroupContext";
import { lobbyErrorMessage } from "./lobbyErrors";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
    LobbyGroup,
    LobbyGroupAction,
    LobbyGroupDestination,
    LobbyGroupMember,
    LobbyGroupPose,
    LobbyGroupResult,
} from "../../../multiplayer/protocol/lobby-groups";
import { isLobbyTravelLive } from "../../../multiplayer/protocol/lobby-groups";
import {
    destinationFrameUrl,
    type LobbyDestination,
    type LobbyDestinationPhase,
} from "./lobbyJourneyProtocol";

export interface GroupJourneySocial {
    sessionId: string;
    groups: LobbyGroup[];
    groupClock: { serverNow: number; receivedAt: number } | null;
    groupAction(
        command: Omit<LobbyGroupAction, "requestId">
    ): Promise<LobbyGroupResult>;
}
export interface GroupJourneyController {
    phase: LobbyDestinationPhase;
    selected: LobbyDestination | null;
    attempt: string | null;
    select(destination: LobbyDestination): void;
    enter(): boolean;
    cancel(): void;
}
export interface LobbyGroupFormation {
    id: string;
    selfId: string;
    initiatorId: string;
    members: readonly LobbyGroupMember[];
    poses: Record<string, LobbyGroupPose>;
    startedAt: number;
}
interface Prepared {
    sessionId: string;
    groupId: string;
    travelId: string;
    previousAttempt: string | null;
    destinationHref: string;
    attempt: string | null;
    ready: boolean;
    failed: boolean;
    started: boolean;
    entered: boolean;
    completed: boolean;
}
const active = isLobbyTravelLive;

/** Network consent coordinates ordinary host preparation; it never grants entry. */
export default function useLobbyGroupJourney({
    social,
    journey,
}: {
    social: GroupJourneySocial;
    journey: GroupJourneyController;
}) {
    const [error, setError] = useState("");
    const [, refreshPreparation] = useState(0);
    const dismissed = useRef(new Set<string>());
    const prepared = useRef<Prepared | null>(null);
    const latest = useRef({ social, journey });
    latest.current = { social, journey };
    const previousSession = useRef(social.sessionId);
    const formationCache = useRef(
        new Map<
            string,
            { ids: string; members: LobbyGroupMember[]; startedAt: number }
        >()
    );
    const candidates = social.groups.filter((group) => group.travel);
    const group =
        candidates.find(
            (entry) => entry.travel.id === prepared.current?.travelId &&
                entry.travel.status !== "complete"
        ) ||
        candidates.find(
            (entry) =>
                active(entry.travel.status) &&
                entry.travel.responses[social.sessionId] === "accepted"
        ) ||
        candidates.find((entry) => active(entry.travel.status)) ||
        candidates.find((entry) => entry.travel.id === prepared.current?.travelId) ||
        null;
    const activeTravel = group?.travel || null;

    const send = useCallback(
        async (command: Omit<LobbyGroupAction, "requestId">) => {
            setError("");
            try {
                return await latest.current.social.groupAction(command);
            } catch (failure) {
                setError(
                    lobbyErrorMessage(failure, "Could not update party travel.")
                );
                throw failure;
            }
        },
        []
    );
    const cancelPrepared = useCallback(() => {
        const owned = prepared.current;
        prepared.current = null;
        if (owned) refreshPreparation((revision) => revision + 1);
        if (
            owned &&
            latest.current.journey.attempt === owned.attempt &&
            (latest.current.journey.phase !== "entered" || !owned.completed)
        )
            latest.current.journey.cancel();
    }, []);

    useEffect(() => {
        if (previousSession.current !== social.sessionId) {
            previousSession.current = social.sessionId;
            cancelPrepared();
            formationCache.current.clear();
            dismissed.current.clear();
            setError("");
            return;
        }
        const owned = prepared.current;
        const currentGroup =
            owned && social.groups.find((entry) => entry.id === owned.groupId);
        if (owned && currentGroup?.travel?.id === owned.travelId &&
            currentGroup.travel.status === "complete") owned.completed = true;
        if (
            owned &&
            (!currentGroup ||
                currentGroup.travel?.id !== owned.travelId ||
                currentGroup.travel.status === "cancelled" ||
                currentGroup.travel.responses[social.sessionId] !== "accepted")
        ) {
            if (currentGroup?.travel?.reason)
                setError(currentGroup.travel.reason);
            cancelPrepared();
        }
        if (
            !group ||
            !activeTravel ||
            !active(activeTravel.status) ||
            activeTravel.responses[social.sessionId] !== "accepted" ||
            prepared.current?.travelId === activeTravel.id ||
            dismissed.current.has(activeTravel.id)
        )
            return;
        let destinationHref: string;
        try {
            // Match the same-origin/path validation used by individual travel.
            destinationFrameUrl(
                activeTravel.destination.href,
                window.location.origin,
                "group-check"
            );
            destinationHref = groupDestinationHref(
                activeTravel.destination.href,
                activeTravel.id,
                window.location.origin
            );
        } catch (failure) {
            setError(
                lobbyErrorMessage(
                    failure,
                    "This world needs to open in its own page."
                )
            );
            void social
                .groupAction({
                    action: "travel-ready",
                    groupId: group.id,
                    travelId: activeTravel.id,
                    success: false,
                })
                .catch(() => {});
            return;
        }
        prepared.current = {
            destinationHref,
            sessionId: social.sessionId,
            groupId: group.id,
            travelId: activeTravel.id,
            previousAttempt: journey.attempt,
            attempt: null,
            ready: false,
            failed: false,
            started: false,
            entered: false,
            completed: false,
        };
        journey.select({ ...activeTravel.destination, href: destinationHref });
    }, [
        social.sessionId,
        social.groups,
        group,
        activeTravel,
        journey.attempt,
        journey.select,
        cancelPrepared,
    ]);

    useEffect(() => {
        const owned = prepared.current;
        if (
            !owned ||
            owned.sessionId !== social.sessionId ||
            !activeTravel ||
            activeTravel.id !== owned.travelId ||
            activeTravel.responses[social.sessionId] !== "accepted" ||
            !active(activeTravel.status)
        )
            return;
        if (
            !owned.attempt &&
            journey.attempt &&
            journey.attempt !== owned.previousAttempt &&
            journey.selected?.href === owned.destinationHref
        )
            owned.attempt = journey.attempt;
        const ownsAttempt = owned.attempt && journey.attempt === owned.attempt;
        // The host clears its attempt while preserving the failed selection.
        const ownsFailure = journey.phase === "error" && !journey.attempt &&
            journey.selected?.href === owned.destinationHref;
        if (!ownsAttempt && !ownsFailure) return;
        if (journey.phase === "ready" && !owned.ready) {
            owned.ready = true;
            void send({
                action: "travel-ready",
                groupId: owned.groupId,
                travelId: owned.travelId,
                success: true,
            }).catch(() => {});
        } else if (journey.phase === "error" && !owned.failed) {
            owned.failed = true;
            void send({
                action: ["gathering", "travelling"].includes(activeTravel.status)
                    ? "travel-cancel" : "travel-ready",
                groupId: owned.groupId,
                travelId: owned.travelId,
                success: false,
            }).catch(() => {});
        } else if (journey.phase === "entered" && !owned.entered) {
            owned.entered = true;
            void send({
                action: "travel-entered",
                groupId: owned.groupId,
                travelId: owned.travelId,
            }).catch(() => {});
        }
    }, [
        social.sessionId,
        activeTravel,
        journey.phase,
        journey.attempt,
        journey.selected,
        send,
    ]);

    useEffect(() => {
        const owned = prepared.current,
            clock = social.groupClock;
        if (
            !owned ||
            owned.started ||
            !clock ||
            activeTravel?.id !== owned.travelId ||
            activeTravel.status !== "travelling" ||
            !Number.isFinite(activeTravel.startAt) ||
            !owned.ready ||
            journey.phase !== "ready" ||
            journey.attempt !== owned.attempt
        )
            return;
        const deadline =
            clock.receivedAt + activeTravel.startAt - clock.serverNow;
        const timer = setTimeout(() => {
            const current = latest.current,
                target = prepared.current;
            const live = current.social.groups.find(
                (entry) => entry.id === owned.groupId
            )?.travel;
            if (
                target !== owned ||
                owned.started ||
                current.social.sessionId !== owned.sessionId ||
                live?.id !== owned.travelId ||
                live.status !== "travelling" ||
                live.responses[owned.sessionId] !== "accepted" ||
                current.journey.attempt !== owned.attempt ||
                current.journey.phase !== "ready"
            )
                return;
            owned.started = current.journey.enter();
        }, Math.max(0, deadline - performance.now()));
        return () => clearTimeout(timer);
    }, [
        social.sessionId,
        social.groupClock,
        activeTravel,
        journey.phase,
        journey.attempt,
        journey.enter,
    ]);

    const formation = useMemo<LobbyGroupFormation | null>(() => {
        if (
            !group ||
            !activeTravel ||
            !["gathering", "travelling", "complete"].includes(
                activeTravel.status
            ) ||
            !activeTravel.acceptedIds.includes(social.sessionId) ||
            !activeTravel.poses[social.sessionId] ||
            // The trip is over and you are back: a finished trip must not
            // hold the lobby in its gathering line.
            (activeTravel.status === "complete" && journey.phase === "idle")
        )
            return null;
        // Who is travelling can change while the trip waits for a dropped
        // traveller: they return on a new session id, or the trip goes on
        // without them. The formation follows that; its start time does not.
        const ids = activeTravel.acceptedIds.join(",");
        let cache = formationCache.current.get(activeTravel.id);
        if (!cache || cache.ids !== ids) {
            const known = new Map(
                cache?.members.map((member) => [member.id, member])
            );
            cache = {
                ids,
                members: activeTravel.acceptedIds
                    .map(
                        (id) =>
                            group.members.find((member) => member.id === id) ||
                            known.get(id)
                    )
                    .filter(Boolean),
                startedAt: cache?.startedAt ?? performance.now(),
            };
            formationCache.current.set(activeTravel.id, cache);
            while (formationCache.current.size > 8)
                formationCache.current.delete(
                    formationCache.current.keys().next().value
                );
        }
        return {
            id: activeTravel.id,
            selfId: social.sessionId,
            initiatorId: activeTravel.initiatorId,
            members: cache.members,
            poses: activeTravel.poses,
            startedAt: cache.startedAt,
        };
    }, [group, activeTravel, social.sessionId, journey.phase]);

    const propose = useCallback(
        (groupId: string, destination: LobbyGroupDestination) => {
            destinationFrameUrl(
                destination.href,
                window.location.origin,
                "group-check"
            );
            return send({ action: "travel-propose", groupId, destination });
        },
        [send]
    );
    const accept = useCallback(
        async (groupId: string, travelId: string) => {
            const current = latest.current;
            const sessionId = current.social.sessionId;
            if (current.journey.phase === "entered") {
                // Joining is explicit consent to leave the current destination.
                current.journey.cancel();
                await send({ action: "active-world", active: false });
                if (latest.current.social.sessionId !== sessionId)
                    throw new Error("The lobby connection changed. Join the trip again.");
            }
            return send({
                action: "travel-respond",
                groupId,
                travelId,
                accepted: true,
            });
        },
        [send]
    );
    const decline = useCallback(
        (groupId: string, travelId: string) =>
            send({
                action: "travel-respond",
                groupId,
                travelId,
                accepted: false,
            }),
        [send]
    );
    const launch = useCallback(
        (groupId: string, travelId: string) =>
            send({ action: "travel-launch", groupId, travelId }),
        [send]
    );
    const cancel = useCallback(
        async (groupId?: string, travelId?: string) => {
            const owned = prepared.current;
            const id = groupId || owned?.groupId,
                trip = travelId || owned?.travelId;
            if (!id || !trip) return;
            await send({
                action: "travel-cancel",
                groupId: id,
                travelId: trip,
            });
            dismissed.current.add(trip);
            if (prepared.current?.travelId === trip) cancelPrepared();
        },
        [send, cancelPrepared]
    );
    return {
        activeTravel,
        group,
        status: activeTravel?.status || "idle",
        formation,
        error,
        propose,
        accept,
        decline,
        launch,
        cancel,
    };
}
