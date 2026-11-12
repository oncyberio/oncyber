/** @jest-environment jsdom */
const KEY = "oncyber:public-destination-catalog:v1";
const DAY = 24 * 60 * 60 * 1000;
const rooms = [{ _id: "warehouse", tag: ["free"] }];
let cachedDestinationCatalog: typeof import("./destinationCatalogCache").cachedDestinationCatalog;
beforeEach(() => {
    jest.resetModules();
    localStorage.clear();
    cachedDestinationCatalog =
        require("./destinationCatalogCache").cachedDestinationCatalog;
});
afterEach(() => jest.restoreAllMocks());
it("deduplicates cold loads and persists the public catalog across reloads", async () => {
    const load = jest.fn().mockResolvedValue(rooms);
    await Promise.all([
        cachedDestinationCatalog(load),
        cachedDestinationCatalog(load),
    ]);
    expect(load).toHaveBeenCalledTimes(1);
    jest.resetModules();
    const restored =
        require("./destinationCatalogCache").cachedDestinationCatalog;
    expect(await restored(load)).toEqual(rooms);
    expect(load).toHaveBeenCalledTimes(1);
});
it("returns stale rooms immediately while refreshing in the background", async () => {
    localStorage.setItem(
        KEY,
        JSON.stringify({ savedAt: Date.now() - 2 * DAY, destinations: rooms })
    );
    let resolve: (rooms: any[]) => void;
    const load = jest.fn(
        () =>
            new Promise<any[]>((done) => {
                resolve = done;
            })
    );
    expect(await cachedDestinationCatalog(load)).toEqual(rooms);
    const updated = [...rooms, { _id: "loft", tag: ["free"] }];
    resolve(updated);
    await new Promise((done) => setTimeout(done, 0));
    expect(await cachedDestinationCatalog(load)).toEqual(updated);
    expect(load).toHaveBeenCalledTimes(1);
});
it("keeps account-specific mutations out of memory and persisted data", async () => {
    const load = jest.fn().mockResolvedValue(rooms);
    const result = await cachedDestinationCatalog(load);
    result[0].tag.push("uploaded");
    expect(await cachedDestinationCatalog(load)).toEqual(rooms);
    expect(JSON.parse(localStorage.getItem(KEY)).destinations).toEqual(rooms);
});
it("keeps stale data on failure and avoids retrying on every render", async () => {
    localStorage.setItem(
        KEY,
        JSON.stringify({ savedAt: Date.now() - 2 * DAY, destinations: rooms })
    );
    const load = jest.fn().mockRejectedValue(new Error("offline"));
    expect(await cachedDestinationCatalog(load)).toEqual(rooms);
    await new Promise((done) => setTimeout(done, 0));
    expect(await cachedDestinationCatalog(load)).toEqual(rooms);
    expect(load).toHaveBeenCalledTimes(1);
});
it.each([
    "broken",
    JSON.stringify({ savedAt: Date.now() - 8 * DAY, destinations: rooms }),
])("ignores invalid or expired storage: %s", async (entry) => {
    localStorage.setItem(KEY, entry);
    const load = jest.fn().mockResolvedValue(rooms);
    expect(await cachedDestinationCatalog(load)).toEqual(rooms);
    expect(load).toHaveBeenCalledTimes(1);
});
