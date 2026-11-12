import { useEventCallback } from "@components/hooks/useEventCallback";
import { Experience } from "@uitypes/experience";
import { deepEqual } from "@utils/js";
import { useSpaceGatingEditor } from "../context/SpaceGatingContext";
import { GatingData, GatingType } from "../types";

export function useGatingEditCancel<K extends GatingType>(
    key: K,
    state: GatingData[K]
) {
    const { gating, editGating } = useSpaceGatingEditor();

    const cancelGatingEdit = useEventCallback(() => {
        //
        if (!deepEqual(state, gating?.[key])) {
            editGating(
                {
                    [key]: state,
                },
                "undo"
            );
        }
    }, [state, gating, editGating]);

    return cancelGatingEdit;
}
