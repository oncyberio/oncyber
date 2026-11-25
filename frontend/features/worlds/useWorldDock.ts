import { useEffect, useRef } from "react";
import { worldDocument } from "./worldDocument";
import { CONNECTION_ACTION, dockMessage, type DockAction } from "./worldDock";

/** The connection line as the world's shell holds it. */
interface ShellConnection {
    state?: string;
    count?: number;
    reason?: string;
    action?: { label?: string; onClick?(): void };
}

/**
 * In a framed world, hands the dock and the connection line to the page:
 * they are drawn there (./worldDock) and a press comes back to run here.
 * `actions` is null where the world draws its own.
 */
export function useWorldDock(
    actions: (DockAction & { onClick(): void })[] | null,
    connection?: ShellConnection | null
) {
    const latest = useRef({ actions, connection });
    latest.current = { actions, connection };
    const said = actions
        ? JSON.stringify(dockMessage(actions, connection))
        : "";

    useEffect(() => {
        if (said) worldDocument()?.send("dock", JSON.parse(said));
    }, [said]);

    const framed = !!actions;
    useEffect(() => {
        if (!framed) return;
        return worldDocument()?.listen((kind, data) => {
            if (kind !== "dock-press") return;
            if (data?.id === CONNECTION_ACTION)
                return latest.current.connection?.action?.onClick?.();
            const pressed = latest.current.actions?.find(
                (action) => action.id === data?.id
            );
            if (pressed && !pressed.disabled && !pressed.concealed)
                pressed.onClick();
        });
    }, [framed]);
}
