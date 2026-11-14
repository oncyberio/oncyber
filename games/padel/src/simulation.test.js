import test from "node:test";
import assert from "node:assert/strict";
import {
  createMatch,
  COURT,
  BALL_RADIUS,
  GRAVITY,
  predictLanding,
  predictCourtLanding,
  getShotPreview,
  getShotTrajectory,
  aimFromWorld,
  AIM_LIMIT,
  PREPARATION_ASSIST,
  predictPreparationContact,
  teamIndex,
} from "./simulation.js";
const step = 1 / 120;
const advance = (m, duration, input = {}) => {
  for (let i = 0; i < Math.round(duration / step); i++) m.update(step, input);
};
function recover(m) {
  for (let frame = 0; frame < 600 && m.recovering; frame++) m.update(step);
  assert.equal(
    m.recovering,
    false,
    "formation recovery should finish promptly"
  );
  if (m.phase === "serve") m.update(step); // A neutral frame arms a fresh manual serve.
}
function contactMatch(seed = 901) {
  const m = createMatch({ seed });
  m.start();
  m.phase = "rally";
  m.players[0].x = 0;
  m.players[0].z = 9;
  Object.assign(m.ball, {
    x: 0.5,
    y: 1.2,
    z: 9,
    vx: 0,
    vy: -1,
    vz: 13,
    active: true,
    lastHit: 1,
    bounces: 1,
    isServe: false,
  });
  return m;
}
function chargedMatch(charge = 0.82, seed = 901) {
  const m = contactMatch(seed);
  m.ball.active = false;
  advance(m, charge * 0.9, { powerHeld: true });
  Object.assign(m.ball, {
    x: 0.5,
    y: 1.2,
    z: 9,
    vx: 0,
    vy: -1,
    vz: 13,
    active: true,
    lastHit: 1,
    bounces: 1,
    isServe: false,
  });
  m.consumeEvents();
  return m;
}
function preparationMatch(ball = {}) {
  const m = contactMatch();
  Object.assign(m.ball, {
    x: 1.6,
    y: 1.2,
    z: 4.3,
    vx: 0,
    vy: 3.8,
    vz: 6,
    ...ball,
  });
  return m;
}
function forcePoint(m, winner) {
  m.phase = "rally";
  Object.assign(m.ball, {
    x: 0,
    y: BALL_RADIUS + 0.002,
    z: winner === 0 ? -10 : 10,
    vx: 0,
    vy: -2,
    vz: 0,
    active: true,
    lastHit: winner,
    bounces: 1,
    isServe: false,
    dead: false,
    rolling: false,
    resting: false,
  });
  m.update(step, {});
}

test("a visit-ready match does not run a point before Start or a manual serve", () => {
  const m = createMatch();
  advance(m, 3, { hit: true, powerHeld: true });
  assert.equal(m.phase, "ready");
  assert.equal(m.ball.active, false);
  assert.deepEqual(m.score, [0, 0]);
  m.start();
  advance(m, 3);
  assert.equal(m.phase, "serve");
  assert.equal(m.ball.active, false);
  m.update(step, { hit: true });
  assert.equal(m.phase, "rally");
  assert.equal(m.ball.lastHit, 0);
});

test("a perfect power release is faster than a control shot and matches its preview", () => {
  const m = chargedMatch();
  const input = { aimX: -0.75, aimZ: -0.6, powerHeld: true };
  const preview = getShotPreview(m, input);
  assert.equal(preview.qualityLabel, "Perfect");
  assert.equal(preview.safe, true);
  const control = getShotPreview(contactMatch(), { aimX: -0.75, aimZ: -0.6 });
  m.update(step, { ...input, powerHeld: false, powerReleased: true });
  const shot = m.consumeEvents().find((e) => e.type === "shot");
  assert.ok(shot.speed > control.speed * 1.12);
  assert.deepEqual(shot.target, preview.target);
  const landing = predictLanding(m.ball);
  assert.ok(Math.abs(landing.x - preview.target.x) < 1e-8);
  assert.ok(Math.abs(landing.z - preview.target.z) < 1e-8);
  assert.equal(m.charge, 0);
  assert.equal(m.ball.lastHit, 0);
});

test("overcharging a deep power shot risks out; selecting safer depth keeps it in", () => {
  const good = chargedMatch(0.85),
    late = chargedMatch(1.5);
  const goodPlan = getShotPreview(good, {
    aimX: 0.5,
    aimZ: -1,
    powerHeld: true,
  });
  const latePlan = getShotPreview(late, {
    aimX: 0.5,
    aimZ: -1,
    powerHeld: true,
  });
  assert.equal(goodPlan.safe, true);
  assert.equal(latePlan.qualityLabel, "Late");
  assert.ok(latePlan.radius > goodPlan.radius);
  assert.ok(Math.abs(latePlan.z) > COURT.halfLength + BALL_RADIUS);
  assert.equal(latePlan.safe, false);
  const conservative = getShotPreview(late, {
    aimX: 0,
    aimZ: 0.3,
    powerHeld: true,
  });
  assert.ok(Math.abs(conservative.z) < COURT.halfLength);
});

test("charging preserves manual running, charge timing, and independent shot aim", () => {
  const m = contactMatch();
  m.ball.active = false;
  advance(m, 0.2, { moveX: 1, moveZ: -1 });
  const p = m.players[0];
  const origin = { x: p.x, z: p.z };
  advance(m, 0.72, {
    powerHeld: true,
    moveX: 1,
    moveZ: -1,
    sprint: true,
    aimX: -0.4,
  });
  assert.ok(Math.hypot(p.x - origin.x, p.z - origin.z) > 4);
  assert.ok(Math.hypot(p.vx, p.vz) > 6);
  assert.ok(Math.abs(m.charge - (Math.round(0.72 / step) * step) / 0.9) < 1e-8);
  assert.equal(p.manualPreparation, true);
  assert.equal(p.assistActive, false);
  Object.assign(m.ball, {
    x: p.x - 0.3,
    y: 1.2,
    z: p.z,
    active: true,
    lastHit: 1,
  });
  const preview = getShotPreview(m, { powerHeld: true, aimX: -0.4 });
  const releaseOrigin = { x: p.x, z: p.z };
  m.update(step, { powerReleased: true, moveX: 1, moveZ: -1, aimX: -0.4 });
  assert.ok(
    Math.hypot(p.x - releaseOrigin.x, p.z - releaseOrigin.z) <=
      6.6 * step + 1e-8
  );
  assert.equal(p.manualPreparation, false);
  assert.equal(m.ball.lastHit, 0);
  const shot = m.consumeEvents().find((event) => event.type === "shot");
  assert.deepEqual(shot.target, preview.target);
  assert.equal(shot.qualityLabel, "Perfect");
});

test("buffered power releases preserve aim while assistance continues until contact", () => {
  const m = chargedMatch();
  Object.assign(m.ball, { z: 6.9, y: 1.6, vy: 0, vz: 7 });
  const input = { aimX: -0.6, aimZ: -0.4, powerHeld: true };
  const preview = getShotPreview(m, input);
  const p = m.players[0],
    planted = { x: p.x, z: p.z };
  m.update(step, { ...input, powerHeld: false, powerReleased: true });
  assert.equal(m.ball.lastHit, 1);
  for (let i = 0; i < 30 && m.ball.lastHit !== 0; i++) {
    m.update(step, { moveX: 1, moveZ: -1, aimX: AIM_LIMIT, aimZ: AIM_LIMIT });
    assert.ok(
      Math.hypot(p.x - planted.x, p.z - planted.z) <=
        PREPARATION_ASSIST.maxDistance
    );
  }
  assert.notDeepEqual({ x: p.x, z: p.z }, planted);
  const shot = m.consumeEvents().find((event) => event.type === "shot");
  assert.ok(shot);
  assert.deepEqual(shot.target, preview.target);
  assert.equal(shot.qualityLabel, "Perfect");
  const releasedX = p.x;
  m.update(step, { moveX: 1 });
  assert.ok(p.x > releasedX);
});

test("power release preserves its prepared stroke when the ball crosses the body threshold", () => {
  for (const buffered of [false, true]) {
    for (const [initialX, releaseX, stroke] of [
      [-0.1, -0.2, "forehand"],
      [-0.2, -0.1, "backhand"],
    ]) {
      const m = contactMatch();
      Object.assign(m.ball, { active: false, x: initialX });
      advance(m, 0.72, { powerHeld: true });
      assert.equal(m.players[0].preparedStroke, stroke);
      Object.assign(m.ball, {
        active: true,
        x: releaseX,
        z: buffered ? 6.9 : 9,
        y: 1.6,
        vy: 0,
        vz: 7,
      });
      const preview = getShotPreview(m, { powerHeld: true });
      assert.equal(preview.stroke, stroke);
      m.consumeEvents();
      m.update(step, { powerReleased: true });
      if (buffered) {
        assert.equal(m.ball.lastHit, 1);
        assert.equal(m.players[0].preparedStroke, stroke);
        assert.ok(m.players[0].charge > 0.68);
        for (let i = 0; i < 30 && m.ball.lastHit !== 0; i++) {
          assert.equal(m.players[0].preparedStroke, stroke);
          assert.ok(m.players[0].charge > 0.68);
          m.update(step);
        }
      }
      const shot = m.consumeEvents().find((event) => event.type === "shot");
      assert.ok(shot);
      assert.equal(shot.stroke, stroke);
      assert.deepEqual(shot.target, preview.target);
      assert.equal(m.players[0].charge, 0);
    }
  }
});

test("prepared strokes are validated, control shots use the real ball, and serves stay serves", () => {
  const invalid = chargedMatch();
  invalid.players[0].preparedStroke = "invalid";
  invalid.update(step, { powerReleased: true });
  assert.equal(invalid.players[0].padelStroke, "forehand");
  const control = chargedMatch();
  control.players[0].preparedStroke = "backhand";
  control.update(step, { hit: true });
  assert.equal(control.players[0].padelStroke, "forehand");
  const serving = createMatch();
  serving.start();
  advance(serving, 0.72, { powerHeld: true });
  serving.players[0].preparedStroke = "forehand";
  serving.update(step, { powerReleased: true });
  assert.equal(serving.players[0].padelStroke, "serve");
});

test("an unreachable release fails promptly and restores movement", () => {
  const m = chargedMatch();
  Object.assign(m.ball, { z: 0.5, y: 4, vy: 4, vz: 3 });
  m.update(step, { powerReleased: true });
  assert.equal(m.players[0].swingPending, false);
  const oldX = m.players[0].x;
  m.update(step, { moveX: 1 });
  assert.ok(m.players[0].x > oldX);
  assert.equal(m.players[0].charge, 0);
  assert.equal(m.players[0].preparedStroke, null);
  assert.ok(m.consumeEvents().some((event) => event.type === "miss"));
});

