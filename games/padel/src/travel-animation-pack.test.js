import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  decodeCC0LocomotionPack,
  TRAVEL_ANIMATION_DURATION_MS,
  travelAnimationLoops,
} from "./travel-animation-pack.js";

test("arrival ships the exact native packed animation bytes, timing, and ready idle", async () => {
  const base = new URL("../public/lobby/travel/", import.meta.url);
  const travelManifest = JSON.parse(
    await readFile(new URL("manifest.json", base))
  );
  const coreManifest = JSON.parse(
    await readFile(new URL("core-manifest.json", base))
  );
  const packs = [];
  for (const manifest of [travelManifest, coreManifest]) {
    const entry = manifest.packs[0];
    const bytes = await readFile(new URL(entry.file, base));
    assert.equal(bytes.length, entry.bytes);
    assert.equal(
      createHash("sha256").update(bytes).digest("hex"),
      entry.sha256
    );
    packs.push(decodeCC0LocomotionPack(bytes));
  }
  const clips = { ...packs[0].clips, IDLE_CC0: packs[1].clips.IDLE_CC0 };
  const metadata = {
    ...packs[0].metadata,
    IDLE_CC0: packs[1].metadata.IDLE_CC0,
  };
  for (const [name, duration] of Object.entries(TRAVEL_ANIMATION_DURATION_MS)) {
    assert.ok(Math.abs(clips[name].duration * 1000 - duration) < 0.001);
    assert.equal(metadata[name].loop, travelAnimationLoops(name));
    assert.equal(
      new Set(clips[name].tracks.map((track) => track.name)).size,
      clips[name].tracks.length
    );
  }
  assert.equal(clips.TRAVEL_STAND_UP.duration, 1);
  assert.equal(clips.IDLE_CC0.duration, 2.5);
  const hips = clips.TRAVEL_CROUCH_IDLE.tracks.find(
    (track) => track.name === "mixamorigHips.position"
  );
  const heights = hips.values.filter((_, index) => index % 3 === 1);
  assert.ok(
    Math.min(...heights) < 55 && Math.max(...heights) < 60,
    "the pack must retain the full authored crouch, not a standing height correction"
  );
  const broken = await readFile(new URL(travelManifest.packs[0].file, base));
  assert.throws(
    () => decodeCC0LocomotionPack(broken.subarray(0, broken.length - 2)),
    /Invalid LCP1/
  );
});
