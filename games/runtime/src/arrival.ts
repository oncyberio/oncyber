/**
 * The lobby handoff, as numbers a game can match and a check can measure.
 *
 * A visitor leaves the lobby crouched, hands empty, with the lobby's travel
 * camera in front of them. The page sends that last frame to the game as the
 * `arrival` message (`{ view }`); the game stands the visitor in the same
 * framing, answers `arrival-ready`, and is revealed. Rule and check:
 * docs/games/good-game.md.
 *
 * No imports: the check script loads this file directly.
 */

/** The lobby's last frame, relative to the avatar's feet (metres, radians). */
export interface ArrivalView {
    cameraOffset: { x: number; y: number; z: number };
    cameraTargetOffset: { x: number; y: number; z: number };
    /** The avatar's yaw in the lobby. The camera sits at yaw + PI around it. */
    avatarRotation: number;
    avatarHeight?: number;
    /** Vertical field of view in degrees. */
    fov: number;
    cameraMode?: "first-person" | "third-person";
}

/**
 * What the lobby does today (frontend/features/lobby/createLobbyScene.tsx,
 * the travel camera): the camera orbits to the avatar's front at
 * `4.6 + 0.44 × party size` metres (party size capped at 7), 2 m above the
 * feet, looking at a point 1.05 m up, with a 58° lens (72° when the page is
 * narrower than 600 px). Use the `arrival` message's view when there is one;
 * these are the fallback and what the check sends.
 */
export const LOBBY_HANDOFF = {
    baseDistance: 4.6,
    distancePerMember: 0.44,
    maxCountedMembers: 7,
    cameraHeight: 2,
    targetHeight: 1.05,
    fov: 58,
    narrowFov: 72,
    narrowBelowPx: 600,
    avatarHeight: 1.7,
} as const;

/** Horizontal metres from the avatar to the lobby camera for a party. */
export function lobbyCameraDistance(partySize = 1): number {
    const counted = Math.max(
        1,
        Math.min(LOBBY_HANDOFF.maxCountedMembers, Math.floor(partySize) || 1)
    );
    return (
        LOBBY_HANDOFF.baseDistance + counted * LOBBY_HANDOFF.distancePerMember
    );
}

/** The view the lobby would send for a party of this size. */
export function lobbyArrivalView(
    options: {
        partySize?: number;
        yaw?: number;
        pageWidth?: number;
        avatarHeight?: number;
    } = {}
): ArrivalView {
    const yaw = options.yaw ?? 0;
    const distance = lobbyCameraDistance(options.partySize);
    const narrow = (options.pageWidth ?? 1280) < LOBBY_HANDOFF.narrowBelowPx;
    return {
        cameraOffset: {
            x: Math.sin(yaw) * distance,
            y: LOBBY_HANDOFF.cameraHeight,
            z: Math.cos(yaw) * distance,
        },
        cameraTargetOffset: { x: 0, y: LOBBY_HANDOFF.targetHeight, z: 0 },
        avatarRotation: yaw + Math.PI,
        avatarHeight: options.avatarHeight ?? LOBBY_HANDOFF.avatarHeight,
        fov: narrow ? LOBBY_HANDOFF.narrowFov : LOBBY_HANDOFF.fov,
        cameraMode: "third-person",
    };
}

/**
 * Turn the lobby's view into the game's space: the whole formation rotates
 * so the camera ends up at `cameraYaw` around the avatar (yaw 0 is +z), and
 * scales with the game's avatar height. Returns offsets from the avatar's
 * feet; the avatar should face the camera.
 */
export function mapArrivalView(
    view: ArrivalView,
    options: { cameraYaw?: number; avatarHeight?: number } = {}
) {
    const turn = (options.cameraYaw ?? 0) - (view.avatarRotation + Math.PI);
    const cos = Math.cos(turn);
    const sin = Math.sin(turn);
    const scale =
        options.avatarHeight && view.avatarHeight
            ? options.avatarHeight / view.avatarHeight
            : 1;
    const map = (v: { x: number; y: number; z: number }) => ({
        x: (v.x * cos + v.z * sin) * scale,
        y: v.y * scale,
        z: (-v.x * sin + v.z * cos) * scale,
    });
    return {
        cameraOffset: map(view.cameraOffset),
        cameraTargetOffset: map(view.cameraTargetOffset),
        fov: view.fov,
        scale,
    };
}

