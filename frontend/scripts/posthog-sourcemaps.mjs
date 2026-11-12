// Runs after `next build`. When POSTHOG_CLI_API_KEY + POSTHOG_CLI_PROJECT_ID are
// set (production Vercel env), inject PostHog chunk IDs into the built JS, upload
// the source maps to PostHog Error Tracking, then delete the local .map files so
// source isn't served publicly. Without those env vars it's a no-op. It NEVER
// fails the build — telemetry tooling must not block a release.
//
// To activate: add POSTHOG_CLI_API_KEY (a PostHog personal API key, phx_…) and
// POSTHOG_CLI_PROJECT_ID (481549) to the Vercel *Production* environment.

import { execSync } from "node:child_process";
import {
    existsSync,
    readdirSync,
    rmSync,
    statSync,
} from "node:fs";
import { join } from "node:path";

const DIR = ".next/static";
const token = process.env.POSTHOG_CLI_API_KEY;
const projectId = process.env.POSTHOG_CLI_PROJECT_ID;

if (!token || !projectId) {
    console.log(
        "[posthog-sourcemaps] POSTHOG_CLI_API_KEY/POSTHOG_CLI_PROJECT_ID not set — skipping source-map upload."
    );
    process.exit(0);
}

if (!existsSync(DIR)) {
    console.log(`[posthog-sourcemaps] ${DIR} not found — skipping.`);
    process.exit(0);
}

try {
    console.log("[posthog-sourcemaps] injecting chunk IDs + uploading to PostHog…");
    // `process` = inject + upload. `--no-fail` keeps a non-zero exit from
    // breaking the build (belt-and-suspenders with the try/catch).
    execSync(
        `npx --yes @posthog/cli@latest --no-fail sourcemap process --directory ${DIR}`,
        { stdio: "inherit", env: process.env }
    );
} catch (err) {
    console.warn(
        "[posthog-sourcemaps] upload failed (continuing build):",
        err?.message || err
    );
}

// Remove .map files so the bundled source isn't publicly fetchable. The
// `//# sourceMappingURL` comments will then 404 in the browser, which is fine —
// PostHog already has the maps for symbolication.
function removeMaps(dir) {
    for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        let s;
        try {
            s = statSync(p);
        } catch {
            continue;
        }
        if (s.isDirectory()) removeMaps(p);
        else if (name.endsWith(".map")) {
            try {
                rmSync(p);
            } catch {
                /* ignore */
            }
        }
    }
}

try {
    removeMaps(DIR);
    console.log("[posthog-sourcemaps] removed local .map files (not served publicly).");
} catch {
    /* ignore */
}
