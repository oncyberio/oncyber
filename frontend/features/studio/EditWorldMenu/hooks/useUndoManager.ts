import { IS_MAC } from "@components/_3DExhibit-v2/three/constants";
import { useEffect } from "react";
import { useEditWorld } from "../context/WorldEditContext";

//

const TagsKeyCapture = ["INPUT", "TEXTAREA"];

export function hasTarget(e: KeyboardEvent) {
    //
    const target = e.target as HTMLElement;

    return (
        TagsKeyCapture.includes(target.tagName) ||
        (e.target as any).id === "gpt-input" ||
        target.className.includes("cm-content")
    );
}

function isUndoTarget(e: KeyboardEvent) {
    //
    let b = hasTarget(e);

    if (!b) return false;

    if (e.target instanceof HTMLElement) {
        //
        return !e.target.dataset?.noundo;
    }

    return b;
}

export function useUndoManager() {
    //
    const { undo, redo } = useEditWorld();

    useEffect(() => {
        function handleKey(e: KeyboardEvent) {
            //
            const cmd = IS_MAC ? e.metaKey : e.ctrlKey;

            if (!e.repeat && cmd && !isUndoTarget(e)) {
                //

                if (e.key === "z" || e.key === "Z") {
                    //
                    e.stopPropagation();
                    e.preventDefault();

                    undo();
                } else if (e.key === "y" || e.key === "Y") {
                    //
                    e.stopPropagation();
                    e.preventDefault();

                    redo();
                }
            }
        }

        window.addEventListener("keydown", handleKey, { capture: true });

        return () => {
            //
            window.removeEventListener("keydown", handleKey, { capture: true });
        };
    }, []);
}
