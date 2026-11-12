//
export type SpaceTab = "owned" | "collab";

export const ownedActions = [
    {
        value: "delete",
        title: "Delete space",
    },
    {
        value: "duplicate",
        title: "Duplicate space",
    },
] as const;

export const collabActions = [
    {
        value: "leave",
        title: "Leave space",
    },
] as const;

export type SpaceOwnedAction = typeof ownedActions[number]["value"];
export type SpaceCollabAction = typeof collabActions[number]["value"];
export type SpaceAction = SpaceOwnedAction | SpaceCollabAction;
