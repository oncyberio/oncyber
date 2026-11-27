/**
 * An in-memory stand-in for the part of Firestore the games registry uses
 * (documents by id, one equality query, and transactions that read before
 * they write), for Jest:
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

/** `info.customLink` of a document's data. */
const field = (data: Record<string, any>, path: string) =>
    path.split(".").reduce((value, key) => value?.[key], data as any);

/** One equality query on a collection: what the registry asks of spaces. */
const query = (name: string, path: string, value: unknown) => {
    const found = {
        get: async () => {
            const docs = [...memoryDocs.entries()]
                .filter(
                    ([key, data]) =>
                        key.startsWith(`${name}/`) &&
                        field(data, path) === value
                )
                .map(([key, data]) => ({
                    id: key.slice(name.length + 1),
                    data: () => data,
                }));
            return { empty: !docs.length, docs };
        },
        select: () => found,
        limit: () => found,
    };
    return found;
};

export function memoryFirebaseAdmin() {
    return {
        db: {
            collection: (name: string) => ({
                doc: (id: string) => doc(`${name}/${id}`),
                where: (path: string, _equals: "==", value: unknown) =>
                    query(name, path, value),
            }),
            runTransaction: async (run: (tx: any) => Promise<unknown>) => {
                const writes: Array<() => void> = [];
                const result = await run({
                    // A document, or a query: both are read through it.
                    get: async (ref: { path?: string; get?: () => any }) =>
                        ref.path ? snapshot(ref.path) : ref.get(),
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
