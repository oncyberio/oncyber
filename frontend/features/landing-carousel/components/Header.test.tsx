/** @jest-environment jsdom */
import React from "react";
import { createRoot } from "react-dom/client";
import { Simulate } from "react-dom/test-utils";
import { UserContext } from "@components/context/UserContext";
import { showError, showModal } from "@components/Dialogs";
import Header from "./Header";

const mockModalProps: any[] = [];
jest.mock("next/router", () => ({ useRouter: () => ({ asPath: "/" }) }));
const act = (React as any).act;
(global as any).IS_REACT_ACT_ENVIRONMENT = true;
jest.mock("@components/context/UserContext", () => ({
    UserContext: require("react").createContext({}),
}));
jest.mock("@components/InAppLink", () => ({
    __esModule: true,
    default: require("react").forwardRef(({ children, ...props }, ref) => (
        <a {...props} ref={ref}>
            {children}
        </a>
    )),
}));
jest.mock("next/dynamic", () => () => (props) => {
    mockModalProps.push(props);
    return <div data-testid="account-modal" />;
});
jest.mock("./CyberloopMark", () => () => <span />);
jest.mock("@components/Dialogs", () => ({
    showError: jest.fn(),
    showModal: jest.fn(),
}));
jest.mock("@utils/analytics", () => ({
    amplitude_logAnalyticsEvent: jest.fn(),
}));

let root: ReturnType<typeof createRoot>, container: HTMLDivElement;
const logout = jest.fn();
const account = {
    user: { id: "0x1234567890123456789012345678901234567890" },
    userData: { username: "@rayan", avatar: "/avatar.jpg" },
    authenticated: true,
    isAnonymous: false,
    logout,
};
beforeEach(() => {
    jest.clearAllMocks();
    mockModalProps.length = 0;
    logout.mockResolvedValue(undefined);
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
        configurable: true,
        value() {
            this.setAttribute("open", "");
        },
    });
    Object.defineProperty(HTMLDialogElement.prototype, "close", {
        configurable: true,
        value() {
            this.removeAttribute("open");
        },
    });
    window.matchMedia = jest.fn(() => ({ matches: true })) as any;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
    jest.useRealTimers();
});
function render(value: any = account, props = {}) {
    act(() =>
        root.render(
            <UserContext.Provider value={value}>
                <Header
                    menu={<button>Feeds</button>}
                    search={null}
                    {...props}
                />
                <button id="outside">Outside</button>
            </UserContext.Provider>
        )
    );
}
function trigger() {
    return container.querySelector<HTMLButtonElement>(
        '[aria-haspopup="dialog"]'
    );
}
function items() {
    return Array.from(
        document.querySelectorAll<HTMLElement>("[data-account-item]")
    );
}
function key(element: HTMLElement, key: string) {
    const event = new KeyboardEvent("keydown", {
        key,
        bubbles: true,
        cancelable: true,
    });
    act(() => element.dispatchEvent(event));
    return event;
}
function open() {
    act(() => {
        trigger().focus();
        Simulate.click(trigger());
    });
}

it("keeps the account identity and exposes separate spaces and destinations links", () => {
    render();
    expect(trigger().textContent).toContain("@rayan");
    expect(trigger().textContent).toContain("0x1234…7890");
    expect(trigger().querySelector("img").getAttribute("src")).toBe(
        "/avatar.jpg"
    );
    expect(trigger().getAttribute("aria-expanded")).toBe("false");
    open();
    expect(
        items().map(
            (item) =>
                item.querySelector("strong")?.textContent || item.textContent
        )
    ).toEqual([
        "My spaces",
        "My destinations",
        "Friends",
        "Edit profile",
        "Linked accounts",
        "Contribute",
        "Sign out",
    ]);
    expect(items()[0].getAttribute("href")).toBe("/@rayan");
    expect(items()[1].getAttribute("href")).toBe("/destinations");
    expect(document.activeElement).toBe(items()[0]);
    act(() => Simulate.click(items()[1]));
    expect(items()).toHaveLength(0);
    expect(document.activeElement).toBe(trigger());
});

it("uses the account ID when no username has been set", () => {
    render({ ...account, userData: {} });
    open();
    expect(items()[0].getAttribute("href")).toBe(`/@${account.user.id}`);
});

it("contains keyboard focus, supports Escape, and returns focus to the account trigger", () => {
    render();
    act(() => trigger().focus());
    key(trigger(), "ArrowUp");
    expect(document.activeElement).toBe(items()[6]);
    const close = document.querySelector<HTMLButtonElement>(".close-account");
    key(document.activeElement as HTMLElement, "Tab");
    expect(document.activeElement).toBe(close);
    const back = new KeyboardEvent("keydown", {
        key: "Tab",
        shiftKey: true,
        bubbles: true,
        cancelable: true,
    });
    act(() => close.dispatchEvent(back));
    expect(document.activeElement).toBe(items()[6]);
    const escape = key(document.activeElement as HTMLElement, "Escape");
    expect(escape.defaultPrevented).toBe(true);
    expect(items()).toHaveLength(0);
    expect(document.activeElement).toBe(trigger());
    key(trigger(), "ArrowDown");
    expect(document.activeElement).toBe(items()[0]);
});

