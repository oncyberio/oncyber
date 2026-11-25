// The door's states and the moves between them, on their own
// (docs/state-machines.md): no three.js, no timers. openHouse.ts owns the
// frames, measures the distance and turns the door. A settled door returns
// the same state every frame; a new one is made only while it swings.

export type DoorPhase = "closed" | "opening" | "open" | "closing";

export type DoorState = {
    phase: DoorPhase;
    /** How far it has swung: 0 shut, 1 fully open. */
    swing: number;
};

export type DoorEvent = {
    type: "frame";
    /** Seconds since the last frame. */
    seconds: number;
    /** How far the visitor is from the doorway; 0 while inside the house. */
    distance: number;
};

export const DOOR_RULES = {
    /** Opens when the visitor comes this near. */
    openWithin: 9,
    /** Closes once they are this far: further out, so it does not flap. */
    closeBeyond: 13,
    /** Seconds to swing all the way. */
    swingSeconds: 0.9,
};

export const DOOR_CLOSED: DoorState = { phase: "closed", swing: 0 };

/**
 * The door swings open as a visitor comes near and shuts behind them once
 * they have gone. Returns the same object when nothing changes.
 */
export function transition(state: DoorState, event: DoorEvent): DoorState {
    if (event.type !== "frame") return state;
    const wanted =
        event.distance <= DOOR_RULES.openWithin
            ? 1
            : event.distance >= DOOR_RULES.closeBeyond
            ? 0
            : // in between it carries on with what it was doing
            state.phase === "open" || state.phase === "opening"
            ? 1
            : 0;
    if (state.swing === wanted) {
        const settled = wanted === 1 ? "open" : "closed";
        return state.phase === settled
            ? state
            : { phase: settled, swing: wanted };
    }
    const step = Math.max(0, event.seconds) / DOOR_RULES.swingSeconds;
    if (wanted === 1) {
        const swing = Math.min(1, state.swing + step);
        return { phase: swing === 1 ? "open" : "opening", swing };
    }
    const swing = Math.max(0, state.swing - step);
    return { phase: swing === 0 ? "closed" : "closing", swing };
}

/** The door's swing eased at both ends, as a door on its hinges moves. */
export const easedSwing = (swing: number) => swing * swing * (3 - 2 * swing);
