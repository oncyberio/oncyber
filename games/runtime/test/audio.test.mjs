import assert from "node:assert/strict";
import test from "node:test";
import { RuntimeSession } from "../src/index.ts";
import { createGameAudio, DUCK_GAIN } from "../src/audio.ts";
import { connectVoice } from "../src/voice.ts";

/** A Web Audio stand-in: gains apply at once, analysers read a set level. */
function fakeContext({ allowed = true } = {}) {
    const context = {
        state: "suspended",
        currentTime: 0,
        destination: { name: "speakers" },
        level: 0.5,
        links: [],
        allowed,
        createGain() {
            const node = {
                gain: {
                    value: 1,
                    setTargetAtTime(v) {
                        this.value = v;
                    },
                    cancelScheduledValues() {},
                },
                connect(to) {
                    context.links.push([node, to]);
                },
                disconnect() {},
            };
            return node;
        },
        createAnalyser() {
            const node = {
                fftSize: 0,
                connect() {},
                disconnect() {},
                getFloatTimeDomainData(out) {
                    // The tap after the control gain hears the game scaled by it.
                    const source = context.links.find(
                        ([, to]) => to === node
                    )[0];
                    const control = context.links.find(
                        ([, to]) => to === context.destination
                    )[0];
                    out.fill(
                        context.level *
                            (source === control ? control.gain.value : 1)
                    );
                },
            };
            return node;
        },
        async resume() {
            if (!context.allowed) throw new Error("NotAllowedError");
            context.state = "running";
        },
        async suspend() {
            context.state = "suspended";
        },
        async close() {
            context.state = "closed";
        },
    };
    return context;
}

test("everything the game plays passes one output the page controls", async () => {
    const context = fakeContext();
    const audio = createGameAudio(context);
    const control = context.links.find(
        ([, to]) => to === context.destination
    )[0];
    assert.deepEqual(context.links[0], [audio.output, control]);
    assert.equal(audio.inspect().audioState, "suspended");
    assert.equal(audio.inspect().audioRouted, false);
    assert.equal(await audio.unlock(), true);
    const facts = audio.inspect();
    assert.deepEqual(
        [
            facts.audioState,
            facts.audioRouted,
            facts.audioBypass,
            facts.audioGain,
            facts.audioLevel,
        ],
        ["running", true, 0, 1, 0.5]
    );
    audio.reportBypass();
    assert.equal(audio.inspect().audioBypass, 1);
});

test("the page's mute and volume reach the game; mute is silence", async () => {
    const audio = createGameAudio(fakeContext());
    await audio.unlock();
    let changes = 0;
    audio.onChange(() => changes++);
    audio.receive({ volume: 0.5 });
    assert.equal(audio.inspect().audioLevel, 0.25);
    audio.receive({ muted: true });
    assert.deepEqual(
        [
            audio.muted,
            audio.audible,
            audio.inspect().audioLevel,
            audio.inspect().audioInput,
        ],
        [true, false, 0, 0.5]
    );
    audio.receive({ muted: false, volume: 7 });
    assert.deepEqual(
        [audio.muted, audio.volume, audio.audible],
        [false, 1, true]
    );
    assert.equal(changes, 3);
    audio.receive({ muted: false });
    audio.receive("muted");
    audio.receive(null);
    audio.receive({ volume: NaN, muted: "yes" });
    assert.equal(changes, 3);
    assert.equal(audio.receive({ probe: true }), true);
});

test("sound starts on a gesture the page forwards, not before", async () => {
    const context = fakeContext({ allowed: false });
    const audio = createGameAudio(context);
    assert.equal(await audio.unlock(), false);
    assert.equal(audio.audible, false);
    context.allowed = true;
    audio.receive({ gesture: true });
    await new Promise((resolve) => setTimeout(resolve));
    assert.equal(audio.inspect().audioState, "running");
});

