// The sound stage of `pnpm games:check` (see docs/games/sound.md).
//
// It plays the page's part of the sound bridge against the running game and
// asserts on the facts the SDK's output reports through inspect():
//   - sound starts on a trusted gesture made on the page, not in the game;
//   - what the game plays arrives at the SDK's node, and nothing goes around it;
//   - page mute is silence, at the speakers' end of the graph;
//   - the game drops while someone speaks, and comes back.
//
// A game that never answers has no SDK output. That fails a game whose
// manifest declares the "audio" capability and is reported as skipped for the
// rest (a silent game is allowed; a game with private sound is not caught).

/** Added to the check page: the page's side of `<id>:audio`. */
export const soundHarness = (id) => `
<div id="gesture" style="position:fixed;top:0;left:0;width:6px;height:6px"></div>
<script>
window.__audio = (data) => frame.contentWindow.postMessage({ type: "${id}:audio", ...data }, "*");
addEventListener("message", (event) => {
    if (event.source !== frame.contentWindow || !event.data) return;
    if (event.data.type === "${id}:audio-state") window.__audioState = event.data.state;
    if (event.data.type === "${id}:audio" && typeof event.data.muted === "boolean") window.__audioAsked = event.data.muted;
});
// Like the page: only a real gesture is forwarded.
document.getElementById("gesture").addEventListener("pointerdown", (event) => event.isTrusted && window.__audio({ gesture: true }));
</script>`;

async function probe(page) {
    await page.evaluate(() => {
        window.__audioState = null;
        window.__audio({ probe: true });
    });
    for (let i = 0; i < 20; i++) {
        const state = await page.evaluate(() => window.__audioState);
        if (state) return state;
        await page.waitForTimeout(50);
    }
    return null;
}

/** Probes until `test(facts)` holds; returns the last facts either way. */
async function until(page, test, ms = 4000) {
    const deadline = Date.now() + ms;
    let facts = null;
    do {
        facts = await probe(page);
        if (facts && test(facts)) return { ok: true, facts };
        await page.waitForTimeout(100);
    } while (Date.now() < deadline);
    return { ok: false, facts };
}

/**
 * Runs the stage and adds it to `report.stages`; a failure fails the report.
 * `required`: the game must have an SDK sound output.
 */
export async function soundStage(page, report, { required }) {
    const started = Date.now();
    const done = (status, error, facts) => {
        report.stages.push({
            stage: "sound",
            status,
            ms: Date.now() - started,
            ...(error ? { error } : {}),
            ...(facts ? { facts } : {}),
        });
        if (status === "failed") report.status = "failed";
    };
    const first = await probe(page);
    if (!first)
        return required
            ? done(
                  "failed",
                  "SOUND_NOT_CONNECTED: the game declares audio but has no SDK sound output (connectGameAudio)"
              )
            : done(
                  "skipped",
                  "no SDK sound output; a game that makes sound must use connectGameAudio"
              );
    if (first.audioState === "none")
        return done("skipped", "this browser has no Web Audio", first);

    const step = async (code, message, send, test, ms) => {
        if (send) await page.evaluate((data) => window.__audio(data), send);
        const { ok, facts } = await until(page, test, ms);
        if (!ok)
            throw Object.assign(new Error(`${code}: ${message}`), { facts });
        return facts;
    };
    try {
        await page.evaluate(() =>
            window.__audio({ volume: 1, muted: false, speaking: false })
        );
        await page.mouse.click(3, 3);
        await step(
            "SOUND_LOCKED",
            "sound did not start on a gesture forwarded by the page",
            null,
            (f) => f.audioState === "running"
        );
        await step(
            "SOUND_NOT_ROUTED",
            "nothing the game plays reaches the SDK output (connect to audio.output)",
            null,
            (f) => f.audioRouted && f.audioInput > 0 && f.audioLevel > 0,
            8000
        );
        await step(
            "SOUND_MUTE",
            "page mute did not silence the game",
            { muted: true },
            (f) => f.audioMuted && f.audioGain === 0 && f.audioLevel === 0
        );
        await step(
            "SOUND_UNMUTE",
            "sound did not come back after unmute",
            { muted: false },
            (f) => !f.audioMuted && f.audioGain > 0.95 && f.audioLevel > 0
        );
        await step(
            "SOUND_DUCK",
            "the game did not drop while someone speaks",
            { speaking: true },
            (f) => f.audioDucked && f.audioGain > 0 && f.audioGain < 0.5
        );
        const facts = await step(
            "SOUND_DUCK_RELEASE",
            "the game did not come back after speech",
            { speaking: false },
            (f) => !f.audioDucked && f.audioGain > 0.95
        );
        if (facts.audioBypass > 0)
            throw Object.assign(
                new Error(
                    `SOUND_BYPASS: ${facts.audioBypass} sound(s) went around the SDK output`
                ),
                { facts }
            );
        done("passed", null, facts);
    } catch (error) {
        done(
            "failed",
            String(error.message ?? error).slice(0, 500),
            error.facts ?? null
        );
    }
}
