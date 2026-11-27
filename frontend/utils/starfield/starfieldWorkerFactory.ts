/**
 * Kept apart so Jest (CommonJS) never parses `import.meta`; jest.config maps
 * this module to starfieldWorkerFactory.jest.ts.
 */
export function createStarfieldWorker(): Worker | null {
    return new Worker(new URL("./starfield.worker.ts", import.meta.url), {
        name: "starfield",
    });
}
