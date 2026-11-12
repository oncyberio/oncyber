import Events from "@3events";
import { APP_STATES } from "@3constants";
import { useWorld } from "./useWorld";
import { useWorldHandler } from "./useWorldHandler";
import { useEventCallback } from "@components/hooks/useEventCallback";

export function usePanoModeHandler(active: boolean) {
    //

    const world = useWorld();

    console.log("usePanoModeHandler", active);

    const enterPano = useEventCallback((opts) => {
        world.current.setState(APP_STATES.PANORAMA, opts);
    }, []);

    const exitPano = useEventCallback((opts) => {
        world.current.setState(APP_STATES.SPACE, opts);
    }, []);

    useWorldHandler(Events.PANORAMA_OPENING, !active ? null : enterPano);

    useWorldHandler(Events.PANORAMA_CLOSING, !active ? null : exitPano);
}
