import fs from "fs";
import path from "path";

/**
 * The environment settings panel (gui/physics.js: TweakPane, react-color)
 * is for the uploader only. world3D.js is the world's engine chunk, so a
 * static import there would ship the panel to every visitor; nothing else
 * would notice if an edit brought it back, so this test does.
 */
const source = fs.readFileSync(path.join(__dirname, "world3D.js"), "utf8");

test("the world chunk does not import the settings panel statically", () => {
    expect(source).not.toMatch(/^\s*import[^(]*["']@3editgui\//m);
    expect(source).not.toMatch(/require\(\s*["']@3editgui\//);
});

test("the uploader loads the panel when it opens a space", () => {
    const call = source.indexOf('import("@3editgui/physics")');
    expect(call).toBeGreaterThan(-1);
    // It is reached only behind the uploader flag, and the space state
    // waits for it (it is pushed into the promises setState settles on).
    const before = source.slice(0, call);
    expect(before.lastIndexOf("if (UPLOADER_MODE)")).toBeGreaterThan(
        before.lastIndexOf("case APP_STATES.")
    );
    expect(before.slice(before.lastIndexOf("if (UPLOADER_MODE)"))).toMatch(
        /ps\.push\(\s*$/
    );
});