test("preparation without manual movement makes one smooth bounded adjustment", () => {
  const m = preparationMatch();
  const p = m.players[0];
  const predicted = predictPreparationContact(m);
  assert.ok(predicted);
  assert.equal(predicted.stroke, "forehand");
  assert.ok(predicted.contact.time >= PREPARATION_ASSIST.minTime);
  const origin = { x: p.x, z: p.z };
  let previousVelocity = { x: 0, z: 0 };
  let movingFrames = 0;
  for (let i = 0; i < 84; i++) {
    m.update(step, { powerHeld: true });
    assert.ok(
      Math.hypot(p.x - origin.x, p.z - origin.z) <=
        PREPARATION_ASSIST.maxDistance
    );
    assert.ok(Math.hypot(p.vx, p.vz) <= PREPARATION_ASSIST.maxSpeed + 1e-8);
    assert.ok(
      Math.hypot(p.vx - previousVelocity.x, p.vz - previousVelocity.z) / step <=
        PREPARATION_ASSIST.maxAcceleration + 1e-8
    );
    previousVelocity = { x: p.vx, z: p.vz };
    if (p.assistActive) movingFrames++;
    assert.equal(p.preparedStroke, "forehand");
  }
  assert.ok(movingFrames > 20);
  assert.equal(p.assistActive, false);
  assert.deepEqual({ x: p.x, z: p.z }, predicted.target);
  assert.ok(p.contactTimeToHit < 0.1);
  assert.ok(Math.abs(m.ball.x - p.x - 0.7) < 1e-8);
  const preview = getShotPreview(m, {
    powerHeld: true,
    aimX: AIM_LIMIT,
    aimZ: -AIM_LIMIT,
  });
  assert.equal(preview.qualityLabel, "Perfect");
  m.update(step, { powerReleased: true, aimX: AIM_LIMIT, aimZ: -AIM_LIMIT });
  for (let i = 0; i < 20 && m.ball.lastHit !== 0; i++) m.update(step);
  const shot = m
    .consumeEvents()
    .find((event) => event.type === "shot" && event.playerIndex === 0);
  assert.ok(shot);
  assert.deepEqual(shot.target, preview.target);
  assert.equal(shot.stroke, "forehand");
  assert.equal(p.assistTarget, null);
});

test("preparation chooses stable forehand or backhand spacing instead of chasing the ball", () => {
  for (const [x, stroke, spacing] of [
    [1.6, "forehand", 0.7],
    [-1.6, "backhand", -0.7],
  ]) {
    const m = preparationMatch({ x });
    const predicted = predictPreparationContact(m);
    assert.equal(predicted.stroke, stroke);
    assert.ok(
      Math.abs(predicted.contact.x - predicted.target.x - spacing) < 1e-8
    );
    m.update(step, { powerHeld: true });
    const target = { ...m.players[0].assistTarget };
    m.ball.x = -x;
    advance(m, 0.2, { powerHeld: true });
    assert.deepEqual(m.players[0].assistTarget, target);
    assert.equal(m.players[0].preparedStroke, stroke);
  }
});

test("contact assistance predicts through a legal bounce and never a second bounce", () => {
  const m = preparationMatch({
    x: 1.4,
    y: 2,
    z: 3.7,
    vy: -2,
    vz: 8,
    bounces: 0,
  });
  const predicted = predictPreparationContact(m);
  assert.ok(predicted?.afterBounce);
  advance(m, predicted.contact.time, { powerHeld: true });
  assert.equal(m.ball.bounces, 1);
  assert.ok(Math.abs(m.ball.x - predicted.contact.x) < 0.06);
  assert.ok(Math.abs(m.ball.y - predicted.contact.y) < 0.06);
  assert.ok(Math.abs(m.ball.z - predicted.contact.z) < 0.06);
  const dead = preparationMatch({ y: 0.15, vy: -2, vz: 3, z: 8.1, bounces: 1 });
  assert.equal(predictPreparationContact(dead), null);
});

test("preparation waits for distant or outgoing passages and acquires an incoming ball later", () => {
  const setups = [
    { z: 10.8, y: 1.1, vy: -1 },
    { x: 5.2 },
    { z: -10, y: 4, vy: 1 },
    { lastHit: 0 },
    { vz: -6 },
    { active: false },
  ];
  for (const setup of setups) {
    const m = preparationMatch(setup);
    const p = m.players[0],
      origin = { x: p.x, z: p.z };
    assert.equal(predictPreparationContact(m), null, JSON.stringify(setup));
    m.update(step, { powerHeld: true });
    assert.equal(p.assistActive, false);
    assert.deepEqual({ x: p.x, z: p.z }, origin);
  }
  const tooEarly = preparationMatch({ active: false });
  tooEarly.update(step, { powerHeld: true });
  tooEarly.ball.active = true;
  advance(tooEarly, 0.3, { powerHeld: true });
  assert.ok(
    tooEarly.players[0].assistTarget,
    "preparation acquires the ball as it enters range"
  );
  assert.ok(tooEarly.players[0].x > 0);
});

test("service preparation waits for a legal diagonal bounce and rejects net-bound balls", () => {
  const served = preparationMatch({
    x: 1.4,
    y: 2,
    z: 1.8,
    vy: -2,
    vz: 8,
    bounces: 0,
    isServe: true,
    serviceXSign: 1,
  });
  const predicted = predictPreparationContact(served);
  assert.ok(predicted?.afterBounce);
  assert.ok(predicted.contact.time > predictLanding(served.ball).time);
  served.ball.serviceXSign = -1;
  assert.equal(predictPreparationContact(served), null);
  const net = preparationMatch({
    x: 1,
    y: 1,
    z: -1,
    vy: -2,
    vz: 10,
    bounces: 0,
  });
  assert.equal(predictPreparationContact(net), null);
});

test("cancellation and a point stop assistance without a position snap", () => {
  for (const cancel of ["blur", "point", "reset"]) {
    const m = preparationMatch();
    advance(m, 0.1, { powerHeld: true });
    assert.equal(m.players[0].assistActive, true);
    const position = { x: m.players[0].x, z: m.players[0].z };
    if (cancel === "blur") m.cancelInput();
    if (cancel === "reset") m.reset();
    if (cancel === "point") {
      Object.assign(m.ball, { y: BALL_RADIUS + 0.001, vy: -1, bounces: 1 });
      m.update(step, { powerHeld: true });
      assert.equal(m.phase, "point");
    }
    const p = m.players[0];
    assert.equal(p.assistActive, false);
    assert.equal(p.assistTarget, null);
    assert.equal(p.assistContact, null);
    assert.equal(p.contactTimeToHit, null);
    if (cancel !== "point") {
      assert.equal(p.vx, 0);
      assert.equal(p.vz, 0);
    } else assert.ok(Math.hypot(p.vx, p.vz) <= PREPARATION_ASSIST.maxSpeed);
    if (cancel === "blur") assert.deepEqual({ x: p.x, z: p.z }, position);
  }
});

test("preparation assistance is identical at 60Hz and 120Hz", () => {
  const a = preparationMatch(),
    b = preparationMatch();
  for (let i = 0; i < 42; i++) {
    const input = { powerHeld: true, moveX: 1, moveZ: -1 };
    a.update(1 / 60, input);
    b.update(step, input);
    b.update(step, input);
  }
  assert.deepEqual(a.players, b.players);
  assert.deepEqual(a.ball, b.ball);
  assert.equal(a.charge, b.charge);
});

test("normal movement into an NPC return followed by timely preparation yields reachable sweet-spot shots", () => {
  for (let seed = 1; seed <= 12; seed++) {
    const m = createMatch({ seed });
    m.start();
    m.update(step, { hit: true });
    m.consumeEvents();
    let preparing = false,
      assisted = false,
      shot = null;
    for (
      let frame = 0;
      frame < 120 * 7 && !shot && m.phase === "rally";
      frame++
    ) {
      const b = m.ball,
        p = m.players[0],
        input = {};
      if (teamIndex(b.lastHit) === 1) {
        const predicted = predictPreparationContact(m);
        if (
          !preparing &&
          predicted &&
          predicted.contact.time >= 0.63 &&
          predicted.contact.time <= 0.8
        )
          preparing = true;
        if (preparing) {
          input.powerHeld = true;
          const preview = getShotPreview(m, input);
          if (preview.qualityLabel === "Perfect" && preview.ready) {
            input.powerHeld = false;
            input.powerReleased = true;
          }
        } else {
          // Walk toward the expected receiving area with ordinary controls;
          // neither the test nor the assistance teleports the player there.
          const landing = predictLanding(b);
          const contact = b.bounces
            ? predictLanding(b, 1.1)
            : landing &&
              predictLanding(
                {
                  ...landing,
                  vx: b.vx * 0.88,
                  vz: b.vz * 0.88,
                  vy: -(b.vy - GRAVITY * landing.time) * 0.78,
                },
                1.1
              );
          if (contact) {
            input.moveX = contact.x - 0.7 - p.x;
            input.moveZ = contact.z + 0.38 - p.z;
            input.sprint = true;
          }
        }
      } else {
        input.moveX = -p.x;
        input.moveZ = 7.8 - p.z;
      }
      m.update(step, input);
      assisted ||= p.assistActive;
      shot = m
        .consumeEvents()
        .find((event) => event.type === "shot" && event.playerIndex === 0);
    }
    assert.ok(assisted, `no assistance on NPC return ${seed}`);
    assert.ok(shot, `no reachable return ${seed}`);
    assert.equal(shot.qualityLabel, "Perfect");
    const landing = predictLanding(m.ball);
    assert.ok(landing.inBounds);
    assert.ok(landing.z < 0);
  }
});

test("only the blue timing window is Perfect", () => {
  const m = contactMatch();
  for (const [charge, label] of [
    [0.67, "Good"],
    [0.68, "Perfect"],
    [0.82, "Perfect"],
    [0.98, "Perfect"],
    [0.99, "Good"],
  ]) {
    m.charge = charge;
    assert.equal(getShotPreview(m, { powerHeld: true }).qualityLabel, label);
  }
});

test("sweet-spot edge aims actually clear the net and bounce inside the enclosure or the diagonal service box", () => {
  const setups = [
    { serveX: -1.65 },
    { serveX: 1.65 },
    { serveX: 0 },
    { x: -4.5, z: 0.2, y: 0.18 },
    { x: 0.5, z: 9, y: 1.2 },
    { x: 4.5, z: 3, y: 2.7 },
  ];
  for (const setup of setups) {
    for (const charge of [0.68, 0.82, 0.98]) {
      for (const aimX of [-AIM_LIMIT, 0, AIM_LIMIT]) {
        for (const aimZ of [-AIM_LIMIT, 0, AIM_LIMIT]) {
          const serving = setup.serveX !== undefined;
          const m = serving ? createMatch() : contactMatch();
          if (serving) {
            m.start();
            m.players[0].x = setup.serveX;
          } else {
            Object.assign(m.ball, { x: setup.x, z: setup.z, y: setup.y });
            m.players[0].x = setup.x;
            m.players[0].z = Math.max(0.9, setup.z);
          }
          m.charge = charge;
          const preview = getShotPreview(m, { aimX, aimZ, powerHeld: true });
          assert.equal(preview.qualityLabel, "Perfect");
          assert.equal(preview.safe, true);
          m.consumeEvents();
          m.update(step, { aimX, aimZ, powerReleased: true });
          const landing = predictLanding(m.ball);
          assert.ok(Math.abs(landing.x - preview.x) < 1e-8);
          assert.ok(Math.abs(landing.z - preview.z) < 1e-8);
          let bounce, intercepted;
          for (let i = 0; i < 120 * 8 && !bounce; i++) {
            const events = m.consumeEvents();
            assert.equal(
              events.some((event) => event.type === "net"),
              false
            );
            assert.equal(
              events.some((event) => event.type === "serve-fault"),
              false
            );
            bounce = events.find((event) => event.type === "bounce");
            intercepted = events.find(
              (event) =>
                event.type === "shot" && teamIndex(event.playerIndex) === 1
            );
            if (intercepted) break;
            if (!bounce) m.update(step);
          }
          if (intercepted) {
            assert.equal(serving, false, "serves cannot be volleyed");
            assert.ok(intercepted.position.z < 0);
            continue;
          }
          assert.ok(
            bounce,
            `No bounce for ${JSON.stringify({ setup, charge, aimX, aimZ })}`
          );
          assert.equal(bounce.inBounds, true);
          assert.ok(Math.abs(bounce.position.x) < COURT.halfWidth);
          assert.ok(bounce.position.z < 0);
          assert.ok(
            Math.abs(bounce.position.z) <
              (serving ? COURT.serviceLine : COURT.halfLength)
          );
          if (serving)
            assert.equal(
              Math.sign(bounce.position.x),
              -Math.sign(setup.serveX || 1)
            );
        }
      }
    }
  }
});

