import assert from "node:assert/strict";
import test from "node:test";
import { graphicsProfile, supportedSamples } from "./graphics-quality.js";

test("high quality raises detail without exceeding its pixel budget on large displays", () => {
  for (const [w, h, dpr] of [
    [1111, 924, 2],
    [3840, 2160, 3],
    [7680, 4320, 2],
  ]) {
    const high = graphicsProfile("high", w, h, dpr);
    const balanced = graphicsProfile("balanced", w, h, dpr);
    assert.ok(w * h * high.pixelRatio ** 2 <= high.pixelBudget + 1e-6);
    assert.ok(w * h * balanced.pixelRatio ** 2 <= balanced.pixelBudget + 1e-6);
    assert.ok(high.pixelRatio > balanced.pixelRatio);
    assert.equal(high.edgeSmoothing, true);
    assert.equal(balanced.edgeSmoothing, false);
  }
});

test("graphics profiles tolerate missing viewport data and respect actual MSAA support", () => {
  const profile = graphicsProfile("unknown", NaN, 0, Infinity);
  assert.equal(profile.name, "high");
  assert.equal(profile.pixelRatio, 1);
  assert.equal(supportedSamples(new Int32Array([8, 4, 2, 1]), 4), 4);
  assert.equal(supportedSamples(new Int32Array([4]), 2), 0);
  assert.equal(supportedSamples([], 4), 0);
  assert.equal(supportedSamples(null, 4), 0);
});
