/** A source change the assistant proposes: replace one exact snippet. */
export type SourceEdit = {
    path: string;
    /** Exact text in the file today. Empty creates a new file. */
    find: string;
    replace: string;
};

/** Files read from the repository, plus the contributor's changes so far. */
export type Changeset = {
    /** The main commit every file was read at, so the PR has one base. */
    baseSha?: string;
    original: Record<string, string | null>;
    files: Record<string, string>;
};

export function emptyChangeset(): Changeset {
    return { original: {}, files: {} };
}

/** A repository path the assistant may write: relative, inside the repo. */
export function isSafePath(path: string): boolean {
    if (typeof path !== "string" || !path || path.length > 300) return false;
    if (path.startsWith("/") || path.includes("\\")) return false;
    const parts = path.split("/");
    if (parts.some((part) => !part || part === "." || part === ".."))
        return false;
    // Workflows run with the repository's secrets; keep them out of reach.
    if (parts[0] === ".github") return false;
    return true;
}

function countOccurrences(text: string, part: string) {
    let count = 0;
    for (
        let at = text.indexOf(part);
        at !== -1;
        at = text.indexOf(part, at + part.length)
    )
        count++;
    return count;
}

/**
 * Applies edits on top of `current` (path -> content, null when the file
 * does not exist). Returns the new contents of every changed file, or the
 * first problem in words the assistant can act on.
 */
export function applyEdits(
    current: Record<string, string | null>,
    edits: SourceEdit[]
): { files: Record<string, string> } | { error: string } {
    const files: Record<string, string> = {};
    for (const edit of edits) {
        if (!isSafePath(edit.path))
            return { error: `${edit.path}: this path can't be changed.` };
        const text = edit.path in files ? files[edit.path] : current[edit.path];
        if (text === undefined)
            return { error: `${edit.path}: read the file before editing it.` };
        if (text === null) {
            if (edit.find)
                return { error: `${edit.path}: the file does not exist.` };
            files[edit.path] = edit.replace;
            continue;
        }
        if (!edit.find)
            return {
                error: `${edit.path}: "find" is empty but the file exists.`,
            };
        const count = countOccurrences(text, edit.find);
        if (count !== 1)
            return {
                error: `${edit.path}: "find" must match exactly once, it matched ${count} times.`,
            };
        const at = text.indexOf(edit.find);
        files[edit.path] =
            text.slice(0, at) +
            edit.replace +
            text.slice(at + edit.find.length);
    }
    return { files };
}

/** Paths whose content differs from what was read. */
export function changedPaths(changeset: Changeset): string[] {
    return Object.keys(changeset.files).filter(
        (path) => changeset.files[path] !== changeset.original[path]
    );
}

/** A small line diff for showing a change: "-" and "+" lines with context. */
export function lineDiff(before: string | null, after: string, context = 2) {
    const a = before === null ? [] : before.split("\n");
    const b = after.split("\n");
    let start = 0;
    while (start < a.length && start < b.length && a[start] === b[start])
        start++;
    let endA = a.length - 1,
        endB = b.length - 1;
    while (endA >= start && endB >= start && a[endA] === b[endB]) {
        endA--;
        endB--;
    }
    const lines: string[] = [];
    for (let i = Math.max(0, start - context); i < start; i++)
        lines.push("  " + a[i]);
    for (let i = start; i <= endA; i++) lines.push("- " + a[i]);
    for (let i = start; i <= endB; i++) lines.push("+ " + b[i]);
    for (let i = endA + 1; i <= Math.min(a.length - 1, endA + context); i++)
        lines.push("  " + a[i]);
    return lines.join("\n");
}
