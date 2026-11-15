import { useCallback, useEffect, useRef, useState } from "react";
import GamesService from "@api/games/_api";
import { readGameMessage } from "./gameContract";
import type { GameRoom } from "./gameRoom";
import {
    GameResultLedger,
    isPartyResultPacket,
    partyResultPacket,
    readPartyResultPacket,
    summarizeGameResult,
    type GameResultSummary,
    withSelfName,
} from "./gameResults";

const CARD_MS = 9000;

interface Standing {
    name: string;
    played: number;
    wins: number;
}
interface Card {
    summary: GameResultSummary;
    /** The visitor's own match, or one a party member's page passed on. */
    from: "self" | "party";
    note: string;
    board: Standing[];
}

/**
 * The page's side of match results. Listens for the game's `result`
 * (read with `readGameMessage`), takes one valid result per match, records
 * it for a signed-in visitor, passes a summary to the party's room and
 * shows a short card. Answers the game with `result-status` through the
 * page's one sender, in the form the game speaks.
 */
export function useGameResults(options: {
    game: string;
    /** True for a message that came from this game's frame. */
    fromGame: (event: MessageEvent) => boolean;
    /** GamePage's sender: takes `<id>:kind` and translates it for the game. */
    send: (message: object) => void;
    /** Only a signed-in account has somewhere to keep results. */
    signedIn: () => boolean;
    /** The visitor's name as the page shows it to others. */
    selfName: () => string | undefined;
    /** The party's room, when the visitor is in one with the relay on. */
    partyRoom: GameRoom | null;
}) {
    const { game } = options;
    const live = useRef(options);
    live.current = options;
    const [card, setCard] = useState<Card | null>(null);
    const shown = useRef(new Set<string>());

    useEffect(() => {
        if (!card) return;
        const timer = setTimeout(() => setCard(null), CARD_MS);
        return () => clearTimeout(timer);
    }, [card]);

    useEffect(() => {
        const ledger = new GameResultLedger();
        let disposed = false;
        const timers = new Set<ReturnType<typeof setTimeout>>();
        const status = (match: unknown, value: string, reason = "") =>
            live.current.send({
                type: `${game}:result-status`,
                match: typeof match === "string" ? match.slice(0, 64) : "",
                status: value,
                reason,
            });
        // The relay is rate limited and shared with the game's own packets.
        const tellParty = (summary: GameResultSummary, tries = 12) => {
            const room = live.current.partyRoom;
            if (disposed || !room || tries < 1) return;
            if (room.relay(partyResultPacket(summary))) return;
            const timer = setTimeout(() => {
                timers.delete(timer);
                tellParty(summary, tries - 1);
            }, 250);
            timers.add(timer);
        };
        const receive = async (event: MessageEvent) => {
            if (
                !live.current.fromGame(event) ||
                readGameMessage(event.data?.type, game)?.kind !== "result"
            )
                return;
            const accepted = ledger.accept(event.data.result);
            if (accepted.ok === false) {
                console.warn(`[games] ${game} result refused:`, accepted.error);
                status(event.data.result?.match, "rejected", accepted.error);
                return;
            }
            const result = withSelfName(
                accepted.result,
                live.current.selfName()
            );
            const summary = summarizeGameResult(result);
            shown.current.add(summary.match);
            const base: Card = { summary, from: "self", note: "", board: [] };
            tellParty(summary);
            if (!live.current.signedIn()) {
                setCard({ ...base, note: "Sign in to keep your results" });
                status(result.match, "unrecorded", "SIGNED_OUT");
                return;
            }
            setCard({ ...base, note: "Saving…" });
            try {
                const saved = await GamesService.reportResult({ game, result });
                const { entries } = await GamesService.leaderboard({
                    game,
                }).catch(() => ({ entries: [] as Standing[] }));
                if (disposed) return;
                setCard((current) =>
                    current?.summary.match === summary.match
                        ? {
                              ...base,
                              note: saved.recorded
                                  ? "Saved · unverified"
                                  : "Not saved",
                              board: entries.slice(0, 5),
                          }
                        : current
                );
                status(
                    result.match,
                    saved.recorded ? "recorded" : "unrecorded",
                    saved.reason ?? ""
                );
            } catch (error) {
                console.warn(`[games] ${game} result not saved:`, error);
                if (disposed) return;
                setCard((current) =>
                    current?.summary.match === summary.match
                        ? { ...base, note: "Not saved" }
                        : current
                );
                status(result.match, "unrecorded", "STORAGE_FAILED");
            }
        };
        window.addEventListener("message", receive);
        return () => {
            disposed = true;
            timers.forEach(clearTimeout);
            window.removeEventListener("message", receive);
        };
    }, [game]);

    /**
     * A packet from the party's room. Returns true when it was a page's
     * result packet, which must not be handed to the game.
     */
    const fromParty = useCallback((data: unknown) => {
        if (!isPartyResultPacket(data)) return false;
        const summary = readPartyResultPacket(data);
        if (summary && !shown.current.has(summary.match)) {
            shown.current.add(summary.match);
            // Never over the visitor's own result.
            setCard(
                (current) =>
                    current ?? {
                        summary,
                        from: "party",
                        note: "From your party · unverified",
                        board: [],
                    }
            );
        }
        return true;
    }, []);

    const element = card && (
        <div
            role="status"
            data-game-result={card.from}
            data-game-overlay="result"
            style={{
                position: "absolute",
                left: "50%",
                bottom: 28,
                transform: "translateX(-50%)",
                minWidth: 260,
                maxWidth: "min(92vw, 420px)",
                padding: "14px 18px",
                borderRadius: 18,
                background: "rgba(10, 12, 18, 0.86)",
                backdropFilter: "blur(10px)",
                color: "#fff",
                font: "500 13px/1.4 Inter, system-ui, sans-serif",
                boxShadow: "0 12px 40px rgba(0, 0, 0, 0.35)",
            }}
        >
            <div
                style={{
                    display: "flex",
                    alignItems: "baseline",
                    justifyContent: "space-between",
                    gap: 16,
                }}
            >
                <strong style={{ fontSize: 15 }}>
                    {card.summary.headline}
                </strong>
                <span style={{ fontWeight: 700, whiteSpace: "nowrap" }}>
                    {card.summary.score}
                </span>
            </div>
            <div style={{ opacity: 0.7, marginTop: 2 }}>{card.note}</div>
            {card.board.length > 0 && (
                <ol
                    aria-label="Top players"
                    style={{
                        listStyle: "none",
                        margin: "10px 0 0",
                        padding: "8px 0 0",
                        borderTop: "1px solid rgba(255, 255, 255, 0.14)",
                    }}
                >
                    {card.board.map((entry, index) => (
                        <li
                            key={index}
                            style={{
                                display: "flex",
                                justifyContent: "space-between",
                                gap: 16,
                            }}
                        >
                            <span>
                                {index + 1}. {entry.name}
                            </span>
                            <span style={{ opacity: 0.8 }}>
                                {entry.wins} {entry.wins === 1 ? "win" : "wins"}{" "}
                                · {entry.played} played
                            </span>
                        </li>
                    ))}
                </ol>
            )}
            <button
                type="button"
                aria-label="Dismiss result"
                onClick={() => setCard(null)}
                style={{
                    position: "absolute",
                    top: -8,
                    right: -8,
                    width: 24,
                    height: 24,
                    border: 0,
                    borderRadius: 999,
                    cursor: "pointer",
                    color: "#fff",
                    background: "rgba(40, 44, 54, 0.95)",
                    font: "inherit",
                    lineHeight: 1,
                }}
            >
                ×
            </button>
        </div>
    );
    return { card: element, fromParty };
}
