/**
 * The one panel open over a space, as a pure state machine.
 *
 * A space has two families of panels: the ones the control panel has always
 * had (`PanelTab`: users, profile, explore, ...) and the three the visitor
 * dock opens itself (emotes, more, search). `SpacePanel` is the single value
 * for both, so opening any panel replaces whichever was open and two can
 * never be open at once. Chat is not a panel and is never touched here.
 *
 * `PanelProvider` holds the value and applies `spacePanelTransition`. Older
 * panel code keeps reading `currentTab` and calling `setCurrentTab`:
 * `legacyPanelTab` is that read, and a `tab` event is that write.
 *
 *   ""  ─ open / toggle / tab ─▶ panel ─ open / toggle / tab (another) ─▶ other
 *   panel ─ toggle (same) / close ─▶ ""
 *   dock panel ─ tab "" ─▶ unchanged
 */

/** A control-panel popover or sub-flow; "" means none. */
export type PanelTab =
    | ""
    | "users"
    | "profile"
    | "profile-explore"
    | "profile-menu"
    | "dashboard"
    | "explore"
    | "settings"
    | "feedback"
    | "report"
    | "help"
    | "screenShot"
    | "requests"
    | "voiceRequests"
    | "audioSharing"
    | "select-media-placeholder";

/** A panel the visitor dock opens itself. */
export type DockPanel = "emotes" | "more" | "search";

/** The panel open over the space; "" means none. */
export type SpacePanel = PanelTab | DockPanel;

type OpenPanel = Exclude<SpacePanel, "">;

export type SpacePanelEvent =
    | { type: "open"; panel: OpenPanel }
    /** A dock button: closes its own panel, otherwise opens it. */
    | { type: "toggle"; panel: OpenPanel }
    /** With `panel`, only when that panel is the open one. */
    | { type: "close"; panel?: OpenPanel }
    /**
     * A `setCurrentTab` write from older panel code. A tab replaces whichever
     * panel is open. "" closes a tab and leaves a dock panel alone: that code
     * clears its tab on hover, on outside clicks and when the mode menu
     * opens, and none of those has ever closed emotes, more or search.
     */
    | { type: "tab"; tab: PanelTab };

const DOCK_PANELS: readonly string[] = ["emotes", "more", "search"];

export const isDockPanel = (panel: SpacePanel): panel is DockPanel =>
    DOCK_PANELS.includes(panel);

/** What older panel code reads as `currentTab`. */
export const legacyPanelTab = (panel: SpacePanel): PanelTab =>
    isDockPanel(panel) ? "" : panel;

export function spacePanelTransition(
    state: SpacePanel,
    event: SpacePanelEvent
): SpacePanel {
    switch (event.type) {
        case "open":
            return event.panel;
        case "toggle":
            return state === event.panel ? "" : event.panel;
        case "close":
            return event.panel && event.panel !== state ? state : "";
        case "tab":
            return event.tab || (isDockPanel(state) ? state : "");
        default:
            return state;
    }
}
