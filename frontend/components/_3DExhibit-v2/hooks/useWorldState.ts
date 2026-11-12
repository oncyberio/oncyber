//
import Events from "@3events";
import { AppState, CURRENT_STATE } from "../three/shellconstants";
import { useWorldStore } from "./useWorldStore";
import { WorldStore } from "./WorldStore";

interface WorldState {
    state: AppState;
    hasSpace: boolean;
    mode: "edit" | "display" | "cinematic";
}

const initState: WorldState = {
    state: CURRENT_STATE,
    hasSpace: false,
    mode: null,
};

const worldStateStore = new WorldStore(
    initState,
    [
        {
            event: Events.WORLD_STATE_CHANGED,
            update(opts, _) {
                return opts;
            },
        },
    ],
    true
);

export function useWorldState() {
    //
    return useWorldStore(worldStateStore);
}
