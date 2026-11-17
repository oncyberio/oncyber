import {
    isSiteHost,
    searchOrigin,
    searchUrl,
    sitePath,
    siteUrl,
    spacePath,
    spaceUrl,
} from "./siteUrl";

describe("searchOrigin", () => {
    it("is the site's own origin unless one is set", () => {
        expect(searchOrigin(undefined)).toBe("https://www.oncyber.com");
        expect(searchOrigin("  ")).toBe("https://www.oncyber.com");
        expect(searchUrl("/hub")).toBe("https://www.oncyber.com/hub");
    });

    it("uses the domain search results should keep showing", () => {
        expect(searchOrigin("https://oncyber.io/")).toBe("https://oncyber.io");
        expect(searchOrigin("https://oncyber.io/some/path")).toBe(
            "https://oncyber.io"
        );
    });

    it("ignores a value that is not a web address", () => {
        expect(searchOrigin("oncyber.io")).toBe("https://www.oncyber.com");
        expect(searchOrigin("javascript:alert(1)")).toBe(
            "https://www.oncyber.com"
        );
    });

    it("gives a space's path by custom link, else by id", () => {
        expect(spacePath({ id: "abc", info: { customLink: "hub" } })).toBe(
            "/hub"
        );
        expect(spacePath({ id: "abc" })).toBe("/spaces/abc");
    });
});

describe("siteUrl", () => {
    it("builds links on the site's origin", () => {
        // NEXT_PUBLIC_SITE_ORIGIN is unset under Jest: the production default.
        expect(siteUrl("/starrynight")).toBe(
            "https://www.oncyber.com/starrynight"
        );
        expect(siteUrl("@rayan")).toBe("https://www.oncyber.com/@rayan");
    });

    it("links a space by its custom link, else by id", () => {
        expect(spaceUrl({ id: "abc", info: { customLink: "hub" } })).toBe(
            "https://www.oncyber.com/hub"
        );
        expect(spaceUrl({ id: "abc", info: {} })).toBe(
            "https://www.oncyber.com/spaces/abc"
        );
    });
});

describe("sitePath", () => {
    it.each([
        ["https://www.oncyber.com/hub", "/hub"],
        ["https://oncyber.com/hub?coords=1x2x3x4", "/hub?coords=1x2x3x4"],
        ["https://oncyber.io/spaces/abc", "/spaces/abc"],
        ["http://www.oncyber.io/@rayan", "/@rayan"],
        ["oncyber.com/hub", "/hub"],
        ["  https://WWW.ONCYBER.COM/hub  ", "/hub"],
    ])("reads %s as %s", (link, path) => {
        expect(sitePath(link)).toBe(path);
    });

    it.each([
        "https://evil.example/hub",
        "https://oncyber.com.evil.example/hub",
        "https://notoncyber.com/hub",
        "",
        "not a url at all",
    ])("refuses %s", (link) => {
        expect(sitePath(link)).toBeNull();
    });

    it("knows every domain the site has used", () => {
        for (const host of [
            "oncyber.com",
            "www.oncyber.com",
            "oncyber.io",
            "www.oncyber.io",
        ])
            expect(isSiteHost(host)).toBe(true);
        expect(isSiteHost("oncyber.io.evil.example")).toBe(false);
    });
});
