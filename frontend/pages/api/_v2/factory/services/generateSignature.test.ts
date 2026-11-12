/** @jest-environment node */
import { generateSignature } from "./generateSignature";
import { getDestinationById } from "@utils/saveToDb";
import { signCreateDropRequest } from "@utils/factory/sign";

jest.mock("@utils/rpc/server", () => ({
    NoApi: jest.fn(),
    proc: (options) => Object.assign(options.handler, { _RPC_OPTS: options }),
}));
jest.mock("config/index", () => ({ __esModule: true, default: {} }), {
    virtual: true,
});
jest.mock("@utils/saveToDb", () => ({ getDestinationById: jest.fn() }));
jest.mock("@utils/factory/pinata", () => ({
    __esModule: true,
    default: { uploadMetadata: jest.fn() },
}));
jest.mock("@utils/factory/address", () => ({
    getAddressCatch: (id) => id,
}));
jest.mock("@utils/factory/sign", () => ({ signCreateDropRequest: jest.fn() }));
jest.mock("@ethersproject/wallet", () => ({ Wallet: jest.fn() }));

const read = getDestinationById as jest.Mock;
const sign = signCreateDropRequest as jest.Mock;

beforeEach(() => {
    jest.clearAllMocks();
    read.mockResolvedValue({
        success: true,
        data: { userId: "0xowner", status: "verified", name: "Drop" },
    });
});

test.each([
    ["another account", "0xmallory"],
    ["nobody", undefined],
])("a drop signature for %s is refused", async (_name, userId) => {
    await expect(
        generateSignature.call({ userId } as any, {
            destinationId: "dest-1",
            nonce: "1",
        })
    ).rejects.toThrow("incorrect user");
    expect(sign).not.toHaveBeenCalled();
});

test("the owner passes the owner check", async () => {
    // The owner's request goes on to the form checks, which this minimal
    // destination fails: proof that the owner check let it through.
    await expect(
        generateSignature.call({ userId: "0xowner" } as any, {
            destinationId: "dest-1",
            nonce: "1",
        })
    ).rejects.toThrow("Invalid request data");
});
