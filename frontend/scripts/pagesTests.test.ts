import fs from "fs";
import path from "path";

/**
 * Every file under pages/ is built as a route, tests included, and a build
 * writes the value of a NEXT_PUBLIC_ variable in place of its name wherever
 * it is read. A test there that assigns to one by name (`env.NEXT_PUBLIC_X
 * = "1"`) therefore compiles to `"1" = "1"` and the production build fails,
 * though the test itself passes. Name the variable in pieces instead.
 */
const PAGES = path.join(__dirname, "..", "pages");

function testFiles(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const file = path.join(dir, entry.name);
        if (entry.isDirectory()) return testFiles(file);
        return /\.test\.(ts|tsx|js)$/.test(entry.name) ? [file] : [];
    });
}

test("no test under pages/ assigns to a NEXT_PUBLIC_ variable by name", () => {
    const files = testFiles(PAGES);
    expect(files.length).toBeGreaterThan(10);
    const offenders = files.filter((file) =>
        /\.NEXT_PUBLIC_[A-Z0-9_]+\s*=(?!=)/.test(fs.readFileSync(file, "utf8"))
    );
    expect(offenders.map((file) => path.relative(PAGES, file))).toEqual([]);
});
