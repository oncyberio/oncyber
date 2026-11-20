import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_SETTINGS, readSettings } from "./saved.js";

test("saved settings are read defensively: unknown, old or hostile values fall back", () => {
    assert.deepEqual(readSettings(null), { ...DEFAULT_SETTINGS });
    assert.deepEqual(readSettings("balanced"), { ...DEFAULT_SETTINGS });
    assert.deepEqual(
        readSettings({
            difficulty: "competitive",
            graphics: "balanced",
            camera: "first-person",
            muted: true,
        }),
        {
            difficulty: "competitive",
            graphics: "balanced",
            camera: "first-person",
        }
    );
    assert.deepEqual(
        readSettings({ difficulty: "impossible", graphics: 4, camera: null }),
        { ...DEFAULT_SETTINGS }
    );
});
