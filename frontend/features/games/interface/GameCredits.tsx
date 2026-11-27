import { useEffect, useRef, useState } from "react";
import {
    groupGameCredits,
    loadGameCredits,
    type GameCredits as Credits,
} from "./gameCredits";
import { holdGamePause } from "../contract/gamePause";
import { gameChrome } from "./gameChrome";
import {
    ActionButton,
    GameChip,
    GameDialog,
    GameLink,
    GameScrim,
} from "./gameControls";

const FONT = gameChrome.family;

/**
 * A small "Credits" button over a game and the panel it opens: every
 * third-party file the game ships, with author, source and licence, read
 * from the game's published credits.json. Renders nothing when the game
 * has none. The page owns it, so a game cannot hide or alter its credits.
 */
export default function GameCredits({
    game,
    title,
    base,
    onClose,
}: {
    game: string;
    title: string;
    /** The folder the game's frame loads from; the committed build's when not given. */
    base?: string;
    /** Called when the panel closes, e.g. to give the game its focus back. */
    onClose?: () => void;
}) {
    const [credits, setCredits] = useState<Credits | null>(null);
    const [open, setOpen] = useState(false);
    const closeButton = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        const controller = new AbortController();
        void loadGameCredits(game, controller.signal, undefined, base).then(
            (loaded) => {
                if (!controller.signal.aborted) setCredits(loaded);
            }
        );
        return () => controller.abort();
    }, [game, base]);

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
            <GameChip
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
                }}
            >
                Credits
            </GameChip>
            {open && (
                <GameScrim
                    // Covers the frame, so it reserves no band.
                    data-game-overlay="credits-panel"
                    onClick={close}
                >
                    <GameDialog
                        role="dialog"
                        aria-modal="true"
                        aria-label={`Credits for ${title}`}
                        onClick={(event) => event.stopPropagation()}
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
                                    font: `${gameChrome.weight.medium} 18px/1.2 ${FONT}`,
                                }}
                            >
                                Credits · {title}
                            </h2>
                            <ActionButton
                                ref={closeButton}
                                $shape="pill"
                                onClick={close}
                            >
                                Close
                            </ActionButton>
                        </header>
                        {groups.map((group) => (
                            <div key={group.kind}>
                                <h3
                                    style={{
                                        margin: "20px 0 6px",
                                        font: `${gameChrome.weight.medium} ${gameChrome.size.xs}px/1 ${FONT}`,
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
                                                    <GameLink
                                                        href={credit.source}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        style={{
                                                            fontWeight:
                                                                gameChrome
                                                                    .weight
                                                                    .medium,
                                                        }}
                                                    >
                                                        {credit.title}
                                                    </GameLink>
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
                                                    <GameLink
                                                        href={
                                                            credit.licenseHref
                                                        }
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                    >
                                                        {credit.licenseName}
                                                    </GameLink>
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
                    </GameDialog>
                </GameScrim>
            )}
        </>
    );
}
