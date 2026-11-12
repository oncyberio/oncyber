import {
    APP_STATES,
    CANVAS,
    CURRENT_STATE,
    IS_DESKTOP,
    IS_POINTER_LOCK,
} from "@3constants";
import { useEventCallback } from "@components/hooks/useEventCallback";
import { useEffect } from "react";
import { WorldState } from "../utils/constants";

type WorldMode = "edit" | "display";

export function usePointerLock(active: boolean) {
    //

    useEffect(() => {
        //

        if (active) {
            //
            const handleMouseDown = () => {
                //

                if (!IS_POINTER_LOCK()) {
                    CANVAS.requestPointerLock();
                }
            };

            CANVAS.addEventListener("pointerdown", handleMouseDown);

            return () => {
                //
                CANVAS.removeEventListener("pointerdown", handleMouseDown);

                if (IS_POINTER_LOCK()) {
                    //
                    document.exitPointerLock();
                }
            };
        }
    }, [active]);
}
