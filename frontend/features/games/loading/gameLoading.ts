/**
 * The page's side of a game's loading, as a pure state machine (see
 * docs/state-machines.md and docs/games/loading-and-pausing.md).
 *
 *   loading ─ progress ─▶ loading (progress only rises)
 *   loading ─ first-frame ─▶ drawn      the page may show the game
 *   loading ─ ready ─▶ drawn            a game that never sends first-frame
 *   drawn ─ frame ─▶ drawn              redrawn at a new size
 *   loading ─ error ─▶ failed
 *
 * The game's half is games/runtime/src/loading.ts. `GameLoadingCover` owns
 * the frame and the messages; every change of state goes through
 * `gameLoadingTransition`.
 */
import { readGameMessage } from "../contract/gameContract";

export type GameLoadingPhase = "loading" | "drawn" | "failed";

export interface GameFrameSize {
    /** The game's viewport in CSS pixels. */
    width: number;
    height: number;
}

export interface GameLoadingState {
    phase: GameLoadingPhase;
    /** 0..1. */
    progress: number;
    /** What the game says it is doing, if it says. */
    label: string;
    /** The game's own clock at its first frame. */
    firstFrameMs: number | null;
    /** The size the game last drew at; null when it never said. */
    drawn: GameFrameSize | null;
}

export type GameLoadingEvent =
    | { type: "progress"; value: number; label: string }
    | { type: "first-frame"; ms: number; width: number; height: number }
    | { type: "frame"; width: number; height: number }
    | { type: "ready" }
    | { type: "error" };

export const GAME_LOADING: GameLoadingState = {
    phase: "loading",
    progress: 0,
    label: "",
    firstFrameMs: null,
    drawn: null,
};

export function gameLoadingTransition(
    state: GameLoadingState,
    event: GameLoadingEvent
): GameLoadingState {
    if (state.phase === "loading") {
        if (event.type === "progress") {
            const progress = Math.max(state.progress, event.value);
            return progress === state.progress && event.label === state.label
                ? state
                : { ...state, progress, label: event.label };
        }
        if (event.type === "first-frame")
            return {
                ...state,
                phase: "drawn",
                progress: 1,
                firstFrameMs: event.ms,
                drawn: { width: event.width, height: event.height },
            };
        if (event.type === "ready")
            return { ...state, phase: "drawn", progress: 1 };
        if (event.type === "error") return { ...state, phase: "failed" };
        return state;
    }
    if (state.phase === "drawn" && event.type === "frame") {
        return state.drawn?.width === event.width &&
            state.drawn?.height === event.height
            ? state
            : { ...state, drawn: { width: event.width, height: event.height } };
    }
    return state;
}

/**
 * Whether what the game last drew fits the frame the page is showing. A
 * game that never reports a size is taken at its word.
 */
export function gameFrameCurrent(
    state: GameLoadingState,
    viewport: GameFrameSize
): boolean {
    if (state.phase !== "drawn") return false;
    if (!state.drawn) return true;
    return (
        Math.abs(state.drawn.width - viewport.width) <= 2 &&
        Math.abs(state.drawn.height - viewport.height) <= 2
    );
}

const side = (value: unknown) =>
    typeof value === "number" && Number.isFinite(value) && value >= 0
        ? Math.min(100000, Math.round(value))
        : null;

/**
 * A loading message from the game's frame, or null: `oncyber:game:<kind>`,
 * or `<game>:<kind>` from a build made before the one contract.
 */
export function readGameLoadingMessage(
    game: string,
    data: any
): GameLoadingEvent | null {
    const kind = readGameMessage(data?.type, game)?.kind;
    if (!kind) return null;
    if (kind === "ready" || kind === "error") return { type: kind };
    if (kind === "progress") {
        if (typeof data.value !== "number" || !Number.isFinite(data.value))
            return null;
        return {
            type: "progress",
            value: Math.min(1, Math.max(0, data.value)),
            label:
                typeof data.label === "string" ? data.label.slice(0, 80) : "",
        };
    }
    if (kind === "first-frame" || kind === "frame") {
        const width = side(data.width);
        const height = side(data.height);
        if (width === null || height === null) return null;
        if (kind === "frame") return { type: "frame", width, height };
        return { type: "first-frame", ms: side(data.ms) ?? 0, width, height };
    }
    return null;
}
