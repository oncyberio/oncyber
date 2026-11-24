/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const mockLink = {
    sent: [] as { kind: string; data: any }[],
    heard: new Set<(kind: string, data: any) => void>(),
};
jest.mock("./worldDocument", () => ({
    worldDocument: () => ({
        send: (kind: string, data: any) => mockLink.sent.push({ kind, data }),
        listen: (handler: any) => {
            mockLink.heard.add(handler);
            return () => mockLink.heard.delete(handler);
        },
    }),
}));

import { useWorldDock } from "./useWorldDock";

const fromPage = (kind: string, data: object) =>
    act(() => mockLink.heard.forEach((handler) => handler(kind, data)));

let root: Root;
let host: HTMLDivElement;
function Dock({ actions }: { actions: any[] | null }) {
    useWorldDock(actions);
    return null;
}
const render = (actions: any[] | null) =>
    act(() => root.render(<Dock actions={actions} />));

beforeEach(() => {
    mockLink.sent.length = 0;
    mockLink.heard.clear();
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
});
afterEach(() => {
    act(() => root.unmount());
    host.remove();
});

test("a framed world tells the page its buttons, and again when they change", () => {
    const emotes = { id: "emotes", label: "Emotes", onClick: jest.fn() };
    render([emotes]);
    render([{ ...emotes, onClick: jest.fn() }]);
    expect(mockLink.sent).toEqual([
        {
            kind: "dock",
            data: { actions: [{ id: "emotes", label: "Emotes" }] },
        },
    ]);
    render([{ ...emotes, active: true }]);
    expect(mockLink.sent.at(-1).data.actions[0].active).toBe(true);
});

test("a press on the page runs the button here, as it is now", () => {
    const first = jest.fn();
    const second = jest.fn();
    const off = jest.fn();
    render([{ id: "emotes", label: "Emotes", onClick: first }]);
    render([
        { id: "emotes", label: "Emotes", onClick: second },
        { id: "people", label: "People", disabled: true, onClick: off },
    ]);
    fromPage("dock-press", { id: "emotes" });
    fromPage("dock-press", { id: "people" });
    fromPage("dock-press", { id: "nothing" });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    expect(off).not.toHaveBeenCalled();
});

test("a world that draws its own dock says nothing and hears nothing", () => {
    render(null);
    expect(mockLink.sent).toEqual([]);
    expect(mockLink.heard.size).toBe(0);
});
