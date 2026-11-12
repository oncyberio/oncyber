import {
    CONTENT_PROTOCOL,
    CONTENT_REQUEST_METHODS,
    type ContentRequestMethod,
} from "./contentBridgeMessages";

// The names are declared in contentBridgeMessages.ts, which the public SDK
// mirrors.
export const CONTENT_BRIDGE_TAG = CONTENT_PROTOCOL.tag;
export const CONTENT_BRIDGE_VERSION = CONTENT_PROTOCOL.v;

export type ContentCapability = typeof CONTENT_PROTOCOL.methods.walletConnect;
export type ContentMethod = ContentRequestMethod;

export interface ContentRequest {
    tag: typeof CONTENT_BRIDGE_TAG;
    v: typeof CONTENT_BRIDGE_VERSION;
    kind: "request";
    session: string;
    id: string;
    /** Kept as a string so unsupported wallet operations receive an error. */
    method: string;
    payload?: unknown;
}

export function createContentSession(): string {
    // Do not fall back to Math.random: unavailable secure randomness fails shut.
    const bytes = new Uint8Array(24);
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

/** No host credentials, account information or providers belong in this init. */
export function createContentInit(
    session: string,
    capabilities: ContentCapability[] = []
) {
    return {
        tag: CONTENT_BRIDGE_TAG,
        v: CONTENT_BRIDGE_VERSION,
        kind: CONTENT_PROTOCOL.kinds.init,
        session,
        capabilities: capabilities.includes(
            CONTENT_PROTOCOL.methods.walletConnect
        )
            ? [CONTENT_PROTOCOL.methods.walletConnect]
            : [],
    };
}

const REQUEST_ID = /^[A-Za-z0-9_-]{1,80}$/;
const METHOD = /^[A-Za-z][A-Za-z0-9._-]{0,79}$/;
const MAX_MESSAGE_CHARS = 8192;
const MAX_REQUESTS_PER_WINDOW = 30;
const REQUEST_WINDOW_MS = 10_000;
const MAX_SESSION_REQUESTS = 4096;

/**
 * Create a fresh gate/nonce on EVERY iframe load, including self-navigation,
 * and cancel pending permission dialogs before initializing that new document.
 * Source+opaque origin+nonce scopes messages to the current frame session, not
 * to a verified publisher; sharing an address still needs a host-owned click.
 */
export class ContentMessageGate {
    private seen = new Set<string>();
    private arrivals: number[] = [];

    constructor(
        private session: string,
        private now: () => number = Date.now
    ) {}

    read(
        event: Pick<MessageEvent, "source" | "origin" | "data">,
        expectedSource: MessageEventSource | null
    ): ContentRequest | null {
        if (
            !expectedSource ||
            event.source !== expectedSource ||
            event.origin !== "null"
        ) {
            return null;
        }
        const value = event.data;
        if (
            !value ||
            typeof value !== "object" ||
            Array.isArray(value) ||
            value.tag !== CONTENT_BRIDGE_TAG ||
            value.v !== CONTENT_BRIDGE_VERSION ||
            value.kind !== CONTENT_PROTOCOL.kinds.request ||
            value.session !== this.session ||
            typeof value.id !== "string" ||
            !REQUEST_ID.test(value.id) ||
            typeof value.method !== "string" ||
            !METHOD.test(value.method)
        ) {
            return null;
        }
        // Structured clone can carry cyclic objects and non-JSON values. Neither
        // belongs in the bridge. Check size before storing identifiers or UI data.
        try {
            if (JSON.stringify(value).length > MAX_MESSAGE_CHARS) return null;
        } catch {
            return null;
        }
        if (
            this.seen.has(value.id) ||
            this.seen.size >= MAX_SESSION_REQUESTS
        ) {
            return null;
        }
        const now = this.now();
        this.arrivals = this.arrivals.filter(
            (arrival) => arrival > now - REQUEST_WINDOW_MS
        );
        if (this.arrivals.length >= MAX_REQUESTS_PER_WINDOW) return null;
        this.arrivals.push(now);
        this.seen.add(value.id);
        // Copy only protocol fields. Nothing supplied by the frame is spread
        // into host UI props, wallet configuration, fetch options, or state.
        return {
            tag: CONTENT_BRIDGE_TAG,
            v: CONTENT_BRIDGE_VERSION,
            kind: CONTENT_PROTOCOL.kinds.request,
            session: this.session,
            id: value.id,
            method: value.method,
            ...(Object.prototype.hasOwnProperty.call(value, "payload")
                ? { payload: value.payload }
                : {}),
        };
    }
}

export function contentRequestError(
    request: ContentRequest
): "UNSUPPORTED_METHOD" | "INVALID_PARAMS" | null {
    if (!CONTENT_REQUEST_METHODS.includes(request.method)) {
        return "UNSUPPORTED_METHOD";
    }
    if (request.payload == null) return null;
    if (
        typeof request.payload !== "object" ||
        Array.isArray(request.payload) ||
        Object.getPrototypeOf(request.payload) !== Object.prototype ||
        Reflect.ownKeys(request.payload).length !== 0
    ) {
        return "INVALID_PARAMS";
    }
    return null;
}
