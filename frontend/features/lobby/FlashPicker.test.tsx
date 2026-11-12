/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { Simulate } from "react-dom/test-utils";
import { UserContext } from "@components/context/UserContext";
import FlashPicker from "./FlashPicker";
import useFlashNfts from "./useFlashNfts";

jest.mock("@components/context/UserContext", () => ({
    UserContext: require("react").createContext({}),
}));
jest.mock("next/dynamic", () => ({
    __esModule: true,
    default:
        () =>
        ({ toggle, skipRedirectToAccount }) =>
            (
                <div role="dialog" aria-label="Connect wallet" data-skips-session={String(!!skipRedirectToAccount)}>
                    <button onClick={toggle}>Close sign in</button>
                </div>
            ),
}));
jest.mock("@utils/urlUtils", () => ({
    resize: (url: string) => url,
    relay: (url: string) => `/api/proxyv2?url=${encodeURIComponent(url)}`,
}));
jest.mock("./useFlashNfts", () => ({
    ...jest.requireActual("./useFlashNfts"),
    __esModule: true,
    default: jest.fn(),
}));
const wallet = "0x1111111111111111111111111111111111111111";
const secondWallet = "0x2222222222222222222222222222222222222222";
const art = {
    id: "ethereum:art:1",
    title: "Blue sky",
    imageUrl: "/api/proxyv2?url=https%3A%2F%2Fimages.example%2Fart.png",
};
let account: any;
let collection: any;
let root: ReturnType<typeof createRoot>;
let host: HTMLDivElement;
let opener: HTMLButtonElement;
let onClose: jest.Mock;
let onSelect: jest.Mock;
let onStop: jest.Mock;
function render(showing = false) {
    act(() =>
        root.render(
            <UserContext.Provider value={account}>
                <FlashPicker
                    onClose={onClose}
                    onSelect={onSelect}
                    returnFocusRef={{ current: opener }}
                    showing={showing}
                    onStop={onStop}
                />
            </UserContext.Provider>
        )
    );
}
const button = (label: string) =>
    Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find(
        (element) =>
            element.getAttribute("aria-label") === label ||
            element.textContent === label
    );
const click = (label: string) => act(() => button(label).click());
beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    opener = document.createElement("button");
    document.body.append(opener);
    opener.focus();
    account = {
        authenticated: true,
        isAnonymous: false,
        defaultWallet: wallet,
        linkedWallets: [],
        userData: { type: "web3" },
    };
    collection = {
        items: [art],
        loading: false,
        error: "",
        hasMore: false,
        retry: jest.fn(),
        loadMore: jest.fn(),
    };
    (useFlashNfts as jest.Mock).mockImplementation(() => collection);
    onSelect = jest.fn();
    onClose = jest.fn();
    onStop = jest.fn();
});
afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    opener.remove();
    jest.clearAllMocks();
});

test("chooses actual artwork with its loaded image aspect and keeps Escape scoped to the picker", async () => {
    render(true);
    expect(document.activeElement).toBe(button("Close Flash"));
    const image = host.querySelector("img");
    Object.defineProperties(image, {
        naturalWidth: { value: 1200 },
        naturalHeight: { value: 800 },
    });
    click("Flash Blue sky");
    expect(onSelect).toHaveBeenCalledWith({ ...art, aspect: 1.5 });
    click("Stop Flash");
    expect(onStop).toHaveBeenCalledTimes(1);
    const outside = jest.fn();
    window.addEventListener("keydown", outside);
    try {
        act(() =>
            button("Close Flash").dispatchEvent(
                new KeyboardEvent("keydown", {
                    key: "Escape",
                    bubbles: true,
                    cancelable: true,
                })
            )
        );
        expect(onClose).toHaveBeenCalledTimes(1);
        expect(outside).not.toHaveBeenCalled();
    } finally {
        window.removeEventListener("keydown", outside);
    }
    await act(async () => root.render(null));
    expect(document.activeElement).toBe(opener);
});

