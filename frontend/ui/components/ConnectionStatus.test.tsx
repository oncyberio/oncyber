/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import ConnectionStatus, {
    connectionStatusLabel,
    type ConnectionStatusProps,
} from "./ConnectionStatus";

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const render = (props: ConnectionStatusProps) =>
    act(() => root.render(<ConnectionStatus {...props} />));
const line = () => container.querySelector(".presence-status");
const reason = () => container.querySelector(".presence-reason");
const spoken = () => container.querySelector('[role="status"]');
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

test("every host gets the lobby's three wordings", () => {
    expect(connectionStatusLabel("connected", 12)).toBe("12 here");
    expect(connectionStatusLabel("connecting")).toBe("Connecting…");
    expect(connectionStatusLabel("offline")).toBe("You’re offline");
});

test.each<[ConnectionStatusProps, string, string | null, string]>([
    [{ state: "connected", count: 12 }, "12 here", null, "Connected"],
    [{ state: "connecting" }, "Connecting…", null, "Connecting…"],
    [{ state: "offline" }, "You’re offline", null, "You’re offline"],
    [
        { state: "offline", reason: "Connection lost." },
        "You’re offline",
        "Connection lost.",
        "You’re offline. Connection lost.",
    ],
    // A reason only explains being offline.
    [
        { state: "connecting", reason: "Stale" },
        "Connecting…",
        null,
        "Connecting…",
    ],
])("%j", (props, shown, why, announced) => {
    render(props);
    expect(line().textContent).toBe(shown);
    expect(reason()?.textContent ?? null).toBe(why);
    expect(spoken().textContent).toBe(announced);
    if (why) expect(reason().getAttribute("title")).toBe(why);
});

test("people coming and going are shown but never announced", () => {
    render({ state: "connected", count: 12 });
    const announced: MutationRecord[] = [];
    const observer = new MutationObserver((records) =>
        announced.push(...records)
    );
    observer.observe(spoken(), {
        childList: true,
        characterData: true,
        subtree: true,
    });
    for (const count of [13, 14, 9]) render({ state: "connected", count });
    expect(line().textContent).toBe("9 here");
    // The count is read on demand: its line is exposed but is not live.
    expect(line().hasAttribute("aria-hidden")).toBe(false);
    expect(line().closest("[role], [aria-live]")).toBeNull();
    announced.push(...observer.takeRecords());
    expect(announced).toEqual([]);
    render({ state: "offline", reason: "Connection lost." });
    announced.push(...observer.takeRecords());
    observer.disconnect();
    expect(announced.length).toBeGreaterThan(0);
    expect(spoken().textContent).toBe("You’re offline. Connection lost.");
    // The hidden line says the same words, so the visible ones are not
    // read a second time.
    expect(line().getAttribute("aria-hidden")).toBe("true");
    expect(reason().getAttribute("aria-hidden")).toBe("true");
});

const action = () =>
    container.querySelector<HTMLButtonElement>("button.presence-action");

test("while offline, the way back is a button under the reason", () => {
    const rejoin = jest.fn();
    render({
        state: "offline",
        reason: "You were away for a while.",
        action: { label: "Rejoin", onClick: rejoin },
    });
    expect(
        [...container.children].map((child) =>
            [...child.classList].find((name) => name.startsWith("presence-"))
        )
    ).toEqual([
        "presence-status",
        "presence-reason",
        "presence-action",
        "presence-announcement",
    ]);
    expect(action().textContent).toBe("Rejoin");
    expect(action().type).toBe("button");
    // A real control: reachable, and not part of what is read aloud.
    expect(action().hasAttribute("aria-hidden")).toBe(false);
    expect(spoken().textContent).toBe(
        "You’re offline. You were away for a while."
    );
    act(() => action().click());
    expect(rejoin).toHaveBeenCalledTimes(1);

    render({
        state: "offline",
        action: { label: "Rejoin", onClick: rejoin, disabled: true },
    });
    expect(action().disabled).toBe(true);
    act(() => action().click());
    expect(rejoin).toHaveBeenCalledTimes(1);
});

test.each<ConnectionStatusProps>([
    { state: "connected", count: 3 },
    { state: "connecting" },
    { label: "4 here" },
    {},
])("there is no way back to offer for %j", (props) => {
    render({ ...props, action: { label: "Rejoin", onClick: jest.fn() } });
    expect(action()).toBeNull();
});

test("a host that passes its own words gets one plain line", () => {
    render({ label: "4 here" });
    expect(container.innerHTML).toBe(line().outerHTML);
    expect(line().textContent).toBe("4 here");
    expect(line().hasAttribute("aria-hidden")).toBe(false);
    expect(spoken()).toBeNull();
});

test("nothing is said where there is no connection to describe", () => {
    render({});
    expect(container.innerHTML).toBe("");
    render({ reason: "Connection lost." });
    expect(container.innerHTML).toBe("");
});
