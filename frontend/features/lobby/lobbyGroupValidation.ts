import { readGroupLocation } from "../../../multiplayer/protocol/group-location";
import {
    isLobbyTravelStatus,
    isLobbyTravelTerminal,
} from "../../../multiplayer/protocol/lobby-groups";
import type {
    LobbyGroup,
    LobbyGroupMember,
    LobbyGroupMessage,
    LobbyGroupPosition,
    LobbyGroupsSnapshot,
    LobbyGroupTravel,
} from "../../../multiplayer/protocol/lobby-groups";

const text = (value: unknown, max = 128): value is string =>
    typeof value === "string" && value.length > 0 && value.length <= max;
const finite = (value: unknown): value is number =>
    typeof value === "number" && Number.isFinite(value);
const list = (value: unknown, max: number): value is any[] =>
    Array.isArray(value) && value.length <= max;
const record = (value: unknown): value is Record<string, any> =>
    !!value && typeof value === "object" && !Array.isArray(value);
const ids = (value: unknown, members: Set<string>) =>
    list(value, 8) &&
    new Set(value).size === value.length &&
    value.every((id) => text(id) && members.has(id));
const pose = (value: any) =>
    record(value) &&
    [value.x, value.y, value.z, value.rotation].every(
        (part) => finite(part) && Math.abs(part) <= 1e6
    );
const media = (value: unknown): value is string =>
    typeof value === "string" &&
    value.length <= 2048 &&
    (!value ||
        (/^\/(?!\/)/.test(value) && !value.includes("\\")) ||
        /^https?:\/\//.test(value));
function member(value: any): value is LobbyGroupMember {
    return (
        record(value) &&
        text(value.id) &&
        text(value.name, 80) &&
        media(value.avatar) &&
        media(value.vrmUrl) &&
        finite(value.scale) &&
        value.scale >= 0.25 &&
        value.scale <= 3 &&
        (value.location === undefined || !!readGroupLocation(value.location))
    );
}
function message(value: any, groupId: string): value is LobbyGroupMessage {
    return (
        record(value) &&
        text(value.id, 256) &&
        value.groupId === groupId &&
        text(value.sessionId) &&
        text(value.name, 80) &&
        media(value.avatar) &&
        text(value.text, 500) &&
        finite(value.sentAt)
    );
}
function travel(value: any, members: Set<string>): value is LobbyGroupTravel {
    if (!record(value) || !record(value.responses)) return false;
    const terminal = isLobbyTravelTerminal(value.status);
    const participants = new Set(Object.keys(value.responses));
    return (
        record(value) &&
        text(value.id) &&
        participants.has(value.initiatorId) &&
        (terminal || members.has(value.initiatorId)) &&
        record(value.destination) &&
        text(value.destination.id, 512) &&
        text(value.destination.title, 200) &&
        text(value.destination.href, 2048) &&
        isLobbyTravelStatus(value.status) &&
        record(value.responses) &&
        Object.keys(value.responses).length <= 8 &&
        Object.entries(value.responses).every(
            ([id, response]) =>
                text(id) &&
                (terminal || members.has(id) || response === "declined") &&
                ["pending", "accepted", "declined"].includes(response)
        ) &&
        ids(value.readyIds, participants) &&
        ids(value.acceptedIds, participants) &&
        record(value.poses) &&
        Object.keys(value.poses).length <= 8 &&
        Object.entries(value.poses).every(
            ([id, position]) => participants.has(id) && pose(position)
        ) &&
        (value.startAt === undefined || finite(value.startAt)) &&
        finite(value.expiresAt) &&
        (value.reason === undefined || text(value.reason, 200)) &&
        // Travellers whose connection dropped and whose place is being kept.
        (value.waitingFor === undefined ||
            (list(value.waitingFor, 8) &&
                value.waitingFor.every(
                    (entry) =>
                        record(entry) &&
                        participants.has(entry.id) &&
                        text(entry.name, 80) &&
                        finite(entry.until)
                )))
    );
}
function group(value: any, selfId: string): value is LobbyGroup {
    if (
        !record(value) ||
        !text(value.id) ||
        !text(value.name, 80) ||
        !text(value.joinCode, 128) ||
        !list(value.members, 8) ||
        !value.members.length ||
        !value.members.every(member) ||
        !list(value.messages, 100) ||
        !value.messages.every((entry) => message(entry, value.id))
    )
        return false;
    const members = new Set<string>(value.members.map((entry) => entry.id));
    return (
        members.size === value.members.length &&
        members.has(selfId) &&
        members.has(value.ownerId) &&
        (!value.travel || travel(value.travel, members))
    );
}
/** Copy bounded authoritative data; never retain mutable transport objects. */
export function readLobbyGroups(
    value: unknown,
    selfId: string
): LobbyGroupsSnapshot | null {
    if (
        !record(value) ||
        typeof value.supported !== "boolean" ||
        !finite(value.serverNow) ||
        !list(value.groups, 16) ||
        !value.groups.every((entry) => group(entry, selfId)) ||
        new Set(value.groups.map((entry) => entry.id)).size !==
            value.groups.length ||
        !list(value.invitations, 32) ||
        !value.invitations.every(
            (entry) =>
                record(entry) &&
                text(entry.id) &&
                text(entry.groupId) &&
                text(entry.groupName, 80) &&
                member(entry.inviter) &&
                finite(entry.expiresAt)
        )
    )
        return null;
    const copy = JSON.parse(JSON.stringify(value));
    for (const group of copy.groups)
        for (const person of group.members)
            if (person.location !== undefined)
                person.location = readGroupLocation(person.location);
    // Invitation recipients have not joined and cannot inspect member location.
    for (const invitation of copy.invitations)
        delete invitation.inviter.location;
    return copy;
}
export function readLobbyGroupPosition(
    value: unknown
): LobbyGroupPosition | null {
    if (
        !record(value) ||
        !text(value.travelId) ||
        typeof value.held !== "boolean" ||
        !pose(value.pose) ||
        !finite(value.serverNow)
    )
        return null;
    return {
        travelId: value.travelId,
        held: value.held,
        serverNow: value.serverNow,
        pose: {
            x: value.pose.x,
            y: value.pose.y,
            z: value.pose.z,
            rotation: value.pose.rotation,
        },
    };
}
