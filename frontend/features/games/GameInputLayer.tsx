import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import {
    createGameInputHost,
    focusGameChat,
    type GameKeyIntent,
} from "./gameInput";
import { readGameStorage, writeGameStorage } from "./gameStorage";

const button = {
    border: 0,
    borderRadius: 999,
    padding: "12px 18px",
    font: "inherit",
    cursor: "pointer",
    color: "#fff",
    background: "rgba(255,255,255,0.12)",
    textAlign: "left" as const,
};

/**
 * Keys and focus for a game page (docs/games/keys-focus.md): the page owns
 * Escape (this world menu), Enter (chat) and M (sound), and the game gets
 * no input while the menu is open or the visitor types in the page.
 */
export default function GameInputLayer({
    game,
    title,
    frame,
    send,
    fromGame,
    onLeave,
}: {
    game: string;
    title: string;
    frame: RefObject<HTMLIFrameElement>;
    send: (message: object) => void;
    fromGame: (event: MessageEvent) => boolean;
    onLeave: () => void;
}) {
    const [menu, setMenu] = useState(false);
    const [muted, setMuted] = useState(false);
    const intent = useRef<(intent: GameKeyIntent) => void>(() => {});
    const host = useMemo(
        () =>
            createGameInputHost({
                game,
                send,
                // Only when nothing else on the page took the focus.
                focusGame: () => {
                    const active = document.activeElement;
                    if (!active || active === document.body)
                        frame.current?.focus();
                },
                intent: (next) => intent.current(next),
            }),
        [game]
    );
    const applyMuted = (next: boolean) => {
        setMuted(next);
        host.setMuted(next);
        writeGameStorage(game, "muted", next ? "1" : "0");
    };
    intent.current = (next) => {
        if (next === "menu") setMenu((open) => !open);
        else if (next === "mute") applyMuted(!host.muted);
        else if (!menu) focusGameChat(document);
    };

    useEffect(() => {
        const saved = readGameStorage(game).muted === "1";
        setMuted(saved);
        host.setMuted(saved);
        const receive = (event: MessageEvent) => {
            if (!fromGame(event)) return;
            const data = event.data;
            if (host.receive(data)) return;
            // The game just loaded: tell it where things stand.
            if (data?.type === `${game}:ready`) host.sync();
            // The game's own sound button keeps the page's state in step.
            else if (data?.type === `${game}:storage` && data.key === "muted") {
                setMuted(data.value === "1");
                host.setMuted(data.value === "1", false);
            }
        };
        window.addEventListener("message", receive);
        const stops = [host.watch(document)];
        // Inside the lobby, its chat is the page's chat too.
        try {
            if (window.parent !== window && window.parent.document)
                stops.push(host.watch(window.parent.document, { keys: false }));
        } catch {
            /* another origin's page: nothing to watch */
        }
        return () => {
            window.removeEventListener("message", receive);
            stops.forEach((stop) => stop());
        };
    }, [host]);

    useEffect(() => {
        if (!menu) return;
        host.hold("menu");
        document.exitPointerLock?.();
        return () => host.release("menu");
    }, [menu, host]);

    if (!menu) return null;
    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label={`${title} menu`}
            style={{
                position: "absolute",
                inset: 0,
                display: "grid",
                placeContent: "center",
                background: "rgba(10, 12, 18, 0.72)",
                backdropFilter: "blur(10px)",
                font: "600 15px/1 Inter, system-ui, sans-serif",
            }}
            onClick={(event) => {
                if (event.target === event.currentTarget) setMenu(false);
            }}
        >
            <div style={{ display: "grid", gap: 10, minWidth: 240 }}>
                <p style={{ margin: "0 0 6px", opacity: 0.7 }}>{title}</p>
                <button
                    type="button"
                    autoFocus
                    style={button}
                    onClick={() => setMenu(false)}
                >
                    Resume
                </button>
                <button
                    type="button"
                    aria-pressed={!muted}
                    style={button}
                    onClick={() => applyMuted(!muted)}
                >
                    Sound: {muted ? "Off" : "On"}
                </button>
                <button type="button" style={button} onClick={onLeave}>
                    Back to lobby
                </button>
                <p
                    style={{
                        margin: "6px 0 0",
                        font: "500 12px/1.4 Inter, system-ui, sans-serif",
                        opacity: 0.6,
                    }}
                >
                    Esc menu · Enter chat · M sound
                </p>
            </div>
        </div>
    );
}
