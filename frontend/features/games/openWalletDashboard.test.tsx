/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";

let mockShown: React.ReactElement | null = null;
jest.mock("@components/Dialogs", () => ({
    showModal: (element: React.ReactElement) => {
        mockShown = element;
        // As the real one: never resolves for a dialog that only closes.
        return new Promise(() => {});
    },
}));
const mockDashboard = jest.fn((_props: unknown) => null);
jest.mock("@components/modals/AccountDashboard", () => ({
    __esModule: true,
    default: (props: unknown) => mockDashboard(props),
}));

import { openWalletDashboard } from "./openWalletDashboard";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

test("the dashboard opens at the wallet, and closing it by any path is reported", async () => {
    let closed = false;
    const opening = openWalletDashboard().then(() => {
        closed = true;
    });
    await act(async () => {});
    const host = document.createElement("div");
    const root = createRoot(host);
    act(() => root.render(React.cloneElement(mockShown!, { close: () => {} })));
    expect(mockDashboard).toHaveBeenCalledWith(
        expect.objectContaining({ defaultStep: "wallet" })
    );
    await act(async () => {});
    expect(closed).toBe(false);
    // Removed from the page: what every way of closing a dialog ends in.
    act(() => root.unmount());
    await opening;
    expect(closed).toBe(true);
});
