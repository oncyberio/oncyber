import WorkerPool from "./workerpool";
class Worker {
    static live = 0;
    constructor() {
        Worker.live++;
        this.listeners = {};
    }
    postMessage() {}
    addEventListener(type, cb) {
        this.listeners[type] = cb;
    }
    removeEventListener(type) {
        delete this.listeners[type];
    }
    terminate() {
        Worker.live--;
    }
    complete() {
        this.listeners.message({ data: { image: "loaded" } });
    }
}
afterEach(() => {
    WorkerPool.disposeAll();
    expect(Worker.live).toBe(0);
});
test("20 cycles release queued jobs and workers, and lazily reopen", () => {
    const pool = new WorkerPool(Worker, 2);
    for (let i = 0; i < 20; i++) {
        const cb = jest.fn();
        pool.queueJob("", {}, cb, null);
        pool.queueJob("", {}, cb, null);
        pool.queueJob("", {}, cb, null);
        pool.pool[0].complete();
        expect(pool.jobs).toHaveLength(2);
        pool.dispose();
        expect(cb).toHaveBeenCalledTimes(3);
        expect(pool.jobs).toHaveLength(0);
        expect(Worker.live).toBe(0);
    }
});
test("abort replaces a busy worker so its late result cannot complete another job", () => {
    const pool = new WorkerPool(Worker, 1),
        c = new AbortController(),
        one = jest.fn(),
        two = jest.fn();
    pool.queueJob("", {}, one, null, c.signal);
    const old = pool.pool[0];
    pool.queueJob("", {}, two, null);
    c.abort();
    expect(old.listeners.message).toBeUndefined();
    expect(one).toHaveBeenCalledWith({ data: { error: true, cancel: true } });
    pool.pool[0].complete();
    expect(two).toHaveBeenCalledTimes(1);
});
test("init options are cloned as before, or built per worker with transfers", () => {
    const posted = [];
    class Recording extends Worker {
        postMessage(...args) {
            posted.push(args);
        }
    }
    new WorkerPool(Recording, 1, false, { wasm: 1 }).queueJob(
        "",
        {},
        jest.fn()
    );
    expect(posted.shift()).toEqual([{ init: true, wasm: 1 }]);
    const init = jest.fn(() => {
        const buffer = new ArrayBuffer(4);
        return { message: { init: true, buffer }, transfer: [buffer] };
    });
    const pool = new WorkerPool(Recording, 2, false, init);
    pool.queueJob("", { job: 1 }, jest.fn());
    pool.queueJob("", { job: 2 }, jest.fn());
    expect(init).toHaveBeenCalledTimes(2);
    const inits = posted.filter(([message]) => message.init);
    expect(inits).toHaveLength(2);
    for (const [message, transfer] of inits)
        expect(transfer).toEqual([message.buffer]);
    expect(inits[0][0].buffer).not.toBe(inits[1][0].buffer);
});
