/** @jest-environment jsdom */
import React, { act, useState } from "react";
import { createRoot } from "react-dom/client";
import NativeExperienceChrome from "./NativeExperienceChrome";
import {
    nativeCompactControlsQuery,
    nativePhoneControlsQuery,
} from "./experienceChrome";
import { useMultiplayer } from "@components/_3DExhibit-v2/context/MultiplayerProvider";
import { usePanel } from "@components/_3DExhibit-v2/ui/ControlPanel/context/PanelProvider";
import {
    legacyPanelTab,
    spacePanelTransition,
    type SpacePanel,
} from "@components/_3DExhibit-v2/ui/ControlPanel/context/spacePanelMachine";
import { useWorld } from "@components/_3DExhibit-v2/hooks/useWorld";
import { showPrompt } from "@components/Dialogs";
import { useMediaQuery } from "@components/hooks/useMediaQuery";

jest.mock("@components/hooks/useMediaQuery", () => ({
    useMediaQuery: jest.fn(),
}));

const mockPush = jest.fn();
jest.mock("next/router", () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock("@features/lobby/LobbyExplorePanel", () => ({
    __esModule: true,
    default: ({ active, onClose, onSelect }: any) => (
        <section id="lobby-explore" data-active={active}>
            <button aria-label="Close search" onClick={onClose} />
            <button
                aria-label="Open Museum"
                onClick={() =>
                    onSelect({ id: "m", title: "Museum", href: "/museum" })
                }
            />
        </section>
    ),
}));
jest.mock("@features/landing-carousel/components/Header", () => ({
    __esModule: true,
    default: () => <header />,
}));
jest.mock("@components/_3DExhibit-v2/context/MultiplayerProvider", () => ({
    useMultiplayer: jest.fn(),
}));
jest.mock("@components/_3DExhibit-v2/hooks/useWorld", () => ({
    useWorld: jest.fn(),
}));
jest.mock(
    "@components/_3DExhibit-v2/ui/ControlPanel/context/PanelProvider",
    () => ({ usePanel: jest.fn(), Mode: { MULTIPLAYER: 0, SOLO: 1 } })
);
jest.mock(
    "@components/_3DExhibit-v2/three/factory/player/instanceavatarvrm/constants",
    () => ({ EMOTES: [{ name: "WAVING" }, { name: "HIPHOP" }] })
);
// Stands in for the voice level readout's lazy chunk, and keeps its loader.
jest.mock("next/dynamic", () => {
    const loaders: Array<() => Promise<any>> = [];
    const dynamic = (loader: () => Promise<any>) => {
        loaders.push(loader);
        return ({ voiceService }: any) => (
            <div data-voice-debug="" data-service={voiceService?.name} />
        );
    };
    return Object.assign(dynamic, { loaders });
});
const mockLoaders: Array<() => Promise<any>> =
    jest.requireMock("next/dynamic").loaders;
jest.mock("@components/Dialogs", () => ({
    showError: jest.fn(),
    showPrompt: jest.fn(),
}));
const { showError } = jest.requireMock("@components/Dialogs");

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let social: any;
let panel: any;
let world: any;
const mediaDevices = Object.getOwnPropertyDescriptor(navigator, "mediaDevices");
const matchMedia = window.matchMedia;
type ChromeProps = Omit<
    React.ComponentProps<typeof NativeExperienceChrome>,
    "exhibit"
>;
// Holds the one open panel the way PanelProvider does.
function Harness(props: ChromeProps) {
    const [open, setOpen] = useState<SpacePanel>(panel.currentTab);
    panel.spacePanel = open;
    panel.currentTab = legacyPanelTab(open);
    panel.dispatchSpacePanel.mockImplementation((event) =>
        setOpen((current) => spacePanelTransition(current, event))
    );
    panel.setCurrentTab.mockImplementation((action) =>
        setOpen((current) =>
            spacePanelTransition(current, {
                type: "tab",
                tab:
                    typeof action === "function"
                        ? action(legacyPanelTab(current))
                        : action,
            })
        )
    );
    const [phoneOpen, setPhoneOpen] = useState(social.chat.isMobileChatOpen);
    social.chat.isMobileChatOpen = phoneOpen;
    social.chat.setIsMobileChatOpen.mockImplementation(setPhoneOpen);
    return (
        <NativeExperienceChrome
            exhibit={{ info: { headline: "Gallery" } }}
            {...props}
        >
            <div data-testid="legacy-toolbar">Toolbar content</div>
        </NativeExperienceChrome>
    );
}
const render = (props: ChromeProps = {}) =>
    act(() => root.render(<Harness {...props} />));
const button = (label: string) =>
    container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
const click = (label: string) => {
    expect(button(label)).not.toBeNull();
    act(() => button(label).click());
};
const more = () => container.querySelector('[aria-label="More options"]');
// What the notice slot above the dock says, if anything.
const notice = () =>
    container.querySelector('.experience-notice [role="alert"]')?.textContent;
const key = (
    value: string,
    options: KeyboardEventInit = {},
    target: EventTarget = window
) => {
    const event = new KeyboardEvent("keydown", {
        key: value,
        bubbles: true,
        cancelable: true,
        ...options,
    });
    act(() => target.dispatchEvent(event));
    return event;
};
const allowScreenCapture = () =>
    Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: { getDisplayMedia: jest.fn() },
    });
beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    window.matchMedia = jest.fn().mockReturnValue({
        matches: true,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
    });
    (useMediaQuery as jest.Mock).mockReturnValue(false);
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    social = {
        voice: {
            loading: false,
            voiceState: {
                type: "enabled",
                state: { isMuted: true, isPlaying: false },
            },
            toggleMuted: jest.fn(),
            togglePlaying: jest.fn(),
            requestVoicePermission: jest.fn(),
            cancelVoicePermissionRequest: jest.fn(),
        },
        room: { numOfUsers: 2, isMod: false },
        chat: {
            admins: ["admin"],
            isChatDisplayed: false,
            isMobileChatOpen: false,
            setIsMobileChatOpen: jest.fn(),
            setIsTyping: jest.fn(),
            setIsChatDisplayed: jest.fn(),
        },
        changeMode: jest.fn(),
    };
    panel = {
        currentTab: "",
        setCurrentTab: jest.fn(),
        spacePanel: "",
        dispatchSpacePanel: jest.fn(),
        selectedMode: 0,
        settings: { camera: "third_person" },
        handleSettings: jest.fn(),
        addTogglerRef: jest.fn(),
        setActiveProfileTab: jest.fn(),
    };
    world = { playEmote: jest.fn(), takeScreenshot: jest.fn() };
    (useMultiplayer as jest.Mock).mockReturnValue(social);
    (usePanel as jest.Mock).mockReturnValue(panel);
    (useWorld as jest.Mock).mockReturnValue({ current: world });
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
    window.matchMedia = matchMedia;
    if (mediaDevices)
        Object.defineProperty(navigator, "mediaDevices", mediaDevices);
    else delete (navigator as any).mediaDevices;
    jest.clearAllMocks();
});

test("microphone stays off until the visitor invokes the native voice action", () => {
    render();
    expect(social.voice.toggleMuted).not.toHaveBeenCalled();
    click("Enable microphone");
    expect(social.voice.toggleMuted).toHaveBeenCalledTimes(1);
    social.voice.voiceState.state.isMuted = false;
    render();
    expect(button("Mute microphone").getAttribute("aria-pressed")).toBe("true");
    click("Mute microphone");
    expect(social.voice.toggleMuted).toHaveBeenCalledTimes(2);
});

test("restricted native voice preserves moderator permission and lets a pending request be cancelled", () => {
    social.voice.voiceState = { type: "disabled" };
    social.chat.admins = [];
    render();
    click("Request to speak");
    // Said above the dock, not in a dialog.
    expect(notice()).toBe(
        "No moderator is available to allow voice right now."
    );
    expect(showError).not.toHaveBeenCalled();
    expect(social.voice.requestVoicePermission).not.toHaveBeenCalled();
    social.chat.admins = ["admin"];
    click("Request to speak");
    expect(notice()).toBeUndefined();
    expect(social.voice.requestVoicePermission).toHaveBeenCalledWith("mic");
    expect(social.voice.toggleMuted).not.toHaveBeenCalled();
    social.voice.voiceState = { type: "pending", reason: "mic" };
    render();
    expect(button("Request sent · Cancel").disabled).toBe(false);
    expect(
        button("Request sent · Cancel").querySelector(".experience-icon")
    ).not.toBeNull();
    click("Request sent · Cancel");
    expect(social.voice.cancelVoicePermissionRequest).toHaveBeenCalledTimes(1);
    expect(social.voice.requestVoicePermission).toHaveBeenCalledTimes(1);
    expect(social.voice.toggleMuted).not.toHaveBeenCalled();
});

