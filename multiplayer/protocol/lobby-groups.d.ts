export interface LobbyGroupMember {
    id: string;
    name: string;
    avatar: string;
    vrmUrl: string;
    scale: number;
    location?: LobbyGroupLocation;
}
export interface LobbyGroupMessage {
    id: string;
    groupId: string;
    sessionId: string;
    name: string;
    avatar: string;
    text: string;
    sentAt: number;
}
export interface LobbyGroupDestination {
    id: string;
    title: string;
    href: string;
}
export interface LobbyGroupLocation {
    state: "lobby" | "travelling" | "space";
    destination?: LobbyGroupDestination;
}
export interface LobbyGroupPose {
    x: number;
    y: number;
    z: number;
    rotation: number;
}
/** Every status a group trip reports, in the order a trip moves through them. */
export const LOBBY_TRAVEL_STATUSES: readonly ["inviting", "preparing", "gathering", "travelling", "complete", "cancelled"];
/** A finished trip stays on its group as a record; only a live trip can still change. */
export const LOBBY_TRAVEL_TERMINAL_STATUSES: readonly ["complete", "cancelled"];
export type LobbyGroupTravelStatus = (typeof LOBBY_TRAVEL_STATUSES)[number];
export function isLobbyTravelStatus(value: unknown): value is LobbyGroupTravelStatus;
export function isLobbyTravelTerminal(status: unknown): boolean;
/** True while a trip can still be answered, prepared, launched or cancelled. */
export function isLobbyTravelLive(status: unknown): boolean;
/** An accepted traveller whose connection dropped; their place on the trip is kept until `until`. */
export interface LobbyGroupTravelWait {
    id: string;
    name: string;
    /** Server clock, the same one as `serverNow` and `expiresAt`. */
    until: number;
}
export interface LobbyGroupTravel {
    id: string;
    initiatorId: string;
    destination: LobbyGroupDestination;
    status: LobbyGroupTravelStatus;
    responses: Record<string, "pending" | "accepted" | "declined">;
    readyIds: string[];
    acceptedIds: string[];
    poses: Record<string, LobbyGroupPose>;
    startAt?: number;
    expiresAt: number;
    reason?: string;
    /** Present only on a live trip, while it waits for these travellers to reconnect. */
    waitingFor?: LobbyGroupTravelWait[];
}
export interface LobbyGroup {
    id: string;
    name: string;
    ownerId: string;
    members: LobbyGroupMember[];
    joinCode: string;
    messages: LobbyGroupMessage[];
    travel?: LobbyGroupTravel;
}
export interface LobbyGroupInvitation {
    id: string;
    groupId: string;
    groupName: string;
    inviter: LobbyGroupMember;
    expiresAt: number;
}
export interface LobbyGroupsSnapshot {
    supported: boolean;
    groups: LobbyGroup[];
    invitations: LobbyGroupInvitation[];
    serverNow: number;
}
export type LobbyGroupActionName = "create" | "invite" | "respond-invite" | "leave" | "message" | "join" | "travel-propose" | "travel-respond" | "travel-ready" | "travel-launch" | "travel-cancel" | "travel-entered" | "active-world";
export interface LobbyGroupAction {
    requestId: string;
    action: LobbyGroupActionName;
    groupId?: string;
    name?: string;
    memberIds?: string[];
    inviteeId?: string;
    invitationId?: string;
    accepted?: boolean;
    text?: string;
    code?: string;
    travelId?: string;
    destination?: LobbyGroupDestination;
    success?: boolean;
    active?: boolean;
    location?: LobbyGroupLocation;
}
export interface LobbyGroupResult {
    requestId: string;
    error?: string;
    groupId?: string;
}
export interface LobbyGroupPosition {
    travelId: string;
    pose: LobbyGroupPose;
    held: boolean;
    serverNow: number;
}
