import { LOBBY_IDLE_CLIPS } from "./idleVariants";

/** Shared authored locomotion states; neither renderer imports the other Three build. */
export const LOBBY_GROUND_CLIPS = ["IDLE", "WALK", "RUN", "SPRINT"] as const;
// Quarter-cycle stop entries cover both supporting feet without a large pose jump.
export const LOBBY_STOP_CLIPS = [
    "STOP_L",
    "STOP_R",
    "STOP_L_LATE",
    "STOP_R_LATE",
] as const;
export const LOBBY_AIR_CLIPS = [
    "JUMP_IDLE",
    "JUMP_WALKING",
    "JUMP_RUNNING",
    "JUMP_SPRINTING",
    "JUMP_DOUBLE",
    "FALLING",
    "DROP_IDLE",
    "DROP_WALKING",
    "DROP_RUNNING",
    "DROP_SPRINTING",
    "DROP_WALKING_ROLL",
    "DROP_RUNNING_ROLL",
    "DROP_SPRINTING_ROLL",
] as const;
export const LOBBY_MOTION_CLIPS: readonly string[] = [
    ...LOBBY_GROUND_CLIPS,
    ...LOBBY_IDLE_CLIPS.filter((name) => name !== "IDLE"),
    "JUMP",
    ...LOBBY_AIR_CLIPS,
];
// Derived per avatar, baked on demand; not part of the eager crowd warm list.
export const LOBBY_TURN_CLIPS: readonly string[] = [
    ...["WALK", "RUN", "SPRINT"].flatMap((gait) =>
        ["L", "R"].map((side) => `TURN_${gait}_${side}`)
    ),
    ...["L", "R"].flatMap((side) =>
        [90, 180].flatMap((angle) =>
            ["L", "R"].map((foot) => `CUT_${side}${angle}_${foot}`)
        )
    ),
];
export const isMotionOneShot = (name: string) =>
    name.startsWith("JUMP_") || name.startsWith("DROP_");
