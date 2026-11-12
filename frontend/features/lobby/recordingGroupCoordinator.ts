/**
 * Recording only (?crowd=N). A browser copy of the lobby server's party
 * coordinator, multiplayer/src/world/groups.ts, so the staged crowd can be
 * invited to parties and travel as one without a party server. Keep it in
 * step with the server file; only the id generator and byte counting differ.
 */
import { readGroupLocation } from "../../../multiplayer/protocol/group-location";
import { isLobbyTravelLive } from "../../../multiplayer/protocol/lobby-groups";
import type { LobbyGroupLocation } from "../../../multiplayer/protocol/lobby-groups";
import type {
    LobbyGroup,
    LobbyGroupAction,
    LobbyGroupDestination,
    LobbyGroupInvitation,
    LobbyGroupMember,
    LobbyGroupPose,
    LobbyGroupResult,
    LobbyGroupTravel,
    LobbyGroupsSnapshot,
} from "../../../multiplayer/protocol/lobby-groups";

const MAX_MEMBERS = 8,
    MAX_GROUPS = 4,
    MAX_INVITATIONS = 8,
    MAX_MESSAGES = 24;
/** How long someone's parties, invitations and place on a live trip are kept after their connection drops. */
export const GROUP_RECONNECT_GRACE_MS = 10_000;
const code = () => {
    const bytes = new Uint8Array(18);
    if (globalThis.crypto?.getRandomValues)
        globalThis.crypto.getRandomValues(bytes);
    else bytes.forEach((_, i) => (bytes[i] = Math.random() * 256));
    return btoa(String.fromCharCode(...bytes))
        .replace(/\+/g, "-")
        .replace(/\//g, "_");
};
const byteLength = (text: string) => text.length;
const liveTravel = (travel?: LobbyGroupTravel) =>
    !!travel && isLobbyTravelLive(travel.status);
interface GroupRecord extends Omit<LobbyGroup, "members"> {
    members: Set<string>;
    placementAcks: Set<string>;
    entered: Set<string>;
    sealed: boolean;
}
interface InvitationRecord extends LobbyGroupInvitation {
    inviteeId: string;
}
/**
 * Someone whose connection dropped. Until `until` they stay a member of every party they were in, listed as last seen,
 * and invitations to and from them are kept. `trip` is the party whose live trip they had accepted: that place is kept too.
 */
interface Absence {
    member: LobbyGroupMember;
    identity?: string;
    until: number;
    trip?: GroupRecord;
}
export interface GroupCoordinatorOptions {
    member(id: string): LobbyGroupMember | undefined;
    pose(id: string): LobbyGroupPose | undefined;
    send(id: string, event: string, data: unknown): void;
    place(
        id: string,
        travelId: string,
        pose: LobbyGroupPose,
        peers: string[],
        held: boolean
    ): void;
    activeWorld(id: string, active: boolean): void;
    /** A private key shared by every connection of one traveller. A reconnect gets a new id; this is what gives them their place back. */
    identity?(id: string): string | undefined;
    now?(): number;
}
/** One coordinator owns membership and consent across all socket workers. */
/** A party action refused with a sentence written for the visitor. */
class GroupActionError extends Error {}

export class LobbyGroups {
    private groups = new Map<string, GroupRecord>();
    private invitations = new Map<string, InvitationRecord>();
    private connected = new Set<string>();
    private activeWorld = new Set<string>();
    private locations = new Map<string, LobbyGroupLocation>();
    private claims = new Map<string, string>();
    private absent = new Map<string, Absence>();
    private results = new Map<string, Map<string, LobbyGroupResult>>();
    private now: () => number;
    constructor(private options: GroupCoordinatorOptions) {
        this.now = options.now || Date.now;
    }
    connect(id: string) {
        this.connected.add(id);
        const identity = this.options.identity?.(id);
        // The very same id reported again, else the first absence of the same traveller that this connection shares no party with.
        const returning = this.absent.has(id)
            ? id
            : identity &&
              [...this.absent].find(
                  ([from, absence]) =>
                      absence.identity === identity &&
                      !this.memberships(from).some((group) =>
                          group.members.has(id)
                      )
              )?.[0];
        if (returning) this.resume(returning, id);
        else this.publish(id);
    }
    profileChanged(id: string) {
        for (const group of this.groups.values())
            if (group.members.has(id)) this.publishMembers(group);
    }
    private member(id: string) {
        const member = this.connected.has(id)
            ? this.options.member(id)
            : undefined;
        return member
            ? {
                  ...member,
                  location: readGroupLocation(
                      this.locations.get(id) || { state: "lobby" }
                  )!,
              }
            : undefined;
    }
    /** Every party `id` belongs to, someone absent included: their memberships count against both limits until the grace ends. */
    private memberships(id: string) {
        return [...this.groups.values()].filter((group) =>
            group.members.has(id)
        );
    }
    private count(id: string) {
        return this.memberships(id).length;
    }
    private publishMembers(group: GroupRecord) {
        for (const id of group.members) this.publish(id);
    }
    private wireGroup(group: GroupRecord): LobbyGroup {
        const waitingFor = [...this.absent]
            .filter(([, absence]) => absence.trip === group)
            .map(([id, absence]) => ({
                id,
                name: absence.member.name,
                until: absence.until,
            }));
        return {
            id: group.id,
            name: group.name,
            ownerId: group.ownerId,
            // Someone absent stays listed as last seen, so the owner and a trip never name someone outside the group.
            members: [...group.members]
                .map(
                    (id) =>
                        this.member(id) ||
                        (this.absent.has(id)
                            ? { ...this.absent.get(id)!.member }
                            : undefined)
                )
                .filter(Boolean) as LobbyGroupMember[],
            joinCode: group.joinCode,
            messages: group.messages.map((message) => ({ ...message })),
            ...(group.travel
                ? {
                      travel: {
                          ...JSON.parse(JSON.stringify(group.travel)),
                          ...(waitingFor.length ? { waitingFor } : {}),
                      },
                  }
                : {}),
        };
    }
    snapshot(id: string): LobbyGroupsSnapshot {
        const snapshot: LobbyGroupsSnapshot = {
            supported: true,
            serverNow: this.now(),
            groups: [...this.groups.values()]
                .filter((group) => group.members.has(id))
                .map((group) => this.wireGroup(group)),
            invitations: [...this.invitations.values()]
                .filter((invite) => invite.inviteeId === id)
                .map(({ inviteeId, ...invite }) => ({
                    ...invite,
                    inviter: { ...invite.inviter },
                })),
        };
        // A control frame must fit WebTransport's 16 KiB reliable-frame limit.
        let bytes = byteLength(JSON.stringify(snapshot));
        if (bytes > 14000) {
            for (const group of snapshot.groups) {
                group.members = group.members.map((member) => ({
                    ...member,
                    avatar: "",
                    vrmUrl: "",
                }));
                for (const message of group.messages) message.avatar = "";
            }
            for (const invite of snapshot.invitations)
                invite.inviter = { ...invite.inviter, avatar: "", vrmUrl: "" };
            bytes = byteLength(JSON.stringify(snapshot));
        }
        while (bytes > 14000) {
            const oldest = snapshot.groups
                .filter((group) => group.messages.length)
                .sort((a, b) => a.messages[0].sentAt - b.messages[0].sentAt)[0];
            if (!oldest) break;
            const removed = oldest.messages.shift()!;
            bytes -=
                byteLength(JSON.stringify(removed)) +
                Number(oldest.messages.length > 0);
        }
        if (bytes > 14000) {
            // Long names across four groups can exhaust a reliable control frame.
            // Keep truthful state, dropping optional destination labels before transport.
            for (const group of snapshot.groups)
                for (const member of group.members)
                    if (member.location)
                        member.location = { state: member.location.state };
        }
        return snapshot;
    }
    private publish(id: string) {
        if (this.member(id))
            this.options.send(id, "lobby-groups", this.snapshot(id));
    }
    private result(id: string, result: LobbyGroupResult) {
        let history = this.results.get(id);
        if (!history) this.results.set(id, (history = new Map()));
        history.set(result.requestId, result);
        while (history.size > 32) history.delete(history.keys().next().value!);
        this.options.send(id, "lobby-group-result", result);
    }
    action(actor: string, command: LobbyGroupAction) {
        if (
            !this.member(actor) ||
            !command ||
            typeof command.requestId !== "string" ||
            !/^[A-Za-z0-9_-]{1,80}$/.test(command.requestId)
        )
            return;
        const prior = this.results.get(actor)?.get(command.requestId);
        if (prior) {
            this.options.send(actor, "lobby-group-result", prior);
            return;
        }
        const result: LobbyGroupResult = { requestId: command.requestId };
        try {
            result.groupId = this.execute(actor, command);
        } catch (error) {
            // Only the sentences this class writes for visitors reach the client;
            // anything else (a bug, a TypeError) gets the generic one.
            result.error =
                error instanceof GroupActionError
                    ? error.message
                    : "This party action is unavailable.";
        }
        this.result(actor, result);
    }
    private require(condition: unknown, message: string): asserts condition {
        if (!condition) throw new GroupActionError(message);
    }
    private execute(
        actor: string,
        command: LobbyGroupAction
    ): string | undefined {
        const now = this.now();
        if (command.action === "active-world") {
            this.require(
                typeof command.active === "boolean",
                "Choose a valid presence state."
            );
            const location =
                command.location === undefined
                    ? {
                          state: command.active
                              ? ("space" as const)
                              : ("lobby" as const),
                      }
                    : readGroupLocation(command.location);
            this.require(location, "Choose a valid party location.");
            this.require(
                command.active
                    ? location.state !== "lobby"
                    : location.state !== "space",
                "Presence and location do not match."
            );
            if (command.active) this.activeWorld.add(actor);
            else this.activeWorld.delete(actor);
            this.locations.set(actor, location);
            this.options.activeWorld(actor, command.active);
            this.profileChanged(actor);
            return;
        }
        if (command.action === "create") {
            this.require(
                this.count(actor) < MAX_GROUPS,
                "You can belong to four lobby parties at a time."
            );
            const name =
                typeof command.name === "string"
                    ? command.name.trim().slice(0, 40)
                    : "";
            this.require(name, "Give your party a name.");
            const invitees = Array.isArray(command.memberIds)
                ? [...new Set(command.memberIds)].filter((id) => id !== actor)
                : [];
            this.require(
                invitees.length < MAX_MEMBERS &&
                    invitees.every(
                        (id) => typeof id === "string" && this.member(id)
                    ),
                "Choose up to seven people who are here."
            );
            this.require(
                invitees.every(
                    (target) =>
                        [...this.invitations.values()].filter(
                            (invite) => invite.inviteeId === target
                        ).length < MAX_INVITATIONS
                ),
                "Someone has too many pending invitations."
            );
            const group: GroupRecord = {
                id: code(),
                name,
                ownerId: actor,
                members: new Set([actor]),
                joinCode: code(),
                messages: [],
                placementAcks: new Set(),
                entered: new Set(),
                sealed: false,
            };
            this.groups.set(group.id, group);
            for (const id of invitees) this.invite(group, actor, id);
            this.publishMembers(group);
            return group.id;
        }
        if (command.action === "join") {
            const group =
                typeof command.code === "string" && command.code.length <= 80
                    ? [...this.groups.values()].find(
                          (group) => group.joinCode === command.code
                      )
                    : undefined;
            this.require(group, "This party link is no longer available.");
            this.join(group, actor);
            return group.id;
        }
        if (command.action === "respond-invite") {
            const invite = this.invitations.get(command.invitationId || "");
            this.require(
                invite?.inviteeId === actor &&
                    invite.expiresAt > now &&
                    typeof command.accepted === "boolean",
                "This invitation has expired."
            );
            const group = this.groups.get(invite.groupId);
            this.require(group, "This party is no longer available.");
            if (command.accepted) this.join(group, actor);
            this.invitations.delete(invite.id);
            this.publish(actor);
            return group.id;
        }
        const group = this.groups.get(command.groupId || "");
        this.require(
            group?.members.has(actor),
            "You are not a member of this party."
        );
        if (command.action === "invite") {
            this.require(
                group.ownerId === actor,
                "Only the party owner can add people."
            );
            this.require(
                typeof command.inviteeId === "string",
                "Choose someone to invite."
            );
            this.invite(group, actor, command.inviteeId);
        } else if (command.action === "leave") {
            this.removeMember(group, actor);
        } else if (command.action === "message") {
            const text =
                typeof command.text === "string"
                    ? command.text.trim().slice(0, 500)
                    : "";
            this.require(text, "Write a message first.");
            const member = this.member(actor)!;
            group.messages.push({
                id: code(),
                groupId: group.id,
                sessionId: actor,
                name: member.name,
                avatar: member.avatar,
                text,
                sentAt: now,
            });
            group.messages = group.messages.slice(-MAX_MESSAGES);
            this.publishMembers(group);
        } else if (command.action === "travel-propose") {
            this.require(
                !liveTravel(group.travel),
                "This party already has a trip in progress."
            );
            this.require(
                !this.claims.has(actor) && !this.activeWorld.has(actor),
                "Return to the lobby before starting a trip."
            );
            const destination = this.destination(command.destination),
                anchor = this.options.pose(actor);
            this.require(anchor, "Your lobby position is unavailable.");
            const responses: LobbyGroupTravel["responses"] = {};
            // Someone on another trip, or away while their connection is down, is not asked.
            for (const id of group.members)
                responses[id] =
                    id === actor
                        ? "accepted"
                        : this.claims.has(id) || this.absent.has(id)
                        ? "declined"
                        : "pending";
            group.travel = {
                id: code(),
                initiatorId: actor,
                destination,
                status: "inviting",
                responses,
                readyIds: [],
                acceptedIds: [actor],
                poses: {
                    [actor]: {
                        x: anchor.x,
                        y: 0,
                        z: anchor.z,
                        rotation: anchor.rotation,
                    },
                },
                expiresAt: now + 30000,
            };
            group.sealed = false;
            group.placementAcks.clear();
            group.entered.clear();
            this.claims.set(actor, group.travel.id);
            this.options.place(
                actor,
                group.travel.id,
                group.travel.poses[actor],
                [],
                true
            );
            this.advance(group);
            this.publishMembers(group);
        } else {
            const travel = group.travel;
            this.require(
                travel && command.travelId === travel.id && liveTravel(travel),
                "This trip is no longer available."
            );
            if (command.action === "travel-respond") {
                this.require(
                    !group.sealed &&
                        travel.status === "inviting" &&
                        travel.responses[actor] === "pending" &&
                        typeof command.accepted === "boolean",
                    "This invitation has already been answered."
                );
                if (command.accepted) {
                    this.require(
                        !this.claims.has(actor) && !this.activeWorld.has(actor),
                        "Finish your current trip before joining another."
                    );
                    this.claims.set(actor, travel.id);
                }
                travel.responses[actor] = command.accepted
                    ? "accepted"
                    : "declined";
                travel.acceptedIds = Object.keys(travel.responses).filter(
                    (id) => travel.responses[id] === "accepted"
                );
                this.advance(group);
            } else if (command.action === "travel-ready") {
                // A traveller back on a new connection prepares again and says so, whatever step the trip has reached.
                this.require(
                    travel.responses[actor] === "accepted" &&
                        typeof command.success === "boolean" &&
                        (command.success ||
                            ["inviting", "preparing"].includes(travel.status)),
                    "You have not joined this trip."
                );
                if (!command.success)
                    this.cancel(
                        group,
                        "Someone could not prepare the world. Everyone is still in the lobby."
                    );
                else {
                    if (!travel.readyIds.includes(actor))
                        travel.readyIds.push(actor);
                    this.advance(group);
                }
            } else if (command.action === "travel-launch") {
                this.require(
                    actor === travel.initiatorId &&
                        ["inviting", "preparing"].includes(travel.status),
                    "Only the initiator can start this trip."
                );
                this.seal(group);
                this.advance(group);
            } else if (command.action === "travel-cancel") {
                this.require(
                    actor === travel.initiatorId ||
                        travel.responses[actor] === "accepted",
                    "You have not joined this trip."
                );
                this.cancel(
                    group,
                    actor === travel.initiatorId
                        ? "The initiator cancelled this trip."
                        : "A traveller cancelled. Everyone is still in the lobby."
                );
            } else if (command.action === "travel-entered") {
                this.require(
                    travel.status === "travelling" &&
                        travel.acceptedIds.includes(actor) &&
                        !!travel.startAt &&
                        now >= travel.startAt,
                    "This trip has not started."
                );
                group.entered.add(actor);
                this.locations.set(actor, {
                    state: "space",
                    destination: { ...travel.destination },
                });
                this.activeWorld.add(actor);
                this.options.activeWorld(actor, true);
                this.advance(group);
            } else throw new GroupActionError("Unknown party action.");
            this.publishMembers(group);
        }
        return group.id;
    }
    private destination(value: unknown): LobbyGroupDestination {
        const destination = value as LobbyGroupDestination;
        // Only the existing same-origin destination frame route grammar is valid.
        this.require(
            destination &&
                typeof destination.href === "string" &&
                /^\/(?:spaces\/|mints\/)?[a-z0-9@_-]{1,128}\/?$/i.test(
                    destination.href
                ),
            "This world does not support party travel."
        );
        this.require(
            typeof destination.id === "string" &&
                /^[a-z0-9@_-]{1,128}$/i.test(destination.id) &&
                typeof destination.title === "string" &&
                destination.title.trim(),
            "Choose a valid world."
        );
        return {
            id: destination.id,
            title: destination.title.trim().slice(0, 80),
            href: destination.href,
        };
    }
    private invite(group: GroupRecord, actor: string, target: string) {
        this.require(
            this.member(target) && !group.members.has(target),
            "Choose someone who is here and outside the party."
        );
        this.require(group.members.size < MAX_MEMBERS, "This party is full.");
        this.require(
            [...this.invitations.values()].filter(
                (invite) => invite.inviteeId === target
            ).length < MAX_INVITATIONS,
            "This person has too many pending invitations."
        );
        const existing = [...this.invitations.values()].find(
            (invite) =>
                invite.groupId === group.id && invite.inviteeId === target
        );
        if (!existing) {
            // An invitation is not membership: do not disclose the inviter's space.
            const { location: _location, ...inviter } = this.member(actor)!;
            const invitation: InvitationRecord = {
                id: code(),
                groupId: group.id,
                groupName: group.name,
                inviter,
                inviteeId: target,
                expiresAt: this.now() + 120000,
            };
            this.invitations.set(invitation.id, invitation);
        }
        this.publish(target);
    }
    private join(group: GroupRecord, actor: string) {
        if (!group.members.has(actor)) {
            this.require(
                group.members.size < MAX_MEMBERS,
                "This party is full."
            );
            this.require(
                this.count(actor) < MAX_GROUPS,
                "You can belong to four lobby parties at a time."
            );
            group.members.add(actor);
        }
        for (const invite of this.invitations.values())
            if (invite.groupId === group.id && invite.inviteeId === actor)
                this.invitations.delete(invite.id);
        this.publishMembers(group);
    }
    private seal(group: GroupRecord) {
        const travel = group.travel!;
        group.sealed = true;
        for (const id of Object.keys(travel.responses))
            if (travel.responses[id] === "pending")
                travel.responses[id] = "declined";
        travel.acceptedIds = Object.keys(travel.responses).filter(
            (id) => travel.responses[id] === "accepted" && group.members.has(id)
        );
        travel.status = "preparing";
        travel.expiresAt = this.now() + 90000;
    }
    /** Moves the trip on one step when every accepted traveller has confirmed the step it is on. */
    private advance(group: GroupRecord) {
        const travel = group.travel!,
            everyone = (confirmed: (id: string) => boolean) =>
                travel.acceptedIds.every(confirmed);
        if (
            travel.status === "inviting" &&
            !Object.values(travel.responses).includes("pending")
        )
            this.seal(group);
        if (!group.sealed) return;
        if (
            travel.status === "preparing" &&
            everyone((id) => travel.readyIds.includes(id))
        ) {
            travel.status = "gathering";
            travel.expiresAt = this.now() + 10000;
            group.placementAcks.clear();
            const anchor = travel.poses[travel.initiatorId],
                others = travel.acceptedIds.filter(
                    (id) => id !== travel.initiatorId
                );
            const radius = others.length > 5 ? 2.3 : 1.8;
            for (const [index, id] of others.entries()) {
                const angle =
                    anchor.rotation +
                    (2 * Math.PI * index) / Math.max(others.length, 1);
                travel.poses[id] = {
                    x: anchor.x + Math.sin(angle) * radius,
                    y: 0,
                    z: anchor.z + Math.cos(angle) * radius,
                    rotation: anchor.rotation,
                };
            }
            for (const id of travel.acceptedIds)
                this.options.place(
                    id,
                    travel.id,
                    travel.poses[id],
                    travel.acceptedIds.filter((peer) => peer !== id),
                    true
                );
        } else if (
            travel.status === "gathering" &&
            everyone((id) => group.placementAcks.has(id))
        ) {
            travel.status = "travelling";
            travel.startAt = this.now() + 700;
            travel.expiresAt = this.now() + 120000;
        } else if (
            travel.status === "travelling" &&
            everyone((id) => group.entered.has(id))
        ) {
            travel.status = "complete";
            this.release(group);
        }
    }
    placed(actor: string, travelId: string) {
        const group = [...this.groups.values()].find(
            (group) => group.travel?.id === travelId
        );
        const travel = group?.travel;
        if (
            !group ||
            !travel ||
            travel.status !== "gathering" ||
            !travel.acceptedIds.includes(actor)
        )
            return;
        group.placementAcks.add(actor);
        this.advance(group);
        if (group.travel!.status !== "gathering") this.publishMembers(group);
    }
    private release(group: GroupRecord) {
        const travel = group.travel!;
        for (const id of Object.keys(travel.responses))
            if (this.claims.get(id) === travel.id) {
                this.claims.delete(id);
                const pose = travel.poses[id] || this.options.pose(id);
                if (pose && this.member(id))
                    this.options.place(id, travel.id, pose, [], false);
            }
        // Nobody is waited for once the trip is over. Their place in the party still runs out its own grace.
        for (const absence of this.absent.values())
            if (absence.trip === group) absence.trip = undefined;
    }
    /** An accepted traveller's connection dropped: keep their place on the trip, but nothing that connection had confirmed. */
    private hold(group: GroupRecord, id: string, absence: Absence) {
        const travel = group.travel!,
            now = this.now();
        absence.trip = group;
        travel.readyIds = travel.readyIds.filter((ready) => ready !== id);
        group.placementAcks.delete(id);
        group.entered.delete(id);
        // The wait is not charged to a deadline that would cancel the trip.
        if (travel.status !== "inviting")
            travel.expiresAt =
                Math.max(travel.expiresAt, now) + GROUP_RECONNECT_GRACE_MS;
        this.publishMembers(group);
    }
    /** They are back in time: their parties, their invitations and any place on a trip move to the connection they returned on. */
    private resume(from: string, to: string) {
        const absence = this.absent.get(from)!,
            renamed = (id: string) => (id === from ? to : id);
        this.absent.delete(from);
        let trip = absence.trip;
        // The trip's party first, so the place on a live trip is the last thing a full connection would give up.
        const theirs = this.memberships(from).sort(
                (a, b) => Number(b === trip) - Number(a === trip)
            ),
            notify = new Set([to]);
        if (from !== to) {
            for (const group of theirs) {
                if (this.count(to) >= MAX_GROUPS) {
                    // A new connection belongs to nothing yet, so this is never reached by a reconnect. The limit holds regardless.
                    if (group === trip) trip = undefined;
                    this.removeMember(group, from);
                    continue;
                }
                group.members = new Set([...group.members].map(renamed));
                group.ownerId = renamed(group.ownerId);
                for (const message of group.messages)
                    message.sessionId = renamed(message.sessionId);
                const travel = group.travel;
                if (!travel) continue;
                // Every mention moves, on the record of a finished trip too, so no snapshot names the id they left behind.
                travel.initiatorId = renamed(travel.initiatorId);
                travel.acceptedIds = travel.acceptedIds.map(renamed);
                travel.readyIds = travel.readyIds.map(renamed);
                if (from in travel.responses) {
                    travel.responses[to] = travel.responses[from];
                    delete travel.responses[from];
                }
                if (travel.poses[from]) {
                    travel.poses[to] = travel.poses[from];
                    delete travel.poses[from];
                }
            }
            for (const invite of [...this.invitations.values()]) {
                if (invite.inviteeId === from) {
                    const held = [...this.invitations.values()].filter(
                        (other) => other.inviteeId === to
                    );
                    // Re-addressed to them, unless that would repeat one they hold, exceed the limit, or invite a member.
                    if (
                        held.length >= MAX_INVITATIONS ||
                        held.some(
                            (other) => other.groupId === invite.groupId
                        ) ||
                        this.groups.get(invite.groupId)?.members.has(to)
                    )
                        this.invitations.delete(invite.id);
                    else invite.inviteeId = to;
                } else if (invite.inviter.id === from) {
                    invite.inviter = { ...invite.inviter, id: to };
                    notify.add(invite.inviteeId);
                }
            }
            if (trip) {
                this.claims.delete(from);
                this.claims.set(to, trip.travel!.id);
            }
        }
        const travel = trip?.travel;
        if (travel) {
            // Whoever was held at a pose is held there again; the new connection has to confirm it afresh.
            const pose = travel.poses[to],
                together =
                    travel.status === "gathering" ||
                    travel.status === "travelling";
            if (pose)
                this.options.place(
                    to,
                    travel.id,
                    pose,
                    together
                        ? travel.acceptedIds.filter((peer) => peer !== to)
                        : [],
                    true
                );
        }
        for (const group of theirs)
            for (const id of group.members) notify.add(id);
        for (const id of notify) this.publish(id);
    }
    /**
     * The grace ran out. A trip they were on goes on without them, or ends as any leaving ends it when nobody else is going.
     * Then they leave every party, and the invitations to and from them go, as both did at once before there was a grace.
     */
    private abandon(id: string) {
        const { trip } = this.absent.get(id)!,
            travel = trip?.travel;
        this.absent.delete(id);
        if (
            trip &&
            travel &&
            travel.acceptedIds.some((other) => other !== id)
        ) {
            const anchor = travel.poses[id];
            this.claims.delete(id);
            travel.responses[id] = "declined";
            delete travel.poses[id];
            travel.acceptedIds = travel.acceptedIds.filter(
                (other) => other !== id
            );
            if (travel.initiatorId === id) {
                const next = (travel.initiatorId =
                    travel.acceptedIds.find(
                        (other) => !this.absent.has(other)
                    ) || travel.acceptedIds[0]);
                if (!travel.poses[next]) {
                    // Not gathered yet: the trip now forms around its new initiator, held where they stand as at the proposal.
                    const here = this.options.pose(next);
                    travel.poses[next] = here
                        ? {
                              x: here.x,
                              y: 0,
                              z: here.z,
                              rotation: here.rotation,
                          }
                        : anchor;
                    this.options.place(
                        next,
                        travel.id,
                        travel.poses[next],
                        [],
                        true
                    );
                }
            }
            this.advance(trip);
        }
        for (const group of this.memberships(id)) this.removeMember(group, id);
        this.claims.delete(id);
        this.forgetInvitations(id);
    }
    private forgetInvitations(id: string) {
        for (const invite of [...this.invitations.values()])
            if (invite.inviteeId === id || invite.inviter.id === id) {
                this.invitations.delete(invite.id);
                this.publish(invite.inviteeId);
            }
    }
    private cancel(group: GroupRecord, reason: string) {
        if (!liveTravel(group.travel)) return;
        group.travel!.status = "cancelled";
        group.travel!.reason = reason;
        this.release(group);
    }
    private removeMember(group: GroupRecord, actor: string) {
        const travel = group.travel;
        if (liveTravel(travel) && travel!.responses[actor] === "accepted")
            this.cancel(
                group,
                "A traveller left the party. Everyone is still in the lobby."
            );
        else if (liveTravel(travel) && travel!.responses[actor] === "pending") {
            travel!.responses[actor] = "declined";
            this.advance(group);
        }
        group.members.delete(actor);
        if (!group.members.size) {
            this.groups.delete(group.id);
            for (const invite of this.invitations.values())
                if (invite.groupId === group.id) {
                    this.invitations.delete(invite.id);
                    this.publish(invite.inviteeId);
                }
        } else {
            // Ownership passes to someone who is here before someone whose own connection is down.
            if (group.ownerId === actor)
                group.ownerId =
                    [...group.members].find((id) => this.connected.has(id)) ??
                    group.members.values().next().value!;
            this.publishMembers(group);
        }
        this.publish(actor);
    }
    /**
     * A connection dropped. Nobody can tell a blip from leaving, so for `GROUP_RECONNECT_GRACE_MS` they keep their
     * parties (listed as last seen), the invitations to and from them, and their place on a live trip they had accepted.
     * `connect` gives all of it to the connection they return on; `tick` lets go of it when they do not.
     */
    disconnect(id: string) {
        if (this.absent.has(id)) return;
        const member = this.member(id),
            identity = this.options.identity?.(id),
            parties = this.memberships(id);
        this.connected.delete(id);
        this.activeWorld.delete(id);
        this.locations.delete(id);
        this.results.delete(id);
        const invited = [...this.invitations.values()].some(
            (invite) => invite.inviteeId === id || invite.inviter.id === id
        );
        if (!member || (!parties.length && !invited)) {
            // Nothing to come back to, or no profile to list them by: they are gone at once.
            for (const group of parties) this.removeMember(group, id);
            this.claims.delete(id);
            this.forgetInvitations(id);
            return;
        }
        const absence: Absence = {
            member,
            identity,
            until: this.now() + GROUP_RECONNECT_GRACE_MS,
        };
        this.absent.set(id, absence);
        for (const group of parties) {
            const response = liveTravel(group.travel)
                ? group.travel!.responses[id]
                : undefined;
            // Only a trip they were going on is worth waiting for; an unanswered invitation counts as declined.
            if (response === "accepted") this.hold(group, id, absence);
            else if (response === "pending") {
                group.travel!.responses[id] = "declined";
                this.advance(group);
                this.publishMembers(group);
            }
        }
        if (!absence.trip) this.claims.delete(id);
    }
    tick() {
        const now = this.now();
        for (const invite of [...this.invitations.values()])
            if (invite.expiresAt <= now) {
                this.invitations.delete(invite.id);
                this.publish(invite.inviteeId);
            }
        // Graces are settled before deadlines, so a trip the wait was holding up moves on instead of timing out.
        for (const [id, absence] of [...this.absent])
            if (absence.until <= now && this.absent.has(id)) this.abandon(id);
        for (const group of [...this.groups.values()])
            if (liveTravel(group.travel) && group.travel!.expiresAt <= now) {
                if (group.travel!.status === "inviting") {
                    this.seal(group);
                    this.advance(group);
                } else
                    this.cancel(
                        group,
                        "The party trip timed out. You can try again from the lobby."
                    );
                this.publishMembers(group);
            }
    }
}
