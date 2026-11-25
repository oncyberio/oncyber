import { useContext, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import shortid from "shortid";
import { baseTokens } from "@styles/tokens";
import { UserContext } from "@components/context/UserContext";
import ExperienceShell from "@features/content-host/ExperienceShell";
import { presentAccount } from "@features/games/accountIdentity";
import { BEAT_EVERY_MS, createStallWatch } from "@features/games/frameStall";
import { RoomVoice } from "@features/games/roomVoice";
import {
    publicExperienceHref,
    replaceExperienceLocation,
} from "@utils/experienceLocation";
import { useGameLoading } from "@features/games/GameLoadingCover";
import { fromFrame, frameTarget } from "@features/games/frameOrigin";
import {
    GAME_MESSAGE_PREFIX,
    readGameMessage,
} from "@features/games/gameContract";
import { WORLD_GAME_ID } from "./worldDocument";
import { readWorldLocation, worldSpaceId } from "./worldLocation";
import type { RoomIdentity } from "./roomRelay";
import {
    CONNECTION_ACTION,
    readDock,
    readDockConnection,
    VOICE_ACTION,
    type DockAction,
    type DockConnection,
} from "./worldDock";
import { hostWorldRoom, type HostedRoom } from "./worldRoomHost";
import { hostWorldVoice, type WorldVoiceView } from "./worldVoiceHost";
import { setFramedWorldLock } from "./worldPointer";
import {
    readWorldFile,
    readWorldLink,
    type WorldFile,
    type WorldLink,
} from "./worldLinks";
import { HomeContext } from "@components/context/HomeContext";
import {
    failLobbyDestination,
    isLobbyDestination,
    relayLobbyDestination,
} from "@utils/lobbyDestinationBridge";
import { readPreviewOption } from "@features/lobby/lobbyPreviewOptions";
import { worldAccount, worldVisitorMessage } from "./worldVisitor";
import {
    offersAiSidebar,
    setWorldScripts,
    useWorldScripts,
    WORLD_SCRIPTS_ENABLED,
} from "@features/world-scripts/store";
import {
    SCRIPT_MESSAGE,
    type RemoteRuntime,
} from "@features/world-scripts/runtimeRelay";
import type { PageScriptSpace } from "@features/world-scripts/PageWorldScripts";
import { answerWorldAccount } from "./worldAccountHost";
import {
    WORLD_PERMISSIONS,
    WORLD_SANDBOX,
    worldFrameUrl,
    type WorldFrame,
} from "./worldFrame";

// The AI sidebar and its account calls, for a space that has world scripts
// on (features/world-scripts): the page's, like everything with a session.
const PageWorldScripts = dynamic(
    () => import("@features/world-scripts/PageWorldScripts"),
    { ssr: false }
);

/**
 * The world's address for this page's. Inside the lobby, the travel options
 * the lobby was opened with go along: the world cannot read them from the
 * lobby's address as an unframed space does.
 */
function worldSrc(path: string, frame: WorldFrame) {
    const url = new URL(worldFrameUrl(path, frame));
    if (isLobbyDestination())
        for (const name of ["travel", "reveal", "departure"]) {
            const value = readPreviewOption(name);
            if (value && !url.searchParams.has(name))
                url.searchParams.set(name, value);
        }
    return url.href;
}

/** How long the page offers a link the world asked to open. */
const LINK_OFFER_MS = 15_000;
/**
 * A world still loading that has said nothing for this long is taken as
 * failed. A big world on a slow line may load for longer than this; it
 * reports its progress as it goes, and each report starts the wait again.
 */
export const WORLD_LOAD_TIMEOUT_MS = 120_000;

/**
 * A native world in a frame (docs/plans/framed-worlds.md). The page keeps
 * the account, the header and every prompt; the world is served from the
 * world host and cannot reach any of it.
 *
 * The world speaks the games contract, so the page follows its loading
 * with the code a framed game's page uses. It draws no cover over it: a
 * world has its own loading animation, and that is what the visitor sees.
 */
export default function FramedWorld({
    title,
    spaceId,
    frame,
    gate,
    scripts,
}: {
    title: string;
    spaceId: string;
    frame: WorldFrame;
    /** Whether the page's visitor is let into this space. */
    gate?: { type: string };
    /** The space, where world scripts may run on it. */
    scripts?: PageScriptSpace | null;
}) {
    const router = useRouter();
    // Each attempt is a new frame with a new cover.
    const [attempt, setAttempt] = useState(0);
    const [failed, setFailed] = useState(false);
    // The world drew and has since gone silent: its thread hangs or died.
    // The page, the room and voice carry on; the visitor is told.
    const [stalled, setStalled] = useState(false);
    // A link the world asks to open. The page says where it goes and opens
    // it on the visitor's own click, never on the world's word.
    const [link, setLink] = useState<WorldLink | null>(null);
    useEffect(() => {
        if (!link) return;
        const timer = setTimeout(() => setLink(null), LINK_OFFER_MS);
        return () => clearTimeout(timer);
    }, [link]);
    // A file the world made (a photo): a frame cannot save one, so the
    // page offers to, the same way.
    const [file, setFile] = useState<WorldFile | null>(null);
    useEffect(() => {
        if (!file) return;
        const timer = setTimeout(() => setFile(null), LINK_OFFER_MS);
        return () => clearTimeout(timer);
    }, [file]);
    const saveFile = () => {
        if (!file) return;
        const address = URL.createObjectURL(file.file);
        const anchor = document.createElement("a");
        anchor.href = address;
        anchor.download = file.name;
        anchor.click();
        setTimeout(() => URL.revokeObjectURL(address), 10_000);
        setFile(null);
    };
    // Signing in is the page's: a world that wants it asks.
    const dialogs = useContext(HomeContext);
    const signIn = () => {
        if (!isSignedIn && dialogs && !dialogs.isAuthShowing)
            dialogs.toggleAuth();
    };
    const visitor = usePageVisitor(gate);
    // The one dock: the world's buttons, drawn here, with the page's own
    // microphone in the voice button's place (./worldDock).
    const [dock, setDock] = useState<DockAction[]>([]);
    // Whether the visitor is connected and how many are here: the world
    // knows, the page shows it beside the title it draws.
    const [connection, setConnection] = useState<DockConnection | null>(null);
    const [voice, setVoice] = useState<WorldVoiceView | null>(null);
    const world = useRef<WorldControls | null>(null);
    // World scripts: the script runs in the world, the sidebar is here.
    const scriptRuntime = useRef<RemoteRuntime | null>(null);
    const worldScripts = useWorldScripts();
    const reload = () => {
        setFailed(false);
        setStalled(false);
        setLink(null);
        setFile(null);
        setDock([]);
        setConnection(null);
        setAttempt((count) => count + 1);
    };
    // The microphone is the page's. Once the world's rules let this visitor
    // speak, the button is the page's own; until then it is the world's
    // (asking a moderator, say), like any other button of its.
    const live = voice?.state === "live";
    const actions = dock.map((action) =>
        action.id === VOICE_ACTION && voice?.allowed
            ? {
                  id: VOICE_ACTION,
                  label: live
                      ? "Mute microphone"
                      : voice.state === "connecting"
                      ? "Connecting voice…"
                      : "Enable microphone",
                  icon: live ? "mic" : "mic-off",
                  active: live,
                  disabled: voice.state === "connecting",
                  concealed: action.concealed,
                  shortcut: action.shortcut,
                  onClick: () => world.current?.toggleVoice(),
              }
            : {
                  ...action,
                  ...(action.id === VOICE_ACTION
                      ? { icon: "mic-off", active: false }
                      : {}),
                  onClick: () => world.current?.press(action.id),
              }
    );
    // The frame is loaded at the page's address once; from then on the
    // world says where it is and the address bar follows it.
    const [src] = useState(() => worldSrc(router.asPath, frame));
    // A portal taken inside the frame: another space, named by the world,
    // whose id the page has looked up itself.
    const [elsewhere, setElsewhere] = useState<{
        pathname: string;
        title: string;
        spaceId?: string;
    } | null>(null);
    const home = useRef("");
    const follow = (href: unknown, saidTitle: unknown) => {
        const location = readWorldLocation(href, window.location.origin);
        if (!location) return;
        home.current ||= window.location.pathname;
        replaceExperienceLocation(location.href);
        if (location.pathname === home.current) return setElsewhere(null);
        const there = {
            pathname: location.pathname,
            title:
                typeof saidTitle === "string" && saidTitle.trim()
                    ? saidTitle.slice(0, 120)
                    : "Untitled world",
        };
        setElsewhere((current) =>
            current?.pathname === there.pathname ? current : there
        );
        void worldSpaceId(location.space).then((spaceId) =>
            setElsewhere((current) =>
                spaceId && current?.pathname === there.pathname
                    ? { ...current, spaceId }
                    : current
            )
        );
    };
    // Who the page joins a room as. The session is lent only to the room
    // of the space this page opened: a room reached through a portal inside
    // the frame is joined by name alone.
    const { token, user, userData, isSignedIn } = useContext(UserContext);
    const guestId = useRef("");
    const identify = async (label: string): Promise<RoomIdentity> => {
        if (!isSignedIn || !user?.id)
            return {
                userId: (guestId.current ||= `Anon-${shortid.generate()}`),
                token: "",
            };
        const here = (await worldSpaceId({ link: label })) === spaceId;
        return {
            userId: user.id,
            token: here ? token : "",
            username: userData?.username,
        };
    };
    // Whether this visitor moderates the space, asked by the world: only
    // for the space this page opened, as with the session.
    const moderates = async (label: unknown) => {
        if (!isSignedIn || typeof label !== "string" || label.length > 200)
            return false;
        if ((await worldSpaceId({ link: label })) !== spaceId) return false;
        try {
            const { default: SocialApi } = await import("@api/social/_api");
            return (await SocialApi.isMod({ slug: label })) === true;
        } catch {
            return false;
        }
    };
    // What a world may do with the account, done by the page with its own
    // session (./accountRelay).
    const account = (name: unknown, data: unknown) =>
        answerWorldAccount(name, data, {
            signedIn: !!isSignedIn && !!user?.id,
            spaceId,
            origin: window.location.origin,
            rpc: async (route, method, params, options) =>
                (await import("@utils/rpc/client")).invokeRemoteRpcMethod(
                    route,
                    method,
                    params,
                    options
                ),
            request: (input, init) => fetch(input, init),
        });
    const travel = (href: unknown) => {
        const to = publicExperienceHref(href, window.location.origin);
        if (to) void router.push(to);
    };
    // The AI sidebar's button is the page's own, beside the world's: for
    // an editor of this space in early access, while the world is in it.
    const scripted = WORLD_SCRIPTS_ENABLED && !!scripts && !elsewhere;
    const aiOpen = worldScripts.panelOpen;
    const more = actions.findIndex((action) => action.id === "more");
    const docked =
        scripted && offersAiSidebar(worldScripts) && actions.length
            ? [
                  ...actions.slice(0, more < 0 ? actions.length : more),
                  {
                      id: "ai",
                      label: aiOpen ? "Close AI" : "Build with AI",
                      icon: "multi-star",
                      active: aiOpen,
                      expanded: aiOpen,
                      onClick: () => setWorldScripts({ panelOpen: !aiOpen }),
                  },
                  ...(more < 0 ? [] : actions.slice(more)),
              ]
            : actions;
    return (
        <main
            data-framed-world
            style={{
                position: "fixed",
                inset: 0,
                background: baseTokens.color.frame,
            }}
        >
            <WorldFrameView
                key={attempt}
                title={title}
                src={src}
                frame={frame}
                visitor={visitor}
                onFailed={() => {
                    setFailed(true);
                    // On a trip from the lobby, the lobby says so.
                    failLobbyDestination(
                        "This world didn't load.",
                        "world-load-failed"
                    );
                }}
                onLoaded={() => setFailed(false)}
                onVisitorChanged={reload}
                onLocation={follow}
                onTravel={travel}
                identify={identify}
                moderates={moderates}
                account={account}
                onDock={(actions, line) => {
                    setDock(actions);
                    setConnection(line);
                }}
                onVoice={setVoice}
                onStalled={setStalled}
                onFile={(message) => {
                    const next = readWorldFile(message);
                    if (!next) return;
                    // The newest ask is the one on offer.
                    setLink(null);
                    setFile(next);
                }}
                onSignIn={signIn}
                onScript={(kind, data) =>
                    scriptRuntime.current?.receive(kind, data)
                }
                onLink={(href) => {
                    // What is not a web address is not offered, and does
                    // not take an offer away.
                    const next = readWorldLink(href, window.location.origin);
                    if (!next) return;
                    setFile(null);
                    setLink(next);
                }}
                controls={world}
            />
            {scripted && (
                <PageWorldScripts
                    key={attempt}
                    space={scripts}
                    send={(kind, data) => world.current?.send(kind, data)}
                    heard={scriptRuntime}
                />
            )}
            <ExperienceShell
                title={elsewhere ? elsewhere.title : title}
                spaceId={elsewhere ? elsewhere.spaceId : spaceId}
                onExit={() => void router.push("/")}
                actions={docked}
                connection={
                    connection && !elsewhere
                        ? {
                              state: connection.state,
                              count: connection.count,
                              reason: connection.reason,
                              action: connection.action
                                  ? {
                                        label: connection.action,
                                        onClick: () =>
                                            world.current?.press(
                                                CONNECTION_ACTION
                                            ),
                                    }
                                  : undefined,
                          }
                        : connection
                        ? { state: connection.state, count: connection.count }
                        : undefined
                }
                connectionState={connection?.state}
                notice={
                    failed
                        ? {
                              message: "This world didn't load.",
                              onRetry: reload,
                          }
                        : stalled
                        ? {
                              message: "This world stopped responding.",
                              onRetry: reload,
                          }
                        : link
                        ? {
                              message: `Open ${link.host} in a new tab?`,
                              actionLabel: "Open link",
                              onRetry: () => {
                                  window.open(
                                      link.href,
                                      "_blank",
                                      "noopener,noreferrer"
                                  );
                                  setLink(null);
                              },
                          }
                        : file
                        ? {
                              message: `Save ${file.name}?`,
                              actionLabel: "Save",
                              onRetry: saveFile,
                          }
                        : voice?.error
                        ? { message: voice.error }
                        : undefined
                }
            />
        </main>
    );
}

/** What the page's dock does to the world in the frame. */
interface WorldControls {
    press(id: string): void;
    toggleVoice(): void;
    /** Any other message to the world. */
    send(kind: string, data: object): void;
}

/**
 * The visitor as the page presents them to a world: null until the account
 * and its avatar have been read. The same object until one of them changes.
 */
function usePageVisitor(gate?: { type: string }) {
    const { userData, user, isSignedIn } = useContext(UserContext);
    const [visitor, setVisitor] = useState<{
        key: string;
        message: object;
    } | null>(null);
    const account = isSignedIn ? userData : null;
    useEffect(() => {
        let cancelled = false;
        void presentAccount(account).then((presentation) => {
            if (cancelled) return;
            const message = worldVisitorMessage(
                !!account,
                presentation,
                account?.settings?.default_vrm_scale,
                { account: worldAccount(user?.id, account), gate }
            );
            const key = JSON.stringify(message);
            setVisitor((current) =>
                current?.key === key ? current : { key, message }
            );
        });
        return () => {
            cancelled = true;
        };
    }, [
        isSignedIn,
        account?.username,
        account?.avatar,
        account?.settings?.vrm,
        account?.settings?.default_vrm_scale,
        user?.id,
        gate?.type,
    ]);
    return visitor;
}

function WorldFrameView({
    title,
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
    // A world that has drawn says it is alive about once a second; silence
    // while this page is in view means it has stopped.
    const stall = useRef<ReturnType<typeof createStallWatch>>();
    stall.current ||= createStallWatch();
    useEffect(() => {
        const watch = stall.current;
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
            clearInterval(timer);
            document.removeEventListener("visibilitychange", hidden);
        };
    }, []);
    // The world's room: the page holds the connection and relays it
    // (./roomRelay), so the session that joins it never enters the frame.
    const room = useRef<ReturnType<typeof hostWorldRoom> | null>(null);
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
            send: post,
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
        return () => {
            host.dispose();
            voice.current?.dispose();
            voice.current = null;
            controls.current = null;
        };
    }, [frame.world]);
    const told = useRef<object | null>(null);
    useEffect(() => {
        const receive = (event: MessageEvent) => {
            if (!fromFrame(event, element.current, frame.world)) return;
            const kind = readGameMessage(event.data?.type, WORLD_GAME_ID)?.kind;
            if (kind?.startsWith("room-"))
                return room.current?.receive(kind, event.data);
            if (kind?.startsWith("voice-"))
                return voice.current?.receive(kind, event.data);
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
            if (kind !== "hello" || !present.current) return;
            told.current = present.current;
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
        if (told.current && visitor && told.current !== visitor)
            changed.current();
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
