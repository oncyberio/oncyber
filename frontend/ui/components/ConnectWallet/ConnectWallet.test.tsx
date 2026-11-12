/** @jest-environment jsdom */
import React from "react";
import { createRoot } from "react-dom/client";
import { UserContext } from "@components/context/UserContext";
import { selectIsSignedIn } from "@components/context/isSignedIn";
import ConnectWallet from "./index";

const mockWrapperProps: any[] = [];
const act = (React as any).act;
(global as any).IS_REACT_ACT_ENVIRONMENT = true;
jest.mock("@components/context/UserContext", () => ({
    UserContext: require("react").createContext({}),
}));
jest.mock("@components/modals/SignupProvider/ProviderButtonsWrapper", () => ({
    ProviderButtonsWrapper: (props) => {
        mockWrapperProps.push(props);
        return null;
    },
}));
jest.mock(
    "@components/modals/SignupProvider/ProviderButtons",
    () => () => null
);
jest.mock(
    "@components/modals/Modal",
    () =>
        ({ children }) =>
            children
);
jest.mock("@components/context/ThemeProvider", () => ({
    useCyberTheme: () => ({ isLightTheme: true }),
}));
jest.mock("@components/_3DExhibit-v2/three/constants", () => ({
    IS_MOBILE: false,
}));
jest.mock("@ui/components/IconButton", () => ({ IconButton: () => null }));
jest.mock("@ui/components/WalletButtons/styles", () => ({
    MoreOptionsWrapper: "div",
}));
jest.mock("@utils/analytics", () => ({
    amplitude_logAnalyticsEvent: jest.fn(),
}));
jest.mock("next/router", () => ({ useRouter: () => ({ route: "/" }) }));

let root: ReturnType<typeof createRoot>, container: HTMLDivElement;
beforeEach(() => {
    mockWrapperProps.length = 0;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
});

const signedIn = {
    authenticated: true,
    isAnonymous: false,
    user: { id: "0xabc" },
    token: "session-token",
};

/** What the sign-in buttons are told for a visitor in the given state. */
function keepsSession(session: any, skipRedirectToAccount: boolean) {
    // The provider works `isSignedIn` out from the session; so does this.
    const context = { ...session, isSignedIn: selectIsSignedIn(session) };
    act(() =>
        root.render(
            <UserContext.Provider value={context}>
                <ConnectWallet
                    open
                    toggle={() => {}}
                    skipRedirectToAccount={skipRedirectToAccount}
                />
            </UserContext.Provider>
        )
    );
    return mockWrapperProps[mockWrapperProps.length - 1].skipRedirectToAccount;
}

describe("keeping the current session while another account is added", () => {
    test.each([
        ["someone signed in", signedIn, true],
        ["a signed-out visitor", { authenticated: false }, false],
        [
            "a signed-out visitor with a stale user",
            { authenticated: false, user: { id: "0xabc" } },
            false,
        ],
        [
            "an anonymous visitor",
            { authenticated: true, isAnonymous: true, user: { id: "anon" } },
            false,
        ],
        ["a session without an account", { authenticated: true }, false],
        [
            "a session without its token",
            { authenticated: true, user: { id: "0xabc" } },
            false,
        ],
    ])("%s", (_name, context, kept) => {
        // Asking to keep the session only works when there is one to keep:
        // anyone else has to come out of the dialog signed in.
        expect(keepsSession(context, true)).toBe(kept);
    });

    test("a plain sign-in is never turned into keeping the session", () => {
        expect(keepsSession(signedIn, false)).toBe(false);
        expect(keepsSession({ authenticated: false }, false)).toBe(false);
    });
});
