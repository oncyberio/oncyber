import { DirectedFollows, visiblePresence } from "./follows";

function database() {
    const values = new Map<string, any>();
    const ref = (path: string) => ({ path, id: path.split("/").pop(), collection: (name: string) => collection(`${path}/${name}`) });
    const collection = (path: string) => ({ doc: (id: string) => ref(`${path}/${id}`), limit: () => ({ get: async () => ({ docs: [...values.entries()].filter(([key]) => key.startsWith(`${path}/`)).map(([key, value]) => ({ id: key.split("/").pop(), ref: ref(key), data: () => value })) }) }) });
    return { values, collection, batch: () => ({ set: (r: any, value: any) => values.set(r.path, value), delete: (r: any) => values.delete(r.path), commit: async () => {} }) };
}

test("following is one-way and can be removed after target account merge", async () => {
    const db = database();
    let merged = false;
    const service = new DirectedFollows(db, async id => merged && id === "old" ? "new" : id);
    await service.set("viewer", "old", true);
    expect(await service.list("viewer")).toEqual(["old"]);
    expect(await service.list("old")).toEqual([]);
    merged = true;
    expect(await service.list("viewer")).toEqual(["new"]);
    await service.set("viewer", "new", false);
    expect(await service.list("viewer")).toEqual([]);
    expect([...db.values.keys()].some(key => key.includes("exhibits") || key.includes("party"))).toBe(false);
});

test("presence suppresses private, unlisted, unpublished and gated worlds", () => {
    const presence = { experienceId: "e", worldId: "w", instanceId: "never-expose", token: "never-expose", expiresAt: 20, updatedAt: 1 };
    for (const exhibit of [{ visibility: "private" }, { visibility: "unlisted" }, { published: false }, { info: { private: true } }, { gating: { password: { password: "secret" } } }, { gating: { nftOwnership: [{}] } }, { gating: { whitelist: ["wallet"] } }]) {
        expect(visiblePresence(presence, exhibit, 10)).toBeNull();
    }
    expect(visiblePresence(presence, {}, 10)).toEqual({ experienceId: "e", worldId: "w", updatedAt: 1 });
    expect(visiblePresence(presence, {}, 20)).toBeNull();
    expect(visiblePresence({ ...presence, expiresAt: undefined }, {}, 10)).toBeNull();
});
