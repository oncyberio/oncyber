import test from "node:test";
import assert from "node:assert/strict";
import { createAudio } from "./audio.js";

function audioHarness() {
  const contexts = [];
  const param = () => ({
    value: 0,
    events: [],
    setValueAtTime(...args) {
      this.events.push(args);
    },
    setTargetAtTime(...args) {
      this.events.push(args);
    },
    exponentialRampToValueAtTime(...args) {
      this.events.push(args);
    },
  });
  const node = () => ({
    disconnected: false,
    connect() {},
    disconnect() {
      this.disconnected = true;
    },
  });
  class AudioContext {
    constructor() {
      this.currentTime = 0;
      this.sampleRate = 48000;
      this.state = "suspended";
      this.destination = node();
      this.sources = [];
      this.filters = [];
      this.gains = [];
      this.resumes = 0;
      contexts.push(this);
    }
    source(type) {
      const result = {
        ...node(),
        frequency: param(),
        sourceType: type,
        stopped: false,
        loop: false,
        start() {},
        stop(time) {
          if (time === undefined) {
            this.stopped = true;
            this.onended?.();
          }
        },
        finish() {
          this.onended?.();
        },
      };
      this.sources.push(result);
      return result;
    }
    createOscillator() {
      return this.source("tone");
    }
    createBufferSource() {
      return this.source("noise");
    }
    createGain() {
      const result = { ...node(), gain: param() };
      this.gains.push(result);
      return result;
    }
    createBiquadFilter() {
      const result = { ...node(), frequency: param(), Q: param() };
      this.filters.push(result);
      return result;
    }
    createDynamicsCompressor() {
      return {
        ...node(),
        threshold: param(),
        knee: param(),
        ratio: param(),
        attack: param(),
        release: param(),
      };
    }
    createBuffer(channels, length) {
      return {
        getChannelData() {
          return new Float32Array(length);
        },
      };
    }
    resume() {
      this.state = "running";
      this.resumes++;
      return Promise.resolve();
    }
    suspend() {
      this.state = "suspended";
      return Promise.resolve();
    }
    close() {
      this.state = "closed";
      return Promise.resolve();
    }
  }
  // The SDK's output as the game sees it (context.audio): one context, one
  // node to connect to, and whether anything would be heard.
  const context = new AudioContext();
  const sdk = { context, output: node(), audible: true };
  return { context, sdk, start: () => (context.state = "running") };
}
// The open-air bed is the first source; the tests count Foley voices.
const foley = (context) => context.sources.slice(1);

test("the graph is built on the SDK output at once, and nothing is scheduled before sound starts", () => {
  const { context, sdk, start } = audioHarness();
  const sound = createAudio(sdk);
  // No context of its own, no private mute.
  assert.equal("enabled" in sound, false);
  assert.equal("toggle" in sound, false);
  assert.equal(context.sources.length, 1, "only the open-air bed");
  assert.equal(context.sources[0].loop, true);
  sound.hit(1);
  sound.smash(1);
  sound.wall("glass");
  sound.point();
  assert.equal(foley(context).length, 0);
  assert.equal(context.resumes, 0, "the page starts sound, not the game");
  start();
  sound.hit(0.8);
  assert.equal(foley(context).length, 4);
  sound.dispose();
});

test("without Web Audio every call is a no-op", () => {
  const sound = createAudio({ context: null, output: null });
  sound.hit(1);
  sound.step(1);
  sound.quiet();
  sound.dispose();
  assert.equal(sound.voices, 0);
});

