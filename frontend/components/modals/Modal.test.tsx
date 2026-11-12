/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { DialogProvider, showInfo } from "@components/Dialogs";
import Modal from "./Modal";
import AnimatedModal from "./AnimatedModal";

jest.mock("../Icon", () => () => null);
// The real shared dialogs, without the image helper that loads the 3D engine.
jest.mock("@ui/components/IconImg", () => () => null);

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const beneath = jest.fn();
beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    window.addEventListener("keydown", beneath);
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
    window.removeEventListener("keydown", beneath);
    beneath.mockClear();
    jest.restoreAllMocks();
    jest.useRealTimers();
});

const render = (element: React.ReactNode) =>
    act(() => root.render(<DialogProvider>{element}</DialogProvider>));
function press(target: EventTarget = document.body, init = {}) {
    const event = new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
        ...init,
    });
    act(() => {
        target.dispatchEvent(event);
    });
    return event;
}
const dialogs = () =>
    Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]'));
const button = (name: string) =>
    Array.from(document.querySelectorAll("button")).find(
        (element) =>
            element.textContent === name ||
            element.getAttribute("aria-label") === name
    );

describe("which windows Escape closes", () => {
    const cases: [string, Record<string, any>, boolean][] = [
        ["a labelled modal", { ariaLabel: "Sign in" }, true],
        ["an unlabelled modal with a close button", {}, true],
        [
            "an unlabelled modal with a backdrop",
            { noShowClose: true, isBackdrop: true },
            true,
        ],
        ["a forced modal", { ariaLabel: "Sign in", forceOpen: true }, false],
        ["a modal with no close control", { noShowClose: true }, false],
        [
            "a modal running something irreversible",
            { isBackdrop: true, closeOnEscape: false },
            false,
        ],
        [
            "a modal whose close control is in its content",
            { noShowClose: true, closeOnEscape: true },
            true,
        ],
    ];
    it.each(cases)("%s", (_name, props, closes) => {
        const toggle = jest.fn();
        render(
            <Modal isShowing toggle={toggle} {...props}>
                <p>Content</p>
            </Modal>
        );
        const event = press();
        expect(toggle.mock.calls).toEqual(closes ? [[false]] : []);
        expect(event.defaultPrevented).toBe(closes);
        // A closed window keeps the key; an ignored key is left alone.
        expect(beneath).toHaveBeenCalledTimes(closes ? 0 : 1);
    });

    it("a modal that only closes through setShow", () => {
        const setShow = jest.fn();
        render(
            <Modal isShowing setShow={setShow} isBackdrop>
                <p>Content</p>
            </Modal>
        );
        press();
        expect(setShow.mock.calls).toEqual([[false]]);
    });

    it("a modal with nothing to call", () => {
        render(
            <Modal isShowing isBackdrop>
                <p>Content</p>
            </Modal>
        );
        expect(press().defaultPrevented).toBe(false);
        expect(dialogs()).toHaveLength(1);
    });
});

it("takes the same path as the close button", () => {
    const toggle = jest.fn();
    const resetCallback = jest.fn();
    render(
        <Modal isShowing toggle={toggle} resetCallback={resetCallback}>
            <p>Content</p>
        </Modal>
    );
    act(() => button("Close dialog").click());
    expect(resetCallback).toHaveBeenCalledTimes(1);
    expect(toggle).toHaveBeenCalledTimes(1);
    press();
    expect(resetCallback).toHaveBeenCalledTimes(2);
    expect(toggle).toHaveBeenLastCalledWith(false);
});

function Stacked({
    top = {},
    onClose,
}: {
    top?: Record<string, any>;
    onClose: (name: string) => void;
}) {
    const [open, setOpen] = React.useState({ below: true, above: true });
    const close = (name: string) => () => {
        onClose(name);
        setOpen((state) => ({ ...state, [name]: false }));
    };
    return (
        <>
            <Modal isShowing={open.below} toggle={close("below")}>
                <input aria-label="Below" />
            </Modal>
            <Modal isShowing={open.above} toggle={close("above")} {...top}>
                <input aria-label="Above" />
            </Modal>
        </>
    );
}

it("closes one window per press, the top one first", () => {
    const onClose = jest.fn();
    render(<Stacked onClose={onClose} />);
    // Even when the key is pressed in the window below.
    press(document.querySelector('[aria-label="Below"]'));
    expect(onClose.mock.calls).toEqual([["above"]]);
    expect(dialogs()).toHaveLength(1);
    press();
    expect(onClose.mock.calls).toEqual([["above"], ["below"]]);
    expect(dialogs()).toHaveLength(0);
    expect(beneath).not.toHaveBeenCalled();
});

it("keeps the window below open while the top one cannot close", () => {
    const onClose = jest.fn();
    render(<Stacked onClose={onClose} top={{ forceOpen: true }} />);
    press();
    press(document.querySelector('[aria-label="Below"]'));
    expect(onClose).not.toHaveBeenCalled();
    expect(dialogs()).toHaveLength(2);
});

it("ignores Escape while text is being composed", () => {
    const toggle = jest.fn();
    render(
        <Modal isShowing toggle={toggle}>
            <input aria-label="Name" />
        </Modal>
    );
    const input = document.querySelector("input");
    expect(press(input, { isComposing: true }).defaultPrevented).toBe(false);
    expect(press(document.body, { isComposing: true }).defaultPrevented).toBe(
        false
    );
    expect(toggle).not.toHaveBeenCalled();
    press(input);
    expect(toggle).toHaveBeenCalledTimes(1);
});

