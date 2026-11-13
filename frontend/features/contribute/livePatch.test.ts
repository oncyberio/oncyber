/** @jest-environment jsdom */
import {
    applyLivePatches,
    CONTRIBUTOR_ROOT,
    describeElement,
    sanitizePatch,
} from "./livePatch";

describe("live patches", () => {
    beforeEach(() => {
        document.head.innerHTML = "";
        document.body.innerHTML = `
            <h1 class="title" title="old">Hello</h1>
            <div ${CONTRIBUTOR_ROOT}="sidebar"><h1 class="title">Sidebar</h1></div>`;
    });

    it("applies CSS and DOM operations, then restores the page", () => {
        const revert = applyLivePatches([
            {
                css: "h1 { color: red }",
                ops: [
                    {
                        selector: "h1.title",
                        text: "Hi",
                        style: { fontSize: "40px" },
                    },
                    { selector: "h1.title", attr: "title", value: "new" },
                ],
            },
        ]);
        const title = document.querySelector("h1");
        expect(title.textContent).toBe("Hi");
        expect(title.style.getPropertyValue("font-size")).toBe("40px");
        expect(title.getAttribute("title")).toBe("new");
        expect(document.head.querySelector("style").textContent).toContain(
            "red"
        );
        // The contributor's own UI is never patched.
        expect(
            document.querySelector(`[${CONTRIBUTOR_ROOT}] h1`).textContent
        ).toBe("Sidebar");

        revert();
        expect(title.textContent).toBe("Hello");
        expect(title.style.getPropertyValue("font-size")).toBe("");
        expect(title.getAttribute("title")).toBe("old");
        expect(document.head.querySelector("style")).toBeNull();
    });

    it("drops anything that could run script", () => {
        const clean = sanitizePatch({
            css: "@import url(https://x.test/a.css); a { b: c }",
            ops: [
                { selector: "a", attr: "href", value: "javascript:alert(1)" },
                { selector: "a", attr: "onclick", value: "alert(1)" },
                { selector: "a", style: { background: "javascript:x" } },
                { selector: "a", html: "<img onerror=x>" },
            ],
        });
        expect(clean.css).not.toContain("@import");
        for (const op of clean.ops) {
            expect(op.attr).toBeUndefined();
            expect(op).not.toHaveProperty("html");
            expect(op.style || {}).toEqual({});
        }
    });

    it("ignores invalid selectors", () => {
        const revert = applyLivePatches([
            { ops: [{ selector: "<<", text: "x" }] },
        ]);
        expect(document.querySelector("h1").textContent).toBe("Hello");
        revert();
    });

    it("describes an element without build hashes", () => {
        document.body.innerHTML = `<main><p class="sc-abc kHjzZx intro">Hi</p></main>`;
        const info = describeElement(document.querySelector("p"));
        expect(info.selector).toBe("html > body > main > p.intro");
        expect(info.text).toBe("Hi");
    });
});
