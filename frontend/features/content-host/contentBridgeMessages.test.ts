import { randomBytes } from "crypto";
import { readFileSync } from "fs";
import { resolve } from "path";
import { MessageChannel } from "worker_threads";
import {
    CONTENT_PROTOCOL,
    CONTENT_REQUEST_METHODS,
    createContentEvent,
    createContentReply,
} from "./contentBridgeMessages";
import {
    ContentMessageGate,
    contentRequestError,
    createContentInit,
} from "./protocol";

// The public SDK, exactly as worlds load it.
const SDK_PATH = resolve(__dirname, "../../public/oncyber-content.js");
const source = readFileSync(SDK_PATH, "utf8");
const PROTOCOL_LITERAL = /var PROTOCOL = (\{[\s\S]*?\n {4}\});/;
const HOST = "https://host.test";
// Shaped as createContentSession's, which needs the browser's crypto.
const newSession = () => randomBytes(24).toString("hex");

describe("the SDK's copy of the message names", () => {
    test("is the shared definition, value for value", () => {
        const copy = source.match(PROTOCOL_LITERAL);
        expect(copy).not.toBeNull();
        expect(JSON.parse(copy[1])).toEqual(CONTENT_PROTOCOL);
    });

    test("is the only place the SDK spells a name", () => {
        const rest = source.replace(PROTOCOL_LITERAL, "");
        const names = [
            CONTENT_PROTOCOL.tag,
            ...Object.values(CONTENT_PROTOCOL.kinds),
            ...Object.values(CONTENT_PROTOCOL.methods),
            ...Object.values(CONTENT_PROTOCOL.events),
        ];
        for (const name of names) {
            expect([name, rest.includes(`"${name}"`)]).toEqual([name, false]);
        }
    });
});

/** Runs the SDK in a stand-in for a world's frame, with Oncyber as parent. */
function loadSdk() {
    const sent: Array<{ data: any; origin: string; ports: any[] }> = [];
    const parent = {
        postMessage: (data: any, origin: string, ports: any[] = []) =>
            sent.push({ data, origin, ports }),
    };
    let receive: (event: any) => void;
    const frame: any = {
        parent,
        addEventListener: (type: string, listener: (event: any) => void) => {
            if (type === "message") receive = listener;
        },
    };
    const document = { currentScript: { dataset: { hostOrigin: HOST } } };
    // A browser global the test environment lacks; Node's behaves the same.
    new Function("window", "document", "MessageChannel", source)(
        frame,
        document,
        MessageChannel
    );
    const fromHost = (data: any, origin = HOST) =>
        receive({ source: parent, origin, data });
    return { sdk: frame.oncyberContent, sent, fromHost };
}

const settle = () => new Promise((done) => setTimeout(done, 0));

