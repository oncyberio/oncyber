// Per Firebase project, so a local emulator run (`pnpm dev:local`) never shows
// a catalog cached from another project on the same localhost origin.
const KEY = `oncyber:public-destination-catalog:v1:${
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || ""
}`;
const FRESH_FOR = 24 * 60 * 60 * 1000;
const KEEP_FOR = 7 * FRESH_FOR;
const RETRY_AFTER = 30 * 1000;
type Entry = { savedAt: number; destinations: any[] };
let memory: Entry | null = null;
let pending: Promise<any[]> | null = null;
let retryAt = 0;

function read(): Entry | null {
    if (!memory) {
        try {
            const entry = JSON.parse(window.localStorage.getItem(KEY));
            if (
                entry &&
                Number.isFinite(entry.savedAt) &&
                Array.isArray(entry.destinations) &&
                entry.destinations.every(
                    (item) =>
                        item &&
                        typeof item === "object" &&
                        typeof item._id === "string"
                )
            )
                memory = entry;
        } catch {
            // Storage is optional (private browsing, quota, or corrupt data).
        }
    }
    if (
        memory &&
        (Date.now() < memory.savedAt || Date.now() - memory.savedAt > KEEP_FOR)
    )
        memory = null;
    return memory;
}

// Callers add account-specific tags while preprocessing: never share mutable data.
const copy = (value: any[]) => JSON.parse(JSON.stringify(value));

/** Cache only the public catalog, before account-specific destinations are merged. */
export async function cachedDestinationCatalog(
    load: () => Promise<any[]>
): Promise<any[]> {
    if (typeof window === "undefined") return load();
    const cached = read();
    const stale = !cached || Date.now() - cached.savedAt >= FRESH_FOR;
    if (stale && !pending && (!cached || Date.now() >= retryAt)) {
        pending = load()
            .then((destinations) => {
                memory = {
                    savedAt: Date.now(),
                    destinations: copy(destinations),
                };
                retryAt = 0;
                try {
                    window.localStorage.setItem(KEY, JSON.stringify(memory));
                } catch {}
                return memory.destinations;
            })
            .catch((error) => {
                retryAt = Date.now() + RETRY_AFTER;
                throw error;
            })
            .finally(() => {
                pending = null;
            });
        // Stale data stays usable if background revalidation fails.
        if (cached) void pending.catch(() => {});
    }
    return copy(cached ? cached.destinations : await pending);
}
