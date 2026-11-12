/** Entry-owned work that needs no room or presence. Each loader runs once. */
export function prepareMultiplayerResources<Room, Chat>(load: {
    roomService: () => Promise<Room>;
    chatProvider: () => Promise<Chat>;
    profanity: () => Promise<string[] | null>;
}) {
    const roomService = Promise.resolve().then(load.roomService);
    const chatProvider = Promise.resolve().then(load.chatProvider);
    const profanity = Promise.resolve().then(load.profanity);
    // Observe early failures immediately. Imports never join a room, so an
    // unused chunk need not delay cancellation; consumers await/rethrow needed
    // resources at the original readiness fence.
    const settled = Promise.allSettled([roomService, chatProvider, profanity]);
    return { roomService, chatProvider, profanity, settled };
}

export type MultiplayerStartupResources = ReturnType<
    typeof prepareMultiplayerResources<
        typeof import("@utils/arena"),
        typeof import("@utils/chat/ColyseusChatProvider")
    >
>;

/** Release navigation promptly even when profile/import/seat work cannot abort. */
export function awaitMultiplayerStep<T>(
    pending: Promise<T>,
    signal: AbortSignal
): Promise<T> {
    return new Promise((resolve, reject) => {
        const cancel = () =>
            reject(
                new DOMException("Multiplayer join cancelled", "AbortError")
            );
        if (signal.aborted) cancel();
        else signal.addEventListener("abort", cancel, { once: true });
        // Always observe late completion/rejection, including an already-aborted call.
        pending.then(
            (value) => {
                signal.removeEventListener("abort", cancel);
                if (signal.aborted) cancel();
                else resolve(value);
            },
            (error) => {
                signal.removeEventListener("abort", cancel);
                reject(error);
            }
        );
    });
}
