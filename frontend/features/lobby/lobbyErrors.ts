/**
 * The sentence a visitor reads when something they did in the lobby fails
 * (docs/feedback.md: beside the control, in plain words, with a retry where
 * it helps).
 *
 * Lobby code and the lobby server fail with a plain `Error` whose message is
 * already written for visitors ("This party is full."). Anything else, such
 * as a `TypeError` from a fetch that never reached the server, a
 * `DOMException`, a parse error or a long technical dump, was not written
 * for anyone, and the visitor reads `fallback` instead.
 */
const MAX_LENGTH = 200;

/** Text browsers and libraries produce, never a lobby sentence. */
const TECHNICAL =
    /failed to fetch|networkerror|load failed|network request|unexpected token|is not (?:a function|defined|valid json)|cannot read propert|undefined|null\b|\bjson\b|\[object |at \S+ \(|https?:\/\//i;

function written(text: unknown): text is string {
    return (
        typeof text === "string" &&
        !!text.trim() &&
        text.length <= MAX_LENGTH &&
        !TECHNICAL.test(text)
    );
}

export function lobbyErrorMessage(error: unknown, fallback: string): string {
    if (typeof error === "string") return written(error) ? error : fallback;
    const value = error as { name?: unknown; message?: unknown } | null;
    if (!value || typeof value !== "object") return fallback;
    // Built-in failures (TypeError, SyntaxError, DOMException…) carry the
    // browser's wording, not ours.
    if (value.name !== undefined && value.name !== "Error") return fallback;
    return written(value.message) ? value.message : fallback;
}
