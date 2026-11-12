/** @jest-environment jsdom */
// Adding a Counterparty wallet asks for its address in a dialog. A wrong or
// repeated address is explained under the field and the dialog stays open.
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { DialogProvider } from "@components/Dialogs";
import {
    askCounterpartyAddress,
    COUNTERPARTY_ADDRESS_ADDED,
    INVALID_COUNTERPARTY_ADDRESS,
} from "./askCounterpartyAddress";

jest.mock("@utils/counterpartyAssets", () => ({
    isValidBTCAddress: (value: string) => value.startsWith("1"),
    encodeCounterpartyUser: (value: string) => value + "@xcp",
}));

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    jest.spyOn(console, "error").mockImplementation(() => {});
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    act(() => root.render(<DialogProvider>{null}</DialogProvider>));
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
    jest.restoreAllMocks();
});

const field = () => document.querySelector("input") as HTMLInputElement;
const button = (label: string) =>
    Array.from(document.querySelectorAll("button")).find(
        (it) => it.textContent === label
    );

async function type(value: string) {
    const setValue = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value"
    ).set;
    await act(async () => {
        setValue.call(field(), value);
        field().dispatchEvent(new Event("input", { bubbles: true }));
    });
}

async function submit() {
    await act(async () => button("Ok").click());
}

test("a wrong address is explained in the dialog, which stays open", async () => {
    const listed = jest.fn(() => false);
    let answer: string | null | undefined;
    act(() => {
        askCounterpartyAddress(listed).then((it) => (answer = it));
    });

    await type("not-an-address");
    await submit();

    expect(document.body.textContent).toContain(INVALID_COUNTERPARTY_ADDRESS);
    expect(listed).not.toHaveBeenCalled();
    expect(field()).not.toBeNull();
    expect(answer).toBeUndefined();

    await type("1abc");
    await submit();

    expect(listed).toHaveBeenCalledWith("1abc", "1abc@xcp");
    expect(answer).toBe("1abc");
});

test("a wallet already in the list is explained the same way", async () => {
    let answer: string | null | undefined;
    act(() => {
        askCounterpartyAddress(() => true).then((it) => (answer = it));
    });

    await type("1abc");
    await submit();

    expect(document.body.textContent).toContain(COUNTERPARTY_ADDRESS_ADDED);
    expect(answer).toBeUndefined();
});

test("cancelling adds nothing", async () => {
    let answer: string | null | undefined;
    act(() => {
        askCounterpartyAddress(() => false).then((it) => (answer = it));
    });

    await act(async () => button("Cancel").click());

    expect(answer).toBeNull();
});
