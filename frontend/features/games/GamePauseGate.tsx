import { useEffect, useState, type ReactNode } from "react";
import {
    failLobbyDestination,
    requestLobbyDestinationBack,
} from "@utils/lobbyDestinationBridge";
import {
    fetchGameRelease,
    resolveGamePause,
    type GamePause,
} from "./gamePause";

/**
 * Renders the game only when the kill switch allows it (gamePause.ts).
 * A paused game is never mounted, so none of its files are requested; the
 * visitor sees why and a way back to the lobby.
 */
export default function GamePauseGate({
    game,
    title,
    pause,
    children,
}: {
    game: string;
    title: string;
    pause: GamePause | null | undefined;
    children: ReactNode;
}) {
    // Decided on the server when it can be, so a paused game never flashes.
    const [state, setState] = useState<"checking" | "paused" | "play">(
        pause?.paused ? "paused" : pause?.releases?.length ? "checking" : "play"
    );
    useEffect(() => {
        if (state !== "checking") return;
        let current = true;
        void resolveGamePause(pause, () => fetchGameRelease(game)).then(
            (next) => current && setState(next)
        );
        return () => {
            current = false;
        };
    }, []);
    useEffect(() => {
        // A lobby trip to a paused game ends at the lobby, with the reason.
        if (state === "paused")
            failLobbyDestination(
                `${title} is paused for now.`,
                `${game}-paused`,
                false
            );
    }, [state]);

    if (state === "play") return <>{children}</>;
    return (
        <main
            data-game-paused={state === "paused" ? game : undefined}
            style={{
                position: "fixed",
                inset: 0,
                display: "grid",
                placeContent: "center",
                gap: 14,
                padding: 24,
                textAlign: "center",
                background: "#0b0d12",
                color: "#fff",
                fontFamily: "Inter, Arial, sans-serif",
            }}
        >
            {state === "paused" && (
                <div role="status">
                    <h1 style={{ margin: 0, fontWeight: 500, fontSize: 28 }}>
                        This game is paused
                    </h1>
                    <p style={{ margin: "14px 0 22px", opacity: 0.8 }}>
                        {title} is taking a short break while we fix something.
                        Your saved progress is safe.
                    </p>
                    <a
                        href="/?lobby=1"
                        style={{ color: "#ffd23f" }}
                        onClick={(event) => {
                            if (requestLobbyDestinationBack())
                                event.preventDefault();
                        }}
                    >
                        Back to lobby
                    </a>
                </div>
            )}
        </main>
    );
}
