/**
 * Credits for a game: the third-party files it ships, read from the
 * `credits.json` that `pnpm games:check` writes beside the build from the
 * game's `game.json`. The page shows them; the game cannot change them.
 * See docs/games/credits.md.
 */
export interface GameCredit {
    title: string;
    kind: string;
    author: string;
    /** An https link to where the file came from, or null. */
    source: string | null;
    licenseName: string;
    /** The licence text: the copy shipped with the game, else the public page. */
    licenseHref: string | null;
    note: string | null;
    /** False while nobody has confirmed a licence outside the allow list. */
    confirmed: boolean;
}

export interface GameCredits {
    /** Files the game declared as made for it. */
    own: number;
    credits: GameCredit[];
}

const MAX_CREDITS = 200;
const KIND_LABELS: Record<string, string> = {
    model: "Models",
    texture: "Textures",
    image: "Images",
    audio: "Audio",
    font: "Fonts",
    motion: "Motion",
    library: "Code libraries",
    data: "Data",
    other: "Other",
};

const text = (value: unknown, max = 300) =>
    typeof value === "string" ? value.trim().slice(0, max) : "";

function httpsUrl(value: unknown): string | null {
    if (typeof value !== "string") return null;
    try {
        const url = new URL(value);
        return url.protocol === "https:" ? url.href : null;
    } catch {
        return null;
    }
}

/** A licence text inside the game's own folder, never anywhere else. */
function licenseFileHref(game: string, value: unknown): string | null {
    if (typeof value !== "string" || !value) return null;
    const parts = value.split("/");
    if (parts.some((part) => !part || part === "." || part === ".."))
        return null;
    if (/[\\?#\0]/.test(value)) return null;
    return `/games/${game}/${parts.map(encodeURIComponent).join("/")}`;
}

/** Read a fetched credits.json. Anything malformed gives null, not a crash. */
export function parseGameCredits(
    game: string,
    value: unknown
): GameCredits | null {
    const data = value as {
        version?: unknown;
        credits?: unknown;
        own?: unknown;
    };
    if (!data || data.version !== 1 || !Array.isArray(data.credits))
        return null;
    const credits: GameCredit[] = [];
    for (const entry of data.credits.slice(0, MAX_CREDITS)) {
        if (!entry || typeof entry !== "object") continue;
        const title = text(entry.title, 120);
        if (!title) continue;
        credits.push({
            title,
            kind: Object.hasOwn(KIND_LABELS, entry.kind) ? entry.kind : "other",
            author: text(entry.author, 160),
            source: httpsUrl(entry.source),
            licenseName: text(entry.licenseName, 80) || text(entry.license, 80),
            licenseHref:
                licenseFileHref(game, entry.licenseFile) ??
                httpsUrl(entry.licenseUrl),
            note: text(entry.note, 400) || null,
            confirmed: entry.confirmed === true,
        });
    }
    return {
        own: Number.isFinite(data.own) ? Math.max(0, Number(data.own)) : 0,
        credits,
    };
}

/** Credits in display order: one group per kind, kinds in a fixed order. */
export function groupGameCredits(
    credits: GameCredit[]
): Array<{ kind: string; label: string; credits: GameCredit[] }> {
    return Object.keys(KIND_LABELS)
        .map((kind) => ({
            kind,
            label: KIND_LABELS[kind],
            credits: credits.filter((credit) => credit.kind === kind),
        }))
        .filter((group) => group.credits.length > 0);
}

export async function loadGameCredits(
    game: string,
    signal?: AbortSignal,
    fetcher?: typeof fetch
): Promise<GameCredits | null> {
    try {
        const response = await (fetcher ?? fetch)(
            `/games/${game}/credits.json`,
            {
                signal,
            }
        );
        if (!response.ok) return null;
        return parseGameCredits(game, await response.json());
    } catch {
        return null;
    }
}
