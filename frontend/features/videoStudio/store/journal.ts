import {
    immutableCopy,
    parseVideoProject,
    type VideoProjectV1,
} from "../model";

export interface StorageLike {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
}

export interface EditorHistoryEntry {
    readonly label: string;
    readonly operationIds: readonly string[];
    readonly before: VideoProjectV1;
    readonly after: VideoProjectV1;
}

export interface VideoJournalV1 {
    readonly schemaVersion: 1;
    readonly project: VideoProjectV1;
    readonly undo: readonly EditorHistoryEntry[];
    readonly redo: readonly EditorHistoryEntry[];
}

export function browserLocalStorage(): StorageLike | null {
    try {
        const storage = (globalThis as { localStorage?: StorageLike })
            .localStorage;
        if (!storage) return null;
        return storage;
    } catch {
        return null;
    }
}

function parseHistory(value: unknown): readonly EditorHistoryEntry[] {
    if (!Array.isArray(value) || value.length > 200)
        throw new Error("Journal history is invalid.");
    return value.map((entry) => {
        if (
            !entry ||
            typeof entry !== "object" ||
            typeof entry.label !== "string" ||
            entry.label.length > 160 ||
            !Array.isArray(entry.operationIds) ||
            entry.operationIds.some(
                (id: unknown) => typeof id !== "string" || id.length > 128
            )
        )
            throw new Error("Journal history entry is invalid.");
        return immutableCopy({
            label: entry.label,
            operationIds: entry.operationIds,
            before: parseVideoProject(entry.before),
            after: parseVideoProject(entry.after),
        });
    });
}

export function readVideoJournal(
    storage: StorageLike | null,
    key: string
): VideoJournalV1 | null {
    if (!storage) return null;
    try {
        const raw = storage.getItem(key);
        if (!raw || raw.length > 12_000_000) return null;
        const value = JSON.parse(raw);
        if (value?.schemaVersion !== 1) return null;
        return immutableCopy({
            schemaVersion: 1,
            project: parseVideoProject(value.project),
            undo: parseHistory(value.undo),
            redo: parseHistory(value.redo),
        });
    } catch {
        return null;
    }
}

/** Returns a UI-displayable error instead of making localStorage a hard dependency. */
export function writeVideoJournal(
    storage: StorageLike | null,
    key: string,
    journal: VideoJournalV1
): string | null {
    if (!storage) return null;
    try {
        storage.setItem(key, JSON.stringify(journal));
        return null;
    } catch (error) {
        return error instanceof Error
            ? error.message
            : "The local video journal could not be saved.";
    }
}

export function removeVideoJournal(
    storage: StorageLike | null,
    key: string
): string | null {
    if (!storage) return null;
    try {
        storage.removeItem(key);
        return null;
    } catch (error) {
        return error instanceof Error
            ? error.message
            : "The local video journal could not be cleared.";
    }
}
