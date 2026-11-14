import { useEffect, useRef, useState, type RefObject } from "react";
import {
    createGameAudioBridge,
    soundStore,
    type SpeakingSource,
} from "./gameAudio";

/**
 * Connects the game frame to the page's sound: the shared setting, the first
 * gesture, and (when the voice side provides it) who is speaking.
 */
export function useGameAudio(
    game: string,
    frame: RefObject<HTMLIFrameElement>,
    speaking?: SpeakingSource
) {
    const source = useRef(speaking);
    source.current = speaking;
    const speak = useRef<(speaking: boolean) => void>(() => {});
    useEffect(() => {
        const bridge = createGameAudioBridge({
            post: (kind, data) =>
                frame.current?.contentWindow?.postMessage(
                    { type: `${game}:${kind}`, ...data },
                    "*"
                ),
        });
        speak.current = bridge.setSpeaking;
        const receive = (event: MessageEvent) => {
            if (
                event.source !== frame.current?.contentWindow ||
                event.origin !== "null"
            )
                return;
            const type = event.data?.type;
            if (type === `${game}:audio`) bridge.receive(event.data);
            // The identity is the first thing a game listens for.
            else if (type === `${game}:hello`) bridge.sync();
        };
        window.addEventListener("message", receive);
        return () => {
            window.removeEventListener("message", receive);
            bridge.dispose();
        };
    }, [game, frame]);
    useEffect(
        () => speaking?.subscribe((value) => speak.current(value)),
        [speaking]
    );
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
                borderRadius: 999,
                padding: "8px 14px",
                font: "inherit",
                cursor: "pointer",
                color: "#fff",
                background: "rgba(255,255,255,0.12)",
            }}
        >
            {muted ? "Sound off" : "Sound on"}
        </button>
    );
}
