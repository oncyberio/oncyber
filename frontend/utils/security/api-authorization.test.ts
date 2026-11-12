/** @jest-environment node */
import destinationService from "../../pages/api/_v2/destinations";
import * as destinationWrites from "../../pages/api/_v2/destinations/writeOperations";
import { uploadVideoPreview } from "../../pages/api/_v2/asset/assetOperations";

const mockGet = jest.fn();
const mockUpdate = jest.fn();
const mockUpload = jest.fn();

jest.mock("@utils/rpc/server", () => ({
    proc: (options) => Object.assign(options.handler, { _RPC_OPTS: options }),
    api: (registry) => registry,
}));
jest.mock("@utils/firestore/destinations", () => ({}));
jest.mock("../../pages/api/_v2/destinations/deleteDestination", () => ({}), { virtual: true });
jest.mock("../../pages/api/_v2/destinations/getMarketplaceDestinations", () => ({}), { virtual: true });
jest.mock("../../pages/api/_v2/destinations/getDestinationBySlug", () => ({}), { virtual: true });
jest.mock("../../pages/api/_v2/destinations/readOperations", () => ({}), { virtual: true });
jest.mock("../../pages/api/_v2/destinations/uploadOperations", () => ({}), { virtual: true });
jest.mock("@utils/firebaseAdmin", () => ({
    db: {
        collection: () => ({
            doc: () => ({ get: (...args) => mockGet(...args), update: (...args) => mockUpdate(...args) }),
        }),
    },
}));
jest.mock("@env", () => ({ nodeEnv: {} }));
jest.mock("@utils/pinataUpload", () => ({
    MAX_MODEL_SIZE: 1024,
    MAX_IMAGE_SIZE: 512,
    uploadToPinata: (...args) => mockUpload(...args),
}));

const request = { exhibitId: "victim-exhibit", file: "data:video/mp4;base64,AA==", mode: "SQUARE" };

beforeEach(() => {
    mockGet.mockReset().mockResolvedValue({ exists: true, data: () => ({ owner: "owner", editors: ["editor"] }) });
    mockUpdate.mockReset().mockResolvedValue(undefined);
    mockUpload.mockReset().mockResolvedValue("https://assets.example/video");
});

test("public RPC does not expose arbitrary source-account destination transfer", () => {
    expect(Object.hasOwn(destinationService, "transferDestinationsToUser")).toBe(false);
    expect(Object.hasOwn(destinationWrites, "transferDestinationsToUser")).toBe(false);
});

test("signed-in non-editor cannot replace another exhibit's video or incur upload cost", async () => {
    expect((uploadVideoPreview as any)._RPC_OPTS.auth).toBe(true);
    await expect(uploadVideoPreview.call({ userId: "attacker" }, request)).rejects.toThrow("Not allowed");
    expect(mockUpload).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
});

test("nonexistent exhibit is rejected before uploading", async () => {
    mockGet.mockResolvedValue({ exists: false });
    await expect(uploadVideoPreview.call({ userId: "owner" }, request)).rejects.toThrow("Not allowed");
    expect(mockUpload).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
});

test.each(["OWNER", "EDITOR"])("authorized %s retains video-preview editing rights", async (userId) => {
    await expect(uploadVideoPreview.call({ userId }, request)).resolves.toMatchObject({ success: true });
    expect(mockUpload).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledWith({ "info.fVideoSquare": "https://assets.example/video" });
});
