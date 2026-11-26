import { useEffect, useRef, useState } from "react";
import { baseTokens } from "@styles/tokens";
import { isLobbyDestination } from "@utils/lobbyDestinationBridge";
import { WORLD_COVER_OPACITY, worldCover } from "./worldStars";

const FADE_MS = baseTokens.motion.enter * 2;

/**
 * The star field over a framed world while it loads, drawn by the page
 * (./worldStars.ts says why). The same stars the world draws
 * (`drawStarfield`), so the hand-over to the world reads as one effect.
 */
export function WorldStars({
    phase,
    gated,
}: {
    phase: string;
    gated: boolean;
}) {
    const canvas = useRef<HTMLCanvasElement>(null);
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
        if (!drawing) return;
        let ended = false;
        let frame = 0;
        let draw: (() => void) | undefined;
        const start = () => {
            if (ended || !canvas.current) return;
            void import("@components/_3DExhibit-v2/ui/LoaderVideoContainer")
                .then(({ drawStarfield }) => {
                    if (ended || !canvas.current) return;
                    draw = drawStarfield(
                        canvas.current,
                        window.innerWidth,
                        window.innerHeight
                    );
                    if (!frame) paint();
                })
                .catch(() => {});
        };
        const paint = () => {
            frame = 0;
            if (ended || document.hidden || !draw) return;
            draw();
            frame = requestAnimationFrame(paint);
        };
        const shown = () => {
            if (!document.hidden && !frame) paint();
        };
        start();
        window.addEventListener("resize", start);
        document.addEventListener("visibilitychange", shown);
        return () => {
            ended = true;
            cancelAnimationFrame(frame);
            window.removeEventListener("resize", start);
            document.removeEventListener("visibilitychange", shown);
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
            <canvas
                ref={canvas}
                style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    display: cover === "plain" ? "none" : "block",
                }}
            />
        </div>
    );
}
