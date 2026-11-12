/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { SnackbarContext } from "@components/Snackbar/Snackbar";
import useLobbyToast, { LOBBY_TOAST_MS } from "./useLobbyToast";

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let toast: (text: string) => void;
function Probe() {
    toast = useLobbyToast();
    return null;
}

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

test("opens the app's toast with a duration, so it goes away by itself", () => {
    const openSnackbar = jest.fn();
    const closeSnackbar = jest.fn();
    act(() =>
        root.render(
            <SnackbarContext.Provider value={{ openSnackbar, closeSnackbar }}>
                <Probe />
            </SnackbarContext.Provider>
        )
    );
    const first = toast;
    act(() => toast("Couldn’t load your avatar. Using the default."));
    expect(openSnackbar).toHaveBeenCalledTimes(1);
    const [text, duration, position, , , callback, type] =
        openSnackbar.mock.calls[0];
    expect(text).toBe("Couldn’t load your avatar. Using the default.");
    expect(duration).toBe(LOBBY_TOAST_MS);
    expect(duration).toBeGreaterThan(0);
    expect(position).toBe("top-right");
    expect(callback).toBeNull();
    expect(type).toBe("default");
    // The provider hands out a new function on every render; the hook's
    // result stays stable and always reaches the newest one.
    const next = jest.fn();
    act(() =>
        root.render(
            <SnackbarContext.Provider
                value={{ openSnackbar: next, closeSnackbar }}
            >
                <Probe />
            </SnackbarContext.Provider>
        )
    );
    expect(toast).toBe(first);
    act(() => first("Again"));
    expect(next).toHaveBeenCalledTimes(1);
    expect(openSnackbar).toHaveBeenCalledTimes(1);
});

test("does nothing, and does not throw, outside the app's toast provider", () => {
    act(() => root.render(<Probe />));
    expect(() => toast("Nobody is listening")).not.toThrow();
});