describe("the SDK and the host agree", () => {
    let world: ReturnType<typeof loadSdk>;
    let session: string;
    let gate: ContentMessageGate;
    const frame = {} as Window;
    // What the host makes of the last request the SDK sent.
    const hostReads = (index = world.sent.length - 1) =>
        gate.read(
            { source: frame, origin: "null", data: world.sent[index].data },
            frame
        );
    beforeEach(() => {
        world = loadSdk();
        session = newSession();
        gate = new ContentMessageGate(session);
        world.fromHost(createContentInit(session, ["wallet.connect"]));
    });

    test.each([
        ["ready", CONTENT_PROTOCOL.methods.ready],
        ["openMenu", CONTENT_PROTOCOL.methods.menu],
    ])(
        "%s sends a request the host accepts, and resolves with its answer",
        async (call, method) => {
            const answer = world.sdk[call]();
            const request = hostReads();
            expect(request).toEqual(
                expect.objectContaining({ kind: "request", session, method })
            );
            expect(world.sent.at(-1).origin).toBe(HOST);
            expect(contentRequestError(request)).toBeNull();
            world.fromHost(createContentReply(request, {}));
            await expect(answer).resolves.toEqual({});
        }
    );

    test("a refusal reaches the world as an error with the host's code", async () => {
        const answer = world.sdk.openMenu();
        world.fromHost(createContentReply(hostReads(), null, "NOT_ENTERED"));
        await expect(answer).rejects.toThrow("NOT_ENTERED");
    });

    test("a wallet address comes back only over the request's own port", async () => {
        const answer = world.sdk.requestWalletAddress();
        const request = hostReads();
        expect(request.method).toBe(CONTENT_PROTOCOL.methods.walletConnect);
        expect(contentRequestError(request)).toBeNull();
        const [port] = world.sent.at(-1).ports;
        // The same answer as a window message is not taken.
        const address = { address: "0xabc", chain: "ethereum" };
        world.fromHost(createContentReply(request, address));
        await settle();
        port.postMessage(createContentReply(request, address));
        await expect(answer).resolves.toEqual(address);
        port.close();
    });

    test("the SDK can send every request the host knows, and no other", async () => {
        const calls = ["ready", "openMenu", "requestWalletAddress"];
        const answers = calls.map((call) => world.sdk[call]());
        const methods = world.sent.map(({ data }) => data.method);
        expect([...methods].sort()).toEqual(
            [...CONTENT_REQUEST_METHODS].sort()
        );
        world.sent.forEach(({ ports }, index) => {
            const request = hostReads(index);
            world.fromHost(createContentReply(request, null, "TEST_DONE"));
            ports.forEach((port) => port.close());
        });
        await Promise.allSettled(answers);
    });

    describe("resume", () => {
        const resume = () =>
            createContentEvent(session, CONTENT_PROTOCOL.events.resume);

        test("reaches every onResume listener, until it is removed", () => {
            const first = jest.fn();
            const second = jest.fn();
            const stopFirst = world.sdk.onResume(first);
            world.sdk.onResume(second);
            world.fromHost(resume());
            expect(first).toHaveBeenCalledTimes(1);
            expect(second).toHaveBeenCalledTimes(1);
            stopFirst();
            world.fromHost(resume());
            expect(first).toHaveBeenCalledTimes(1);
            expect(second).toHaveBeenCalledTimes(2);
        });

        test("is ignored from another session, another origin or another sender", () => {
            const listener = jest.fn();
            world.sdk.onResume(listener);
            world.fromHost({ ...resume(), session: newSession() });
            world.fromHost(resume(), "https://elsewhere.test");
            world.fromHost(createContentEvent(session, "pause" as any));
            expect(listener).not.toHaveBeenCalled();
            // Before the host's init there is no session to match.
            const early = loadSdk();
            const waiting = jest.fn();
            early.sdk.onResume(waiting);
            early.fromHost(resume());
            expect(waiting).not.toHaveBeenCalled();
        });

        test("one listener that throws does not keep the others from hearing it", async () => {
            jest.useFakeTimers();
            try {
                const after = jest.fn();
                world.sdk.onResume(() => {
                    throw new Error("game bug");
                });
                world.sdk.onResume(after);
                world.fromHost(resume());
                expect(after).toHaveBeenCalledTimes(1);
                // Reported, not swallowed.
                expect(() => jest.runAllTimers()).toThrow("game bug");
            } finally {
                jest.useRealTimers();
            }
        });

        test("needs a function", () => {
            expect(() => world.sdk.onResume("resume")).toThrow(TypeError);
        });
    });

    test("every event the host can send has an SDK listener", () => {
        // Adding an event? Handle it in public/oncyber-content.js, give it an
        // on… method there, and test it above.
        expect(Object.values(CONTENT_PROTOCOL.events)).toEqual(["resume"]);
        expect(typeof world.sdk.onResume).toBe("function");
    });

    test("the API worlds already call is unchanged", () => {
        expect(Object.keys(world.sdk)).toEqual([
            "ready",
            "openMenu",
            "requestWalletAddress",
            "onResume",
        ]);
        expect(Object.isFrozen(world.sdk)).toBe(true);
    });
});
