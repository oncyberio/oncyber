import {
    CONTENT_BRIDGE_TAG,
    ContentMessageGate,
    contentRequestError,
    createContentInit,
} from "./protocol";

describe("external content protocol", () => {
    const session = "unique-session";
    const frame = {} as Window;
    const request = (overrides = {}) => ({
        tag: CONTENT_BRIDGE_TAG,
        v: 1,
        kind: "request",
        session,
        id: "request-1",
        method: "wallet.connect",
        ...overrides,
    });
    const event = (data = request()) => ({
        source: frame,
        origin: "null",
        data,
    });

    it("accepts only the current opaque frame and handshake session", () => {
        const gate = new ContentMessageGate(session);
        expect(gate.read({ ...event(), source: {} as Window }, frame)).toBeNull();
        expect(gate.read({ ...event(), origin: "https://game.test" }, frame)).toBeNull();
        expect(gate.read(event(), null)).toBeNull();
        expect(gate.read(event(request({ session: "stale" })), frame)).toBeNull();
        expect(gate.read(event(), frame)).toEqual(request());
    });

    it("rejects replays and previous-document requests after navigation", () => {
        const first = new ContentMessageGate(session);
        expect(first.read(event(), frame)).not.toBeNull();
        expect(first.read(event(), frame)).toBeNull();
        const next = new ContentMessageGate("next-document");
        expect(next.read(event(), frame)).toBeNull();
        expect(
            next.read(event(request({ session: "next-document" })), frame)
        ).not.toBeNull();
    });

    it.each([
        { v: 2 },
        { kind: "result" },
        { tag: "other-bridge" },
        { id: "" },
        { id: "x".repeat(81) },
        { id: {} },
        { method: "x".repeat(81) },
        { method: {} },
    ])("rejects malformed envelopes %o", (override) => {
        expect(
            new ContentMessageGate(session).read(event(request(override)), frame)
        ).toBeNull();
    });

    it("bounds payload size and rejects structured-clone cycles", () => {
        const gate = new ContentMessageGate(session);
        expect(
            gate.read(event(request({ payload: "x".repeat(8192) })), frame)
        ).toBeNull();
        const cyclic: any = request();
        cyclic.payload = cyclic;
        expect(gate.read(event(cyclic), frame)).toBeNull();
    });

    it("rate-limits valid frame messages without permitting request replay", () => {
        let now = 0;
        const gate = new ContentMessageGate(session, () => now);
        for (let index = 0; index < 30; index++) {
            expect(
                gate.read(event(request({ id: `request-${index}` })), frame)
            ).not.toBeNull();
        }
        expect(
            gate.read(event(request({ id: "over-limit" })), frame)
        ).toBeNull();
        now = 10_000;
        expect(
            gate.read(event(request({ id: "over-limit" })), frame)
        ).not.toBeNull();
        expect(gate.read(event(), frame)).toBeNull();
    });

    it("provides explicit errors for every unsupported wallet method", () => {
        for (const method of [
            "eth_sendTransaction",
            "eth_sign",
            "personal_sign",
            "wallet.personal-sign",
            "wallet.request",
            "wallet_addEthereumChain",
        ]) {
            const parsed = new ContentMessageGate(session).read(
                event(request({ method })),
                frame
            );
            expect(parsed).not.toBeNull();
            expect(contentRequestError(parsed)).toBe("UNSUPPORTED_METHOD");
        }
    });

    it("does not let content supply a provider, account, chain or RPC params", () => {
        for (const payload of [
            { account: "0x123" },
            { provider: "metamask" },
            { method: "eth_sendTransaction", params: [] },
            [],
            "connect",
            new Map(),
            new ArrayBuffer(4),
        ]) {
            const parsed = new ContentMessageGate(session).read(
                event(request({ payload })),
                frame
            );
            expect(contentRequestError(parsed)).toBe("INVALID_PARAMS");
        }
        for (const payload of [undefined, null, {}]) {
            const parsed = new ContentMessageGate(session).read(
                event(request({ payload })),
                frame
            );
            expect(contentRequestError(parsed)).toBeNull();
        }
    });

    it("initializes without credentials or capabilities not granted by the host", () => {
        expect(createContentInit(session)).toEqual({
            tag: CONTENT_BRIDGE_TAG,
            v: 1,
            kind: "init",
            session,
            capabilities: [],
        });
        expect(createContentInit(session, ["wallet.connect"]).capabilities).toEqual([
            "wallet.connect",
        ]);
    });
});
