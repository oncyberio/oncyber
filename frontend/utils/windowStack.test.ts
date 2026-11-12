/** @jest-environment jsdom */
import {
    CloseControls,
    closesOnEscape,
    escapeInsideWindow,
    EscapeAction,
    EscapePress,
    hasOpenWindow,
    openWindow,
    resolveEscape,
    StackedWindow,
} from "./windowStack";

const controls: CloseControls = {
    hasClosePath: true,
    hasCloseButton: false,
    hasBackdropClose: false,
    labelled: false,
};

test.each<[string, Partial<CloseControls>, boolean]>([
    ["a labelled modal", { labelled: true }, true],
    ["an unlabelled modal with a close button", { hasCloseButton: true }, true],
    ["an unlabelled modal with a backdrop", { hasBackdropClose: true }, true],
    ["a modal with no close control", {}, false],
    ["a forced modal", { labelled: true, forceOpen: true }, false],
    [
        "a forced modal that also asks for Escape",
        { hasCloseButton: true, forceOpen: true, closeOnEscape: true },
        false,
    ],
    [
        "a modal with nothing to call",
        { hasClosePath: false, hasCloseButton: true, closeOnEscape: true },
        false,
    ],
    [
        "a modal running something irreversible",
        { hasCloseButton: true, hasBackdropClose: true, closeOnEscape: false },
        false,
    ],
    [
        "a modal whose close control is in its content",
        { closeOnEscape: true },
        true,
    ],
])("Escape on %s closes it: %s", (_name, change, expected) => {
    expect(closesOnEscape({ ...controls, ...change })).toBe(expected);
});

const press: EscapePress = {
    key: "Escape",
    composing: false,
    repeat: false,
    hasWindow: true,
    covered: false,
    inPopup: false,
    origin: "outside",
    handledInside: false,
    canClose: true,
};

test.each<[string, Partial<EscapePress>, EscapeAction]>([
    ["Escape with a window open", {}, "close"],
    ["another key", { key: "Enter" }, "pass"],
    ["Escape during composition", { composing: true }, "pass"],
    ["Escape with no window open", { hasWindow: false }, "pass"],
    ["Escape under a shared dialog", { covered: true }, "pass"],
    ["Escape inside an open menu", { inPopup: true }, "pass"],
    ["Escape on a window that cannot close", { canClose: false }, "pass"],
    [
        "Escape inside a window that cannot close",
        { canClose: false, origin: "inside-bubble" },
        "pass",
    ],
    [
        "Escape inside the window, before its content has answered",
        { origin: "inside-capture" },
        "defer",
    ],
    [
        "Escape inside the window, unanswered by its content",
        { origin: "inside-bubble" },
        "close",
    ],
    [
        "Escape already answered inside the window",
        { origin: "inside-bubble", handledInside: true },
        "hold",
    ],
    ["Escape held down", { repeat: true }, "hold"],
    [
        "Escape held down inside the window",
        { origin: "inside-bubble", repeat: true },
        "hold",
    ],
])("%s: %s", (_name, change, expected) => {
    expect(resolveEscape({ ...press, ...change })).toBe(expected);
});

