/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import {
    ENGINE_CHUNKS_ELEMENT_ID,
    ENGINE_PREFETCH_SETTLE_MS,
    connectionAllowsPrefetch,
    enginePrefetchStatus,
    readEngineChunkList,
    resetEnginePrefetch,
    useEnginePrefetch,
} from "./enginePrefetch";

const FILES = [
    "/_next/static/chunks/1111.aaaa.js",
    "/_next/static/css/3333.cccc.css",
    "/_next/static/chunks/pages/spaces/%5Bid%5D-1.js",
];

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
function Harness({ idle }: { idle: boolean }) {
    useEnginePrefetch(idle);
    return null;
}
const render = (idle: boolean) =>
    act(() => root.render(<Harness idle={idle} />));
const hints = () =>
    Array.from(
        document.head.querySelectorAll<HTMLLinkElement>('link[rel="prefetch"]')
    );
const setConnection = (connection: unknown) =>
    Object.defineProperty(navigator, "connection", {
        configurable: true,
        value: connection,
    });
function writeList(list: unknown) {
    const script = document.createElement("script");
    script.id = ENGINE_CHUNKS_ELEMENT_ID;
    script.type = "application/json";
    script.textContent = JSON.stringify(list);
    document.body.appendChild(script);
}

beforeEach(() => {
    jest.useFakeTimers();
    resetEnginePrefetch();
    document.head.innerHTML = "";
    document.body.innerHTML = "";
    setConnection(undefined);
    writeList(FILES);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
});
afterEach(() => {
    act(() => root.unmount());
    jest.useRealTimers();
});

test("prefetches every listed file once the lobby has been idle", () => {
    render(true);
    act(() => jest.advanceTimersByTime(ENGINE_PREFETCH_SETTLE_MS - 1));
    expect(hints()).toHaveLength(0);
    act(() => jest.advanceTimersByTime(1));
    expect(hints().map((hint) => hint.getAttribute("href"))).toEqual(FILES);
    expect(hints().map((hint) => hint.getAttribute("as"))).toEqual([
        "script",
        "style",
        "script",
    ]);
    expect(hints()[0].getAttribute("fetchpriority")).toBe("low");
    expect(enginePrefetchStatus()).toBe("started");
    // Nothing runs: no script elements were added.
    expect(document.querySelectorAll("script[src]")).toHaveLength(0);
    hints().forEach((hint) => hint.dispatchEvent(new Event("load")));
    expect(enginePrefetchStatus()).toBe("loaded");
});

test("a trip or a loading lobby cancels the pending prefetch", () => {
    render(true);
    act(() => jest.advanceTimersByTime(ENGINE_PREFETCH_SETTLE_MS - 10));
    render(false);
    act(() => jest.advanceTimersByTime(ENGINE_PREFETCH_SETTLE_MS * 2));
    expect(hints()).toHaveLength(0);
    expect(enginePrefetchStatus()).toBe("none");
    // The next idle period waits the whole settle time again.
    render(true);
    act(() => jest.advanceTimersByTime(ENGINE_PREFETCH_SETTLE_MS));
    expect(hints()).toHaveLength(FILES.length);
});

test("runs once per page", () => {
    render(true);
    act(() => jest.advanceTimersByTime(ENGINE_PREFETCH_SETTLE_MS));
    render(false);
    render(true);
    act(() => jest.advanceTimersByTime(ENGINE_PREFETCH_SETTLE_MS * 2));
    expect(hints()).toHaveLength(FILES.length);
});

test("skips files the page already loaded", () => {
    const script = document.createElement("script");
    script.src = FILES[0];
    document.head.appendChild(script);
    render(true);
    act(() => jest.advanceTimersByTime(ENGINE_PREFETCH_SETTLE_MS));
    expect(hints().map((hint) => hint.getAttribute("href"))).toEqual(
        FILES.slice(1)
    );
});

test("Save-Data and slow connections prefetch nothing", () => {
    setConnection({ saveData: true, effectiveType: "4g" });
    render(true);
    act(() => jest.advanceTimersByTime(ENGINE_PREFETCH_SETTLE_MS * 2));
    expect(hints()).toHaveLength(0);
    expect(enginePrefetchStatus()).toBe("skipped");
});

test.each([
    [undefined, true],
    [{ effectiveType: "4g" }, true],
    [{ effectiveType: "3g" }, false],
    [{ effectiveType: "2g" }, false],
    [{ effectiveType: "slow-2g" }, false],
    [{ saveData: true, effectiveType: "4g" }, false],
])("connection %j allows prefetch: %s", (connection, allowed) => {
    expect(connectionAllowsPrefetch(connection)).toBe(allowed);
});

test("a hidden tab waits until it is shown", () => {
    let state = "hidden";
    Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => state,
    });
    render(true);
    act(() => jest.advanceTimersByTime(ENGINE_PREFETCH_SETTLE_MS));
    expect(hints()).toHaveLength(0);
    state = "visible";
    act(() => {
        document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(hints()).toHaveLength(FILES.length);
    delete (document as any).visibilityState;
});

test("no list (development, other pages) prefetches nothing", () => {
    document.getElementById(ENGINE_CHUNKS_ELEMENT_ID).remove();
    render(true);
    act(() => jest.advanceTimersByTime(ENGINE_PREFETCH_SETTLE_MS * 2));
    expect(hints()).toHaveLength(0);
    expect(enginePrefetchStatus()).toBe("none");
});

test("only paths and http(s) URLs are read from the list", () => {
    document.getElementById(ENGINE_CHUNKS_ELEMENT_ID).remove();
    writeList([
        "/_next/a.js",
        "//elsewhere.example/b.js",
        "https://cdn.example/_next/c.js",
        "javascript:alert(1)",
        4,
    ]);
    expect(readEngineChunkList(document)).toEqual([
        "/_next/a.js",
        "https://cdn.example/_next/c.js",
    ]);
    document.getElementById(ENGINE_CHUNKS_ELEMENT_ID).textContent = "{";
    expect(readEngineChunkList(document)).toEqual([]);
});
