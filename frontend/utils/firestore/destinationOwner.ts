/**
 * Who owns a destination: the account in its `userId` (set from the session
 * when it is created), or, for older documents without one, the author's.
 * Compared exactly, as the destination procedures do (assertOwnership in
 * pages/api/_v2/destinations/writeOperations).
 */
export function isDestinationOwner(
    destination: { userId?: string; author?: { userId?: string } } | null,
    userId: unknown
): boolean {
    if (!destination || typeof userId !== "string" || !userId) return false;
    const owner = destination.userId || destination.author?.userId;
    return typeof owner === "string" && owner === userId;
}
