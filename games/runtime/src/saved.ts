/**
 * Saved data for a game: named keys the game declares in game.json
 * (`saved`), read and written through the page. See docs/games/saved-data.md.
 *
 *   const saved = connectSavedData({ prefix: "ace:", declared: manifest.saved,
 *       migrate: { settings: (old, from) => (from === 0 ? JSON.parse(old) : undefined) } });
 *   const { value } = await saved.get("settings");   // null when nothing usable
 *   await saved.set("settings", { difficulty: "pro" });
 *   await saved.update("tally", (tally) => ({ matches: (tally?.matches ?? 0) + 1 }));
 *
 * Every value is stored with the `stateVersion` the key declares. A value
 * saved at another version goes through the key's `migrate` hook; when the
 * hook is missing, returns undefined or throws, the game gets null and
 * starts fresh ("reset"). Nothing here throws: a failed read is null with
 * an outcome, a failed write is `{ ok: false, reason }`.
 */
import type { Json } from "./index.ts";

export type SavedScope = "visitor" | "party" | "game";
export interface SavedKeyDeclaration {
    scope: SavedScope;
    stateVersion: number;
    maxBytes: number;
}
export interface SavedEntry {
    stateVersion: number;
    value: Json;
    revision: number;
}
export type SavedRequest =
    | { op: "get"; key: string }
    | {
          op: "set";
          key: string;
          stateVersion: number;
          value: Json;
          ifRevision?: number;
      }
    | { op: "remove"; key: string; ifRevision?: number };
export type SavedReply =
    | { ok: true; entry: SavedEntry | null }
    | { ok: false; reason: string; entry?: SavedEntry | null };
/** How a request reaches whatever keeps the values. Must not reject. */
export type SavedTransport = (request: SavedRequest) => Promise<SavedReply>;

/**
 * What a read found:
 *   current      saved at the declared version
 *   empty        nothing saved
 *   migrated     an older (or newer) save, converted by the migrate hook
 *   reset        a save the game could not use; the game starts fresh
 *   unavailable  the store could not be reached; treat as empty, don't save over it blindly
 */
export type SavedOutcome =
    | "current"
    | "empty"
    | "migrated"
    | "reset"
    | "unavailable";
export interface SavedRead {
    value: Json;
    /** Pass to `set` as `ifRevision`; 0 when nothing is saved. */
    revision: number;
    outcome: SavedOutcome;
    /** Why the store refused, when `outcome` is "unavailable". */
    reason?: string;
}
export type SavedWrite =
    | { ok: true; revision: number }
    | {
          ok: false;
          reason: string;
          /** On "conflict": what the other writer saved, migrated. */ current?: SavedRead;
      };
/** Converts a value saved at `fromVersion`. Return undefined to reset. */
export type SavedMigration = (
    value: Json,
    fromVersion: number
) => Json | undefined;

export interface SavedData {
    get(key: string): Promise<SavedRead>;
    /** Shared keys (party, game) need `ifRevision`; prefer `update` for them. */
    set(
        key: string,
        value: Json,
        options?: { ifRevision?: number }
    ): Promise<SavedWrite>;
    /** Read, change, write; retried when another writer got there first. */
    update(
        key: string,
        change: (value: Json) => Json,
        options?: { attempts?: number }
    ): Promise<SavedWrite & { value?: Json }>;
    remove(key: string, options?: { ifRevision?: number }): Promise<SavedWrite>;
}

const text = (value: Json) =>
    new TextEncoder().encode(JSON.stringify(value)).length;

