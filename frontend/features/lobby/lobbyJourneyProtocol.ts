export const LOBBY_DESTINATION_PROTOCOL = "oncyber:lobby-destination:v1";
export const LOBBY_ATTEMPT_PARAM = "__lobbyAttempt";
export type LobbyDestinationPhase =
    | "idle"
    | "loading"
    | "ready"
    | "entering"
    | "revealing"
    | "entered"
    | "returning"
    | "error";
export interface LobbyDestination {
    id: string;
    title: string;
    href: string;
}
export interface LobbyJourneyError {
    code: string;
    message: string;
    canOpenNormally: boolean;
}
/** Camera offsets are relative to the local player's feet, never world coordinates. */
export interface LobbyTravelView {
    cameraOffset: { x: number; y: number; z: number };
    cameraTargetOffset: { x: number; y: number; z: number };
    avatarRotation: number;
    avatarLift: number;
    avatarHeight?: number;
    /** Active idle clip seconds sampled on the final departing avatar frame. */
    avatarIdleTime?: number;
    /** Native exits already hold idle; keep it through the next room reveal. */
    avatarTravelPose?: "idle";
    cameraMode?: "first-person" | "third-person";
    fov: number;
    /** Local slot relative to the shared destination spawn, not an admission credential. */
    spawnOffset?: { x: number; y: number; z: number };
    /** Temporary visual continuity only; these do not create multiplayer players. */
    peers?: LobbyTravelPeer[];
}
export interface LobbyTravelPeer {
    id: string;
    name: string;
    avatar?: string;
    vrmUrl?: string;
    scale?: number;
    offset: { x: number; y: number; z: number };
    rotation: number;
}
export type LobbyRevealMode = "native" | "immediate";
export interface LobbyDestinationEntryOptions {
    reducedMotion: boolean;
    travelView?: LobbyTravelView;
    portalView?: import("./lobbyPortalPreview").LobbyPortalView;
}
/** Bound and copy message data so mutable renderer vectors cannot change a sent pose. */
export function readLobbyTravelView(value: unknown): LobbyTravelView | null {
    const view = value as LobbyTravelView;
    const vector = (item: { x: number; y: number; z: number }) =>
        item &&
        [item.x, item.y, item.z].every(
            (number) =>
                typeof number === "number" &&
                Number.isFinite(number) &&
                Math.abs(number) <= 1000
        );
    const slot = (item: { x: number; y: number; z: number }) =>
        vector(item) && Math.hypot(item.x, item.y, item.z) <= 32;
    const asset = (value: unknown) => {
        if (value === undefined || value === "") return true;
        if (typeof value !== "string" || value.length > 2048) return false;
        if (value.startsWith("/") && !value.startsWith("//")) return true;
        try {
            const url = new URL(value);
            return (
                /^https?:$/.test(url.protocol) && !url.username && !url.password
            );
        } catch {
            return false;
        }
    };
    const peers = view?.peers;
    if (
        !view ||
        !vector(view.cameraOffset) ||
        !vector(view.cameraTargetOffset) ||
        !Number.isFinite(view.avatarRotation) ||
        Math.abs(view.avatarRotation) > 1e6 ||
        !Number.isFinite(view.avatarLift) ||
        Math.abs(view.avatarLift) > 100 ||
        (view.avatarHeight !== undefined &&
            (!Number.isFinite(view.avatarHeight) ||
                view.avatarHeight < 0.2 ||
                view.avatarHeight > 10)) ||
        (view.avatarIdleTime !== undefined &&
            (!Number.isFinite(view.avatarIdleTime) ||
                view.avatarIdleTime < 0 ||
                view.avatarIdleTime > 60)) ||
        (view.avatarTravelPose !== undefined &&
            view.avatarTravelPose !== "idle") ||
        (view.cameraMode !== undefined &&
            view.cameraMode !== "first-person" &&
            view.cameraMode !== "third-person") ||
        !Number.isFinite(view.fov) ||
        view.fov <= 0 ||
        view.fov >= 180 ||
        (view.spawnOffset !== undefined && !slot(view.spawnOffset)) ||
        (peers !== undefined &&
            (!Array.isArray(peers) ||
                peers.length > 7 ||
                new Set(peers.map((peer) => peer?.id)).size !== peers.length ||
                peers.some(
                    (peer) =>
                        !peer ||
                        typeof peer.id !== "string" ||
                        !peer.id ||
                        peer.id.length > 128 ||
                        typeof peer.name !== "string" ||
                        peer.name.length > 120 ||
                        !slot(peer.offset) ||
                        !Number.isFinite(peer.rotation) ||
                        Math.abs(peer.rotation) > 1e6 ||
                        (peer.scale !== undefined &&
                            (!Number.isFinite(peer.scale) ||
                                peer.scale < 0.5 ||
                                peer.scale > 2)) ||
                        !asset(peer.avatar) ||
                        !asset(peer.vrmUrl)
                )))
    )
        return null;
    return {
        cameraOffset: {
            x: view.cameraOffset.x,
            y: view.cameraOffset.y,
            z: view.cameraOffset.z,
        },
        cameraTargetOffset: {
            x: view.cameraTargetOffset.x,
            y: view.cameraTargetOffset.y,
            z: view.cameraTargetOffset.z,
        },
        avatarRotation: view.avatarRotation,
        avatarLift: view.avatarLift,
        ...(view.avatarHeight === undefined
            ? {}
            : { avatarHeight: view.avatarHeight }),
        ...(view.avatarIdleTime === undefined
            ? {}
            : { avatarIdleTime: view.avatarIdleTime }),
        ...(view.cameraMode === undefined
            ? {}
            : { cameraMode: view.cameraMode }),
        ...(view.avatarTravelPose
            ? { avatarTravelPose: view.avatarTravelPose }
            : {}),
        fov: view.fov,
        ...(view.spawnOffset ? { spawnOffset: { ...view.spawnOffset } } : {}),
        ...(peers
            ? {
                  peers: peers.map((peer) => ({
                      id: peer.id,
                      name: peer.name,
                      avatar: peer.avatar,
                      vrmUrl: peer.vrmUrl,
                      scale: peer.scale,
                      rotation: peer.rotation,
                      offset: { ...peer.offset },
                  })),
              }
            : {}),
    };
}
/** Everything a destination frame may tell the lobby about one attempt. */
export const LOBBY_DESTINATION_MESSAGE_TYPES = [
    "progress",
    "prepared",
    "entered",
    "reveal-ready",
    "revealed",
    "location",
    "back",
    "error",
] as const;
export interface LobbyDestinationMessage {
    protocol: typeof LOBBY_DESTINATION_PROTOCOL;
    attempt: string;
    type: (typeof LOBBY_DESTINATION_MESSAGE_TYPES)[number];
    href?: string;
    reveal?: LobbyRevealMode;
    /** Final locked departure framing, used only by the return presentation. */
    travelView?: LobbyTravelView;
    progress?: number;
    error?: LobbyJourneyError;
}

