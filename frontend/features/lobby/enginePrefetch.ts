/**
 * Download the world engine while the lobby is idle, so the first trip finds
 * it in the browser cache (docs/plans/lobby-world-shell.md, step 1).
 *
 * The server writes the engine's production files into the lobby's HTML
 * (`engineChunks.ts`, through `pages/_document.tsx`). Once the lobby has
 * loaded and sat idle for a moment, this adds one `<link rel="prefetch">` per
 * file: the browser downloads each at its lowest priority and runs nothing.
 * Nothing is added during a trip, with Save-Data, on a 2G or 3G connection,
 * in a hidden tab, or outside production (no list is written there). It runs
 * once per page. Undo the whole step by removing `useEnginePrefetch` from
 * the lobby.
 */
import { useEffect } from "react";

/** The id of the `<script type="application/json">` holding the list. */
export const ENGINE_CHUNKS_ELEMENT_ID = "__ENGINE_CHUNKS__";

/** How long the lobby must stay idle after it is ready before the downloads
 * start: its own late work (motion packs, avatars, thumbnails) goes first. */
export const ENGINE_PREFETCH_SETTLE_MS = 4000;

/** What the lobby did about the engine, sent with each trip's timings. */
export type EnginePrefetchStatus =
    | "none"
    | "skipped"
    | "started"
    | "loaded"
    | "failed";

let status: EnginePrefetchStatus = "none";

export function enginePrefetchStatus(): EnginePrefetchStatus {
    return status;
}

/** Tests only. */
export function resetEnginePrefetch() {
    status = "none";
}

type Connection = { saveData?: boolean; effectiveType?: string };

/** False when the visitor asked to save data or the connection is slow. */
export function connectionAllowsPrefetch(connection?: Connection | null) {
    if (!connection) return true;
    if (connection.saveData) return false;
    return !/^(?:slow-2g|2g|3g)$/.test(connection.effectiveType || "");
}

/** The engine files the server listed for this page, or none. */
export function readEngineChunkList(doc: Document): string[] {
    const element = doc.getElementById(ENGINE_CHUNKS_ELEMENT_ID);
    if (!element?.textContent) return [];
    try {
        const list = JSON.parse(element.textContent);
        return Array.isArray(list)
            ? list.filter(
                  (file) =>
                      typeof file === "string" &&
                      /^(?:\/(?!\/)|https?:\/\/)/.test(file)
              )
            : [];
    } catch {
        return [];
    }
}

/**
 * Add a prefetch hint for each file the page has not already loaded or
 * hinted. Returns how many were added.
 */
export function prefetchEngineChunks(doc: Document, list: string[]) {
    const known = new Set<string>();
    doc.querySelectorAll<HTMLScriptElement>("script[src]").forEach((script) =>
        known.add(new URL(script.src, doc.baseURI).pathname)
    );
    doc.querySelectorAll<HTMLLinkElement>("link[href]").forEach((link) =>
        known.add(new URL(link.href, doc.baseURI).pathname)
    );
    const added = list.filter(
        (file) => !known.has(new URL(file, doc.baseURI).pathname)
    );
    let pending = added.length;
    let failed = false;
    const settle = (ok: boolean) => {
        failed = failed || !ok;
        if (--pending === 0) status = failed ? "failed" : "loaded";
    };
    for (const file of added) {
        const hint = doc.createElement("link");
        hint.rel = "prefetch";
        hint.setAttribute("as", file.endsWith(".css") ? "style" : "script");
        hint.setAttribute("fetchpriority", "low");
        hint.href = file;
        hint.addEventListener("load", () => settle(true), { once: true });
        hint.addEventListener("error", () => settle(false), { once: true });
        doc.head.appendChild(hint);
    }
    status = added.length ? "started" : "loaded";
    return added.length;
}

/**
 * Prefetch the engine once the lobby has been idle for
 * `ENGINE_PREFETCH_SETTLE_MS` and the browser has a free moment. Pass
 * `idle` false while the lobby loads, travels or is away: a pending
 * prefetch is then cancelled and waits for the next idle period.
 */
export function useEnginePrefetch(idle: boolean) {
    useEffect(() => {
        if (!idle || status !== "none") return;
        const list = readEngineChunkList(document);
        if (!list.length) return;
        const connection = (
            navigator as Navigator & {
                connection?: Connection;
            }
        ).connection;
        if (!connectionAllowsPrefetch(connection)) {
            status = "skipped";
            return;
        }
        let idleCallback = 0;
        const start = () => {
            if (status !== "none") return;
            // A hidden tab waits until it is shown again.
            if (document.visibilityState !== "visible") {
                document.addEventListener("visibilitychange", start, {
                    once: true,
                });
                return;
            }
            prefetchEngineChunks(document, list);
        };
        const timer = window.setTimeout(() => {
            if (typeof window.requestIdleCallback === "function")
                idleCallback = window.requestIdleCallback(start, {
                    timeout: 2000,
                });
            else start();
        }, ENGINE_PREFETCH_SETTLE_MS);
        return () => {
            window.clearTimeout(timer);
            if (idleCallback) window.cancelIdleCallback?.(idleCallback);
            document.removeEventListener("visibilitychange", start);
        };
    }, [idle]);
}
