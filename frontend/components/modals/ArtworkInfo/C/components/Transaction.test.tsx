/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import Transaction from "./Transaction";

let mockArtworkInfo: any;
let modalProps: any;
jest.mock("./ArtworkContext", () => ({
    useArtworkInfo: () => mockArtworkInfo,
}));
jest.mock("@components/modals/Transactions/Transaction", () => ({
    Transaction: (props) => {
        modalProps = props;
        return null;
    },
}));

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    mockArtworkInfo = {
        asset: { name: "Spacepod" },
        transactionHash: "0xabc",
        confirming: true,
        setConfirming: jest.fn(),
        buyingSuccess: false,
    };
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
});

it.each([["purchase"], [undefined]])(
    "leaves the purchase wording in place while confirming a %p",
    (confirmingAction) => {
        mockArtworkInfo.confirmingAction = confirmingAction;
        act(() => root.render(<Transaction />));
        expect(modalProps.confirmingHeading).toBeUndefined();
        expect(modalProps.confirming).toBe(true);
        expect(modalProps.toggle).toBe(mockArtworkInfo.setConfirming);
    }
);

it("gives an offer a heading that does not mention a purchase", () => {
    mockArtworkInfo.confirmingAction = "offer";
    act(() => root.render(<Transaction />));
    expect(modalProps.confirmingHeading).toBe("Sending your offer…");
});
