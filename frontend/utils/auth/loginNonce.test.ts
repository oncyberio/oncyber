import { openNonce, sealNonce, tezosLoginPayload } from "./loginNonce";

beforeAll(() => { process.env.SECRET_JWT_KEY = "test-secret"; });

test("a sealed nonce opens until it expires", () => {
    const sealed = sealNonce("hello (Session id: abc)", 1000);
    expect(openNonce(sealed, 2000)).toBe("hello (Session id: abc)");
    expect(openNonce(sealed, 1000 + 121_000)).toBeNull();
});

test("a client-chosen or edited nonce is rejected", () => {
    const sealed = sealNonce("hello", 1000);
    expect(openNonce("anything I like", 2000)).toBeNull();
    expect(openNonce(sealed.replace("hello", "other"), 2000)).toBeNull();
    expect(openNonce(undefined, 2000)).toBeNull();
});

test("tezos payload is a packed Micheline string", () => {
    expect(tezosLoginPayload("x")).toBe("050100000017" + Buffer.from("Tezos Signed Message: x").toString("hex"));
});