test("the no-moderator notice leaves when a moderator arrives or after a while", () => {
    jest.useFakeTimers();
    try {
        social.voice.voiceState = { type: "disabled" };
        social.chat.admins = [];
        render();
        click("Request to speak");
        expect(notice()).toBeTruthy();
        social.chat.admins = ["admin"];
        render();
        expect(notice()).toBeUndefined();
        social.chat.admins = [];
        render();
        click("Request to speak");
        expect(notice()).toBeTruthy();
        act(() => {
            jest.advanceTimersByTime(8000);
        });
        expect(notice()).toBeUndefined();
    } finally {
        jest.useRealTimers();
    }
});

test("solo voice explains its availability without connecting or requesting a microphone", () => {
    panel.selectedMode = 1;
    render();
    expect(button("Users list")).toBeNull();
    const label = "Voice is available in Multiplayer mode";
    expect(button(label).disabled).toBe(true);
    click(label);
    key("m");
    expect(social.voice.toggleMuted).not.toHaveBeenCalled();
    expect(social.voice.requestVoicePermission).not.toHaveBeenCalled();
    expect(social.changeMode).not.toHaveBeenCalled();
    click("Avatars");
    expect(panel.currentTab).toBe("profile");
    click("More");
    expect(button("Show chat")).toBeNull();
    expect(button("Explore spaces")).toBeNull();
    click("Settings");
    expect(panel.currentTab).toBe("settings");
});

test.each([false, true])(
    "discovery stays in the main search action, with no duplicate in More (mobile=%s)",
    (mobile) => {
        render({ mobile });
        expect(button("Search worlds")).not.toBeNull();
        click("More");
        expect(more()).not.toBeNull();
        expect(button("More").getAttribute("aria-expanded")).toBe("true");
        expect(button("More").getAttribute("aria-controls")).toBe(more().id);
        expect(button("Explore spaces")).toBeNull();
        click("Search worlds");
        expect(more()).toBeNull();
        expect(
            container
                .querySelector("#lobby-explore")
                .getAttribute("data-active")
        ).toBe("true");
    }
);

test.each([false, true])(
    "tablet controls keep secondary actions usable in More and return animation focus there (mobile=%s)",
    async (mobile) => {
        (useMediaQuery as jest.Mock).mockImplementation(
            (query) => query === nativeCompactControlsQuery
        );
        render({ mobile });
        const dock = container.querySelector('[role="toolbar"]');
        expect(
            [
                ...dock.querySelectorAll(
                    ".experience-dock-item:not([aria-hidden]) > button"
                ),
            ].map((button) => button.getAttribute("aria-label"))
        ).toEqual(["Enable microphone", "Users list", "Search worlds", "More"]);
        click("More");
        expect(more().contains(button("Avatars"))).toBe(true);
        click("Avatars");
        expect(panel.setActiveProfileTab).toHaveBeenCalledWith("profile");
        expect(panel.currentTab).toBe("profile");
        expect(more()).toBeNull();
        click("More");
        expect(more().contains(button("Emotes"))).toBe(true);
        click("Emotes");
        expect(more()).toBeNull();
        expect(panel.currentTab).toBe("");
        await act(async () =>
            container
                .querySelector<HTMLButtonElement>(
                    '#native-emotes button[data-emote-name="HIPHOP"]'
                )
                .click()
        );
        expect(world.playEmote).toHaveBeenCalledWith(1);
        expect(container.querySelector("#native-emotes")).toBeNull();
        expect(document.activeElement).toBe(button("More"));
    }
);

