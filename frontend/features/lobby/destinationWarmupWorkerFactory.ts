/**
 * Kept apart so Jest (CommonJS) never parses `import.meta`; jest.config maps
 * this module to destinationWarmupWorkerFactory.jest.ts.
 */
export function createDestinationWarmupWorker() {
    return new Worker(
        new URL("./destinationWarmupWorker.ts", import.meta.url),
        { name: "destination-warmup" }
    );
}
