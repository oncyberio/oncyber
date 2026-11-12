/** @jest-environment jsdom */
// Reproduction for glitch 3 (R6): the account dashboard's profile editor
// pushes the new name to the world (and so to other players) before the
// save, and leaves it there when the save fails. Passes while the bug exists.
import React, { act } from "react";
import { createRoot } from "react-dom/client";

const mockWorld = { current: { updatePlayer: jest.fn() } };
const mockUpdateUser = jest.fn();
const mockDispatch = jest.fn();
jest.mock("@components/_3DExhibit-v2/hooks/useWorld", () => ({
    useWorld: () => mockWorld,
}));
jest.mock("@components/_3DExhibit-v2/three/constants", () => ({
    IS_MOBILE: false,
}));
jest.mock("@components/_3DExhibit-v2/three/factory/player/constants", () => ({
    UPDATE_AVATAR: "UPDATE_AVATAR",
    UPDATE_USERNAME: "UPDATE_USERNAME",
}));
jest.mock("@components/_3DExhibit-v2/utils/avatar", () => ({
    formatAvatar: jest.fn(async (u) => u.avatar),
}));
jest.mock("@components/context/I18nContext", () => ({
    useCyberTranslation: () => ({ t: (s) => (Array.isArray(s) ? s[0] : s) }),
}));
jest.mock("@components/context/UserContext", () => ({
    UPDATE_USER_DATA: "UPDATE_USER_DATA",
    UserContext: require("react").createContext({}),
}));
jest.mock("@components/hooks/useAssets", () => ({ useAssets: () => null }));
jest.mock("@components/hooks/useEventCallback", () => ({
    useEventCallback: (fn) => fn,
}));
jest.mock("@components/modals/Profile/UploaderAvatar", () => ({
    __esModule: true,
    default: () => null,
}));
jest.mock("@components/CloudinaryNextImage", () => ({
    LegacyCloudinaryNextImage: () => null,
}));
jest.mock("@ui/components/IconImg", () => ({
    __esModule: true,
    default: () => null,
}));
// The save button's onClick returns handleProfileChange()'s promise; keep
// it so a rejection the component does not catch can be observed here.
const mockClicks: { error?: any }[] = [];
jest.mock("@ui/components/NButton", () => ({
    NButton: ({ children, onClick, ...rest }) =>
        require("react").createElement(
            "button",
            {
                "data-cy": rest["data-cy"],
                onClick: (e) => {
                    const click: any = {};
                    mockClicks.push(click);
                    const result = onClick(e);
                    if (result && result.catch)
                        result.catch((error) => (click.error = error));
                },
            },
            children
        ),
}));
jest.mock("@ui/components/Input", () => ({
    __esModule: true,
    default: (p) =>
        require("react").createElement("input", {
            value: p.value,
            onChange: p.onChange,
            "data-cy": p["data-cy"],
        }),
}));
jest.mock("@components/forms/Input", () => ({
    Input: (p) =>
        require("react").createElement("input", {
            value: p.value,
            onChange: p.onChange,
            "data-cy": "username",
        }),
}));
jest.mock("@components/forms/LinkStatus", () => ({ LinkStatus: () => null }));
jest.mock("@ui/components/Input/styles", () => ({ StyledWrapper: "div" }));
jest.mock("@utils/analytics", () => ({
    amplitude_logAnalyticsEvent: jest.fn(),
}));
jest.mock("@utils/saveToDb", () => ({
    updateUser: (...a) => mockUpdateUser(...a),
}));
jest.mock("next/router", () => ({
    useRouter: () => ({ asPath: "/spaces/w" }),
}));
jest.mock(
    "@components/modals/AccountDashboard/LinkAccount/LinkedAccountSelector",
    () => ({ __esModule: true, default: () => null })
);

import Profile from "./index";
import { UserContext } from "@components/context/UserContext";

let container: HTMLDivElement, root: ReturnType<typeof createRoot>;
const account = {
    user: { id: "u1" },
    token: "t",
    userData: { username: "oldname", avatar: "a.png" },
    dispatch: mockDispatch,
    defaultWallet: "0x1",
    linkedWallets: [],
};
function setInput(el: HTMLInputElement, value: string) {
    const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value"
    ).set;
    setter.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
}
beforeEach(async () => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    jest.clearAllMocks();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () =>
        root.render(
            <UserContext.Provider value={account as any}>
                <Profile />
            </UserContext.Provider>
        )
    );
});
afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
});

async function saveAs(name: string) {
    const input = container.querySelector<HTMLInputElement>(
        '[data-cy="username"]'
    );
    await act(async () => setInput(input, name));
    const save = container.querySelector<HTMLButtonElement>(
        '[data-cy="edit-profile-save"]'
    );
    await act(async () => {
        save.click();
        for (let i = 0; i < 20; i++) await Promise.resolve();
    });
}

test("FIXED: a refused save leaves the avatar alone and shows why", async () => {
    mockUpdateUser.mockResolvedValue({
        success: false,
        message: "Username already taken",
    });
    await saveAs("newname");
    expect(mockUpdateUser).toHaveBeenCalledTimes(1);
    expect(mockWorld.current.updatePlayer).not.toHaveBeenCalled();
    expect(mockDispatch).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Username already taken");
});

test("FIXED: a save that throws leaves the avatar alone, says so, and frees the button", async () => {
    mockUpdateUser.mockRejectedValue(new TypeError("Failed to fetch"));
    jest.spyOn(console, "error").mockImplementation(() => {});
    await saveAs("newname");
    expect(mockClicks.at(-1).error).toBeUndefined();
    expect(mockWorld.current.updatePlayer).not.toHaveBeenCalled();
    expect(container.textContent).toContain("PROFILE_NOT_SAVED");
    const save = container.querySelector('[data-cy="edit-profile-save"]');
    expect(save.textContent).toBe("SAVE");
});

test("FIXED: a successful save then shows the new name in the world", async () => {
    mockUpdateUser.mockResolvedValue({ success: true });
    await saveAs("newname");
    expect(mockDispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: "UPDATE_USER_DATA" })
    );
    expect(mockWorld.current.updatePlayer).toHaveBeenCalledTimes(1);
    expect(mockWorld.current.updatePlayer).toHaveBeenCalledWith({
        type: "UPDATE_USERNAME",
        payload: "newname",
    });
    expect(mockUpdateUser.mock.invocationCallOrder[0]).toBeLessThan(
        mockWorld.current.updatePlayer.mock.invocationCallOrder[0]
    );
});
