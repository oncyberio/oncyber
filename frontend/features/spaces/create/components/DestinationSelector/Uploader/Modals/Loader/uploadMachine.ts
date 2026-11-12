/**
 * Deploying an uploaded space from the upload window, as a pure state
 * machine.
 *
 * The window (`Modals/Loader/index.tsx`) holds the value and applies
 * `uploadTransition`. It keeps everything that touches the world, the CDN
 * and the database, and what the finished steps produced (`kept`), which a
 * retry reuses.
 *
 *   deploying ─ started / done / failed-step(step) ─▶ deploying
 *   deploying ─ done("upload_db") ─▶ deployed
 *   deploying | deployed ─ failed ─▶ failed ─ retry ─▶ deploying
 *
 * The three steps run in order, each todo → progress → success, or error
 * for the one that stopped the attempt. "failed" is the whole attempt
 * stopping, which can also happen before the first step (the scene was not
 * ready) or after the last (the window's owner refused the result). "retry"
 * keeps every finished step's tick and puts the failed one back to todo; the
 * next attempt skips the finished ones (`shouldRun`). "deployed" still reads
 * as deploying to the visitor: the window's owner replaces it.
 */

export type UploadStep = "quality_model" | "upload_cdn" | "upload_db";

export type UploadStepStatus = "todo" | "progress" | "success" | "error";

export type UploadStatus = "deploying" | "deployed" | "failed";

export interface UploadState {
    status: UploadStatus;
    steps: Record<UploadStep, UploadStepStatus>;
    /** Counts the "Try again" presses; each one runs the steps again. */
    attempt: number;
}

export type UploadEvent =
    | { type: "started"; step: UploadStep }
    | { type: "done"; step: UploadStep }
    | { type: "failed-step"; step: UploadStep }
    /** The attempt stopped. */
    | { type: "failed" }
    /** The visitor pressed "Try again". */
    | { type: "retry" };

export const initialUploadState: UploadState = {
    status: "deploying",
    steps: {
        quality_model: "todo",
        upload_cdn: "todo",
        upload_db: "todo",
    },
    attempt: 0,
};

const withStep = (
    state: UploadState,
    step: UploadStep,
    status: UploadStepStatus
): UploadState =>
    state.steps[step] === status
        ? state
        : { ...state, steps: { ...state.steps, [step]: status } };

export function uploadTransition(
    state: UploadState,
    event: UploadEvent
): UploadState {
    // A stopped attempt reports nothing more.
    if (state.status === "failed" && event.type !== "retry") return state;

    switch (event.type) {
        case "started":
            return withStep(state, event.step, "progress");
        case "done": {
            const next = withStep(state, event.step, "success");
            return event.step === "upload_db" && next.status !== "deployed"
                ? { ...next, status: "deployed" }
                : next;
        }
        case "failed-step":
            return withStep(state, event.step, "error");
        case "failed":
            return { ...state, status: "failed" };
        case "retry": {
            if (state.status !== "failed") return state;
            const waitAgain = (status: UploadStepStatus) =>
                status === "error" ? "todo" : status;
            return {
                status: "deploying",
                attempt: state.attempt + 1,
                steps: {
                    quality_model: waitAgain(state.steps.quality_model),
                    upload_cdn: waitAgain(state.steps.upload_cdn),
                    upload_db: waitAgain(state.steps.upload_db),
                },
            };
        }
        default:
            return state;
    }
}

/**
 * Whether an attempt runs this step. A step that finished on an earlier
 * attempt is skipped; its results are kept by the window. The database
 * step always runs.
 */
export const shouldRun = (state: UploadState, step: UploadStep) =>
    step === "upload_db" || state.steps[step] !== "success";
