/** @jest-environment node */
import { getAssetsByHash } from "./getAssetsByHash";
import { checkUploadedAssets } from "./checkUploadedAssets";

jest.mock("@utils/rpc/server", () => ({
    NoApi: jest.fn(),
    proc: (options) => Object.assign(options.handler, { _RPC_OPTS: options }),
}));

const mockDoc = jest.fn((id: string) => {
    // Firestore refuses ids that make an invalid path, as it does live.
    if (id.includes("//")) throw new Error("Paths must not contain //.");
    return { get: async () => ({ exists: false, data: () => undefined }) };
});
jest.mock("@utils/firebaseAdmin", () => ({
    db: { collection: () => ({ doc: (id: string) => mockDoc(id) }) },
}));

beforeEach(() => mockDoc.mockClear());

test("a URL used as a hash finds nothing instead of failing", async () => {
    const url = "https://example.com/model.glb";
    await expect(
        (getAssetsByHash as any).call({}, { hash: url })
    ).resolves.toBeNull();
    await expect(
        (checkUploadedAssets as any).call(
            { userId: "0xabc" },
            { fileHash: url }
        )
    ).resolves.toBeNull();
    expect(mockDoc).not.toHaveBeenCalled();
});

test("a real hash is still looked up", async () => {
    await expect(
        (getAssetsByHash as any).call({}, { hash: "abc123" })
    ).resolves.toBeNull();
    expect(mockDoc).toHaveBeenCalledWith("abc123");
});
