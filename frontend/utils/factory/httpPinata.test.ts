/** @jest-environment node */
import { uploadFile } from "./httpPinata";

const mockCreateUploadUrl = jest.fn();

jest.mock("@api/uploader/_api", () => ({
    __esModule: true,
    default: { createUploadUrl: (...args) => mockCreateUploadUrl(...args) },
}));

const SIGNED_URL =
    "https://uploads.pinata.cloud/v3/files/upload-id?X-Signature=signed";

const appended: Array<[string, unknown]> = [];
let originalFetch: typeof fetch;
let originalFormData: typeof FormData;

const pinataAnswers = (status: number, body: unknown) => {
    global.fetch = jest.fn(async () => ({
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
    })) as any;
};

beforeEach(() => {
    originalFetch = global.fetch;
    originalFormData = global.FormData;
    appended.length = 0;
    global.FormData = class {
        append(name: string, value: unknown) {
            appended.push([name, value]);
        }
    } as any;
    mockCreateUploadUrl
        .mockReset()
        .mockResolvedValue({ url: SIGNED_URL, maxSize: 1024 });
    pinataAnswers(200, { data: { cid: "QmUploaded" } });
});

afterEach(() => {
    global.fetch = originalFetch;
    global.FormData = originalFormData;
});

const file = (size = 10) => ({ size } as Blob);

test("the file goes to the signed URL, with no key from the page", async () => {
    const upload = file();

    await expect(uploadFile(upload)).resolves.toEqual({
        IpfsHash: "QmUploaded",
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe(SIGNED_URL);
    expect(init.method).toBe("POST");
    expect(init.headers).toBeUndefined();
    expect(appended).toEqual([
        ["file", upload],
        ["network", "public"],
    ]);
});

test("a visitor who can't get an upload URL sends nothing to Pinata", async () => {
    mockCreateUploadUrl.mockRejectedValue(new Error("Unauthorized"));

    await expect(uploadFile(file())).rejects.toThrow("Unauthorized");
    expect(global.fetch).not.toHaveBeenCalled();
});

test("a file over the limit is refused before it is sent", async () => {
    mockCreateUploadUrl.mockResolvedValue({
        url: SIGNED_URL,
        maxSize: 5 * 1024 * 1024,
    });

    await expect(uploadFile(file(5 * 1024 * 1024 + 1))).rejects.toThrow(
        "The limit is 5 MB"
    );
    expect(global.fetch).not.toHaveBeenCalled();
});

test.each([
    ["Pinata refuses the upload", 401, { error: "expired" }],
    ["the answer has no CID", 200, { data: {} }],
    ["the answer is not JSON", 502, null],
])("it fails when %s", async (_name, status, body) => {
    pinataAnswers(status, body);

    await expect(uploadFile(file())).rejects.toThrow(
        `Pinata upload failed (${status})`
    );
});
