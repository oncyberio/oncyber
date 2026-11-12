import fs from "fs";
import path from "path";

/**
 * `public/anon-service-worker.js` answers Studio's local upload URLs from
 * Cache Storage and must leave every other request to the browser.
 */
const SOURCE = fs.readFileSync(
    path.join(__dirname, "../../public/anon-service-worker.js"),
    "utf8"
);
const UPLOAD = "https://oncyber.io/local-uploads/u1700000000";

function loadWorker() {
    const listeners: Record<string, (event: any) => unknown> = {};
    const stored = { body: "upload bytes" };
    const cache = { match: jest.fn(async () => stored) };
    const self = {
        addEventListener: (type: string, listener: (event: any) => unknown) =>
            (listeners[type] = listener),
        skipWaiting: jest.fn(),
        clients: { claim: jest.fn(async () => {}) },
    };
    const caches = { open: jest.fn(async () => cache) };
    const fetch = jest.fn();
    const console = { log: () => {} };
    new Function("self", "caches", "fetch", "console", SOURCE)(
        self,
        caches,
        fetch,
        console
    );
    const request = (url: string) => {
        const event = { request: { url }, respondWith: jest.fn() };
        listeners.fetch(event);
        return event;
    };
    return { listeners, self, cache, caches, fetch, stored, request };
}

test.each([
    "https://oncyber.io/spaces/panorama",
    "https://oncyber.io/_next/static/chunks/1111.aaaa.js",
    "https://oncyber.io/api/exhibits",
    "https://cdn.example/model.glb",
    "http://localhost:13000/local-uploads/u1",
])("leaves %s to the network", (url) => {
    const worker = loadWorker();
    const event = worker.request(url);
    expect(event.respondWith).not.toHaveBeenCalled();
    expect(worker.fetch).not.toHaveBeenCalled();
    expect(worker.caches.open).not.toHaveBeenCalled();
});

test("answers a local upload from the upload cache", async () => {
    const worker = loadWorker();
    const event = worker.request(UPLOAD);
    expect(event.respondWith).toHaveBeenCalledTimes(1);
    await expect(event.respondWith.mock.calls[0][0]).resolves.toBe(
        worker.stored
    );
    expect(worker.caches.open).toHaveBeenCalledWith("local-uploads");
    expect(worker.cache.match).toHaveBeenCalledWith(UPLOAD);
    expect(worker.fetch).not.toHaveBeenCalled();
});

test("a new copy takes over open tabs", () => {
    const worker = loadWorker();
    worker.listeners.install({});
    expect(worker.self.skipWaiting).toHaveBeenCalled();
    const waitUntil = jest.fn();
    worker.listeners.activate({ waitUntil });
    expect(worker.self.clients.claim).toHaveBeenCalled();
    expect(waitUntil).toHaveBeenCalled();
});
