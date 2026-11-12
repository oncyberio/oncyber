import {
    isDockPanel,
    legacyPanelTab,
    spacePanelTransition as step,
    type PanelTab,
    type SpacePanel,
    type SpacePanelEvent,
} from "./spacePanelMachine";

type Open = Exclude<SpacePanel, "">;
const open = (panel: Open): SpacePanelEvent => ({ type: "open", panel });
const toggle = (panel: Open): SpacePanelEvent => ({ type: "toggle", panel });
const close = (panel?: Open): SpacePanelEvent => ({ type: "close", panel });
const tab = (value: PanelTab): SpacePanelEvent => ({ type: "tab", tab: value });

const PANELS: Open[] = [
    "users",
    "profile",
    "profile-explore",
    "profile-menu",
    "dashboard",
    "explore",
    "settings",
    "feedback",
    "report",
    "help",
    "screenShot",
    "requests",
    "voiceRequests",
    "audioSharing",
    "select-media-placeholder",
    "emotes",
    "more",
    "search",
];

test.each<[string, SpacePanel, SpacePanelEvent, SpacePanel]>([
    ["a dock button opens its panel", "", toggle("emotes"), "emotes"],
    ["the same button closes it", "emotes", toggle("emotes"), ""],
    ["another dock panel replaces it", "emotes", toggle("more"), "more"],
    ["a tab replaces a dock panel", "more", toggle("explore"), "explore"],
    ["a dock panel replaces a tab", "users", toggle("search"), "search"],
    ["a tab replaces a tab", "users", toggle("profile"), "profile"],
    ["the same tab closes", "profile", toggle("profile"), ""],
    ["open opens", "", open("search"), "search"],
    ["open replaces", "users", open("search"), "search"],
    ["open on the open panel changes nothing", "more", open("more"), "more"],
    ["close closes whichever is open", "users", close(), ""],
    ["close closes the panel it names", "emotes", close("emotes"), ""],
    ["close ignores a panel that is not open", "more", close("emotes"), "more"],
    ["close with nothing open changes nothing", "", close("search"), ""],
    ["an older write opens over a dock panel", "emotes", tab("users"), "users"],
    ["an older write replaces a tab", "users", tab("profile"), "profile"],
    ["an older clear closes a tab", "users", tab(""), ""],
    ["an older clear leaves a dock panel", "search", tab(""), "search"],
    ["an older clear with nothing open", "", tab(""), ""],
])("%s", (_name, state, event, next) => {
    expect(step(state, event)).toBe(next);
});

test("opening any panel from any other leaves only the new one open", () => {
    for (const from of ["", ...PANELS] as SpacePanel[])
        for (const to of PANELS) {
            expect(step(from, open(to))).toBe(to);
            expect(step(from, toggle(to))).toBe(from === to ? "" : to);
        }
});

test("older panel code sees its own tabs and nothing while a dock panel is open", () => {
    const dock: SpacePanel[] = ["emotes", "more", "search"];
    expect(PANELS.filter((panel) => isDockPanel(panel))).toEqual(dock);
    for (const panel of PANELS)
        expect(legacyPanelTab(panel)).toBe(dock.includes(panel) ? "" : panel);
    expect(legacyPanelTab("")).toBe("");
});

test("an unknown event leaves the panel as it was", () => {
    expect(step("users", { type: "rename" } as any)).toBe("users");
});
