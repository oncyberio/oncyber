/**
 * Kept apart so Jest (CommonJS) never parses `import.meta`; jest.config maps
 * this module to workerFactory.jest.ts.
 */
export function createProceduralAvatarWorker(): Worker | null {
    if (typeof Worker === "undefined") return null;
    return new Worker(new URL("./worker.ts", import.meta.url), {
        name: "procedural-avatar",
    });
}
