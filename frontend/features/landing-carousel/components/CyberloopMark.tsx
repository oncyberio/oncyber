import { useEffect, useRef } from "react";
import styled from "styled-components";
import { useLandingActivity } from "../activity";
import ScrollLinkedCyberloopMark from "./ScrollLinkedCyberloopMark";

const STILL = "/brand/cyberloop-still.webp";
const SPRITE = "/brand/cyberloop-sprite.webp";
const REST_FRAME = 90;
const FRAME_MS = 1000 / 30;
const FRAME_COUNT = 225;

function drawFrame(mark: HTMLSpanElement, frame: number) {
    mark.style.backgroundImage = `url("${SPRITE}")`;
    mark.style.backgroundSize = "1500% 1500%";
    mark.style.backgroundPosition = `${((frame % 15) / 14) * 100}% ${
        (Math.floor(frame / 15) / 14) * 100
    }%`;
}

/** Gallery position drives the header; modal playback uses the supplied frames. */
export default function CyberloopMark({
    continuous = false,
    scrollLinked = false,
}: {
    continuous?: boolean;
    scrollLinked?: boolean;
}) {
    return scrollLinked && !continuous ? (
        <ScrollLinkedCyberloopMark />
    ) : (
        <PlaybackCyberloopMark continuous={continuous} />
    );
}

function PlaybackCyberloopMark({
    continuous = false,
}: {
    continuous?: boolean;
}) {
    const element = useRef<HTMLSpanElement>(null);
    const activity = useLandingActivity();
    useEffect(() => {
        const mark = element.current;
        if (!mark || (!continuous && !activity)) return;
        const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
        let disposed = false;
        let loaded = false;
        let image: HTMLImageElement;
        let frame = REST_FRAME;
        let elapsed = 0;
        let previous: number | null = null;
        let raf = 0;
        let stopTimer: ReturnType<typeof setTimeout>;
        let running = false;

        function draw() {
            drawFrame(mark, frame);
        }
        function stop() {
            clearTimeout(stopTimer);
            stopTimer = undefined;
            cancelAnimationFrame(raf);
            raf = 0;
            previous = null;
            running = false;
            mark.dataset.cyberloopState = "idle";
        }
        function tick(now: number) {
            raf = 0;
            if (!running || disposed) return;
            if (previous !== null) elapsed += now - previous;
            previous = now;
            if (elapsed >= FRAME_MS) {
                frame = (frame + Math.floor(elapsed / FRAME_MS)) % FRAME_COUNT;
                elapsed %= FRAME_MS;
                draw();
            }
            raf = requestAnimationFrame(tick);
        }
        function sync() {
            if (disposed) return;
            if (motion.matches || document.hidden) {
                stop();
                if (motion.matches) {
                    frame = REST_FRAME;
                    elapsed = 0;
                    mark.style.backgroundImage = `url("${STILL}")`;
                    mark.style.backgroundSize = "contain";
                    mark.style.backgroundPosition = "center";
                }
                return;
            }
            if (!continuous && !activity?.getSnapshot()) {
                // Bridge tiny gaps between network completion and the next paint.
                if (running && !stopTimer)
                    stopTimer = setTimeout(() => {
                        stopTimer = undefined;
                        stop();
                    }, 200);
                return;
            }
            clearTimeout(stopTimer);
            stopTimer = undefined;
            if (!image) {
                image = new Image();
                image.onload = () => {
                    loaded = true;
                    sync();
                };
                image.src = SPRITE;
            }
            if (!loaded || running) return;
            draw();
            running = true;
            mark.dataset.cyberloopState = "playing";
            raf = requestAnimationFrame(tick);
        }
        const unsubscribe = continuous ? undefined : activity?.subscribe(sync);
        motion.addEventListener("change", sync);
        document.addEventListener("visibilitychange", sync);
        sync();
        return () => {
            disposed = true;
            stop();
            unsubscribe?.();
            motion.removeEventListener("change", sync);
            document.removeEventListener("visibilitychange", sync);
            if (image) image.onload = null;
        };
    }, [activity, continuous]);
    return (
        <Mark
            ref={element}
            className="cyberloop-mark"
            aria-hidden="true"
            data-cyberloop-state="idle"
        />
    );
}
const Mark = styled.span`
    display: block;
    flex-shrink: 0;
    width: 34px;
    height: 34px;
    background: url("/brand/cyberloop-still.webp") center / contain no-repeat;
    @media (max-width: 700px) {
        width: 30px;
        height: 30px;
    }
`;
