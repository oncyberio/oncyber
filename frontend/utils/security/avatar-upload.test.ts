/** @jest-environment node */
import { uploadAsset } from "../../pages/api/user/avatar";
import { publicFetch } from "@utils/net/publicFetch";
import { Blob as NodeBlob } from "buffer";

jest.mock("@utils/middlewares/authMiddleware", () => ({ auth: jest.fn() }));
jest.mock("@utils/firebaseAdmin", () => ({ db: {} }));
jest.mock("@utils/firestore/userProfiles", () => ({ invalidateUserProfile: jest.fn() }));
jest.mock("@utils/net/publicFetch", () => ({ publicFetch: jest.fn() }));
jest.mock("@utils/factory/httpPinata", () => ({ uploadFile: jest.fn(async () => ({ IpfsHash: "test-cid" })) }));

let originalFetch: typeof fetch;
let originalFormData: typeof FormData;
let originalBlob: typeof Blob;
beforeEach(() => {
    originalFetch = global.fetch;
    originalFormData = global.FormData;
    originalBlob = global.Blob;
    // Jest's older Node environment does not expose the Web API globals.
    global.Blob = NodeBlob as any;
    global.FormData = class { append() {} } as any;
    global.fetch = jest.fn(async () => ({
        ok: true,
        blob: async () => new NodeBlob(["image"]),
        json: async () => ({ IpfsHash: "test-cid" }),
    })) as any;
    (publicFetch as jest.Mock).mockReset();
    jest.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
    global.fetch = originalFetch;
    global.FormData = originalFormData;
    global.Blob = originalBlob;
    jest.restoreAllMocks();
});

test("a blocked private avatar URL cannot reach Pinata or use unrestricted fetch", async () => {
    (publicFetch as jest.Mock).mockRejectedValue(new Error("Address not allowed"));
    await expect(uploadAsset("user", "https://127.0.0.1/internal", "contract", "1")).rejects.toThrow("Address not allowed");
    expect(publicFetch).toHaveBeenCalledWith("https://127.0.0.1/internal", {
        maxBytes: 10 * 1024 * 1024,
        maxRedirects: 0,
    });
    expect(global.fetch).not.toHaveBeenCalled();
});

test.each(["file:///etc/passwd", "ftp://127.0.0.1/file", "http://127.0.0.1/internal"])("unsupported avatar source %s is rejected before fetching", async (source) => {
    await expect(uploadAsset("user", source, "contract", "1")).rejects.toThrow("Unsupported upload source");
    expect(publicFetch).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
});

test("a valid public avatar passes the bounded fetch and preserves the returned avatar URL", async () => {
    (publicFetch as jest.Mock).mockResolvedValue({ status: 200, body: Buffer.from("image") });
    const result = await uploadAsset("user", "https://assets.example/avatar.jpg", "contract", "1");
    expect(publicFetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith("https://api.pinata.cloud/pinning/pinFileToIPFS", expect.objectContaining({ method: "POST" }));
    expect(result).toMatch(/^https:\/\/cyber\.mypinata\.cloud\/ipfs\/test-cid\?img-width=256&filename=contract\/1\/\d+\.jpg$/);
});
