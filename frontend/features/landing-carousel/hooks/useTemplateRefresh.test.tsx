/** @jest-environment jsdom */
import React from "react";
import { createRoot } from "react-dom/client";
import useTemplateRefresh from "./useTemplateRefresh";

const act = (React as any).act;
(global as any).IS_REACT_ACT_ENVIRONMENT = true;
let container: HTMLDivElement, root: ReturnType<typeof createRoot>;
let refresh: jest.Mock;
let visibility = "visible";
function Catalog({ active = true, busy = false, check = refresh }) {
    useTemplateRefresh(active, busy, check);
    return null;
}
const render = (props = {}) => act(() => root.render(<Catalog {...props} />));
const tick = async (ms: number) => {
    await act(async () => {
        jest.advanceTimersByTime(ms);
    });
};
const focus = async () => {
    await act(async () => {
        window.dispatchEvent(new Event("focus"));
    });
};
beforeEach(() => {
    jest.useFakeTimers();
    visibility = "visible";
    Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => visibility,
    });
    refresh = jest.fn().mockResolvedValue(undefined);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
    jest.useRealTimers();
});
it("leaves initial loading to the provider, then refreshes on focus and every 30 seconds", async () => {
    render();
    expect(refresh).not.toHaveBeenCalled();
    await focus();
    expect(refresh).toHaveBeenCalledTimes(1);
    await focus();
    expect(refresh).toHaveBeenCalledTimes(1);
    await tick(30000);
    expect(refresh).toHaveBeenCalledTimes(2);
});
it("pauses while hidden and checks when returning from the marketplace", async () => {
    render();
    visibility = "hidden";
    await tick(60000);
    await focus();
    expect(refresh).not.toHaveBeenCalled();
    visibility = "visible";
    await act(async () => {
        document.dispatchEvent(new Event("visibilitychange"));
        window.dispatchEvent(new Event("focus"));
    });
    expect(refresh).toHaveBeenCalledTimes(1);
});
it("waits for current loading or creation and uses the latest account callback", async () => {
    render({ busy: true });
    await tick(30000);
    await focus();
    expect(refresh).not.toHaveBeenCalled();
    const nextAccount = jest.fn().mockResolvedValue(undefined);
    render({ busy: false, check: nextAccount });
    await focus();
    expect(nextAccount).toHaveBeenCalledTimes(1);
    expect(refresh).not.toHaveBeenCalled();
});
it("never overlaps requests, including when the catalog is reopened mid-request", async () => {
    let finish: () => void;
    refresh.mockReturnValue(
        new Promise<void>((resolve) => {
            finish = resolve;
        })
    );
    render();
    await focus();
    await tick(60000);
    render({ active: false });
    render({ active: true });
    await focus();
    expect(refresh).toHaveBeenCalledTimes(1);
    await act(async () => finish());
    await tick(30000);
    expect(refresh).toHaveBeenCalledTimes(2);
});
it("stops away from the catalog and checks immediately on reentry", async () => {
    render();
    render({ active: false });
    await focus();
    await tick(60000);
    expect(refresh).not.toHaveBeenCalled();
    await act(async () => render({ active: true }));
    expect(refresh).toHaveBeenCalledTimes(1);
});
it("recovers after a failed check and removes listeners and timers on unmount", async () => {
    refresh.mockRejectedValueOnce(new Error("Offline"));
    render();
    await focus();
    await tick(30000);
    expect(refresh).toHaveBeenCalledTimes(2);
    act(() => root.render(null));
    await focus();
    await tick(60000);
    expect(refresh).toHaveBeenCalledTimes(2);
});
