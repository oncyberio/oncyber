// Talking to the site: its RPC procedures and the upload address
// (docs/games/publishing.md, "The calls").

export class SiteError extends Error {
    constructor(message, { status = 0, code = "SITE" } = {}) {
        super(message);
        this.status = status;
        this.code = code;
    }
}

const NOT_SIGNED_IN =
    "not signed in. Run `oncyber login`, or set ONCYBER_SESSION_TOKEN";

/** What a refusal most likely means, said so a person can act on it. */
export function explain(message, { status, method }) {
    const text = String(message);
    if (status === 401 || /^unauthori[sz]ed$/i.test(text))
        return {
            code: "NOT_SIGNED_IN",
            message:
                "the site did not accept the login (it may have expired). Run `oncyber login`",
        };
    if (
        status === 404 ||
        /^not found\.?$/i.test(text) ||
        /invalid method/i.test(text) ||
        /publishing\b.*\b(off|disabled|not (enabled|open|available))/i.test(
            text
        )
    )
        return {
            code: "PUBLISHING_OFF",
            message: `publishing games is not enabled on this site${
                status === 404 || /^not found\.?$|invalid method/i.test(text)
                    ? ""
                    : ` (${text})`
            }. The site turns it on with GAMES_PUBLISHING`,
        };
    if (/not (allowed|permitted)|may not publish|forbidden/i.test(text))
        return {
            code: "NOT_ALLOWED",
            message: `this account may not publish here: ${text}`,
        };
    if (
        /choose another id|taken by|another account's game|is a game in/i.test(
            text
        )
    )
        return {
            code: "ID_TAKEN",
            message: `${text.replace(
                /[.\s]+$/,
                ""
            )}. The id is "oncyber": { "id": "<id>" } in the game's package.json`,
        };
    return { code: "REFUSED", message: `${method} was refused: ${text}` };
}

/**
 * @param {{ baseUrl: string, token?: string | null, fetch?: typeof fetch }} options
 */
export function createSite({
    baseUrl,
    token = null,
    fetch = globalThis.fetch,
}) {
    const send = async (url, init) => {
        try {
            return await fetch(url, init);
        } catch (error) {
            throw new SiteError(
                `cannot reach ${baseUrl}: ${
                    error?.cause?.message ?? error?.message ?? error
                }. ONCYBER_BASE_URL chooses the site`,
                { code: "UNREACHABLE" }
            );
        }
    };
    return {
        baseUrl,
        token,
        /** Call an RPC procedure. `auth: false` sends no token. */
        async rpc(service, method, input, { auth = true } = {}) {
            if (auth && !token)
                throw new SiteError(NOT_SIGNED_IN, { code: "NOT_SIGNED_IN" });
            const response = await send(`${baseUrl}/api/_v2/${service}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: "method",
                    method,
                    // A procedure with no input is called with none.
                    params: input === undefined ? [] : [input],
                    ...(auth ? { token } : {}),
                }),
            });
            let data = null;
            try {
                data = await response.json();
            } catch {
                // Not JSON: an error page from something in front of the site.
            }
            if (data?.type === "Success") return data.value;
            const raw =
                typeof data?.error === "string" && data.error
                    ? data.error
                    : `the site answered ${response.status}`;
            const { code, message } = explain(raw, {
                // A 404 with no RPC answer: the site has no such service.
                status: data && response.status === 404 ? 0 : response.status,
                method: `${service}.${method}`,
            });
            throw new SiteError(message, { status: response.status, code });
        },
        /** PUT bytes to an address on the site, as the signed-in account. */
        async put(url, bytes, headers = {}) {
            if (!token)
                throw new SiteError(NOT_SIGNED_IN, { code: "NOT_SIGNED_IN" });
            if (new URL(url).origin !== new URL(baseUrl).origin)
                throw new SiteError(
                    `the upload address ${url} is not on ${baseUrl}; nothing was sent`,
                    { code: "UPLOAD_ADDRESS" }
                );
            const response = await send(url, {
                method: "PUT",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/octet-stream",
                    ...headers,
                },
                body: bytes,
            });
            if (response.ok) return;
            let reason = "";
            try {
                const text = await response.text();
                try {
                    reason = JSON.parse(text).error ?? text;
                } catch {
                    reason = text;
                }
            } catch {
                // The status says enough.
            }
            throw new SiteError(
                `the site refused the upload (${response.status})${
                    reason ? `: ${String(reason).slice(0, 300)}` : ""
                }`,
                { status: response.status, code: "UPLOAD_REFUSED" }
            );
        },
        send,
    };
}
