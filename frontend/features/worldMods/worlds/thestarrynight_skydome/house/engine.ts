import Emitter from "@3emitter";
import Events from "@components/_3DExhibit-v2/three/events/events";
import Players from "@3factory/player";
import { RenderDemand } from "@components/_3DExhibit-v2/three/utils/renderDemand";
import type { HouseSurroundings } from "./openHouse";

/** The running engine, as the house sees it. */
export function engineSurroundings(): HouseSurroundings {
    return {
        onFrame: (frame) => {
            Emitter.on(Events.PRE_UPDATE, frame);
            return () => Emitter.off(Events.PRE_UPDATE, frame);
        },
        visitor: (into) => {
            const position = Players.main?.position;
            if (!position) return false;
            into.copy(position);
            return true;
        },
        redraw: () => RenderDemand.invalidate(),
    };
}