test("missed timing keeps conservative targets legal while aggressive targets can go out", () => {
  for (let seed = 1; seed <= 24; seed++) {
    for (const serving of [false, true]) {
      const m = serving ? createMatch({ seed }) : contactMatch(seed);
      if (serving) m.start();
      for (const charge of [0.2, 0.58, 1.04, 1.5]) {
        m.charge = charge;
        assert.equal(
          getShotPreview(m, { aimX: 0, aimZ: 0, powerHeld: true }).safe,
          true
        );
      }
      m.charge = 1.5;
      const aggressive = getShotPreview(m, {
        aimX: -AIM_LIMIT,
        aimZ: -AIM_LIMIT,
        powerHeld: true,
      });
      assert.equal(aggressive.qualityLabel, "Late");
      assert.equal(aggressive.safe, false);
      m.update(step, {
        aimX: -AIM_LIMIT,
        aimZ: -AIM_LIMIT,
        powerReleased: true,
      });
      const shot = m.consumeEvents().find((event) => event.type === "shot");
      assert.deepEqual(shot.target, aggressive.target);
    }
  }
});

test("aimFromWorld tracks the cursor in rally and the diagonal service box", () => {
  const m = contactMatch();
  for (const powered of [false, true]) {
    m.charge = powered ? 0.8 : 0;
    const target = { x: -2.3, z: -8.3 };
    const input = {
      ...aimFromWorld(m, target.x, target.z, { powerHeld: powered }),
      powerHeld: powered,
    };
    const preview = getShotPreview(m, input);
    assert.ok(Math.abs(preview.x - target.x) < 0.05);
    assert.ok(Math.abs(preview.z - target.z) < 0.05);
  }
  const s = createMatch();
  s.start();
  const preview = getShotPreview(s, aimFromWorld(s, -2.5, -5.5));
  assert.ok(Math.abs(preview.x + 2.5) < 0.05);
  assert.ok(Math.abs(preview.z + 5.5) < 0.05);
  assert.equal(preview.safe, true);
});

test("a nearby incoming ball is never returned without a player swing", () => {
  const m = contactMatch();
  advance(m, 4);
  const events = m.consumeEvents();
  assert.equal(
    events.some((e) => e.type === "shot" && e.playerIndex === 0),
    false
  );
  assert.equal(m.score[1], 1);
});

test("a swing can buffer briefly before contact, but cannot remotely hit a ball", () => {
  const buffered = contactMatch();
  buffered.ball.z = 6.9;
  buffered.ball.y = 1.6;
  buffered.ball.vy = 0;
  buffered.ball.vz = 7;
  buffered.update(step, { hit: true });
  advance(buffered, 0.2);
  assert.equal(buffered.ball.lastHit, 0);
  const remote = contactMatch();
  remote.ball.x = 8;
  remote.update(step, { hit: true });
  advance(remote, 0.35);
  assert.equal(remote.ball.lastHit, 1);
  assert.equal(
    remote
      .consumeEvents()
      .some((e) => e.type === "shot" && e.playerIndex === 0),
    false
  );
});

test("serves must bounce before they can be returned", () => {
  const m = contactMatch();
  m.ball.isServe = true;
  m.ball.bounces = 0;
  m.update(step, { hit: true });
  assert.equal(m.ball.lastHit, 1);
});

test("first bounce outside court lines loses the point; second bounce outside wins it", () => {
  const out = contactMatch();
  Object.assign(out.ball, {
    x: COURT.halfWidth + 0.2,
    y: BALL_RADIUS + 0.001,
    z: -7,
    vx: 0,
    vy: -1,
    vz: 0,
    lastHit: 0,
    bounces: 0,
  });
  out.update(step);
  assert.deepEqual(out.score, [0, 1]);
  assert.equal(out.pointReason, "Out");
  const twice = contactMatch();
  Object.assign(twice.ball, {
    x: 5,
    y: BALL_RADIUS + 0.001,
    z: -14,
    vx: 0,
    vy: -1,
    vz: 0,
    lastHit: 0,
    bounces: 1,
  });
  twice.update(step);
  assert.deepEqual(twice.score, [1, 0]);
  assert.equal(twice.pointReason, "Second bounce");
});

test("a low shot crossing the net loses the point", () => {
  const m = contactMatch();
  Object.assign(m.ball, {
    x: 0,
    y: 0.5,
    z: 0.04,
    vx: 0,
    vy: 0,
    vz: -15,
    lastHit: 0,
    bounces: 0,
  });
  m.update(step);
  assert.equal(m.pointReason, "Net");
  assert.deepEqual(m.score, [0, 1]);
});

test("a first fault grants a second serve and a second fault awards the opponent", () => {
  const m = createMatch();
  m.start();
  for (let attempt = 1; attempt <= 2; attempt++) {
    m.update(step, { hit: true });
    Object.assign(m.ball, {
      x: 5,
      y: BALL_RADIUS + 0.001,
      z: -4,
      vx: 0,
      vy: -1,
      vz: 0,
    });
    m.update(step);
    if (attempt === 1) {
      assert.equal(m.phase, "point");
      assert.equal(m.recoveryKind, "fault");
      assert.equal(m.serveAttempt, 2);
      recover(m);
      assert.equal(m.phase, "serve");
      assert.deepEqual(m.score, [0, 0]);
    }
  }
  assert.deepEqual(m.score, [0, 1]);
  assert.equal(m.pointReason, "Double fault");
  assert.equal(
    m.consumeEvents().filter((e) => e.type === "serve-fault").length,
    2
  );
});

test("a service landing on the wrong diagonal faults even inside the court", () => {
  const m = createMatch();
  m.start();
  m.update(step, { hit: true });
  Object.assign(m.ball, {
    x: 2,
    y: BALL_RADIUS + 0.001,
    z: -4,
    vx: 0,
    vy: -1,
    vz: 0,
  });
  m.update(step);
  assert.equal(m.serveAttempt, 2);
  assert.deepEqual(m.score, [0, 0]);
});

test("the diagonal service target remains fixed if the server moves after hitting", () => {
  const m = createMatch();
  m.start();
  m.update(step, { hit: true });
  m.players[0].x = -2;
  Object.assign(m.ball, {
    x: -2,
    y: BALL_RADIUS + 0.001,
    z: -4,
    vx: 0,
    vy: -1,
    vz: 0,
  });
  m.update(step);
  assert.equal(m.serveAttempt, 1);
  assert.equal(m.ball.bounces, 1);
});

test("exhibition service rotates all four players: one serve, then two each", () => {
  const m = createMatch();
  m.start();
  const servers = [];
  for (let i = 0; i < 6; i++) {
    servers.push(m.server);
    forcePoint(m, i % 2);
    recover(m);
  }
  assert.deepEqual(servers, [0, 1, 1, 2, 2, 3]);
});

test("the match requires a two-point lead and ends at the fifteen-point cap", () => {
  const m = createMatch();
  m.start();
  for (let i = 0; i < 12; i++) {
    forcePoint(m, i % 2);
    if (m.phase === "point") recover(m);
  }
  assert.deepEqual(m.score, [6, 6]);
  forcePoint(m, 0);
  assert.equal(m.phase, "point");
  recover(m);
  forcePoint(m, 0);
  assert.equal(m.phase, "finished");
  assert.equal(m.winner, 0);
  assert.deepEqual(m.score, [8, 6]);
  const cap = createMatch();
  cap.start();
  for (let i = 0; i < 28; i++) {
    forcePoint(cap, i % 2);
    recover(cap);
  }
  assert.deepEqual(cap.score, [14, 14]);
  forcePoint(cap, 1);
  assert.equal(cap.phase, "finished");
  assert.equal(cap.winner, 1);
});

test("NPCs return opening serves reliably; a stationary human can be covered by the partner", () => {
  for (let seed = 1; seed <= 24; seed++) {
    const m = createMatch({ seed });
    m.start();
    m.update(step, { hit: true });
    advance(m, 4.5);
    const shots = m.consumeEvents().filter((e) => e.type === "shot");
    assert.ok(
      shots.some((e) => teamIndex(e.playerIndex) === 1),
      `NPC did not return seed ${seed}`
    );
    assert.ok(
      m.score[1] === 1 || shots.some((e) => e.playerIndex === 2),
      `neither a point nor partner coverage for seed ${seed}`
    );
  }
});

test("physics is independent of 60Hz or 120Hz rendering", () => {
  const a = createMatch({ seed: 2 }),
    b = createMatch({ seed: 2 });
  a.start();
  b.start();
  a.update(1 / 60, { hit: true });
  b.update(step, { hit: true });
  b.update(step);
  for (let i = 0; i < 100; i++) {
    a.update(1 / 60);
    b.update(step);
    b.update(step);
  }
  assert.deepEqual(a.ball, b.ball);
  assert.deepEqual(a.players, b.players);
  assert.deepEqual(a.score, b.score);
});

test("short render frames preserve one-shot input and cancellation prevents ghost releases", () => {
  const m = createMatch();
  m.start();
  m.update(step / 2, { hit: true });
  assert.equal(m.ball.active, false);
  m.update(step / 2);
  assert.equal(m.ball.active, true);
  const charged = chargedMatch();
  charged.cancelInput();
  assert.equal(charged.charge, 0);
  advance(charged, 0.1);
  assert.equal(charged.ball.lastHit, 1);
});

test("predictLanding agrees with a ballistic flight and rejects invalid input", () => {
  const ball = { x: 1, y: 2, z: 4, vx: 3, vy: 5, vz: -9 };
  const landing = predictLanding(ball);
  assert.ok(
    Math.abs(
      ball.y +
        ball.vy * landing.time -
        0.5 * GRAVITY * landing.time ** 2 -
        BALL_RADIUS
    ) < 1e-9
  );
  assert.equal(predictLanding({ ...ball, vx: NaN }), null);
});

