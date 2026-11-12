import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
    LobbyGroup,
    LobbyGroupAction,
    LobbyGroupInvitation,
    LobbyGroupPose,
    LobbyGroupResult,
    LobbyGroupsSnapshot,
} from "../../../multiplayer/protocol/lobby-groups";
import { LobbyGroups } from "./recordingGroupCoordinator";
import type { RecordingCrowd } from "./recordingCrowd";

interface SocialParties {
    sessionId: string;
    groupsSupported: boolean;
    groups: LobbyGroup[];
    invitations: LobbyGroupInvitation[];
    groupMessages: LobbyGroup["messages"];
    groupClock: { serverNow: number; receivedAt: number } | null;
    groupAction: (
        command: Omit<LobbyGroupAction, "requestId">
    ) => Promise<LobbyGroupResult>;
    getPredictedPose: () => LobbyGroupPose;
}

interface Self {
    name: string;
    avatar?: string;
    vrmUrl?: string;
    scale?: number;
}

const SELF_ID = "recording-self";
const between = (low: number, high: number) =>
    low + Math.random() * (high - low);

/**
 * Recording only. When the lobby has no party server, the staged crowd can
 * still be invited to parties: a local copy of the server's coordinator
 * answers your party actions, and each staged person accepts invitations,
 * joins trips and gets ready on their own after a short, human pause.
 *
 * Returns `social` untouched outside a recording, or when the real lobby
 * already supports parties.
 */