export function createSavedData(options: {
    /** The `saved` block of game.json. */
    declared: Record<string, SavedKeyDeclaration> | undefined;
    transport: SavedTransport;
    migrate?: Record<string, SavedMigration>;
    /**
     * Told once per read, and when the game names a key it never declared
     * ("unavailable"); the check listens to this.
     */
    report?(
        key: string,
        outcome: SavedOutcome,
        fromVersion: number | null
    ): void;
}): SavedData {
    const declared = options.declared ?? {};
    const declaration = (key: string) =>
        Object.hasOwn(declared, key) ? declared[key] : null;
    const send = (request: SavedRequest): Promise<SavedReply> =>
        options
            .transport(request)
            .catch(() => ({ ok: false, reason: "unavailable" } as SavedReply));
    const report = (key: string, read: SavedRead, from: number | null) => {
        try {
            options.report?.(key, read.outcome, from);
        } catch {
            /* the reporter's problem */
        }
        return read;
    };

    /** An entry as the game should see it, at the declared version. */
    function settle(
        key: string,
        entry: SavedEntry | null | undefined
    ): SavedRead & { converted?: boolean } {
        if (!entry) return { value: null, revision: 0, outcome: "empty" };
        const want = declared[key].stateVersion;
        if (entry.stateVersion === want)
            return {
                value: entry.value,
                revision: entry.revision,
                outcome: "current",
            };
        let value: Json | undefined;
        try {
            value = options.migrate?.[key]?.(entry.value, entry.stateVersion);
            // A migration that returns something unsaveable is a reset too.
            if (value !== undefined)
                value = JSON.parse(JSON.stringify(value)) as Json;
        } catch {
            value = undefined;
        }
        if (value === undefined || value === null)
            return { value: null, revision: entry.revision, outcome: "reset" };
        return {
            value,
            revision: entry.revision,
            outcome: "migrated",
            converted: true,
        };
    }

    const refuse = (reason: string): SavedWrite => ({ ok: false, reason });
    const undeclared = (key: string) => {
        report(key, { value: null, revision: 0, outcome: "unavailable" }, null);
        return refuse("undeclared");
    };
    const written = (key: string, reply: SavedReply): SavedWrite => {
        if (reply.ok) return { ok: true, revision: reply.entry?.revision ?? 0 };
        if (reply.reason !== "conflict") return refuse(reply.reason);
        const { converted, ...current } = settle(key, reply.entry);
        return { ok: false, reason: "conflict", current };
    };

    const saved: SavedData = {
        async get(key) {
            if (!declaration(key))
                return report(
                    key,
                    {
                        value: null,
                        revision: 0,
                        outcome: "unavailable",
                        reason: "undeclared",
                    },
                    null
                );
            const reply = await send({ op: "get", key });
            if (!reply.ok)
                return report(
                    key,
                    {
                        value: null,
                        revision: 0,
                        outcome: "unavailable",
                        reason: reply.reason,
                    },
                    null
                );
            const { converted, ...read } = settle(key, reply.entry);
            if (converted) {
                // Keep the converted value, unless someone wrote meanwhile
                // (then theirs stands and the next read sees it).
                const kept = await saved.set(key, read.value, {
                    ifRevision: read.revision,
                });
                if (kept.ok) read.revision = kept.revision;
            }
            return report(key, read, reply.entry?.stateVersion ?? null);
        },
        async set(key, value, { ifRevision } = {}) {
            const d = declaration(key);
            if (!d) return undeclared(key);
            if (d.scope !== "visitor" && ifRevision === undefined)
                return refuse("revision-required");
            let bytes: number;
            try {
                value = JSON.parse(JSON.stringify(value)) as Json;
                bytes = text(value);
            } catch {
                return refuse("invalid");
            }
            if (value === undefined) return refuse("invalid");
            if (bytes > d.maxBytes) return refuse("too-large");
            return written(
                key,
                await send({
                    op: "set",
                    key,
                    stateVersion: d.stateVersion,
                    value,
                    ifRevision,
                })
            );
        },
        async update(key, change, { attempts = 4 } = {}) {
            let read = await saved.get(key);
            for (let attempt = 0; attempt < attempts; attempt++) {
                if (read.outcome === "unavailable")
                    return refuse(read.reason ?? "unavailable");
                let value: Json;
                try {
                    value = change(read.value);
                } catch {
                    return refuse("invalid");
                }
                const result = await saved.set(key, value, {
                    ifRevision: read.revision,
                });
                if (result.ok) return { ...result, value };
                if (result.reason !== "conflict" || !result.current)
                    return result;
                read = result.current;
            }
            return refuse("conflict");
        },
        async remove(key, { ifRevision } = {}) {
            const d = declaration(key);
            if (!d) return undeclared(key);
            if (d.scope !== "visitor" && ifRevision === undefined)
                return refuse("revision-required");
            return written(key, await send({ op: "remove", key, ifRevision }));
        },
    };
    return saved;
}

/** One entry per key in a Storage-like object: standalone play and tests. */
export function storageSavedTransport(
    storage:
        | {
              getItem(key: string): string | null;
              setItem(key: string, value: string): void;
              removeItem(key: string): void;
          }
        | undefined,
    namespace: string
): SavedTransport {
    const memory = new Map<string, string>();
    const store = storage ?? {
        getItem: (key: string) => memory.get(key) ?? null,
        setItem: (key: string, value: string) => void memory.set(key, value),
        removeItem: (key: string) => void memory.delete(key),
    };
    return async (request) => {
        try {
            const name = `${namespace}:saved:${request.key}`;
            let current: SavedEntry | null = null;
            try {
                current = JSON.parse(store.getItem(name) ?? "null");
            } catch {
                /* corrupt: nothing saved */
            }
            if (
                !current ||
                !Number.isInteger(current.revision) ||
                !Number.isInteger(current.stateVersion)
            )
                current = null;
            if (request.op === "get") return { ok: true, entry: current };
            if (
                request.ifRevision !== undefined &&
                request.ifRevision !== (current?.revision ?? 0)
            )
                return { ok: false, reason: "conflict", entry: current };
            if (request.op === "remove") {
                store.removeItem(name);
                return { ok: true, entry: null };
            }
            const entry = {
                stateVersion: request.stateVersion,
                value: request.value,
                revision: (current?.revision ?? 0) + 1,
            };
            store.setItem(name, JSON.stringify(entry));
            return { ok: true, entry };
        } catch {
            return { ok: false, reason: "unavailable" };
        }
    };
}