test("positioned, explicitly requested control shots sustain a playable rally against the NPC", () => {
  const m = createMatch({ seed: 1 });
  m.start();
  let longest = 0,
    humanShots = 0,
    npcShots = 0;
  for (let frame = 0; frame < 120 * 25; frame++) {
    const b = m.ball,
      p = m.players[0],
      input = {};
    if (m.phase === "serve" && m.server === 0) input.hit = true;
    if (m.phase === "rally" && teamIndex(b.lastHit) === 1) {
      let target;
      if (b.bounces > 0) target = predictLanding(b, 1.1);
      else {
        const landing = predictLanding(b);
        if (landing)
          target = predictLanding(
            {
              ...landing,
              vx: b.vx * 0.88,
              vz: b.vz * 0.88,
              vy: -(b.vy - GRAVITY * landing.time) * 0.78,
            },
            1.1
          );
      }
      if (target) {
        const dx = target.x - p.x,
          dz = Math.max(0.9, Math.min(9.3, target.z)) - p.z;
        const distance = Math.max(1, Math.hypot(dx, dz));
        input.moveX = dx / distance;
        input.moveZ = dz / distance;
        input.sprint = true;
      }
      input.hit = b.bounces > 0 && b.vy < 1;
      input.aimX = 0.35 * Math.sin(frame * 0.003);
      input.aimZ = -0.25;
    } else if (m.phase === "rally") {
      input.moveX = -p.x;
      input.moveZ = 7.8 - p.z;
    }
    m.update(step, input);
    longest = Math.max(longest, m.rallyHits);
    for (const event of m.consumeEvents())
      if (event.type === "shot") {
        if (event.playerIndex === 0) humanShots++;
        else npcShots++;
      }
  }
  assert.ok(longest >= 8, `longest rally was only ${longest}`);
  assert.ok(humanShots >= 4 && npcShots >= 4);
});

test("slightly off-line control and power strokes connect at the real ball with reach feedback", () => {
  for (const powered of [false, true]) {
    for (const x of [-2.2, -1.8, 1.8, 2.2]) {
      const m = powered ? chargedMatch() : contactMatch();
      m.ball.x = x;
      const contact = { x: m.ball.x, y: m.ball.y, z: m.ball.z };
      const preview = getShotPreview(m, {
        powerHeld: powered,
        aimX: AIM_LIMIT,
        aimZ: -AIM_LIMIT,
      });
      m.update(step, {
        hit: !powered,
        powerReleased: powered,
        aimX: AIM_LIMIT,
        aimZ: -AIM_LIMIT,
      });
      const shot = m
        .consumeEvents()
        .find((event) => event.type === "shot" && event.playerIndex === 0);
      assert.ok(shot, `missed ${powered ? "power" : "control"} at x=${x}`);
      assert.deepEqual(
        shot.position,
        contact,
        "contact does not teleport the ball to the racket"
      );
      assert.equal(shot.contactKind, Math.abs(x) > 1.85 ? "stretch" : "reach");
      assert.ok(shot.contactQuality < 1);
      assert.equal(m.lastFeedback.contactKind, shot.contactKind);
      assert.deepEqual(m.players[0].contactPoint, contact);
      assert.equal(m.players[0].swingPending, false);
      if (powered) {
        assert.equal(shot.qualityLabel, "Perfect");
        assert.deepEqual(shot.target, preview.target);
        assert.equal(predictLanding(m.ball).inBounds, true);
      }
    }
  }
});

test("defensive stretch returns lose pace while a clean swing keeps its power", () => {
  const speeds = [];
  for (const x of [0.7, 1.8, 2.2]) {
    const m = chargedMatch();
    m.ball.x = x;
    m.update(step, { powerReleased: true, aimX: 0, aimZ: -0.3 });
    const shot = m.consumeEvents().find((event) => event.type === "shot");
    speeds.push(shot.speed);
    assert.equal(shot.qualityLabel, "Perfect");
    assert.equal(predictLanding(m.ball).inBounds, true);
  }
  assert.ok(speeds[0] > speeds[1] && speeds[1] > speeds[2]);
  assert.ok(speeds[2] < speeds[0] * 0.9);
});

test("early control presses and power releases commit once, keep aiming fixed, and move into contact", () => {
  for (const powered of [false, true]) {
    const m = powered ? chargedMatch() : contactMatch();
    Object.assign(m.ball, { x: 1.6, y: 1.2, z: 4.3, vx: 0, vy: 3.8, vz: 6 });
    const p = m.players[0],
      origin = { x: p.x, z: p.z },
      started = m.time;
    const preview = getShotPreview(m, {
      aimX: -0.6,
      aimZ: -0.5,
      powerHeld: powered,
    });
    m.update(step, {
      hit: !powered,
      powerReleased: powered,
      aimX: -0.6,
      aimZ: -0.5,
    });
    assert.equal(p.swingPending, true);
    assert.equal(getShotPreview(m).committed, true);
    assert.equal(getShotPreview(m).waiting, true);
    assert.equal(getShotPreview(m).reachable, true);
    assert.deepEqual(
      getShotPreview(m, { aimX: 1, aimZ: 1 }).target,
      preview.target
    );
    let shot;
    for (let i = 0; i < 120 && !shot; i++) {
      const realBall = { x: m.ball.x, y: m.ball.y, z: m.ball.z };
      // Duplicate controls and different aim must not restart or replace this stroke.
      m.update(step, { hit: true, aimX: 1, aimZ: 1, moveX: -1, moveZ: 1 });
      assert.ok(
        Math.hypot(p.x - origin.x, p.z - origin.z) <=
          PREPARATION_ASSIST.maxDistance + 1e-8
      );
      shot = m
        .consumeEvents()
        .find((event) => event.type === "shot" && event.playerIndex === 0);
      if (shot) assert.deepEqual(shot.position, realBall);
    }
    assert.ok(shot);
    assert.ok(
      shot.time - started > 0.4 &&
        shot.time - started < PREPARATION_ASSIST.commitmentTime
    );
    assert.ok(Math.hypot(p.x - origin.x, p.z - origin.z) > 0.5);
    assert.deepEqual(shot.target, preview.target);
    assert.equal(shot.powered, powered);
    assert.equal(shot.qualityLabel, powered ? "Perfect" : "Control");
    assert.equal(p.swingPending, false);
    advance(m, 0.15, { hit: true });
    assert.equal(
      m
        .consumeEvents()
        .filter((event) => event.type === "shot" && event.playerIndex === 0)
        .length,
      0
    );
  }
});

test("a short late grace catches the actual passing ball but cannot bring back an escaped ball", () => {
  const late = contactMatch();
  Object.assign(late.ball, { x: 0.3, z: 10.7, vz: 13 });
  late.update(step, { hit: true });
  const shot = late.consumeEvents().find((event) => event.type === "shot");
  assert.ok(shot);
  assert.equal(shot.position.z, 10.7);
  assert.equal(shot.contactKind, "reach");
  const escaped = contactMatch();
  Object.assign(escaped.ball, { x: 0.3, z: 11.4, vz: 13 });
  escaped.update(step, { hit: true });
  assert.equal(escaped.ball.lastHit, 1);
  assert.equal(escaped.players[0].swingPending, false);
  assert.ok(
    escaped
      .consumeEvents()
      .some((event) => event.type === "miss" && event.reason === "unreachable")
  );
});

test("a clearly unreachable control request does not freeze manual movement", () => {
  const m = preparationMatch({ x: 6 });
  m.players[0].x = -6;
  assert.equal(predictPreparationContact(m), null);
  m.update(step, { hit: true });
  assert.equal(m.players[0].swingPending, false);
  assert.equal(m.pendingShot, null);
  m.update(step, { moveX: 1 });
  assert.ok(m.players[0].x > -6);
  assert.equal(m.ball.lastHit, 1);
});

test("cancelling a committed correction clears the stroke and cannot cause a later ghost hit", () => {
  const m = preparationMatch();
  m.update(step, { hit: true });
  advance(m, 0.15);
  assert.equal(m.players[0].swingPending, true);
  assert.equal(m.players[0].assistActive, true);
  m.cancelInput();
  assert.equal(m.pendingShot, null);
  assert.equal(m.players[0].swingPending, false);
  assert.equal(m.players[0].vx, 0);
  assert.equal(m.players[0].vz, 0);
  advance(m, 2);
  assert.equal(
    m
      .consumeEvents()
      .some((event) => event.type === "shot" && event.playerIndex === 0),
    false
  );
});

test("an early committed service return waits through the legal first bounce", () => {
  const m = preparationMatch({
    x: 1.4,
    y: 2,
    z: 1.8,
    vy: -2,
    vz: 8,
    bounces: 0,
    isServe: true,
    serviceXSign: 1,
  });
  const bounceTime = predictLanding(m.ball).time;
  m.consumeEvents();
  m.update(step, { hit: true });
  assert.equal(m.ball.lastHit, 1);
  assert.equal(m.players[0].swingPending, true);
  let shot,
    legalBounce = false;
  for (let i = 0; i < 120 && !shot; i++) {
    m.update(step);
    for (const event of m.consumeEvents()) {
      if (event.type === "bounce") legalBounce ||= event.inBounds;
      if (event.type === "shot" && event.playerIndex === 0) shot = event;
    }
  }
  assert.ok(legalBounce);
  assert.ok(shot);
  assert.ok(shot.time > bounceTime);
});

test("imperfect positioning and early manual requests sustain rallies across varied NPC returns", () => {
  for (let seed = 1; seed <= 16; seed++) {
    const m = createMatch({ seed });
    m.start();
    let lastRequested = -1,
      longest = 0,
      returns = 0;
    for (let frame = 0; frame < 120 * 30; frame++) {
      const b = m.ball,
        p = m.players[0];
      const input = { aimX: 0.22 * Math.sin(frame * 0.002), aimZ: -0.3 };
      if (m.phase === "serve" && m.server === 0) input.hit = true;
      if (m.phase === "rally" && teamIndex(b.lastHit) === 1) {
        const bounce = predictLanding(b);
        const target = b.bounces
          ? predictLanding(b, 1.1)
          : bounce &&
            predictLanding(
              {
                ...bounce,
                vx: b.vx * 0.88,
                vz: b.vz * 0.88,
                vy: -(b.vy - GRAVITY * bounce.time) * 0.78,
              },
              1.1
            );
        if (target) {
          // Deliberately stop to one side instead of following the exact ball line.
          input.moveX = target.x + Math.sin(seed * 3.1) * 1.15 - p.x;
          input.moveZ = target.z + 0.65 - p.z;
          input.sprint = true;
        }
        const passage = predictPreparationContact(m);
        if (lastRequested !== m.rallyHits && passage?.contact.time < 0.8) {
          input.hit = true;
          lastRequested = m.rallyHits;
        }
      } else {
        input.moveX = -p.x;
        input.moveZ = 7.8 - p.z;
      }
      m.update(step, input);
      longest = Math.max(longest, m.rallyHits);
      for (const event of m.consumeEvents())
        if (event.type === "shot" && event.playerIndex === 0 && !event.serving)
          returns++;
    }
    assert.ok(longest >= 12, `seed ${seed}: longest rally ${longest}`);
    assert.ok(returns >= 7, `seed ${seed}: only ${returns} manual returns`);
  }
});

