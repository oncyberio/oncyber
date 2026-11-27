/** Jest stand-in for workerFactory: no worker in tests, so avatars build inline. */
export function createProceduralAvatarWorker(): Worker | null {
    return null;
}
