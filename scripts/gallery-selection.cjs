const fs = require("node:fs");

function readGallerySelection(file, project) {
    const manifest = JSON.parse(fs.readFileSync(file, "utf8"));
    if (manifest.projectId !== project)
        throw new Error("Gallery selection belongs to a different project");
    if (!Array.isArray(manifest.galleries) || !manifest.galleries.length)
        throw new Error("Gallery selection is empty");
    const ids = manifest.galleries.map((gallery) => gallery.id);
    if (ids.some((id) => typeof id !== "string" || !id || id.includes("/")))
        throw new Error("Gallery selection contains an invalid ID");
    if (new Set(ids).size !== ids.length)
        throw new Error("Gallery selection contains duplicate IDs");
    return ids;
}

function remainingSelection(ids, lastId) {
    if (!lastId) return ids;
    const offset = ids.indexOf(lastId);
    if (offset === -1)
        throw new Error("Checkpoint gallery is missing from the selection");
    return ids.slice(offset + 1);
}

module.exports = { readGallerySelection, remainingSelection };
