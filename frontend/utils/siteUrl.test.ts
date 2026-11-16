import { isSiteHost, sitePath, siteUrl, spaceUrl } from "./siteUrl";

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
