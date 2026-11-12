import { useCallback, useState, DependencyList, useEffect } from "react";
import { useIsoLayoutEffect } from "./useIsoLayoutEffect";

export type RectResult = {
    bottom: number;
    height: number;
    left: number;
    right: number;
    top: number;
    width: number;
};

export function getRect<T extends HTMLElement>(element?: T): RectResult {
    let rect: RectResult = {
        bottom: 0,
        height: 0,
        left: 0,
        right: 0,
        top: 0,
        width: 0,
    };
    if (element) rect = element?.getBoundingClientRect();
    return rect;
}

export function useBoundingclientrectRef<T extends HTMLElement>(
    ref: React.RefObject<T>,
    callback: Function,
    deps: DependencyList
): RectResult {
    const [rect, setRect] = useState<RectResult>(
        ref && ref?.current ? getRect(ref?.current) : getRect()
    );

    const handleResize = useCallback(() => {
        if (!ref.current) return;
        const _rect = getRect(ref?.current);
        setRect(_rect);

        if (typeof callback === "function") {
            callback(_rect);
        }
    }, deps);

    useEffect(() => {
        const element = ref?.current;
        if (!element) return;

        handleResize();

        if (typeof ResizeObserver === "function") {
            let resizeObserver = new ResizeObserver(() => handleResize());
            resizeObserver.observe(element);
            resizeObserver.observe(document.body);
            return () => {
                if (!resizeObserver) return;
                resizeObserver.disconnect();
                resizeObserver = null;
            };
        } else {
            window.addEventListener("resize", handleResize);
            return () => window.removeEventListener("resize", handleResize);
        }
    }, deps);

    return rect;
}
