/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import Bought from "./Confirm";

jest.mock(
    "../AnimatedModal",
    () => (props) =>
        props.isShowing ? (
            <div
                role="dialog"
                data-class={props.className}
                data-escape={String(props.closeOnEscape)}
            >
                {props.children}
            </div>
        ) : null
);
const modal = () => {
    const dialog = document.querySelector('[role="dialog"]');
    return {
        className: dialog.getAttribute("data-class"),
        closeOnEscape: JSON.parse(dialog.getAttribute("data-escape")),
    };
};

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

it("answers Escape, since its only close control is inside the content", () => {
    const toggle = jest.fn();
    act(() =>
        root.render(
            <Bought isShowing toggle={toggle} artwork={{ name: "Study" }} />
        )
    );
    expect(modal().closeOnEscape).toBe(true);
    expect(modal().className).toBe("dialog-window");
    expect(container.textContent).toContain("Study is now yours!");
});
