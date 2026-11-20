import assert from "node:assert/strict";
import test from "node:test";
import { arrivalShot, fadeAt, FADE_S } from "../src/departure.js";
import {
    avatarOnScreen,
    departureProblem,
    departureView,
} from "../../runtime/src/departure.ts";

test("the fade runs from the world to black and stays there", () => {
    assert.equal(fadeAt(0), 0);
    assert.equal(fadeAt(FADE_S), 1);
    assert.equal(fadeAt(FADE_S * 4), 1);
    assert.ok(fadeAt(FADE_S / 2) > 0.4 && fadeAt(FADE_S / 2) < 0.6);
    assert.equal(fadeAt(0, 0), 1, "reduced motion: black at once");
});

test("the courtside view is one the lobby can open on", () => {
    // The default arrival framing: camera behind and above, court ahead.
    const shot = arrivalShot({
        cameraPosition: { x: 2.4, y: 2.3, z: 18.6 },
        cameraLook: { x: 2.4, y: 1.25, z: 13.8 },
        fov: 50,
        feet: { x: 2.4, y: 0.3, z: 13.8 },
        faceYaw: 0,
        height: 1.75,
    });
    assert.equal(shot.avatar.feet.y, 0, "feet are on the court, not sunk");
    const view = departureView(shot);
    assert.equal(departureProblem(view), null);
    const box = avatarOnScreen(view, 16 / 9);
    assert.ok(Math.abs(box.x - 0.5) < 1e-6);
    assert.ok(box.height > 0.3 && box.height < 0.5, `height ${box.height}`);
});
