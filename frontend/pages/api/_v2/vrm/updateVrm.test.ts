/** @jest-environment node */
import { updateVrm } from "./updateVrm";

const mockUpdate = jest.fn(async () => undefined);
let mockStored: Record<string, any> | undefined;

jest.mock("@utils/rpc/server", () => ({
    NoApi: jest.fn(),
    proc: (options) => Object.assign(options.handler, { _RPC_OPTS: options }),
}));
jest.mock("@utils/firebaseAdmin", () => ({
    db: {
        collection: () => ({
            doc: () => ({
                get: async () => ({
                    exists: !!mockStored,
                    data: () => mockStored,
                }),
                update: mockUpdate,
            }),
        }),
    },
}));

const rename = (userId?: string) =>
    updateVrm.call({ userId } as any, { id: "vrm-1", name: "Mine now" });

beforeEach(() => {
    jest.clearAllMocks();
    mockStored = { userId: "0xowner", name: "Avatar" };
});

test.each([
    ["another account", "0xmallory"],
    ["nobody", undefined],
])("%s cannot rename someone's avatar", async (_name, userId) => {
    await expect(rename(userId)).rejects.toThrow("Failed to update vrm");
    expect(mockUpdate).not.toHaveBeenCalled();
});

test("an avatar that does not exist is refused", async () => {
    mockStored = undefined;
    await expect(rename("0xowner")).rejects.toThrow("Failed to update vrm");
    expect(mockUpdate).not.toHaveBeenCalled();
});

test("the uploader can rename their avatar", async () => {
    await rename("0xowner");
    expect(mockUpdate).toHaveBeenCalledWith({ name: "Mine now" });
});
