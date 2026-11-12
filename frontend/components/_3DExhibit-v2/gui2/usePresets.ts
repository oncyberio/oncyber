// @ts-check

import { getLens } from "./lens";
import { idFormat } from "./formats";
import { useRef } from "react";
import { useDispatcher } from "./Dispatcher";
import { useEventCallback } from "@components/hooks/useEventCallback";

export function usePreset({ preset, onChange }) {
    //
    const dispatcher = useDispatcher();

    const selected = preset.isApplied();

    const image = preset.image;

    const label = preset.label;

    const alt = preset.name;

    const onClick = useEventCallback(() => {
        //

        dispatcher.dispatch({
            //
            run: async () => {
                //
                const info = { preset: name };

                const canUndo = dispatcher.supportsUndo;

                const result = preset.apply(canUndo);

                onChange?.(preset);

                if (result) {
                    return {
                        info,
                        ...result,
                    };
                }
            },
            isProggress: false,
        });
    }, []);

    return {
        image,
        alt,
        label,
        selected,
        onClick,
    };
}
