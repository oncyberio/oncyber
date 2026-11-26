/**
 * The frame a world runs in, and everything said across it
 * (docs/plans/framed-worlds.md). The page's side of the bridge: it answers
 * the world's hello with its visitor, holds the room, voice and live
 * channels the world is relayed, and passes on what the world asks of the
 * page (./FramedWorld decides each answer).
 */
import { useEffect, useRef, useState } from "react";
import { BEAT_EVERY_MS, createStallWatch } from "@features/games/frameStall";
import { RoomVoice } from "@features/games/roomVoice";
import { useGameLoading } from "@features/games/GameLoadingCover";
import { fromFrame, frameTarget } from "@features/games/frameOrigin";
import {
    GAME_MESSAGE_PREFIX,
    readGameMessage,
} from "@features/games/gameContract";
import { SCRIPT_MESSAGE } from "@features/world-scripts/basics";
import { deferred, liveSpace } from "@utils/liveSpace";
import { sayLoadStage } from "@utils/loadTimings";
import { relayLobbyDestination } from "@utils/lobbyDestinationBridge";
import { WORLD_GAME_ID } from "./worldDocument";
import type { RoomIdentity } from "./roomRelay";
import {
    readDock,
    readDockConnection,
    VOICE_ACTION,
    type DockAction,
    type DockConnection,
} from "./worldDock";
import { hostWorldRoom, type HostedRoom } from "./worldRoomHost";
import { hostWorldVoice, type WorldVoiceView } from "./worldVoiceHost";
import { hostWorldLive } from "./worldLiveHost";
import { LIVE_MESSAGE } from "./relayedLive";
import { setFramedWorldLock } from "./worldPointer";
import {
    WORLD_PERMISSIONS,
    WORLD_SANDBOX,
    type WorldFrame,
} from "./worldFrame";

/**
 * A world still loading that has said nothing for this long is taken as
 * failed. A big world on a slow line may load for longer than this; it
 * reports its progress as it goes, and each report starts the wait again.
 */
export const WORLD_LOAD_TIMEOUT_MS = 120_000;
/**
 * How long after the page learns its visitor a world that asked earlier
 * has to ask again, before it is taken to have given up. A waiting world
 * asks every 250 ms.
 */
export const LATE_VISITOR_MS = 1500;
/**
 * How long after a world saved a setting through the page the visitor's
 * change that follows is taken as the world's own doing.
 */
export const KEEP_VISITOR_MS = 5000;

/** What the page's dock does to the world in the frame. */
export interface WorldControls {
    press(id: string): void;
    toggleVoice(): void;
    /** Any other message to the world. */
    send(kind: string, data: object): void;
    /**
     * The visitor is about to change because of something the world itself
     * did (it saved a setting through the page): the world already has it,
     * so it is not started again for it.
     */
    keepVisitor(): void;
}

