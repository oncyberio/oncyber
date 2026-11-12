import { loadSceneAssets } from "./loadSceneAssets";

function deferred<T>() {
    let resolve: (value: T) => void;
    let reject: (reason: Error) => void;
    const promise = new Promise<T>((yes, no) => {
        resolve = yes;
        reject = no;
    });
    return { promise, resolve, reject };
}

test("world loading starts without waiting for the avatar", async () => {
    const player = deferred<string>();
    const space = deferred<string>();
    const loadPlayer = jest.fn(() => player.promise);
    const loadSpace = jest.fn(() => space.promise);
    const result = loadSceneAssets(loadPlayer, loadSpace);
    await Promise.resolve();
    expect(loadPlayer).toHaveBeenCalledTimes(1);
    expect(loadSpace).toHaveBeenCalledTimes(1);
    space.resolve("world");
    player.resolve("avatar");
    await expect(result).resolves.toEqual(["avatar", "world"]);
});

test.each(["player", "space"])(
    "%s failure waits for the other loader before allowing cleanup",
    async (failed) => {
        const player = deferred<string>();
        const space = deferred<string>();
        const cleanup = jest.fn();
        const error = Error("asset failed");
        const result = loadSceneAssets(() => player.promise, () => space.promise);
        const handled = result.catch(cleanup);
        const first = failed === "player" ? player : space;
        const second = failed === "player" ? space : player;
        first.reject(error);
        for (let i = 0; i < 10; i++) await Promise.resolve();
        expect(cleanup).not.toHaveBeenCalled();
        second.resolve("loaded");
        await handled;
        expect(cleanup).toHaveBeenCalledWith(error);
    }
);

test("a synchronous loader failure still settles the other loader", async () => {
    const error = Error("cannot start");
    const loadSpace = jest.fn(async () => "world");
    await expect(loadSceneAssets(() => { throw error; }, loadSpace)).rejects.toBe(error);
    expect(loadSpace).toHaveBeenCalledTimes(1);
});
