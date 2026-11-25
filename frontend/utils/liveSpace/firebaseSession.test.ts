import { hasFirebaseSession } from "./firebaseSession";

function storage(keys: string[] = []) {
    return { length: keys.length, key: (i: number) => keys[i] ?? null } as any;
}

/** An IndexedDB with the given databases; `saved` are Firebase's keys. */
function indexedDb({
    names = [] as string[],
    saved = [] as string[],
    store = true,
    listable = true,
    broken = false,
} = {}) {
    const opened: string[] = [];
    return {
        opened,
        idb: {
            ...(listable
                ? { databases: async () => names.map((name) => ({ name })) }
                : {}),
            open(name: string) {
                opened.push(name);
                const request: any = {};
                setTimeout(() => {
                    if (broken) return request.onerror();
                    request.result = {
                        close() {},
                        objectStoreNames: { contains: () => store },
                        transaction: () => ({
                            objectStore: () => ({
                                getAllKeys() {
                                    const keys: any = {};
                                    setTimeout(() => {
                                        keys.result = saved;
                                        keys.onsuccess();
                                    });
                                    return keys;
                                },
                            }),
                        }),
                    };
                    request.onsuccess();
                });
                return request;
            },
        } as any,
    };
}

const browser = (parts: any) => ({
    localStorage: storage(),
    sessionStorage: storage(),
    indexedDB: undefined as any,
    ...parts,
});

describe("is a Firebase sign-in saved in this browser", () => {
    test("no: nothing in storage and no database of Firebase's", async () => {
        const { idb, opened } = indexedDb({ names: ["something-else"] });
        expect(await hasFirebaseSession(browser({ indexedDB: idb }))).toBe(
            false
        );
        // and looking did not create one
        expect(opened).toEqual([]);
    });

    test("no: Firebase's database is there and holds no user", async () => {
        const { idb } = indexedDb({
            names: ["firebaseLocalStorageDb"],
            saved: ["firebase:host:example"],
        });
        expect(await hasFirebaseSession(browser({ indexedDB: idb }))).toBe(
            false
        );
    });

    test("yes: a user saved in the database, or in either storage", async () => {
        const { idb } = indexedDb({
            names: ["firebaseLocalStorageDb"],
            saved: ["firebase:authUser:key:[DEFAULT]"],
        });
        expect(await hasFirebaseSession(browser({ indexedDB: idb }))).toBe(
            true
        );
        expect(
            await hasFirebaseSession(
                browser({
                    localStorage: storage(["firebase:authUser:k:[DEFAULT]"]),
                })
            )
        ).toBe(true);
        expect(
            await hasFirebaseSession(
                browser({ sessionStorage: storage(["firebase:authUser:k:x"]) })
            )
        ).toBe(true);
    });

    test("yes whenever it cannot be told", async () => {
        // a browser that cannot list databases
        expect(
            await hasFirebaseSession(
                browser({ indexedDB: indexedDb({ listable: false }).idb })
            )
        ).toBe(true);
        // a database that will not open
        expect(
            await hasFirebaseSession(
                browser({
                    indexedDB: indexedDb({
                        names: ["firebaseLocalStorageDb"],
                        broken: true,
                    }).idb,
                })
            )
        ).toBe(true);
        // storage that throws (blocked by the browser)
        expect(
            await hasFirebaseSession({
                get localStorage(): any {
                    throw new Error("blocked");
                },
            } as any)
        ).toBe(true);
    });
});
