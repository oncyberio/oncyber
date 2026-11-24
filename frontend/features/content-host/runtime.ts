import { validateExternalContentUrl } from "./security";

export interface EmbeddedRuntime {
    kind: "web" | "awe-app";
    url: string;
    /** Descriptive only. No engine code is imported into the host. */
    engine?: string;
    /** Wait for the document to announce that its player is ready. */
    readyOn?: "message";
    capabilities?: Array<"wallet.connect">;
}

export function isEmbeddedRuntime(value: unknown): value is EmbeddedRuntime {
    const runtime = value as EmbeddedRuntime;
    return runtime?.kind === "web" || runtime?.kind === "awe-app";
}

export function resolveEmbeddedRuntime(
    value: unknown,
    hostOrigin: string,
    allowLocalhost = false,
    awePlayerOrigin?: string
): EmbeddedRuntime {
    if (!isEmbeddedRuntime(value)) throw new Error("Unsupported content type.");
    let url = validateExternalContentUrl(value.url, hostOrigin, {
        allowLocalhost,
    });
    if (value.kind === "awe-app") {
        if (
            !["awe.box", "www.awe.box"].includes(url.host) &&
            !(
                allowLocalhost &&
                ["localhost", "127.0.0.1"].includes(url.hostname)
            )
        )
            throw new Error(
                "Use an awe.box play link for an AWE app experience."
            );
        if (!/^\/play\/[a-zA-Z0-9_-]{1,128}\/?$/.test(url.pathname))
            throw new Error("Use an AWE app /play/ link.");
        const draft = url.searchParams.get("draft") === "true";
        url.search = "";
        url.hash = "";
        if (draft) url.searchParams.set("draft", "true");
        url.searchParams.set("embed", "oncyber");
        // Registration retains the original world ID and URL across player moves.
        if (awePlayerOrigin) {
            const player = validateExternalContentUrl(
                awePlayerOrigin,
                hostOrigin,
                {
                    allowLocalhost,
                }
            );
            if (player.href !== player.origin + "/")
                throw new Error(
                    "Configure a player origin without a path or query."
                );
            url = new URL(url.pathname + url.search, player.origin);
        }
    }
    if (
        value.capabilities != null &&
        (!Array.isArray(value.capabilities) ||
            value.capabilities.some(
                (capability) => capability !== "wallet.connect"
            ))
    )
        throw new Error("Unsupported content capability.");
    return {
        kind: value.kind,
        url: url.href,
        ...(value.kind === "awe-app" || value.readyOn === "message"
            ? { readyOn: "message" as const }
            : {}),
        ...(typeof value.engine === "string"
            ? { engine: value.engine.slice(0, 40) }
            : {}),
        capabilities: value.capabilities?.includes("wallet.connect")
            ? ["wallet.connect"]
            : [],
    };
}

export function inferContentKind(raw: string): EmbeddedRuntime["kind"] {
    try {
        return ["awe.box", "www.awe.box"].includes(new URL(raw).hostname)
            ? "awe-app"
            : "web";
    } catch {
        return "web";
    }
}
