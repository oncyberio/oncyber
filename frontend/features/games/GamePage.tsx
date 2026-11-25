import { useContext, useEffect, useRef, useState } from "react";
import { fromFrame } from "./frameOrigin";
import {
    CONTENT_PERMISSIONS,
    CONTENT_SANDBOX,
} from "@features/content-host/security";
import { UserContext } from "@components/context/UserContext";
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
import { accountIdentity } from "./accountIdentity";
import { GameRoom, type GamePose, type GameRoomState } from "./gameRoom";
import type { GameEntry } from "./catalog";
import GameCredits from "./GameCredits";
import { frameBase, type GameFrame } from "./gameRelease";
import {
    developmentParty,
    gameParty,
    partyRoomLabel,
    type GameParty,
} from "./gameParty";
import { readLobbyGroupCohort } from "@utils/lobbyGroupContext";
import {
    contractNotice,
    contractSupport,
    enterMessage,
    gameMessageTypes,
    gameName as nameForGame,
    gameTrip,
    readGameDeclaration,
    readGameMessage,
    tripKey,
    type GameDialect,
    type GameRoomMember,
} from "./gameContract";
import { useGameSocial } from "./useGameSocial";
import GameChat from "./GameChat";
import GameInputLayer from "./GameInputLayer";
import { bridgeGameSafeArea, CONTROLS_PLACEMENT } from "./safeArea";
import { useGameDeparture } from "./useGameDeparture";
import { readPartyLeave } from "./gamePartyLeave";
import { MatchBridge, matchSeatKey, type PageRoster } from "./gameMatch";
import { useGameResults } from "./useGameResults";
import { GameLoadingCover, useGameLoading } from "./GameLoadingCover";
import { useGamePause } from "./gamePause";
import { GameSoundButton, useGameAudio } from "./GameSound";
import { attachSavedData, signedInAccount } from "./savedDataBridge";
import { createRemoteSavedStore } from "./savedDataRemote";
import { joinedParty, rememberGameParty } from "./gamePartyJoin";
import { useGameHealth } from "./gameHealth";
import { gameChrome } from "./gameChrome";

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

/**
 * A game from public/games/<id> in a sandboxed frame. The page owns identity,
 * the shared room, voice and the game's saved values; the game renders
 * everything, avatars included. Messages are `oncyber:game:<kind>` on both
 * sides (docs/games/contract.md; every kind is listed in
 * games/runtime/messages.json); a build from before that still says
 * `<id>:<kind>` and is answered the same way.
 */
