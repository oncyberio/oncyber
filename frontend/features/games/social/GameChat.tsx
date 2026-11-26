import { useEffect, useRef, useState } from "react";
import { GAME_CHAT_ATTRIBUTE } from "../contract/gameInput";
import type { GameSocialView } from "./useGameSocial";
import { gameChrome } from "../interface/gameChrome";
import { GameControl, GameField, GameGlass } from "../interface/gameControls";

/**
 * The page's chat over a game: what was said in the lobby before the trip,
 * then the game's room or the party's room. The game takes no part in it.
 * Hidden while the lobby's party chat covers the page.
 */
export default function GameChat({
    social,
    onClose,
    openRequest = 0,
}: {
    social: GameSocialView;
    /** Changes when the visitor asks for chat with Enter (keys-focus.md). */
    openRequest?: number;
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
    useEffect(() => {
        if (!openRequest) return;
        setOpen(true);
        input.current?.focus();
    }, [openRequest]);
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
                font: gameChrome.font.text,
                color: gameChrome.color.ink,
            }}
        >
            <style>{`html[data-party-chat-open] .game-chat { display: none; }`}</style>
            {open && (
                <GameGlass
                    style={{
                        borderRadius: gameChrome.radius.panel,
                        font: "inherit",
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
                                              borderTop: `1px solid ${gameChrome.color.lineStrong}`,
                                              paddingTop: 6,
                                          }
                                        : {}),
                                }}
                            >
                                <b
                                    style={{
                                        fontWeight: gameChrome.weight.bold,
                                    }}
                                >
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
                            borderTop: `1px solid ${gameChrome.color.line}`,
                        }}
                    >
                        <GameField
                            ref={input}
                            {...{ [GAME_CHAT_ATTRIBUTE]: "" }}
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
                        />
                        <GameControl
                            type="submit"
                            disabled={!connected || !draft.trim()}
                        >
                            Send
                        </GameControl>
                    </form>
                </GameGlass>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <GameControl
                    aria-expanded={open}
                    onClick={() => (open ? close() : setOpen(true))}
                >
                    {open ? "Close chat" : unread ? `Chat · ${unread}` : "Chat"}
                </GameControl>
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
