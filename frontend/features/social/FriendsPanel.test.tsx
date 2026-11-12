/** @jest-environment jsdom */
import React from "react";
import { createRoot } from "react-dom/client";
import { Simulate } from "react-dom/test-utils";
import FriendsPanel from "./FriendsPanel";
const act = (React as any).act;
(global as any).IS_REACT_ACT_ENVIRONMENT = true;
const snapshot = { code: "MYCODE", friends: [], incoming: [{ uid: "friend", name: "New Friend" }], outgoing: [], blocked: [], privacy: { presence: "friends", activity: "friends", friendRequests: "everyone" } };
let root, container, mockFetch;
const oldFetch = global.fetch;
beforeEach(() => {
    container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
    mockFetch = jest.fn(async (_url, options) => ({ ok: true, json: async () => JSON.parse(options.body).operation === "snapshot" ? snapshot : { ok: true } })); global.fetch = mockFetch;
});
afterEach(() => { act(() => root.unmount()); container.remove(); global.fetch = oldFetch; });
const button = text => [...container.querySelectorAll("button")].find(el => el.textContent === text);
test("accepts a request then reloads the trusted snapshot", async () => {
    await act(async () => root.render(<FriendsPanel onClose={() => {}} />));
    expect(container.textContent).toContain("New Friend");
    await act(async () => Simulate.click(button("Accept")));
    expect(mockFetch.mock.calls.map(call => JSON.parse(call[1].body))).toEqual([{ operation: "snapshot" }, { operation: "accept", uid: "friend" }, { operation: "snapshot" }]);
});
test("dismisses with Escape and aborts outstanding calls on unmount", async () => {
    const close = jest.fn(); await act(async () => root.render(<FriendsPanel onClose={close} />));
    act(() => Simulate.keyDown(container.querySelector('[role="dialog"]'), { key: "Escape" })); expect(close).toHaveBeenCalled();
    const signal = mockFetch.mock.calls[0][1].signal; act(() => root.unmount()); expect(signal.aborted).toBe(true);
    root = createRoot(container);
});
test("shows a retry for failure instead of an empty graph", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Connection failed")); await act(async () => root.render(<FriendsPanel onClose={() => {}} />));
    expect(container.querySelector('[role="alert"]').textContent).toContain("Connection failed");
    await act(async () => Simulate.click(button("Retry"))); expect(container.textContent).toContain("New Friend");
});
