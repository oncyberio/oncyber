import assert from "node:assert/strict";
import test from "node:test";
import {
    AnimationClip,
    AnimationMixer,
    Bone,
    Euler,
    Group,
    Quaternion,
    QuaternionKeyframeTrack,
} from "three";
import { createPoseSampler } from "../src/pose-layers.mjs";

test("a held guard cannot accumulate chest rotation on a constant spine track", () => {
    const root = new Group(),
        spine = new Bone(),
        chest = new Bone();
    root.add(spine);
    spine.add(chest);
    const rest = new Quaternion().setFromEuler(new Euler(0.06, 0.02, 0));
    const mixer = new AnimationMixer(root);
    const fixed = new QuaternionKeyframeTrack(
        spine.uuid + ".quaternion",
        [0, 1],
        [...rest.toArray(), ...rest.toArray()]
    );
    mixer.clipAction(new AnimationClip("guard", 1, [fixed])).play();
    const sample = createPoseSampler([spine, chest], mixer);
    const offset = new Quaternion().setFromEuler(new Euler(0.12, 0.2, -0.04));
    const expected = rest.clone().multiply(offset);
    for (const fps of [30, 60, 120]) {
        for (let i = 0; i < fps * 5; i++) {
            sample(1 / fps);
            spine.quaternion.multiply(offset);
            chest.quaternion.multiply(offset);
            assert.ok(spine.quaternion.angleTo(expected) < 0.001);
            assert.ok(chest.quaternion.angleTo(offset) < 0.001);
        }
    }
    sample(0);
    assert.ok(spine.quaternion.angleTo(rest) < 0.001);
    assert.ok(chest.quaternion.angleTo(new Quaternion()) < 0.001);
});
