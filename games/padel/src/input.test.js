import assert from "node:assert/strict";
import test from "node:test";
import { readPadelInput } from "./input.js";
import { AIM_LIMIT, createMatch } from "./simulation.js";

const center = { aimX: 0, aimZ: 0 };
// Declared actions held down, as the lifecycle's context.input reports them.
const held = (names) => Object.fromEntries(names.map((name) => [name, 1]));

test("a committed shot locks its target and ignores duplicate swings until contact", () => {
  const keys = held(["up", "right", "aimRight", "power", "run"]);
  const aim = { aimX: 0.4, aimZ: -0.6 };
  const pending = readPadelInput(keys, aim, 0.2, {
    committed: true,
    hit: true,
    powerHeld: true,
    powerReleased: true,
  });
  assert.equal(pending.aimX, aim.aimX);
  assert.equal(pending.aimZ, aim.aimZ);
  for (const property of ["hit", "powerHeld", "powerReleased", "sprint"])
    assert.equal(pending[property], false);
  assert.equal(pending.moveX, 0);
  assert.equal(pending.moveZ, 0);
  delete keys.power;
  const resumed = readPadelInput(keys, aim, 0.2);
  assert.equal(resumed.moveX, 1);
  assert.equal(resumed.moveZ, -1);
  assert.equal(resumed.sprint, true);
});

test("Movement and sprint keep moving the avatar while the power action charges without changing aim", () => {
  const keys = held(["up", "right", "run"]);
  const walking = readPadelInput(keys, center, 0.1);
  assert.equal(walking.moveX, 1);
  assert.equal(walking.moveZ, -1);
  assert.equal(walking.sprint, true);
  assert.equal(walking.aimX, 0);
  assert.equal(walking.aimZ, 0);

  keys.power = 1;
  const aiming = readPadelInput(keys, center, 0.1);
  assert.equal(aiming.moveX, 1);
  assert.equal(aiming.moveZ, -1);
  assert.equal(aiming.sprint, true);
  assert.equal(aiming.aimX, 0);
  assert.equal(aiming.aimZ, 0);
  assert.equal(aiming.powerHeld, true);
  assert.deepEqual(center, { aimX: 0, aimZ: 0 });
});

test("click-to-charge, the power action and the release frame preserve independent movement", () => {
  const keys = held(["left", "down"]);
  for (const controls of [
    readPadelInput(keys, center, 0.1, { powerHeld: true }),
    readPadelInput({ ...keys, power: 1 }, center, 0.1),
    readPadelInput(keys, center, 0.1, { powerReleased: true }),
  ]) {
    assert.equal(controls.moveX, -1);
    assert.equal(controls.moveZ, 1);
    assert.equal(controls.aimX, 0);
    assert.equal(controls.aimZ, 0);
  }
  const released = readPadelInput(keys, center, 0.1);
  assert.equal(released.moveX, -1);
  assert.equal(released.moveZ, 1);
});

test("aim actions aim independently; duplicate direction keys do not double target speed", () => {
  const arrowAim = readPadelInput(held(["right", "aimLeft"]), center, 0.1);
  assert.equal(arrowAim.moveX, 1);
  assert.ok(Math.abs(arrowAim.aimX + 0.44) < 1e-9);
  const duplicate = readPadelInput(
    held(["power", "right", "aimRight"]),
    center,
    0.1
  );
  assert.ok(Math.abs(duplicate.aimX - 0.44) < 1e-9);
  const opposing = readPadelInput(
    held(["power", "right", "left", "up", "down"]),
    center,
    0.1
  );
  assert.equal(opposing.aimX, 0);
  assert.equal(opposing.aimZ, 0);
});

test("charge aiming can reach beyond the lines and remains frame-rate independent", () => {
  const keys = held(["power", "right", "up", "aimRight", "aimUp"]);
  const simulate = (fps, seconds) => {
    let aim = { ...center };
    for (let frame = 0; frame < fps * seconds; frame++) {
      aim = readPadelInput(keys, aim, 1 / fps);
    }
    return aim;
  };
  const sixty = simulate(60, 0.2);
  const oneTwenty = simulate(120, 0.2);
  assert.ok(Math.abs(sixty.aimX - oneTwenty.aimX) < 1e-9);
  assert.ok(Math.abs(sixty.aimZ - oneTwenty.aimZ) < 1e-9);
  assert.ok(sixty.aimX > 0.85 && sixty.aimX < 1);
  const edge = simulate(60, 1);
  assert.equal(edge.aimX, AIM_LIMIT);
  assert.equal(edge.aimZ, -AIM_LIMIT);
  assert.ok(AIM_LIMIT > 1);
});

test("held movement and aim actions reach the simulation independently throughout a charged run", () => {
  const match = createMatch();
  match.start();
  match.phase = "rally";
  match.ball.active = false;
  const p = match.players[0];
  Object.assign(p, { x: 0, z: 8 });
  const keys = held(["power", "up", "right", "run", "aimLeft"]);
  let aim = { aimX: 0, aimZ: 0 };
  for (let frame = 0; frame < 60; frame++) {
    const controls = readPadelInput(keys, aim, 1 / 120);
    aim = { aimX: controls.aimX, aimZ: controls.aimZ };
    match.update(1 / 120, controls);
  }
  assert.ok(p.x > 1.8 && p.z < 6.2);
  assert.ok(Math.hypot(p.vx, p.vz) > 6.5);
  assert.equal(p.manualPreparation, true);
  assert.ok(Math.abs(match.charge - 0.5 / 0.9) < 1e-8);
  assert.equal(aim.aimX, -AIM_LIMIT);
  assert.equal(aim.aimZ, 0);
  assert.equal(match.ball.active, false);
  assert.ok(!match.consumeEvents().some((event) => event.type === "shot"));
});
