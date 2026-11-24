/** @jest-environment node */
import { readdirSync } from "fs";
import { join } from "path";
import { APP_PATHS, PAGE_REDIRECTS, isReservedLink } from "./reservedLinks";

describe("reserved custom links", () => {
    it("covers every top-level page, so no space link is shadowed by one", () => {
        const root = join(__dirname, "../pages");
        const pages = readdirSync(root, { withFileTypes: true })
            // A nested route like /awe/[id] can coexist with a space at /awe.
            .filter((entry) =>
                entry.isDirectory()
                    ? readdirSync(join(root, entry.name)).some((child) =>
                          /^(?:index|\[\[\.\.\.[^/]+\]\])\.(tsx?|jsx?)$/.test(
                              child
                          )
                      )
                    : /\.(tsx?|jsx?)$/.test(entry.name)
            )
            .map(({ name }) => name.replace(/\.(tsx?|jsx?)$/, ""))
            .filter((name) => !name.startsWith("_") && !name.startsWith("["))
            .filter((name) => name !== "index");
        for (const page of pages)
            expect([page, isReservedLink(page)]).toEqual([page, true]);
    });

    it("covers the redirected addresses", () => {
        for (const from of Object.keys(PAGE_REDIRECTS))
            expect(isReservedLink(from)).toBe(true);
        expect(APP_PATHS).toContain("exhibits");
        // Rewritten to the sitemap index before any space link is read.
        expect(isReservedLink("sitemap.xml")).toBe(true);
    });

    it("ignores case and surrounding spaces, and leaves other names free", () => {
        expect(isReservedLink(" Studio ")).toBe(true);
        expect(isReservedLink("starrynight")).toBe(false);
        expect(isReservedLink("awe")).toBe(false);
        expect(isReservedLink("studio-gallery")).toBe(false);
        expect(isReservedLink(null as any)).toBe(false);
    });
});

describe("page redirects", () => {
    it("are served permanently by next.config.js", async () => {
        let config: any;
        jest.isolateModules(() => {
            config = require("../next.config.js");
        });
        const redirects = await config.redirects();
        for (const [from, to] of Object.entries(PAGE_REDIRECTS))
            expect(redirects).toContainEqual({
                source: `/${from}`,
                destination: to,
                permanent: true,
            });
    });
});
