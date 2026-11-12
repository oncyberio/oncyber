import { useRef, useEffect, useState, MutableRefObject } from "react";

export interface XY {
    x: number;
    y: number;
}

let defBounds = { x: 0, y: 0, width: 0, height: 0 };

export function useDrag(
    handle: HTMLElement,
    element?: HTMLElement,
    onChange?: (coords: XY) => unknown,
    debug?: string
) {
    //

    useEffect(() => {
        //
        if (debug) {
            console.log(debug, "useDrag enter", handle, element);
        }

        if (handle == null) return;

        let startX = 0;
        let startY = 0;
        let currentX = 0;
        let currentY = 0;

        const onPointerDown = (event: PointerEvent) => {
            event.preventDefault();
            event.stopPropagation();

            const { x, y } = element?.getBoundingClientRect() || defBounds;

            startX = event.clientX - x;
            startY = event.clientY - y;

            handle.setPointerCapture(event.pointerId);
            handle.addEventListener("pointermove", onPointerMove);
        };

        const onPointerMove = (event: PointerEvent) => {
            //
            event.stopPropagation();

            let dx = event.clientX - currentX;
            let dy = event.clientY - currentY;

            currentX = event.clientX - startX;
            currentY = event.clientY - startY;

            let coords = { x: currentX, y: currentY, dx, dy };

            onChange?.(coords);

            if (element) {
                //
                element.style.transform = `translate(${coords.x}px, ${coords.y}px)`;
            }
        };

        const onPointerUp = (event: PointerEvent) => {
            event.stopPropagation();
            handle.releasePointerCapture(event.pointerId);
            handle.removeEventListener("pointermove", onPointerMove);
        };

        handle.addEventListener("pointerdown", onPointerDown);
        handle.addEventListener("pointerup", onPointerUp);

        return () => {
            //
            if (debug) {
                console.log(debug, "useDrag enter", handle, element);
            }

            handle.removeEventListener("pointerdown", onPointerDown);
            handle.removeEventListener("pointerup", onPointerUp);
        };
    }, [handle, element, onChange]);
}
