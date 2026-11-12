/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import InlineError from "./index";

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
const render = (element: React.ReactElement) => act(() => root.render(element));
const alert = () => container.querySelector('[role="alert"]');

it("announces the failure and offers to run the action again", () => {
    const retry = jest.fn();
    render(
        <InlineError message="Couldn't save your change." onRetry={retry} />
    );
    expect(alert().textContent).toBe("Couldn't save your change.Retry");
    const button = alert().querySelector("button");
    expect(button.type).toBe("button");
    act(() => button.click());
    expect(retry).toHaveBeenCalledTimes(1);
});

it("shows no action when retrying cannot help", () => {
    render(<InlineError message="Enter an amount greater than 0." />);
    expect(alert().textContent).toBe("Enter an amount greater than 0.");
    expect(alert().querySelector("button")).toBeNull();
});

it.each([undefined, null, "", false])("renders nothing for %p", (message) => {
    render(<InlineError message={message} onRetry={jest.fn()} />);
    expect(container.innerHTML).toBe("");
});

it("takes a label, a class and the light surface from its caller", () => {
    render(
        <InlineError
            message="Couldn't load the price."
            onRetry={jest.fn()}
            retryLabel="Reload"
            surface="light"
            className="beside-price"
        />
    );
    expect(alert().querySelector("button").textContent).toBe("Reload");
    expect(alert().classList.contains("beside-price")).toBe(true);
    expect(alert().getAttribute("data-surface")).toBe("light");
});

it("is dark and quiet unless told otherwise", () => {
    render(<InlineError message="Couldn't save." onRetry={jest.fn()} />);
    expect(alert().getAttribute("data-surface")).toBe("dark");
    const css = Array.from(document.querySelectorAll("style"))
        .map((style) => style.textContent)
        .join("");
    // The action is an outline button: no fill, one hairline.
    expect(css).toContain("background:transparent");
    expect(css).toContain("border:1px solid var(--inline-error-action-line)");
});
