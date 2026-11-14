/**
 * Browser helpers for a game page that is not on the lifecycle host yet:
 * an avatar service with the same contract as `services.avatar()`, and the
 * answer to the check's "what do you see" question. No renderer here.
 */

export const AVATAR_MAX_BYTES = 32 * 1024 * 1024;

/**
 * `services.avatar(ref, signal)` for a plain page: bytes only for avatars
 * the page vouched for (the visitor's own, and players it announced), fetched
 * once each and capped in size. Never an arbitrary URL fetch.
 */
export function pageAvatarService(
    options: { fetch?: typeof fetch; maxBytes?: number } = {}
) {
    const vouched = new Set<string>();
    const cache = new Map<string, Promise<ArrayBuffer>>();
    const max = options.maxBytes ?? AVATAR_MAX_BYTES;
    return {
        /** Call with the identity's avatar and each announced player's. */
        vouch(ref: unknown) {
            if (typeof ref === "string" && ref && ref.length <= 2048)
                vouched.add(ref);
        },
        avatar(ref: string, signal?: AbortSignal): Promise<ArrayBuffer> {
            if (!vouched.has(ref))
                return Promise.reject(new Error("AVATAR_NOT_VOUCHED"));
            let pending = cache.get(ref);
            if (!pending) {
                pending = (options.fetch ?? fetch)(ref, { signal }).then(
                    async (response) => {
                        if (!response.ok)
                            throw new Error(`AVATAR_HTTP_${response.status}`);
                        const bytes = await response.arrayBuffer();
                        if (bytes.byteLength > max)
                            throw new Error("AVATAR_TOO_LARGE");
                        return bytes;
                    }
                );
                // A failed or aborted fetch may be tried again.
                pending.catch(
                    () => cache.get(ref) === pending && cache.delete(ref)
                );
                cache.set(ref, pending);
            }
            // Each caller gets its own copy: parsers may detach the buffer.
            return pending.then((bytes) => bytes.slice(0));
        },
    };
}

export const INSPECT_REQUEST = "oncyber:inspect";
export const INSPECT_RESULT = "oncyber:inspect-result";

/**
 * Lets `pnpm games:check` read `inspect()` while it plays the page's part.
 * Only answers when the page was opened with `?check`, and only its parent.
 */
export function answerInspect(inspect: () => unknown, target: Window = window) {
    if (
        !new URLSearchParams(target.location.search).has("check") ||
        target.parent === target
    )
        return () => {};
    const receive = (event: MessageEvent) => {
        if (
            event.source !== target.parent ||
            event.data?.type !== INSPECT_REQUEST
        )
            return;
        let value: unknown;
        try {
            value = JSON.parse(JSON.stringify(inspect()));
        } catch (error) {
            value = {
                error: String((error as Error)?.message ?? error).slice(0, 200),
            };
        }
        target.parent.postMessage(
            { type: INSPECT_RESULT, nonce: event.data.nonce, inspect: value },
            "*"
        );
    };
    target.addEventListener("message", receive);
    return () => target.removeEventListener("message", receive);
}
