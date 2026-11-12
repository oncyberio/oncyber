// Requires esbuild and Playwright + its Chromium browser on Node's module path.
// Run from any directory; set VOICE_SMOKE_REPORT to save the full result JSON.
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");
const { build } = require("esbuild");
const { chromium } = require("playwright");

async function main() {
    const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "oncyber-voice-"));
    let browser, server;
    try {
        const bundle = path.join(scratch, "fixture.js");
        await build({
            entryPoints: [path.join(__dirname, "voice-webrtc-smoke.browser.js")],
            outfile: bundle,
            bundle: true,
            platform: "browser",
            alias: { events: require.resolve("events/") },
            plugins: [{
                name: "local-turn-only",
                setup(builder) {
                    builder.onResolve({ filter: /turnCredentials$/ }, () => ({
                        path: "local-turn", namespace: "voice-smoke",
                    }));
                    builder.onLoad({ filter: /.*/, namespace: "voice-smoke" }, () => ({
                        contents: "export const getTurnIceServers = async () => [];",
                        loader: "js",
                    }));
                },
            }],
        });
        browser = await chromium.launch({
            headless: true,
            args: [
                "--autoplay-policy=no-user-gesture-required",
                "--use-fake-device-for-media-stream",
                "--use-fake-ui-for-media-stream",
                "--disable-features=WebRtcHideLocalIpsWithMdns",
            ],
        });
        server = http.createServer((request, response) => {
            response.end("<!doctype html><title>Local voice check</title>");
        });
        await new Promise((resolve, reject) => {
            server.once("error", reject);
            server.listen(0, "127.0.0.1", resolve);
        });
        const page = await browser.newPage();
        const errors = [];
        page.on("pageerror", error => errors.push(error.message));
        page.on("console", message => {
            if (message.type() === "error") errors.push(message.text());
        });
        await page.goto(`http://127.0.0.1:${server.address().port}`);
        // Grant the simulated device, never a physical microphone. This enables
        // normal host-candidate gathering on the trustworthy localhost origin.
        await page.evaluate(async () => {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(track => track.stop());
        });
        await page.addScriptTag({ path: bundle });
        let result;
        try {
            result = await page.evaluate(() => window.runVoiceSmoke());
        } catch (error) {
            console.error(JSON.stringify({
                errors, failure: await page.evaluate(() => window.voiceFailure),
            }, null, 2));
            throw error;
        }
        result.errors = errors;
        if (process.env.VOICE_SMOKE_REPORT) {
            fs.writeFileSync(process.env.VOICE_SMOKE_REPORT, JSON.stringify(result, null, 2));
        }
        console.log(JSON.stringify({
            browser: result.browser,
            clients: result.clients,
            remotePeersPerClient: result.remotePeersPerClient,
            connectedPeerConnections: result.connectedPeerConnections,
            micBitrateLimits: result.micParameters,
            negotiatedPtime: result.negotiatedPtime,
            shareSurvivedMicGate: result.shareSurvivedMicGate,
            rejoin: result.rejoin,
            errors,
        }, null, 2));
        if (errors.length) throw new Error("Browser reported WebRTC errors");
    } finally {
        if (browser) await browser.close();
        if (server) await new Promise(resolve => server.close(resolve));
        fs.rmSync(scratch, { recursive: true, force: true });
    }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
