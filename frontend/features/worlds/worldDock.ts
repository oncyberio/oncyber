/**
 * One dock for a framed world (docs/plans/framed-worlds.md, slice 3). The
 * page draws it. The world says which buttons it has (`dock`) and is told
 * when one is pressed (`dock-press`); what a button does stays in the
 * world. The voice button is the exception: the microphone is the page's,
 * so the page puts its own in that place and never asks the world.
 */

/** A dock button as it crosses the frame: how it looks, not what it does. */
export interface DockAction {
    id: string;
    label: string;
    icon?: string;
    active?: boolean;
    expanded?: boolean;
    disabled?: boolean;
    concealed?: boolean;
    badge?: number | string;
}

/** The id of the button the page answers itself. */
export const VOICE_ACTION = "voice";
const MAX_ACTIONS = 16;
const NAME = /^[a-z][a-z0-9-]{0,31}$/;

const flag = (value: unknown) => (value === true ? true : undefined);

function readAction(value: any): DockAction | null {
    if (
        typeof value?.id !== "string" ||
        !NAME.test(value.id) ||
        typeof value.label !== "string" ||
        !value.label ||
        value.label.length > 120
    )
        return null;
    const badge =
        typeof value.badge === "number" && Number.isFinite(value.badge)
            ? value.badge
            : typeof value.badge === "string" && value.badge.length <= 6
            ? value.badge
            : undefined;
    return {
        id: value.id,
        label: value.label,
        // A name from the design system's icon set, never an address.
        ...(typeof value.icon === "string" && NAME.test(value.icon)
            ? { icon: value.icon }
            : {}),
        ...(flag(value.active) ? { active: true } : {}),
        // Whether a button opens something is told apart from "not pressed".
        ...(typeof value.expanded === "boolean"
            ? { expanded: value.expanded }
            : {}),
        ...(flag(value.disabled) ? { disabled: true } : {}),
        ...(flag(value.concealed) ? { concealed: true } : {}),
        ...(badge === undefined ? {} : { badge }),
    };
}

/** The world's buttons, as the page accepts them from a `dock` message. */
export function readDock(message: any): DockAction[] {
    if (!Array.isArray(message?.actions)) return [];
    const seen = new Set<string>();
    const actions: DockAction[] = [];
    for (const value of message.actions.slice(0, MAX_ACTIONS)) {
        const action = readAction(value);
        if (!action || seen.has(action.id)) continue;
        seen.add(action.id);
        actions.push(action);
    }
    return actions;
}

/** The world's side: its buttons as a `dock` message. */
export function dockMessage(actions: DockAction[]) {
    return {
        actions: actions.map(
            ({
                id,
                label,
                icon,
                active,
                expanded,
                disabled,
                concealed,
                badge,
            }) => ({
                id,
                label,
                icon,
                active,
                expanded,
                disabled,
                concealed,
                badge,
            })
        ),
    };
}
