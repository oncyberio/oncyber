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
import { createContext, useContext, useEffect, useState } from "react";
import {
    CONTRACT_VERSION,
    GAME_MESSAGE_PREFIX,
    readGameMessage,
} from "@features/games/gameContract";
import { BEAT_EVERY_MS } from "@features/games/frameStall";
import { WORLD_FRAME, type WorldFrame } from "./worldFrame";
import { keepFramesComing } from "./worldFrames";
import { captureWorldLinks } from "./worldLinks";
import { readWorldVisitor, type WorldVisitor } from "./worldVisitor";

/** The id a native world goes by in the games contract. */
export const WORLD_GAME_ID = "world";
const HELLO_EVERY_MS = 250;
/** The page answers at once when it is there; after this, stop asking. */
const HELLO_FOR_MS = 20_000;
/** How long the world waits for the page to answer a question. */
const ASK_FOR_MS = 8_000;

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
    /** Any other message to the page, and the page's to the world. */
    send(kind: string, data?: object): void;
    listen(handler: (kind: string, data: any) => void): () => void;
    /**
     * Asks the page something only it can know (it holds the account).
     * Undefined when the page does not answer.
     */
    ask(name: string, data?: object, waitMs?: number): Promise<unknown>;
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
    let beating: ReturnType<Window["setInterval"]> | undefined;
    const heard = new Set<(kind: string, data: any) => void>();
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
        if (!kind) return;
        if (kind !== "identity")
            return [...heard].forEach((handler) => handler(kind, event.data));
        if (greeted) return;
        greeted = true;
        name(readWorldVisitor(event.data));
    };
    win.addEventListener("message", receive);
    // A frame from another origin is slowed while it is covered or unseen,
    // which is how a world loads (./worldFrames).
    const releaseFrames = keepFramesComing(win);
    // Every way out of this document is a request to the page (./worldLinks).
    const releaseLinks = win.document
        ? captureWorldLinks(win, frame, post)
        : () => {};

    let reported = "";
    let asked = 0;
    const answers = new Map<number, (value: unknown) => void>();
    heard.add((kind, data) => {
        if (kind !== "answer") return;
        answers.get(data?.n)?.(data.value);
        answers.delete(data?.n);
    });
    return {
        visitor: () => visitor,
        ask(name, data = {}, waitMs = ASK_FOR_MS) {
            const n = ++asked;
            return new Promise((resolve) => {
                const timer = win.setTimeout(() => {
                    answers.delete(n);
                    resolve(undefined);
                }, waitMs);
                answers.set(n, (value) => {
                    win.clearTimeout(timer);
                    resolve(value);
                });
                post("ask", { ...data, n, name });
            });
        },
        send: post,
        listen(handler) {
            heard.add(handler);
            return () => void heard.delete(handler);
        },
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
            // From here the page expects to hear this thread is running
            // (features/games/frameStall).
            beating = win.setInterval(() => post("alive"), BEAT_EVERY_MS);
        },
        failed() {
            post("error");
        },
        dispose() {
            name(null);
            win.clearInterval(beating);
            win.clearInterval(asking);
            win.removeEventListener("message", receive);
            releaseLinks();
            releaseFrames();
            heard.clear();
            answers.forEach((answer) => answer(undefined));
            answers.clear();
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
 * Set by the app shell from what the server said of the request: this
 * document is the world's side of a frame. Known on the server and on the
 * first render alike, so the world never renders, or fetches the code for,
 * what the page around it draws.
 */
export const FramedWorldContext = createContext(false);

/**
 * Whether this document is a framed world, for what it should not draw
 * because the page around it does (the header, the title, Back). On the
 * server it is what the shell was told; in the browser it is then checked
 * against the document itself.
 */
export function useIsWorldDocument(): boolean {
    const told = useContext(FramedWorldContext);
    const [framed, setFramed] = useState(told);
    useEffect(() => setFramed(told || isWorldDocument()), [told]);
    return framed;
}
