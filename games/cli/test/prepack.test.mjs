// `npm pack` runs scripts/prepack.mjs, which copies what a game outside the
// repository needs into the package. It fails when a check script names a
// page file that cannot be copied alone, or imports something left behind:
// this test runs it, so that is found here and not at the next release.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const pkg = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("the package can be made: every file the check tool loads comes along", (t) => {
    const out = mkdtempSync(join(tmpdir(), "oncyber-sdk-"));
    t.after(() => rmSync(out, { recursive: true, force: true }));
    const said = execFileSync(
        process.execPath,
        [join(pkg, "scripts/prepack.mjs")],
        {
            env: { ...process.env, ONCYBER_SDK_OUT: out },
            encoding: "utf8",
            stdio: ["ignore", "pipe", "pipe"],
        }
    );
    assert.match(said, /wrote sdk\/ \(\d+ page files/);
    // The page's rules, in the folders the check tool reads them from.
    const page = join(out, "frontend/features/games");
    for (const file of [
        "contract/gameContract.ts",
        "contract/gameInput.ts",
        "health/gameDisabled.ts",
        "publish/networkPolicy.js",
        "room/gameParty.ts",
        "catalog.generated.ts",
    ])
        assert.ok(existsSync(join(page, file)), file);
    // Nothing else of the site is in the package.
    assert.deepEqual(readdirSync(join(out, "frontend/features")), ["games"]);
    for (const part of ["games/runtime", "scripts/games", "docs/games"])
        assert.ok(existsSync(join(out, part)), part);
});
