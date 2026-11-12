/** @jest-environment jsdom */

describe("local upload storage", () => {
    let worker;
    beforeEach(() => {
        jest.resetModules();
        worker = new EventTarget();
        worker.register = jest.fn().mockResolvedValue({});
        worker.ready = Promise.resolve({});
        worker.controller = null;
        Object.defineProperty(navigator, "serviceWorker", {
            configurable: true,
            value: worker,
        });
    });
    it("waits for page control before exposing cached upload URLs", async () => {
        const { ensureLocalUploads } = require("./ensureLocalUploads");
        let done = false;
        const ready = ensureLocalUploads().then(() => {
            done = true;
        });
        await Promise.resolve();
        await Promise.resolve();
        expect(done).toBe(false);
        worker.controller = {};
        worker.dispatchEvent(new Event("controllerchange"));
        await ready;
        expect(done).toBe(true);
        expect(worker.register).toHaveBeenCalledWith("/anon-service-worker.js");
    });
    it("shares initialization across concurrent library and upload requests", async () => {
        worker.controller = {};
        const { ensureLocalUploads } = require("./ensureLocalUploads");
        await Promise.all([ensureLocalUploads(), ensureLocalUploads()]);
        expect(worker.register).toHaveBeenCalledTimes(1);
    });
    it("allows retry after registration fails", async () => {
        worker.controller = {};
        worker.register.mockRejectedValueOnce(new Error("offline"));
        const { ensureLocalUploads } = require("./ensureLocalUploads");
        await expect(ensureLocalUploads()).rejects.toThrow("offline");
        await expect(ensureLocalUploads()).resolves.toBeUndefined();
    });
});
