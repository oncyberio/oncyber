import test from "node:test";
import assert from "node:assert/strict";
import { advanceDeadBall } from "./dead-ball.js";
import { COURT, BALL_RADIUS, GRAVITY } from "./simulation.js";
const step = 1 / 120;
const physics = { court: COURT, radius: BALL_RADIUS, gravity: GRAVITY };
function dead(overrides = {}) {
  return {
    x: 0,
    y: 2,
    z: 4,
    vx: 2,
    vy: -1,
    vz: 1,
    dead: true,
    active: true,
    opacity: 1,
    ...overrides,
  };
}

test("dead balls bounce with diminishing impact, become rolling balls, and stop naturally", () => {
  const ball = dead();
  const impacts = [];
  let rolled = false;
  for (let frame = 0; frame < 120 * 10 && !ball.resting; frame++) {
    for (const e of advanceDeadBall(ball, step, physics))
      if (e.type === "bounce") impacts.push(e.impactSpeed);
    rolled ||= ball.rolling;
    assert.ok(ball.y >= BALL_RADIUS - 1e-8);
  }
  assert.ok(impacts.length >= 3);
  for (let i = 1; i < impacts.length; i++)
    assert.ok(impacts[i] < impacts[i - 1]);
  assert.ok(rolled && ball.resting);
  assert.deepEqual([ball.vx, ball.vy, ball.vz], [0, 0, 0]);
  assert.equal(ball.y, BALL_RADIUS);
});

test("dead balls still collide with physical glass and the net without emitting scoring events", () => {
  for (const [fixture, type] of [
    [{ z: 9.9, y: 1.2, vx: 0, vz: 8 }, "wall"],
    [{ x: 4.9, z: 3.5, y: 1.2, vx: 8, vz: 0 }, "wall"],
    [{ x: 0, z: 0.03, y: 0.4, vx: 0, vz: -8 }, "net"],
  ]) {
    const ball = dead(fixture);
    const events = advanceDeadBall(ball, step, physics);
    assert.ok(
      events.some((e) => e.type === type && e.dead && e.impactSpeed > 0)
    );
    assert.ok(
      events.every(
        (e) => !["point", "serve-fault", "serve-let"].includes(e.type)
      )
    );
  }
});

test("an escaped winner continues to the outside floor rather than hitting invisible extended walls", () => {
  const ball = dead({
    x: 1,
    y: 5,
    z: -10.1,
    vx: 0,
    vy: 18,
    vz: -25,
    escaped: true,
  });
  let firstBounce;
  for (let frame = 0; frame < 120 * 5 && !firstBounce; frame++) {
    const events = advanceDeadBall(ball, step, physics);
    assert.ok(!events.some((e) => e.type === "wall" || e.type === "net"));
    firstBounce = events.find((e) => e.type === "bounce");
  }
  assert.ok(firstBounce);
  assert.ok(firstBounce.position.z < -80);
  assert.equal(firstBounce.position.y, BALL_RADIUS);
  assert.ok(ball.vy > 0);
});

test("a rolling ball already moving away from a wall is not reflected back into it", () => {
  for (const direction of [-1, 1]) {
    for (const axis of ["x", "z"]) {
      const boundary =
        direction *
        ((axis === "x" ? COURT.halfWidth : COURT.halfLength) - BALL_RADIUS);
      const ball = dead({ x: 0, z: 8, y: BALL_RADIUS, vx: 0, vy: 0, vz: 0 });
      ball[axis] = boundary;
      ball[axis === "x" ? "vx" : "vz"] = -direction;
      const events = advanceDeadBall(ball, step, physics);
      assert.ok(!events.some((event) => event.type === "wall"));
      assert.ok(Math.abs(ball[axis]) < Math.abs(boundary));
      assert.equal(Math.sign(ball[axis === "x" ? "vx" : "vz"]), -direction);
    }
  }
});
