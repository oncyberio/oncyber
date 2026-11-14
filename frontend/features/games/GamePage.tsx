import { useContext, useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { UserContext } from "@components/context/UserContext";
import {
    resolveLobbyAvatar,
    DEFAULT_LOBBY_AVATAR_URL,
} from "@features/lobby/avatarSelection";
import { LOBBY_GUEST_PORTRAIT } from "@features/lobby/lobbyIdentity";
import {
    failLobbyDestination,
    isLobbyDestination,
    lobbyDestinationPrepared,
    registerLobbyDestinationEntry,
    requestLobbyDestinationBack,
    waitForLobbyDestinationEntry,
} from "@utils/lobbyDestinationBridge";
import {
    readVisitorIdentity as readGameIdentity,
    type VisitorIdentity as GameIdentity,
} from "./gameIdentity";
import { GameRoom, type GamePose, type GameRoomState } from "./gameRoom";
import type { GameEntry } from "./catalog";
import { readGameStorage, writeGameStorage } from "./gameStorage";

const PEER_INTERVAL = 100;

// Per-page guest id: duplicate ids evict each other's sessions in the room.
let guestId: string;
const getGuestId = () =>
    (guestId ||= `guest-${
        globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)
    }`);

function readPose(value: any): GamePose | null {
    const pose = {
        x: value?.x,
        y: value?.y,
        z: value?.z,
        h: value?.h,
        a: value?.a,
    };
    if (!Object.values(pose).every(Number.isFinite)) return null;
    if (
        Math.abs(pose.x) > 1e5 ||
        Math.abs(pose.z) > 1e5 ||
        Math.abs(pose.y) > 1e4
    )
        return null;
    return { ...pose, a: Math.max(0, Math.min(31, Math.round(pose.a))) };
}

// Sandboxed like any outside content (docs/content-host.md): an opaque origin,
// so the game reaches no cookies, storage or account of this page.
const GAME_SANDBOX = "allow-scripts allow-pointer-lock";

/**
 * A game from public/games/<id> in a sandboxed frame. The page owns identity,
 * the shared room, voice and the game's saved values; the game renders
 * everything, avatars included. Messages are `<id>:<kind>` on both sides.
 */
export default function GamePage({ game }: { game: GameEntry }) {
    const {
        id: GAME,
        room: roomLabel,
        title: gameName,
        relay,
        controlsStyle,
        crowdLabel,
    } = game;
    const title = `${game.title} · ${game.tagline}`;
    const { userData, user, authenticated, isAnonymous } =
        useContext(UserContext);
    const router = useRouter();
    const profile = useRef({ userData, user, authenticated, isAnonymous });
    profile.current = { userData, user, authenticated, isAnonymous };
    const frame = useRef<HTMLIFrameElement>(null);
    const [ready, setReady] = useState(false);
    const [error, setError] = useState("");
    const [identity, setIdentity] = useState<GameIdentity | null>(null);
    const [room, setRoom] = useState<GameRoom | null>(null);
    const [roomState, setRoomState] = useState<GameRoomState | null>(null);
    // The frame's origin is opaque, so no target origin can name it; the
    // message goes to this frame's window only, and carries public fields.
    const send = useRef((message: object) =>
        frame.current?.contentWindow?.postMessage(message, "*")
    );
    const fromGame = (event: MessageEvent) =>
        event.source === frame.current?.contentWindow &&
        event.origin === "null";
    const leave = useRef(() => {
        document.exitPointerLock?.();
        if (!requestLobbyDestinationBack()) void router.push("/?lobby=1");
    });

    // Lifecycle and identity: the game says hello, gets the identity, then says ready.
    useEffect(() => {
        let disposed = false;
        let greeted = false;
        let sentIdentity = false;
        let prepared = false;
        let failed = false;
        let approved: GameIdentity | null = null;
        const inJourney = isLobbyDestination();
        let revealed = !inJourney;
        let announcedEntry = false;
        let focusFrame = 0;
        const entryLifetime = new AbortController();
        const post = (type: string, data: object = {}) =>
            send.current({ type: `${GAME}:${type}`, ...data });
        const deliverIdentity = () => {
            if (!disposed && greeted && approved && !sentIdentity) {
                sentIdentity = true;
                post("identity", {
                    ...approved,
                    storage: readGameStorage(GAME),
                });
                setIdentity(approved);
            }
        };
        const announceEntry = () => {
            if (disposed || failed || !prepared || !revealed || announcedEntry)
                return;
            announcedEntry = true;
            focusFrame = requestAnimationFrame(() => {
                focusFrame = 0;
                if (disposed || failed || entryLifetime.signal.aborted) return;
                frame.current?.focus();
                post("entered");
            });
        };
        const disposeGame = () => {
            if (disposed) return;
            disposed = true;
            entryLifetime.abort();
            cancelAnimationFrame(focusFrame);
            post("dispose");
        };
        const unregister = registerLobbyDestinationEntry(async () => {},
        disposeGame);
        if (inJourney) {
            void waitForLobbyDestinationEntry(entryLifetime.signal)
                .then(() => {
                    revealed = true;
                    announceEntry();
                })
                .catch(() => {});
        }
        const fail = (message: string, code: string) => {
            failed = true;
            clearTimeout(watchdog);
            setError(message);
            failLobbyDestination(message, code);
        };
        const receive = (event: MessageEvent) => {
            if (disposed) return;
            if (
                inJourney &&
                event.origin === window.location.origin &&
                event.source === window.parent &&
                event.data?.type === `${GAME}:lobby-identity`
            ) {
                const lobby = readGameIdentity(event.data);
                if (lobby && !sentIdentity) {
                    approved = lobby;
                    deliverIdentity();
                }
                return;
            }
            if (!fromGame(event)) return;
            const type = event.data?.type;
            if (type === `${GAME}:storage`) {
                writeGameStorage(GAME, event.data.key, event.data.value);
            } else if (type === `${GAME}:hello`) {
                greeted = true;
                deliverIdentity();
            } else if (type === `${GAME}:ready` && !prepared && !failed) {
                prepared = true;
                clearTimeout(watchdog);
                setReady(true);
                lobbyDestinationPrepared();
                announceEntry();
            } else if (type === `${GAME}:exit` && greeted) {
                leave.current();
            } else if (type === `${GAME}:error` && greeted && !prepared) {
                fail(
                    `${gameName} couldn’t load. It needs a browser with WebGPU or WebGL 2.`,
                    `${GAME}-load-failed`
                );
            }
        };
        window.addEventListener("message", receive);
        // The lobby may have a newer, unsaved carousel selection than the account.
        if (inJourney)
            window.parent.postMessage(
                { type: `${GAME}:identity-request` },
                window.location.origin
            );
        const fallback = setTimeout(
            async () => {
                if (disposed || approved) return;
                const { userData: account } = profile.current;
                const avatar = await resolveLobbyAvatar(account).catch(() => ({
                    url: DEFAULT_LOBBY_AVATAR_URL,
                }));
                if (disposed || approved) return;
                approved = readGameIdentity({
                    avatarUrl: avatar.url,
                    name:
                        typeof account?.username === "string" &&
                        account.username.trim()
                            ? account.username.slice(0, 120)
                            : "Guest",
                    pfp:
                        typeof account?.avatar === "string" && account.avatar
                            ? account.avatar
                            : LOBBY_GUEST_PORTRAIT,
                }) || {
                    avatarUrl: DEFAULT_LOBBY_AVATAR_URL,
                    name: "Guest",
                    pfp: LOBBY_GUEST_PORTRAIT,
                };
                deliverIdentity();
            },
            inJourney ? 250 : 0
        );
        // A game builds its world and compiles its shaders before the first frame.
        const watchdog = setTimeout(() => {
            if (disposed || prepared) return;
            fail(
                `${gameName} is taking too long to load. Return to the lobby and try again.`,
                `${GAME}-load-timeout`
            );
        }, 120000);
        return () => {
            disposeGame();
            clearTimeout(fallback);
            clearTimeout(watchdog);
            window.removeEventListener("message", receive);
            unregister();
        };
    }, []);

    // One shared room per visit, joined with the identity the game shows.
    useEffect(() => {
        if (!identity || !roomLabel) return;
        const {
            user: account,
            authenticated: signedIn,
            isAnonymous: anon,
        } = profile.current;
        let introduced = "";
        const gameRoom = new GameRoom(
            {
                userId:
                    signedIn && !anon && account?.id
                        ? account.id
                        : getGuestId(),
                name: identity.name,
                pfp: identity.pfp,
                avatarUrl: identity.avatarUrl,
            },
            (state) => {
                setRoomState(state);
                // Relaying games need their own room id to tell packets apart.
                if (relay && state.status === "connected") {
                    const id = gameRoom.sessionId;
                    if (id && id !== introduced) {
                        introduced = id;
                        send.current({ type: `${GAME}:self`, id });
                    }
                }
            },
            roomLabel
        );
        if (relay)
            gameRoom.onRelay((from, data) =>
                send.current({ type: `${GAME}:net`, from, data })
            );
        setRoom(gameRoom);
        void gameRoom.connect();
        const receive = (event: MessageEvent) => {
            if (!fromGame(event)) return;
            if (relay && event.data?.type === `${GAME}:net`) {
                gameRoom.relay(event.data.data);
                return;
            }
            if (event.data?.type !== `${GAME}:pose`) return;
            const pose = readPose(event.data);
            if (pose) gameRoom.setPose(pose);
        };
        window.addEventListener("message", receive);
        const timer = setInterval(
            () =>
                send.current({
                    type: `${GAME}:peers`,
                    players: gameRoom.samplePeers(),
                }),
            PEER_INTERVAL
        );
        return () => {
            clearInterval(timer);
            window.removeEventListener("message", receive);
            send.current({ type: `${GAME}:peers`, players: [] });
            setRoom(null);
            setRoomState(null);
            void gameRoom.close();
        };
    }, [identity]);

    const voiceLabel =
        roomState?.voiceState === "live"
            ? "Mute microphone"
            : roomState?.voiceState === "connecting"
            ? "Connecting voice…"
            : "Talk to people nearby";
    const people =
        roomState?.status === "connected"
            ? `${roomState.players} ${crowdLabel}`
            : roomState?.status === "error"
            ? "Offline"
            : "Connecting…";

    return (
        <main
            style={{
                position: "fixed",
                inset: 0,
                background: "#0b0d12",
                color: "#fff",
            }}
        >
            <iframe
                ref={frame}
                src={`/games/${GAME}/index.html`}
                title={title}
                sandbox={GAME_SANDBOX}
                referrerPolicy="no-referrer"
                allow="gamepad"
                style={{
                    width: "100%",
                    height: "100%",
                    border: 0,
                    display: "block",
                }}
            />
            {ready && !error && roomLabel && (
                <div
                    role="group"
                    aria-label="Game social controls"
                    style={{
                        position: "absolute",
                        top: 84,
                        left: 20,
                        ...controlsStyle,
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: 6,
                        borderRadius: 999,
                        background: "rgba(10, 12, 18, 0.72)",
                        backdropFilter: "blur(10px)",
                        font: "600 13px/1 Inter, system-ui, sans-serif",
                        whiteSpace: "nowrap",
                    }}
                >
                    <span
                        aria-live="polite"
                        style={{ padding: "0 10px", opacity: 0.85 }}
                    >
                        {people}
                    </span>
                    <button
                        type="button"
                        disabled={!room || roomState?.status !== "connected"}
                        aria-pressed={roomState?.voiceState === "live"}
                        title={roomState?.voiceError || voiceLabel}
                        onClick={() => {
                            void room?.toggleVoice();
                            frame.current?.focus();
                        }}
                        style={{
                            border: 0,
                            borderRadius: 999,
                            padding: "8px 14px",
                            font: "inherit",
                            cursor: "pointer",
                            color:
                                roomState?.voiceState === "live"
                                    ? "#0b0d12"
                                    : "#fff",
                            background:
                                roomState?.voiceState === "live"
                                    ? "#ffd23f"
                                    : "rgba(255,255,255,0.12)",
                        }}
                    >
                        {roomState?.voiceState === "live"
                            ? "Mic on"
                            : "Mic off"}
                    </button>
                    <button
                        type="button"
                        onClick={() => leave.current()}
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
                        Lobby
                    </button>
                </div>
            )}
            {roomState?.voiceError && ready && !error && (
                <p
                    role="status"
                    style={{
                        position: "absolute",
                        top: 132,
                        left: 24,
                        margin: 0,
                        font: "500 12px/1.4 Inter, system-ui, sans-serif",
                        opacity: 0.85,
                    }}
                >
                    {roomState.voiceError}
                </p>
            )}
            {error && (
                <div
                    role="status"
                    style={{
                        position: "absolute",
                        inset: 0,
                        display: "grid",
                        placeContent: "center",
                        gap: 18,
                        textAlign: "center",
                        background: "#0b0d12",
                        fontFamily: "Inter, Arial, sans-serif",
                    }}
                >
                    <p>{error}</p>
                    <a
                        href="/?lobby=1"
                        style={{ color: "#fff" }}
                        onClick={(event) => {
                            if (requestLobbyDestinationBack())
                                event.preventDefault();
                        }}
                    >
                        Back to lobby
                    </a>
                </div>
            )}
        </main>
    );
}