/**
 * Requests to the Oncyber page over postMessage: `<prefix>saved` out,
 * `<prefix>saved-result` back, matched by a request number. A page that
 * never answers (an older host) is "unavailable" after `timeoutMs`.
 */
export function pageSavedTransport(options: {
    prefix: string;
    post(message: object): void;
    /** Calls `listener` with each message from the page; returns the unsubscribe. */
    listen(listener: (data: any) => void): () => void;
    timeoutMs?: number;
}): SavedTransport & { dispose(): void } {
    const pending = new Map<number, (reply: SavedReply) => void>();
    let next = 1;
    const stop = options.listen((data) => {
        if (data?.type !== `${options.prefix}saved-result`) return;
        const done = pending.get(data.request);
        if (!done) return;
        pending.delete(data.request);
        done(
            data.ok === true
                ? { ok: true, entry: data.entry ?? null }
                : {
                      ok: false,
                      reason:
                          typeof data.reason === "string"
                              ? data.reason
                              : "unavailable",
                      entry: data.entry,
                  }
        );
    });
    const transport = (request: SavedRequest) =>
        new Promise<SavedReply>((resolve) => {
            const id = next++;
            const timer = setTimeout(() => {
                pending.delete(id);
                resolve({ ok: false, reason: "unavailable" });
            }, options.timeoutMs ?? 5000);
            pending.set(id, (reply) => {
                clearTimeout(timer);
                resolve(reply);
            });
            try {
                options.post({
                    type: `${options.prefix}saved`,
                    request: id,
                    ...request,
                });
            } catch {
                pending.get(id)?.({ ok: false, reason: "invalid" });
                pending.delete(id);
            }
        });
    return Object.assign(transport, {
        dispose() {
            stop();
            for (const done of pending.values())
                done({ ok: false, reason: "unavailable" });
            pending.clear();
        },
    });
}

/**
 * Saved data in a browser frame. Embedded in the Oncyber page it talks to
 * the page; opened on its own (vite dev) it uses the frame's localStorage.
 *
 * With `?check` in the URL it also answers `<prefix>saved-probe` messages
 * from `pnpm games:check`, which saves and reads through this same object
 * and listens for each read's outcome (`<prefix>saved-outcome`).
 */
export function connectSavedData(options: {
    /** The game's message prefix, like "ace:". */
    prefix: string;
    declared: Record<string, SavedKeyDeclaration> | undefined;
    migrate?: Record<string, SavedMigration>;
    timeoutMs?: number;
}): SavedData & { dispose(): void } {
    const { prefix } = options;
    const embedded = window.parent !== window;
    const fromPage = (event: MessageEvent) => event.source === window.parent;
    const post = (message: object) => window.parent.postMessage(message, "*");
    const listeners = new Set<(data: any) => void>();
    const onMessage = (event: MessageEvent) => {
        if (fromPage(event))
            for (const listener of listeners) listener(event.data);
    };
    const listen = (listener: (data: any) => void) => {
        listeners.add(listener);
        return () => void listeners.delete(listener);
    };
    let local: Storage | undefined;
    try {
        local = embedded ? undefined : window.localStorage;
    } catch {
        /* blocked */
    }
    const transport = embedded
        ? pageSavedTransport({
              prefix,
              post,
              listen,
              timeoutMs: options.timeoutMs,
          })
        : storageSavedTransport(local, prefix.replace(/:$/, ""));
    const checking =
        embedded && new URLSearchParams(window.location.search).has("check");
    const saved = createSavedData({
        declared: options.declared,
        transport,
        migrate: options.migrate,
        report: checking
            ? (key, outcome, from) =>
                  post({ type: `${prefix}saved-outcome`, key, outcome, from })
            : undefined,
    });
    if (embedded) window.addEventListener("message", onMessage);
    if (checking)
        listen((data) => {
            if (data?.type !== `${prefix}saved-probe`) return;
            const run =
                data.op === "get"
                    ? saved.get(data.key)
                    : data.op === "update"
                    ? saved.update(data.key, () => data.value)
                    : saved.set(data.key, data.value, {
                          ifRevision: data.ifRevision,
                      });
            void run.then((result) =>
                post({
                    type: `${prefix}saved-probe-result`,
                    probe: data.probe,
                    result,
                })
            );
        });
    return Object.assign(saved, {
        dispose() {
            window.removeEventListener("message", onMessage);
            if ("dispose" in transport) transport.dispose();
        },
    });
}
