/** Jest stand-in for destinationWarmupWorkerFactory: no worker in tests. */
export function createDestinationWarmupWorker(): Worker {
    throw new Error("No destination warmup worker under Jest");
}