test("shows loading, empty, error/retry and explicit pagination", () => {
    collection = { ...collection, items: [], loading: true };
    render();
    expect(host.textContent).toContain("Loading your NFTs");
    collection = { ...collection, loading: false };
    render();
    expect(host.textContent).toContain("No NFTs with an image preview");
    collection = { ...collection, error: "Your NFTs couldn’t load." };
    render();
    expect(host.querySelector('[role="alert"]').textContent).toContain(
        "couldn’t load"
    );
    click("Try again");
    expect(collection.retry).toHaveBeenCalledTimes(1);
    collection = { ...collection, error: "", items: [art], hasMore: true };
    render();
    click("Load more");
    expect(collection.loadMore).toHaveBeenCalledTimes(1);
});

test("signed-out and walletless users open the existing connection dialog", () => {
    account = { ...account, authenticated: false };
    render();
    expect(useFlashNfts).toHaveBeenLastCalledWith("", false);
    expect(button("Flash Blue sky")).toBeUndefined();
    click("Sign in");
    expect(host.querySelector('[aria-label="Connect wallet"]').getAttribute("data-skips-session")).toBe("false");
    expect(
        host.querySelector("#lobby-flash-picker").hasAttribute("inert")
    ).toBe(true);
    click("Close sign in");
    account = { ...account, authenticated: true, userData: { type: "web2" } };
    render();
    expect(host.textContent).toContain("Connect a wallet");
    expect(useFlashNfts).toHaveBeenLastCalledWith("", true);
});

test("switching linked wallets requests only the selected collection", () => {
    account.linkedWallets = [wallet, secondWallet];
    render();
    const select = host.querySelector("select");
    act(() => Simulate.change(select, { target: { value: secondWallet } }));
    expect(useFlashNfts).toHaveBeenLastCalledWith(secondWallet, true);
});

test("image failures cannot select a broken artwork and keyboard navigation follows live tiles", () => {
    collection.items = [art, { ...art, id: "two", title: "Sun" }];
    render();
    const first = button("Flash Blue sky");
    const last = button("Flash Sun");
    act(() => {
        first.focus();
        Simulate.keyDown(first, { key: "ArrowRight" });
    });
    expect(document.activeElement).toBe(last);
    act(() => Simulate.error(host.querySelector("img")));
    const failed = button("Blue sky — preview unavailable");
    expect(failed.disabled).toBe(true);
    act(() => failed.click());
    expect(onSelect).not.toHaveBeenCalled();
});

test("compact states expand only for an available collection and the close button closes", () => {
    account.authenticated = false;
    render();
    expect(
        host.querySelector("#lobby-flash-picker").getAttribute("data-compact")
    ).toBe("true");
    account.authenticated = true;
    collection.items = [];
    render();
    expect(
        host.querySelector("#lobby-flash-picker").getAttribute("data-compact")
    ).toBe("true");
    collection.items = [art];
    render();
    expect(
        host.querySelector("#lobby-flash-picker").getAttribute("data-compact")
    ).toBe("false");
    click("Close Flash");
    expect(onClose).toHaveBeenCalledTimes(1);
});

test("flat collection preserves native vertical scrolling", () => {
    jest.useFakeTimers();
    try {
        collection.items = [art, { ...art, id: "two", title: "Sun" }];
        render();
        const grid = host.querySelector<HTMLElement>(".flash-grid");
        const cards = Array.from(
            grid.querySelectorAll<HTMLElement>('[role="listitem"]')
        );
        Object.defineProperty(grid, "clientWidth", {
            configurable: true,
            value: 600,
        });
        cards.forEach((entry, index) =>
            Object.defineProperties(entry, {
                offsetLeft: { configurable: true, value: index * 450 },
                offsetWidth: { configurable: true, value: 150 },
            })
        );
        act(() => {
            window.dispatchEvent(new Event("resize"));
            jest.advanceTimersByTime(20);
        });
        expect(
            cards[0].style.getPropertyValue("--flash-turn")
        ).toBe("");
        expect(
            cards[1].style.getPropertyValue("--flash-turn")
        ).toBe("");
        const content = host.querySelector<HTMLElement>(".flash-content");
        const event = new WheelEvent("wheel", {
            deltaY: 100,
            bubbles: true,
            cancelable: true,
        });
        act(() => content.dispatchEvent(event));
        expect(event.defaultPrevented).toBe(false);
        expect(onSelect).not.toHaveBeenCalled();
    } finally {
        jest.useRealTimers();
    }
});
