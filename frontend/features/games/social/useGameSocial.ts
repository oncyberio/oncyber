import { useEffect, useRef, useState, type MutableRefObject } from "react";
import {
    isLobbyDestination,
    waitForLobbyDestinationEntry,
} from "@utils/lobbyDestinationBridge";
import {
    GameSocial,
    readSocialHandoff,
    SOCIAL_HANDOFF,
    SOCIAL_REQUEST,
    type GameSocialState,
} from "./gameSocial";
import type { GameRoom } from "../room/gameRoom";
import { readGameMessage } from "../contract/gameContract";

const TICK_MS = 100;

/**
 * Chat and voice for one visit to a game page: carried over from the lobby,
 * running in whichever room the page is in, and outliving a change of room.
 * The game frame hears `<id>:talking` and may send `<id>:voice`.
 */
export function useGameSocial(options: {
    game: string;
    /** Posts a message to the game frame. */
    send: MutableRefObject<(message: object) => void>;
    /** True for messages that came from the game frame. */
    fromGame(event: MessageEvent): boolean;
    selfName: string | undefined;
    room: GameRoom | null;
}) {
    const { game, send, room } = options;
    const fromGame = useRef(options.fromGame);
    fromGame.current = options.fromGame;
    const social = useRef<GameSocial>();
    social.current ||= new GameSocial({
        selfName: options.selfName || "You",
        toGame: (kind, data) =>
            send.current({ type: `${game}:${kind}`, ...data }),
    });
    if (options.selfName) social.current.selfName = options.selfName;
    const [state, setState] = useState<GameSocialState>(social.current.state);
    useEffect(() => social.current.subscribe(setState), []);

    // The lobby around this page hands over its chat and voice state, at
    // once for the history and again at the reveal for how the visitor left.
    useEffect(() => {
        if (!isLobbyDestination()) return social.current.arrive();
        const lifetime = new AbortController();
        const request = () =>
            window.parent.postMessage(
                { type: SOCIAL_REQUEST },
                window.location.origin
            );
        const receive = (event: MessageEvent) => {
            if (
                event.source === window.parent &&
                event.origin === window.location.origin &&
                event.data?.type === SOCIAL_HANDOFF
            )
                social.current.carry(readSocialHandoff(event.data));
        };
        window.addEventListener("message", receive);
        request();
        void waitForLobbyDestinationEntry(lifetime.signal)
            .then(() => {
                request();
                social.current.arrive();
            })
            .catch(() => {});
        return () => {
            lifetime.abort();
            window.removeEventListener("message", receive);
        };
    }, []);

    // Poses for spatial voice, from the game.
    useEffect(() => {
        const receive = (event: MessageEvent) => {
            if (
                fromGame.current(event) &&
                readGameMessage(event.data?.type, game)?.kind === "voice"
            )
                social.current.setVoicePoses(event.data);
        };
        window.addEventListener("message", receive);
        return () => window.removeEventListener("message", receive);
    }, [game]);

    useEffect(() => {
        if (!room) return;
        room.social = social.current;
        social.current.attach(room);
        const timer = setInterval(() => social.current.tick(), TICK_MS);
        return () => {
            clearInterval(timer);
            room.social = null;
            social.current.attach(null);
        };
    }, [room]);

    return {
        state,
        sendChat: (text: string) => social.current.send(text),
        /** A room member's name, for "… is talking". */
        nameOf: (id: string) =>
            room && id === room.sessionId
                ? "You"
                : room?.peerName(id) || "Someone",
    };
}

export type GameSocialView = ReturnType<typeof useGameSocial>;
