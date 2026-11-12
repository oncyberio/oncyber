import { readFileSync } from "fs";
import { join } from "path";
import { hasLegacyGalleryScriptWrite, isLegacyGalleryScriptPath } from "./legacyGalleryScripts";
import { SpaceScript } from "../components/_3DExhibit-v2/three/factory/script/spacescript";
import { ScriptContainer } from "../components/_3DExhibit-v2/three/factory/script/scriptcontainer";
import { getScripts, removeScripts, restoreScripts, duplicateScripts } from "../features/studio/services/editor/utils";
import ScriptEditor from "../features/studio/EditWorldMenu/AddAsset/shared/ScriptEditor";
import { ToggleScriptEditor } from "../features/studio/EditWorldMenu/AddAsset/EditAsset/EditArtwork/ToggleScriptEditor";

jest.mock("@utils/rpc/server", () => ({ proc: (opts) => Object.assign(opts.handler, { schema: opts.schema }), NoApi: () => {} }));
jest.mock("@utils/firebaseAdmin", () => ({ db: { runTransaction: jest.fn() } }));
jest.mock("firebase-admin", () => ({ firestore: { FieldPath: class { constructor(..._parts) {} } } }));
import { update, updateExhibit } from "../pages/api/_v2/exhibit/update";
import { getScript } from "../pages/api/_v2/ai/getScript";
import { db } from "@utils/firebaseAdmin";

const malicious = { games: { default: { scripts: { main: { type: "module", code: "globalThis.galleryScriptExecuted = true" }, artwork: "throw new Error('executed')" } } }, artworks: { item: { name: "Art" } } };

test("stored gallery code cannot execute through either runtime factory or direct construction", () => {
    const payload = { body: malicious.games.default.scripts.main.code, env: {}, func: jest.fn() };
    for (const factory of [SpaceScript, ScriptContainer]) {
        expect(() => factory.create(payload)).toThrow("retired");
        expect(() => new factory(payload)).toThrow("retired");
    }
    expect(payload.func).not.toHaveBeenCalled();
    expect((globalThis as any).galleryScriptExecuted).toBeUndefined();
    const root = readFileSync(join(__dirname, "../components/_3DExhibit-v2/three/root.js"), "utf8");
    expect(root).not.toMatch(/ScriptContainer\.create|import.*scriptcontainer/);
});

test("ordinary artwork undo/duplicate helpers leave all historical script data intact", () => {
    const exhibit = JSON.parse(JSON.stringify(malicious));
    expect(getScripts(exhibit, "artwork")).toEqual({});
    expect(removeScripts(exhibit, "artwork")).toEqual({});
    restoreScripts(exhibit, "artwork", { default: { code: "injected" } } as any);
    duplicateScripts(exhibit, "artwork", "new");
    expect(exhibit).toEqual(malicious);
    expect(ScriptEditor({ onClose: () => {} })).toBeNull();
    expect(ToggleScriptEditor({})).toBeNull();
});

test("both nested and dotted legacy game writes are rejected without reserving other fields", () => {
    for (const path of [["games"], ["games", "default", "scripts"], ["games.default.scripts"]]) expect(isLegacyGalleryScriptPath(path)).toBe(true);
    for (const payload of [malicious, { "games.default.scripts.main": "body" }, { games: null }]) expect(hasLegacyGalleryScriptWrite(payload)).toBe(true);
    for (const payload of [{ artworks: { id: {} } }, { runtime: { worldId: "reviewed" } }, { info: { headline: "Games" } }]) expect(hasLegacyGalleryScriptWrite(payload)).toBe(false);
});

test("v2 RPC and direct internal update both reject scripts before contacting storage", async () => {
    const bad = { op: "replace", path: ["games", "default", "scripts"], value: { code: "body" } };
    expect((update as any).schema.safeParse({ id: "gallery", patches: [bad] }).success).toBe(false);
    expect((update as any).schema.safeParse({ id: "gallery", patches: [{ op: "replace", path: ["artworks", "a"], value: {} }] }).success).toBe(true);
    expect(await updateExhibit("gallery", [bad] as any, "editor")).toEqual({ success: false, error: "Gallery custom scripts have been retired" });
    expect(db.runTransaction).not.toHaveBeenCalled();
    expect(await getScript.call({} as any, { prompt: "generate script" })).toEqual({ success: false, data: "", err: "Gallery custom scripts have been retired" });
});
