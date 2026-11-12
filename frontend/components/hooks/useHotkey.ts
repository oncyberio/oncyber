import { useEffect } from "react";
import { useEventCallback } from "./useEventCallback";

const TagsKeyCapture = ["INPUT", "BUTTON", "TEXTAREA"];

export function hasTarget(e: KeyboardEvent) {
    //
    const target = e.target as HTMLElement;

    return (
        TagsKeyCapture.includes(target.tagName) ||
        (e.target as any).id === "gpt-input" ||
        target.className.includes("cm-content") ||
        target.dataset?.noundo
    );
}

export function useHotkey(handler: (e: KeyboardEvent) => unknown) {
    //
    const callback = useEventCallback(handler, []);

    useEffect(() => {
        //
        function handleKey(e: KeyboardEvent) {
            //

            if (e.repeat || hasTarget(e)) return;

            // console.log("hot key", e);

            callback(e);
        }

        window.addEventListener("keydown", handleKey);

        return () => window.removeEventListener("keydown", handleKey);
        //
    }, []);
}