export default function GamePage({
    game,
    frame: gameFrame,
}: {
    game: GameEntry;
    /** Where the frame loads from; the committed build when not given. */
    frame?: GameFrame;
}) {
    const {
        id: GAME,
        room: sharedRoom,
        title: gameName,
        controlsStyle,
        crowdLabel,
    } = game;
    const title = `${game.title} · ${game.tagline}`;
    const { userData, user, authenticated, isAnonymous } =
        useContext(UserContext);
    const profile = useRef({ userData, user, authenticated, isAnonymous });
    profile.current = { userData, user, authenticated, isAnonymous };
    const frame = useRef<HTMLIFrameElement>(null);
    const documentGeneration = useRef(0);
    const accountId = signedInAccount(profile.current);
    const [ready, setReady] = useState(false);
    const [error, setError] = useState("");
    const [identity, setIdentity] = useState<GameIdentity | null>(null);
    // A party that travelled here together plays in a room of its own,
    // with the relay on so its members can run matches between them.
    const [party, setParty] = useState<GameParty | null>(null);
    const partyRef = useRef<GameParty | null>(null);
    // A game with no room of its own still has one for chat and voice; the
    // game hears nothing of who is in it.
    const roomLabel = party
        ? partyRoomLabel(GAME, party.id)
        : sharedRoom ?? game.socialRoom ?? null;
    const playsInRoom = !!(party || sharedRoom);
    const relay = party ? true : game.relay;
    const [room, setRoom] = useState<GameRoom | null>(null);
    const [roomState, setRoomState] = useState<GameRoomState | null>(null);
    // The frame's origin is opaque, so no target origin can name it; the
    // message goes to this frame's window only, and carries public fields.
    // The form the game greeted with; until then both forms go out.
    const dialect = useRef<GameDialect | null>(null);
    // The one way out to the game. A message typed `<id>:<kind>` (how the
    // page's helpers name kinds) goes out in the form the game speaks, so a
    // contract game only ever hears `oncyber:game:<kind>`.
    const send = useRef((message: object) => {
        const target = frame.current?.contentWindow;
        if (!target) return;
        const kind = readGameMessage((message as any)?.type, GAME)?.kind;
        if (!kind) return target.postMessage(message, "*");
        for (const type of gameMessageTypes(GAME, kind, dialect.current))
            target.postMessage({ ...message, type }, "*");
    });
    const postGame = useRef((kind: string, data: object = {}) =>
        send.current({ type: `${GAME}:${kind}`, ...data })
    );
    const kindOf = (event: MessageEvent) =>
        readGameMessage(event.data?.type, GAME)?.kind;
    // The party as the game sees it: the lobby's members plus the party
    // room's facts (the visitor's room id, who has arrived, and the room's
    // roster: arrival order, the host, seats, who dropped).
    const roomFacts = useRef({
        self: "",
        arrived: [] as GameRoomMember[],
        roster: null as PageRoster | null,
    });
    const sentIdentityRef = useRef(false);
    const tripNow = () =>
        gameTrip(
            partyRef.current,
            partyRef.current ? partyRoomLabel(GAME, partyRef.current.id) : "",
            roomFacts.current.self,
            roomFacts.current.arrived,
            roomFacts.current.roster
        );
    const lastTrip = useRef("");
    const announceTrip = useRef((force = false) => {
        const trip = tripNow();
        if (!sentIdentityRef.current) return;
        if (!force && tripKey(trip) === lastTrip.current) return;
        lastTrip.current = tripKey(trip);
        postGame.current("party", { party: trip });
    });
    const fromGame = (event: MessageEvent) => fromFrame(event, frame.current);
    // Progress and the first frame (gameLoading.ts): a cover until the game
    // has drawn. The page's menu pauses a solo game under it (gamePause.ts).
    const loading = useGameLoading(GAME, frame);
    useGamePause(GAME, frame, (message) => send.current(message));
    // Match results: validated, recorded and shown by the page.
    const results = useGameResults({
        game: GAME,
        // A registered game's results are not recorded yet.
        recorded: !game.registered,
        fromGame,
        send: (message) => send.current(message),
        signedIn: () =>
            Boolean(
                profile.current.authenticated &&
                    !profile.current.isAnonymous &&
                    profile.current.user?.id
            ),
        selfName: () => identity?.name,
        roster: () => roomFacts.current.roster,
        partyRoom: party && room ? room : null,
    });
    // What breaks and how fast it runs on real visits (gameHealth.ts): it
    // only listens, and times the first frame by the loading signal above.
    useGameHealth(GAME, frame, gameFrame?.release);
    // Chat and voice are the page's: carried from the lobby, in this room.
    const social = useGameSocial({
        game: GAME,
        send,
        fromGame,
        selfName: identity?.name,
        room,
    });
    // Sound (docs/games/sound.md): the page's one setting, the first
    // gesture, and the game lowered while someone else in the room talks.
    useGameAudio({
        game: GAME,
        fromGame,
        send: (message) => send.current(message),
        speaking: !!social.state?.talking?.some((id) => id !== room?.sessionId),
    });
    // Enter is the page's key for chat (docs/games/keys-focus.md).
    const [chatRequest, setChatRequest] = useState(0);
    // Every way out asks the game for its last frame first (gameDeparture.ts).
    const departure = useGameDeparture({
        game: GAME,
        frame,
        post: (kind, data) => postGame.current(kind, data),
        ready,
        room,
        inParty: !!party,
        name: identity?.name || "Someone",
    });
    const leave = useRef(departure.leave);

    // The game keeps its HUD clear of whatever this page floats over it.
    useEffect(
        () =>
            bridgeGameSafeArea(frame.current, GAME, {
                post: (kind, data) => postGame.current(kind, data),
                kindOf: (data: any) => readGameMessage(data?.type, GAME)?.kind,
            }),
        []
    );

    // Lifecycle and identity: the game says hello, gets the identity, then says ready.
    useEffect(() => {
        let disposed = false;
        let greeted = false;
        let sentIdentity = false;
        let sentEnter = false;
        // What a contract game declared in hello; null waits as before.
        let walkable: boolean | null = null;
        let prepared = false;
        let failed = false;
        let contractReported = false;
        let approved: GameIdentity | null = null;
        const inJourney = isLobbyDestination();
        let revealed = !inJourney;
        let announcedEntry = false;
        let focusFrame = 0;
        const entryLifetime = new AbortController();
        const post = postGame.current;
        const announceParty = (next: GameParty | null) => {
            partyRef.current = next;
            setParty(next);
            // So the lobby can offer the way back in (gamePartyJoin.ts).
            if (next) rememberGameParty(GAME, next.id);
            announceTrip.current();
        };
        // The page's part of the lifecycle's enter() data, once per visit:
        // with the identity on a direct visit, with the lobby's final view
        // on a trip.
        const sendEnter = (view?: unknown) => {
            if (sentEnter || !sentIdentity || dialect.current === "legacy")
                return;
            sentEnter = true;
            post("enter", enterMessage(inJourney, view, tripNow()));
        };
        announceParty(
            gameParty(readLobbyGroupCohort()) ??
                joinedParty(window.location.search) ??
                developmentParty(window.location.search)
        );
        const deliverIdentity = () => {
            if (!disposed && greeted && approved && !sentIdentity) {
                sentIdentity = sentIdentityRef.current = true;
                // The name as a game gets it (gameContract.ts): the same
                // length the runtime keeps.
                post("identity", {
                    ...approved,
                    name: nameForGame(approved.name) || approved.name,
                });
                announceTrip.current(true);
                if (!inJourney) sendEnter();
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
                sendEnter();
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
        // Just before the lobby reveals the game it sends its final
        // third-person view. The game gets it in `enter` (`arrival` for
        // older builds), may stand the visitor in the same framing and
        // answers `arrival-ready`. Games that declared they aren't walkable
        // are revealed at once; silent ones after a short wait.
        let arrivalStaged: (() => void) | null = null;
        const stageArrival = (options: { travelView?: unknown }) =>
            new Promise<void>((resolve) => {
                const timer = setTimeout(done, 1500);
                function done() {
                    clearTimeout(timer);
                    arrivalStaged = null;
                    resolve();
                }
                arrivalStaged = done;
                const view = options?.travelView as
                    | { peers?: unknown }
                    | undefined;
                // The trip's final view carries the members the lobby showed.
                if (partyRef.current && !partyRef.current.late && view?.peers) {
                    const next = gameParty(partyRef.current.id, view.peers);
                    if (next) announceParty(next);
                }
                sendEnter(view);
                if (dialect.current !== "contract")
                    post("arrival", { view: view ?? null });
                if (dialect.current === "contract" && walkable === false)
                    done();
            });
        const unregister = registerLobbyDestinationEntry(
            async () => {},
            disposeGame,
            { prepareReveal: stageArrival, depart: departure.depart }
        );
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
            const message = readGameMessage(event.data?.type, GAME);
            const type = message?.kind;
            if (type === "arrival-ready") {
                arrivalStaged?.();
            } else if (type === "hello") {
                if (message.dialect === "contract") {
                    // The contract the build was made for decides whether
                    // it runs here (gameContract.ts, `contractSupport`).
                    const declared = readGameDeclaration(event.data);
                    const support = contractSupport(declared.contract);
                    if (frame.current) {
                        frame.current.dataset.contract = `${declared.contract}`;
                        frame.current.dataset.contractSupport = support;
                    }
                    if (support !== "current" && !contractReported) {
                        contractReported = true;
                        console.warn(contractNotice(GAME, declared.contract));
                    }
                    if (support === "too-old" || support === "too-new") {
                        if (!failed && !prepared)
                            fail(
                                `${gameName} was built for another version of Oncyber and can’t run here yet.`,
                                `${GAME}-contract-${support}`
                            );
                        return;
                    }
                    walkable = declared.walkable;
                }
                greeted = true;
                dialect.current = message.dialect;
                deliverIdentity();
            } else if (type === "ready" && !prepared && !failed) {
                prepared = true;
                clearTimeout(watchdog);
                setReady(true);
                lobbyDestinationPrepared();
                announceEntry();
            } else if (type === "exit" && greeted) {
                leave.current();
            } else if (type === "error" && greeted && !prepared) {
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
                const next = await accountIdentity(profile.current.userData);
                if (disposed || approved) return;
                approved = next;
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

    // Saved data: the keys the game declared (docs/games/saved-data.md).
    useEffect(
        () =>
            attachSavedData({
                game: GAME,
                remote: createRemoteSavedStore(),
                documentId: () => documentGeneration.current,
                fromGame,
                send: (message) => send.current(message),
                account: () => signedInAccount(profile.current),
                // A party's values are kept under the trip's id: the same
                // id the game reads from the trip in `enter` and `party`.
                party: () => tripNow()?.id ?? null,
            }),
        [GAME, accountId, gameFrame?.src]
    );

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
                matchKey: party ? matchSeatKey() : undefined,
            },
            (state) => {
                setRoomState(state);
                // Relaying games need their own room id to tell packets apart.
                if (relay && state.status === "connected") {
                    const id = gameRoom.sessionId;
                    if (id && id !== introduced) {
                        introduced = id;
                        postGame.current("self", { id });
                        if (party) {
                            roomFacts.current.self = id;
                            announceTrip.current();
                        }
                    }
                }
            },
            roomLabel
        );
        if (relay)
            gameRoom.onRelay(
                (from, data) =>
                    departure.relayed(from, data) ||
                    results.fromParty(data, from) ||
                    postGame.current("net", { from, data })
            );
        // A party's room also carries its roster and the match channel. The
        // roster is part of the trip: the game hears it through `party`.
        const match = party
            ? new MatchBridge((kind, data) => {
                  if (kind !== "roster") return postGame.current(kind, data);
                  roomFacts.current.roster = (data as any).roster ?? null;
                  announceTrip.current();
              })
            : null;
        gameRoom.onRoom = (joined) => match?.attach(joined);
        setRoom(gameRoom);
        void gameRoom.connect();
        const receive = (event: MessageEvent) => {
            if (!fromGame(event)) return;
            const kind = kindOf(event);
            if (match && kind === "match") {
                match.send(event.data);
                return;
            }
            if (relay && kind === "net") {
                // Party notices are the page's to send, not the game's.
                if (!readPartyLeave(event.data.data))
                    gameRoom.relay(event.data.data);
                return;
            }
            if (kind !== "pose") return;
            const pose = readPose(event.data);
            if (pose) gameRoom.setPose(pose);
        };
        window.addEventListener("message", receive);
        const timer = setInterval(() => {
            const players = gameRoom.samplePeers();
            if (playsInRoom) postGame.current("peers", { players });
            // In a party's room, the roster is who has arrived.
            if (party) {
                roomFacts.current.arrived = players;
                announceTrip.current();
            }
        }, PEER_INTERVAL);
        return () => {
            clearInterval(timer);
            window.removeEventListener("message", receive);
            postGame.current("peers", { players: [] });
            roomFacts.current = { self: "", arrived: [], roster: null };
            setRoom(null);
            setRoomState(null);
            void gameRoom.close();
        };
    }, [identity, roomLabel, relay, playsInRoom]);

    const voiceLabel =
        roomState?.voiceState === "live"
            ? "Mute microphone"
            : roomState?.voiceState === "connecting"
            ? "Connecting voice…"
            : "Talk to people nearby";
    const people =
        roomState?.status === "connected"
            ? `${roomState.players} ${party ? "in your party" : crowdLabel}`
            : roomState?.status === "error"
            ? "Offline"
            : "Connecting…";

    return (
        <main
            style={{
                position: "fixed",
                inset: 0,
                background: gameChrome.color.frame,
                color: gameChrome.color.ink,
            }}
        >
            <iframe
                ref={frame}
                src={gameFrame?.src ?? `/games/${GAME}/index.html`}
                data-release={gameFrame?.release ?? undefined}
                title={title}
                sandbox={CONTENT_SANDBOX}
                onLoad={() => {
                    documentGeneration.current++;
                }}
                referrerPolicy="no-referrer"
                allow={`${CONTENT_PERMISSIONS}; gamepad *`}
                {...({ credentialless: "" } as any)}
                style={{
                    width: "100%",
                    height: "100%",
                    border: 0,
                    display: "block",
                }}
            />
            {!error && <GameLoadingCover state={loading} title={gameName} />}
            {departure.offer}
            {ready && !error && roomLabel && !departure.leaving && (
                <div
                    role="group"
                    aria-label="Game social controls"
                    data-game-overlay="controls"
                    style={{
                        position: "absolute",
                        ...CONTROLS_PLACEMENT,
                        ...controlsStyle,
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: 6,
                        borderRadius: gameChrome.radius.pill,
                        background: gameChrome.color.bar,
                        backdropFilter: "blur(10px)",
                        font: gameChrome.font.control,
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
                            borderRadius: gameChrome.radius.pill,
                            padding: "8px 14px",
                            font: "inherit",
                            cursor: "pointer",
                            color:
                                roomState?.voiceState === "live"
                                    ? gameChrome.color.onInk
                                    : gameChrome.color.ink,
                            background:
                                roomState?.voiceState === "live"
                                    ? gameChrome.color.on
                                    : gameChrome.color.control,
                        }}
                    >
                        {roomState?.voiceState === "live"
                            ? "Mic on"
                            : "Mic off"}
                    </button>
                    <GameSoundButton onDone={() => frame.current?.focus()} />
                    <button
                        type="button"
                        onClick={() => leave.current()}
                        style={{
                            border: 0,
                            borderRadius: gameChrome.radius.pill,
                            padding: "8px 14px",
                            font: "inherit",
                            cursor: "pointer",
                            color: gameChrome.color.ink,
                            background: gameChrome.color.control,
                        }}
                    >
                        Lobby
                    </button>
                </div>
            )}
            {ready && !error && roomLabel && (
                <GameChat
                    social={social}
                    openRequest={chatRequest}
                    onClose={() => frame.current?.focus()}
                />
            )}
            {ready && !error && (
                <GameCredits
                    game={GAME}
                    title={game.title}
                    base={frameBase(GAME, gameFrame)}
                    onClose={() => frame.current?.focus()}
                />
            )}
            {roomState?.voiceError && ready && !error && (
                <p
                    role="status"
                    data-game-overlay="voice-error"
                    style={{
                        position: "absolute",
                        top: 132,
                        left: 24,
                        margin: 0,
                        font: gameChrome.font.note,
                        opacity: 0.85,
                    }}
                >
                    {roomState.voiceError}
                </p>
            )}
            {!error && (
                <GameInputLayer
                    game={GAME}
                    title={gameName}
                    frame={frame}
                    send={send.current}
                    fromGame={fromGame}
                    onLeave={leave.current}
                    onChat={() => setChatRequest((n) => n + 1)}
                />
            )}
            {ready && !error && results.card}
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
                        background: gameChrome.color.frame,
                        fontFamily: gameChrome.family,
                    }}
                >
                    <p>{error}</p>
                    <a
                        href="/?lobby=1"
                        style={{ color: gameChrome.color.ink }}
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
