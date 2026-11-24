import type { WorldMod } from "../../types";
import { paintSkyBackground } from "../../paintedSky/paintedSky";
import { STARRY_NIGHT_STROKES } from "./strokeFile";

/**
 * The Starry Night: its sky image is repainted as brush strokes so it stays
 * sharp at any zoom (stroke file built by tasks/painted-sky), and the first
 * house down the road can be walked into (house/).
 */
const starryNight: WorldMod = {
    onBackground: ({ background, mobile }) =>
        paintSkyBackground(background, STARRY_NIGHT_STROKES.url, { mobile }),

    onScene: async (context) => {
        const [{ openHouse }, { engineSurroundings }] = await Promise.all([
            import("./house/openHouse"),
            import("./house/engine"),
        ]);
        openHouse(context, engineSurroundings());
    },
};

export default starryNight;