test("fast incoming passages retain a committed stroke across render frame sizes", () => {
  for (const speed of [18, 26, 34]) {
    const a = contactMatch(),
      b = contactMatch();
    for (const m of [a, b])
      Object.assign(m.ball, { x: 2.2, z: 8.3, vz: speed });
    a.update(1 / 30, { hit: true });
    b.update(step, { hit: true });
    for (let i = 0; i < 3; i++) b.update(step);
    const shots = [a, b].map((m) =>
      m
        .consumeEvents()
        .filter((event) => event.type === "shot" && event.playerIndex === 0)
    );
    assert.equal(shots[0].length, 1, `fast passage at ${speed}m/s missed`);
    assert.deepEqual(shots[0], shots[1]);
    assert.deepEqual(a.ball, b.ball);
    assert.deepEqual(a.players, b.players);
  }
});

test("the idle in-reach cue promises an accepted control shot on approaching NPC returns", () => {
  for (const seed of [3107, ...Array.from({ length: 16 }, (_, i) => i + 1)]) {
    const m = createMatch({ seed });
    m.start();
    m.update(step, { hit: true, aimX: 0, aimZ: -0.25 });
    m.consumeEvents();
    let requested = false,
      returnShot = null;
    for (
      let frame = 0;
      frame < 120 * 7 && m.phase === "rally" && !returnShot;
      frame++
    ) {
      const input = { aimX: 0, aimZ: -0.25 };
      if (teamIndex(m.ball.lastHit) === 1 && !requested) {
        const preview = getShotPreview(m, input);
        if (preview.reachable) {
          input.hit = true;
          requested = true;
        }
      }
      m.update(step, input);
      const events = m.consumeEvents();
      assert.equal(
        events.some((event) => event.type === "miss"),
        false,
        `cue promised an unreachable stroke for seed ${seed}`
      );
      if (input.hit)
        assert.ok(
          m.players[0].swingPending || m.ball.lastHit === 0,
          `cue was not accepted for seed ${seed}`
        );
      returnShot = events.find(
        (event) => event.type === "shot" && event.playerIndex === 0
      );
    }

    assert.ok(requested, `seed ${seed} never offered a committable return`);
    assert.ok(returnShot, `cue did not produce a return for seed ${seed}`);
  }
});

function enclosedBall(overrides = {}) {
  const m = createMatch();
  m.start();
  m.phase = "rally";
  for (let index = 0; index < 4; index++) {
    m.players[index].x = index < 2 ? -4.5 : 4.5;
    m.players[index].z = teamIndex(index) === 0 ? 0.8 : -0.8;
  }
  Object.assign(m.ball, {
    x: 0,
    y: 1.2,
    z: 8.5,
    vx: 0,
    vy: 0,
    vz: 8,
    active: true,
    lastHit: 1,
    bounces: 1,
    isServe: false,
    wallBounces: 0,
    netTouched: false,
    receiver: null,
    ...overrides,
  });
  m.consumeEvents();
  return m;
}

test("padel uses a 10 by 20 metre enclosure and four players on two teams", () => {
  assert.equal(COURT.halfWidth * 2, 10);
  assert.equal(COURT.halfLength * 2, 20);
  assert.equal(COURT.serviceLine, 6.95);
  assert.equal(COURT.netHeight, 0.88);
  assert.equal(COURT.netEdgeHeight, 0.92);
  const m = createMatch();
  assert.equal(m.players.length, 4);
  assert.deepEqual(
    m.players.map((p) => p.team),
    [0, 1, 0, 1]
  );
  assert.deepEqual(
    m.players.map((p) => p.human),
    [true, false, false, false]
  );
  m.start();
  const before = m.players.map((p) => ({ x: p.x, z: p.z }));
  m.phase = "rally";
  m.ball.active = false;
  advance(m, 0.2, { moveX: -1, moveZ: -1 });
  assert.ok(m.players[0].vx < 0);
  // Input never becomes direct movement or a manual racket stroke for a second avatar.
  assert.ok(m.players.slice(1).every((p) => p.charge === 0 && !p.swingPending));
  assert.ok(m.players[0].x < before[0].x);
});

test("the server strikes below waist height from behind the service line", () => {
  const m = createMatch();
  m.start();
  const preview = getShotPreview(m);
  assert.ok(preview.source.y <= 0.85);
  assert.ok(preview.source.z > COURT.serviceLine);
  m.update(step, { hit: true });
  const shot = m.consumeEvents().find((e) => e.type === "shot");
  assert.equal(shot.shotType, "serve");
  assert.equal(shot.team, 0);
  assert.ok(shot.position.y < 1);
  assert.ok(shot.target.x < 0 && shot.target.z < 0);
});

test("a legal floor bounce followed by back glass stays live and reverses depth velocity", () => {
  const m = enclosedBall({ z: 9.9, vz: 8 });
  m.update(step);
  const walls = m.consumeEvents().filter((e) => e.type === "wall");
  assert.equal(walls.length, 1);
  assert.equal(walls[0].surface, "glass");
  assert.equal(walls[0].side, "back");
  assert.equal(m.phase, "rally");
  assert.ok(m.ball.vz < 0);
  assert.equal(m.ball.wallBounces, 1);
  assert.equal(m.ball.bounces, 1);
  assert.ok(m.ball.z < COURT.halfLength);
});

test("side glass and central mesh both rebound a legal rally ball with distinct materials", () => {
  for (const [z, expected] of [
    [7.5, "glass"],
    [4.2, "fence"],
  ]) {
    const m = enclosedBall({ x: 4.9, z, vx: 8, vz: 0 });
    m.update(step);
    const wall = m.consumeEvents().find((e) => e.type === "wall");
    assert.equal(wall.surface, expected);
    assert.equal(wall.side, "side");
    assert.equal(m.phase, "rally");
    assert.ok(m.ball.vx < 0);
    assert.equal(m.ball.wallBounces, 1);
  }
});

test("hitting the opponents' glass or mesh before their floor loses the point for the hitting team", () => {
  for (const ball of [
    { x: 0, z: -9.9, vx: 0, vz: -8 },
    { x: 4.9, z: -7.2, vx: 8, vz: 0 },
    { x: 4.9, z: -3.2, vx: 8, vz: 0 },
  ]) {
    const m = enclosedBall({ ...ball, lastHit: 2, bounces: 0 });
    m.update(step);
    assert.equal(m.phase, "point");
    assert.deepEqual(m.score, [0, 1]);
    assert.equal(m.pointReason, "Wall before floor");
  }
});

test("a shot can bank off its own back glass before crossing, but cannot use its own mesh", () => {
  const glass = enclosedBall({ z: 9.9, vz: 8, lastHit: 0, bounces: 0 });
  glass.update(step);
  assert.equal(glass.phase, "rally");
  assert.ok(glass.ball.vz < 0);
  const mesh = enclosedBall({
    x: 4.9,
    z: 3.2,
    vx: 8,
    vz: 0,
    lastHit: 0,
    bounces: 0,
  });
  mesh.update(step);
  assert.equal(mesh.phase, "point");
  assert.deepEqual(mesh.score, [0, 1]);
});

test("a service touching the mesh after a legal bounce is a fault; back glass is legal", () => {
  const fence = enclosedBall({
    x: 4.9,
    z: -4.5,
    vx: 8,
    vz: 0,
    lastHit: 0,
    isServe: true,
  });
  fence.update(step);
  assert.equal(fence.serveAttempt, 2);
  assert.equal(fence.phase, "point");
  assert.equal(fence.recoveryKind, "fault");
  assert.ok(
    fence
      .consumeEvents()
      .some(
        (e) => e.type === "serve-fault" && e.reason === "Serve hit the fence"
      )
  );
  const glass = enclosedBall({ z: -9.9, vz: -8, lastHit: 0, isServe: true });
  glass.update(step);
  assert.equal(glass.phase, "rally");
  assert.equal(glass.serveAttempt, 1);
  assert.ok(glass.ball.vz > 0);
});

test("two faults from the fourth player award the other team, never a player-index score", () => {
  const m = enclosedBall({
    x: 4.9,
    z: 3.2,
    vx: 8,
    vz: 0,
    lastHit: 3,
    isServe: true,
  });
  m.server = 3;
  m.serveAttempt = 2;
  m.update(step);
  assert.deepEqual(m.score, [1, 0]);
  assert.equal(m.score.length, 2);
  assert.equal(m.pointReason, "Double fault");
});

test("a legal rebound does not reset the two-bounce limit and credits the whole team", () => {
  const m = enclosedBall({
    x: 0,
    z: -5,
    y: BALL_RADIUS + 0.001,
    vy: -1,
    vz: 0,
    lastHit: 2,
    wallBounces: 3,
  });
  m.update(step);
  assert.deepEqual(m.score, [1, 0]);
  assert.equal(m.pointReason, "Second bounce");
});

test("a rebounding ball touching the net after its legal floor bounce is still live", () => {
  const m = enclosedBall({ z: 0.03, y: 0.45, vz: -10, lastHit: 1 });
  m.update(step);
  assert.equal(m.phase, "rally");
  assert.ok(m.ball.vz > 0);
  assert.equal(m.ball.bounces, 1);
  advance(m, 0.5);
  assert.deepEqual(m.score, [0, 1]);
});

test("a valid net let repeats the same server and same serve attempt", () => {
  const m = enclosedBall({
    x: 0,
    z: -9.9,
    vz: -8,
    lastHit: 0,
    isServe: true,
    netTouched: true,
  });
  m.serveAttempt = 2;
  advance(m, 0.6);
  assert.equal(m.phase, "point");
  assert.equal(m.recoveryKind, "let");
  recover(m);
  assert.equal(m.phase, "serve");
  assert.equal(m.server, 0);
  assert.equal(m.serveAttempt, 2);
  assert.deepEqual(m.score, [0, 0]);
  assert.ok(m.consumeEvents().some((e) => e.type === "serve-let"));
});

test("either opposing avatar can be returned, and a teammate's shot cannot be hit twice", () => {
  for (const lastHit of [1, 3]) {
    const m = contactMatch();
    m.ball.lastHit = lastHit;
    m.update(step, { hit: true });
    assert.equal(m.ball.lastHit, 0);
  }
  for (const lastHit of [0, 2]) {
    const m = contactMatch();
    m.ball.lastHit = lastHit;
    m.consumeEvents();
    m.update(step, { hit: true });
    assert.ok(
      !m.consumeEvents().some((e) => e.type === "shot" && e.playerIndex === 0)
    );
  }
});

test("only the diagonal receiver can return a service before the rally opens", () => {
  const m = contactMatch();
  Object.assign(m.ball, { isServe: true, receiver: 2, serviceXSign: 1 });
  m.update(step, { hit: true });
  assert.equal(m.ball.lastHit, 1);
  assert.ok(!m.players[0].swingPending);
  m.ball.receiver = 0;
  m.update(step, { hit: true });
  assert.equal(m.ball.lastHit, 0);
});

test("human preparation can wait for back glass and hit the real rebound heading towards the net", () => {
  const m = enclosedBall({ x: 0.4, z: 9.1, y: 1.5, vy: 0, vz: 7 });
  Object.assign(m.players[0], { x: 0, z: 6.7 });
  const plan = predictPreparationContact(m);
  assert.ok(
    plan && plan.afterWall,
    "the contact plan must include the glass rebound"
  );
  m.update(step, { hit: true, aimX: 0.2 });
  assert.ok(m.players[0].swingPending);
  let wall = false,
    shot;
  for (let i = 0; i < 120 && !shot; i++) {
    m.update(step);
    for (const e of m.consumeEvents()) {
      wall ||= e.type === "wall";
      if (e.type === "shot" && e.playerIndex === 0) shot = e;
    }
  }
  assert.ok(wall);
  assert.ok(shot);
  assert.ok(shot.position.z < 9.8);
  assert.equal(m.ball.lastHit, 0);
  assert.ok(m.ball.vz < 0);
});

