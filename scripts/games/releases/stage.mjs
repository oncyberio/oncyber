// The "hosted" stage of games:check. It proves the checked build survives
// leaving the repository: publish it to a throwaway local-folder backend,
// follow the pointer the way the game page does, fetch every file over HTTP
// and compare its hash, and boot the game from that address in the sandbox.
// The release's host must send the game's Content-Security-Policy
// (docs/games/trust.md) as well as CORS, and the game runs under it here.
// Nothing here needs keys or touches a real pointer.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { currentRelease, readPointers } from "./pointer.mjs";
import { publishRelease } from "./publish.mjs";
import { releasePolicy, serveReleases } from "./serve.mjs";
import {
    localFolderStorage,
    RELEASE_MANIFEST,
    releaseId,
    sha256,
} from "./storage.mjs";

const harness = (
    src
) => `<!doctype html><meta charset="utf-8"><title>hosted check</title>
<style>html,body{margin:0;height:100%;background:#000}iframe{border:0;width:100%;height:100%}</style>
<iframe id="game" sandbox="allow-scripts allow-pointer-lock" referrerpolicy="no-referrer" src="${src}"></iframe>
<script>
const frame = document.getElementById("game");
addEventListener("message", (event) => {
    if (event.source !== frame.contentWindow || event.origin !== "null") return;
    const type = event.data && event.data.type;
    if (typeof type !== "string") return;
    if (type.endsWith(":hello")) frame.contentWindow.postMessage({ type: type.slice(0, -5) + "identity", name: "Check", pfp: "", avatarUrl: "", storage: {} }, "*");
    if (type.endsWith(":ready")) window.__ready = true;
    if (type.endsWith(":error")) window.__gameError = String(event.data.message || "error");
});
</script>`;

/**
 * @param {{ id: string, out: string, files: {path:string,bytes:number,sha256:string}[], chromium?: any, headed?: boolean, network?: any, reportUri?: string }} options
 *   `network` is the check's network stage (networkCheck.mjs): this stage's
 *   server and browser run under it, and violations are reported at
 *   `reportUri`.
 * @returns {Promise<{ findings: {code:string,message:string}[], summary: object }>}
 */
