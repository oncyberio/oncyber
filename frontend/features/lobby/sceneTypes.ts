import type { LobbyFlash } from "../../../multiplayer/protocol/lobby-flash";
import type {
    MovementInput,
    MovementState,
} from "../../../multiplayer/protocol/movement";
import type { CrowdBudget } from "./crowdAdmission";

export interface LobbyParticipant {
    id: string;
    name: string;
    x: number;
    y: number;
    z: number;
    rotation: number;
    speaking?: boolean;
    flash?: LobbyFlash | null;
    avatar?: string;
    vrmUrl?: string;
    scale?: number;
    animation?: number;
    floor?: boolean;
    /** Supplied by the network interpolation buffer, in world units/second. */
    speed?: number;
    /** Whether the latest authoritative pose confirms a grounded stop. */
    restConfirmed?: boolean;
    jumpCount?: number;
    /** Optional presentation trajectory hint; absent peers use measured yaw rate. */
    turnIntent?: number;
}

export interface LobbyDestination {
    id: string;
    title: string;
    href: string;
    imageUrl?: string;
    /** Display name of the space's creator, when known. */
    creator?: string;
    /** 360 capture shown inside the round portal. */
    panoramaUrl?: string;
}

export interface LobbyRenderStats {
    backend?: string;
    draws: number;
    triangles: number;
    instances: number;
    visible: number;
    batches: number;
    models: number;
    textureBytes: number;
    population?: number;
    admitted?: number;
    pendingLoads?: number;
    labels?: number;
    nativeAvatars?: number;
    surrogateAvatars?: number;
    crowdPages?: number;
    portraitBytes?: number;
    transformUploads?: number;
    animationUploads?: number;
    frameCpuMs?: { p50: number; p95: number };
    frameIntervalMs?: { p50: number; p95: number; p99?: number; max?: number };
    sampleFrames?: number;
    viewport?: {
        width: number;
        height: number;
        bufferWidth: number;
        bufferHeight: number;
    };
}

/**
 * Why the scene reported a failure, chosen where the failure is raised.
 * "renderer": the graphics device, context or renderer itself failed, so the
 * same scene may still open on the WebGL2 backend. "asset": a file the scene
 * needs (such as the visitor's avatar) failed, which another renderer would
 * not fix.
 */
export type LobbySceneErrorKind = "renderer" | "asset";

/** Presentation only. IDs are exact renderer participant IDs, never account IDs. */
export interface LobbyTravelPresentation {
    /**
     * @deprecated Travel draws no words in the scene and the scene never reads
     * this. Kept only so `/dev/lobby-travel` still type-checks.
     */
    status?: { title: string; detail: string };
    phase: "isolate" | "charge" | "reveal" | "return";
    /** Development scrub override; ordinary travel follows the entry clock. */
    dissolveProgress?: number;
    /** Set only after the destination has staged its first hidden frame. */
    dissolveStartedAt?: number;
    /** performance.now() clock, stable across phases for a single journey. */
    startedAt: number;
    partyIds: readonly string[];
    reducedMotion: boolean;
    /** Validated live framing of the departing destination for the return seam. */
    returnView?: import("./lobbyJourneyProtocol").LobbyTravelView;
    /** Loading progress for the band on the departure halo. No words are drawn. */
    label?: import("./travelHaloText").TravelHaloLabel;
    /** Entered through the round portal: the camera flies into it instead of
     * the crouch, halo and title. */
    viaPortal?: boolean;
}

/** Approved participants and poses from the group transport; presentation grants no admission. */
export interface LobbyGroupFormation {
    id: string;
    selfId: string;
    initiatorId: string;
    members: readonly import("../../../multiplayer/protocol/lobby-groups").LobbyGroupMember[];
    poses: Record<
        string,
        import("../../../multiplayer/protocol/lobby-groups").LobbyGroupPose
    >;
    /** Local performance.now() timestamp for the gathering presentation. */
    startedAt: number;
}