export default function useRecordingGroups<T extends SocialParties>(
    social: T,
    crowd: RecordingCrowd | null | undefined,
    self: Self,
    /** You are in a space (or on the way), not in the lobby. */
    away: boolean
): T & { groupPlayers?: { id: string; name: string; avatar?: string }[] } {
    const active = !!crowd && !social.groupsSupported;
    const selfId = social.sessionId || SELF_ID;
    const latest = useRef({ social, self, crowd });
    latest.current = { social, self, crowd };
    const [snapshot, setSnapshot] = useState<
        (LobbyGroupsSnapshot & { receivedAt: number }) | null
    >(null);
    const server = useRef<LobbyGroups | null>(null);
    const results = useRef(new Map<string, LobbyGroupResult>());

    useEffect(() => {
        if (!active || !crowd) return;
        const people = new Map(crowd.participants.map((p) => [p.id, p]));
        const timers = new Set<ReturnType<typeof setTimeout>>();
        const done = new Set<string>();
        let closed = false;
        const later = (key: string, delay: number, run: () => void) => {
            if (done.has(key)) return;
            done.add(key);
            const timer = setTimeout(() => {
                timers.delete(timer);
                if (!closed) run();
            }, delay);
            timers.add(timer);
        };
        let request = 0;
        const act = (
            id: string,
            command: Omit<LobbyGroupAction, "requestId">
        ) =>
            coordinator.action(id, {
                ...command,
                requestId: `staged-${++request}`,
            });
        // What a staged person does when the party state reaches them.
        const react = (id: string, state: LobbyGroupsSnapshot) => {
            for (const invitation of state.invitations)
                later(`invite:${id}:${invitation.id}`, between(700, 2200), () =>
                    act(id, {
                        action: "respond-invite",
                        invitationId: invitation.id,
                        accepted: true,
                    })
                );
            for (const group of state.groups) {
                const travel = group.travel;
                if (!travel) continue;
                const base = { groupId: group.id, travelId: travel.id };
                if (
                    travel.status === "inviting" &&
                    travel.responses[id] === "pending"
                )
                    later(`join:${id}:${travel.id}`, between(900, 3200), () =>
                        act(id, {
                            ...base,
                            action: "travel-respond",
                            accepted: true,
                        })
                    );
                if (
                    travel.responses[id] === "accepted" &&
                    ["inviting", "preparing"].includes(travel.status) &&
                    !travel.readyIds.includes(id)
                )
                    later(`ready:${id}:${travel.id}`, between(500, 1600), () =>
                        act(id, {
                            ...base,
                            action: "travel-ready",
                            success: true,
                        })
                    );
                if (
                    travel.status === "travelling" &&
                    travel.acceptedIds.includes(id) &&
                    travel.startAt
                )
                    later(
                        `enter:${id}:${travel.id}`,
                        Math.max(0, travel.startAt - Date.now()) + 60,
                        () => act(id, { ...base, action: "travel-entered" })
                    );
            }
        };
        const coordinator = new LobbyGroups({
            member(id) {
                if (id === selfId) {
                    const me = latest.current.self;
                    return {
                        id,
                        name: me.name || "Guest",
                        avatar: me.avatar || "",
                        vrmUrl: me.vrmUrl || "",
                        scale: me.scale || 1,
                    };
                }
                const person = people.get(id);
                return (
                    person && {
                        id,
                        name: person.name || "Guest",
                        avatar: person.avatar || "",
                        vrmUrl: person.vrmUrl || "",
                        scale: person.scale || 1,
                    }
                );
            },
            pose(id) {
                if (id === selfId) {
                    const pose = latest.current.social.getPredictedPose();
                    return {
                        x: pose.x,
                        y: pose.y,
                        z: pose.z,
                        rotation: pose.rotation,
                    };
                }
                const person = crowd
                    .sample(performance.now())
                    .find((p) => p.id === id);
                return (
                    person && {
                        x: person.x,
                        y: person.y || 0,
                        z: person.z,
                        rotation: person.rotation || 0,
                    }
                );
            },
            send(id, event, data) {
                if (id !== selfId) {
                    if (event === "lobby-groups")
                        react(id, data as LobbyGroupsSnapshot);
                    return;
                }
                if (event === "lobby-groups")
                    setSnapshot({
                        ...(data as LobbyGroupsSnapshot),
                        receivedAt: performance.now(),
                    });
                else if (event === "lobby-group-result") {
                    const result = data as LobbyGroupResult;
                    results.current.set(result.requestId, result);
                }
            },
            place(id, travelId, _pose, _peers, held) {
                // Everyone confirms their place in the gathering at once.
                if (held)
                    later(`placed:${id}:${travelId}:${++request}`, 150, () =>
                        coordinator.placed(id, travelId)
                    );
            },
            activeWorld() {},
        });
        server.current = coordinator;
        coordinator.connect(selfId);
        for (const id of people.keys()) coordinator.connect(id);
        const tick = setInterval(() => coordinator.tick(), 1000);
        return () => {
            closed = true;
            clearInterval(tick);
            for (const timer of timers) clearTimeout(timer);
            server.current = null;
            setSnapshot(null);
        };
    }, [active, crowd, selfId]);

    const groupAction = useCallback<SocialParties["groupAction"]>(
        (command) => {
            const coordinator = server.current;
            if (!coordinator)
                return Promise.reject(new Error("Reconnect to use parties."));
            const requestId = `self-${Date.now()}-${Math.random()
                .toString(36)
                .slice(2, 10)}`;
            coordinator.action(selfId, { ...command, requestId });
            const result = results.current.get(requestId);
            results.current.delete(requestId);
            if (!result)
                return Promise.reject(
                    new Error("This party action is unavailable.")
                );
            return result.error
                ? Promise.reject(new Error(result.error))
                : Promise.resolve(result);
        },
        [selfId]
    );

    // Back in the lobby, everyone who travelled is back too.
    useEffect(() => {
        const coordinator = server.current;
        if (!active || away || !coordinator || !snapshot) return;
        const ids = new Set([selfId]);
        for (const group of snapshot.groups)
            for (const member of group.members)
                if (member.location?.state !== "lobby") ids.add(member.id);
        if (ids.size === 1 && !snapshot.groups.length) return;
        let request = 0;
        for (const id of ids)
            coordinator.action(id, {
                requestId: `home-${Date.now()}-${++request}`,
                action: "active-world",
                active: false,
                location: { state: "lobby" },
            });
        // Only when you come back, not on every party update.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [active, away]);

    const groupPlayers = useMemo(
        () =>
            active && crowd
                ? crowd.participants.map((p) => ({
                      id: p.id,
                      name: p.name || "Guest",
                      avatar: p.avatar,
                  }))
                : undefined,
        [active, crowd]
    );

    return useMemo(() => {
        if (!active) return social;
        return {
            ...social,
            sessionId: selfId,
            groupsSupported: true,
            groups: snapshot?.groups || [],
            invitations: snapshot?.invitations || [],
            groupMessages:
                snapshot?.groups.flatMap((group) => group.messages) || [],
            groupClock: snapshot
                ? {
                      serverNow: snapshot.serverNow,
                      receivedAt: snapshot.receivedAt,
                  }
                : null,
            groupAction,
            groupPlayers,
        };
    }, [active, social, selfId, snapshot, groupAction, groupPlayers]);
}
