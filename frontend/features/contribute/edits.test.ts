import { applyEdits, changedPaths, isSafePath, lineDiff } from "./edits";

describe("contributor edits", () => {
    it("replaces a snippet that matches once", () => {
        const result = applyEdits({ "a.ts": "one two three" }, [
            { path: "a.ts", find: "two", replace: "2" },
        ]);
        expect(result).toEqual({ files: { "a.ts": "one 2 three" } });
    });

    it("chains edits on the same file", () => {
        const result = applyEdits({ "a.ts": "a b" }, [
            { path: "a.ts", find: "a", replace: "x" },
            { path: "a.ts", find: "x b", replace: "done" },
        ]);
        expect(result).toEqual({ files: { "a.ts": "done" } });
    });

    it("refuses ambiguous, missing and unread snippets", () => {
        expect(
            applyEdits({ "a.ts": "a a" }, [
                { path: "a.ts", find: "a", replace: "b" },
            ])
        ).toEqual({ error: expect.stringContaining("matched 2 times") });
        expect(
            applyEdits({ "a.ts": "a" }, [
                { path: "a.ts", find: "z", replace: "b" },
            ])
        ).toEqual({ error: expect.stringContaining("matched 0 times") });
        expect(
            applyEdits({}, [{ path: "b.ts", find: "a", replace: "b" }])
        ).toEqual({ error: expect.stringContaining("read the file") });
    });

    it("creates a new file from an empty find", () => {
        expect(
            applyEdits({ "n.ts": null }, [
                { path: "n.ts", find: "", replace: "new" },
            ])
        ).toEqual({ files: { "n.ts": "new" } });
    });

    it("keeps writes inside the repository and out of workflows", () => {
        expect(isSafePath("frontend/pages/index.tsx")).toBe(true);
        expect(isSafePath("../etc/passwd")).toBe(false);
        expect(isSafePath("/abs")).toBe(false);
        expect(isSafePath("a//b")).toBe(false);
        expect(isSafePath(".github/workflows/ci.yml")).toBe(false);
        expect(
            applyEdits({ ".github/x": "a" }, [
                { path: ".github/x", find: "a", replace: "b" },
            ])
        ).toEqual({ error: expect.stringContaining("can't be changed") });
    });

    it("lists changed files and diffs them", () => {
        expect(
            changedPaths({
                original: { a: "1", b: "2" },
                files: { a: "1", b: "3" },
            })
        ).toEqual(["b"]);
        expect(lineDiff("x\ny\nz", "x\nY\nz")).toBe("  x\n- y\n+ Y\n  z");
    });
});
