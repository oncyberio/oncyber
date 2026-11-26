import { useContext, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import { baseTokens } from "@styles/tokens";
import { UPDATE_USER_DATA, UserContext } from "@components/context/UserContext";
import { relayedRoute, savedSettings } from "./accountRelay";
import ExperienceShell from "@features/content-host/ExperienceShell";
import {
    publicPageHref,
    replaceExperienceLocation,
} from "@utils/experienceLocation";
import { failLobbyDestination } from "@utils/lobbyDestinationBridge";
import { SignInSheetContext } from "@ui/components/ConnectWallet/SignInSheetHost";
import {
    offersAiSidebar,
    setWorldScripts,
    useWorldScripts,
    WORLD_SCRIPTS_ENABLED,
} from "@features/world-scripts/store";
import type { RemoteRuntime } from "@features/world-scripts/runtimeRelay";
import type { PageScriptSpace } from "@features/world-scripts/PageWorldScripts";
import { readWorldLocation, worldSpaceId } from "./worldLocation";
import {
    CONNECTION_ACTION,
    VOICE_ACTION,
    type DockAction,
    type DockConnection,
} from "./worldDock";
import type { WorldVoiceView } from "./worldVoiceHost";
import type { WorldFrame } from "./worldFrame";
import { worldSrc } from "./worldAddress";
import {
    createPageAuthority,
    type PageAuthority,
    type PageSession,
} from "./pageAuthority";
import { usePageVisitor } from "./usePageVisitor";
import { useWorldOffers } from "./useWorldOffers";
import { usePageAvatarPicker } from "@features/avatar-picker/usePageAvatarPicker";
import { AVATAR_KIND, avatarMessage } from "@features/avatar-picker/pageAvatar";
import WorldFrameView, { type WorldControls } from "./WorldFrameView";

export { WORLD_LOAD_TIMEOUT_MS } from "./WorldFrameView";

// The AI sidebar and its account calls, for a space that has world scripts
// on (features/world-scripts): the page's, like everything with a session.
const PageWorldScripts = dynamic(
    () => import("@features/world-scripts/PageWorldScripts"),
    { ssr: false }
);

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
    // Each attempt is a new frame.
    const [attempt, setAttempt] = useState(0);
    const [failed, setFailed] = useState(false);
    // The world drew and has since gone silent: its thread hangs or died.
    // The page, the room and voice carry on; the visitor is told.
    const [stalled, setStalled] = useState(false);
    // A link the world asks to open, a file it made: offered, and done on
    // the visitor's own click (./useWorldOffers).
    const offers = useWorldOffers();
    // Signing in is the page's: a world that wants it asks.
    // The app's one sign-in sheet (the space page has no dialogs of its own).
    const sheet = useContext(SignInSheetContext);
    const closeSignIn = useRef<(() => void) | null>(null);
    const signIn = () => {
        if (isSignedIn || closeSignIn.current || !sheet) return;
        closeSignIn.current = sheet.open({
            toggle: () => {
                closeSignIn.current = null;
            },
        });
    };
    useEffect(() => () => closeSignIn.current?.(), []);
    const { token, user, userData, isSignedIn, dispatch } =
        useContext(UserContext);
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
    const restart = () => {
        setFailed(false);
        setStalled(false);
        offers.clear();
        avatars.close();
        setDock([]);
        setConnection(null);
        setAttempt((count) => count + 1);
    };
    const reload = () => {
        // After a portal the world is in a space this page did not open,
        // while the frame's address is still the first one. Opening the
        // address the bar shows makes that space the page's own (its
        // header, its session, its scripts); loading the frame again
        // would put the world back in the first under the second's name.
        if (elsewhere)
            return void router.replace(
                window.location.pathname + window.location.search
            );
        restart();
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
    // What the page does for the world with its visitor's account, and
    // for which space (./pageAuthority).
    const session = useRef<PageSession>(null);
    session.current = {
        signedIn: !!isSignedIn,
        userId: user?.id || "",
        token: token || "",
        username: userData?.username,
    };
    const authority = useRef<PageAuthority>(null);
    authority.current ||= createPageAuthority(spaceId, () => session.current);
    // Changing avatar is the page's: the world asks for the picker, the
    // page shows the lobby's, saves the choice and tells the world, which
    // wears it and runs on (features/avatar-picker).
    const avatars = usePageAvatarPicker((avatar) => {
        world.current?.keepVisitor();
        world.current?.send(AVATAR_KIND, avatarMessage(avatar));
    });
    // An account call for the world. When it saved a setting (an avatar
    // chosen in the world), the page's own copy of the account follows, so
    // a world started later in this visit is handed the new one; the
    // world that made the change keeps running.
    const account = async (name: unknown, data: any) => {
        const answer: any = await authority.current.account(name, data);
        if (name !== "api" || answer?.status !== 200) return answer;
        const route = relayedRoute(
            data?.method,
            data?.url,
            window.location.origin
        );
        let body: unknown = null;
        try {
            body = JSON.parse(data?.body);
        } catch {}
        const settings =
            route?.kind === "settings"
                ? savedSettings(userData?.settings, body)
                : null;
        if (settings) {
            world.current?.keepVisitor();
            dispatch?.({ type: UPDATE_USER_DATA, payload: { settings } });
        }
        return answer;
    };
    const travel = (href: unknown) => {
        // Only ever to a page: an address that acts when it is opened is
        // not somewhere a world sends its visitor.
        const to = publicPageHref(href, window.location.origin);
        if (!to) return;
        // Back to the space this page opened, from where a portal led:
        // the route is already this one, so the frame is what goes back.
        if (
            elsewhere &&
            new URL(to, window.location.origin).pathname === home.current
        ) {
            replaceExperienceLocation(to);
            setElsewhere(null);
            return restart();
        }
        void router.push(to);
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
                spaceId={spaceId}
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
                identify={(label) => authority.current.identify(label)}
                moderates={(label) => authority.current.moderates(label)}
                account={account}
                onDock={(actions, line) => {
                    setDock(actions);
                    setConnection(line);
                }}
                onVoice={setVoice}
                onStalled={setStalled}
                onFile={offers.offerFile}
                onSignIn={signIn}
                onAvatarPicker={avatars.open}
                onScript={(kind, data) =>
                    scriptRuntime.current?.receive(kind, data)
                }
                onLink={offers.offerLink}
                gated={!!gate}
                controls={world}
            />
            {avatars.picker}
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
                        : offers.offer
                        ? offers.offer
                        : voice?.error
                        ? { message: voice.error }
                        : undefined
                }
            />
        </main>
    );
}