test.each([false, true])(
    "phone chat replaces secondary actions and restores them on close (mobile=%s)",
    (mobile) => {
        (useMediaQuery as jest.Mock).mockImplementation(
            (query) => query === nativePhoneControlsQuery
        );
        render({ mobile });
        const dock = container.querySelector('[role="toolbar"]');
        expect(
            [
                ...dock.querySelectorAll(
                    ".experience-dock-item:not([aria-hidden]) > button"
                ),
            ].map((button) => button.getAttribute("aria-label"))
        ).toEqual([
            "Enable microphone",
            "Open chat",
            "Avatars",
            "Emotes",
            "Search worlds",
            "More",
        ]);
        click("Open chat");
        expect(
            [
                ...dock.querySelectorAll(
                    ".experience-dock-item:not([aria-hidden]) > button"
                ),
            ].map((button) => button.getAttribute("aria-label"))
        ).toEqual(["Enable microphone", "Close chat"]);
        expect(social.chat.setIsChatDisplayed).toHaveBeenCalledWith(true);
        expect(button("Avatars").disabled).toBe(true);
        expect(button("Avatars").tabIndex).toBe(-1);
        expect(
            button("Avatars").closest('[aria-hidden="true"]')
        ).not.toBeNull();
        click("Enable microphone");
        expect(social.voice.toggleMuted).toHaveBeenCalledTimes(1);
        click("Close chat");
        expect(social.chat.isMobileChatOpen).toBe(false);
        expect(social.chat.setIsTyping).toHaveBeenCalledWith(false);
        expect(button("Search worlds")).not.toBeNull();
        click("Avatars");
        expect(panel.currentTab).toBe("profile");
        click("Emotes");
        expect(panel.currentTab).toBe("");
        key("Escape");
        expect(document.activeElement).toBe(button("Emotes"));
        click("More");
        expect(more().contains(button("Avatars"))).toBe(false);
        expect(more().contains(button("Emotes"))).toBe(false);
        expect(more().contains(button("Users list"))).toBe(true);
        expect(button("Show chat")).toBeNull();
    }
);

test("resizing while animations are open restores focus to the visible control", () => {
    render();
    click("Emotes");
    (useMediaQuery as jest.Mock).mockImplementation(
        (query) => query === nativeCompactControlsQuery
    );
    render();
    expect(button("Emotes")).toBeNull();
    key("Escape");
    expect(container.querySelector("#native-emotes")).toBeNull();
    expect(document.activeElement).toBe(button("More"));
});

test("Settings uses the shared utility panel and returns to More", () => {
    render();
    click("More");
    click("Settings");
    expect(panel.currentTab).toBe("settings");
    expect(more()).toBeNull();
    const dialog = container.querySelector(
        '[role="dialog"][aria-label="Settings"]'
    );
    expect(
        dialog.querySelector('[data-testid="legacy-toolbar"]')
    ).not.toBeNull();
    expect(document.activeElement).toBe(dialog.querySelector("h2"));
    click("Back to More");
    expect(panel.currentTab).toBe("");
    expect(more()).not.toBeNull();
    click("Settings");
    key(
        "Escape",
        {},
        container.querySelector('[role="dialog"][aria-label="Settings"]')
    );
    expect(panel.currentTab).toBe("");
    expect(document.activeElement).toBe(button("More"));
    act(() => panel.setCurrentTab("help"));
    expect(container.querySelector(".visitor-native-panel")).toBeNull();
});

test("desktop Space controls retains the existing native dashboard", () => {
    render();
    click("More");
    click("Space controls");
    expect(panel.currentTab).toBe("dashboard");
    expect(
        container.querySelector(
            '.visitor-native-panel [data-testid="legacy-toolbar"]'
        )
    ).not.toBeNull();
    expect(more()).toBeNull();
});

test("More Escape and close restore the More trigger while outside pointerdown preserves target focus", () => {
    render();
    click("More");
    button("Settings").focus();
    expect(key("Escape", { isComposing: true }).defaultPrevented).toBe(false);
    expect(more()).not.toBeNull();
    expect(key("Escape").defaultPrevented).toBe(true);
    expect(more()).toBeNull();
    expect(document.activeElement).toBe(button("More"));
    click("More");
    click("Close options");
    expect(document.activeElement).toBe(button("More"));
    click("More");
    act(() =>
        more().dispatchEvent(new Event("pointerdown", { bubbles: true }))
    );
    expect(more()).not.toBeNull();
    const outside = document.createElement("button");
    document.body.append(outside);
    outside.focus();
    act(() =>
        outside.dispatchEvent(new Event("pointerdown", { bubbles: true }))
    );
    expect(more()).toBeNull();
    expect(document.activeElement).toBe(outside);
    outside.remove();
});

test("More and Emotes are mutually exclusive and emote Escape keeps its own focus target", () => {
    render();
    click("Emotes");
    expect(
        container.querySelector('section[aria-label="Animations"]')
    ).not.toBeNull();
    click("More");
    expect(
        container.querySelector('section[aria-label="Animations"]')
    ).toBeNull();
    click("Emotes");
    expect(more()).toBeNull();
    key("Escape");
    expect(document.activeElement).toBe(button("Emotes"));
});