it("opens above the page, dismisses on the backdrop, and restores page scrolling", () => {
    render();
    document.body.style.overflow = "clip";
    open();
    const dialog = document.querySelector("dialog");
    expect(dialog.parentElement).toBe(document.body);
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.hasAttribute("open")).toBe(true);
    expect(document.body.style.overflow).toBe("hidden");
    act(() => Simulate.pointerDown(dialog));
    expect(document.querySelector("dialog")).toBeNull();
    expect(document.body.style.overflow).toBe("clip");
    expect(document.activeElement).toBe(trigger());
    document.body.style.overflow = "";
});

it("unmounting during the exit animation cancels its timer and removes the panel", () => {
    jest.useFakeTimers();
    window.matchMedia = jest.fn(() => ({ matches: false })) as any;
    render();
    open();
    key(document.activeElement as HTMLElement, "Escape");
    expect(document.querySelector("dialog").getAttribute("data-closing")).toBe(
        "true"
    );
    render({ ...account, authenticated: false });
    expect(document.querySelector("dialog")).toBeNull();
    expect(jest.getTimerCount()).toBe(0);
    expect(document.body.style.overflow).toBe("");
});

it("linked accounts uses the existing connections form after closing the sidebar", () => {
    render();
    open();
    act(() => Simulate.click(items()[4]));
    expect(document.querySelector("dialog")).toBeNull();
    expect(showModal).toHaveBeenCalledWith(
        expect.objectContaining({ props: { defaultStep: "connections" } })
    );
});

it("contribute opens the contribute settings after closing the sidebar", () => {
    render();
    open();
    act(() => Simulate.click(items()[5]));
    expect(document.querySelector("dialog")).toBeNull();
    expect(showModal).toHaveBeenCalledWith(
        expect.objectContaining({ props: { defaultStep: "contribute" } })
    );
});

it("opens the existing profile settings and signs out through UserContext", async () => {
    render();
    open();
    act(() => Simulate.click(items()[3]));
    expect(showModal).toHaveBeenCalledTimes(1);
    expect(items()).toHaveLength(0);
    open();
    await act(async () => Simulate.click(items()[6]));
    expect(logout).toHaveBeenCalledTimes(1);
    expect(items()).toHaveLength(0);
    expect(showError).not.toHaveBeenCalled();
});

it("retains sign in for signed-out and anonymous users", () => {
    render({ ...account, authenticated: false });
    expect(trigger()).toBeNull();
    expect(container.querySelector(".sign-in").textContent).toContain(
        "Sign in"
    );
    act(() => Simulate.click(container.querySelector(".sign-in")));
    expect(
        container.querySelector('[data-testid="account-modal"]')
    ).not.toBeNull();
    expect(
        mockModalProps[mockModalProps.length - 1].skipRedirectToAccount
    ).toBe(false);
    render({ ...account, isAnonymous: true });
    expect(trigger()).toBeNull();
});

it("dismisses stale account navigation when the account changes", () => {
    render();
    open();
    render({ ...account, user: { id: "another-wallet" }, userData: {} });
    expect(items()).toHaveLength(0);
    open();
    expect(items()[0].getAttribute("href")).toBe("/@another-wallet");
});

it("preserves runtime identity updates after signing in from an experience", async () => {
    const onConnected = jest.fn();
    render({ ...account, authenticated: false }, { onConnected });
    act(() => Simulate.click(container.querySelector(".sign-in")));
    expect(
        mockModalProps[mockModalProps.length - 1].skipRedirectToAccount
    ).toBe(true);
    const profile = { username: "visitor" };
    await act(async () =>
        mockModalProps[mockModalProps.length - 1].callbackAfterAuth(
            "test-token",
            "test-account",
            {},
            { userData: profile }
        )
    );
    expect(onConnected).toHaveBeenCalledWith(
        profile,
        "test-account",
        "test-token"
    );
});

it("opens friends from the account menu and closes it on account change", () => {
    render();
    open();
    act(() => Simulate.click(items()[2]));
    expect(items()).toHaveLength(0);
    expect(mockModalProps[mockModalProps.length - 1].onClose).toEqual(
        expect.any(Function)
    );
    render({ ...account, user: { id: "another-account" } });
    expect(container.querySelector('[data-testid="account-modal"]')).toBeNull();
});
