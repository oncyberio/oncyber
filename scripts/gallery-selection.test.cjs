const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { readGallerySelection, remainingSelection } = require("./gallery-selection.cjs");

test("frozen ranking preserves order and resumes without skipping or repeating IDs", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gallery-selection-"));
    const file = path.join(dir, "manifest.json");
    try {
        fs.writeFileSync(file, JSON.stringify({ projectId: "project", galleries: [{id:"z"},{id:"a"},{id:"m"}] }));
        const ids = readGallerySelection(file, "project");
        assert.deepEqual(ids, ["z", "a", "m"]);
        assert.deepEqual(remainingSelection(ids, "a"), ["m"]);
        assert.deepEqual(remainingSelection(ids, "m"), []);
        assert.throws(() => readGallerySelection(file, "another"), /different project/);
        assert.throws(() => remainingSelection(ids, "unknown"), /missing/);
        fs.writeFileSync(file, JSON.stringify({projectId:"project", galleries:[{id:"a"},{id:"a"}]}));
        assert.throws(() => readGallerySelection(file, "project"), /duplicate/);
        fs.writeFileSync(file, JSON.stringify({projectId:"project", galleries:[{id:"a/b"}]}));
        assert.throws(() => readGallerySelection(file, "project"), /invalid/);
    } finally { fs.rmSync(dir, {recursive: true, force:true}); }
});
