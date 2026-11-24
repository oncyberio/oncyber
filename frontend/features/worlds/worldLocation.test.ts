import { readWorldLocation, worldSpaceId } from "./worldLocation";

const site = "https://www.oncyber.com";
const read = (href: unknown) => readWorldLocation(href, site);

describe("readWorldLocation", () => {
    test("a space by id, with where the visitor stands", () => {
        expect(read("/spaces/Em8Sj1LhKXg3mOIeIp6K?coords=1x2x3x0")).toEqual({
            href: "/spaces/Em8Sj1LhKXg3mOIeIp6K?coords=1x2x3x0",
            pathname: "/spaces/Em8Sj1LhKXg3mOIeIp6K",
            space: { id: "Em8Sj1LhKXg3mOIeIp6K" },
        });
    });

    test("a space by its link", () => {
        expect(read("/starry-night?from=welcome&at=1x2x3x0").space).toEqual({
            link: "starry-night",
        });
        expect(read("/caf%C3%A9").space).toEqual({ link: "café" });
    });

    test.each([
        ["another site", "https://elsewhere.example/spaces/abc"],
        ["a protocol-relative address", "//elsewhere.example/spaces/abc"],
        ["a script", "javascript:alert(1)"],
        ["a profile", "/@ada"],
        ["the studio", "/studio"],
        ["the API", "/api"],
        ["a deeper page", "/spaces/abc/edit"],
        ["the home page", "/"],
        ["nothing", undefined],
    ])("%s is not a world's address", (_, href) => {
        expect(read(href)).toBeNull();
    });
});

describe("worldSpaceId", () => {
    test("an address by id needs no lookup", async () => {
        const request = jest.fn();
        expect(await worldSpaceId(read("/spaces/abc"), request)).toBe("abc");
        expect(request).not.toHaveBeenCalled();
    });

    test("an address by link is asked of the site", async () => {
        const request = jest.fn(async () => ({
            ok: true,
            json: async () => ({ exists: true, id: "abc" }),
        }));
        expect(await worldSpaceId(read("/starry night"), request as any)).toBe(
            "abc"
        );
        expect(request).toHaveBeenCalledWith(
            "/api/world-access?space=starry%20night"
        );
    });

    test("no such space, or a site that cannot say, is no id", async () => {
        const none = jest.fn(async () => ({
            ok: true,
            json: async () => ({ exists: false }),
        }));
        const down = jest.fn(async () => {
            throw new Error("offline");
        });
        expect(await worldSpaceId(read("/gone"), none as any)).toBeNull();
        expect(await worldSpaceId(read("/gone"), down as any)).toBeNull();
    });
});
