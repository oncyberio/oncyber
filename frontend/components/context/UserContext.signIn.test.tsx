/** @jest-environment jsdom */
// What `authHandler` hands back when a sign-in does not finish. The session
// handling around it is left as it is; these tests pin that a failure is
// still a failure for every caller and only its wording is decided here.
import React, { act, useContext } from "react";
import { createRoot } from "react-dom/client";
import { UserContext, UserProvider } from "./UserContext";
import { authServices } from "@features/auth/providers";
import { amplitude_logAnalyticsEvent } from "@utils/analytics";

const mockAuthenticate = jest.fn();
jest.mock(
    "@api/accounts/_api",
    () => ({
        __esModule: true,
        default: {
            opts: () => ({ authenticate: mockAuthenticate }),
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
jest.mock("@features/studio/utils", () => ({
    getDefaultWallet: jest.fn(() => ""),
    getLinkedWallets: jest.fn(() => []),
}));
jest.mock("@utils/saveToDb", () => ({ getDestination: jest.fn() }));

const logged = amplitude_logAnalyticsEvent as jest.Mock;
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let context: any;
function Probe() {
    context = useContext(UserContext);
    return null;
}
beforeEach(async () => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(console, "log").mockImplementation(() => {});
    mockAuthenticate.mockReset();
    logged.mockClear();
    localStorage.clear();
    document.cookie = "_CCA=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    await act(async () =>
        root.render(
            <UserProvider {...({} as any)}>
                <Probe />
            </UserProvider>
        )
    );
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
    jest.restoreAllMocks();
});

const signIn = async (options: any) => {
    let result: any;
    await act(async () => {
        result = await context.authHandler(options);
    });
    return result;
};
const failedEvents = () =>
    logged.mock.calls.filter(([name]) => name === "account_auth_failed");

test("closing the Google window is still a failed sign-in, worded as a cancellation", async () => {
    jest.spyOn(authServices.google, "signIn").mockRejectedValue({
        code: "auth/popup-closed-by-user",
    });
    expect(await signIn({ type: "google" })).toEqual({
        success: false,
        message: "You closed the sign-in window.",
        type: "",
        code: "auth/popup-closed-by-user",
        cancelled: true,
        canRetry: false,
    });
    // Counted exactly as before, and the session is untouched.
    expect(failedEvents()).toHaveLength(1);
    expect(mockAuthenticate).not.toHaveBeenCalled();
    expect(document.cookie).not.toContain("_CCA");
    expect(context.token).toBe("");
});

test("closing the wallet’s signature request is named", async () => {
    jest.spyOn(authServices.web3, "signIn").mockRejectedValue(
        Object.assign(new Error("Failed to sign in to web3"), {
            code: "wallet/signature-rejected",
        })
    );
    const result = await signIn({
        type: "web3",
        walletId: "0xabc",
        connection: { type: "ethereum", walletId: "0xabc" },
    });
    expect(result).toMatchObject({
        success: false,
        message: "You closed the signature request.",
        cancelled: true,
    });
});

test("a failure nobody mapped is general, with the provider’s code, and can be retried", async () => {
    jest.spyOn(authServices.twitter, "signIn").mockRejectedValue({
        code: "auth/internal-error",
    });
    expect(await signIn({ type: "twitter" })).toMatchObject({
        success: false,
        message:
            "Couldn’t sign you in. Try again, or choose another way to sign in. (auth/internal-error)",
        cancelled: false,
        canRetry: true,
    });
});

test("a failure after the provider answered is worded too, not passed through raw", async () => {
    jest.spyOn(authServices.google, "signIn").mockResolvedValue({
        providerId: "google.com",
        user: { uid: "u1", getIdToken: async () => "id-token" },
    } as any);
    mockAuthenticate.mockRejectedValue(new TypeError("Failed to fetch"));
    expect(await signIn({ type: "google" })).toMatchObject({
        success: false,
        message:
            "Couldn’t sign you in. Try again, or choose another way to sign in. (Failed to fetch)",
    });
});

test("a refusal from our API is returned as the API worded it", async () => {
    jest.spyOn(authServices.google, "signIn").mockResolvedValue({
        providerId: "google.com",
        user: { uid: "u1", getIdToken: async () => "id-token" },
    } as any);
    mockAuthenticate.mockResolvedValue({
        success: false,
        message: "Account u1 is already linked",
        type: "link:account-exists",
        account: { owner: "other" },
    });
    const result = await signIn({ type: "google", islinking: true });
    expect(result).toMatchObject({
        success: false,
        message: "Account u1 is already linked",
        type: "link:account-exists",
        authPayload: { owner: "other" },
    });
    expect(result.code).toBeUndefined();
    expect(result.mergePayload).toMatchObject({ owner: "u1", type: "web2" });
});
