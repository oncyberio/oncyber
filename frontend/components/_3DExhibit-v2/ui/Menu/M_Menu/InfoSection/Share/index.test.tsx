/** @jest-environment jsdom */
// A share button says what happened in place of its label, failures
// included; no dialog opens (docs/feedback.md).
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import Share from "./index";
import { ShareType } from "../../../shared/shareSocial";
import { showError } from "@components/Dialogs";

jest.mock("@components/Dialogs", () => ({ showError: jest.fn() }), {
    virtual: true,
});
jest.mock("@components/context/I18nContext", () => ({
    useCyberTranslation: () => ({ t: (key) => `<${String(key)}>` }),
}));
jest.mock("@components/hooks/useClickOutside", () => ({
    useOnClickOutside: () => ({ clickRef: null, addTogglerRef: () => {} }),
}));
jest.mock("./Portrait", () => () => null);
let shown: any;
jest.mock("./Landscape", () => (props) => {
    shown = props;
    return null;
});

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const writeText = jest.fn();
beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    jest.useFakeTimers();
    jest.spyOn(console, "log").mockImplementation(() => {});
    Object.defineProperty(navigator, "clipboard", {
        value: { writeText },
        configurable: true,
    });
    writeText.mockReset();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    act(() => root.render(<Share exhibit={{}} visible toggle={() => {}} />));
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
    jest.useRealTimers();
    jest.restoreAllMocks();
});

test("a copied link says so on its button, after it is copied", async () => {
    writeText.mockResolvedValue(undefined);
    await act(async () => shown.handleShareClick(ShareType.Link));

    expect(shown.copied).toEqual({ type: ShareType.Link, msg: "<COPIED>" });
    act(() => jest.advanceTimersByTime(1000));
    expect(shown.copied).toBeNull();
});

test("a link that could not be copied says so on its button, for longer", async () => {
    writeText.mockRejectedValue(new Error("denied"));
    await act(async () => shown.handleShareClick(ShareType.Link));

    expect(shown.copied).toEqual({
        type: ShareType.Link,
        msg: "<FAILED_TO_COPY_LINK>",
    });
    expect(showError).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(1000));
    expect(shown.copied).not.toBeNull();
    act(() => jest.advanceTimersByTime(3000));
    expect(shown.copied).toBeNull();
});

test("an embed code that could not be copied says so the same way", async () => {
    writeText.mockRejectedValue(new Error("denied"));
    await act(async () => shown.handleShareClick(ShareType.Embed));

    expect(shown.copied).toEqual({
        type: ShareType.Embed,
        msg: "<FAILED_TO_COPY_EMBED_CODE>",
    });
});
