import { useSyncExternalStore } from "react";

/**
 * Whether the world in the page's frame holds the pointer. The page cannot
 * see a lock taken inside the frame, so the world says (`pointer-lock`) and
 * the page's interface steps back as it does for a lock of its own.
 */
let locked = false;
const watchers = new Set<() => void>();

export function setFramedWorldLock(next: boolean) {
    if (locked === next) return;
    locked = next;
    watchers.forEach((watcher) => watcher());
}

const subscribe = (watcher: () => void) => {
    watchers.add(watcher);
    return () => void watchers.delete(watcher);
};

export function useFramedWorldLock() {
    return useSyncExternalStore(
        subscribe,
        () => locked,
        () => false
    );
}