test("the game drops while someone speaks and comes back after", async () => {
    // The voice side only has to say whether anyone is talking.
    const voice = {
        listener: null,
        subscribe(listener) {
            this.listener = listener;
        },
    };
    const audio = createGameAudio(fakeContext());
    await audio.unlock();
    voice.subscribe((speaking) => audio.receive({ speaking }));
    voice.listener(true);
    assert.deepEqual(
        [audio.inspect().audioDucked, audio.inspect().audioGain],
        [true, DUCK_GAIN]
    );
    audio.receive({ volume: 0.5 });
    assert.equal(audio.inspect().audioGain, 0.15);
    voice.listener(false);
    assert.deepEqual(
        [audio.inspect().audioDucked, audio.inspect().audioGain],
        [false, 0.5]
    );
});

test("the game's own voice helper lowers it too: talking from connectVoice, beside the page's speaking", async () => {
    const audio = createGameAudio(fakeContext());
    await audio.unlock();
    const page = {};
    const voice = connectVoice("oncyber:game", {
        port: {
            post() {},
            listen(handler) {
                page.say = handler;
                return () => {};
            },
        },
    });
    voice.onTalking((ids, self) =>
        audio.setTalking(ids.length > (self ? 1 : 0))
    );
    const gain = () => [audio.inspect().audioDucked, audio.inspect().audioGain];
    // Only the visitor talks: nobody to hear.
    page.say({ type: "oncyber:game:talking", ids: ["me"], self: true });
    assert.deepEqual(gain(), [false, 1]);
    page.say({ type: "oncyber:game:talking", ids: ["me", "ben"], self: true });
    assert.deepEqual(gain(), [true, DUCK_GAIN]);
    // Either signal holds the game down.
    audio.receive({ speaking: true });
    page.say({ type: "oncyber:game:talking", ids: [], self: false });
    assert.deepEqual(gain(), [true, DUCK_GAIN]);
    audio.receive({ speaking: false });
    assert.deepEqual(gain(), [false, 1]);
    // Mute wins over both.
    audio.setTalking(true);
    audio.receive({ muted: true });
    assert.deepEqual(gain(), [false, 0]);
});

test("suspend silences, restore brings the sound back as it was", async () => {
    const context = fakeContext();
    const audio = createGameAudio(context);
    const session = new RuntimeSession(
        (ctx) => ({
            async prepare() {},
            enter() {},
            update() {},
            suspend() {
                return null;
            },
            restore() {},
            dispose() {},
            inspect() {
                return { hasOutput: ctx.audio === audio };
            },
        }),
        {
            manifest: { input: {}, assets: [], capabilities: [] },
            graphics: {},
            audio,
            services: {
                identity: { id: "v", name: "V" },
                asset: async () => new ArrayBuffer(0),
                call: async () => true,
            },
            sendUI() {},
        }
    );
    await session.prepare();
    await session.enter({
        avatar: { id: "v", position: [0, 0, 0], rotation: [0, 0, 0, 1] },
        camera: {
            position: [0, 1, 4],
            target: [0, 1, 0],
            fov: 50,
            mode: "third-person",
        },
        party: [],
    });
    await audio.unlock();
    audio.receive({ volume: 0.8 });
    await session.suspend();
    let facts = session.inspect();
    assert.deepEqual(
        [
            facts.hasOutput,
            facts.audioSuspended,
            facts.audioGain,
            facts.audioState,
        ],
        [true, true, 0, "suspended"]
    );
    // A gesture while suspended is remembered, not played.
    assert.equal(await audio.unlock(), false);
    await session.restore();
    await new Promise((resolve) => setTimeout(resolve));
    facts = session.inspect();
    assert.deepEqual(
        [
            facts.audioSuspended,
            facts.audioGain,
            facts.audioState,
            facts.audioLevel,
        ],
        [false, 0.8, "running", 0.4]
    );
});

test("a suspended game that never had a gesture stays locked on restore", async () => {
    const context = fakeContext();
    const audio = createGameAudio(context);
    audio.suspend();
    audio.restore();
    assert.equal(context.state, "suspended");
});

test("without Web Audio every call is a no-op", async () => {
    const audio = createGameAudio(null);
    assert.equal(audio.output, null);
    assert.equal(await audio.unlock(), false);
    audio.receive({ muted: true });
    audio.suspend();
    audio.restore();
    assert.deepEqual([audio.muted, audio.inspect().audioState], [true, "none"]);
    audio.dispose();
});
