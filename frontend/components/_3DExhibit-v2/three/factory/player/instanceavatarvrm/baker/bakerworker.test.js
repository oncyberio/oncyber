const mockQueueJob = jest.fn();
const mockPoolOptions = [];
const mockClips = [{ name: "idle" }];
const mockSource = { bytes: null, clips: mockClips };
jest.mock("@3loader", () => ({ sessionSignal: null }), { virtual: true });
jest.mock(
    "@3gl/utils/workerpool.js",
    () =>
        class {
            constructor(_source, _size, _debug, opts) {
                mockPoolOptions.push(opts);
            }
            queueJob(...args) {
                mockQueueJob(...args);
            }
        },
    { virtual: true }
);
jest.mock("./baker.worker.js", () => class {});
jest.mock("./animationData.js", () => ({
    loadBakerClipSource: jest.fn(async () => mockSource),
}));
jest.mock("@3constants", () => ({ IS_MOBILE: false }), { virtual: true });

const BakerWorker = require("./bakerworker").default;
const { loadBakerClipSource } = require("./animationData.js");
const workerInit = () => mockPoolOptions[0]();

const flush = async () => {
    for (let i = 0; i < 5; i++) await Promise.resolve();
};

beforeEach(() => mockQueueJob.mockClear());

test("importing the client loads no clips and starts no worker", () => {
    expect(loadBakerClipSource).not.toHaveBeenCalled();
    expect(mockPoolOptions).toHaveLength(1);
    expect(workerInit()).toEqual({
        message: { init: true, animation: null },
    });
});

test("the worker gets the bytes the page already downloaded", async () => {
    const bytes = new ArrayBuffer(8);
    void BakerWorker.prepare("https://example.com/avatar.vrm", bytes);
    await flush();
    expect(mockQueueJob.mock.calls[0][1]).toEqual({
        url: "https://example.com/avatar.vrm",
        bytes,
    });
    // Workers start with the clips, loaded before the first job (here the
    // JSON fallback: the decoded clips, cloned as before).
    expect(workerInit()).toEqual({
        message: { init: true, animation: mockClips },
    });
});

test("each new worker gets its own copy of the packed clips, by transfer", async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]).buffer;
    loadBakerClipSource.mockResolvedValueOnce({ bytes, clips: mockClips });
    void BakerWorker.prepare("https://example.com/avatar.vrm");
    await flush();
    const first = workerInit();
    const second = workerInit();
    expect(first.message).toEqual({
        init: true,
        clips: expect.any(ArrayBuffer),
    });
    expect(first.transfer).toEqual([first.message.clips]);
    expect(first.message.clips).not.toBe(bytes);
    expect(first.message.clips).not.toBe(second.message.clips);
    expect([...new Uint8Array(second.message.clips)]).toEqual([1, 2, 3, 4]);
    // The page keeps the original for workers started later.
    expect(bytes.byteLength).toBe(4);
});

test("without bytes the worker fetches the URL, as before", async () => {
    void BakerWorker.prepare("https://example.com/avatar.vrm");
    await flush();
    expect(mockQueueJob.mock.calls[0][1]).toEqual({
        url: "https://example.com/avatar.vrm",
    });
});
