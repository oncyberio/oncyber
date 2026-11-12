/** @jest-environment jsdom */
import React from "react";
import { createRoot } from "react-dom/client";
const act = (React as any).act;
let root;
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
function render(element) {
    const container = document.createElement("div");
    root = createRoot(container);
    act(() => root.render(element));
    return { getByRole: (_role?: string) => container.querySelector("a") };
}
const cleanup = () => act(() => root?.unmount());
const dispatch = (node, type, options = {}) =>
    act(() =>
        node.dispatchEvent(
            new MouseEvent(type, {
                bubbles: true,
                cancelable: true,
                ...options,
            })
        )
    );
const fireEvent = {
    click: (n, o = {}) => dispatch(n, "click", o),
    mouseEnter: (n) => dispatch(n, "mouseover"),
    focus: (n) => dispatch(n, "focus"),
    touchStart: (n) => dispatch(n, "touchstart"),
};
async function waitFor(check) {
    await act(async () => {
        for (let i = 0; i < 10; i++) await Promise.resolve();
    });
    check();
}

import InAppLink from "./InAppLink";
const mockPush = jest.fn(async () => true),
    mockPrefetch = jest.fn(),
    mockError = jest.fn();
jest.mock("next/router", () => ({
    useRouter: () => ({
        push: mockPush,
        replace: mockPush,
        prefetch: mockPrefetch,
    }),
}));
jest.mock("@components/Dialogs", () => ({
    showError: (...args) => mockError(...args),
}));
afterEach(() => {
    cleanup();
    jest.clearAllMocks();
});
test("hover/focus/touch never preload; activation routes inside the document", async () => {
    const { getByRole } = render(
        <InAppLink href="/spaces/one">Enter</InAppLink>
    );
    const link = getByRole("link");
    fireEvent.mouseEnter(link);
    fireEvent.focus(link);
    fireEvent.touchStart(link);
    expect(mockPrefetch).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
    fireEvent.click(link);
    await waitFor(() =>
        expect(mockPush).toHaveBeenCalledWith("/spaces/one", undefined, {
            scroll: true,
            shallow: false,
        })
    );
});
test.each([
    { ctrlKey: true },
    { metaKey: true },
    { shiftKey: true },
    { altKey: true },
    { button: 1 },
])("modified clicks preserve native navigation %p", async (flags) => {
    const { getByRole } = render(
        <InAppLink href="/spaces/one">Enter</InAppLink>
    );
    fireEvent.click(getByRole("link"), flags);
    await Promise.resolve();
    expect(mockPush).not.toHaveBeenCalled();
});
test("legacy styled anchors retain handlers and URL", async () => {
    const click = jest.fn();
    const { getByRole } = render(
        <InAppLink href="/studio" legacyBehavior>
            <a onClick={click} className="existing">
                Studio
            </a>
        </InAppLink>
    );
    fireEvent.click(getByRole("link"));
    await waitFor(() => expect(mockPush).toHaveBeenCalledTimes(1));
    expect(click).toHaveBeenCalledTimes(1);
    expect(getByRole("link").className).toBe("existing");
});
test("failed navigation presents an error", async () => {
    mockPush.mockRejectedValueOnce(Error("unavailable"));
    const { getByRole } = render(<InAppLink href="/">Home</InAppLink>);
    fireEvent.click(getByRole("link"));
    await waitFor(() => expect(mockError).toHaveBeenCalled());
});

test("rapid repeated activation keeps one pending route", async () => {
    let finish;
    mockPush.mockImplementationOnce(
        () =>
            new Promise((resolve) => {
                finish = resolve;
            })
    );
    const { getByRole } = render(
        <InAppLink href="/spaces/one">Enter</InAppLink>
    );
    fireEvent.click(getByRole());
    fireEvent.click(getByRole());
    await waitFor(() => expect(mockPush).toHaveBeenCalledTimes(1));
    finish(true);
    await waitFor(() => expect(mockError).not.toHaveBeenCalled());
});
test("a superseded route does not show a false load failure", async () => {
    mockPush.mockResolvedValueOnce(false);
    const { getByRole } = render(
        <InAppLink href="/spaces/one">Enter</InAppLink>
    );
    fireEvent.click(getByRole());
    await waitFor(() => expect(mockError).not.toHaveBeenCalled());
});
