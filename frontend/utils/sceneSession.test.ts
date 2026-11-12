import { createSceneSessionOwner } from "./sceneSession";
const deferred = () => {
    let resolve: () => void;
    const promise = new Promise<void>((r) => {
        resolve = r;
    });
    return { promise, resolve: () => resolve() };
};
const tick = async () => {
    for (let i = 0; i < 8; i++) await Promise.resolve();
};
test("rapid Back/Forward waits for loading and teardown; skips cancelled destinations", async () => {
    const owner = createSceneSessionOwner(),
        loading = deferred(),
        cleanup = deferred(),
        events = [];
    const first = owner.acquire(
        async (signal) => {
            events.push("start1");
            await loading.promise;
            if (!signal.aborted) events.push("late");
        },
        async () => {
            events.push("exit1");
            await cleanup.promise;
        }
    );
    await tick();
    const released = first.release();
    expect(first.release()).toBe(released);
    const second = owner.acquire(
        async () => {
            events.push("start2");
        },
        async () => {}
    );
    second.release();
    const third = owner.acquire(
        async () => {
            events.push("start3");
        },
        async () => {
            events.push("exit3");
        }
    );
    await tick();
    expect(events).toEqual(["start1"]);
    loading.resolve();
    await tick();
    expect(events).toEqual(["start1", "exit1"]);
    cleanup.resolve();
    await tick();
    expect(events).toEqual(["start1", "exit1", "start3"]);
    await third.release();
    expect(events.at(-1)).toBe("exit3");
});
test("20 sessions return resources to baseline without overlapping worlds", async () => {
    const owner = createSceneSessionOwner();
    let resources = 0;
    for (let cycle = 0; cycle < 20; cycle++) {
        const ready = deferred();
        const session = owner.acquire(
            async () => {
                expect(resources).toBe(0);
                resources += 5;
                ready.resolve();
            },
            async () => {
                await Promise.resolve();
                resources -= 5;
            }
        );
        await ready.promise;
        await session.release();
        expect(resources).toBe(0);
    }
});
test("failed startup still tears down and permits reopening", async () => {
    const owner = createSceneSessionOwner();
    let exited = 0;
    const failed = owner.acquire(
        async () => {
            throw Error("load failed");
        },
        async () => {
            exited++;
        }
    );
    await expect(failed.done).rejects.toThrow("load failed");
    expect(exited).toBe(1);
    const ready = deferred();
    const next = owner.acquire(
        async () => ready.resolve(),
        async () => {}
    );
    await ready.promise;
    await next.release();
});