describe("the stack", () => {
    const closers: (() => void)[] = [];
    const beneath = jest.fn();
    function open(change: Partial<StackedWindow> = {}) {
        const element = document.createElement("div");
        const input = element.appendChild(document.createElement("input"));
        document.body.append(element);
        const win: StackedWindow = {
            contains: (node) => element.contains(node),
            canClose: () => true,
            close: jest.fn(),
            ...change,
        };
        // What Modal does with its container's onKeyDown.
        element.addEventListener("keydown", (event) =>
            escapeInsideWindow(win, event)
        );
        const remove = openWindow(win);
        closers.push(() => {
            remove();
            element.remove();
        });
        return { win, element, input, remove };
    }
    function key(target: EventTarget = document.body, init = {}) {
        const event = new KeyboardEvent("keydown", {
            key: "Escape",
            bubbles: true,
            cancelable: true,
            ...init,
        });
        target.dispatchEvent(event);
        return event;
    }
    beforeEach(() => window.addEventListener("keydown", beneath));
    afterEach(() => {
        closers.splice(0).forEach((close) => close());
        window.removeEventListener("keydown", beneath);
        beneath.mockClear();
    });

    it("closes the only window and keeps the key from the page beneath", () => {
        const { win } = open();
        const event = key();
        expect(win.close).toHaveBeenCalledTimes(1);
        expect(event.defaultPrevented).toBe(true);
        expect(beneath).not.toHaveBeenCalled();
    });

    it("closes one window per press, the top one first", () => {
        const first = open();
        const second = open();
        key();
        expect(second.win.close).toHaveBeenCalledTimes(1);
        expect(first.win.close).not.toHaveBeenCalled();
        second.remove();
        key();
        expect(first.win.close).toHaveBeenCalledTimes(1);
        expect(second.win.close).toHaveBeenCalledTimes(1);
    });

    it("goes to the top window even when the key is pressed in the one below", () => {
        const first = open();
        const second = open();
        key(first.input);
        expect(second.win.close).toHaveBeenCalledTimes(1);
        expect(first.win.close).not.toHaveBeenCalled();
    });

    it("leaves the window below alone when the top one cannot close", () => {
        const first = open();
        const second = open({ canClose: () => false });
        const event = key();
        expect(second.win.close).not.toHaveBeenCalled();
        expect(first.win.close).not.toHaveBeenCalled();
        expect(event.defaultPrevented).toBe(false);
        // Ignored, not swallowed: an overlay drawn above can still answer.
        expect(beneath).toHaveBeenCalledTimes(1);
    });

    it("ignores Escape while text is being composed", () => {
        const { win, input } = open();
        expect(key(input, { isComposing: true }).defaultPrevented).toBe(false);
        expect(key(input, { keyCode: 229 }).defaultPrevented).toBe(false);
        expect(win.close).not.toHaveBeenCalled();
        expect(beneath).toHaveBeenCalledTimes(2);
    });

    it("closes once while Escape is held down", () => {
        const { win } = open();
        key();
        key(document.body, { repeat: true });
        expect(win.close).toHaveBeenCalledTimes(1);
        expect(beneath).not.toHaveBeenCalled();
    });

    it("lets a control inside the window answer Escape first", () => {
        const { win, input } = open();
        input.addEventListener("keydown", (event) => event.preventDefault());
        key(input);
        expect(win.close).not.toHaveBeenCalled();
        expect(beneath).not.toHaveBeenCalled();
        input.addEventListener("keydown", (event) => event.stopPropagation());
        key(input);
        expect(win.close).not.toHaveBeenCalled();
    });

    it("closes from inside when nothing in the window answers", () => {
        const { win, input } = open();
        const event = key(input);
        expect(win.close).toHaveBeenCalledTimes(1);
        expect(event.defaultPrevented).toBe(true);
        expect(beneath).not.toHaveBeenCalled();
    });

    it("leaves Escape to an open menu", () => {
        const { win, element } = open();
        const menu = element.appendChild(document.createElement("ul"));
        menu.setAttribute("role", "menu");
        const item = menu.appendChild(document.createElement("li"));
        key(item);
        expect(win.close).not.toHaveBeenCalled();
        const trigger = element.appendChild(document.createElement("button"));
        trigger.setAttribute("aria-haspopup", "listbox");
        trigger.setAttribute("aria-expanded", "true");
        key(trigger);
        expect(win.close).not.toHaveBeenCalled();
        trigger.setAttribute("aria-expanded", "false");
        key(trigger);
        expect(win.close).toHaveBeenCalledTimes(1);
    });

    it("stays open under something that closes itself first", () => {
        let covered = true;
        const { win } = open({ isCovered: () => covered });
        expect(key().defaultPrevented).toBe(false);
        expect(win.close).not.toHaveBeenCalled();
        expect(beneath).toHaveBeenCalledTimes(1);
        covered = false;
        key();
        expect(win.close).toHaveBeenCalledTimes(1);
    });

    it("stops listening once every window has closed", () => {
        const { win, remove } = open();
        expect(hasOpenWindow()).toBe(true);
        remove();
        remove();
        expect(hasOpenWindow()).toBe(false);
        expect(key().defaultPrevented).toBe(false);
        expect(win.close).not.toHaveBeenCalled();
        expect(beneath).toHaveBeenCalledTimes(1);
    });
});
