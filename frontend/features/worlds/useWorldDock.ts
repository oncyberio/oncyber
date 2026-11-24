import { useEffect, useRef } from "react";
import { worldDocument } from "./worldDocument";
import { dockMessage, type DockAction } from "./worldDock";

/**
 * In a framed world, hands the dock to the page: the buttons are drawn
 * there (./worldDock) and a press comes back to run here. `actions` is
 * null where the world draws its own dock.
 */
export function useWorldDock(
    actions: (DockAction & { onClick(): void })[] | null
) {
    const latest = useRef(actions);
    latest.current = actions;
    const said = actions ? JSON.stringify(dockMessage(actions)) : "";

    useEffect(() => {
        if (said) worldDocument()?.send("dock", JSON.parse(said));
    }, [said]);

    const framed = !!actions;
    useEffect(() => {
        if (!framed) return;
        return worldDocument()?.listen((kind, data) => {
            if (kind !== "dock-press") return;
            const pressed = latest.current?.find(
                (action) => action.id === data?.id
            );
            if (pressed && !pressed.disabled && !pressed.concealed)
                pressed.onClick();
        });
    }, [framed]);
}
