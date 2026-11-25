import { useEffect, useRef, useState } from "react";
import type { GameSocialView } from "./useGameSocial";

const pill = {
    border: 0,
    borderRadius: 999,
    padding: "8px 14px",
    font: "inherit",
    cursor: "pointer",
    color: "#fff",
    background: "rgba(255,255,255,0.12)",
} as const;

/**
 * The page's chat over a game: what was said in the lobby before the trip,
 * then the game's room or the party's room. The game takes no part in it.
 * Hidden while the lobby's party chat covers the page.
 */
export default function GameChat({
    social,
    onClose,
}: {
    social: GameSocialView;
    /** Give the keyboard back to the game. */
    onClose(): void;
}) {
    const { messages, talking, connected } = social.state;
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState("");
    const [seen, setSeen] = useState(0);
    const log = useRef<HTMLOListElement>(null);
    const input = useRef<HTMLInputElement>(null);
    const live = messages.filter((message) => !message.carried).length;
    useEffect(() => {
        if (!open) return;
        setSeen(live);
        if (log.current) log.current.scrollTop = log.current.scrollHeight;
    }, [open, messages.length]);
    useEffect(() => {
        if (open) input.current?.focus();
    }, [open]);
    const close = () => {
        setOpen(false);
        onClose();
    };
    const unread = open ? 0 : Math.max(0, live - seen);
    const talkers = talking.map(social.nameOf);
    const firstLive = messages.findIndex((message) => !message.carried);
    return (
        <section
            className="game-chat"
            aria-label="Chat"
            data-game-overlay="chat"
            style={{
                position: "absolute",
                left: 20,
                bottom: 20,
                width: "min(340px, calc(100vw - 40px))",
                display: "grid",
                gap: 8,
                font: "500 13px/1.35 Inter, system-ui, sans-serif",
                color: "#fff",
            }}
        >
            <style>{`html[data-party-chat-open] .game-chat { display: none; }`}</style>
            {open && (
                <div
                    style={{
                        borderRadius: 14,
                        background: "rgba(10, 12, 18, 0.78)",
                        backdropFilter: "blur(10px)",
                        overflow: "hidden",
                    }}
                >
                    <ol
                        ref={log}
                        aria-live="polite"
                        style={{
                            listStyle: "none",
                            margin: 0,
                            padding: "10px 12px",
                            maxHeight: 220,
                            overflowY: "auto",
                            display: "grid",
                            gap: 6,
                        }}
                    >
                        {!messages.length && (
                            <li style={{ opacity: 0.6 }}>
                                {connected
                                    ? "Say hello to everyone here."
                                    : "Connecting…"}
                            </li>
                        )}
                        {messages.map((message, index) => (
                            <li
                                key={message.id}
                                data-carried={message.carried || undefined}
                                style={{
                                    opacity: message.carried ? 0.62 : 1,
                                    overflowWrap: "anywhere",
                                    ...(index === firstLive && index > 0
                                        ? {
                                              borderTop:
                                                  "1px solid rgba(255,255,255,0.16)",
                                              paddingTop: 6,
                                          }
                                        : {}),
                                }}
                            >
                                <b style={{ fontWeight: 700 }}>
                                    {message.self ? "You" : message.name}
                                </b>{" "}
                                {message.text}
                            </li>
                        ))}
                    </ol>
                    <form
                        onSubmit={(event) => {
                            event.preventDefault();
                            if (social.sendChat(draft)) setDraft("");
                        }}
                        style={{
                            display: "flex",
                            gap: 6,
                            padding: 8,
                            borderTop: "1px solid rgba(255,255,255,0.1)",
                        }}
                    >
                        <input
                            ref={input}
                            value={draft}
                            maxLength={500}
                            disabled={!connected}
                            aria-label="Message"
                            placeholder={connected ? "Message" : "Connecting…"}
                            onChange={(event) => setDraft(event.target.value)}
                            onKeyDown={(event) => {
                                // The game must not also act on these keys.
                                event.stopPropagation();
                                if (event.key === "Escape") close();
                            }}
                            style={{
                                flex: 1,
                                minWidth: 0,
                                border: 0,
                                borderRadius: 999,
                                padding: "8px 12px",
                                font: "inherit",
                                color: "#fff",
                                background: "rgba(255,255,255,0.12)",
                                outline: "none",
                            }}
                        />
                        <button
                            type="submit"
                            disabled={!connected || !draft.trim()}
                            style={pill}
                        >
                            Send
                        </button>
                    </form>
                </div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => (open ? close() : setOpen(true))}
                    style={{
                        ...pill,
                        fontWeight: 600,
                        background: "rgba(10, 12, 18, 0.72)",
                        backdropFilter: "blur(10px)",
                    }}
                >
                    {open ? "Close chat" : unread ? `Chat · ${unread}` : "Chat"}
                </button>
                {talkers.length > 0 && (
                    <span role="status" style={{ opacity: 0.85 }}>
                        {talkers.slice(0, 2).join(", ")}
                        {talkers.length > 2
                            ? ` +${talkers.length - 2}`
                            : ""}{" "}
                        talking
                    </span>
                )}
            </div>
        </section>
    );
}
