/** Jest stand-in for starfieldWorkerFactory: no worker in tests. */
export function createStarfieldWorker(): Worker | null {
    return null;
}
