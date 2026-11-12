//

import { useContext, useState, useEffect } from "react";
import { UserContext, UPDATE_USER_DATA } from "@components/context/UserContext";
import { useWorld } from "@components/_3DExhibit-v2/hooks/useWorld";
import { EDITION_ACTIONS } from "@components/_3DExhibit-v2/three/constants";
import { updateUser } from "@utils/saveToDb";

export type TransformMode = "3d" | "snap";

export function useUserPrefTransformMode(): [
    TransformMode,
    () => Promise<void>
] {
    //
    const { user, token, userData, dispatch } = useContext(UserContext);

    const world = useWorld();

    const [transformMode, setTransformMode] = useState<TransformMode>(
        userData?.settings?.transformMode || "snap"
    );

    useEffect(() => {
        world.current.edit({
            type: EDITION_ACTIONS.EDITOR_CHANGE_TRANSFORM_CONTROLS,
            mode: transformMode,
        });
    }, [transformMode]);

    const toggleMode = async () => {
        //
        const newTransformMode = transformMode == "3d" ? "snap" : "3d";

        setTransformMode(newTransformMode);

        world.current.edit({
            type: EDITION_ACTIONS.EDITOR_CHANGE_TRANSFORM_CONTROLS,
            mode: newTransformMode,
        });

        dispatch({
            type: UPDATE_USER_DATA,
            payload: { settings: { transformMode: newTransformMode } },
        });

        await updateUser(
            token,
            { settings: { transformMode: newTransformMode } },
            user.id
        );
    };

    return [transformMode, toggleMode];
}