test("K produces a high controlled lob and a short-frame press is preserved", () => {
  const m = contactMatch();
  const control = getShotPreview(m, { aimX: 0.4, aimZ: -0.2 });
  const lob = getShotPreview(m, { lob: true, aimX: 0.4, aimZ: -0.2 });
  assert.equal(lob.shotType, "lob");
  assert.ok(lob.velocity.vy > control.velocity.vy + 3);
  assert.ok(lob.safe);
  m.update(step / 2, { lob: true, aimX: 0.4, aimZ: -0.2 });
  assert.equal(m.ball.lastHit, 1);
  m.update(step / 2, { aimX: 0.4, aimZ: -0.2 });
  const shots = m.consumeEvents().filter((e) => e.type === "shot");
  assert.equal(shots.length, 1);
  assert.equal(shots[0].shotType, "lob");
  assert.equal(shots[0].playerIndex, 0);
  assert.deepEqual(shots[0].target, lob.target);
});

test("NPC partners cover and opponents use both lobs and volleys without simultaneous double hits", () => {
  const m = createMatch({ seed: 3 });
  m.start();
  m.update(step, { hit: true });
  const shots = [];
  for (let frame = 0; frame < 120 * 40; frame++) {
    m.update(step);
    shots.push(...m.consumeEvents().filter((e) => e.type === "shot"));
  }
  assert.ok(shots.some((e) => e.playerIndex === 2 && !e.serving));
  assert.ok(shots.some((e) => e.playerIndex === 1));
  assert.ok(shots.some((e) => e.playerIndex === 3));
  assert.ok(shots.some((e) => e.shotType === "lob"));
  assert.ok(shots.some((e) => e.shotType === "volley"));
  for (let i = 1; i < shots.length; i++) {
    assert.ok(shots[i].time - shots[i - 1].time > 0.18);
    if (!shots[i].serving) assert.notEqual(shots[i].team, shots[i - 1].team);
  }
});

test("the visible landing cue follows the glass rebound instead of pointing through the wall", () => {
  const m = enclosedBall({ x: 1.2, z: 9.5, y: 1.5, vy: 0, vz: 8 });
  assert.ok(predictLanding(m.ball).z > COURT.halfLength);
  const cue = predictCourtLanding(m.ball);
  assert.ok(cue && cue.inBounds && cue.afterWall);
  assert.ok(cue.z < COURT.halfLength);
  let bounce;
  for (let i = 0; i < 120 && !bounce; i++) {
    m.update(step);
    bounce = m.consumeEvents().find((e) => e.type === "bounce");
  }
  assert.ok(bounce);
  assert.ok(Math.abs(bounce.position.x - cue.x) < 1e-8);
  assert.ok(Math.abs(bounce.position.z - cue.z) < 1e-8);
  const fault = enclosedBall({ z: -9.9, vz: -8, bounces: 0, lastHit: 0 });
  assert.equal(predictCourtLanding(fault.ball), null);
});

function overheadRally({
  x = 0.4,
  y = 5.5,
  vz = 4,
  playerX = x - 0.4,
  playerZ = 3.4,
} = {}) {
  const m = createMatch();
  m.start();
  m.phase = "rally";
  m.rallyHits = 1;
  Object.assign(m.players[0], { x: playerX, z: playerZ });
  Object.assign(m.players[2], { x: 4.3, z: 7.8 });
  Object.assign(m.players[1], { x: -3.8, z: -8.2 });
  Object.assign(m.players[3], { x: 3.8, z: -8.2 });
  Object.assign(m.ball, {
    x,
    y,
    z: 0,
    vx: 0,
    vy: 0,
    vz,
    lastHit: 1,
    bounces: 0,
    isServe: false,
    active: true,
  });
  m.consumeEvents();
  return m;
}
function finishPassage(m, duration = 2) {
  const events = m.consumeEvents();
  for (let i = 0; i < duration / step && m.phase === "rally"; i++) {
    m.update(step);
    events.push(...m.consumeEvents());
  }
  return events;
}

test("a reachable incoming lob advertises an overhead opportunity before it enters racket height", () => {
  const m = overheadRally();
  const preview = getShotPreview(m, { powerHeld: true });
  assert.ok(m.ball.y > PREPARATION_ASSIST.overheadMaxHeight);
  assert.equal(preview.ready, false);
  assert.equal(preview.smashOpportunity, true);
  assert.ok(preview.smashContact.time > 0.5);
  assert.ok(preview.smashContact.y >= 2.2 && preview.smashContact.y <= 2.9);
  m.ball.lastHit = 0;
  assert.equal(getShotPreview(m, { powerHeld: true }).smashOpportunity, false);
  m.ball.lastHit = 1;
  Object.assign(m.players[0], { x: -4.5, z: 9.4 });
  assert.equal(getShotPreview(m, { powerHeld: true }).smashOpportunity, false);
});

test("real Enter preparation and a sweet release kick a legal bounce over the back enclosure", () => {
  const m = overheadRally();
  advance(m, 86 * step, { powerHeld: true });
  assert.equal(m.players[0].preparedStroke, "smash");
  assert.ok(m.players[0].assistContact.y >= 2.2);
  const preview = getShotPreview(m, { powerHeld: true });
  assert.equal(preview.qualityLabel, "Perfect");
  assert.ok(preview.smashPower > 0.85);
  m.update(step, { powerReleased: true });
  const events = finishPassage(m);
  const shot = events.find(
    (event) => event.type === "shot" && event.playerIndex === 0
  );
  assert.equal(shot.shotType, "smash");
  assert.equal(shot.qualityLabel, "Perfect");
  assert.ok(shot.smashPower > 0.9);
  assert.ok(shot.speed > 30);
  assert.ok(shot.position.y <= 2.9 && shot.position.y >= 2.5);
  const bounce = events.find((event) => event.type === "bounce");
  assert.ok(bounce.inBounds && bounce.position.z < 0);
  const escape = events.find((event) => event.type === "out-of-court");
  assert.equal(escape.side, "back");
  assert.ok(escape.position.y > COURT.backFenceHeight + BALL_RADIUS);
  assert.ok(events.indexOf(bounce) < events.indexOf(escape));
  const point = events.find((event) => event.type === "point");
  assert.equal(point.outOfCourt, true);
  assert.equal(point.smashWinner, true);
  assert.equal(point.reason, "Smash out of court");
  assert.deepEqual(m.score, [1, 0]);
  assert.equal(
    m.ball.active,
    true,
    "the winning ball should remain visible while flying away"
  );
  const exitZ = m.ball.z;
  advance(m, 0.3);
  assert.ok(m.ball.z < exitZ - 4);
  advance(m, 0.7);
  assert.equal(m.ball.active, true);
  assert.equal(m.ball.dead, true);
});

test("an angled overhead can clear the side fence after its legal first bounce", () => {
  const m = overheadRally({ x: -3.8, playerX: -4 });
  advance(m, 86 * step, { powerHeld: true });
  // Both defenders have committed to the other channel; this is an earned opening.
  Object.assign(m.players[1], { x: -4.4, z: -9.2 });
  Object.assign(m.players[3], { x: -3.5, z: -9.2 });
  m.update(step, { powerReleased: true, aimX: 0.4 });
  const events = finishPassage(m);
  const bounce = events.find((event) => event.type === "bounce");
  const escape = events.find((event) => event.type === "out-of-court");
  assert.ok(bounce.inBounds);
  assert.equal(escape.side, "side");
  assert.ok(escape.position.y > COURT.sideWallHeight + BALL_RADIUS);
  assert.deepEqual(m.score, [1, 0]);
});

test("a late over-aimed overhead still faults before its first legal bounce", () => {
  const m = overheadRally({ y: 9.5, vz: 2.5 });
  advance(m, 140 * step, { powerHeld: true });
  m.update(step, { powerReleased: true, aimX: 1.35, aimZ: -1.35 });
  const events = finishPassage(m);
  const shot = events.find(
    (event) => event.type === "shot" && event.playerIndex === 0
  );
  assert.equal(shot.shotType, "smash");
  assert.equal(shot.qualityLabel, "Late");
  assert.ok(shot.smashPower < 0.6);
  assert.deepEqual(m.score, [0, 1]);
  assert.ok(!events.some((event) => event.type === "bounce" && event.inBounds));
  assert.ok(
    !events.some((event) => event.type === "point" && event.outOfCourt)
  );
});

test("going straight over an enclosure before any floor bounce loses the point", () => {
  for (const wall of ["side", "back"]) {
    const m = enclosedBall({
      x: wall === "side" ? 4.9 : 0,
      z: wall === "back" ? -9.9 : -4,
      y: 5,
      vy: 0,
      vx: wall === "side" ? 12 : 0,
      vz: wall === "back" ? -12 : 0,
      lastHit: 0,
      bounces: 0,
      shotType: "smash",
      smashPower: 1,
    });
    m.update(step);
    assert.deepEqual(m.score, [0, 1]);
    assert.equal(m.pointReason, "Out before bounce");
    assert.equal(m.ball.active, true);
    assert.equal(m.ball.dead, true);
  }
});

test("a properly positioned opponent can reflex-block a smash instead of receiving a scripted winner", () => {
  const m = overheadRally();
  advance(m, 86 * step, { powerHeld: true });
  Object.assign(m.players[1], { x: 0.15, z: -1.4, vx: 0, vz: 0 });
  m.update(step, { powerReleased: true });
  const events = finishPassage(m, 0.6);
  const smash = events.find(
    (event) => event.type === "shot" && event.playerIndex === 0
  );
  assert.equal(smash.shotType, "smash");
  const block = events.find(
    (event) => event.type === "shot" && event.playerIndex === 1
  );
  assert.ok(block);
  assert.equal(block.shotType, "volley");
  assert.equal(block.contactKind, "reach");
  assert.ok(block.contactQuality < 1);
  assert.ok(block.time - smash.time >= 0.1);
  assert.ok(block.time - smash.time < 0.25);
  assert.deepEqual(m.score, [0, 0]);
  assert.ok(!events.some((event) => event.type === "out-of-court"));
});

test("overhead assistance stays bounded, favors high contact, and a committed player owns the ball", () => {
  const m = overheadRally({ x: 0.8, playerX: -1.4, playerZ: 4.4 });
  const origin = { x: m.players[0].x, z: m.players[0].z };
  Object.assign(m.players[2], { x: 1.6, z: 3.4 });
  for (let i = 0; i < 86; i++) {
    m.update(step, { powerHeld: true });
    assert.ok(
      Math.hypot(m.players[0].x - origin.x, m.players[0].z - origin.z) <=
        PREPARATION_ASSIST.overheadMaxDistance + 1e-8
    );
    assert.ok(
      Math.hypot(m.players[0].vx, m.players[0].vz) <=
        PREPARATION_ASSIST.overheadMaxSpeed + 1e-8
    );
    assert.equal(
      m.players[0].y,
      0,
      "visual hops must not teleport the physics root"
    );
  }
  assert.equal(m.players[0].preparedStroke, "smash");
  assert.ok(m.players[0].assistContact.y >= 2.2);
  assert.ok(
    !m
      .consumeEvents()
      .some((event) => event.type === "shot" && event.playerIndex === 2)
  );
  m.update(step, { powerReleased: true });
  const shot = finishPassage(m).find(
    (event) => event.type === "shot" && event.playerIndex === 0
  );
  assert.equal(shot.shotType, "smash");
});

