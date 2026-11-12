/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import EmailAuthHandler, { MagicCode } from "./EmailAuthHandler";
import { UserContext } from "@components/context/UserContext";
import { showModal } from "@components/Dialogs";
import { useRouter } from "next/router";
import { describeSignInError } from "@features/auth/signInErrors";

jest.mock("@components/context/UserContext", () => ({
    UserContext: require("react").createContext({}),
}));
jest.mock("next/router", () => ({ useRouter: jest.fn() }));
jest.mock("next/dynamic", () => () => () => null);
jest.mock("@components/Dialogs", () => ({ showModal: jest.fn() }));
jest.mock("@utils/analytics", () => ({
    amplitude_logAnalyticsEvent: jest.fn(),
}));
jest.mock("@ui/components/IconButton", () => ({ IconButton: () => null }));
jest.mock("@ui/components/Icons/Cyber", () => () => null);
jest.mock("@components/hooks/useScreenSize", () => ({
    useScreenSize: () => ({ width: 1200 }),
}));

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    jest.spyOn(console, "error").mockImplementation(() => {});
    (showModal as jest.Mock).mockReset();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
    jest.restoreAllMocks();
});

/** Opens the link with a sign-in that ends the given way. */
async function open(response: any) {
    const authHandler = jest.fn().mockResolvedValue(response);
    await act(async () =>
        root.render(
            <UserContext.Provider value={{ authHandler } as any}>
                <MagicCode />
            </UserContext.Provider>
        )
    );
    expect(authHandler).toHaveBeenCalledWith({ type: "passwordless" });
}
/** What `authHandler` returns for an error with this code. */
const failed = (code: string) => {
    const { message, ...rest } = describeSignInError({ code });
    return { success: false, type: "", message, ...rest };
};
const alert = () => container.querySelector('[role="alert"]');

test("while the link is being checked it says so, and nothing else", async () => {
    await act(async () =>
        root.render(
            <UserContext.Provider
                value={{ authHandler: () => new Promise(() => {}) } as any}
            >
                <MagicCode />
            </UserContext.Provider>
        )
    );
    expect(container.textContent).toBe("ConnectingConnecting…");
    expect(alert()).toBeNull();
});

test.each([
    [
        "auth/invalid-action-code",
        "This link was already used. Ask for a new one.",
    ],
    ["email-link/used", "This link was already used. Ask for a new one."],
    [
        "email-link/other-device",
        "Open the link on the device and browser where you asked for it.",
    ],
    ["auth/expired-action-code", "This link has expired. Ask for a new one."],
    [
        "auth/network-request-failed",
        "Couldn’t connect. Check your connection and try again.",
    ],
])("%s is named, not called “expired”", async (code, sentence) => {
    await open(failed(code));
    expect(container.querySelector(".title").textContent).toBe(
        "Couldn’t sign you in"
    );
    expect(alert().textContent).toBe(sentence);
    expect(container.textContent).not.toContain("Connecting");
    // The same link cannot work a second time, so there is nothing to retry.
    expect(alert().querySelector("button")).toBeNull();
    expect(alert().getAttribute("data-surface")).toBe("light");
});

test("an unknown failure, or no answer at all, still says something useful", async () => {
    await open(null);
    expect(alert().textContent).toBe(
        "Couldn’t sign you in. Try again, or choose another way to sign in."
    );
});

describe("which pages open it", () => {
    const visit = (query: any) => {
        (useRouter as jest.Mock).mockReturnValue({ query });
        act(() => root.render(<EmailAuthHandler />));
    };
    const link = { oobCode: "code", mode: "signIn", apiKey: "key" };

    test("a page opened from a sign-in link", () => {
        visit(link);
        expect(showModal).toHaveBeenCalledTimes(1);
        expect((showModal as jest.Mock).mock.calls[0][0].type).toBe(MagicCode);
    });

    test("not any other page", () => {
        visit({});
        visit({ oobCode: "code" });
        expect(showModal).not.toHaveBeenCalled();
    });
});
