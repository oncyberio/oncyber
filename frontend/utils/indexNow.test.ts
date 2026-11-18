/** @jest-environment node */
import {
    indexNowKey,
    indexNowRequest,
    INDEXNOW_ENDPOINT,
    notifyIndexNow,
} from "./indexNow";

const ORIGIN = "https://www.oncyber.com";
const KEY = "a1b2c3d4e5f60718";

describe("indexNowKey", () => {
    it("is off without a valid key", () => {
        expect(indexNowKey("")).toBeNull();
        expect(indexNowKey(undefined)).toBeNull();
        expect(indexNowKey("short")).toBeNull();
        expect(indexNowKey("has spaces in it")).toBeNull();
        expect(indexNowKey(` ${KEY} `)).toBe(KEY);
    });
});

describe("indexNowRequest", () => {
    it("names the site, where its key is, and each page once", () => {
        expect(
            indexNowRequest(
                ["/frahm-gallery", "/spaces/abc", "/frahm-gallery"],
                {
                    key: KEY,
                    origin: ORIGIN,
                }
            )
        ).toEqual({
            host: "www.oncyber.com",
            key: KEY,
            keyLocation: `${ORIGIN}/indexnow-key.txt`,
            urlList: [`${ORIGIN}/frahm-gallery`, `${ORIGIN}/spaces/abc`],
        });
    });

    it("sends nothing without a key or a page", () => {
        expect(
            indexNowRequest(["/a"], { key: null, origin: ORIGIN })
        ).toBeNull();
        expect(indexNowRequest([], { key: KEY, origin: ORIGIN })).toBeNull();
        expect(
            indexNowRequest(["https://elsewhere.example/a", null as any], {
                key: KEY,
                origin: ORIGIN,
            })
        ).toBeNull();
    });
});

describe("notifyIndexNow", () => {
    it("posts the notice", async () => {
        const send = jest.fn(async () => ({ ok: true })) as any;
        expect(
            await notifyIndexNow(["/frahm-gallery"], {
                send,
                key: KEY,
                origin: ORIGIN,
            })
        ).toBe(true);
        const [url, init] = send.mock.calls[0];
        expect(url).toBe(INDEXNOW_ENDPOINT);
        expect(init.method).toBe("POST");
        expect(JSON.parse(init.body).urlList).toEqual([
            `${ORIGIN}/frahm-gallery`,
        ]);
    });

    it("stays silent without a key, and never throws", async () => {
        const send = jest.fn(async () => {
            throw new Error("down");
        }) as any;
        expect(
            await notifyIndexNow(["/a"], { send, key: null, origin: ORIGIN })
        ).toBe(false);
        expect(send).not.toHaveBeenCalled();
        expect(
            await notifyIndexNow(["/a"], { send, key: KEY, origin: ORIGIN })
        ).toBe(false);
    });
});
