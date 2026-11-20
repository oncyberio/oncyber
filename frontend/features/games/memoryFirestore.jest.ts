/**
 * An in-memory stand-in for the part of Firestore the games registry uses
 * (documents by id, and transactions that read before they write), for
 * Jest:
 *
 *     jest.mock("@utils/firebaseAdmin", () =>
 *         require("./memoryFirestore.jest").memoryFirebaseAdmin()
 *     );
 */
export const memoryDocs = new Map<string, Record<string, any>>();

const snapshot = (path: string) => ({
    exists: memoryDocs.has(path),
    data: () => memoryDocs.get(path),
});
const doc = (path: string) => ({
    path,
    get: async () => snapshot(path),
    set: async (data: Record<string, any>) => void memoryDocs.set(path, data),
});

export function memoryFirebaseAdmin() {
    return {
        db: {
            collection: (name: string) => ({
                doc: (id: string) => doc(`${name}/${id}`),
            }),
            runTransaction: async (run: (tx: any) => Promise<unknown>) => {
                const writes: Array<() => void> = [];
                const result = await run({
                    get: async (ref: { path: string }) => snapshot(ref.path),
                    set: (ref: { path: string }, data: Record<string, any>) =>
                        void writes.push(() => memoryDocs.set(ref.path, data)),
                    delete: (ref: { path: string }) =>
                        void writes.push(() => memoryDocs.delete(ref.path)),
                });
                // Nothing is written when the transaction throws.
                writes.forEach((write) => write());
                return result;
            },
        },
    };
}
