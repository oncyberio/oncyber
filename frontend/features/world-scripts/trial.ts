/**
 * A new version's trial, as states and the moves between them
 * (docs/state-machines.md). A version is opened beside the running one, is
 * asked to start, and must answer a number of the world's frames cleanly
 * before it may replace what runs. It fails for the script's own reasons
 * (it threw, it hung, it flooded) or for the world's (its frame never
 * opened, it went silent, something newer took its place), and only the
 * first kind is worth showing the model.
 *
 * Pure: the host (./host.ts) owns the frame, the timers and the messages.
 */

/** Frames a new version must answer cleanly before it replaces the old one. */
export const TRIAL_TICKS = 30;

/** Whose fault a refusal is: the script's own, or the world it ran in. */
export type TrialFault = "script" | "world";

export type TrialState =
    /** Its frame is opening; nothing has been asked of the script. */
    | { phase: "opening" }
    /** Asked to start; its first lines are running. */
    | { phase: "starting" }
    /** Started; `ticks` frames answered so far. */
    | { phase: "running"; ticks: number }
    | { phase: "passed" }
    | {
          phase: "failed";
          reason: string;
          fault: TrialFault;
          /** Closed from outside: nothing went wrong, nothing to report. */
          closed?: true;
      };

export type TrialEvent =
    /** The frame opened and the script was sent its start. */
    | { type: "booted" }
    | { type: "started" }
    /** It answered: `seq` is the frame answered, below zero for its start. */
    | { type: "ops"; seq: number }
    | { type: "error"; text: string }
    | { type: "stopped"; reason: string }
    /** More messages between two frames than a script may send. */
    | { type: "flood" }
    /** Nothing heard for too long while an answer was owed. */
    | { type: "silent" }
    /** The frame could not be opened. */
    | { type: "unopened"; reason: string }
    /** Closed by the host: a newer version, a stop, the world going away. */
    | { type: "closed" };

export const TRIAL_REPLACED = "Replaced by a newer version.";
export const TRIAL_SILENT = "The new version did not start in time.";
export const TRIAL_FLOOD =
    "The script sent too much at once, so it was stopped.";

export function trialSettled(state: TrialState) {
    return state.phase === "passed" || state.phase === "failed";
}

/** Whether silence now is the version's: it owes its start, or a frame. */
export function trialOwes(state: TrialState, awaitingTick: boolean) {
    return (
        state.phase === "starting" ||
        (state.phase === "running" && awaitingTick)
    );
}

const failed = (
    reason: string,
    fault: TrialFault,
    closed?: true
): TrialState => ({
    phase: "failed",
    reason,
    fault,
    ...(closed ? { closed } : {}),
});

export function trialTransition(
    state: TrialState,
    event: TrialEvent,
    needed: number = TRIAL_TICKS
): TrialState {
    if (trialSettled(state)) return state;
    switch (event.type) {
        case "booted":
            return state.phase === "opening" ? { phase: "starting" } : state;
        case "started":
            return state.phase === "running"
                ? state
                : { phase: "running", ticks: 0 };
        case "ops": {
            // What it sends while starting is kept, but is not a frame.
            if (state.phase !== "running" || !(event.seq >= 0)) return state;
            const ticks = state.ticks + 1;
            return ticks >= needed
                ? { phase: "passed" }
                : { phase: "running", ticks };
        }
        case "error":
            return failed(event.text || "Error", "script");
        case "stopped":
            return failed(event.reason || "Stopped.", "script");
        case "flood":
            return failed(TRIAL_FLOOD, "script");
        case "silent":
            return failed(TRIAL_SILENT, "world");
        case "unopened":
            return failed(
                event.reason || "The script frame did not open.",
                "world"
            );
        case "closed":
            return failed(TRIAL_REPLACED, "world", true);
        default:
            return state;
    }
}