export function destinationFrameUrl(
    href: string,
    origin: string,
    attempt: string
) {
    const url = new URL(href, origin);
    if (url.origin !== origin || !/^https?:$/.test(url.protocol)) {
        throw new Error("This world needs to open in its own page.");
    }
    if (!/^\/(?:spaces\/|mints\/)?[a-z0-9@_-]+\/?$/i.test(url.pathname)) {
        throw new Error(
            "This world does not support preparation in the lobby."
        );
    }
    url.searchParams.set(LOBBY_ATTEMPT_PARAM, attempt);
    return url.href;
}

export function isLobbyDestinationMessage(
    event: MessageEvent,
    frameWindow: Window,
    origin: string,
    attempt: string
): event is MessageEvent<LobbyDestinationMessage> {
    const data = event.data;
    return (
        !!frameWindow &&
        !!attempt &&
        event.source === frameWindow &&
        event.origin === origin &&
        data?.protocol === LOBBY_DESTINATION_PROTOCOL &&
        data.attempt === attempt &&
        LOBBY_DESTINATION_MESSAGE_TYPES.includes(data.type)
    );
}

/** Everything the lobby may ask of a destination frame, in the order it asks. */
export type LobbyHostCommand =
    /** Recheck admission and join; stay hidden until `reveal`. */
    | {
          type: "enter";
          awaitReveal: true;
          reducedMotion: boolean;
          travelView?: LobbyTravelView;
          /** A portal draws the hidden world through its aperture first. */
          portalView?: import("./lobbyPortalPreview").LobbyPortalView;
      }
    /** Draw the first hidden frame matching the lobby's final camera. */
    | {
          type: "stage-reveal";
          reducedMotion: boolean;
          travelView?: LobbyTravelView;
      }
    /** Play the entrance and release input and audio when it completes. */
    | {
          type: "reveal";
          reducedMotion: boolean;
          /** The visitor walked through the portal: no staged entrance. */
          portal?: boolean;
      }
    /** The attempt was cancelled or replaced. */
    | { type: "dispose" };
export type LobbyHostMessage = LobbyHostCommand & {
    protocol: typeof LOBBY_DESTINATION_PROTOCOL;
    /** Null only for a `dispose` sent when no attempt is active. */
    attempt: string | null;
};
export function lobbyHostMessage(
    attempt: string | null,
    command: LobbyHostCommand
): LobbyHostMessage {
    return { protocol: LOBBY_DESTINATION_PROTOCOL, attempt, ...command };
}

/** Coordinate transport status; scene arrival does not depend on this connection. */
export function hasConnectedDestinationRoom(room: any): boolean {
    return (
        typeof room?.sessionId === "string" &&
        !!room.sessionId &&
        room.connection?.transport?.ws?.readyState === 1
    );
}

export function canOpenDestinationNormally(
    href: string,
    origin: string
): boolean {
    try {
        const url = new URL(href, origin);
        return /^https?:$/.test(url.protocol) && !url.username && !url.password;
    } catch {
        return false;
    }
}
