/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import NativeVisitorPanel from "./NativeVisitorPanel";

test("utility panels isolate world shortcuts and return keyboard focus to their opener", () => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    const host = document.createElement("div");
    const opener = document.createElement("button");
    document.body.append(opener, host);
    opener.focus();
    const close = jest.fn();
    const worldShortcut = jest.fn();
    window.addEventListener("keydown", worldShortcut);
    window.addEventListener("wheel", worldShortcut);
    window.addEventListener("touchmove", worldShortcut);
    const root = createRoot(host);
    act(() =>
        root.render(
            <NativeVisitorPanel title="Send feedback" onClose={close}>
                <textarea aria-label="Feedback" />
            </NativeVisitorPanel>
        )
    );
    expect(document.activeElement).toBe(host.querySelector("h2"));
    const input = host.querySelector("textarea");
    input.focus();
    act(() => {
        input.dispatchEvent(
            new KeyboardEvent("keydown", { key: "w", bubbles: true })
        );
        input.dispatchEvent(
            new KeyboardEvent("keydown", {
                key: "Escape",
                bubbles: true,
                isComposing: true,
            })
        );
    });
    act(() => {
        input.dispatchEvent(
            new WheelEvent("wheel", { bubbles: true, deltaY: 120 })
        );
        input.dispatchEvent(new Event("touchmove", { bubbles: true }));
    });
    expect(close).not.toHaveBeenCalled();
    expect(worldShortcut).not.toHaveBeenCalled();
    act(() =>
        input.dispatchEvent(
            new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
        )
    );
    expect(close).toHaveBeenCalledTimes(1);
    act(() => root.unmount());
    expect(document.activeElement).toBe(opener);
    window.removeEventListener("keydown", worldShortcut);
    window.removeEventListener("wheel", worldShortcut);
    window.removeEventListener("touchmove", worldShortcut);
    host.remove();
    opener.remove();
});

test("a click on the world closes a utility panel, unless it holds something being written", () => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    const host = document.createElement("div");
    const world = document.createElement("canvas");
    document.body.append(world, host);
    const close = jest.fn();
    const root = createRoot(host);
    const click = (target: Element) =>
        act(() =>
            target.dispatchEvent(
                new MouseEvent("click", {
                    clientX: 40,
                    clientY: 40,
                    bubbles: true,
                })
            )
        );
    act(() =>
        root.render(
            <NativeVisitorPanel title="People in this space" onClose={close}>
                <button>Mute</button>
            </NativeVisitorPanel>
        )
    );
    click(host.querySelector(".native-panel-body button"));
    expect(close).not.toHaveBeenCalled();
    click(world);
    expect(close).toHaveBeenCalledTimes(1);

    act(() =>
        root.render(
            <NativeVisitorPanel
                title="Report this space"
                onClose={close}
                closeOnClickAway={false}
            >
                <textarea aria-label="What happened" />
            </NativeVisitorPanel>
        )
    );
    click(world);
    expect(close).toHaveBeenCalledTimes(1);
    act(() => root.unmount());
    host.remove();
    world.remove();
});