export interface LobbySceneProps {
    /** A destination waiting behind a round portal in front of the avatar. */
    portal?: LobbyDestination | null;
    /** The avatar walked into (or the visitor clicked) the portal. */
    onEnterPortal?: () => void;
    portalActivated?: boolean;
    renderPortal?: (
        view: import("./lobbyPortalPreview").LobbyPortalView
    ) => boolean;
    onActivatePortal?: () => void;
    /**
     * @deprecated Never called: the scene draws no travel text. Kept only so
     * `/dev/lobby-travel` still type-checks.
     */
    onTravelStatusVisible?: (visible: boolean) => void;
    /** The first prepared return frame is rendered; safe to reveal this canvas. */
    onReturnReady?: (startedAt: number) => void;
    /** Fires after the return floor and camera finish rendering; rejects stale tokens. */
    onReturnComplete?: (startedAt: number) => void;
    /** Renderer camera framing, sampled before the destination handoff. */
    onTravelView?: (
        view: import("./lobbyJourneyProtocol").LobbyTravelView
    ) => void;
    /** Development-only scene fixture; geometry lives beside the persistent avatar. */
    worldRevealPreview?: {
        progress: number;
        /** Completed fixture: retain its world/party, release movement and face the camera behind the player. */
        arrived?: boolean;
        partyIds?: readonly string[];
        reducedMotion?: boolean;
    };
    /** Chat lines shown over speakers' heads, by participant id ("self" for
     * this visitor). See speechBubbles.ts. */
    speech?: Record<string, import("./speechBubbles").SpeechLine>;
    /** Keep active true during travel; clear this prop to cancel and restore the lobby. */
    travel?: LobbyTravelPresentation;
    /** Already approved companions whose authored travel rigs can warm before departure. */
    travelPartyIds?: readonly string[];
    /** Keep accepted profiles across source-roster departures until the destination handoff. */
    groupFormation?: LobbyGroupFormation;

    /** Opt-in development feedback; absent in normal lobby sessions. */
    onSelectAvatar?: (avatar: { id: string; avatarUrl?: string }) => void;
    selectedAvatarId?: string;
    onMotionFrame?: (
        frame: import("./testing/avatarFeedback").AvatarMotionFrame
    ) => void;
    advanceMovement?: (
        dt: number,
        input: MovementInput
    ) =>
        | (MovementState & {
              /** Actual controls used by prediction, including scripted/replay drivers. */
              movementInput?: MovementInput;
          })
        | null;
    /** Development comparison only; normal lobby visitors use GPU batching. */
    crowdEnabled?: boolean;
    /** Development comparison; defaults to enabled. */
    proceduralMotion?: boolean;
    renderBudget?: CrowdBudget;
    /** Imperative network timeline; movement updates do not re-render React. */
    sampleParticipants?: (nowMs?: number) => readonly LobbyParticipant[];
    consumeCorrection?: () => {
        sequence: number;
        x: number;
        y: number;
        z: number;
        rotation: number;
        hardSnap: boolean;
    } | null;
    initialPosition?: { x: number; z: number };
    /** Atomically adopt prediction state and clear corrections already applied to it. */
    initializePose?: () => {
        x: number;
        y: number;
        z: number;
        rotation: number;
    };
    onStats?: (stats: LobbyRenderStats) => void;
    active: boolean;
    avatarPreview?: boolean;
    onAvatarStatus?: (state: {
        url: string;
        status: "loading" | "ready" | "error";
        /**
         * Only with "error", and only when the scene had no avatar to keep
         * showing: the default avatar it is loading in place of `url`.
         */
        fallbackUrl?: string;
    }) => void;
    avatarUrl?: string;
    avatarScale?: number;
    profilePhoto?: string;
    /** Your own name, shown on the tag over your avatar. */
    selfName?: string;
    emote?: { index: number; nonce: number };
    flash?: LobbyFlash | null;
    flashPreviewOpen?: boolean;
    onFlashReady?: (flash: LobbyFlash) => void;
    onFlashDismiss?: (nonce: string) => void;
    onFlashError?: (nonce: string, message: string) => void;
    participants: LobbyParticipant[];
    destinations?: LobbyDestination[];
    onMove: (pose: {
        x: number;
        y: number;
        z: number;
        rotation: number;
        animation: number;
        floor: boolean;
    }) => void;
    onSelectDestination?: (destination: LobbyDestination) => void;
    onReady: () => void;
    /** The scene cannot continue. `kind` says whether another renderer could help. */
    onError: (message: string, kind: LobbySceneErrorKind) => void;
}

/** "to Justin Aversano's twin flames", or "to twin flames" without a name. */
export function travelDestinationTitle(destination?: LobbyDestination | null) {
    const title = destination?.title?.trim() || "your destination";
    const creator = destination?.creator?.trim();
    // Wallet addresses and ENS-less ids read badly as a possessive.
    if (!creator || /^0x[0-9a-f]{6,}$/i.test(creator) || creator.length > 40)
        return `to ${title}`;
    return `to ${creator}${/s$/i.test(creator) ? "’" : "’s"} ${title}`;
}
