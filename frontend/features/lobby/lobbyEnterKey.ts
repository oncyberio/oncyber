/**
 * Where Enter goes at each stop of a trip. One composer is on screen at a
 * time, and Enter always reaches that one: the lobby chat in the lobby, the
 * party chat when it is open over a space, otherwise the space's own chat.
 */
export type EnterKeyTarget =
    | "lobby-chat"
    | "enter-world"
    | "party-chat"
    | "space-chat"
    | null;

export function enterKeyTarget(state: {
    /** The visitor is inside a space. */
    entered: boolean;
    /** A trip is on its way: nothing takes text until it lands. */
    travelling: boolean;
    /** A prepared destination waits for Enter. */
    worldReady: boolean;
    /** The party chat is showing over the space. */
    partyChatOverSpace: boolean;
}): EnterKeyTarget {
    if (state.entered)
        return state.partyChatOverSpace ? "party-chat" : "space-chat";
    if (state.travelling) return null;
    return state.worldReady ? "enter-world" : "lobby-chat";
}

/** Keys typed into a field or pressed on a control belong to it. */
export function ownsEnterKey(target: EventTarget | null) {
    // Duck-typed: the target can come from the space's own document.
    const element = target as Element | null;
    return !!element?.closest?.(
        'input,textarea,select,button,a,[contenteditable="true"],[role="dialog"],[role="menu"]'
    );
}
