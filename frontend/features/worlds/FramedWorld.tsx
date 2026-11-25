import { useContext, useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import shortid from "shortid";
import { baseTokens } from "@styles/tokens";
import { UserContext } from "@components/context/UserContext";
import ExperienceShell from "@features/content-host/ExperienceShell";
import { presentAccount } from "@features/games/accountIdentity";
import { RoomVoice } from "@features/games/roomVoice";
import {
    publicExperienceHref,
    replaceExperienceLocation,
} from "@utils/experienceLocation";
import {
    GameLoadingCover,
    useGameLoading,
} from "@features/games/GameLoadingCover";
import { fromFrame, frameTarget } from "@features/games/frameOrigin";
import {
    GAME_MESSAGE_PREFIX,
    readGameMessage,
} from "@features/games/gameContract";
import { WORLD_GAME_ID } from "./worldDocument";
import { readWorldLocation, worldSpaceId } from "./worldLocation";
import type { RoomIdentity } from "./roomRelay";
import { readDock, VOICE_ACTION, type DockAction } from "./worldDock";
import { hostWorldRoom, type HostedRoom } from "./worldRoomHost";
import { hostWorldVoice, type WorldVoiceView } from "./worldVoiceHost";
import { setFramedWorldLock } from "./worldPointer";
import { worldVisitorMessage } from "./worldVisitor";
import {
    WORLD_PERMISSIONS,
    WORLD_SANDBOX,
    worldFrameUrl,
    type WorldFrame,
} from "./worldFrame";

/** A world that has drawn nothing after this long is taken as failed. */
export const WORLD_LOAD_TIMEOUT_MS = 120_000;

/**
 * A native world in a frame (docs/plans/framed-worlds.md). The page keeps
 * the account, the header and every prompt; the world is served from the
 * world host and cannot reach any of it.
 *
 * The world speaks the games contract, so what a framed game gets from the
 * page (the cover until its first frame, here) a world gets from the same
 * code.
 */
export default function FramedWorld({
    title,
    spaceId,
    frame,
}: {
    title: string;
    spaceId: string;
    frame: WorldFrame;
}) {
    const router = useRouter();
    // Each attempt is a new frame with a new cover.
    const [attempt, setAttempt] = useState(0);
    const [failed, setFailed] = useState(false);
    const visitor = usePageVisitor();
    // The one dock: the world's buttons, drawn here, with the page's own
    // microphone in the voice button's place (./worldDock).
    const [dock, setDock] = useState<DockAction[]>([]);
    const [voice, setVoice] = useState<WorldVoiceView | null>(null);
    const world = useRef<WorldControls | null>(null);
    const reload = () => {
        setFailed(false);
        setDock([]);
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
    const [src] = useState(() => worldFrameUrl(router.asPath, frame));
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
    const travel = (href: unknown) => {
        const to = publicExperienceHref(href, window.location.origin);
        if (to) void router.push(to);
    };
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
                onFailed={() => setFailed(true)}
                onVisitorChanged={reload}
                onLocation={follow}
                onTravel={travel}
                identify={identify}
                moderates={moderates}
                onDock={setDock}
                onVoice={setVoice}
                controls={world}
            />
            <ExperienceShell
                title={elsewhere ? elsewhere.title : title}
                spaceId={elsewhere ? elsewhere.spaceId : spaceId}
                onExit={() => void router.push("/")}
                actions={actions}
                notice={
                    failed
                        ? {
                              message: "This world didn't load.",
                              onRetry: reload,
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
}

/**
 * The visitor as the page presents them to a world: null until the account
 * and its avatar have been read. The same object until one of them changes.
 */
function usePageVisitor() {
    const { userData, isSignedIn } = useContext(UserContext);
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
                account?.settings?.default_vrm_scale
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
    ]);
    return visitor;
}

function WorldFrameView({
    title,
    src,
    frame,
    visitor,
    onFailed,
    onVisitorChanged,
    onLocation,
    onTravel,
    identify,
    moderates,
    onDock,
    onVoice,
    controls,
}: {
    title: string;
    src: string;
    frame: WorldFrame;
    visitor: { message: object } | null;
    onFailed(): void;
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
    /** The buttons the world has for the dock. */
    onDock(actions: DockAction[]): void;
    /** The page's voice in the world's room; null while it is in none. */
    onVoice(voice: WorldVoiceView | null): void;
    controls: { current: WorldControls | null };
}) {
    const element = useRef<HTMLIFrameElement>(null);
    const loading = useGameLoading(WORLD_GAME_ID, element, frame.world);
    const failed = useRef(onFailed);
    failed.current = onFailed;

    // The world says hello until the page answers with its visitor: public
    // fields only (./worldVisitor). The world starts once it has them.
    const present = useRef(visitor);
    present.current = visitor;
    const handlers = useRef({
        onLocation,
        onTravel,
        identify,
        moderates,
        onDock,
        onVoice,
    });
    handlers.current = {
        onLocation,
        onTravel,
        identify,
        moderates,
        onDock,
        onVoice,
    };
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
                else answer(undefined);
                return;
            }
            if (kind === "pointer-lock")
                return setFramedWorldLock(event.data.locked === true);
            if (kind === "dock")
                return handlers.current.onDock(readDock(event.data));
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

    useEffect(() => {
        if (loading.phase === "failed") return failed.current();
        if (loading.phase !== "loading") return;
        const timer = setTimeout(() => failed.current(), WORLD_LOAD_TIMEOUT_MS);
        return () => clearTimeout(timer);
    }, [loading.phase]);

    return (
        <>
            <iframe
                ref={element}
                src={src}
                title={title}
                sandbox={WORLD_SANDBOX}
                allow={WORLD_PERMISSIONS}
                referrerPolicy="no-referrer"
                style={{
                    width: "100%",
                    height: "100%",
                    border: 0,
                    display: "block",
                }}
            />
            {loading.phase !== "failed" && (
                <GameLoadingCover state={loading} title={title} />
            )}
        </>
    );
}
