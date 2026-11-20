import { useEffect, useReducer, useState, type RefObject } from "react";
import {
    isLobbyDestination,
    lobbyDestinationProgress,
} from "@utils/lobbyDestinationBridge";
import {
    GAME_LOADING,
    gameLoadingTransition,
    readGameLoadingMessage,
    type GameLoadingState,
} from "./gameLoading";

/**
 * Follows a game's loading messages (`progress`, `first-frame`, `frame`)
 * from its sandboxed frame. On a trip from the lobby the progress also goes
 * to the lobby, which shows it on the way.
 */
export function useGameLoading(
    game: string,
    frame: RefObject<HTMLIFrameElement>
): GameLoadingState {
    const [state, dispatch] = useReducer(gameLoadingTransition, GAME_LOADING);
    useEffect(() => {
        const receive = (event: MessageEvent) => {
            // The game's origin is opaque; only its own window counts.
            if (
                event.source !== frame.current?.contentWindow ||
                event.origin !== "null"
            )
                return;
            const message = readGameLoadingMessage(game, event.data);
            if (!message) return;
            if (message.type === "progress")
                lobbyDestinationProgress(message.value);
            dispatch(message);
        };
        window.addEventListener("message", receive);
        return () => window.removeEventListener("message", receive);
    }, [game, frame]);
    return state;
}

/**
 * Covers the game until its first frame is drawn, with the game's progress.
 * It is a page overlay like the others (`data-game-overlay`); covering the
 * whole frame, it reserves no safe area.
 * On a trip from the lobby there is no cover: the lobby stays on screen
 * until the game is ready, and a second cover would flash in the reveal.
 */
export function GameLoadingCover({
    state,
    title,
}: {
    state: GameLoadingState;
    title: string;
}) {
    const waiting = state.phase === "loading";
    const percent = Math.round(state.progress * 100);
    // Read after mount: the server render cannot know about the trip.
    const [onTrip, setOnTrip] = useState(false);
    useEffect(() => setOnTrip(isLobbyDestination()), []);
    if (onTrip) return null;
    return (
        <div
            data-machine="game-loading"
            data-game-overlay="loading"
            data-state={state.phase}
            role="status"
            aria-hidden={!waiting}
            style={{
                position: "absolute",
                inset: 0,
                display: "grid",
                placeContent: "center",
                justifyItems: "center",
                gap: 14,
                background: "#0b0d12",
                color: "#fff",
                font: "600 15px/1.3 Inter, system-ui, sans-serif",
                opacity: waiting ? 1 : 0,
                visibility: waiting ? "visible" : "hidden",
                pointerEvents: waiting ? "auto" : "none",
                transition: "opacity 160ms ease-out, visibility 0s 160ms",
            }}
        >
            <span>{title}</span>
            <div
                role="progressbar"
                aria-label={`Loading ${title}`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percent}
                style={{
                    width: 220,
                    height: 6,
                    borderRadius: 999,
                    overflow: "hidden",
                    background: "rgba(255, 255, 255, 0.14)",
                }}
            >
                <div
                    style={{
                        width: `${percent}%`,
                        height: "100%",
                        borderRadius: 999,
                        background: "#fff",
                        transition: "width 120ms linear",
                    }}
                />
            </div>
            <span style={{ minHeight: 18, fontWeight: 500, opacity: 0.7 }}>
                {state.label || "Loading…"}
            </span>
        </div>
    );
}
