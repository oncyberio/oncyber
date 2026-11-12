/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import Confirming from "./Confirming";
import { Transaction } from "./Transaction";

jest.mock(
    "../AnimatedModal",
    () =>
        ({ isShowing, children }) =>
            isShowing ? <div role="dialog">{children}</div> : null
);
jest.mock("../../Icon", () => () => null);
jest.mock("./Confirm", () => () => null);
jest.mock("./Confetti", () => ({ Confetti: () => null }));

const asset = { image_url: "/artwork.png" };
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
const heading = () => container.querySelector("h2").textContent;

it("words the overlay for a purchase unless told otherwise", () => {
    render(
        <Confirming
            isShowing
            toggle={jest.fn()}
            transactionHash="0xabc"
            asset={asset}
        />
    );
    expect(heading()).toBe("Finishing your purchase…");
    expect(container.textContent).toContain(
        "Approve in your wallet if it asks. This might take a few minutes."
    );
    expect(container.textContent).toContain("View on etherscan");
    expect(container.textContent).toContain("Processing");
    expect(container.querySelector("img").getAttribute("src")).toBe(
        "/artwork.png"
    );
});

it("does not call another kind of transaction a purchase", () => {
    render(
        <Transaction
            asset={asset}
            transactionHash={null}
            confirming
            toggle={jest.fn()}
            buyingSuccess={false}
            confirmingHeading="Your transaction is being processed..."
        />
    );
    expect(heading()).toBe("Your transaction is being processed...");
    expect(container.textContent).not.toContain("purchase");
    expect(container.textContent).toContain(
        "Approve in your wallet if it asks. This might take a few minutes."
    );
});

it("keeps the purchase wording when the transaction wrapper passes no heading", () => {
    render(
        <Transaction
            asset={asset}
            transactionHash={null}
            confirming
            toggle={jest.fn()}
            buyingSuccess={false}
        />
    );
    expect(heading()).toBe("Finishing your purchase…");
});
