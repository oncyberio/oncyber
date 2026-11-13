/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import LobbySummonNotice from "./LobbySummonNotice";

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    jest.useFakeTimers();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
    jest.useRealTimers();
});

it("counts down five seconds, then goes, unless you stay", () => {
    const onGo = jest.fn();
    const onStay = jest.fn();
    const summon = {
        sessionId: "4",
        name: "Rayan",
        avatar: "",
        receivedAt: Date.now(),
    };
    act(() =>
        root.render(
            <LobbySummonNotice summon={summon} onGo={onGo} onStay={onStay} />
        )
    );
    expect(container.textContent).toContain(
        "Rayan is bringing everyone to them."
    );
    expect(container.textContent).toContain("GOING IN 5S");
    act(() => jest.advanceTimersByTime(2100));
    expect(container.textContent).toContain("GOING IN 3S");
    expect(onGo).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(3000));
    expect(onGo).toHaveBeenCalledWith("4");
    act(() => (container.querySelectorAll("button")[1] as HTMLElement).click());
    expect(onStay).toHaveBeenCalled();
});
