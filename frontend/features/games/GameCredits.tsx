import { useEffect, useRef, useState } from "react";
import {
    groupGameCredits,
    loadGameCredits,
    type GameCredits as Credits,
} from "./gameCredits";
import { holdGamePause } from "./gamePause";

const FONT = "Inter, system-ui, sans-serif";
const linkStyle = { color: "#fff", textUnderlineOffset: 3 };

/**
 * A small "Credits" button over a game and the panel it opens: every
 * third-party file the game ships, with author, source and licence, read
 * from the game's published credits.json. Renders nothing when the game
 * has none. The page owns it, so a game cannot hide or alter its credits.
 */
export default function GameCredits({
    game,
    title,
    onClose,
}: {
    game: string;
    title: string;
    /** Called when the panel closes, e.g. to give the game its focus back. */
    onClose?: () => void;
}) {
    const [credits, setCredits] = useState<Credits | null>(null);
    const [open, setOpen] = useState(false);
    const closeButton = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        const controller = new AbortController();
        void loadGameCredits(game, controller.signal).then((loaded) => {
            if (!controller.signal.aborted) setCredits(loaded);
        });
        return () => controller.abort();
    }, [game]);

    const close = () => {
        setOpen(false);
        onClose?.();
    };

    useEffect(() => {
        if (!open) return;
        closeButton.current?.focus();
        // Escape is the page's key (GameInputLayer): while the panel is
        // open it closes the panel and must not also open the world menu,
        // so it is taken first and goes no further.
        const onKey = (event: KeyboardEvent) => {
            if (event.key !== "Escape") return;
            event.preventDefault();
            event.stopPropagation();
            close();
        };
        window.addEventListener("keydown", onKey, true);
        // A panel over the game holds the page's pause (gamePause.ts).
        const resume = holdGamePause();
        return () => {
            window.removeEventListener("keydown", onKey, true);
            resume();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    if (!credits) return null;
    const groups = groupGameCredits(credits.credits);

    return (
        <>
            <button
                type="button"
                aria-haspopup="dialog"
                aria-expanded={open}
                // A page overlay (docs/games/safe-area.md): the game keeps
                // its HUD clear of the band along the bottom edge.
                data-game-overlay="credits"
                data-game-overlay-edge="bottom"
                onClick={() => {
                    document.exitPointerLock?.();
                    setOpen(true);
                }}
                style={{
                    position: "absolute",
                    // Bottom right: the development tools badge owns the left.
                    right: 12,
                    bottom: 10,
                    border: 0,
                    borderRadius: 999,
                    padding: "6px 10px",
                    font: `500 11px/1 ${FONT}`,
                    color: "rgba(255,255,255,0.7)",
                    background: "rgba(10, 12, 18, 0.45)",
                    cursor: "pointer",
                }}
            >
                Credits
            </button>
            {open && (
                <div
                    // Covers the frame, so it reserves no band.
                    data-game-overlay="credits-panel"
                    onClick={close}
                    style={{
                        position: "absolute",
                        inset: 0,
                        display: "grid",
                        placeItems: "center",
                        padding: 16,
                        background: "rgba(5, 6, 10, 0.6)",
                    }}
                >
                    <section
                        role="dialog"
                        aria-modal="true"
                        aria-label={`Credits for ${title}`}
                        onClick={(event) => event.stopPropagation()}
                        style={{
                            width: "min(560px, 100%)",
                            maxHeight: "min(80vh, 640px)",
                            overflowY: "auto",
                            boxSizing: "border-box",
                            padding: 24,
                            borderRadius: 18,
                            color: "#fff",
                            background: "#15181f",
                            border: "1px solid rgba(255,255,255,0.1)",
                            font: `400 13px/1.5 ${FONT}`,
                        }}
                    >
                        <header
                            style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: 12,
                            }}
                        >
                            <h2
                                style={{
                                    margin: 0,
                                    font: `600 18px/1.2 ${FONT}`,
                                }}
                            >
                                Credits · {title}
                            </h2>
                            <button
                                ref={closeButton}
                                type="button"
                                onClick={close}
                                style={{
                                    border: 0,
                                    borderRadius: 999,
                                    padding: "8px 14px",
                                    font: `600 13px/1 ${FONT}`,
                                    color: "#fff",
                                    background: "rgba(255,255,255,0.12)",
                                    cursor: "pointer",
                                }}
                            >
                                Close
                            </button>
                        </header>
                        {groups.map((group) => (
                            <div key={group.kind}>
                                <h3
                                    style={{
                                        margin: "20px 0 6px",
                                        font: `600 11px/1 ${FONT}`,
                                        letterSpacing: "0.08em",
                                        textTransform: "uppercase",
                                        opacity: 0.6,
                                    }}
                                >
                                    {group.label}
                                </h3>
                                <ul
                                    style={{
                                        margin: 0,
                                        padding: 0,
                                        listStyle: "none",
                                    }}
                                >
                                    {group.credits.map((credit) => (
                                        <li
                                            key={`${credit.title}:${credit.author}`}
                                            style={{ padding: "6px 0" }}
                                        >
                                            <div>
                                                {credit.source ? (
                                                    <a
                                                        href={credit.source}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        style={{
                                                            ...linkStyle,
                                                            fontWeight: 600,
                                                        }}
                                                    >
                                                        {credit.title}
                                                    </a>
                                                ) : (
                                                    <strong>
                                                        {credit.title}
                                                    </strong>
                                                )}
                                                {credit.author &&
                                                    ` by ${credit.author}`}
                                            </div>
                                            <div style={{ opacity: 0.75 }}>
                                                {credit.licenseHref ? (
                                                    <a
                                                        href={
                                                            credit.licenseHref
                                                        }
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        style={linkStyle}
                                                    >
                                                        {credit.licenseName}
                                                    </a>
                                                ) : (
                                                    credit.licenseName
                                                )}
                                                {!credit.confirmed &&
                                                    " (used under its own terms)"}
                                            </div>
                                            {credit.note && (
                                                <div style={{ opacity: 0.55 }}>
                                                    {credit.note}
                                                </div>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                        <p style={{ margin: "20px 0 0", opacity: 0.6 }}>
                            {groups.length
                                ? "Everything else in this game was made for it by Oncyber."
                                : "Everything in this game was made for it by Oncyber."}
                        </p>
                    </section>
                </div>
            )}
        </>
    );
}
