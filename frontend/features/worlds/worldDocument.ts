/**
 * The world's side of the frame (docs/plans/framed-worlds.md): what a
 * native world, served from the world host inside the site's frame, says
 * to the page around it.
 *
 * It speaks the games contract (docs/games/contract.md): `hello` until the
 * page answers with `identity` (who is visiting, ./worldVisitor), then
 * `progress`, `first-frame` and `ready`; `location` as it moves, and
 * `travel` to leave for somewhere else on the site.
 * Messages go to the site's origin and are heard from it alone.
 */
import { useEffect, useState } from "react";
import {
    CONTRACT_VERSION,
    GAME_MESSAGE_PREFIX,
    readGameMessage,
} from "@features/games/gameContract";
import { WORLD_FRAME, type WorldFrame } from "./worldFrame";
import { readWorldVisitor, type WorldVisitor } from "./worldVisitor";

/** The id a native world goes by in the games contract. */
export const WORLD_GAME_ID = "world";
const HELLO_EVERY_MS = 250;
/** The page answers at once when it is there; after this, stop asking. */
const HELLO_FOR_MS = 20_000;

export interface WorldDocument {
    /**
     * Who the page says is visiting. Null when the page names no one, or
     * never answers: the world then runs for its own guest.
     */
    visitor(): Promise<WorldVisitor | null>;
    /**
     * The world's own address changed: it walked, or took a portal without
     * leaving the frame. The page keeps its address bar on it.
     */
    location(href: string, title?: string): void;
    /** Go somewhere else on the site: only the page can. */
    travel(href: string): void;
    /** 0–1, while the world loads. */
    progress(value: number, label?: string): void;
    /** The world has drawn: the page may show it. */
    drawn(): void;
    /** The world could not load. */
    failed(): void;
    dispose(): void;
}

/** True in a document served from the world host inside a frame. */
export function isWorldDocument(
    win: Window | undefined = typeof window === "undefined"
        ? undefined
        : window,
    frame: WorldFrame | null = WORLD_FRAME
): boolean {
    return (
        !!win &&
        !!frame &&
        win.location.origin === frame.world &&
        win.parent !== win
    );
}

/**
 * Starts talking to the page. Null when this document is not a framed
 * world, so callers need no check of their own.
 */
export function createWorldDocument(
    win: Window | undefined = typeof window === "undefined"
        ? undefined
        : window,
    frame: WorldFrame | null = WORLD_FRAME
): WorldDocument | null {
    if (!win || !frame || !isWorldDocument(win, frame)) return null;
    const started = win.performance.now();
    const post = (kind: string, data: object = {}) =>
        win.parent.postMessage(
            { type: GAME_MESSAGE_PREFIX + kind, ...data },
            frame.site
        );

    let greeted = false;
    let drawn = false;
    let name: (visitor: WorldVisitor | null) => void = () => {};
    const visitor = new Promise<WorldVisitor | null>((resolve) => {
        name = resolve;
    });
    const hello = () =>
        post("hello", { contract: CONTRACT_VERSION, world: true });
    const asking = win.setInterval(() => {
        if (greeted) return win.clearInterval(asking);
        if (win.performance.now() - started > HELLO_FOR_MS) {
            win.clearInterval(asking);
            name(null);
        } else hello();
    }, HELLO_EVERY_MS);
    hello();

    const receive = (event: MessageEvent) => {
        if (event.source !== win.parent || event.origin !== frame.site) return;
        const kind = readGameMessage(event.data?.type, WORLD_GAME_ID)?.kind;
        if (kind !== "identity" || greeted) return;
        greeted = true;
        name(readWorldVisitor(event.data));
    };
    win.addEventListener("message", receive);

    let reported = "";
    return {
        visitor: () => visitor,
        location(href, title) {
            if (href === reported) return;
            reported = href;
            post("location", { href, ...(title ? { title } : {}) });
        },
        travel(href) {
            post("travel", { href });
        },
        progress(value, label = "") {
            if (!drawn) post("progress", { value, label });
        },
        drawn() {
            if (drawn) return;
            drawn = true;
            post("first-frame", {
                ms: Math.round(win.performance.now() - started),
                width: win.innerWidth,
                height: win.innerHeight,
            });
            post("ready");
        },
        failed() {
            post("error");
        },
        dispose() {
            name(null);
            win.clearInterval(asking);
            win.removeEventListener("message", receive);
        },
    };
}

let current: WorldDocument | null | undefined;

/** This document's one link to the page; null when it is not a framed world. */
export function worldDocument(): WorldDocument | null {
    if (current === undefined) current = createWorldDocument();
    return current;
}

/**
 * Whether this document is a framed world, for what it should not draw
 * because the page around it does (the header, the title, Back). False on
 * the server and on the first render, so the two agree.
 */
export function useIsWorldDocument(): boolean {
    const [framed, setFramed] = useState(false);
    useEffect(() => setFramed(isWorldDocument()), []);
    return framed;
}