test("dense collisions are bounded; page mute stops scheduling and quiet() disconnects every voice", () => {
  const { context, sdk, start } = audioHarness();
  const sound = createAudio(sdk);
  start();
  for (let i = 0; i < 80; i++) {
    context.currentTime += 0.05;
    i % 3 ? sound.hit(0.9) : sound.smash(1);
    sound.wall(i % 2 ? "glass" : "fence", 1);
  }
  const active = foley(context).filter((source) => !source.disconnected);
  assert.equal(active.length, 24);
  assert.equal(sound.voices, 24);
  assert.ok(context.sources.some((source) => source.stopped));
  sound.quiet();
  assert.equal(
    foley(context).filter((source) => !source.disconnected).length,
    0
  );
  // The page muted the game (or suspended it): nothing new is scheduled.
  sdk.audible = false;
  const count = context.sources.length;
  sound.smash(1);
  sound.hit(1);
  sound.bounce();
  sound.point();
  assert.equal(context.sources.length, count);
  sdk.audible = true;
  sound.hit(1);
  assert.ok(context.sources.length > count);
  sound.dispose();
});

test("glass and fence have distinct timbres, collision and shoe spam are throttled", () => {
  const { context, sdk, start } = audioHarness();
  const sound = createAudio(sdk);
  start();
  sound.wall("glass", 0.5);
  const glassTones = foley(context).filter(
    (source) => source.sourceType === "tone"
  ).length;
  assert.equal(glassTones, 3);
  sound.wall("fence", 0.5);
  assert.equal(foley(context).length, 4);
  context.currentTime += 0.1;
  sound.wall("fence", 0.5);
  assert.equal(
    foley(context)
      .slice(4)
      .filter((source) => source.sourceType === "tone").length,
    1
  );
  const beforeStep = context.sources.length;
  sound.step(0.4);
  for (let i = 0; i < 100; i++) sound.step(0.4);
  assert.equal(context.sources.length - beforeStep, 1);
  const beforeBounce = context.sources.length;
  for (let i = 0; i < 20; i++) sound.bounce();
  assert.equal(context.sources.length - beforeBounce, 2);
  sound.dispose();
});

test("ended voices clean up; disposal is idempotent, blocks sound and leaves the SDK's context alone", () => {
  const { context, sdk, start } = audioHarness();
  const sound = createAudio(sdk);
  start();
  sound.hit();
  for (const source of foley(context)) source.finish();
  assert.ok(foley(context).every((source) => source.disconnected));
  const count = context.sources.length;
  sound.serve();
  assert.ok(context.sources.length > count);
  sound.dispose();
  sound.dispose();
  const after = context.sources.length;
  sound.hit();
  assert.equal(context.sources.length, after);
  // Suspending, resuming and closing the context are the SDK's.
  assert.equal(context.state, "running");
  assert.equal(context.resumes, 0);
  assert.ok(context.sources.every((source) => source.disconnected));
});

test("diminishing dead-ball bounces fade both Foley layers while normal rally impact stays unchanged", () => {
  const { context, sdk, start } = audioHarness();
  const sound = createAudio(sdk);
  start();
  const peaks = [];
  for (const power of [0.5, 0.25, 0.1, 0.01]) {
    context.currentTime += 0.1;
    const before = context.gains.length;
    sound.bounce(power);
    assert.equal(context.gains.length - before, 2);
    peaks.push(context.gains.slice(before).map((amp) => amp.gain.events[1][0]));
  }
  assert.ok(Math.abs(peaks[0][0] - 0.205) < 1e-9);
  assert.ok(Math.abs(peaks[0][1] - 0.15) < 1e-9);
  for (let bounce = 1; bounce < peaks.length; bounce++)
    for (let layer = 0; layer < 2; layer++)
      assert.ok(peaks[bounce][layer] < peaks[bounce - 1][layer]);
  for (let layer = 0; layer < 2; layer++)
    assert.ok(peaks.at(-1)[layer] < peaks[0][layer] * 0.01);
  const count = context.sources.length;
  context.currentTime += 0.1;
  sound.bounce(0);
  sound.bounce(-1);
  sound.bounce(NaN);
  assert.equal(
    context.sources.length,
    count,
    "a settled ball must create no audio sources"
  );
  sound.dispose();
});