/** What a game reports under `inspect().arrival` while the visitor arrives. */
export interface ArrivalFacts {
    /** Horizontal metres from the avatar's feet to the camera. */
    distance: number;
    /** Camera height above the avatar's feet, in metres. */
    height: number;
    /** Vertical field of view in degrees. */
    fov: number;
    /** The game's avatar height in metres (the lobby's view is scaled to it). */
    avatarHeight: number;
    /** The avatar's front is turned toward the camera. */
    facingCamera: boolean;
    crouched: boolean;
    handsEmpty: boolean;
}

const round = (value: number) => Math.round(value * 100) / 100;

/** Measure the arrival from what the game is actually drawing. */
export function describeArrival(scene: {
    camera: { x: number; y: number; z: number };
    fov: number;
    avatar: { x: number; y: number; z: number };
    /** Unit vector on the ground the avatar's front points along. */
    avatarForward: { x: number; z: number };
    avatarHeight: number;
    crouched: boolean;
    handsEmpty: boolean;
}): ArrivalFacts {
    const dx = scene.camera.x - scene.avatar.x;
    const dz = scene.camera.z - scene.avatar.z;
    return {
        distance: round(Math.hypot(dx, dz)),
        height: round(scene.camera.y - scene.avatar.y),
        fov: round(scene.fov),
        avatarHeight: round(scene.avatarHeight),
        facingCamera:
            dx * scene.avatarForward.x + dz * scene.avatarForward.z > 0,
        crouched: scene.crouched,
        handsEmpty: scene.handsEmpty,
    };
}

export interface HandoffFinding {
    code: string;
    message: string;
}

/**
 * Compare a game's first arrival frame with the view the lobby sent.
 * Distances are compared in avatar heights, so a game with a taller or
 * shorter avatar still matches. Tolerances: 15% on distance, 0.2 avatar
 * heights on camera height, 2° on the lens.
 */
export function handoffFindings(
    view: ArrivalView,
    facts: Partial<ArrivalFacts> | null | undefined
): HandoffFinding[] {
    if (!facts || typeof facts !== "object")
        return [
            {
                code: "HANDOFF_FACTS",
                message:
                    "inspect().arrival is missing; report it with describeArrival()",
            },
        ];
    const findings: HandoffFinding[] = [];
    const number = (value: unknown) =>
        typeof value === "number" && Number.isFinite(value);
    for (const key of ["distance", "height", "fov", "avatarHeight"] as const)
        if (!number(facts[key]))
            findings.push({
                code: "HANDOFF_FACTS",
                message: `inspect().arrival.${key} is not a number`,
            });
    if (findings.length) return findings;
    const lobbyHeight = view.avatarHeight || LOBBY_HANDOFF.avatarHeight;
    const want = {
        distance:
            Math.hypot(view.cameraOffset.x, view.cameraOffset.z) / lobbyHeight,
        height: view.cameraOffset.y / lobbyHeight,
    };
    const got = {
        distance: facts.distance! / facts.avatarHeight!,
        height: facts.height! / facts.avatarHeight!,
    };
    const metres = (heights: number) => `${round(heights * lobbyHeight)} m`;
    if (Math.abs(got.distance - want.distance) > want.distance * 0.15)
        findings.push({
            code: "HANDOFF_DISTANCE",
            message: `camera is ${metres(
                got.distance
            )} from the avatar; the lobby left it ${metres(
                want.distance
            )} away`,
        });
    if (Math.abs(got.height - want.height) > 0.2)
        findings.push({
            code: "HANDOFF_HEIGHT",
            message: `camera is ${metres(
                got.height
            )} up; the lobby left it ${metres(want.height)} up`,
        });
    if (Math.abs(facts.fov! - view.fov) > 2)
        findings.push({
            code: "HANDOFF_FOV",
            message: `field of view is ${facts.fov}°; the lobby's is ${view.fov}°`,
        });
    if (facts.facingCamera !== true)
        findings.push({
            code: "HANDOFF_FACING",
            message: "the camera is not in front of the avatar",
        });
    if (facts.crouched !== true)
        findings.push({
            code: "HANDOFF_CROUCH",
            message:
                "the avatar is not crouched on the first frame; the trip ends in a crouch",
        });
    if (facts.handsEmpty !== true)
        findings.push({
            code: "HANDOFF_HANDS",
            message:
                "the avatar holds something on arrival; the trip ends with empty hands",
        });
    return findings;
}
