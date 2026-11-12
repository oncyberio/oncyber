/** @jest-environment jsdom */
// When the session for a page cannot be loaded, the pages that wait for it
// (studio, spaces) render nothing. The provider says so on the page, with a
// Retry that loads it again, instead of a dialog over a blank page.
import React, { act, useContext } from "react";
import { createRoot } from "react-dom/client";
import { UserContext, UserProvider } from "./UserContext";
import { waitForNavigationSaves } from "@utils/navigationSaves";
import { getAnonExhibit } from "@utils/anon";
import { showError } from "@components/Dialogs";

jest.mock(
    "@api/accounts/_api",
    () => ({
        __esModule: true,
        default: {
            opts: () => ({ authenticate: jest.fn() }),
            logout: jest.fn(),
        },
    }),
    { virtual: true }
);
jest.mock("firebase/auth", () => ({ getAuth: () => ({}) }));
jest.mock("@utils/firebaseApp", () => ({
    firebaseApp: {},
    connectEmulator: jest.fn(),
}));
jest.mock("@components/Dialogs", () => ({
    showError: jest.fn(),
    showPrompt: jest.fn(),
}));
jest.mock("@utils/navigationSaves", () => ({
    waitForNavigationSaves: jest.fn(() => Promise.resolve()),
}));
jest.mock("next/router", () => ({
    useRouter: () => ({ query: {}, pathname: "/" }),
}));
jest.mock("@utils/getAddrType", () => ({
    getAddrType: jest.fn(),
    isEthereumAddress: jest.fn(),
}));
jest.mock("@env", () => ({ nodeEnv: { PUBLIC_API: "" } }));
jest.mock("@utils/analytics", () => ({
    amplitude_identify_user: jest.fn(),
    amplitude_logAnalyticsEvent: jest.fn(),
    amplitude_setIndetity: jest.fn(),
    amplitude_setUserId: jest.fn(),
}));
jest.mock("@utils/autographAssets", () => ({ isAutographUser: jest.fn() }));
jest.mock("@utils/auth/gnosis", () => ({ onGnosisSignEvent: jest.fn() }));
jest.mock("@components/hooks/useHotkey", () => ({ useHotkey: jest.fn() }));
jest.mock("@utils/anon", () => ({ getAnonExhibit: jest.fn() }));
jest.mock("@utils/anon/ensureLocalUploads", () => ({
    ensureLocalUploads: jest.fn(() => Promise.resolve()),
}));
jest.mock("@features/studio/utils", () => ({
    getDefaultWallet: jest.fn(() => ""),
    getLinkedWallets: jest.fn(() => []),
}));
jest.mock("@utils/saveToDb", () => ({ getDestination: jest.fn() }));

const waitForSaves = waitForNavigationSaves as jest.Mock;
const anonExhibit = getAnonExhibit as jest.Mock;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let context: any;

/** Stands in for `pages/studio`: nothing until the session is loaded. */
function Page() {
    context = useContext(UserContext);
    return context.isAnonInitialized ? <p>studio</p> : null;
}

async function open(props: any) {
    await act(async () =>
        root.render(
            <UserProvider {...props}>
                <Page />
            </UserProvider>
        )
    );
}

const draft = {
    authenticated: true,
    isAnonymous: true,
    userId: "anon",
    user: { walletId: "anon", username: "anon" },
    exhibit: { id: "draft", info: { room: "empty" } },
    destination: { slug: "empty" },
};

const alert = () => container.querySelector('[role="alert"]');
const retry = () =>
    [...container.querySelectorAll("button")].find(
        (button) => button.textContent === "Retry"
    );

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(console, "log").mockImplementation(() => {});
    waitForSaves.mockReset().mockResolvedValue(undefined);
    anonExhibit.mockReset().mockImplementation(async (exhibit) => exhibit);
    (showError as jest.Mock).mockClear();
    localStorage.clear();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
    jest.restoreAllMocks();
});

test("a session that fails to load says so, with Retry, instead of a blank page", async () => {
    waitForSaves.mockRejectedValueOnce(new Error("save failed"));
    await open(draft);

    expect(container.textContent).not.toContain("studio");
    expect(alert().textContent).toContain("Couldn’t open this world.");
    expect(retry()).toBeTruthy();
    // Said on the page, not in a dialog that leaves the blank page behind.
    expect(showError).not.toHaveBeenCalled();
});

test("Retry loads the session again and the page appears", async () => {
    waitForSaves.mockRejectedValueOnce(new Error("save failed"));
    await open(draft);

    await act(async () => retry().click());

    expect(waitForSaves).toHaveBeenCalledTimes(2);
    expect(alert()).toBeNull();
    expect(container.textContent).toContain("studio");
    expect(context.isAnonInitialized).toBe(true);
});

test("a retry that fails again keeps the message up", async () => {
    waitForSaves.mockRejectedValue(new Error("save failed"));
    await open(draft);

    await act(async () => retry().click());

    expect(waitForSaves).toHaveBeenCalledTimes(2);
    expect(alert().textContent).toContain("Couldn’t open this world.");
});

test("a session that loads shows no message", async () => {
    await open(draft);
    expect(alert()).toBeNull();
    expect(container.textContent).toContain("studio");

    await open({
        authenticated: true,
        isAnonymous: false,
        userId: "0xabc",
        token: "session-token",
        user: { walletId: "0xabc" },
    });
    expect(alert()).toBeNull();
    expect(context.isSignedIn).toBe(true);
});

test("the provider gives `isSignedIn` without changing `authenticated`", async () => {
    await open(draft);
    expect(context.authenticated).toBe(true);
    expect(context.isSignedIn).toBe(false);
});
