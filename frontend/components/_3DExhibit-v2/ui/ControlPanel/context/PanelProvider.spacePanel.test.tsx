/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import PanelProvider, { usePanel } from "./PanelProvider";
import { amplitude_logAnalyticsEvent } from "@utils/analytics";

jest.mock("@utils/nativeCameraPreference", () => ({
    readNativeCameraPreference: (camera) => camera,
    rememberNativeCameraPreference: jest.fn(),
}));
jest.mock("@utils/lobbyDestinationBridge", () => ({
    isLobbyDestinationPreparing: () => false,
}));
jest.mock("@components/context/AssetsContext", () => ({
    getDefaultRepo: () => "repo",
}));
jest.mock("@components/context/UserContext", () => ({
    UPDATE_USER_DATA: "UPDATE_USER_DATA",
    UserContext: require("react").createContext({
        user: { id: "visitor" },
        userData: {},
        dispatch: () => {},
        token: "",
    }),
}));
jest.mock("@components/hooks/useAssets", () => ({
    useOwnedAssets: () => ({}),
}));
jest.mock("@components/_3DExhibit-v2/context/MultiplayerProvider", () => ({
    useMultiplayer: () => ({
        chat: { setIsChatDisplayed: jest.fn() },
        mode: "multiplayer",
        voice: {
            hasSpeakingUsers: false,
            voiceUsers: {},
            voiceState: { type: "disabled" },
        },
        room: { id: "room", label: "space", isMod: false, numOfUsers: 3 },
        _onChangeModeCallback: { current: null },
        _onConnect: { current: null },
    }),
}));
jest.mock("@components/_3DExhibit-v2/hooks/useWorld", () => ({
    useWorld: () => ({ current: {} }),
}));
jest.mock("@components/_3DExhibit-v2/three/constants", () => ({
    IS_MOBILE: false,
    IS_FIRST_PERSON: false,
}));
jest.mock("@utils/analytics", () => ({
    amplitude_logAnalyticsEvent: jest.fn(),
}));
jest.mock("@utils/saveToDb", () => ({ updateUser: jest.fn() }));
jest.mock("@components/context/VrmContext", () => ({
    useVrm: () => ({
        initVrm: jest.fn(),
        _handleSaveSettings: { current: null },
        _handleSettings: { current: null },
        _settings: { current: null },
    }),
}));

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let panel: ReturnType<typeof usePanel>;
const exitPointerLock = document.exitPointerLock;
function Probe() {
    panel = usePanel();
    return null;
}
const key = (value: string) =>
    act(() => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: value }));
    });
const opened = () => [panel.spacePanel, panel.currentTab];

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    document.exitPointerLock = jest.fn();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    act(() =>
        root.render(
            <PanelProvider
                exhibit={{ id: "space", params: {} }}
                isArtworkInfoShowing={false}
                isPlaying
                artwork={null}
                enterVR={jest.fn()}
                setMobileViewState={jest.fn()}
                isModeMenuOpen={false}
                setModeMenuOpen={jest.fn()}
                sceneContainer={{ current: null }}
                settings={{ camera: "third_person" }}
                setSettings={jest.fn()}
                destination={{}}
            >
                <Probe />
            </PanelProvider>
        )
    );
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
    document.exitPointerLock = exitPointerLock;
    jest.clearAllMocks();
});

test("one value holds the open panel and older code reads it as currentTab", () => {
    expect(opened()).toEqual(["", ""]);
    act(() => panel.dispatchSpacePanel({ type: "toggle", panel: "emotes" }));
    expect(opened()).toEqual(["emotes", ""]);
    act(() => panel.setCurrentTab("explore"));
    expect(opened()).toEqual(["explore", "explore"]);
    act(() => panel.dispatchSpacePanel({ type: "toggle", panel: "more" }));
    expect(opened()).toEqual(["more", ""]);
    act(() => panel.dispatchSpacePanel({ type: "close", panel: "emotes" }));
    expect(opened()).toEqual(["more", ""]);
    act(() => panel.dispatchSpacePanel({ type: "close", panel: "more" }));
    expect(opened()).toEqual(["", ""]);
});

test("the U and P shortcuts replace a dock panel instead of opening beside it", () => {
    act(() => panel.dispatchSpacePanel({ type: "open", panel: "emotes" }));
    key("u");
    expect(opened()).toEqual(["users", "users"]);
    key("u");
    expect(opened()).toEqual(["", ""]);
    act(() => panel.dispatchSpacePanel({ type: "open", panel: "search" }));
    key("p");
    expect(opened()).toEqual(["profile", "profile"]);
});

test("older code clearing its tab does not close a dock panel", () => {
    act(() => panel.dispatchSpacePanel({ type: "open", panel: "more" }));
    act(() => panel.setCurrentTab(""));
    act(() => panel.setCurrentTab((tab) => (tab === "users" ? "" : tab)));
    expect(opened()).toEqual(["more", ""]);
});

test("the panel analytics event is still sent for older tabs only", () => {
    act(() => panel.dispatchSpacePanel({ type: "open", panel: "emotes" }));
    expect(amplitude_logAnalyticsEvent).not.toHaveBeenCalled();
    act(() => panel.setCurrentTab("users"));
    expect(amplitude_logAnalyticsEvent).toHaveBeenCalledTimes(1);
    expect(amplitude_logAnalyticsEvent).toHaveBeenCalledWith(
        "open_panel_modal",
        expect.objectContaining({ type: "users", roomId: "room" })
    );
    act(() => panel.dispatchSpacePanel({ type: "toggle", panel: "search" }));
    expect(amplitude_logAnalyticsEvent).toHaveBeenCalledTimes(1);
});