export default function WorldFrameView({
    title,
    spaceId,
    src,
    frame,
    visitor,
    onFailed,
    onLoaded,
    onVisitorChanged,
    onLocation,
    onTravel,
    identify,
    moderates,
    account,
    onDock,
    onVoice,
    onStalled,
    onLink,
    onFile,
    onSignIn,
    onScript,
    controls,
}: {
    title: string;
    /** The space this page opened. */
    spaceId: string;
    src: string;
    frame: WorldFrame;
    visitor: { message: object } | null;
    onFailed(): void;
    /** The world has drawn. */
    onLoaded(): void;
    /** The world was told one visitor and the page now has another. */
    onVisitorChanged(): void;
    /** The world's address changed, and the title it gives the place. */
    onLocation(href: unknown, title: unknown): void;
    /** The world asks to go somewhere else on the site. */
    onTravel(href: unknown): void;
    /** Who the page joins a room as, for the world's room. */
    identify(label: string): Promise<RoomIdentity>;
    /** Whether the page's visitor moderates the space with this label. */
    moderates(label: unknown): Promise<boolean>;
    /** An account call the world asks the page to make. */
    account(name: unknown, data: unknown): Promise<unknown>;
    /** The buttons the world has for the dock. */
    onDock(actions: DockAction[], connection: DockConnection | null): void;
    /** The page's voice in the world's room; null while it is in none. */
    onVoice(voice: WorldVoiceView | null): void;
    /** The world made a file and asks for it to be saved. */
    onFile(message: unknown): void;
    /** The world asks for the sign-in dialog. */
    onSignIn(): void;
    /** What the world's script runtime says (features/world-scripts). */
    onScript(kind: string, data: unknown): void;
    /** The world asks for a link to be opened in a new tab. */
    onLink(href: unknown): void;
    /** The world went silent after it had drawn, or came back. */
    onStalled(stalled: boolean): void;
    controls: { current: WorldControls | null };
}) {
    const element = useRef<HTMLIFrameElement>(null);
    const loading = useGameLoading(WORLD_GAME_ID, element, frame.world);
    const failed = useRef(onFailed);
    failed.current = onFailed;
    const recovered = useRef(onLoaded);
    recovered.current = onLoaded;

    // The world says hello until the page answers with its visitor: public
    // fields only (./worldVisitor). The world starts once it has them.
    const present = useRef(visitor);
    present.current = visitor;
    const handlers = useRef({
        onLocation,
        onTravel,
        identify,
        moderates,
        account,
        onDock,
        onVoice,
        onStalled,
        onLink,
        onFile,
        onSignIn,
        onScript,
    });
    handlers.current = {
        onLocation,
        onTravel,
        identify,
        moderates,
        account,
        onDock,
        onVoice,
        onStalled,
        onLink,
        onFile,
        onSignIn,
        onScript,
    };
    // Which of the world's documents the page is talking to. A document
    // that reloads inside the frame (new code after a deploy, a visitor
    // put out of a room) says hello under a new name: everything the page
    // held for the old one (its room, its voice, its live channels, the
    // watch on its heartbeat) is let go and started again for the new.
    const [doc, setDoc] = useState("");
    const speaking = useRef("");
    // A world that has drawn says it is alive about once a second; silence
    // while this page is in view means it has stopped.
    const stall = useRef<ReturnType<typeof createStallWatch>>();
    stall.current ||= createStallWatch();
    useEffect(() => {
        // Nothing is expected of a document until it has beaten once.
        const watch = (stall.current = createStallWatch());
        let said = false;
        const hidden = () => watch.setHidden(document.hidden);
        hidden();
        document.addEventListener("visibilitychange", hidden);
        const timer = setInterval(() => {
            if (watch.stalled() === said) return;
            said = !said;
            handlers.current.onStalled(said);
        }, BEAT_EVERY_MS);
        return () => {
            // A notice about the old document does not outlive it.
            if (said) handlers.current.onStalled(false);
            clearInterval(timer);
            document.removeEventListener("visibilitychange", hidden);
        };
    }, [doc]);
    // The world's room: the page holds the connection and relays it
    // (./roomRelay), so the session that joins it never enters the frame.
    const room = useRef<ReturnType<typeof hostWorldRoom> | null>(null);
    // The space's live channels (edits as they are saved, editor actions)
    // are the page's too: the world loads no Firebase (./relayedLive).
    const live = useRef<ReturnType<typeof hostWorldLive> | null>(null);
    const drawn = useRef<{ promise: Promise<void>; resolve(): void }>();
    if (!drawn.current) {
        let resolve = () => {};
        const promise = new Promise<void>((done) => (resolve = done));
        drawn.current = { promise, resolve };
    }
    const voice = useRef<ReturnType<typeof hostWorldVoice> | null>(null);
    useEffect(() => {
        const post = (kind: string, data: object) =>
            element.current?.contentWindow?.postMessage(
                { ...data, type: GAME_MESSAGE_PREFIX + kind },
                frameTarget(frame.world)
            );
        // Voice is the page's, in the room it holds, doing what the world's
        // voice rules say (./worldVoiceHost). A microphone goes on only
        // from the page's own button.
        const voiceIn = (held: HostedRoom | null) => {
            voice.current?.dispose();
            voice.current = null;
            if (!held) return handlers.current.onVoice(null);
            voice.current = hostWorldVoice({
                create: (options) => new RoomVoice(held as any, options),
                post,
                onChange: (view) => handlers.current.onVoice(view),
            });
        };
        controls.current = {
            // Nothing is said to the frame before the world has spoken:
            // until its document is in, the frame holds an empty one of
            // this page's own origin, and a message addressed to the world
            // is refused there. The world announces itself when it is up.
            send: (kind, data) => {
                if (told.current) post(kind, data);
            },
            keepVisitor() {
                kept.current = Date.now();
            },
            press(id) {
                post("dock-press", { id });
                element.current?.focus();
            },
            toggleVoice() {
                // Not the visitor's to turn on yet: the world answers.
                if (!voice.current?.press())
                    post("dock-press", { id: VOICE_ACTION });
                element.current?.focus();
            },
        };
        const host = hostWorldRoom({
            post,
            onRoom: voiceIn,
            identify: (label) => handlers.current.identify(label),
            join: async (body, signal) => {
                const { requestSeat, takeSeat } = await import(
                    "@utils/arena/join"
                );
                const { reservation } = await requestSeat(body, { signal });
                return takeSeat(reservation);
            },
        });
        room.current = host;
        live.current = hostWorldLive({
            post,
            spaceId,
            // Firebase loads once the world has drawn: its channels are for
            // what changes during a visit, and a loading world should
            // have the line to itself.
            live: () => deferred(drawn.current.promise.then(liveSpace)),
        });
        return () => {
            host.dispose();
            live.current?.dispose();
            live.current = null;
            voice.current?.dispose();
            voice.current = null;
            controls.current = null;
        };
    }, [frame.world, doc]);
    const told = useRef<object | null>(null);
    const asked = useRef(false);
    const kept = useRef(0);
    useEffect(() => {
        const receive = (event: MessageEvent) => {
            if (!fromFrame(event, element.current, frame.world)) return;
            const kind = readGameMessage(event.data?.type, WORLD_GAME_ID)?.kind;
            if (kind?.startsWith("room-"))
                return room.current?.receive(kind, event.data);
            if (kind?.startsWith("voice-"))
                return voice.current?.receive(kind, event.data);
            if (kind?.startsWith(LIVE_MESSAGE))
                return live.current?.receive(kind, event.data);
            if (kind === "ask") {
                // What only the page can know, because it holds the account.
                const { n, name, label } = event.data;
                const answer = (value: unknown) =>
                    element.current?.contentWindow?.postMessage(
                        { type: `${GAME_MESSAGE_PREFIX}answer`, n, value },
                        frameTarget(frame.world)
                    );
                if (name === "moderator")
                    void handlers.current.moderates(label).then(answer);
                else if (name === "rpc" || name === "api")
                    void handlers.current
                        .account(name, event.data)
                        .then(answer, () => answer(undefined));
                else answer(undefined);
                return;
            }
            if (kind === "alive") return stall.current.beat();
            if (kind?.startsWith(SCRIPT_MESSAGE))
                return handlers.current.onScript(kind, event.data);
            if (kind === "download") return handlers.current.onFile(event.data);
            if (kind === "sign-in") return handlers.current.onSignIn();
            if (kind === "open-link")
                return handlers.current.onLink(event.data.href);
            if (kind === "pointer-lock")
                return setFramedWorldLock(event.data.locked === true);
            if (kind === "dock")
                return handlers.current.onDock(
                    readDock(event.data),
                    readDockConnection(event.data)
                );
            if (kind === "location")
                return handlers.current.onLocation(
                    event.data.href,
                    event.data.title
                );
            if (kind === "travel")
                return handlers.current.onTravel(event.data.href);
            if (kind !== "hello") return;
            const said =
                typeof event.data.doc === "string"
                    ? event.data.doc.slice(0, 40)
                    : "";
            if (said && speaking.current && said !== speaking.current) {
                // A new document: it has been told nothing yet.
                told.current = null;
                setDoc(said);
            }
            if (said) speaking.current = said;
            if (!present.current) {
                // Still working out who is visiting: the world asks again.
                if (!asked.current)
                    sayLoadStage("page", "world-asked-before-visitor-known");
                asked.current = true;
                return;
            }
            // The world keeps the first answer it hears. What it was told
            // is remembered once, so a visitor who changes afterwards is
            // seen as a change (below) and not papered over by a hello
            // that was already on its way.
            if (!told.current) {
                sayLoadStage("page", "told-world-its-visitor");
                told.current = present.current;
            }
            element.current?.contentWindow?.postMessage(
                {
                    ...present.current.message,
                    type: `${GAME_MESSAGE_PREFIX}identity`,
                },
                frameTarget(frame.world)
            );
        };
        window.addEventListener("message", receive);
        return () => {
            window.removeEventListener("message", receive);
            setFramedWorldLock(false);
        };
    }, [frame.world]);

    // Signing in or out, or a new avatar, after the world started: the
    // world starts again as that visitor.
    const changed = useRef(onVisitorChanged);
    changed.current = onVisitorChanged;
    useEffect(() => {
        if (!visitor) return;
        if (told.current) {
            if (told.current === visitor) return;
            // A change the world made itself is taken as told.
            if (Date.now() - kept.current < KEEP_VISITOR_MS) {
                kept.current = 0;
                told.current = visitor;
            } else changed.current();
            return;
        }
        // The world asked before the page knew its visitor. It asks again
        // every quarter second, so it is normally told at once. A world
        // that has stopped asking gave up and started without one (its
        // own guest, ./worldDocument): it starts again as this visitor,
        // or the page and the world would disagree for the whole visit.
        if (!asked.current) return;
        const timer = setTimeout(() => {
            if (!told.current) changed.current();
        }, LATE_VISITOR_MS);
        return () => clearTimeout(timer);
    }, [visitor]);

    // Reached from the lobby, the journey is the world's: the lobby's
    // commands go down to it and its answers go up (utils/lobbyDestinationBridge).
    useEffect(
        () =>
            relayLobbyDestination(
                () => element.current?.contentWindow,
                frame.world
            ),
        [frame.world]
    );

    // Any word from the world while it loads: it is alive and working.
    const heard = useRef(0);
    const began = useRef(0);
    const [quiet, setQuiet] = useState(0);
    useEffect(() => {
        const receive = (event: MessageEvent) => {
            if (fromFrame(event, element.current, frame.world))
                heard.current = Date.now();
        };
        window.addEventListener("message", receive);
        return () => window.removeEventListener("message", receive);
    }, [frame.world]);
    useEffect(() => {
        if (loading.phase !== "loading") {
            drawn.current.resolve();
            sayLoadStage("page", `world-${loading.phase}`);
        }
        if (loading.phase === "failed") return failed.current();
        // Drawn after all: a notice that it did not load no longer holds.
        if (loading.phase !== "loading") return recovered.current();
        // From the last word heard, or from when loading began.
        began.current ||= Date.now();
        const from = Math.max(heard.current, began.current);
        const timer = setTimeout(() => {
            if (heard.current > from) setQuiet((count) => count + 1);
            else failed.current();
        }, Math.max(0, from + WORLD_LOAD_TIMEOUT_MS - Date.now()));
        return () => clearTimeout(timer);
    }, [loading.phase, quiet]);

    return (
        <>
            <iframe
                ref={element}
                src={src}
                title={title}
                sandbox={WORLD_SANDBOX}
                allow={WORLD_PERMISSIONS}
                referrerPolicy="no-referrer"
                data-machine="game-loading"
                data-state={loading.phase}
                style={{
                    width: "100%",
                    height: "100%",
                    border: 0,
                    display: "block",
                }}
            />
            {/* No cover: a world draws its own loading animation, and the
                visitor sees it as they always have. */}
        </>
    );
}
