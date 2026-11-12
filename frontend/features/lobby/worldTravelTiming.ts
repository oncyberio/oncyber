import {
    TRAVEL_ANIMATION_PLAY_MS,
    TRAVEL_ANIMATION_SPEED,
} from "./travelAnimationPack";

/** Shared source-world choreography, measured from explicit entry, in wall
 * time (clips play at TRAVEL_ANIMATION_SPEED). */
export const TRAVEL_ISOLATE_MS = 600;
export const TRAVEL_CHARGE_LEAD_MS =
    TRAVEL_ANIMATION_PLAY_MS.TRAVEL_ATTACK +
    TRAVEL_ANIMATION_PLAY_MS.TRAVEL_CROUCH_DOWN;
/** First hand impact in the authored attack, frame 65 at 30 fps. */
export const TRAVEL_CLAP_MS =
    ((65 / 30) * 1000) / TRAVEL_ANIMATION_SPEED.TRAVEL_ATTACK;
export const WORLD_DISSOLVE_MS = 700;
export const WORLD_BLACK_HOLD_MS = 150;
export const TRAVEL_DISSOLVE_AT_MS = TRAVEL_ISOLATE_MS + TRAVEL_CLAP_MS;
export const TRAVEL_BLACK_AT_MS = TRAVEL_DISSOLVE_AT_MS + WORLD_DISSOLVE_MS;
/** Blackout overlaps the attack; never cut off the attack or crouch-down. */
export const TRAVEL_DEPARTURE_MS = Math.max(
    TRAVEL_ISOLATE_MS + TRAVEL_CHARGE_LEAD_MS,
    TRAVEL_BLACK_AT_MS + WORLD_BLACK_HOLD_MS
);
