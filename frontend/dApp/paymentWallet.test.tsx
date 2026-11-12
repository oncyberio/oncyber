/** @jest-environment jsdom */
// Connecting a wallet at checkout is for that payment only: it lists the
// wallets that can pay and never signs in, writes the account cookie or
// changes the session in `UserContext`.
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { UserContext } from "@components/context/UserContext";
import { showModal } from "@components/Dialogs";
import {
    connectEthereumForPayment,
    describePaymentWalletFailure,
    PaymentWalletPicker,
} from "./paymentWallet";
import { connectMetamask, connectors } from "./connect";

jest.mock("./connect", () => ({
    connectMetamask: jest.fn(),
    connectors: {
        metamask: jest.fn(),
        wallet_connect: jest.fn(),
        fortmatic: jest.fn(),
        bitski: jest.fn(),
        tezos: jest.fn(),
        solana: jest.fn(),
    },
}));
jest.mock("@components/Dialogs", () => ({ showModal: jest.fn() }));
jest.mock("@ui/components/IconImg", () => () => null);
jest.mock("@components/context/I18nContext", () => ({
    useCyberTranslation: () => ({
        t: (strings: TemplateStringsArray) => strings[0],
    }),
}));
jest.mock("@components/context/UserContext", () => {
    const React = require("react");
    return { UserContext: React.createContext({}) };
});

const metamask = connectors.metamask as unknown as jest.Mock;
const ethereumConnection = {
    type: "ethereum",
    provider: "metamask",
    walletId: "0xPAYER",
    eth: {},
    ethers: {},
};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const onClose = jest.fn();
const session = {
    authenticated: true,
    isAnonymous: false,
    user: { id: "0xsignedin" },
    token: "session-token",
    dispatch: jest.fn(),
    authHandler: jest.fn(),
    simple_authenticate: jest.fn(),
    changeAccount: jest.fn(),
};

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    jest.spyOn(console, "error").mockImplementation(() => {});
    metamask.mockReset();
    onClose.mockReset();
    Object.values(session).forEach(
        (value: any) => value?.mockReset && value.mockReset()
    );
    document.cookie = "_CCA=0xsignedin; path=/";
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    act(() =>
        root.render(
            <UserContext.Provider value={session as any}>
                <PaymentWalletPicker onClose={onClose} />
            </UserContext.Provider>
        )
    );
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
    jest.restoreAllMocks();
});

const buttons = () =>
    [...container.querySelectorAll("button")].map((b) => b.textContent.trim());
const press = (label: string) =>
    act(async () => {
        [...container.querySelectorAll("button")]
            .find((b) => b.textContent.trim().startsWith(label))
            .click();
    });
const alert = () => container.querySelector('[role="alert"]');

function sessionUntouched() {
    expect(session.authHandler).not.toHaveBeenCalled();
    expect(session.simple_authenticate).not.toHaveBeenCalled();
    expect(session.changeAccount).not.toHaveBeenCalled();
    expect(session.dispatch).not.toHaveBeenCalled();
    expect(document.cookie).toContain("_CCA=0xsignedin");
}

test("offers only wallets that can pay, and no way to sign in", () => {
    expect(buttons()).toEqual(
        expect.arrayContaining(["Wallet Connect", "Metamask"])
    );
    act(() => {
        [...container.querySelectorAll("button")]
            .find((b) => b.getAttribute("aria-expanded") === "false")
            .click();
    });
    const all = buttons().join(" | ");
    expect(all).toContain("Fortmatic");
    expect(all).toContain("Bitski");
    expect(all).not.toMatch(/Tezos|Solana|Nifty|Google|Twitter|Email/);
    expect(container.textContent).toContain(
        "Paying doesn’t change the account you’re signed in with."
    );
});

test("the chosen wallet is handed back for the payment and the session is untouched", async () => {
    metamask.mockResolvedValue(ethereumConnection);
    await press("Metamask");
    expect(onClose).toHaveBeenCalledWith(ethereumConnection);
    sessionUntouched();
});

test("closing the wallet's request shows nothing and hands nothing back", async () => {
    metamask.mockRejectedValue({ code: 4001 });
    await press("Metamask");
    expect(alert()).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    sessionUntouched();
});

test("a failure is said beside the wallets, and Retry connects the same wallet again", async () => {
    metamask.mockRejectedValueOnce(new Error("boom"));
    await press("Metamask");
    expect(alert().textContent).toContain(
        "Couldn’t connect to your wallet. Try again, or choose another."
    );
    expect(alert().textContent).not.toMatch(/sign/i);

    metamask.mockResolvedValueOnce(ethereumConnection);
    await press("Retry");
    expect(metamask).toHaveBeenCalledTimes(2);
    expect(alert()).toBeNull();
    expect(onClose).toHaveBeenCalledWith(ethereumConnection);
    sessionUntouched();
});

test("a wallet that is not installed has no Retry", async () => {
    metamask.mockRejectedValue({ code: "wallet/not-installed" });
    await press("Metamask");
    expect(alert().textContent).toContain("isn’t installed");
    expect(alert().querySelector("button")).toBeNull();
});

describe("describePaymentWalletFailure", () => {
    test.each([
        ["wallet/request-rejected", true, true, false],
        ["wallet/not-installed", false, false, false],
        ["wallet/request-pending", false, false, true],
        ["wallet/timeout", false, false, true],
        ["wallet/connect-failed", false, false, true],
        ["sign-in/failed", false, false, true],
    ])("%s", (code, cancelledIn, cancelled, canRetry) => {
        const described = describePaymentWalletFailure({
            code,
            cancelled: cancelledIn,
        });
        expect(described.cancelled).toBe(cancelled);
        expect(described.canRetry).toBe(canRetry);
        expect(described.message).not.toMatch(/sign/i);
    });
});

describe("connectEthereumForPayment", () => {
    afterEach(() => {
        delete (window as any).ethereum;
    });

    test("uses a MetaMask that is already connected, as before", async () => {
        (window as any).ethereum = {
            isMetaMask: true,
            isConnected: () => true,
        };
        (connectMetamask as jest.Mock).mockResolvedValue(ethereumConnection);
        await expect(connectEthereumForPayment("0xsignedin")).resolves.toBe(
            ethereumConnection
        );
        expect(showModal).not.toHaveBeenCalled();
    });

    test("otherwise opens the payment wallet chooser, not the sign-in sheet", () => {
        (showModal as jest.Mock).mockResolvedValue(undefined);
        connectEthereumForPayment(undefined);
        const [element] = (showModal as jest.Mock).mock.calls[0];
        expect(element.type).toBe(PaymentWalletPicker);
    });
});
