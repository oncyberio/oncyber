/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import {
    DialogProvider,
    showConfirm,
    showInfo,
    showModal,
    showPrompt,
    useDialogTheme,
} from "./index";
import { DIALOG_COLOR_SCHEMES } from "./styles";

// The icon component pulls in the 3D engine's constants.
jest.mock("@ui/components/IconImg", () => () => null);

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
});

const mount = (children: React.ReactNode = null) =>
    act(() => root.render(<DialogProvider>{children}</DialogProvider>));
/** The dialog box: the last element in the dialogs portal. */
const dialog = () =>
    document.querySelector<HTMLElement>("#dialogs-root > div:last-child");
const buttons = () => Array.from(dialog().querySelectorAll("button"));

test("the dark scheme keeps the variable names other screens read, on the panel material", () => {
    expect(DIALOG_COLOR_SCHEMES.dark).toMatchObject({
        "--bg-color": "#191919",
        "--title-color": "#f3f3f1",
        "--content-color": "#c2c2bd",
        "--border-color": "#ffffff12",
        "--btn-bg-color": "#20201e",
        "--btn-color": "#fafaf8",
        "--btn-border-color": "#ffffff99",
        "--img-invert": "0.7",
    });
    // Every name exists in both schemes, so a part styled with one works
    // with the other.
    expect(Object.keys(DIALOG_COLOR_SCHEMES.light).sort()).toEqual(
        Object.keys(DIALOG_COLOR_SCHEMES.dark).sort()
    );
});

test("a dialog is dark on a page that asks for nothing", async () => {
    mount();
    let closed = false;
    act(() => {
        showInfo("Anyone with this link can visit.", "Link copied").then(
            () => (closed = true)
        );
    });
    expect(dialog().style.getPropertyValue("--bg-color")).toBe("#191919");
    expect(dialog().style.getPropertyValue("--title-color")).toBe("#f3f3f1");
    expect(dialog().querySelector(".title").textContent).toBe("Link copied");
    expect(dialog().querySelector(".content").textContent).toBe(
        "Anyone with this link can visit."
    );
    // One confirming action.
    expect(buttons().map((button) => button.className)).toEqual([
        expect.stringContaining("btn primary"),
    ]);
    await act(async () => buttons()[0].click());
    expect(closed).toBe(true);
    expect(dialog()).toBeNull();
});

test("a confirm offers the outline first and the confirming action last", async () => {
    mount();
    let answer: boolean;
    act(() => {
        showConfirm("Your changes will be lost.", {
            title: "Leave?",
            yes: "Leave",
            no: "Stay",
        }).then((result) => (answer = result));
    });
    expect(
        buttons().map((button) => [button.textContent, button.className])
    ).toEqual([
        ["Stay", expect.stringContaining("btn secondary")],
        ["Leave", expect.stringContaining("btn primary")],
    ]);
    await act(async () => buttons()[1].click());
    expect(answer).toBe(true);

    act(() => {
        showConfirm("Your changes will be lost.").then(
            (result) => (answer = result)
        );
    });
    await act(async () => buttons()[0].click());
    expect(answer).toBe(false);
});

const escape = () => {
    const event = new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
    });
    act(() => {
        document.body.dispatchEvent(event);
    });
    return event;
};

test("Escape dismisses an alert, answers no to a confirm and cancels a prompt", async () => {
    mount();
    const answers: unknown[] = [];
    const settle = () => act(async () => {});

    act(() => void showInfo("Saved").then(() => answers.push("dismissed")));
    escape();
    await settle();

    act(() => void showConfirm("Delete it?").then((a) => answers.push(a)));
    escape();
    await settle();

    // With a Cancel button, Escape is Cancel rather than "no".
    act(
        () =>
            void showConfirm("Save your changes?", { cancel: "Cancel" }).then(
                (a) => answers.push(a)
            )
    );
    escape();
    await settle();

    act(
        () =>
            void showPrompt({ type: "text", message: "Name" }).then((a) =>
                answers.push(a)
            )
    );
    escape();
    await settle();

    expect(answers).toEqual(["dismissed", false, null, null]);
    expect(dialog()).toBeNull();
});

test("one press closes the top dialog only, and a dialog showing work in progress ignores Escape", async () => {
    mount();
    let first = "open",
        second = "open";
    act(() => void showInfo("First").then(() => (first = "closed")));
    act(() => void showInfo("Second").then(() => (second = "closed")));
    escape();
    await act(async () => {});
    expect([first, second]).toEqual(["open", "closed"]);
    escape();
    await act(async () => {});
    expect(first).toBe("closed");

    // A caller's modal content with no way to answer stays up.
    act(() => void showModal(<p>Publishing…</p>, { isModal: true }));
    const press = escape();
    expect(press.defaultPrevented).toBe(false);
    expect(dialog().textContent).toBe("Publishing…");
});

/** Stands for a caller's own panel, such as the account dashboard. */
const Own = () => <p className="own">Account</p>;

test("a caller's own content keeps the page's container, light unless the surface is dark", () => {
    mount();
    act(() => {
        showModal(<Own />, { id: "own" });
    });
    // The older white box: account, collection and sign-in panels rely on it.
    expect(dialog().querySelector(".own")).not.toBeNull();
    expect(dialog().style.getPropertyValue("--bg-color")).toBe("#fff");
    expect(dialog().style.getPropertyValue("--dialog-radius")).toBe("8px");

    // An alert opened from the same page is dark all the same.
    act(() => {
        showInfo("Saved.");
    });
    expect(dialog().style.getPropertyValue("--bg-color")).toBe("#191919");
    act(() => buttons()[0].click());
});

test("inside a dark surface a caller's own content gets the dark container too", () => {
    function DarkSurface() {
        useDialogTheme("dark");
        return null;
    }
    mount(<DarkSurface />);
    act(() => {
        showModal(<Own />);
    });
    expect(dialog().style.getPropertyValue("--bg-color")).toBe("#191919");
    expect(dialog().style.getPropertyValue("--dialog-radius")).toBe(
        "var(--oc-radius-card)"
    );
});
