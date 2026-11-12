/**
 * Every message between a world built with the content SDK and the Oncyber
 * page that hosts it, declared once.
 *
 * The host (`protocol.ts`, `EmbeddedExperience.tsx`) imports this. The SDK,
 * `public/oncyber-content.js`, is a plain script that worlds copy into their
 * own files, so it cannot import anything: it carries the same values in its
 * `PROTOCOL` literal, and `contentBridgeMessages.test.ts` fails when the two
 * differ. Change both together, and keep every name that a copied SDK
 * already sends or listens for: worlds keep the copy they shipped with.
 *
 * Each message is `{ tag, v, kind, session, ... }`. By kind:
 *
 * - `init`, host to world, with `capabilities`: each time the world's
 *   document loads. It starts a new session; older answers are dropped.
 * - `request`, world to host, with `id` and `method` (one of `methods`):
 *   `ready()`, `openMenu()` and `requestWalletAddress()` in the SDK.
 * - `result`, host to world, with `id`, `method` and `payload`: a request
 *   succeeded.
 * - `error`, host to world, with `id`, `method` and `error` (a code such as
 *   `USER_REJECTED`): a request was refused.
 * - `event`, host to world, with `method` (one of `events`), unasked:
 *   `resume` when the visitor closes the host's world menu with Resume.
 *
 * The result of `wallet.connect` (the address) travels only over the
 * MessageChannel port the world sends with that request; its errors may also
 * come as a window message.
 */
export const CONTENT_PROTOCOL = {
    tag: "oncyber:content",
    v: 1,
    kinds: {
        init: "init",
        request: "request",
        result: "result",
        error: "error",
        event: "event",
    },
    /** What a world can ask the host for. */
    methods: {
        ready: "ready",
        menu: "menu",
        walletConnect: "wallet.connect",
    },
    /** What the host tells a world without being asked. */
    events: {
        resume: "resume",
    },
} as const;

type Values<T> = T[keyof T];

export type ContentMessageKind = Values<typeof CONTENT_PROTOCOL.kinds>;
export type ContentRequestMethod = Values<typeof CONTENT_PROTOCOL.methods>;
export type ContentEventName = Values<typeof CONTENT_PROTOCOL.events>;

export const CONTENT_REQUEST_METHODS: readonly string[] = Object.values(
    CONTENT_PROTOCOL.methods
);

/** A message the host sends a world unasked, such as `resume`. */
export function createContentEvent(session: string, name: ContentEventName) {
    return {
        tag: CONTENT_PROTOCOL.tag,
        v: CONTENT_PROTOCOL.v,
        kind: CONTENT_PROTOCOL.kinds.event,
        session,
        method: name,
    };
}

/** The host's answer to one request: its payload, or an error code. */
export function createContentReply(
    request: { session: string; id: string; method: string },
    payload: unknown,
    code?: string
) {
    return {
        tag: CONTENT_PROTOCOL.tag,
        v: CONTENT_PROTOCOL.v,
        session: request.session,
        id: request.id,
        kind: code
            ? CONTENT_PROTOCOL.kinds.error
            : CONTENT_PROTOCOL.kinds.result,
        method: request.method,
        ...(code ? { error: code } : { payload }),
    };
}
