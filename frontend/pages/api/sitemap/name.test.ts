/** @jest-environment node */
jest.mock("@utils/firebaseAdmin", () => ({ db: {} }));
jest.mock("firebase-admin", () => ({
    firestore: { FieldPath: { documentId: () => "__name__" } },
}));

import { spaceEntries } from "./[name]";

/** A Firestore stand-in holding `ids` in one collection, read in id order. */
function fakeStore(docs: Record<string, any>, calls: any[]) {
    const ids = Object.keys(docs).sort();
    const query = (state: any) => ({
        select: () => query(state),
        orderBy: () => query(state),
        startAt: (v: string) => query({ ...state, startAt: v }),
        startAfter: (v: string) => query({ ...state, startAfter: v }),
        endBefore: (v: string) => query({ ...state, endBefore: v }),
        limit: (n: number) => query({ ...state, limit: n }),
        get: async () => {
            calls.push(state);
            const hits = ids
                .filter((id) => !state.startAt || id >= state.startAt)
                .filter((id) => !state.startAfter || id > state.startAfter)
                .filter((id) => !state.endBefore || id < state.endBefore)
                .slice(0, state.limit);
            return { docs: hits.map((id) => ({ id, data: () => docs[id] })) };
        },
    });
    return { collection: () => query({}) } as any;
}

const named = (link: string) => ({
    info: { customLink: link, headline: link },
});

test("a part lists only its own ids, page by page", async () => {
    const docs: Record<string, any> = {
        Aold: named("aaa"),
        Bnope: named("bbb"),
    };
    for (let i = 0; i < 2500; i++)
        docs[`B${String(i).padStart(5, "0")}`] = named(`b${i}`);
    docs.Cnext = named("ccc");
    const calls: any[] = [];
    const entries = await spaceEntries(
        "B",
        "https://www.oncyber.com",
        fakeStore(docs, calls)
    );
    expect(entries).toHaveLength(2501);
    expect(entries).toContainEqual({ loc: "https://www.oncyber.com/bbb" });
    expect(entries.map((e) => e.loc)).not.toContain(
        "https://www.oncyber.com/aaa"
    );
    expect(entries.map((e) => e.loc)).not.toContain(
        "https://www.oncyber.com/ccc"
    );
    expect(calls).toHaveLength(2);
    expect(calls[0]).toMatchObject({ startAt: "B", endBefore: "C" });
    expect(calls[1]).toMatchObject({ startAfter: "B01999", endBefore: "C" });
});

test("an unknown part is not served", async () => {
    expect(
        await spaceEntries("-", "https://www.oncyber.com", fakeStore({}, []))
    ).toBeNull();
});