test("photo, chat, feedback and moderator requests preserve their native actions", () => {
    social.room.isMod = true;
    render();
    click("More");
    click("Take a photo");
    expect(world.takeScreenshot).toHaveBeenCalledWith({
        color: null,
        download: true,
    });
    expect(more()).toBeNull();
    click("More");
    click("Show chat");
    expect(social.chat.setIsChatDisplayed).toHaveBeenCalledWith(true);
    social.chat.isChatDisplayed = true;
    click("More");
    click("Hide chat");
    expect(social.chat.setIsChatDisplayed).toHaveBeenLastCalledWith(false);
    click("More");
    click("Requests to speak");
    expect(panel.currentTab).toBe("voiceRequests");
    click("More");
    click("Send feedback");
    expect(panel.currentTab).toBe("feedback");
});

test("screen sharing retains the host permission flow and refuses duplicate pending requests", () => {
    allowScreenCapture();
    social.voice.voiceState = { type: "disabled" };
    social.chat.admins = [];
    render();
    click("More");
    click("Share screen or audio");
    // More closes and the dock says why, instead of a dialog.
    expect(more()).toBeNull();
    expect(notice()).toBe(
        "No moderator is available to allow sharing right now."
    );
    expect(showError).not.toHaveBeenCalled();
    expect(social.voice.requestVoicePermission).not.toHaveBeenCalled();
    social.chat.admins = ["admin"];
    click("More");
    expect(notice()).toBeUndefined();
    click("Share screen or audio");
    expect(social.voice.requestVoicePermission).toHaveBeenCalledWith(
        "broadcast"
    );
    expect(more()).toBeNull();
    social.voice.voiceState = { type: "pending", reason: "broadcast" };
    click("More");
    expect(button("Share screen or audio").disabled).toBe(true);
    click("Share screen or audio");
    expect(social.voice.requestVoicePermission).toHaveBeenCalledTimes(1);
});

test("enabled sharing opens native configuration, chooses its display, and can be stopped", () => {
    allowScreenCapture();
    render();
    click("More");
    click("Share screen or audio");
    expect(panel.currentTab).toBe("audioSharing");
    social.voice.voiceState.state.isPlaying = true;
    social.voice.voiceState.state.videoStreamState = { hasVideo: true };
    click("More");
    click("Choose screen display");
    expect(panel.currentTab).toBe("select-media-placeholder");
    click("More");
    click("Stop sharing");
    expect(social.voice.togglePlaying).toHaveBeenCalledWith(false);
    expect(more()).toBeNull();
});

test("mobile keeps photo while omitting duplicate discovery and unavailable desktop utilities", () => {
    allowScreenCapture();
    render({ mobile: true });
    click("More");
    expect(button("Explore spaces")).toBeNull();
    expect(button("Take a photo")).not.toBeNull();
    expect(button("Space controls")).toBeNull();
    expect(button("Share screen or audio")).toBeNull();
    expect(button("Requests to speak")).toBeNull();
});

test("the M shortcut only handles an unmodified non-editing native voice gesture", () => {
    render();
    key("m", { ctrlKey: true });
    key("m", { metaKey: true });
    key("m", { altKey: true });
    key("m", { repeat: true });
    key("m", { isComposing: true });
    const input = document.createElement("input");
    container.append(input);
    key("m", {}, input);
    expect(social.voice.toggleMuted).not.toHaveBeenCalled();
    key("m");
    expect(social.voice.toggleMuted).toHaveBeenCalledTimes(1);
});

