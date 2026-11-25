import { useEffect, useRef, useState } from "react";
import { createGameAudioBridge, soundStore } from "./gameAudio";
import { readGameMessage } from "./gameContract";
import { gameChrome } from "./gameChrome";

/**
 * Connects the game frame to the page's sound: the shared setting, the first
 * gesture, and whether someone in the room is speaking (from the page's
 * voice: `useGameSocial`'s `talking`). `send` is GamePage's, which puts each
 * message in the form the game speaks; `fromGame` vouches for the frame.
 */
export function useGameAudio({
    game,
    fromGame,
    send,
    speaking = false,
}: {
    game: string;
    fromGame: (event: MessageEvent) => boolean;
    send: (message: object) => void;
    speaking?: boolean;
}) {
    const io = useRef({ fromGame, send });
    io.current = { fromGame, send };
    const speak = useRef<(speaking: boolean) => void>(() => {});
    useEffect(() => {
        const bridge = createGameAudioBridge({
            post: (kind, data) =>
                io.current.send({ type: `${game}:${kind}`, ...data }),
        });
        speak.current = bridge.setSpeaking;
        const receive = (event: MessageEvent) => {
            if (!io.current.fromGame(event)) return;
            const kind = readGameMessage(event.data?.type, game)?.kind;
            // The game's output asks as soon as it exists (`hello: true`),
            // or its own sound control asks for mute.
            if (kind === "audio") bridge.receive(event.data);
            // Again once the game is up, in the form it greeted in.
            else if (kind === "ready") bridge.sync();
        };
        window.addEventListener("message", receive);
        return () => {
            window.removeEventListener("message", receive);
            speak.current = () => {};
            bridge.dispose();
        };
    }, [game]);
    useEffect(() => speak.current(speaking), [speaking]);
}

/** The page's own sound control; the game's control changes the same setting. */
export function GameSoundButton({ onDone }: { onDone?: () => void }) {
    const [muted, setMuted] = useState(false);
    useEffect(() => {
        setMuted(soundStore().get().muted);
        return soundStore().subscribe((setting) => setMuted(setting.muted));
    }, []);
    return (
        <button
            type="button"
            aria-pressed={!muted}
            title={muted ? "Turn sound on" : "Turn sound off"}
            onClick={() => {
                soundStore().set({ muted: !muted });
                onDone?.();
            }}
            style={{
                border: 0,
                borderRadius: gameChrome.radius.pill,
                padding: "8px 14px",
                font: "inherit",
                cursor: "pointer",
                color: gameChrome.color.ink,
                background: gameChrome.color.control,
            }}
        >
            {muted ? "Sound off" : "Sound on"}
        </button>
    );
}
