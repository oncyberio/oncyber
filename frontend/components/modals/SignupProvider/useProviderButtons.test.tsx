/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { useProviderButtons } from "./useProviderButtons";
import { connectors } from "../../../dApp/connect";

jest.mock("../../../dApp/connect", () => ({
    connectors: { metamask: jest.fn(), solana: jest.fn() },
}));
const metamask = connectors.metamask as unknown as jest.Mock;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let hook: ReturnType<typeof useProviderButtons>;
const onConnect = jest.fn();
const onFailure = jest.fn();
function Probe() {
    hook = useProviderButtons(onConnect, onFailure);
    return null;
}
beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    jest.spyOn(console, "error").mockImplementation(() => {});
    onConnect.mockReset().mockResolvedValue(undefined);
    onFailure.mockReset();
    metamask.mockReset();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    act(() => root.render(<Probe />));
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
    jest.restoreAllMocks();
});
const press = () => act(async () => hook.onConnectClick("metamask"));

test("a connected wallet is handed on, and the button shows it is busy meanwhile", async () => {
    let finish: Function;
    const connection = { type: "ethereum", walletId: "0x1" };
    metamask.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    let pending: Promise<void>;
    act(() => {
        pending = hook.onConnectClick("metamask");
    });
    expect(hook.isConnecting.metamask).toBe(true);
    await act(async () => {
        finish(connection);
        await pending;
    });
    expect(onConnect).toHaveBeenCalledWith(connection);
    expect(onFailure).not.toHaveBeenCalled();
    expect(hook.isConnecting.metamask).toBe(false);
});

test("closing the wallet’s request is reported as a cancellation, not logged as an error", async () => {
    metamask.mockRejectedValue({ code: 4001, message: "User rejected" });
    await press();
    expect(onFailure).toHaveBeenCalledWith(
        {
            code: "wallet/request-rejected",
            message: "You closed the wallet request.",
            cancelled: true,
            canRetry: false,
        },
        "metamask"
    );
    expect(onConnect).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
    expect(hook.isConnecting.metamask).toBe(false);
});

test.each([
    [
        "the wallet is not installed",
        Object.assign(new Error("Metamask is not installed."), {
            code: "wallet/not-installed",
        }),
        "That wallet isn’t installed in this browser. Install it, or choose another way to sign in.",
        false,
    ],
    [
        "the wallet fails in a way nobody mapped",
        new Error("DApp interaction is disabled"),
        "Couldn’t connect to your wallet. Try again, or choose another way to sign in. (DApp interaction is disabled)",
        true,
    ],
])("%s: says so beside the button", async (_name, error, message, canRetry) => {
    metamask.mockRejectedValue(error);
    await press();
    expect(onFailure).toHaveBeenCalledWith(
        expect.objectContaining({ message, canRetry, cancelled: false }),
        "metamask"
    );
    expect(console.error).toHaveBeenCalled();
});

test("a failure after the wallet connected is not blamed on the wallet", async () => {
    metamask.mockResolvedValue({ type: "ethereum", walletId: "0x1" });
    onConnect.mockRejectedValue(new Error("Failed to fetch"));
    await press();
    expect(onFailure).toHaveBeenCalledWith(
        expect.objectContaining({
            code: "sign-in/failed",
            message:
                "Couldn’t sign you in. Try again, or choose another way to sign in. (Failed to fetch)",
        }),
        "metamask"
    );
});
