/** @jest-environment node */
import { uploadVideoPreview } from "./assetOperations";
import { uploadToPinata } from "@utils/pinataUpload";

const mockUpdate = jest.fn(async () => undefined);

jest.mock("@utils/rpc/server", () => ({
    NoApi: jest.fn(),
    proc: (options) => Object.assign(options.handler, { _RPC_OPTS: options }),
}));
jest.mock("@env", () => ({ nodeEnv: {} }));
jest.mock("@utils/pinataUpload", () => ({
    uploadToPinata: jest.fn(async () => "https://ipfs.example/video"),
    MAX_IMAGE_SIZE: 1,
    MAX_MODEL_SIZE: 1,
}));
jest.mock("@utils/firebaseAdmin", () => ({
    db: {
        collection: () => ({
            doc: () => ({
                get: async () => ({
                    exists: true,
                    data: () => ({ owner: "0xOwner", editors: ["0xeditor"] }),
                }),
                update: mockUpdate,
            }),
        }),
    },
}));

const upload = (userId?: string) =>
    uploadVideoPreview.call({ userId } as any, {
        exhibitId: "space-1",
        file: "data:video/mp4;base64,AAAA",
        mode: "SQUARE",
    });

beforeEach(() => jest.clearAllMocks());

test.each([
    ["a visitor", "0xvisitor"],
    ["nobody", undefined],
])("%s cannot set a space's preview video", async (_name, userId) => {
    await expect(upload(userId)).rejects.toThrow("Not allowed");
    expect(uploadToPinata).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
});

test.each([
    ["the owner", "0xowner"],
    ["an editor", "0xEditor"],
])("%s can set it", async (_name, userId) => {
    await expect(upload(userId)).resolves.toMatchObject({ success: true });
    expect(mockUpdate).toHaveBeenCalledWith({
        "info.fVideoSquare": "https://ipfs.example/video",
    });
});
