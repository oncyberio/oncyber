import { useEffect, useMemo, useState } from "react";
import VRMS from "@components/_3DExhibit-v2/three/factory/player/vrms.json";
import {
    PROCEDURAL_AVATARS,
    figureAvatarUrl,
} from "@features/procedural-avatar/catalogue";
import {
    createRecordingCrowd,
    readRecordingCrowd,
    type CrowdAvatar,
    type RecordingCrowd,
    type RecordingCrowdOptions,
} from "./recordingCrowd";

/**
 * How many variations of a figure avatar a crowd wears. Each is a model
 * of its own to build, so a few go a long way: the crowd repeats them.
 */
export const CROWD_FIGURE_LOOKS = 12;

/**
 * The avatars a staged crowd wears. `crowdAvatars` names catalogue or
 * procedural avatars; a figure avatar among them stands for a dozen of
 * its variations. Without it, the crowd wears figures.
 */
export function crowdWardrobe(options: RecordingCrowdOptions): CrowdAvatar[] {
    const ids = options.avatarIds.length ? options.avatarIds : ["figure"];
    const catalogue = Object.values(VRMS) as {
        id: string;
        url: string;
        image?: string;
    }[];
    const avatars: CrowdAvatar[] = [];
    for (const id of ids) {
        const procedural = PROCEDURAL_AVATARS.find((item) => item.id === id);
        if (procedural?.figure) {
            // Variation 0 is the avatar as drawn: that one is yours.
            for (let look = 1; look <= CROWD_FIGURE_LOOKS; look++)
                avatars.push({
                    url: figureAvatarUrl(id, look),
                    image: procedural.image,
                });
            continue;
        }
        if (procedural) {
            avatars.push({ url: procedural.url, image: procedural.image });
            continue;
        }
        const builtin = catalogue.find((item) => item.id === id);
        if (builtin) avatars.push({ url: builtin.url, image: builtin.image });
    }
    return avatars;
}

/**
 * The staged crowd for `?crowd=N`, or null. Read after mount so the server
 * render and the first client render agree. Local only: nobody else sees
 * these people.
 */
export default function useRecordingCrowd(): {
    options: RecordingCrowdOptions;
    crowd: RecordingCrowd;
} | null {
    const [options, setOptions] = useState<RecordingCrowdOptions | null>(null);
    useEffect(() => setOptions(readRecordingCrowd()), []);
    return useMemo(
        () =>
            options
                ? {
                      options,
                      crowd: createRecordingCrowd(
                          options,
                          crowdWardrobe(options)
                      ),
                  }
                : null,
        [options]
    );
}