export async function hostedReleaseStage({
    id,
    out,
    files,
    chromium,
    headed = false,
    network,
    reportUri,
}) {
    const findings = [];
    const add = (code, message) => findings.push({ code, message });
    const root = mkdtempSync(join(tmpdir(), "oncyber-releases-"));
    const started = Date.now();
    let server,
        browser,
        entry = null,
        bootMs = null;
    try {
        const storage = localFolderStorage({ root });
        const pointers = join(root, "pointers.json");
        // The throwaway backend is pointed at once: this is the hosted path.
        ({ entry } = await publishRelease({
            game: id,
            dir: out,
            files,
            storage,
            pointers,
            point: true,
        }));
        if (entry.release !== releaseId(files))
            add(
                "RELEASE_ID",
                "the release id is not the hash of the checked files"
            );

        // A release never changes: the same files are accepted again, any
        // other bytes under the same id are refused.
        const again = await storage
            .put({ game: id, release: entry.release, dir: out, files })
            .catch((error) => error);
        if (again instanceof Error)
            add(
                "RELEASE_REPEAT",
                `publishing the same files again failed: ${again.message}`
            );
        const forged = files.map((f, i) =>
            i ? f : { ...f, sha256: sha256(`${f.sha256}x`) }
        );
        const changed = await storage
            .put({ game: id, release: entry.release, dir: out, files: forged })
            .then(
                () => null,
                (error) => error
            );
        if (!changed)
            add(
                "RELEASE_MUTABLE",
                "storage accepted different files under an existing release id"
            );

        // From here on, only the pointer says where the game is.
        const pointed = currentRelease(readPointers(pointers), id);
        if (!pointed || pointed.release !== entry.release)
            add(
                "RELEASE_POINTER",
                "the pointer does not name the release that was just stored"
            );
        const base = pointed?.base ?? entry.base;
        server = await serveReleases({
            root,
            pages: { "/": harness(`${base}index.html`) },
            reportUri,
        });
        // Under the game's declared network like every other stage.
        network?.guard(server);
        const origin = `http://127.0.0.1:${server.address().port}`;
        // What the host must send: the policy of the build that was checked.
        const policy = releasePolicy(out, { reportUri });
        let policySent = true;
        for (const file of [...files, { path: RELEASE_MANIFEST }]) {
            const response = await fetch(new URL(file.path, origin + base));
            if (!response.ok) {
                add(
                    "RELEASE_FILE_MISSING",
                    `${file.path}: ${response.status} from the release address`
                );
                continue;
            }
            const got = sha256(Buffer.from(await response.arrayBuffer()));
            if (file.sha256 && got !== file.sha256)
                add(
                    "RELEASE_HASH_MISMATCH",
                    `${file.path}: served sha256 ${got.slice(
                        0,
                        12
                    )}… is not ${file.sha256.slice(0, 12)}…`
                );
            if (response.headers.get("access-control-allow-origin") !== "*")
                add(
                    "RELEASE_CORS",
                    `${file.path}: served without Access-Control-Allow-Origin: *`
                );
            if (
                policySent &&
                response.headers.get("content-security-policy") !== policy
            ) {
                policySent = false;
                add(
                    "RELEASE_POLICY",
                    `${file.path}: served without the game's Content-Security-Policy (its network.json and a sandbox); the release address would let the game reach hosts it did not declare`
                );
            }
        }

        if (chromium && !findings.length) {
            browser = await chromium.launch({
                headless: !headed,
                channel: process.env.PW_CHANNEL || undefined,
                args: ["--enable-unsafe-webgpu", "--ignore-gpu-blocklist"],
            });
            network?.patrol(browser);
            const page = await browser.newPage({
                viewport: { width: 1280, height: 720 },
            });
            // Every request the game makes on this origin must be inside its release.
            const outside = [];
            page.on("request", (request) => {
                const url = new URL(request.url());
                if (
                    url.origin === origin &&
                    url.pathname !== "/" &&
                    url.pathname !== "/favicon.ico" &&
                    // The browser's own report of a blocked load.
                    url.pathname !== reportUri &&
                    !url.pathname.startsWith(base)
                )
                    outside.push(url.pathname);
            });
            const bootStarted = Date.now();
            await page.goto(`${origin}/`);
            let state = {};
            const deadline = Date.now() + 90_000;
            while (Date.now() < deadline && !state.ready && !state.error) {
                await page.waitForTimeout(250);
                state = await page.evaluate(() => ({
                    ready: window.__ready === true,
                    error: window.__gameError ?? null,
                }));
            }
            if (state.ready) bootMs = Date.now() - bootStarted;
            else
                add(
                    "RELEASE_BOOT",
                    state.error
                        ? `the game failed when loaded from its release address: ${state.error}`
                        : "the game did not say ready when loaded from its release address"
                );
            if (outside.length)
                add(
                    "RELEASE_ESCAPES",
                    `the game loads files outside its release (use relative URLs): ${[
                        ...new Set(outside),
                    ]
                        .slice(0, 5)
                        .join(", ")}`
                );
        }
    } catch (error) {
        add("RELEASE_PUBLISH", String(error.message ?? error));
    } finally {
        await browser?.close();
        server?.close();
        // Stored files are read-only; force removes them all the same.
        rmSync(root, { recursive: true, force: true });
    }
    return {
        findings,
        summary: {
            status: findings.length ? "failed" : "passed",
            backend: "local",
            release: entry?.release ?? null,
            files: files.length,
            verified: findings.length ? null : files.length,
            bootMs,
            ms: Date.now() - started,
        },
    };
}
