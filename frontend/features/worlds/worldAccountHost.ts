/**
 * The page's side of the account relay (./accountRelay): it makes, with its
 * own session, the calls a framed world is allowed to ask for, and nothing
 * else. A world never sees the session; it sees the answer.
 */
import {
    PAGE_SESSION,
    askedSpace,
    relayedRoute,
    relayedRpc,
    relayedSettings,
    relayedSpaceEdit,
} from "./accountRelay";

export interface WorldAccountHost {
    /** The page's visitor is signed in. A guest's world asks for nothing. */
    signedIn: boolean;
    /** The space this page opened: the only one a world may save edits to. */
    spaceId: string;
    origin: string;
    /** Whether a name or id a world gives is the space this page opened. */
    opened(label: string): Promise<boolean>;
    rpc(
        route: string,
        method: string,
        params: unknown[],
        options: { encode?: true; checksum?: boolean }
    ): Promise<unknown>;
    request: typeof fetch;
}

const parse = (text: unknown) => {
    try {
        return typeof text === "string" ? JSON.parse(text) : null;
    } catch {
        return null;
    }
};

/** The page's answer to a world's `rpc` or `api` question. */
export async function answerWorldAccount(
    name: unknown,
    data: any,
    host: WorldAccountHost
): Promise<unknown> {
    if (!host.signedIn) return undefined;
    if (name === "rpc") {
        if (
            !relayedRpc(data?.route, data?.method) ||
            !Array.isArray(data.params)
        )
            return { ok: false, error: "Not available to a world" };
        try {
            // What the session alone earns is for the space this page
            // opened. Asked about another one (a portal's destination),
            // a world learns whether its visitor moderates nothing, and
            // is let in without the pass their account would be given:
            // a pass is a way into that space for whoever holds it.
            const label = askedSpace(data.route, data.method, data.params);
            const elsewhere =
                label !== null &&
                !(await host.opened(label).catch(() => false));
            if (elsewhere && data.method === "isMod")
                return { ok: true, value: false };
            const value = await host.rpc(data.route, data.method, data.params, {
                ...(data.encode === true ? { encode: true } : {}),
                ...(data.checksum === true ? { checksum: true } : {}),
            });
            return {
                ok: true,
                value:
                    elsewhere &&
                    !data.params[0]?.password &&
                    value &&
                    typeof value === "object" &&
                    "proof" in value
                        ? { ...value, proof: undefined }
                        : value,
            };
        } catch (error) {
            return {
                ok: false,
                error: String((error as Error)?.message ?? error).slice(0, 500),
            };
        }
    }
    if (name === "api") {
        const route = relayedRoute(data?.method, data?.url, host.origin);
        const refused = { status: 403, body: "" };
        if (!route || typeof data.body !== "string") return refused;
        if (route.kind === "settings" && !relayedSettings(parse(data.body)))
            return refused;
        if (
            route.kind === "space" &&
            (route.id !== host.spaceId || !relayedSpaceEdit(parse(data.body)))
        )
            return refused;
        // The world holds a stand-in where a session token would be. The
        // page's own session answers for the request, so the stand-in goes.
        const sent = parse(data.body);
        let body: string = data.body;
        if (sent && typeof sent === "object" && sent.token === PAGE_SESSION) {
            delete sent.token;
            body = JSON.stringify(sent);
        }
        try {
            const response = await host.request(data.url, {
                method: "POST",
                // Sent as the world sent it: the server reads the body by it.
                ...(typeof data.contentType === "string"
                    ? { headers: { "Content-Type": data.contentType } }
                    : {}),
                credentials: "include",
                body,
            });
            return { status: response.status, body: await response.text() };
        } catch {
            return { status: 503, body: "" };
        }
    }
    return undefined;
}
