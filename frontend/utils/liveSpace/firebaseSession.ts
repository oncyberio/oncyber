/**
 * Whether this browser has a Firebase sign-in saved, found without loading
 * Firebase's sign-in library (0.46 MB of source). A visitor with none is
 * signed out whether or not that library is there, so the live channels
 * (./firebase.ts) skip it for them. When it cannot be told, the answer is
 * yes: loading the library is always right, only heavier.
 */
const SAVED_USER = "firebase:authUser:";
const DATABASE = "firebaseLocalStorageDb";
const STORE = "firebaseLocalStorage";

function inStorage(storage: Storage | undefined) {
    if (!storage) return false;
    for (let i = 0; i < storage.length; i++)
        if (storage.key(i)?.startsWith(SAVED_USER)) return true;
    return false;
}

/** A browser's storage that never answers must not hold the channels up. */
export const SESSION_PROBE_MS = 1500;

export function hasFirebaseSession(
    win: Pick<Window, "localStorage" | "sessionStorage" | "indexedDB"> = window,
    waitMs = SESSION_PROBE_MS
): Promise<boolean> {
    // "It cannot be told" is yes, and so is "it did not say in time".
    return new Promise<boolean>((resolve) => {
        const timer = setTimeout(resolve, waitMs, true);
        void lookForSession(win).then((answer) => {
            clearTimeout(timer);
            resolve(answer);
        });
    });
}

async function lookForSession(
    win: Pick<Window, "localStorage" | "sessionStorage" | "indexedDB">
): Promise<boolean> {
    try {
        if (inStorage(win.localStorage) || inStorage(win.sessionStorage))
            return true;
        const idb = win.indexedDB;
        if (!idb) return false;
        // Opening a database that is not there would create it.
        if (typeof idb.databases !== "function") return true;
        const known = await idb.databases();
        if (!known.some((database) => database.name === DATABASE)) return false;
        return await new Promise<boolean>((resolve) => {
            const opening = idb.open(DATABASE);
            opening.onerror = () => resolve(true);
            opening.onblocked = () => resolve(true);
            opening.onsuccess = () => {
                const database = opening.result;
                const done = (answer: boolean) => {
                    database.close();
                    resolve(answer);
                };
                try {
                    if (!database.objectStoreNames.contains(STORE))
                        return done(false);
                    const keys = database
                        .transaction(STORE, "readonly")
                        .objectStore(STORE)
                        .getAllKeys();
                    keys.onerror = () => done(true);
                    keys.onsuccess = () =>
                        done(
                            keys.result.some((key) =>
                                String(key).startsWith(SAVED_USER)
                            )
                        );
                } catch {
                    done(true);
                }
            };
        });
    } catch {
        return true;
    }
}
