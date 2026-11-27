/**
 * The world's side of the account relay (./accountRelay): the few account
 * calls a framed world's interface makes are asked of the page, which makes
 * them with its own session. On only for a signed-in visitor; a guest's
 * world calls the server itself, as a guest.
 */
import { relayedRoute, relayedRpc } from "./accountRelay";
import { worldDocument } from "./worldDocument";

const CALL_FOR_MS = 30_000;
let signedIn = false;
let patched = false;

/** A signed-in visitor's world: its account calls go through the page. */
export function relayWorldAccount(on: boolean) {
    signedIn = on;
    if (
        !on ||
        patched ||
        typeof window === "undefined" ||
        typeof window.fetch !== "function"
    )
        return;
    patched = true;
    const direct = window.fetch.bind(window);
    window.fetch = async (input, init) => {
        const link = signedIn ? worldDocument() : null;
        const address =
            typeof input === "string"
                ? input
                : input instanceof URL
                ? input.href
                : null;
        const method = (init?.method ?? "GET").toUpperCase();
        if (
            !link ||
            !address ||
            typeof init?.body !== "string" ||
            !relayedRoute(method, address, window.location.origin)
        )
            return direct(input, init);
        const url = new URL(address, window.location.origin);
        const answer = (await link.ask(
            "api",
            {
                url: url.pathname + url.search,
                method,
                body: init.body,
                contentType: new Headers(init.headers).get("content-type"),
            },
            CALL_FOR_MS
        )) as { status?: unknown; body?: unknown } | undefined;
        if (typeof answer?.status !== "number")
            return new Response(null, { status: 503 });
        return new Response(
            typeof answer.body === "string" ? answer.body : null,
            {
                status: answer.status,
                headers: { "Content-Type": "application/json" },
            }
        );
    };
}

/**
 * An RPC call the page should make for this world, or null when the world
 * makes it itself (a guest, an unframed world, a procedure not relayed).
 */
export function relayedWorldRpc(route: string, method: string) {
    const link = signedIn ? worldDocument() : null;
    if (!link || !relayedRpc(route, method)) return null;
    return async (
        params: unknown[],
        options: { encode?: boolean; checksum?: boolean } = {}
    ) => {
        const answer = (await link.ask(
            "rpc",
            {
                route,
                method,
                params,
                // How the call is sent is the caller's choice; the page keeps it.
                encode: options.encode === true,
                checksum: options.checksum === true,
            },
            CALL_FOR_MS
        )) as { ok?: unknown; value?: unknown; error?: unknown } | undefined;
        if (answer?.ok === true) return answer.value;
        throw new Error(
            `RPC Error at '${route}/${method}' : \\n\\n${
                typeof answer?.error === "string"
                    ? answer.error
                    : "The page did not answer"
            }`
        );
    };
}
