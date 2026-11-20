import { useEffect, useRef, useState, type RefObject } from "react";
import { useRouter } from "next/router";
import { requestLobbyDestinationBack } from "@utils/lobbyDestinationBridge";
import { createGameDeparture, type DepartureReason } from "./gameDeparture";
import {
    announcePartyLeave,
    offerPartyLeave,
    partyLeaveText,
    readPartyLeave,
    type PartyLeaveOffer,
} from "./gamePartyLeave";
import type { GameRoom } from "./gameRoom";
import { readGameMessage } from "./gameContract";

const OFFER_MS = 30_000;
const button = {
    border: 0,
    borderRadius: 999,
    padding: "8px 14px",
    font: "inherit",
    cursor: "pointer",
} as const;

/**
 * Leaving for GamePage: the departure handshake with the game, the trip
 * back to the lobby, and the party's offer to follow. See
 * docs/games/departure.md.
 */
export function useGameDeparture(options: {
    game: string;
    frame: RefObject<HTMLIFrameElement>;
    /** GamePage's way out to the game: the kind goes in the form the game speaks. */
    post(kind: string, data?: object): void;
    ready: boolean;
    room: GameRoom | null;
    inParty: boolean;
    name: string;
}) {
    const router = useRouter();
    const latest = useRef(options);
    latest.current = options;
    const [leaving, setLeaving] = useState(false);
    const [offer, setOffer] = useState<PartyLeaveOffer | null>(null);
    const reason = useRef<DepartureReason>("self");
    const departure = useRef<ReturnType<typeof createGameDeparture>>();
    departure.current ||= createGameDeparture({
        post: (kind, data = {}) => latest.current.post(kind, data),
        ready: () => latest.current.ready,
    });

    useEffect(() => {
        const receive = (event: MessageEvent) => {
            const { frame, game } = latest.current;
            if (
                event.source !== frame.current?.contentWindow ||
                event.origin !== "null"
            )
                return;
            const kind = readGameMessage(event.data?.type, game)?.kind;
            if (kind) departure.current.receive(kind, event.data);
        };
        window.addEventListener("message", receive);
        return () => {
            window.removeEventListener("message", receive);
            departure.current.cancel();
        };
    }, []);

    useEffect(() => {
        if (!offer) return;
        const timer = setTimeout(() => setOffer(null), OFFER_MS);
        return () => clearTimeout(timer);
    }, [offer]);

    const leave = useRef((why: DepartureReason = "self") => {
        if (departure.current.started) return;
        const { room, inParty, name } = latest.current;
        reason.current = why;
        document.exitPointerLock?.();
        setLeaving(true);
        setOffer(null);
        // Tell the party first: the room closes when this page goes away.
        if (inParty && room)
            announcePartyLeave((data) => room.relay(data), name);
        // In a lobby trip the bridge runs `depart` below, then goes back.
        if (requestLobbyDestinationBack()) return;
        void departure.current.stage(why).then(() => router.push("/?lobby=1"));
    });

    return {
        /** Start the trip back. Every exit goes through here. */
        leave: leave.current,
        /** For `registerLobbyDestinationEntry`: the game's last view. */
        depart: () => departure.current.stage(reason.current),
        /** True for a relayed packet that was a party notice, not the game's. */
        relayed(from: string, data: unknown) {
            const notice = readPartyLeave(data);
            if (!notice) return false;
            if (!departure.current.started)
                setOffer((current) => offerPartyLeave(current, from, notice));
            return true;
        },
        leaving,
        offer: offer && !leaving && (
            <div
                role="alertdialog"
                data-game-overlay="party-leave"
                aria-label="Your party is leaving"
                style={{
                    position: "absolute",
                    left: "50%",
                    bottom: 32,
                    transform: "translateX(-50%)",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 8px 8px 18px",
                    borderRadius: 999,
                    background: "rgba(10, 12, 18, 0.82)",
                    backdropFilter: "blur(10px)",
                    font: "600 13px/1 Inter, system-ui, sans-serif",
                    whiteSpace: "nowrap",
                    maxWidth: "calc(100vw - 32px)",
                }}
            >
                <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                    {partyLeaveText(offer)}
                </span>
                <button
                    type="button"
                    onClick={() => leave.current("party")}
                    style={{ ...button, color: "#0b0d12", background: "#fff" }}
                >
                    Follow
                </button>
                <button
                    type="button"
                    onClick={() => {
                        setOffer(null);
                        latest.current.frame.current?.focus();
                    }}
                    style={{
                        ...button,
                        color: "#fff",
                        background: "rgba(255,255,255,0.12)",
                    }}
                >
                    Stay
                </button>
            </div>
        ),
    };
}
