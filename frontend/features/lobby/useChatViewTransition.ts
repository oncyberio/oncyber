import { useCallback, useEffect, useRef, useState } from "react";

export const CHAT_VIEW_MOTION = { exit: 160, pause: 100, enter: 260 };
type Phase = "idle" | "exiting" | "paused" | "entering";

// Keep the outgoing conversation intact until it is fully hidden. Committing
// the next view after the pause also keeps its input, portrait and history in sync.
export default function useChatViewTransition() {
    const [phase, setPhase] = useState<Phase>("idle");
    const phaseRef = useRef<Phase>("idle");
    const timer = useRef<ReturnType<typeof setTimeout>>();
    const changePhase = useCallback((next: Phase) => {
        phaseRef.current = next;
        setPhase(next);
    }, []);
    const cancel = useCallback(() => {
        clearTimeout(timer.current);
        changePhase("idle");
    }, [changePhase]);
    const switchView = useCallback(
        (commit: () => void) => {
            if (phaseRef.current === "exiting" || phaseRef.current === "paused")
                return;
            clearTimeout(timer.current);
            if (
                !window.matchMedia ||
                window.matchMedia("(prefers-reduced-motion: reduce)").matches
            ) {
                changePhase("idle");
                commit();
                return;
            }
            changePhase("exiting");
            timer.current = setTimeout(() => {
                changePhase("paused");
                timer.current = setTimeout(() => {
                    commit();
                    changePhase("entering");
                    timer.current = setTimeout(
                        () => changePhase("idle"),
                        CHAT_VIEW_MOTION.enter
                    );
                }, CHAT_VIEW_MOTION.pause);
            }, CHAT_VIEW_MOTION.exit);
        },
        [changePhase]
    );
    useEffect(
        () => () => {
            clearTimeout(timer.current);
            phaseRef.current = "idle";
        },
        []
    );
    return {
        phase,
        switching: phase === "exiting" || phase === "paused",
        switchView,
        cancel,
    };
}
