import { useEffect, useRef } from "react";

/** How far a pointer may travel and still be a click, not a drag. */
const DRAG_DISTANCE = 8;
/** Menus and dialogs a panel opens are drawn outside it but belong to it. */
const OWN_LAYERS = '[aria-modal="true"], [role="menu"], [role="listbox"]';

type Part = Element | null | undefined;

/** Whether a click landed on one of the parts, or in the space they span. */
export function clickedWithin(
    parts: readonly Part[],
    event: Pick<MouseEvent, "target" | "clientX" | "clientY">
) {
    const target = event.target as Element | null;
    if (target?.closest?.(OWN_LAYERS)) return true;
    return parts.some((part) => {
        if (!part) return false;
        if (target && part.contains(target)) return true;
        // The gaps between a panel's cards and bars belong to it too.
        const area = part.getBoundingClientRect();
        return (
            area.width > 0 &&
            area.height > 0 &&
            event.clientX >= area.left &&
            event.clientX <= area.right &&
            event.clientY >= area.top &&
            event.clientY <= area.bottom
        );
    });
}

/**
 * Close an open panel when the visitor clicks away from it.
 *
 * `parts` are the panel and whatever opened it. A drag in the world (turning
 * the avatar or the camera) is not a click away, and neither is the click
 * that opened the panel, which is still on its way up when this starts.
 */
export default function useClickAway(
    active: boolean,
    parts: () => readonly Part[],
    onAway: () => void
) {
    const latest = useRef({ parts, onAway });
    latest.current = { parts, onAway };
    useEffect(() => {
        if (!active) return;
        const openedAt = performance.now();
        let pressed: { x: number; y: number } | null = null;
        let dragged = false;
        const travelled = (event: MouseEvent) =>
            !!pressed &&
            Math.hypot(event.clientX - pressed.x, event.clientY - pressed.y) >
                DRAG_DISTANCE;
        const press = (event: PointerEvent) => {
            pressed = { x: event.clientX, y: event.clientY };
            dragged = false;
        };
        // A drag that comes back to where it began is still a drag.
        const move = (event: PointerEvent) => {
            if (travelled(event)) dragged = true;
        };
        const away = (event: MouseEvent) => {
            const wasDrag = dragged || travelled(event);
            pressed = null;
            dragged = false;
            if (event.timeStamp <= openedAt || wasDrag) return;
            if (clickedWithin(latest.current.parts(), event)) return;
            latest.current.onAway();
        };
        // Panels stop pointer events from reaching the world, so the press
        // is read on the way down.
        document.addEventListener("pointerdown", press, true);
        document.addEventListener("pointermove", move, true);
        document.addEventListener("click", away);
        return () => {
            document.removeEventListener("pointerdown", press, true);
            document.removeEventListener("pointermove", move, true);
            document.removeEventListener("click", away);
        };
    }, [active]);
}
