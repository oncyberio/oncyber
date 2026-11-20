/** @jest-environment node */
import { createSignedUploadUrl, MAX_DIRECT_UPLOAD_SIZE } from "./pinataUpload";
import { createUploadUrl } from "../pages/api/_v2/uploader/createUploadUrl";

jest.mock("@utils/net/publicFetch", () => ({ publicFetch: jest.fn() }));

const SIGNED_URL =
    "https://uploads.pinata.cloud/v3/files/upload-id?X-Signature=signed";

let originalFetch: typeof fetch;
const oldKey = process.env.PINATA_JWT_KEY;

const pinataAnswers = (status: number, body: unknown) => {
    global.fetch = jest.fn(async () => ({
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
        text: async () => JSON.stringify(body),
    })) as any;
};

beforeEach(() => {
    originalFetch = global.fetch;
    process.env.PINATA_JWT_KEY = "server-key";
    pinataAnswers(200, { data: SIGNED_URL });
});

afterEach(() => {
    global.fetch = originalFetch;
    if (oldKey === undefined) delete process.env.PINATA_JWT_KEY;
    else process.env.PINATA_JWT_KEY = oldKey;
});

test("the server signs a short-lived, size-limited public upload URL", async () => {
    const before = Math.floor(Date.now() / 1000);

    await expect(createSignedUploadUrl()).resolves.toBe(SIGNED_URL);

    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe("https://uploads.pinata.cloud/v3/files/sign");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer server-key");

    const body = JSON.parse(init.body);
    expect(body).toMatchObject({
        network: "public",
        expires: 600,
        max_file_size: MAX_DIRECT_UPLOAD_SIZE,
        cid_version: "v0",
    });
    expect(body.date).toBeGreaterThanOrEqual(before);
    expect(body.date).toBeLessThanOrEqual(Math.floor(Date.now() / 1000));
});

test("with no key on the server it fails without calling Pinata", async () => {
    delete process.env.PINATA_JWT_KEY;

    await expect(createSignedUploadUrl()).rejects.toThrow(
        "PINATA_JWT_KEY is missing"
    );
    expect(global.fetch).not.toHaveBeenCalled();
});

test("a key Pinata refuses is reported", async () => {
    pinataAnswers(403, { error: "no access" });

    await expect(createSignedUploadUrl()).rejects.toThrow(
        "Pinata signed upload URL failed (403)"
    );
});

test.each([
    ["nothing", {}],
    ["another host", { data: "https://uploads.example/v3/files/x" }],
])("an answer with %s is not handed to the browser", async (_name, body) => {
    pinataAnswers(200, body);

    await expect(createSignedUploadUrl()).rejects.toThrow("no URL returned");
});

test("only signed-in visitors get an upload URL, never the key", async () => {
    expect((createUploadUrl as any)._RPC_OPTS.auth).toBe(true);

    const result = await (createUploadUrl as any).call(
        { userId: "visitor" },
        {}
    );

    expect(result).toEqual({
        url: SIGNED_URL,
        maxSize: MAX_DIRECT_UPLOAD_SIZE,
    });
    expect(JSON.stringify(result)).not.toContain("server-key");
});
