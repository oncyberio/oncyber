import { useCallback, useRef, useState } from "react";
import { recipesEqual, type ToonAvatarRecipe } from "../recipe";

const LIMIT = 100;

/**
 * The recipe being edited, with undo and redo. `set(recipe, "drag")` during a
 * slider drag changes the recipe without adding a step per pixel: the whole
 * drag undoes as one.
 */
export function useRecipeHistory(initial: ToonAvatarRecipe) {
    const [recipe, setRecipe] = useState(initial);
    const past = useRef<ToonAvatarRecipe[]>([]);
    const future = useRef<ToonAvatarRecipe[]>([]);
    const dragging = useRef(false);
    const current = useRef(initial);
    const [, bump] = useState(0);

    const set = useCallback(
        (next: ToonAvatarRecipe, mode: "step" | "drag" = "step") => {
            if (recipesEqual(next, current.current)) return;
            if (mode === "step" || !dragging.current) {
                past.current.push(current.current);
                if (past.current.length > LIMIT) past.current.shift();
                future.current = [];
            }
            dragging.current = mode === "drag";
            current.current = next;
            setRecipe(next);
        },
        []
    );

    /** Ends a drag, so the next change starts a new undo step. */
    const commit = useCallback(() => {
        dragging.current = false;
    }, []);

    const travel = useCallback(
        (from: ToonAvatarRecipe[], to: ToonAvatarRecipe[]) => {
            const next = from.pop();
            if (!next) return;
            to.push(current.current);
            dragging.current = false;
            current.current = next;
            setRecipe(next);
            bump((n) => n + 1);
        },
        []
    );

    const undo = useCallback(
        () => travel(past.current, future.current),
        [travel]
    );
    const redo = useCallback(
        () => travel(future.current, past.current),
        [travel]
    );

    return {
        recipe,
        set,
        commit,
        undo,
        redo,
        canUndo: past.current.length > 0,
        canRedo: future.current.length > 0,
    };
}
