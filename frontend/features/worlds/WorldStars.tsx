import { useEffect, useRef, useState } from "react";
import { baseTokens } from "@styles/tokens";
import { isLobbyDestination } from "@utils/lobbyDestinationBridge";
import { sayLoadStage } from "@utils/loadTimings";
import { startStarfield } from "@utils/starfield/startStarfield";
import { WORLD_COVER_OPACITY, worldCover } from "./worldStars";

const FADE_MS = baseTokens.motion.enter * 2;

/**
 * The star field over a framed world while it loads, drawn by the page
 * (./worldStars.ts says why), by the clock and off the page's main thread
 * where the browser allows (utils/starfield). The same stars the world
 * draws, so the hand-over to the world reads as one effect.
 */
export function WorldStars({
    phase,
    gated,
}: {
    phase: string;
    gated: boolean;
}) {
    const stars = useRef<HTMLDivElement>(null);
    // Read after mount: the server render cannot know about the trip or
    // what the visitor asked of motion.
    const [seen, setSeen] = useState({ onTrip: false, reducedMotion: false });
    useEffect(() => {
        setSeen({
            onTrip: isLobbyDestination(),
            reducedMotion: !!window.matchMedia?.(
                "(prefers-reduced-motion: reduce)"
            ).matches,
        });
    }, []);
    const cover = worldCover({ phase, gated, ...seen });
    const covering = cover !== "none";

    // Kept through the fade, then taken out of the page.
    const [mounted, setMounted] = useState(covering);
    useEffect(() => {
        if (covering) return setMounted(true);
        const timer = setTimeout(() => setMounted(false), FADE_MS);
        return () => clearTimeout(timer);
    }, [covering]);

    const drawing = mounted && cover !== "plain";
    useEffect(() => {
        const holder = stars.current;
        if (!drawing || !holder) return;
        // A canvas of its own each time: one handed to a worker cannot be
        // taken back (utils/starfield/startStarfield).
        const canvas = document.createElement("canvas");
        Object.assign(canvas.style, {
            position: "absolute",
            inset: "0",
            width: "100%",
            height: "100%",
            display: "block",
        });
        holder.append(canvas);
        const running = startStarfield(canvas);
        return () => {
            canvas.remove();
            void running
                .stop()
                .then((paced) =>
                    sayLoadStage(
                        "page",
                        `stars drawn on the ${paced.thread}'s thread: ${paced.frames} frames, longest wait ${paced.worstGap} ms, ${paced.hitches} over 50 ms`
                    )
                );
        };
    }, [drawing]);

    if (!mounted) return null;
    return (
        <div
            data-world-cover={covering ? cover : "leaving"}
            role="status"
            aria-label="Loading world"
            aria-hidden={!covering}
            style={{
                position: "absolute",
                inset: 0,
                background: baseTokens.color.frame,
                opacity: covering ? WORLD_COVER_OPACITY : 0,
                pointerEvents: "none",
                transition: `opacity ${FADE_MS}ms ${baseTokens.motion.ease}`,
            }}
        >
            <div ref={stars} style={{ position: "absolute", inset: 0 }} />
        </div>
    );
}