test("animation cards preserve native indexes and return focus after selection", () => {
    render();
    click("Emotes");
    expect(button("Emotes").getAttribute("aria-controls")).toBe(
        "native-emotes"
    );
    expect(button("Emotes").getAttribute("aria-expanded")).toBe("true");
    const emote = container.querySelector<HTMLButtonElement>(
        '#native-emotes button[data-emote-name="HIPHOP"]'
    );
    act(() => emote.click());
    expect(world.playEmote).toHaveBeenCalledWith(1);
    expect(container.querySelector("#native-emotes")).toBeNull();
    expect(button("Emotes").getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(button("Emotes"));
});

test("native animation waits for third-person camera before playing", async () => {
    let finishCamera: () => void;
    panel.settings.camera = "first_person";
    panel.handleSettings.mockImplementation(
        () =>
            new Promise<void>((resolve) => {
                finishCamera = resolve;
            })
    );
    render();
    click("Emotes");
    const emote = container.querySelector<HTMLButtonElement>(
        '#native-emotes button[data-emote-name="WAVING"]'
    );
    act(() => emote.click());
    expect(panel.handleSettings).toHaveBeenCalledWith("camera", "third_person");
    expect(world.playEmote).not.toHaveBeenCalled();
    await act(async () => finishCamera());
    expect(world.playEmote).toHaveBeenCalledWith(0);
    expect(container.querySelector("#native-emotes")).toBeNull();
});

test("host-owned animation callback retains its index and original clip name", async () => {
    const onEmote = jest.fn().mockResolvedValue(undefined);
    render({ onEmote });
    click("Emotes");
    await act(async () => {
        container
            .querySelector<HTMLButtonElement>(
                '#native-emotes button[data-emote-name="HIPHOP"]'
            )
            .click();
    });
    expect(onEmote).toHaveBeenCalledWith(1, "HIPHOP");
    expect(world.playEmote).not.toHaveBeenCalled();
    expect(panel.handleSettings).not.toHaveBeenCalled();
    expect(container.querySelector("#native-emotes")).toBeNull();
});

test("animation panel retains inside clicks and dismisses outside without stealing focus", () => {
    render();
    click("Emotes");
    const animations = container.querySelector("#native-emotes");
    act(() =>
        animations.dispatchEvent(new Event("pointerdown", { bubbles: true }))
    );
    expect(container.querySelector("#native-emotes")).not.toBeNull();
    const outside = document.createElement("button");
    document.body.append(outside);
    outside.focus();
    act(() =>
        outside.dispatchEvent(new Event("pointerdown", { bubbles: true }))
    );
    expect(container.querySelector("#native-emotes")).toBeNull();
    expect(document.activeElement).toBe(outside);
    outside.remove();
});

test("Stop animation stops the native avatar without changing camera or routing through play analytics", () => {
    const onEmote = jest.fn();
    panel.settings.camera = "first_person";
    render({ onEmote });
    click("Emotes");
    const stop = [...container.querySelectorAll("button")].find(
        (button) => button.textContent === "Stop animation"
    );
    act(() => stop.click());
    expect(world.playEmote).toHaveBeenCalledWith(-1);
    expect(panel.handleSettings).not.toHaveBeenCalled();
    expect(onEmote).not.toHaveBeenCalled();
    expect(container.querySelector("#native-emotes")).toBeNull();
    expect(document.activeElement).toBe(button("Emotes"));
});

test("Search worlds opens the lobby search panel, keeps it between opens and routes to a picked world", () => {
    render();
    const search = () => container.querySelector("#lobby-explore");
    expect(search()).toBeNull();
    click("Search worlds");
    expect(search().getAttribute("data-active")).toBe("true");
    expect(button("Search worlds").getAttribute("aria-expanded")).toBe("true");
    click("Close search");
    expect(search().getAttribute("data-active")).toBe("false");
    expect(document.activeElement).toBe(button("Search worlds"));
    click("Emotes");
    click("Search worlds");
    expect(container.querySelector("#native-emotes")).toBeNull();
    click("Open Museum");
    expect(mockPush).toHaveBeenCalledWith("/museum");
    expect(search().getAttribute("data-active")).toBe("false");
});

// Every panel the chrome can show, as the visitor would find it on screen.
const openPanels = () =>
    [
        panel.currentTab,
        container.querySelector("#native-emotes") && "emotes",
        more() && "more",
        container
            .querySelector("#lobby-explore")
            ?.getAttribute("data-active") === "true" && "search",
    ].filter(Boolean);

test("opening any panel closes whichever was open, so only one is ever open", () => {
    social.chat.isChatDisplayed = true;
    render();
    expect(openPanels()).toEqual([]);
    for (const [label, opened] of [
        ["Avatars", "profile"],
        ["Emotes", "emotes"],
        ["Users list", "users"],
        ["More", "more"],
        ["Search worlds", "search"],
        ["Emotes", "emotes"],
        ["More", "more"],
        ["Avatars", "profile"],
        ["Search worlds", "search"],
        ["Users list", "users"],
    ]) {
        click(label);
        expect(openPanels()).toEqual([opened]);
    }
    click("Users list");
    expect(openPanels()).toEqual([]);
    // Chat is not a panel: none of that hid it.
    expect(social.chat.setIsChatDisplayed).not.toHaveBeenCalled();
});

test("a panel opened from outside the dock also closes emotes, More and search", () => {
    render();
    click("Emotes");
    // The U shortcut and the older panels write the tab directly.
    act(() =>
        panel.setCurrentTab((tab: string) => (tab === "users" ? "" : "users"))
    );
    expect(openPanels()).toEqual(["users"]);
    click("More");
    act(() => panel.setCurrentTab("profile"));
    expect(openPanels()).toEqual(["profile"]);
    click("Search worlds");
    act(() => panel.setCurrentTab("feedback"));
    expect(openPanels()).toEqual(["feedback"]);
    expect(button("Search worlds").getAttribute("aria-expanded")).toBe("false");
});

const corner = () => container.querySelector(".experience-title");
const presence = () => corner().querySelector(".presence-status")?.textContent;
const reason = () => corner().querySelector(".presence-reason")?.textContent;

const peopleBadge = () =>
    container.querySelector(".experience-badge")?.textContent;

test.each([
    ["connecting", "Connecting…", undefined, "—"],
    ["connected", "2 here", undefined, "2"],
    ["failed", "You’re offline", "Couldn’t connect.", "—"],
    ["lost", "You’re offline", "Connection lost.", "—"],
])(
    "a multiplayer space that is %s says so under its title",
    (connection, shown, why, badge) => {
        social.connection = connection;
        render();
        expect(corner().querySelector("span").textContent).toBe("Gallery");
        expect(presence()).toBe(shown);
        expect(reason()).toBe(why);
        // The people button never shows a count the line does not.
        expect(peopleBadge()).toBe(badge);
    }
);

const wayBack = () =>
    corner().querySelector<HTMLButtonElement>("button.presence-action");

test.each([
    // [connection, panel mode, reason, the way back]
    ["failed", 0, "Couldn’t connect.", "Try again"],
    ["lost", 0, "Connection lost.", "Rejoin"],
    // Being away puts the panel in solo; the reason is still shown.
    ["inactive", 1, "You were away for a while.", "Rejoin"],
    ["inactive", 0, "You were away for a while.", "Rejoin"],
])(
    "a %s connection says why and offers to join again",
    (connection, mode, why, label) => {
        social.connection = connection;
        social.rejoin = jest.fn().mockResolvedValue(true);
        panel.selectedMode = mode;
        render();
        expect(presence()).toBe("You’re offline");
        expect(reason()).toBe(why);
        expect(wayBack().textContent).toBe(label);
        act(() => wayBack().click());
        expect(social.rejoin).toHaveBeenCalledTimes(1);
        expect(social.changeMode).not.toHaveBeenCalled();
    }
);

test("a visitor the owner removed is told so, with no way back offered", () => {
    social.connection = "removed";
    social.rejoin = jest.fn();
    render();
    expect(presence()).toBe("You’re offline");
    expect(reason()).toBe("The owner removed you from this world.");
    expect(wayBack()).toBeNull();
    expect(peopleBadge()).toBe("—");
    // In solo too: the panel may have been moved there.
    panel.selectedMode = 1;
    render();
    expect(reason()).toBe("The owner removed you from this world.");
    expect(wayBack()).toBeNull();
    expect(social.rejoin).not.toHaveBeenCalled();
});

test("a changed password asks for the new one, and says when it is wrong", async () => {
    social.connection = "password-changed";
    social.rejoin = jest.fn();
    social.enterPassword = jest.fn();
    render();
    expect(reason()).toBe("The password changed. Enter the new one.");
    expect(wayBack().textContent).toBe("Enter password");
    act(() => wayBack().click());
    expect(showPrompt).toHaveBeenCalledTimes(1);
    const prompt = (showPrompt as jest.Mock).mock.calls[0][0];
    expect(prompt).toEqual(
        expect.objectContaining({
            type: "password",
            message: "The password changed. Enter the new one.",
        })
    );
    // The prompt shows what onSubmit throws, and closes when it resolves.
    social.enterPassword.mockResolvedValueOnce("password-error");
    await expect(prompt.onSubmit("wrong")).rejects.toThrow(
        "Incorrect password"
    );
    social.enterPassword.mockResolvedValueOnce("other-error");
    await expect(prompt.onSubmit("new")).rejects.toThrow(
        "Couldn’t check the password. Try again."
    );
    social.enterPassword.mockResolvedValueOnce(null);
    await expect(prompt.onSubmit("new")).resolves.toBeUndefined();
    expect(social.enterPassword.mock.calls).toEqual([
        ["wrong"],
        ["new"],
        ["new"],
    ]);
    expect(social.rejoin).not.toHaveBeenCalled();
});

test("a solo space, or one that has not tried to connect, says nothing about a connection", () => {
    // Solo keeps whatever the last attempt left behind; none of it is shown.
    for (const connection of ["idle", "failed", "lost", "connected"]) {
        panel.selectedMode = 1;
        social.connection = connection;
        render();
        expect(corner().textContent).toBe("Gallery");
    }
    panel.selectedMode = 0;
    social.connection = "idle";
    render();
    expect(corner().textContent).toBe("Gallery");
    expect(peopleBadge()).toBe("2");
    delete social.connection;
    render();
    expect(corner().textContent).toBe("Gallery");
});

test("the count follows the room without being announced, and is never below the visitor", () => {
    social.connection = "connected";
    social.room.numOfUsers = 0;
    render();
    expect(presence()).toBe("1 here");
    const spoken = corner().querySelector('[role="status"]');
    const announced: MutationRecord[] = [];
    const observer = new MutationObserver((records) =>
        announced.push(...records)
    );
    observer.observe(spoken, {
        childList: true,
        characterData: true,
        subtree: true,
    });
    for (const count of [12, 13, 11]) {
        social.room.numOfUsers = count;
        render();
        expect(presence()).toBe(`${count} here`);
    }
    announced.push(...observer.takeRecords());
    expect(announced).toEqual([]);
    social.connection = "lost";
    render();
    announced.push(...observer.takeRecords());
    observer.disconnect();
    expect(announced.length).toBeGreaterThan(0);
    expect(spoken.textContent).toBe("You’re offline. Connection lost.");
});

test("older code clearing its tab leaves the dock's own panel open", () => {
    render();
    click("More");
    act(() => panel.setCurrentTab(""));
    expect(openPanels()).toEqual(["more"]);
    act(() => panel.setCurrentTab("users"));
    act(() => panel.setCurrentTab(""));
    expect(openPanels()).toEqual([]);
});

describe("the voice level readout", () => {
    const readout = () => document.querySelector("[data-voice-debug]");
    const visit = (search: string) =>
        window.history.replaceState(null, "", `/gallery${search}`);
    afterEach(() => visit(""));

    test("is absent from an ordinary visit", () => {
        social.voice.voiceService = { name: "voice" };
        for (const search of ["", "?voice=1", "?debug"]) {
            // Mounted afresh: the URL is read once, on mount.
            act(() => root.unmount());
            root = createRoot(container);
            visit(search);
            render();
            expect(readout()).toBeNull();
        }
        // Declared once, at module level: the chunk is only fetched when
        // the stand-in above would render. (The other loader is the shell's
        // world info sidebar.)
        expect(mockLoaders).toHaveLength(2);
    });

    test.each(["?voiceDebug", "?voiceDebug=0.42", "?x=1&voiceDebug=-58"])(
        "is mounted once, with the world's voice service, for %s",
        async (search) => {
            visit(search);
            social.voice.voiceService = { name: "voice" };
            render();
            expect(
                document.querySelectorAll("[data-voice-debug]")
            ).toHaveLength(1);
            expect(readout().getAttribute("data-service")).toBe("voice");
            // It is the readout from utils/voiceChat that gets loaded.
            // Declared after the shell's sidebar, so it is the last loader.
            const loaded = await mockLoaders.at(-1)();
            expect(loaded.default).toBe(
                jest.requireActual("@utils/voiceChat/VoiceLevelDebug").default
            );
        }
    );
});

test("phone panels are mutually exclusive with chat and keep their dock close toggle", () => {
    (useMediaQuery as jest.Mock).mockImplementation(
        (query) => query === nativePhoneControlsQuery
    );
    render();
    click("Emotes");
    expect(
        button("Close animations").closest('[role="toolbar"]')
    ).not.toBeNull();
    expect(container.querySelector(".phone-animation-grid")).not.toBeNull();
    act(() => social.chat.setIsMobileChatOpen(true));
    expect(container.querySelector("#native-emotes")).toBeNull();
    click("Close chat");
    click("Avatars");
    expect(button("Close avatars")).not.toBeNull();
    click("Open chat");
    expect(panel.currentTab).toBe("");
    click("Close chat");
    click("More");
    expect(button("Close More")).not.toBeNull();
    click("Close More");
    expect(more()).toBeNull();
});
