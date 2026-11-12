/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import InviteCancel from "./InviteCancel";
import { UserContext } from "../context/UserContext";

jest.mock(
    "./AnimatedModal",
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
jest.mock("../context/UserContext", () => ({
    UPDATE_EXHIBIT: "UPDATE_EXHIBIT",
    UserContext: require("react").createContext({}),
}));
const mockKick = jest.fn();
jest.mock("../../utils/saveToDb", () => ({
    kickInvitedUser: (...args) => mockKick(...args),
    generateInviteLink: jest.fn(),
}));
jest.mock("@utils/analytics", () => ({
    amplitude_logAnalyticsEvent: jest.fn(),
}));
jest.mock("@features/studio/StudioMenu/context/StudioContext", () => ({
    useStudioMenu: () => ({}),
}));

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

it("is the dark dialog and ignores Escape only while cancelling", async () => {
    let finish: (value: unknown) => void;
    mockKick.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    act(() =>
        root.render(
            <UserContext.Provider
                value={{ exhibit: { id: "e1" }, user: { id: "u1" } } as any}
            >
                <InviteCancel isShowing toggle={jest.fn()} walletId="0xabc" />
            </UserContext.Provider>
        )
    );
    expect(modal().className).toBe("dialog-window");
    expect(modal().closeOnEscape).toBe(true);
    const proceed = container.querySelector("button");
    expect(proceed.textContent).toBe("Proceed");
    act(() => proceed.click());
    expect(container.querySelector("button").textContent).toBe("Proceeding…");
    expect(modal().closeOnEscape).toBe(false);
    await act(async () => finish({ success: false, message: "Not allowed" }));
    expect(modal().closeOnEscape).toBe(true);
    expect(container.textContent).toContain("Not allowed");
});
