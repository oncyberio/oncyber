import { useEffect, useRef, useState } from "react";
import { LandingCard } from "../types";
import { cardOpacity, CardMotion, transitionDuration } from "../transitions";

export default function useCardTransition(
    cards: LandingCard[],
    key: string,
    count: number
) {
    const [shown, setShown] = useState({ cards, key });
    const shownRef = useRef(shown);
    const latest = useRef({ cards, key });
    latest.current = { cards, key };
    const motion = useRef<CardMotion>({ phase: "idle", started: 0 });
    const invalidate = useRef(() => {});
    const timer = useRef<ReturnType<typeof setTimeout>>();
    const [busy, setBusy] = useState(false);
    const reduced = useRef(false);
    function showLatest() {
        shownRef.current = latest.current;
        setShown(latest.current);
    }
    function finish() {
        clearTimeout(timer.current);
        showLatest();
        motion.current = { phase: "idle", started: 0 };
        setBusy(false);
        invalidate.current();
    }
    useEffect(() => {
        const query = matchMedia("(prefers-reduced-motion: reduce)");
        reduced.current = query.matches;
        const changed = () => {
            reduced.current = query.matches;
            if (query.matches) finish();
        };
        query.addEventListener("change", changed);
        return () => {
            clearTimeout(timer.current);
            query.removeEventListener("change", changed);
        };
    }, []);
    useEffect(() => {
        // Live world filters should never wait for outgoing cards to fade.
        const filteringWorlds =
            key.startsWith("explore:") &&
            shownRef.current.key.startsWith("explore:");
        if (
            reduced.current ||
            filteringWorlds ||
            !shownRef.current.cards.length
        ) {
            finish();
            return;
        }
        if (shownRef.current.key === key) {
            if (motion.current.phase !== "out") showLatest();
            return;
        }
        // Repeated clicks during the exit simply replace its destination.
        if (motion.current.phase === "out") return;
        clearTimeout(timer.current);
        const previous = motion.current;
        const now = performance.now();
        motion.current = {
            phase: "out",
            started: now,
            from: (index) => cardOpacity(previous, now, index),
        };
        setBusy(true);
        invalidate.current();
        timer.current = setTimeout(() => {
            showLatest();
            motion.current = { phase: "in", started: performance.now() };
            invalidate.current();
            timer.current = setTimeout(finish, transitionDuration("in", count));
        }, transitionDuration("out", count));
    }, [cards, key, count]);
    return { ...shown, motion, invalidate, busy };
}
