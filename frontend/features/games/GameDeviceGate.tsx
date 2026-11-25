import { useEffect, useState, type ReactNode } from "react";
import {
    failLobbyDestination,
    requestLobbyDestinationBack,
} from "@utils/lobbyDestinationBridge";
import type { GameEntry } from "./catalog";
import { deviceNotice, gameOnDevice } from "./gameDevices";
import { gameDevice, type VisitorDevice } from "./gameHealth";
import { gameChrome } from "./gameChrome";

/**
 * Renders the game only on a device it supports (gameDevices.ts). The
 * device is known in the browser only, so nothing is mounted until then:
 * a game that isn't on phones never loads its files on one.
 */
export default function GameDeviceGate({
    game,
    children,
}: {
    game: Pick<GameEntry, "id" | "title" | "devices">;
    children: ReactNode;
}) {
    const [device, setDevice] = useState<VisitorDevice | null>(null);
    useEffect(() => setDevice(gameDevice()), []);
    const blocked = device !== null && !gameOnDevice(game, device);
    useEffect(() => {
        // A lobby trip to a game this device can't play ends at the lobby.
        if (blocked)
            failLobbyDestination(
                deviceNotice(game.title, device),
                `${game.id}-device`,
                false
            );
    }, [blocked]);

    if (device !== null && !blocked) return <>{children}</>;
    return (
        <main
            data-game-overlay="device"
            data-game-device-blocked={blocked ? game.id : undefined}
            style={{
                position: "fixed",
                inset: 0,
                display: "grid",
                placeContent: "center",
                gap: 14,
                padding: 24,
                textAlign: "center",
                background: gameChrome.color.frame,
                color: gameChrome.color.ink,
                fontFamily: gameChrome.family,
            }}
        >
            {blocked && (
                <div role="status">
                    <h1 style={{ margin: 0, fontWeight: 500, fontSize: 28 }}>
                        {deviceNotice(game.title, device)}
                    </h1>
                    <p style={{ margin: "14px 0 22px", opacity: 0.8 }}>
                        {game.devices.includes("desktop")
                            ? "You can play it on a computer."
                            : "You can play it on a phone."}
                    </p>
                    <a
                        href="/?lobby=1"
                        style={{ color: gameChrome.color.ink }}
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
