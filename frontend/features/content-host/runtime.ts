import { validateExternalContentUrl } from "./security";

export interface EmbeddedRuntime {
    kind: "web" | "awe-app";
    url: string;
    /** Descriptive only. No engine code is imported into the host. */
    engine?: string;
    capabilities?: Array<"wallet.connect">;
}

export function isEmbeddedRuntime(value: unknown): value is EmbeddedRuntime {
    const runtime = value as EmbeddedRuntime;
    return runtime?.kind === "web" || runtime?.kind === "awe-app";
}

export function resolveEmbeddedRuntime(
    value: unknown,
    hostOrigin: string,
    allowLocalhost = false
): EmbeddedRuntime {
    if (!isEmbeddedRuntime(value)) throw new Error("Unsupported content type.");
    const url = validateExternalContentUrl(value.url, hostOrigin, {
        allowLocalhost,
    });
    if (value.kind === "awe-app") {
        if (
            !["awe.box", "www.awe.box"].includes(url.hostname) &&
            !(
                allowLocalhost &&
                ["localhost", "127.0.0.1"].includes(url.hostname)
            )
        )
            throw new Error(
                "Use an awe.box play link for an AWE app experience."
            );
        if (!/^\/play\/[a-zA-Z0-9_-]+\/?$/.test(url.pathname))
            throw new Error("Use an AWE app /play/ link.");
        url.searchParams.set("embed", "oncyber");
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
