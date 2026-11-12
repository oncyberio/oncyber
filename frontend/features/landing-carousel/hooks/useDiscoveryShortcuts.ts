import { RefObject, useEffect } from "react";

interface Options {
    enabled?: boolean;
    scope?: RefObject<HTMLElement>;
    onSearch: () => void;
    onMenu: () => void;
}

/** Discovery shortcuts may be restricted to a panel without affecting other UI. */
export default function useDiscoveryShortcuts({
    enabled = true,
    scope,
    onSearch,
    onMenu,
}: Options) {
    useEffect(() => {
        if (!enabled) return;

        function getTarget(event: Event) {
            const target = event.target;
            if (!(target instanceof Element)) return null;
            if (scope && !scope.current?.contains(target)) return null;
            return target;
        }

        function keyboard(event: KeyboardEvent) {
            if (
                event.defaultPrevented ||
                event.isComposing ||
                event.keyCode === 229
            )
                return;
            const target = getTarget(event);
            if (!target) return;
            if (
                event.key.toLowerCase() === "k" &&
                (event.metaKey || event.ctrlKey) &&
                !event.altKey
            ) {
                event.preventDefault();
                onSearch();
                return;
            }
            const editable =
                /INPUT|TEXTAREA|SELECT/.test(target.tagName) ||
                (target as HTMLElement).isContentEditable ||
                target.closest('[contenteditable="true"]');
            if (
                event.key === "/" &&
                (target.id === "landing-search" || !editable) &&
                !event.metaKey &&
                !event.ctrlKey &&
                !event.altKey
            ) {
                event.preventDefault();
                onMenu();
            }
        }

        function beforeInput(event: InputEvent) {
            // Virtual keyboards can insert text without a keydown event.
            if (
                !event.defaultPrevented &&
                event.data === "/" &&
                event.inputType === "insertText" &&
                getTarget(event)?.id === "landing-search" &&
                !event.isComposing &&
                event.cancelable
            ) {
                event.preventDefault();
                onMenu();
            }
        }

        document.addEventListener("keydown", keyboard);
        document.addEventListener("beforeinput", beforeInput);
        return () => {
            document.removeEventListener("keydown", keyboard);
            document.removeEventListener("beforeinput", beforeInput);
        };
    }, [enabled, scope, onSearch, onMenu]);
}
