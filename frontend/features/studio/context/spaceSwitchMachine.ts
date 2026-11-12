import type { Experience } from "@uitypes/experience";

/**
 * Switching the studio from one space to another, as a pure state machine.
 *
 * `SpaceSwitchContext` owns everything that touches the outside world (the
 * engine, the requests, the exhibit context). Every change to the switch goes
 * through `spaceSwitchTransition`, so the legal moves are listed in this one
 * file and can be tested without React or an engine.
 *
 *   idle ─ start ─▶ switching ─ succeed ─▶ idle
 *                       │
 *                       └─ fail ─▶ failed ─ start (Retry, Back, another) ─▶ switching
 *   switching ─ start ─▶ unchanged (one switch at a time)
 *
 * A failed switch leaves the engine on its intro screen with no space. The
 * state keeps the space that would not open, so Retry can run the same switch
 * again, and the space the visitor came from, so they can go back to it.
 */
export type SpaceSwitchState =
    | { status: "idle" }
    | {
          status: "switching" | "failed";
          /** The space being opened, or the one that would not open. */
          target: Experience;
          /** A guest's space is not fetched: it only exists in the browser. */
          isAnon: boolean;
          /** The space that was open before the first attempt. */
          from: Experience | null;
      };

export type SpaceSwitchEvent =
    | {
          type: "start";
          target: Experience;
          isAnon?: boolean;
          /** The space open now. Ignored after a failure, see below. */
          from?: Experience | null;
      }
    | { type: "succeed" }
    | { type: "fail" };

export const IDLE_SPACE_SWITCH: SpaceSwitchState = { status: "idle" };

export function spaceSwitchTransition(
    state: SpaceSwitchState,
    event: SpaceSwitchEvent
): SpaceSwitchState {
    switch (event.type) {
        case "start":
            // The engine is part-way out of one space; a second switch
            // started now would interleave with the first.
            if (state.status === "switching") return state;
            return {
                status: "switching",
                target: event.target,
                isAnon: !!event.isAnon,
                // After a failure nothing is open, and the exhibit context
                // may already name the space that failed. The way back is
                // still the space the first attempt left.
                from:
                    state.status === "failed" ? state.from : event.from || null,
            };
        case "succeed":
            return state.status === "switching" ? IDLE_SPACE_SWITCH : state;
        case "fail":
            return state.status === "switching"
                ? { ...state, status: "failed" }
                : state;
        default:
            return state;
    }
}

/**
 * The space a failed switch can go back to, or null when there is none.
 *
 * A guest has a single draft kept in the browser, and the switch that failed
 * may already have replaced it, so a guest is only offered Retry.
 */
export function spaceSwitchBackTarget(
    state: SpaceSwitchState
): Experience | null {
    if (state.status !== "failed" || state.isAnon) return null;
    if (!state.from || state.from.id === state.target.id) return null;
    return state.from;
}
