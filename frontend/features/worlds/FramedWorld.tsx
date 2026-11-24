import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { baseTokens } from "@styles/tokens";
import ExperienceShell from "@features/content-host/ExperienceShell";
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
                src={worldFrameUrl(router.asPath, frame)}
                frame={frame}
                onFailed={() => setFailed(true)}
            />
            <ExperienceShell
                title={title}
                spaceId={spaceId}
                onExit={() => void router.push("/")}
                notice={
                    failed
                        ? {
                              message: "This world didn't load.",
                              onRetry: () => {
                                  setFailed(false);
                                  setAttempt((count) => count + 1);
                              },
                          }
                        : undefined
                }
            />
        </main>
    );
}

function WorldFrameView({
    title,
    src,
    frame,
    onFailed,
}: {
    title: string;
    src: string;
    frame: WorldFrame;
    onFailed(): void;
}) {
    const element = useRef<HTMLIFrameElement>(null);
    const loading = useGameLoading(WORLD_GAME_ID, element, frame.world);
    const failed = useRef(onFailed);
    failed.current = onFailed;

    // The world says hello until the page answers. Nothing about the
    // account crosses yet: the visitor is a guest inside the world.
    useEffect(() => {
        const receive = (event: MessageEvent) => {
            if (!fromFrame(event, element.current, frame.world)) return;
            const kind = readGameMessage(event.data?.type, WORLD_GAME_ID)?.kind;
            if (kind === "hello")
                element.current?.contentWindow?.postMessage(
                    { type: `${GAME_MESSAGE_PREFIX}identity` },
                    frameTarget(frame.world)
                );
        };
        window.addEventListener("message", receive);
        return () => window.removeEventListener("message", receive);
    }, [frame.world]);

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
