// The "hosted" stage of games:check. It proves the checked build survives
// leaving the repository: publish it to a throwaway local-folder backend,
// follow the pointer the way the game page does, fetch every file over HTTP
// and compare its hash, and boot the game from that address in the sandbox.
// Nothing here needs keys or touches a real pointer.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { currentRelease, readPointers } from "./pointer.mjs";
import { publishRelease } from "./publish.mjs";
import { serveReleases } from "./serve.mjs";
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
 * @param {{ id: string, out: string, files: {path:string,bytes:number,sha256:string}[], chromium?: any, headed?: boolean }} options
 * @returns {Promise<{ findings: {code:string,message:string}[], summary: object }>}
 */
export async function hostedReleaseStage({
    id,
    out,
    files,
    chromium,
    headed = false,
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
        ({ entry } = await publishRelease({
            game: id,
            dir: out,
            files,
            storage,
            pointers,
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
        });
        const origin = `http://127.0.0.1:${server.address().port}`;
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
        }

        if (chromium && !findings.length) {
            browser = await chromium.launch({
                headless: !headed,
                channel: process.env.PW_CHANNEL || undefined,
                args: ["--enable-unsafe-webgpu", "--ignore-gpu-blocklist"],
            });
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
