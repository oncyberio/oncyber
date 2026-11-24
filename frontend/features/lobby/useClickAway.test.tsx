/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import useClickAway, { clickedWithin } from "./useClickAway";

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let onAway: jest.Mock;

function Panel({ open }: { open: boolean }) {
    useClickAway(
        open,
        () => [
            document.getElementById("panel"),
            document.getElementById("opener"),
        ],
        onAway
    );
    return (
        <>
            <button id="opener">Open</button>
            {open && (
                <div id="panel">
                    <button id="inside">Choice</button>
                </div>
            )}
            <canvas id="world" />
            <div role="menu">
                <button id="menu-item">From the panel's menu</button>
            </div>
        </>
    );
}
const send = (id: string, type: string, x = 0, y = 0) =>
    act(() =>
        document
            .getElementById(id)
            .dispatchEvent(
                new MouseEvent(type, { clientX: x, clientY: y, bubbles: true })
            )
    );

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    onAway = jest.fn();
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
    jest.restoreAllMocks();
});

test("a click away closes; the panel, its opener and its menus do not", () => {
    act(() => root.render(<Panel open />));
    send("inside", "click");
    send("opener", "click");
    send("menu-item", "click");
    expect(onAway).not.toHaveBeenCalled();
    send("world", "click", 500, 300);
    expect(onAway).toHaveBeenCalledTimes(1);
});

test("a drag in the world is not a click away", () => {
    act(() => root.render(<Panel open />));
    send("world", "pointerdown", 100, 100);
    send("world", "click", 240, 130);
    expect(onAway).not.toHaveBeenCalled();
    send("world", "pointerdown", 100, 100);
    send("world", "click", 103, 101);
    expect(onAway).toHaveBeenCalledTimes(1);
});

test("a closed panel listens to nothing", () => {
    act(() => root.render(<Panel open={false} />));
    send("world", "click", 500, 300);
    expect(onAway).not.toHaveBeenCalled();
    act(() => root.render(<Panel open />));
    act(() => root.render(<Panel open={false} />));
    send("world", "click", 500, 300);
    expect(onAway).not.toHaveBeenCalled();
});

test("the space a panel spans counts as the panel", () => {
    const panel = document.createElement("div");
    jest.spyOn(panel, "getBoundingClientRect").mockReturnValue({
        left: 300,
        right: 900,
        top: 400,
        bottom: 740,
        width: 600,
        height: 340,
    } as DOMRect);
    const at = (x: number, y: number) =>
        clickedWithin([panel, null], {
            target: document.body,
            clientX: x,
            clientY: y,
        });
    expect(at(600, 500)).toBe(true);
    expect(at(600, 200)).toBe(false);
    expect(at(100, 500)).toBe(false);
});
