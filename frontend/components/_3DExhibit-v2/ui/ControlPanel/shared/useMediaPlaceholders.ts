import { useMemo } from "react";
import { useMultiplayer } from "@components/_3DExhibit-v2/context/MultiplayerProvider";
import { usePanel } from "../context/PanelProvider";
import { useCurrentExhibit } from "@features/studio/context/ExhibitContext";

const FREE_PLACEHOLDER_ID = "@@free-placeholder@@";

const freePlaceholder = {
    id: FREE_PLACEHOLDER_ID,
    name: "Custom placement",
    width: 46,
    height: 44,
    color: "rgba(255, 255, 255, 0.2)",
};

export function useMediaPlaceholders() {
    //
    const { exhibit } = usePanel();

    const { voice } = useMultiplayer();

    const { voiceState, voiceUsers } = voice;

    const placeholdersInUse = useMemo(() => {
        //
        const result = {};

        if (
            voiceState.type === "enabled" &&
            voiceState.state.isPlaying &&
            voiceState.state.videoStreamState?.hasVideo
        ) {
            const placeholderId =
                voiceState.state.videoStreamState?.placeholderId ??
                FREE_PLACEHOLDER_ID;

            result[placeholderId] = true;
        }

        Object.values(voiceUsers).forEach((user) => {
            //
            const placeholderId = user.videoStreamState?.placeholderId;

            if (placeholderId) {
                //
                result[placeholderId] = true;
                //
            }
            //
        });

        return result;
        //
    }, [voiceUsers, voiceState]);

    const placeholders = useMemo(() => {
        //
        const components = Object.values(exhibit.kitbash || {}).filter((it) => {
            //
            return it.type === "media-placeholder";
            //
        });

        return components.map((component) => {
            //
            return {
                id: component.id,
                name: `${component.name} (${component.ratio.name})`,
                width: Math.round(33 * component.ratio.coef),
                height: 33,
            };
            //
        });
        //
    }, [exhibit.kitbash, placeholdersInUse]);

    const nbAvailable = useMemo(() => {
        //
        return placeholders.length + 1 - Object.keys(placeholdersInUse).length;
        //
    }, [placeholdersInUse, placeholders]);

    return {
        placeholders,
        placeholdersInUse,
        freePlaceholder,
        nbAvailable,
    };
}