it("lets a control inside the window answer Escape first", () => {
    const toggle = jest.fn();
    const outer = jest.fn();
    const answered: string[] = [];
    render(
        // An ancestor with its own Escape handling, like the artwork panel.
        <div onKeyDown={outer}>
            <Modal isShowing toggle={toggle}>
                <input
                    aria-label="Prevents"
                    onKeyDown={(event) => {
                        answered.push("prevents");
                        event.preventDefault();
                    }}
                />
                <input
                    aria-label="Stops"
                    onKeyDown={(event) => {
                        answered.push("stops");
                        event.stopPropagation();
                    }}
                />
                <input aria-label="Plain" />
            </Modal>
        </div>
    );
    press(document.querySelector('[aria-label="Prevents"]'));
    press(document.querySelector('[aria-label="Stops"]'));
    expect(answered).toEqual(["prevents", "stops"]);
    expect(toggle).not.toHaveBeenCalled();
    press(document.querySelector('[aria-label="Plain"]'));
    expect(toggle).toHaveBeenCalledTimes(1);
    // Nothing outside the window saw any of the three presses.
    expect(outer).not.toHaveBeenCalled();
    expect(beneath).not.toHaveBeenCalled();
});

it("lets a shared dialog above it answer Escape first, then closes on the next press", async () => {
    const toggle = jest.fn();
    render(
        <Modal isShowing toggle={toggle} ariaLabel="Sign in">
            <button type="button">Continue</button>
        </Modal>
    );
    let closed = false;
    await act(async () => {
        void showInfo("Check your inbox").then(() => (closed = true));
    });
    expect(document.getElementById("dialogs-root").textContent).toContain(
        "Check your inbox"
    );
    // The dialog is the top window: one press dismisses it and nothing else.
    expect(press().defaultPrevented).toBe(true);
    await act(async () => {});
    expect(closed).toBe(true);
    expect(toggle).not.toHaveBeenCalled();
    press();
    expect(toggle).toHaveBeenCalledTimes(1);
});

describe("a labelled modal", () => {
    beforeEach(() => {
        // jsdom lays nothing out; the trap only counts elements with a box.
        jest.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([
            {},
        ] as any);
    });

    it("still takes focus, keeps Tab inside and returns focus", () => {
        const opener = document.createElement("button");
        document.body.append(opener);
        opener.focus();
        const toggle = jest.fn();
        const modal = (isShowing: boolean) => (
            <Modal isShowing={isShowing} toggle={toggle} ariaLabel="Sign in">
                <button type="button">Email</button>
                <button type="button">Wallet</button>
            </Modal>
        );
        render(modal(true));
        const tab = (shiftKey = false) => {
            const event = new KeyboardEvent("keydown", {
                key: "Tab",
                shiftKey,
                bubbles: true,
                cancelable: true,
            });
            act(() => {
                document.activeElement.dispatchEvent(event);
            });
            return event;
        };
        expect(dialogs()[0].getAttribute("aria-label")).toBe("Sign in");
        expect(document.activeElement).toBe(button("Close dialog"));
        expect(tab(true).defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(button("Wallet"));
        expect(tab().defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(button("Close dialog"));
        press(document.activeElement);
        expect(toggle.mock.calls).toEqual([[false]]);
        render(modal(false));
        expect(document.activeElement).toBe(opener);
        opener.remove();
    });

    it("does not move focus into an unlabelled modal", () => {
        const opener = document.createElement("button");
        document.body.append(opener);
        opener.focus();
        render(
            <Modal isShowing toggle={jest.fn()}>
                <button type="button">Email</button>
            </Modal>
        );
        expect(document.activeElement).toBe(opener);
        opener.remove();
    });
});

describe("AnimatedModal", () => {
    function Animated({ onClose }: { onClose: (name: string) => void }) {
        const [open, setOpen] = React.useState(true);
        return (
            <>
                <Modal isShowing toggle={() => onClose("below")}>
                    <p>Below</p>
                </Modal>
                <AnimatedModal
                    isShowing={open}
                    isBackdrop
                    noShowClose
                    toggle={(next: boolean) => {
                        onClose("animated");
                        setOpen(next);
                    }}
                >
                    <p>Above</p>
                </AnimatedModal>
            </>
        );
    }

    it("closes on Escape and hands the next press to the window below", () => {
        jest.useFakeTimers();
        const onClose = jest.fn();
        render(<Animated onClose={onClose} />);
        expect(dialogs()).toHaveLength(2);
        press();
        expect(onClose.mock.calls).toEqual([["animated"]]);
        // Still on screen while it animates out, but no longer the top window.
        expect(dialogs()).toHaveLength(2);
        press();
        expect(onClose.mock.calls).toEqual([["animated"], ["below"]]);
        act(() => {
            jest.advanceTimersByTime(500);
        });
        expect(dialogs()).toHaveLength(1);
    });

    it("ignores Escape when it shows no close control", () => {
        const toggle = jest.fn();
        render(
            // The shape of the purchase-in-flight overlay.
            <AnimatedModal isShowing noShowClose toggle={toggle}>
                <p>Finishing your purchase…</p>
            </AnimatedModal>
        );
        expect(press().defaultPrevented).toBe(false);
        expect(toggle).not.toHaveBeenCalled();
    });
});
