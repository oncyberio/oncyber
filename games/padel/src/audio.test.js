import test from "node:test";
import assert from "node:assert/strict";
import { createAudio } from "./audio.js";

function audioHarness(t) {
  const original = globalThis.window;
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
  globalThis.window = { AudioContext };
  t.after(() => {
    if (original === undefined) delete globalThis.window;
    else globalThis.window = original;
  });
  return contexts;
}

test("sound defaults on but constructs no audio context before explicit gesture unlock", (t) => {
  const contexts = audioHarness(t);
  const sound = createAudio();
  assert.equal(sound.enabled, true);
  sound.hit(1);
  sound.smash(1);
  sound.wall("glass");
  sound.point();
  assert.equal(contexts.length, 0);
  assert.equal(sound.unlocked, false);
  sound.unlock();
  assert.equal(contexts.length, 1);
  assert.equal(sound.unlocked, true);
  sound.hit(0.8);
  assert.equal(contexts[0].sources.length, 4);
  sound.dispose();
});

test("dense collisions are bounded and mute disconnects all active voices", (t) => {
  const contexts = audioHarness(t);
  const sound = createAudio();
  sound.unlock();
  const context = contexts[0];
  for (let i = 0; i < 80; i++) {
    context.currentTime += 0.05;
    i % 3 ? sound.hit(0.9) : sound.smash(1);
    sound.wall(i % 2 ? "glass" : "fence", 1);
  }
  const active = context.sources.filter((source) => !source.disconnected);
  assert.equal(active.length, 24);
  assert.ok(context.sources.some((source) => source.stopped));
  assert.equal(sound.toggle(), false);
  assert.equal(
    context.sources.filter((source) => !source.disconnected).length,
    0
  );
  const count = context.sources.length;
  sound.smash(1);
  sound.hit(1);
  sound.bounce();
  sound.point();
  assert.equal(context.sources.length, count);
  sound.dispose();
});

test("glass and fence have distinct timbres, collision and shoe spam are throttled", (t) => {
  const contexts = audioHarness(t);
  const sound = createAudio();
  sound.unlock();
  const context = contexts[0];
  sound.wall("glass", 0.5);
  const glassTones = context.sources.filter(
    (source) => source.sourceType === "tone"
  ).length;
  assert.equal(glassTones, 3);
  sound.wall("fence", 0.5);
  assert.equal(context.sources.length, 4);
  context.currentTime += 0.1;
  sound.wall("fence", 0.5);
  assert.equal(
    context.sources.slice(4).filter((source) => source.sourceType === "tone")
      .length,
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

test("ended voices clean up; suspension and disposal are idempotent and block sound", (t) => {
  const contexts = audioHarness(t);
  const sound = createAudio();
  sound.unlock();
  const context = contexts[0];
  sound.hit();
  for (const source of context.sources) source.finish();
  assert.ok(context.sources.every((source) => source.disconnected));
  sound.suspend();
  const count = context.sources.length;
  sound.hit();
  sound.point();
  assert.equal(context.sources.length, count);
  sound.unlock();
  sound.serve();
  assert.ok(context.sources.length > count);
  sound.dispose();
  sound.dispose();
  sound.unlock();
  sound.hit();
  assert.equal(context.state, "closed");
  assert.equal(contexts.length, 1);
  assert.ok(context.sources.every((source) => source.disconnected));
});

test("diminishing dead-ball bounces fade both Foley layers while normal rally impact stays unchanged", (t) => {
  const contexts = audioHarness(t);
  const sound = createAudio();
  sound.unlock();
  const context = contexts[0];
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
