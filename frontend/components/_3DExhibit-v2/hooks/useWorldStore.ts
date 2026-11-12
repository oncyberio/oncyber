import { useEffect, useSyncExternalStore, useRef } from "react";
import { useWorld } from "./useWorld";
import { WorldStore } from "./WorldStore";

export function useWorldStore<T>(store: WorldStore<T>) {
    //
    const state = useSyncExternalStore(
        store.subscribe,
        store.getState,
        store.getServerSnapshot
    );

    return state;
}
