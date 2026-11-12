/** @jest-environment jsdom */
import React from "react";
import { createRoot } from "react-dom/client";
import ConnectWallet, { SignInSheetHost, useSignInSheet } from "./index";

const act = (React as any).act;
(global as any).IS_REACT_ACT_ENVIRONMENT = true;

// One stand-in for the sheet, whether the host loads it or a screen draws it
// in place. Each rendered sheet shows who asked for it.
const mockSheet = (props) => (
    <div
        role="dialog"
        data-header={String(props.header ?? "")}
        data-skip={String(!!props.skipRedirectToAccount)}
    >
        <button data-close onClick={() => props.toggle?.(false)} />
        <button
            data-signed-in
            onClick={() => props.callbackAfterAuth?.("token", "account")}
        />
    </div>
);
jest.mock("next/dynamic", () => () => (props) => mockSheet(props));
jest.mock("./SignInSheet", () => ({
    __esModule: true,
    default: (props) => mockSheet(props),
}));

let root: ReturnType<typeof createRoot>, container: HTMLDivElement;
beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
});
const render = (tree: React.ReactNode) => act(() => root.render(tree));
const sheets = () => [...container.querySelectorAll('[role="dialog"]')];
const click = (selector: string) =>
    act(() =>
        container
            .querySelector(selector)
            .dispatchEvent(new MouseEvent("click", { bubbles: true }))
    );

test("screens that each ask for sign-in share one sheet, latest request on top", () => {
    const closeFirst = jest.fn(),
        closeSecond = jest.fn();
    const page = (first: boolean, second: boolean) => (
        <SignInSheetHost>
            <ConnectWallet open={first} toggle={closeFirst} header="first" />
            <ConnectWallet
                open={second}
                toggle={closeSecond}
                header="second"
                skipRedirectToAccount
            />
        </SignInSheetHost>
    );
    render(page(false, false));
    expect(sheets()).toHaveLength(0);

    render(page(true, false));
    expect(sheets()).toHaveLength(1);
    expect(sheets()[0].getAttribute("data-header")).toBe("first");

    // A second request does not add a sheet: the one sheet now serves it.
    render(page(true, true));
    expect(sheets()).toHaveLength(1);
    expect(sheets()[0].getAttribute("data-header")).toBe("second");
    expect(sheets()[0].getAttribute("data-skip")).toBe("true");

    // Closing goes to whoever is on top, and only to them.
    click("[data-close]");
    expect(closeSecond).toHaveBeenCalledWith(false);
    expect(closeFirst).not.toHaveBeenCalled();

    // When that screen withdraws, the earlier request has the sheet again.
    render(page(true, false));
    expect(sheets()).toHaveLength(1);
    expect(sheets()[0].getAttribute("data-header")).toBe("first");
    render(page(false, false));
    expect(sheets()).toHaveLength(0);
});

test("the sheet always calls the requesting screen's latest callbacks and settings", () => {
    const calls: string[] = [];
    const page = (label: string) => (
        <SignInSheetHost>
            <ConnectWallet
                open
                toggle={() => {}}
                header={label}
                callbackAfterAuth={() => calls.push(label)}
            />
        </SignInSheetHost>
    );
    render(page("before"));
    render(page("after"));
    expect(sheets()[0].getAttribute("data-header")).toBe("after");
    click("[data-signed-in]");
    expect(calls).toEqual(["after"]);
});

test("a screen that goes away takes its request with it", () => {
    render(
        <SignInSheetHost>
            <ConnectWallet open toggle={() => {}} />
        </SignInSheetHost>
    );
    expect(sheets()).toHaveLength(1);
    render(<SignInSheetHost />);
    expect(sheets()).toHaveLength(0);
});

test("code can open the sheet and gets the way to close it", () => {
    let sheet: ReturnType<typeof useSignInSheet>;
    const Probe = () => {
        sheet = useSignInSheet();
        return null;
    };
    const signedIn = jest.fn();
    render(
        <SignInSheetHost>
            <Probe />
        </SignInSheetHost>
    );
    let close: () => void;
    act(() => {
        close = sheet.open({ header: "code", callbackAfterAuth: signedIn });
    });
    expect(sheets()[0].getAttribute("data-header")).toBe("code");
    click("[data-signed-in]");
    expect(signedIn).toHaveBeenCalledWith("token", "account");
    // The sheet's own close control closes a request opened from code.
    click("[data-close]");
    expect(sheets()).toHaveLength(0);
    act(() => {
        close = sheet.open();
    });
    expect(sheets()).toHaveLength(1);
    act(() => close());
    expect(sheets()).toHaveLength(0);
});

test("without a host, and for embedded sign-in buttons, the sheet is drawn in place", () => {
    // No host above: tests and pages outside the app shell.
    render(<ConnectWallet open toggle={() => {}} header="alone" />);
    expect(sheets()).toHaveLength(1);
    expect(sheets()[0].getAttribute("data-header")).toBe("alone");

    // Buttons embedded in another layout are not a sheet to share.
    render(
        <SignInSheetHost>
            <div id="embedded">
                <ConnectWallet
                    open
                    toggle={() => {}}
                    customModalWrapper
                    header="embedded"
                />
            </div>
        </SignInSheetHost>
    );
    expect(sheets()).toHaveLength(1);
    expect(sheets()[0].parentElement.id).toBe("embedded");
});
