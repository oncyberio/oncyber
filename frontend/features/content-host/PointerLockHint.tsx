import { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { promptGlass } from "@ui/components/PromptGlass";

/** True while this document holds pointer lock. */
export function usePointerLocked() {
    const [locked, setLocked] = useState(false);
    useEffect(() => {
        const update = () => setLocked(document.pointerLockElement != null);
        document.addEventListener("pointerlockchange", update);
        update();
        return () => document.removeEventListener("pointerlockchange", update);
    }, []);
    return locked;
}

function useFinePointer() {
    const [fine, setFine] = useState(false);
    useEffect(() => {
        if (typeof window.matchMedia !== "function") return;
        const query = window.matchMedia("(hover: hover) and (pointer: fine)");
        const update = () => setFine(query.matches);
        update();
        query.addEventListener?.("change", update);
        return () => query.removeEventListener?.("change", update);
    }, []);
    return fine;
}

/** How long each prompt stays up, counting only time it's actually shown. */
export const POINTER_HINT_MS = 6000;

/**
 * Show a prompt for `ms` of visible time per appearance (`key`). Time spent
 * hidden behind an open panel doesn't count, so it comes back for the rest.
 */
function useHintBudget(key: string | null, paused: boolean, ms: number) {
    const [expired, setExpired] = useState<string | null>(null);
    const left = useRef(ms);
    const current = useRef<string | null>(null);
    if (current.current !== key) {
        current.current = key;
        left.current = ms;
    }
    useEffect(() => {
        if (!key || paused || expired === key) return;
        const started = performance.now();
        const timer = setTimeout(() => setExpired(key), left.current);
        return () => {
            clearTimeout(timer);
            left.current = Math.max(
                0,
                left.current - (performance.now() - started)
            );
        };
    }, [key, paused, expired, ms]);
    // A new appearance of the same prompt (e.g. locking again) starts fresh.
    useEffect(() => {
        if (expired && expired !== key) setExpired(null);
    }, [key, expired]);
    return !!key && !paused && expired !== key;
}

/**
 * Reflect only pointer lock in this document; embedded renderers stay
 * isolated. With `lookHint`, a mouse user is also invited to click into the
 * scene, as on the classic gallery player.
 */
export default function PointerLockHint({
    locked: hostLocked,
    lookHint = false,
    paused = false,
}: {
    /** The host's own reading, when it already tracks pointer lock. */
    locked?: boolean;
    lookHint?: boolean;
    /** A panel is open: hide the prompt and stop its clock until it closes. */
    paused?: boolean;
}) {
    const ownLocked = usePointerLocked();
    const locked = hostLocked ?? ownLocked;
    const fine = useFinePointer();
    // Each lock/unlock is a new appearance with its own six seconds.
    const appearance = useRef(0);
    const previous = useRef<boolean | null>(null);
    if (previous.current !== locked) {
        previous.current = locked;
        appearance.current++;
    }
    const key = locked
        ? `esc-${appearance.current}`
        : lookHint && fine
        ? `look-${appearance.current}`
        : null;
    const shown = useHintBudget(key, paused, POINTER_HINT_MS);
    if (!shown) return null;
    if (locked)
        return (
            <Hint role="status">
                <span>
                    Press <kbd>Esc</kbd> to regain control of your mouse
                </span>
            </Hint>
        );
    return (
        <Hint role="status" data-look-hint>
            <span>Click to look around freely</span>
        </Hint>
    );
}

const Hint = styled.div`
    ${promptGlass}
    position: fixed;
    z-index: 5;
    left: 50%;
    bottom: max(82px, calc(env(safe-area-inset-bottom) + 74px));
    transform: translateX(-50%);
    width: max-content;
    max-width: calc(100% - 32px);
    min-height: 36px;
    box-sizing: border-box;
    padding: 10px 16px;
    border-radius: 999px;
    pointer-events: none;
    font-size: 12px;
    font-weight: 400;
    line-height: 16px;
    text-align: center;
    overflow-wrap: anywhere;

    kbd {
        margin: 0 3px;
        padding: 0 4px;
        border: 1px solid #ffffff30;
        border-radius: 4px;
        font: 11px/16px var(--oc-mono, monospace);
    }

    @media (forced-colors: active) {
        kbd {
            color: CanvasText;
            border-color: currentColor;
        }
    }
`;