test("ordinary control and lob shots retain their arcs and do not receive smash bounce energy", () => {
  for (const input of [{ hit: true }, { lob: true }]) {
    const m = contactMatch();
    m.update(step, input);
    const shot = m.consumeEvents().find((event) => event.type === "shot");
    assert.notEqual(shot.shotType, "smash");
    assert.equal(shot.smashPower, 0);
    assert.equal(m.ball.smashPower, 0);
    if (input.lob) assert.equal(shot.shotType, "lob");
  }
});

test("pointer aim and smash preview share the same short first-bounce target", () => {
  const m = overheadRally();
  advance(m, 86 * step, { powerHeld: true });
  for (const target of [
    { x: 1.8, z: -2.4 },
    { x: -2.2, z: -5.1 },
  ]) {
    const aim = aimFromWorld(m, target.x, target.z, { powerHeld: true });
    const preview = getShotPreview(m, { ...aim, powerHeld: true });
    assert.ok(Math.abs(preview.target.x - target.x) < 1e-8);
    assert.ok(Math.abs(preview.target.z - target.z) < 1e-8);
  }
});

test("a scored second bounce continues moving and bouncing without awarding more points", () => {
  const m = enclosedBall({
    x: 1,
    z: 7.5,
    y: BALL_RADIUS + 0.001,
    vx: 3,
    vy: -5,
    vz: 1,
    lastHit: 1,
    bounces: 1,
  });
  m.update(step);
  assert.deepEqual(m.score, [0, 1]);
  assert.ok(m.ball.dead && m.ball.active && m.recovering);
  const atPoint = { x: m.ball.x, y: m.ball.y, z: m.ball.z };
  m.consumeEvents();
  advance(m, 0.2);
  assert.ok(m.ball.x > atPoint.x + 0.2);
  assert.ok(m.ball.y > BALL_RADIUS + 0.1);
  advance(m, 1.2);
  assert.deepEqual(m.score, [0, 1]);
  const events = m.consumeEvents();
  assert.equal(events.filter((e) => e.type === "point").length, 0);
  assert.ok(
    events.some((e) => e.type === "bounce" && e.dead && e.impactSpeed > 0)
  );
});

test("players jog back at bounded speed, finish their last stroke, and only then start the next serve", () => {
  const m = enclosedBall({ y: BALL_RADIUS + 0.001, vy: -2, vz: 0, bounces: 1 });
  Object.assign(m.players[0], {
    x: 4.4,
    z: 1,
    padelStroke: "smash",
    action: "smash",
    actionDuration: 0.68,
    actionTime: 0.18,
    contactPoint: { x: 4.4, y: 2.7, z: 1 },
  });
  const contact = { ...m.players[0].contactPoint };
  m.update(step);
  const starting = m.players.map((p) => ({ x: p.x, z: p.z }));
  const beforeCancel = { vx: m.players[0].vx, vz: m.players[0].vz };
  m.cancelInput(); // The host clears input as soon as it receives the point event.
  assert.deepEqual(m.players[0].contactPoint, contact);
  assert.deepEqual({ vx: m.players[0].vx, vz: m.players[0].vz }, beforeCancel);
  let sawWalking = false,
    elapsed = 0;
  while (m.recovering && elapsed < 4.2) {
    const before = m.players.map((p) => ({ x: p.x, z: p.z }));
    m.update(step);
    elapsed += step;
    for (let index = 0; index < 4; index++) {
      const p = m.players[index];
      assert.ok(
        Math.hypot(p.x - before[index].x, p.z - before[index].z) <=
          5.4 * step + 1e-8
      );
      assert.ok(Math.hypot(p.vx, p.vz) <= 5.4 + 1e-8);
      sawWalking ||= p.recovering && Math.hypot(p.vx, p.vz) > 1;
    }
    if (elapsed < 0.4) {
      assert.equal(m.players[0].padelStroke, "smash");
      assert.ok(
        Math.hypot(
          m.players[0].x - starting[0].x,
          m.players[0].z - starting[0].z
        ) < 0.01
      );
    }
  }
  assert.ok(elapsed >= 2.1 && elapsed < 4.2);
  assert.ok(sawWalking);
  assert.equal(m.phase, "serve");
  assert.equal(m.server, 1);
  assert.ok(Math.abs(m.players[1].z + 8.2) < 0.08);
  assert.ok(m.players.every((p) => !p.recovering));
});

test("a spent ball keeps its stable identity and position when a separate service ball appears", () => {
  const m = enclosedBall({
    y: BALL_RADIUS + 0.001,
    vx: 3,
    vy: -2,
    vz: 2,
    bounces: 1,
  });
  m.update(step);
  const oldBall = m.ball,
    oldId = oldBall.id;
  let previous = { x: oldBall.x, y: oldBall.y, z: oldBall.z };
  while (m.recovering) {
    previous = { x: oldBall.x, y: oldBall.y, z: oldBall.z };
    m.update(step);
  }
  assert.notEqual(m.ball.id, oldId);
  assert.equal(
    m.looseBalls.find((ball) => ball.id === oldId),
    oldBall
  );
  assert.ok(
    Math.hypot(
      oldBall.x - previous.x,
      oldBall.y - previous.y,
      oldBall.z - previous.z
    ) < 0.15
  );
  assert.equal(oldBall.opacity, 1);
  assert.equal(m.ball.opacity, 0);
  advance(m, 0.15);
  assert.equal(m.ball.opacity, 1);
  assert.ok(oldBall.opacity > 0.85);
});

test("first faults and lets keep their physical ball while recovering without changing the score", () => {
  for (const kind of ["fault", "let"]) {
    const m =
      kind === "fault"
        ? enclosedBall({
            x: 4.9,
            z: -4.5,
            y: 1.2,
            vx: 8,
            vz: 0,
            lastHit: 0,
            isServe: true,
          })
        : enclosedBall({
            x: 0,
            z: -5,
            y: BALL_RADIUS + 0.001,
            vy: -2,
            vz: 2,
            lastHit: 0,
            isServe: true,
            netTouched: true,
          });
    const initial = m.players.map((p) => ({ x: p.x, z: p.z }));
    m.update(step);
    assert.equal(m.phase, "point");
    assert.equal(m.recoveryKind, kind);
    assert.equal(m.ball.dead, true);
    assert.deepEqual(m.score, [0, 0]);
    assert.ok(
      m.players.every(
        (p, index) =>
          Math.hypot(p.x - initial[index].x, p.z - initial[index].z) < 0.05
      )
    );
    const old = m.ball;
    recover(m);
    assert.equal(m.server, 0);
    assert.equal(m.serveAttempt, kind === "fault" ? 2 : 1);
    assert.deepEqual(m.score, [0, 0]);
    assert.ok(m.looseBalls.includes(old));
  }
});

test("held power and queued presses during recovery cannot launch the next serve", () => {
  const m = enclosedBall({
    x: 4.9,
    z: -4.5,
    vx: 8,
    vz: 0,
    lastHit: 0,
    isServe: true,
  });
  m.update(step);
  for (let frame = 0; frame < 120 * 4; frame++)
    m.update(step, { powerHeld: true, hit: true, lob: true });
  assert.equal(m.phase, "serve");
  assert.equal(m.ball.active, false);
  assert.equal(m.charge, 0);
  m.update(step, { powerReleased: true });
  assert.equal(m.ball.active, false);
  m.update(step); // neutral physical input rearms a fresh key press
  m.update(step, { hit: true });
  assert.equal(m.phase, "rally");
  assert.equal(m.ball.lastHit, 0);
});

test("an out-of-park match winner reaches the outside floor and settles before rendering can stop", () => {
  const m = enclosedBall({
    x: 0,
    z: -9.9,
    y: 5,
    vy: 18,
    vz: -25,
    lastHit: 0,
    bounces: 1,
    shotType: "smash",
    smashPower: 1,
  });
  m.targetScore = 1;
  m.maxScore = 1;
  m.update(step);
  assert.equal(m.phase, "finished");
  assert.equal(m.settled, false);
  const events = m.consumeEvents();
  let elapsed = 0;
  while (!m.settled && elapsed < 6.3) {
    m.update(step);
    elapsed += step;
    events.push(...m.consumeEvents());
  }
  assert.ok(elapsed > 3 && elapsed < 6.3);
  assert.equal(m.settled, true);
  assert.equal(m.recovering, false);
  assert.ok(
    events.some(
      (event) => event.type === "bounce" && event.dead && event.position.z < -50
    )
  );
  assert.equal(events.filter((event) => event.type === "point").length, 1);
  assert.equal(events.filter((event) => event.type === "match-end").length, 1);
  assert.equal(events.filter((event) => event.type === "settled").length, 1);
  assert.deepEqual(m.score, [1, 0]);
  assert.ok(m.ball.resting || m.ball.opacity <= 0.001);
});

test("loose-ball storage stays bounded and expired balls fade away without entering play", () => {
  const m = createMatch({ targetScore: 20, maxScore: 30 });
  m.start();
  for (let point = 0; point < 6; point++) {
    forcePoint(m, point % 2);
    recover(m);
    assert.ok(m.looseBalls.length <= 3);
    assert.ok(m.looseBalls.every((ball) => ball.dead && ball.id !== m.ball.id));
    assert.equal(
      new Set(m.looseBalls.map((ball) => ball.id)).size,
      m.looseBalls.length
    );
  }
  const oldBalls = [...m.looseBalls];
  // Pause competitive activity while still advancing independent recovery physics.
  m.phase = "ready";
  advance(m, 8.1);
  assert.equal(m.looseBalls.length, 0);
  assert.ok(oldBalls.every((ball) => ball.opacity === 0));
});

test("dead-ball recovery and formation arrival are identical at 60Hz and 120Hz rendering", () => {
  const a = enclosedBall({
    x: 1,
    z: 7.5,
    y: BALL_RADIUS + 0.001,
    vx: 3,
    vy: -5,
    vz: 1,
    lastHit: 1,
    bounces: 1,
  });
  const b = enclosedBall({
    x: 1,
    z: 7.5,
    y: BALL_RADIUS + 0.001,
    vx: 3,
    vy: -5,
    vz: 1,
    lastHit: 1,
    bounces: 1,
  });
  for (let frame = 0; frame < 240; frame++) {
    a.update(1 / 60);
    b.update(step);
    b.update(step);
  }
  assert.deepEqual(a.ball, b.ball);
  assert.deepEqual(a.looseBalls, b.looseBalls);
  assert.deepEqual(a.players, b.players);
  assert.deepEqual(a.score, b.score);
  assert.equal(a.recovering, b.recovering);
});

