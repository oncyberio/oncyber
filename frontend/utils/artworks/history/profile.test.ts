import { fetchOpenSeaProfileImage } from "./profile";
const originalFetch = global.fetch;
afterEach(() => {
    global.fetch = originalFetch;
});
test("visible duplicate accounts share one lookup", async () => {
    global.fetch = jest
        .fn()
        .mockResolvedValue({
            ok: true,
            json: async () => ({
                profile_image_url: "https://i2c.seadn.io/avatar.png",
            }),
        });
    const id = "0x" + "a".repeat(40);
    expect(
        await Promise.all([
            fetchOpenSeaProfileImage(id),
            fetchOpenSeaProfileImage(id.toUpperCase()),
        ])
    ).toEqual([
        "https://i2c.seadn.io/avatar.png",
        "https://i2c.seadn.io/avatar.png",
    ]);
    await fetchOpenSeaProfileImage(id);
    expect(global.fetch).toHaveBeenCalledTimes(1);
});
test("limits concurrent profile requests and drains the queue", async () => {
    const releases: Array<() => void> = [];
    global.fetch = jest.fn(
        () =>
            new Promise((resolve) =>
                releases.push(() =>
                    resolve({
                        ok: true,
                        json: async () => ({ profile_image_url: null }),
                    })
                )
            )
    ) as any;
    const requests = ["b", "c", "d", "e"].map((x) =>
        fetchOpenSeaProfileImage("0x" + x.repeat(40))
    );
    expect(global.fetch).toHaveBeenCalledTimes(3);
    releases.shift()();
    await requests[0];
    expect(global.fetch).toHaveBeenCalledTimes(4);
    releases.splice(0).forEach((release) => release());
    await Promise.all(requests);
});
test("failed profiles and unsupported addresses safely fall back", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("offline"));
    expect(await fetchOpenSeaProfileImage("0x" + "f".repeat(40))).toBeNull();
    expect(await fetchOpenSeaProfileImage("tz1-example")).toBeNull();
    expect(global.fetch).toHaveBeenCalledTimes(1);
});