test("teammates with crossing return paths steer around each other without a recovery deadlock", () => {
  const m = enclosedBall({
    x: 0,
    z: 7.5,
    y: BALL_RADIUS + 0.001,
    vx: 0,
    vy: -2,
    vz: 0,
    lastHit: 1,
    bounces: 1,
  });
  Object.assign(m.players[0], { x: 2.25, z: 7.65 });
  Object.assign(m.players[2], { x: -2.35, z: 7.65 });
  m.update(step);
  let elapsed = 0,
    closest = Infinity;
  while (m.recovering && elapsed < 4.2) {
    m.update(step);
    elapsed += step;
    closest = Math.min(
      closest,
      Math.hypot(
        m.players[0].x - m.players[2].x,
        m.players[0].z - m.players[2].z
      )
    );
  }
  assert.ok(closest > 0.4, `teammates overlapped at ${closest}m`);
  assert.equal(m.phase, "serve");
  assert.ok(elapsed < 4.2);
});

test("retired balls continue natural motion while fading promptly beside the new service ball", () => {
  const m = enclosedBall({
    x: 0,
    z: -9.9,
    y: 5,
    vy: 18,
    vz: -25,
    lastHit: 0,
    bounces: 1,
    shotType: "smash",
    smashPower: 1,
  });
  m.update(step);
  const old = m.ball;
  recover(m);
  assert.ok(m.looseBalls.includes(old));
  const start = { x: old.x, y: old.y, z: old.z };
  advance(m, 0.65);
  assert.ok(old.opacity > 0.3 && old.opacity < 0.6);
  assert.ok(Math.hypot(old.x - start.x, old.y - start.y, old.z - start.z) > 1);
  advance(m, 0.8);
  assert.equal(old.opacity, 0);
  assert.ok(
    m.looseBalls.includes(old),
    "hidden continuation should still reach the outside floor"
  );
  const afterFadeZ = old.z;
  advance(m, 0.2);
  assert.ok(old.z < afterFadeZ);
});

test("manual charge movement replaces the old approach and release replans without snapping", () => {
  const m = preparationMatch();
  const p = m.players[0];
  advance(m, 0.12, { powerHeld: true });
  assert.equal(p.assistActive, true);
  const oldTarget = { ...p.assistTarget };
  let previous = { x: p.x, z: p.z };
  for (let frame = 0; frame < 20; frame++) {
    m.update(step, { powerHeld: true, moveX: -1, moveZ: -0.25, sprint: true });
    assert.equal(p.manualPreparation, true);
    assert.equal(p.assistActive, false);
    assert.ok(
      Math.hypot(p.x - previous.x, p.z - previous.z) <= 6.6 * step + 1e-8
    );
    previous = { x: p.x, z: p.z };
  }
  assert.ok(p.x < oldTarget.x - 0.5);
  assert.ok(m.charge > 0.3);
  const origin = { x: p.x, z: p.z };
  m.update(step, { powerReleased: true, aimX: -0.35 });
  assert.equal(p.manualPreparation, false);
  assert.equal(p.swingPending, true);
  const target = { ...m.pendingShot.target };
  for (let frame = 0; frame < 100 && p.swingPending; frame++) {
    assert.ok(
      Math.hypot(p.x - previous.x, p.z - previous.z) <= 6.6 * step + 1e-8
    );
    assert.ok(
      Math.hypot(p.x - origin.x, p.z - origin.z) <=
        PREPARATION_ASSIST.maxDistance + 1e-8
    );
    previous = { x: p.x, z: p.z };
    m.update(step, { aimX: 1.35, moveX: -1 });
  }
  const shot = m
    .consumeEvents()
    .find((event) => event.type === "shot" && event.playerIndex === 0);
  assert.ok(shot, "the revised approach should still meet the incoming ball");
  assert.deepEqual(shot.target, target);
});

test("stopping during manual charge decelerates naturally and keeps preparation until release or cancellation", () => {
  const m = contactMatch();
  m.ball.active = false;
  const p = m.players[0];
  advance(m, 0.2, { powerHeld: true, moveX: -1 });
  const stopX = p.x;
  const stopCharge = m.charge;
  advance(m, 0.25, { powerHeld: true });
  assert.ok(p.x < stopX - 0.1);
  assert.ok(Math.abs(p.vx) < 0.1);
  assert.equal(p.manualPreparation, true);
  assert.equal(p.assistActive, false);
  assert.ok(p.charge > stopCharge);
  assert.ok(p.preparedStroke);
  m.cancelInput();
  assert.equal(p.manualPreparation, false);
  assert.equal(p.charge, 0);
  assert.equal(p.preparedStroke, null);
});

test("a charging server can reposition only within their legal service half and the held ball follows", () => {
  const m = createMatch();
  m.start();
  const p = m.players[0];
  advance(m, 0.5, { powerHeld: true, moveX: -1, moveZ: -1, sprint: true });
  assert.ok(p.x < 2.25);
  assert.ok(p.x >= 0.4);
  assert.ok(p.z >= COURT.serviceLine + 0.4);
  assert.equal(m.ball.x, p.x);
  assert.equal(m.ball.z, p.z - 0.4);
  const preview = getShotPreview(m, { powerHeld: true });
  assert.equal(preview.source.x, p.x);
  assert.equal(preview.source.z, p.z - 0.25);
  assert.equal(preview.estimated, false);
  assert.ok(preview.target.x < 0);
  m.update(step, { powerReleased: true });
  const shot = m.consumeEvents().find((event) => event.type === "shot");
  assert.ok(shot.serving);
  assert.ok(shot.position.z > COURT.serviceLine);
  assert.deepEqual(shot.target, preview.target);
});

test("a future contact preview begins its outgoing trajectory at the anticipated racket passage", () => {
  const m = preparationMatch();
  m.update(step, { powerHeld: true });
  const preview = getShotPreview(m, { powerHeld: true, aimX: 0.35 });
  assert.equal(preview.ready, false);
  assert.equal(preview.estimated, false);
  assert.ok(preview.launchDelay > 0.1);
  assert.deepEqual(preview.source, {
    x: preview.contact.x,
    y: preview.contact.y,
    z: preview.contact.z,
  });
  assert.ok(Math.abs(preview.source.z - m.ball.z) > 1);
  const before = JSON.stringify(m);
  const trajectory = getShotTrajectory(m, preview);
  assert.equal(
    JSON.stringify(m),
    before,
    "forecasting cannot move the match or consume events"
  );
  assert.deepEqual(trajectory.points[0], preview.source);
  assert.equal(trajectory.safe, true);
  assert.equal(trajectory.blocked, false);
  assert.ok(trajectory.points.length > 12 && trajectory.points.length <= 128);
  assert.ok(Math.abs(trajectory.bounce.x - preview.target.x) < 1e-8);
  assert.ok(Math.abs(trajectory.bounce.z - preview.target.z) < 1e-8);
  assert.ok(
    trajectory.points.every((point) =>
      Object.values(point).every(Number.isFinite)
    )
  );
  assert.ok(
    Math.min(...trajectory.points.map((point) => point.z)) <
      trajectory.bounce.z - 0.1
  );
});

test("early preparation still shows an estimated outgoing path from the moving player, never the distant opponent ball", () => {
  const m = preparationMatch({ active: false, x: -3.5, y: 5, z: -8 });
  advance(m, 0.2, { powerHeld: true, moveX: 1 });
  const preview = getShotPreview(m, { powerHeld: true });
  assert.equal(preview.reachable, false);
  assert.equal(preview.estimated, true);
  assert.equal(preview.launchDelay, null);
  assert.ok(
    Math.hypot(
      preview.source.x - m.players[0].x,
      preview.source.z - m.players[0].z
    ) < 1
  );
  assert.ok(preview.source.z > 0);
  const path = getShotTrajectory(m, preview);
  assert.equal(path.estimated, true);
  assert.ok(path.points.length > 10);
  assert.deepEqual(path.points[0], preview.source);
  assert.ok(path.bounce);
});

test("trajectory shares actual service, control, lob and smash first-bounce flight", () => {
  const cases = [
    { m: createMatch(), input: { hit: true } },
    { m: contactMatch(), input: { hit: true } },
    { m: contactMatch(), input: { lob: true } },
    {
      m: chargedMatch(),
      input: { powerHeld: true },
      release: { powerReleased: true },
    },
  ];
  const smash = overheadRally();
  advance(smash, 86 * step, { powerHeld: true });
  cases.push({
    m: smash,
    input: { powerHeld: true },
    release: { powerReleased: true },
  });
  for (const { m, input, release } of cases) {
    if (m.phase === "ready") m.start();
    const preview = getShotPreview(m, input);
    const path = getShotTrajectory(m, preview);
    assert.ok(path.bounce, preview.shotType);
    assert.ok(
      Math.abs(path.bounce.x - preview.target.x) < 1e-8,
      preview.shotType
    );
    assert.ok(
      Math.abs(path.bounce.z - preview.target.z) < 1e-8,
      preview.shotType
    );
    m.update(step, release ?? input);
    const events = m.consumeEvents();
    for (let frame = 0; frame < 30 && m.players[0].swingPending; frame++) {
      m.update(step);
      events.push(...m.consumeEvents());
    }
    const shot = events.find(
      (event) => event.type === "shot" && event.playerIndex === 0
    );
    assert.ok(shot, preview.shotType);
    const landing = predictLanding(m.ball);
    assert.ok(Math.abs(path.bounce.x - landing.x) < 1e-8, preview.shotType);
    assert.ok(Math.abs(path.bounce.z - landing.z) < 1e-8, preview.shotType);
    assert.equal(path.blocked, false, preview.shotType);
    assert.equal(path.safe, true, preview.shotType);
  }
});

test("trajectory stops at net or out faults, while a legal glass bounce retains its continuation", () => {
  const m = contactMatch();
  const base = {
    reachable: true,
    safe: true,
    shotType: "control",
    smashPower: 0,
  };
  const net = getShotTrajectory(m, {
    ...base,
    source: { x: 0, y: 0.5, z: 1 },
    velocity: { vx: 0, vy: 0, vz: -10 },
  });
  assert.equal(net.blocked, true);
  assert.equal(net.safe, false);
  assert.equal(net.bounce, null);
  assert.ok(Math.abs(net.points.at(-1).z) < 1e-8);
  const out = getShotTrajectory(m, {
    ...base,
    source: { x: 4.5, y: 2, z: -2 },
    velocity: { vx: 8, vy: 0, vz: -2 },
  });
  assert.equal(out.blocked, true);
  assert.equal(out.bounce, null);
  assert.ok(
    out.points.every((point) => point.x <= COURT.halfWidth - BALL_RADIUS + 1e-8)
  );
  const rebound = getShotTrajectory(
    m,
    {
      ...base,
      source: { x: 0, y: 0.3, z: -8.5 },
      velocity: { vx: 0, vy: -1, vz: -8 },
    },
    { afterBounce: 1.1, maxPoints: 48 }
  );
  assert.equal(rebound.blocked, false);
  assert.equal(rebound.safe, true);
  assert.ok(rebound.bounce);
  const minimumZ = Math.min(...rebound.points.map((point) => point.z));
  assert.ok(minimumZ < -9.9);
  assert.ok(rebound.points.at(-1).z > minimumZ + 0.5);
  assert.ok(rebound.points.length <= 48);
  assert.deepEqual(getShotTrajectory(m, null).points, []);
  assert.deepEqual(
    getShotTrajectory(m, {
      ...base,
      source: { x: NaN, y: 1, z: 3 },
      velocity: { vx: 0, vy: 0, vz: -3 },
    }).points,
    []
  );
});
