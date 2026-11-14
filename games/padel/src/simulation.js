import { advanceDeadBall } from "./dead-ball.js";

/** Fixed-step doubles padel. Metres, seconds; teams alternate player indices.
 * Exhibition scoring: first to seven, win by two, capped at fifteen. */
export const COURT = Object.freeze({
  halfWidth: 5,
  halfLength: 10,
  netHeight: 0.88,
  netEdgeHeight: 0.92,
  serviceLine: 6.95,
  backGlassHeight: 3,
  backFenceHeight: 4,
  sideWallHeight: 3,
  sideGlassStartsAt: 6,
});
export const BALL_RADIUS = 0.065;
export const GRAVITY = 9.81;
export const AIM_LIMIT = 1.35;
export const MATCH_RULES = Object.freeze({ targetScore: 7, maxScore: 15 });
export const PREPARATION_ASSIST = Object.freeze({
  maxDistance: 2.4,
  maxSpeed: 4.4,
  maxAcceleration: 24,
  minTime: 0.025,
  maxTime: 1.4,
  commitmentTime: 0.95,
  lateGrace: 0.16,
  lateralReach: 2.35,
  depthReach: 1.95,
  overheadMinHeight: 2.2,
  overheadMaxHeight: 2.9,
  overheadMaxDistance: 3.1,
  overheadMaxSpeed: 5.1,
});
const STEP = 1 / 120;
// Leave a few physics ticks for the sampled first-bounce contact to arrive.
const CONTACT_MARGIN = STEP * 3;
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
export const teamIndex = (index) => index % 2;
const side = (index) => (teamIndex(index) === 0 ? 1 : -1);
const finite = (n, fallback = 0) => (Number.isFinite(n) ? n : fallback);
const netHeightAt = (x) =>
  COURT.netHeight +
  Math.min(1, Math.abs(x) / COURT.halfWidth) ** 2 *
    (COURT.netEdgeHeight - COURT.netHeight);
function randomGenerator(seed) {
  let value = Number(seed) >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = Math.imul(value ^ (value >>> 15), 1 | value);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function smashStrength(source, power, quality) {
  return (
    quality *
    clamp((source.y - 1.95) / 0.8, 0, 1) *
    clamp((7.3 - Math.abs(source.z)) / 3.2, 0, 1) *
    clamp((power - 0.5) / 0.35, 0, 1)
  );
}
function stableNoise(seed, ordinal) {
  const n = Math.sin(seed * 0.017 + ordinal * 78.233) * 43758.5453;
  return (n - Math.floor(n)) * 2 - 1;
}

/** Next descending intersection with a horizontal plane, before any bounce. */
export function predictLanding(ball, height = BALL_RADIUS) {
  if (
    !ball ||
    ![ball.x, ball.y, ball.z, ball.vx, ball.vy, ball.vz, height].every(
      Number.isFinite
    )
  )
    return null;
  const discriminant = ball.vy ** 2 + 2 * GRAVITY * (ball.y - height);
  if (discriminant < 0) return null;
  const time = (ball.vy + Math.sqrt(discriminant)) / GRAVITY;
  if (time < 0) return null;
  const x = ball.x + ball.vx * time,
    z = ball.z + ball.vz * time;
  return {
    x,
    y: height,
    z,
    time,
    inBounds:
      Math.abs(x) <= COURT.halfWidth + BALL_RADIUS &&
      Math.abs(z) <= COURT.halfLength + BALL_RADIUS,
  };
}

/** A real incoming ball must still be within racket reach; assistance never moves it.
 * The outer envelope is a defensive reach, with less pace than clean contact.
 */
function contactInfo(
  match,
  index = 0,
  ball = match.ball,
  player = match.players[index]
) {
  if (
    !ball.active ||
    ball.lastHit == null ||
    teamIndex(ball.lastHit) === teamIndex(index) ||
    ball.bounces >= 2 ||
    ball.z * side(index) < -0.12 ||
    ball.y < 0.18 ||
    ball.y > (index === 0 ? PREPARATION_ASSIST.overheadMaxHeight : 2.75) ||
    (ball.isServe &&
      (ball.netTouched ||
        ball.bounces === 0 ||
        (ball.receiver != null && ball.receiver !== index)))
  )
    return null;
  const dx = ball.x - player.x,
    dz = ball.z - player.z;
  const distance = Math.hypot(dx, dz);
  if (index !== 0)
    return distance <= 1.65 ? { kind: "normal", quality: 1, distance } : null;
  const ellipse =
    (dx / PREPARATION_ASSIST.lateralReach) ** 2 +
    (dz / PREPARATION_ASSIST.depthReach) ** 2;
  if (ellipse > 1) return null;
  const speedSquared = ball.vx ** 2 + ball.vz ** 2;
  const sincePassage =
    ball.wallBounces > 0
      ? 0
      : speedSquared > 0.1
      ? (dx * ball.vx + dz * ball.vz) / speedSquared
      : 0;
  // Small late swings still catch the real ball. A ball that has already escaped
  // behind the player cannot be pulled back by the commitment buffer.
  if (distance > 1.25 && sincePassage > PREPARATION_ASSIST.lateGrace)
    return null;
  const kind =
    distance > 1.85 || ball.y < 0.4
      ? "stretch"
      : distance > 1.25
      ? "reach"
      : "normal";
  return {
    kind,
    quality: kind === "normal" ? 1 : kind === "reach" ? 0.82 : 0.62,
    distance,
  };
}

/** Advance a free ball through actual floor, glass and mesh contacts. The same
 * stepper drives live physics, NPC interception and the human preparation cue. */
function advanceFlight(ball, dt) {
  const events = [];
  let remaining = dt;
  for (let iteration = 0; remaining > 1e-7 && iteration < 6; iteration++) {
    let time = remaining,
      collision = null;
    const consider = (candidate, type, boundary = null) => {
      if (candidate >= -1e-8 && candidate <= time) {
        time = Math.max(0, candidate);
        collision = { type, boundary };
      }
    };
    const floor = predictLanding(ball);
    if (floor) consider(floor.time, "floor");
    if (Math.abs(ball.vx) > 1e-6) {
      const boundary = Math.sign(ball.vx) * (COURT.halfWidth - BALL_RADIUS);
      const hitTime = (boundary - ball.x) / ball.vx;
      const height =
        ball.y + ball.vy * hitTime - (GRAVITY * hitTime * hitTime) / 2;
      if (height <= COURT.sideWallHeight + BALL_RADIUS)
        consider(hitTime, "side", boundary);
      else consider(hitTime, "side-exit", boundary);
    }
    if (Math.abs(ball.vz) > 1e-6) {
      const boundary = Math.sign(ball.vz) * (COURT.halfLength - BALL_RADIUS);
      const hitTime = (boundary - ball.z) / ball.vz;
      const height =
        ball.y + ball.vy * hitTime - (GRAVITY * hitTime * hitTime) / 2;
      if (height <= COURT.backFenceHeight + BALL_RADIUS)
        consider(hitTime, "back", boundary);
      else consider(hitTime, "back-exit", boundary);
      const netTime = -ball.z / ball.vz;
      if (netTime > 1e-7 && netTime <= time) {
        const x = ball.x + ball.vx * netTime;
        const y =
          ball.y + ball.vy * netTime - (GRAVITY * netTime * netTime) / 2;
        if (Math.abs(x) <= COURT.halfWidth && y <= netHeightAt(x) + BALL_RADIUS)
          consider(netTime, "net");
      }
    }
    ball.x += ball.vx * time;
    ball.y += ball.vy * time - (GRAVITY * time * time) / 2;
    ball.z += ball.vz * time;
    ball.vy -= GRAVITY * time;
    remaining -= time;
    if (!collision) break;
    const position = { x: ball.x, y: ball.y, z: ball.z };
    const hittingTeam = teamIndex(ball.lastHit);
    const fault = (reason) => ({
      type: ball.isServe ? "serve-fault" : "point",
      reason,
      winner: 1 - hittingTeam,
    });
    if (collision.type.endsWith("-exit")) {
      const legal = ball.bounces > 0;
      if (ball.isServe && ball.netTouched && legal)
        events.push({ type: "serve-let", reason: "Net let" });
      else if (!legal) events.push(fault("Out before bounce"));
      else {
        const smashWinner = ball.shotType === "smash";
        events.push({
          type: "out-of-court",
          position,
          side: collision.type.split("-")[0],
          playerIndex: ball.lastHit,
          smashWinner,
        });
        events.push({
          type: "point",
          winner: hittingTeam,
          reason: smashWinner ? "Smash out of court" : "Out of court winner",
          outOfCourt: true,
          smashWinner,
        });
      }
      break;
    }
    if (collision.type === "net") {
      events.push({ type: "net", position });
      if (ball.bounces > 0) {
        ball.z = -Math.sign(ball.vz) * 0.01;
        ball.vz *= -0.16;
        ball.vy = Math.min(0.2, ball.vy);
        continue;
      }
      // Clipping the tape can be a service let, but only if the subsequent
      // diagonal bounce is legal and the serve does not hit the mesh.
      if (ball.isServe && ball.y >= netHeightAt(ball.x) - BALL_RADIUS) {
        ball.netTouched = true;
        ball.y = netHeightAt(ball.x) + BALL_RADIUS + 0.005;
        ball.vx *= 0.82;
        ball.vz *= 0.82;
        ball.vy = Math.max(0.25, ball.vy * 0.35);
        ball.z += Math.sign(ball.vz) * 0.001;
        continue;
      }
      events.push(fault("Net"));
      break;
    }
    if (collision.type === "floor") {
      ball.y = BALL_RADIUS;
      const inBounds =
        Math.abs(ball.x) <= COURT.halfWidth + BALL_RADIUS &&
        Math.abs(ball.z) <= COURT.halfLength + BALL_RADIUS &&
        ball.z * -side(ball.lastHit) > 0;
      const serviceValid =
        !ball.isServe ||
        (inBounds &&
          Math.abs(ball.z) <= COURT.serviceLine + BALL_RADIUS &&
          ball.x * ball.serviceXSign >= -BALL_RADIUS);
      events.push({
        type: "bounce",
        position: { ...position, y: BALL_RADIUS },
        count: ball.bounces + 1,
        inBounds: inBounds && serviceValid,
      });
      if (ball.bounces === 0 && (!inBounds || !serviceValid)) {
        events.push(fault("Out"));
        break;
      }
      ball.bounces++;
      if (ball.bounces >= 2) {
        events.push({
          type: ball.isServe && ball.netTouched ? "serve-let" : "point",
          winner: hittingTeam,
          reason: "Second bounce",
        });
        break;
      }
      const horizontalEnergy = ball.vx ** 2 + ball.vz ** 2;
      const impactEnergy = horizontalEnergy + ball.vy ** 2;
      const smash =
        ball.shotType === "smash" ? clamp(ball.smashPower || 0, 0, 1) : 0;
      const retention = 0.88 - smash * 0.08;
      const normalBounce = Math.max(1.6, -ball.vy * 0.76);
      // Topspin turns a portion of retained horizontal energy into the upward
      // kick. Total post-bounce energy stays below the actual impact energy.
      const kick = Math.sqrt(
        Math.max(
          normalBounce ** 2,
          impactEnergy * 0.87 - horizontalEnergy * retention ** 2
        )
      );
      ball.vy = normalBounce + (kick - normalBounce) * smash;
      ball.vx *= retention;
      ball.vz *= retention;
      continue;
    }
    const surface =
      collision.type === "back"
        ? ball.y <= COURT.backGlassHeight + BALL_RADIUS
          ? "glass"
          : "fence"
        : Math.abs(ball.z) >= COURT.sideGlassStartsAt &&
          ball.y <= COURT.backGlassHeight + BALL_RADIUS
        ? "glass"
        : "fence";
    events.push({ type: "wall", surface, side: collision.type, position });
    // Glass on one's own half is a legal bank shot; a direct shot into the
    // opponents' enclosure before a floor bounce is a fault.
    const ownGlass =
      surface === "glass" && ball.z * side(ball.lastHit) > 0 && !ball.isServe;
    if (ball.bounces === 0 && !ownGlass) {
      events.push(fault("Wall before floor"));
      break;
    }
    if (ball.isServe && surface === "fence") {
      events.push(fault("Serve hit the fence"));
      break;
    }
    ball.wallBounces = (ball.wallBounces || 0) + 1;
    if (collision.type === "back") {
      ball.z = collision.boundary - Math.sign(collision.boundary) * 0.0001;
      ball.vz *= surface === "glass" ? -0.78 : -0.59;
      ball.vx *= 0.96;
    } else {
      ball.x = collision.boundary - Math.sign(collision.boundary) * 0.0001;
      ball.vx *= surface === "glass" ? -0.78 : -0.59;
      ball.vz *= 0.96;
    }
  }
  return events;
}

/** Next floor cue with enclosure rebounds included. Unlike predictLanding this
 * never projects through a glass panel. A wall/net fault before the floor has no cue. */
export function predictCourtLanding(ball, maxTime = 4) {
  if (
    !ball ||
    ![ball.x, ball.y, ball.z, ball.vx, ball.vy, ball.vz].every(Number.isFinite)
  )
    return null;
  const projected = { ...ball };
  for (let time = STEP; time <= Math.min(6, maxTime) + 1e-8; time += STEP) {
    const events = advanceFlight(projected, STEP);
    const bounce = events.find((event) => event.type === "bounce");
    if (bounce)
      return {
        ...bounce.position,
        time,
        inBounds: bounce.inBounds,
        afterWall: (projected.wallBounces || 0) > (ball.wallBounces || 0),
      };
    if (
      events.some(
        (event) =>
          event.type === "point" ||
          event.type === "serve-fault" ||
          event.type === "serve-let"
      )
    )
      return null;
  }
  return null;
}

function projectedPassage(ball, maxTime) {
  const projected = { ...ball };
  const frames = [];
  for (let time = STEP; time <= maxTime + 1e-8; time += STEP) {
    const events = advanceFlight(projected, STEP);
    if (
      events.some(
        (event) =>
          event.type === "point" ||
          event.type === "serve-fault" ||
          event.type === "serve-let"
      )
    )
      break;
    frames.push({ ...projected, time });
  }
  return frames;
}

/** Find a reachable passage, including floor and enclosure rebounds. */
export function predictPreparationContact(match, index = 0, options = {}) {
  const b = match.ball,
    p = match.players[index],
    receivingSide = side(index);
  if (
    match.phase !== "rally" ||
    !b.active ||
    b.lastHit == null ||
    teamIndex(b.lastHit) === teamIndex(index) ||
    b.bounces >= 2 ||
    ![b.x, b.y, b.z, b.vx, b.vy, b.vz].every(Number.isFinite)
  )
    return null;
  const maxTime = Math.min(
    PREPARATION_ASSIST.maxTime,
    options.maxTime ?? Infinity
  );
  const origin = options.origin ?? p;
  const preferOverhead = options.overhead ?? p.preparedStroke === "smash";
  let best = null;
  for (const contact of projectedPassage(b, maxTime)) {
    if (
      contact.time < PREPARATION_ASSIST.minTime ||
      contact.z * receivingSide < 0.2 ||
      contact.y < 0.3 ||
      contact.y > (index === 0 ? PREPARATION_ASSIST.overheadMaxHeight : 2.75) ||
      (options.requireOverhead &&
        contact.y < PREPARATION_ASSIST.overheadMinHeight)
    )
      continue;
    const stroke =
      options.stroke ??
      (contact.y > 2
        ? "smash"
        : (contact.x - p.x) * receivingSide >= -0.12
        ? "forehand"
        : "backhand");
    const desired = {
      x: clamp(
        contact.x -
          (stroke === "smash" ? 0 : stroke === "forehand" ? 0.7 : -0.7) *
            receivingSide,
        -COURT.halfWidth + 0.38,
        COURT.halfWidth - 0.38
      ),
      z:
        receivingSide *
        clamp(contact.z * receivingSide + 0.38, 0.7, COURT.halfLength - 0.4),
    };
    const overhead = contact.y >= PREPARATION_ASSIST.overheadMinHeight;
    const maxDistance = overhead
      ? PREPARATION_ASSIST.overheadMaxDistance
      : PREPARATION_ASSIST.maxDistance;
    const maxSpeed = overhead
      ? PREPARATION_ASSIST.overheadMaxSpeed
      : PREPARATION_ASSIST.maxSpeed;
    const fromOrigin = Math.hypot(desired.x - origin.x, desired.z - origin.z);
    if (fromOrigin > maxDistance) {
      const ratio = maxDistance / fromOrigin;
      desired.x = origin.x + (desired.x - origin.x) * ratio;
      desired.z = origin.z + (desired.z - origin.z) * ratio;
    }
    const wantedDistance = Math.hypot(desired.x - p.x, desired.z - p.z);
    const available = Math.max(0, contact.time - 0.025);
    const allowedDistance = Math.min(
      (maxSpeed * available) / 1.5,
      (PREPARATION_ASSIST.maxAcceleration * available ** 2) / 6
    );
    const ratio =
      wantedDistance > 0 ? Math.min(1, allowedDistance / wantedDistance) : 0;
    const target = {
      x: p.x + (desired.x - p.x) * ratio,
      z: p.z + (desired.z - p.z) * ratio,
    };
    const reach = contactInfo(match, index, contact, { ...p, ...target });
    if (!reach) continue;
    const distance = Math.hypot(target.x - p.x, target.z - p.z);
    const duration = Math.max(
      0.08,
      (1.5 * distance) / maxSpeed,
      Math.sqrt((6 * distance) / PREPARATION_ASSIST.maxAcceleration)
    );
    const cost =
      distance * 0.42 +
      Math.abs(contact.y - (preferOverhead ? 2.7 : 1.15)) *
        (preferOverhead ? 0.7 : 0.22) +
      (preferOverhead && overhead ? -1.1 : 0) +
      Math.abs(reach.distance - 0.78) * 0.85 +
      contact.time * 0.12 +
      (1 - reach.quality) * 2;
    if (!best || cost < best.cost)
      best = {
        contact: {
          x: contact.x,
          y: contact.y,
          z: contact.z,
          time: contact.time,
        },
        target,
        stroke,
        duration,
        distance,
        cost,
        afterBounce: contact.bounces > b.bounces,
        afterWall: contact.wallBounces > (b.wallBounces || 0),
        contactKind: reach.kind,
        contactQuality: reach.quality,
        contactDistance: reach.distance,
      };
  }
  return best;
}

function shotPlan(
  match,
  input,
  index = 0,
  request = null,
  expectedSource = null
) {
  const player = match.players[index];
  const serving = match.phase === "serve" && match.server === index;
  const charge = request?.charge ?? match.charge;
  const lob = !serving && Boolean(request?.lob ?? input.lob);
  const powered =
    !lob && (request?.powered ?? Boolean(input.powerHeld || charge > 0));
  const timing = charge;
  const timingQuality =
    charge < 0.68
      ? clamp(charge / 0.68, 0.18, 1)
      : charge <= 0.98
      ? 1
      : clamp(1 - (charge - 0.98) * 1.65, 0.08, 1);
  const sweetSpot = powered && charge >= 0.68 && charge <= 0.98;
  const contactQuality = request?.contactQuality ?? 1;
  const quality = (powered ? timingQuality : 0.96) * contactQuality;
  const qualityLabel = lob
    ? "Lob"
    : !powered
    ? "Control"
    : sweetSpot
    ? "Perfect"
    : charge < 0.52
    ? "Early"
    : charge > 1.08
    ? "Late"
    : "Good";
  const power = powered
    ? clamp(0.42 + Math.min(charge, 1.08) * 0.58, 0.42, 1)
    : 0.46;
  const aimX = clamp(
      finite(request?.aimX ?? input.aimX),
      -AIM_LIMIT,
      AIM_LIMIT
    ),
    aimZ = clamp(finite(request?.aimZ ?? input.aimZ), -AIM_LIMIT, AIM_LIMIT);
  const opponentSide = -side(index);
  const overheadIntent =
    !serving &&
    powered &&
    (request?.stroke === "smash" ||
      player.preparedStroke === "smash" ||
      (expectedSource ?? match.ball).y >= PREPARATION_ASSIST.overheadMinHeight);
  let target = serving
    ? {
        x: -Math.sign(player.x || side(index)) * 2.3 + aimX * 2.1,
        y: BALL_RADIUS,
        z: opponentSide * (4.7 - aimZ * 1.7),
      }
    : {
        x: aimX * (overheadIntent ? 4.1 : powered ? 4.9 : 4.25),
        y: BALL_RADIUS,
        z:
          opponentSide *
          (overheadIntent
            ? 3.45 - aimZ * 2
            : 6.2 - aimZ * (powered ? 3.4 : 2.9)),
      };
  const aimRisk = Math.max(0.2, Math.abs(aimX), Math.abs(aimZ));
  const error = powered ? (1 - quality) * (0.45 + power * 2.7) * aimRisk : 0.04;
  const ordinal =
    match.rallyHits * 3 +
    (match.score[0] + match.score[1]) * 31 +
    match.serveAttempt * 7;
  const noiseX = stableNoise(match.seed, ordinal + 1),
    noiseZ = stableNoise(match.seed, ordinal + 2);
  // Preview and launch use this exact deterministic placement; no hidden random roll on release.
  target.x += noiseX * error;
  target.z +=
    opponentSide *
    (Math.abs(noiseZ) * error +
      Math.max(0, charge - 1.0) * (powered ? 1.9 * aimRisk : 0));
  // Sweet timing rewards ambitious aiming with a legal landing. The same corrected
  // target drives both the visible marker and the launched ball.
  if (sweetSpot) {
    const margin = BALL_RADIUS + 0.1;
    target.x = serving
      ? -Math.sign(player.x || side(index)) *
        clamp(
          target.x * -Math.sign(player.x || side(index)),
          margin,
          COURT.halfWidth - margin
        )
      : clamp(target.x, -COURT.halfWidth + margin, COURT.halfWidth - margin);
    target.z =
      opponentSide *
      clamp(
        target.z * opponentSide,
        0.45,
        (serving ? COURT.serviceLine : COURT.halfLength) - margin
      );
  }
  if (lob) {
    target.x = clamp(target.x, -4.6, 4.6);
    target.z = opponentSide * clamp(7.8 - aimZ * 1.4, 5.5, 9.4);
  }
  if (request?.target) target = { ...request.target };
  const source = serving
    ? { x: player.x, y: 0.78, z: player.z - side(index) * 0.25 }
    : {
        x: (expectedSource ?? match.ball).x,
        y: Math.max(BALL_RADIUS, (expectedSource ?? match.ball).y),
        z: (expectedSource ?? match.ball).z,
      };
  const smash =
    overheadIntent &&
    source.y >= PREPARATION_ASSIST.overheadMinHeight &&
    source.y <= PREPARATION_ASSIST.overheadMaxHeight + 0.01;
  const smashPower = smash ? smashStrength(source, power, quality) : 0;
  const distance = Math.hypot(target.x - source.x, target.z - source.z);
  const pace =
    (serving
      ? 10.5 + power * 4.5
      : smash
      ? 22 + power * 11
      : 10.5 + power * 10.5) *
    (0.62 + contactQuality * 0.38);
  let time = lob
    ? 2.05 + distance / 42
    : clamp(distance / pace, smash ? 0.2 : 0.56, 1.85);
  const fraction = -source.z / (target.z - source.z);
  if (fraction > 0 && fraction < 1) {
    const netX = source.x + (target.x - source.x) * fraction;
    const clearance = powered ? 0.12 - (1 - quality) * 0.08 : 0.34;
    const desiredY = netHeightAt(netX) + BALL_RADIUS + clearance;
    const linearY = source.y * (1 - fraction) + BALL_RADIUS * fraction;
    const required =
      (2 * (desiredY - linearY)) / (GRAVITY * fraction * (1 - fraction));
    if (required > 0) time = Math.max(time, Math.sqrt(required));
  }
  const velocity = {
    vx: (target.x - source.x) / time,
    vy: (BALL_RADIUS - source.y + 0.5 * GRAVITY * time ** 2) / time,
    vz: (target.z - source.z) / time,
  };
  const serviceGood =
    !serving ||
    (Math.sign(target.x) === -Math.sign(player.x || side(index)) &&
      Math.abs(target.z) <= COURT.serviceLine + BALL_RADIUS);
  const inBounds =
    Math.abs(target.x) <= COURT.halfWidth + BALL_RADIUS &&
    Math.abs(target.z) <= COURT.halfLength + BALL_RADIUS &&
    Math.sign(target.z) === opponentSide;
  const netY =
    fraction > 0 && fraction < 1
      ? source.y * (1 - fraction) +
        BALL_RADIUS * fraction +
        0.5 * GRAVITY * time ** 2 * fraction * (1 - fraction)
      : Infinity;
  const clearsNet =
    netY >=
    netHeightAt(source.x + (target.x - source.x) * fraction) + BALL_RADIUS;
  const preparedStroke = request?.stroke ?? player.preparedStroke;
  const validPreparation =
    (powered || request?.stroke) &&
    (preparedStroke === "forehand" ||
      preparedStroke === "backhand" ||
      preparedStroke === "smash");
  const stroke = serving
    ? "serve"
    : smash
    ? "smash"
    : validPreparation
    ? preparedStroke
    : source.y > 2.0
    ? "smash"
    : (source.x - player.x) * side(index) >= -0.12
    ? "forehand"
    : "backhand";
  return {
    x: target.x,
    z: target.z,
    radius: 0.12 + error * 0.4,
    target,
    landing: { ...target, time, inBounds: inBounds && serviceGood },
    source,
    velocity,
    charge,
    timing,
    power,
    quality,
    qualityLabel,
    contactQuality,
    contactKind: request?.contactKind ?? "normal",
    stroke,
    speed: Math.hypot(velocity.vx, velocity.vy, velocity.vz),
    charging: Boolean(input.powerHeld),
    safe: inBounds && serviceGood && clearsNet,
    clearsNet,
    ready: serving || canReach(match, index),
    powered,
    lob,
    smashPower,
    smashOpportunity: smash && smashPower > 0.45,
    shotType: serving
      ? "serve"
      : lob
      ? "lob"
      : smash
      ? "smash"
      : match.ball.bounces === 0
      ? "volley"
      : powered
      ? "power"
      : "control",
  };
}

export function getShotPreview(match, input = {}) {
  const p = match.players[0];
  const preparing = Boolean(
    input.powerHeld || match.charge > 0 || p.swingPending
  );
  // The idle cue promises that pressing control now will be accepted. Its
  // horizon must match the committed stroke, not the longer charge-preparation scan.
  const predicted =
    preparing && p.assistContact && p.assistContact.time >= 0
      ? { contact: p.assistContact, contactKind: p.contactKind ?? "normal" }
      : predictPreparationContact(match, 0, {
          maxTime: preparing
            ? PREPARATION_ASSIST.maxTime
            : PREPARATION_ASSIST.commitmentTime - CONTACT_MARGIN,
        });
  const current = contactInfo(match);
  const serving = match.phase === "serve" && match.server === 0;
  const preferred = predicted?.contact;
  const waitForContact =
    preferred &&
    preferred.time > STEP * 2 &&
    (!current ||
      (preferred.distance != null &&
        preferred.distance + 0.12 < current.distance) ||
      (p.preparedStroke === "smash" && match.ball.y + 0.15 < preferred.y) ||
      match.ball.z < p.z - 0.65);
  const expectedContact = waitForContact || !current ? preferred : match.ball;
  const estimated = !serving && !expectedContact;
  const source = expectedContact ?? {
    x: clamp(
      p.x + (p.preparedStroke === "backhand" ? -0.65 : 0.65),
      -COURT.halfWidth + 0.15,
      COURT.halfWidth - 0.15
    ),
    y: 1.2,
    z: Math.max(0.7, p.z - 0.25),
  };
  // Plan the outgoing flight from the future racket contact, never from the
  // incoming ball's unrelated current location on the other side of the court.
  const plan = shotPlan(match, input, 0, match.pendingShot, source);
  const overhead = predictPreparationContact(match, 0, {
    overhead: true,
    requireOverhead: true,
  });
  const overheadContact =
    current && match.ball.y >= PREPARATION_ASSIST.overheadMinHeight
      ? match.ball
      : overhead?.contact;
  const smashOpportunity = Boolean(
    overheadContact && Math.abs(overheadContact.z) <= 6.5
  );
  return {
    ...plan,
    smashOpportunity,
    smashPower:
      smashOpportunity && plan.powered
        ? smashStrength(overheadContact, plan.power, plan.quality)
        : 0,
    smashContact: overheadContact
      ? {
          x: overheadContact.x,
          y: overheadContact.y,
          z: overheadContact.z,
          time: overheadContact.time ?? 0,
        }
      : null,
    committed: Boolean(p.swingPending),
    waiting: Boolean(p.swingPending && p.contactTimeToHit > STEP * 2),
    reachable: serving || Boolean(current || predicted),
    estimated,
    launchDelay:
      serving || expectedContact === match.ball
        ? 0
        : expectedContact?.time ?? null,
    contactKind: current?.kind ?? predicted?.contactKind ?? null,
    contact: predicted?.contact ? { ...predicted.contact } : null,
  };
}
/** Pure outgoing trajectory using the same collision stepper as the live ball.
 * Includes the first legal bounce and a short playable glass continuation. */
export function getShotTrajectory(match, preview, options = {}) {
  const empty = { points: [], bounce: null, blocked: false, safe: false };
  if (
    (!preview?.reachable && !preview?.estimated) ||
    !preview.source ||
    !preview.velocity ||
    ![
      preview.source.x,
      preview.source.y,
      preview.source.z,
      preview.velocity.vx,
      preview.velocity.vy,
      preview.velocity.vz,
    ].every(Number.isFinite)
  )
    return empty;
  const maxTime = clamp(finite(options.maxTime, 4.5), 0.1, 6);
  const afterBounce = clamp(finite(options.afterBounce, 0.8), 0, 1.5);
  const maxPoints = Math.floor(clamp(finite(options.maxPoints, 128), 8, 192));
  const sampleInterval = Math.max(
    STEP * 2,
    maxTime / (maxPoints - 12 > 0 ? maxPoints - 12 : maxPoints)
  );
  const serving = preview.shotType === "serve";
  const ball = {
    ...preview.source,
    ...preview.velocity,
    active: true,
    lastHit: 0,
    bounces: 0,
    wallBounces: 0,
    isServe: serving,
    netTouched: false,
    receiver: serving ? match.receiver : null,
    serviceXSign: -Math.sign(match.players[0].x || 1),
    shotType: preview.shotType,
    smashPower: preview.smashPower || 0,
  };
  const points = [{ ...preview.source }];
  let bounce = null,
    blocked = false,
    bounceTime = null,
    nextSample = sampleInterval;
  const append = (position) => {
    const point = { x: position.x, y: position.y, z: position.z };
    const previous = points.at(-1);
    if (
      Math.hypot(
        point.x - previous.x,
        point.y - previous.y,
        point.z - previous.z
      ) < 1e-5
    )
      return;
    if (points.length < maxPoints) points.push(point);
    else points[maxPoints - 1] = point;
  };
  for (let time = 0; time < maxTime - 1e-8; ) {
    const dt = Math.min(STEP, maxTime - time);
    const events = advanceFlight(ball, dt);
    time += dt;
    let terminal = false;
    let stopPosition = null;
    for (const event of events) {
      if (event.position) append(event.position);
      if (event.type === "bounce" && event.count === 1) {
        if (event.inBounds) {
          bounce = { ...event.position };
          bounceTime = time;
        } else blocked = true;
      }
      if (event.type === "net") {
        blocked = true;
        terminal = true;
        stopPosition = event.position;
        break;
      }
      if (
        ["point", "serve-fault", "serve-let", "out-of-court"].includes(
          event.type
        )
      ) {
        if (
          event.type === "serve-fault" ||
          event.type === "serve-let" ||
          (event.type === "point" && event.winner !== 0)
        )
          blocked = true;
        terminal = true;
      }
    }
    if (
      time >= nextSample ||
      terminal ||
      time >= maxTime ||
      (bounceTime !== null && time - bounceTime >= afterBounce)
    ) {
      append(stopPosition ?? ball);
      nextSample = time + sampleInterval;
    }
    if (terminal || (bounceTime !== null && time - bounceTime >= afterBounce))
      break;
  }
  return {
    points,
    bounce,
    blocked,
    safe: Boolean(preview.safe && bounce && !blocked),
    estimated: Boolean(preview.estimated),
  };
}

/** Convert a point on the opponent court into the normalized aim used by shot plans. */
export function aimFromWorld(match, x, z, input = {}) {
  const serving = match.phase === "serve" && match.server === 0;
  const powered = Boolean(input.powerHeld || match.charge > 0);
  const overhead =
    powered &&
    (match.players[0].preparedStroke === "smash" ||
      match.ball.y >= PREPARATION_ASSIST.overheadMinHeight);
  return serving
    ? {
        aimX: clamp(
          (x + Math.sign(match.players[0].x || 1) * 2.3) / 2.1,
          -AIM_LIMIT,
          AIM_LIMIT
        ),
        aimZ: clamp((z + 4.7) / 1.7, -AIM_LIMIT, AIM_LIMIT),
      }
    : {
        aimX: clamp(
          x / (overhead ? 4.1 : powered ? 4.9 : 4.25),
          -AIM_LIMIT,
          AIM_LIMIT
        ),
        aimZ: clamp(
          overhead ? (z + 3.45) / 2 : (z + 6.2) / (powered ? 3.4 : 2.9),
          -AIM_LIMIT,
          AIM_LIMIT
        ),
      };
}

function canReach(match, index) {
  return Boolean(contactInfo(match, index));
}

export function createMatch(options = {}) {
  let random,
    accumulator = 0,
    pending = {},
    heldInput = {},
    request = null,
    shotCooldown = 0,
    aiReact = 0,
    aiTargets = [null, null, null, null],
    aiReceiver = null,
    aiPlanTime = 0,
    assistance = null,
    preparationOrigin = null,
    preparationSequence = null,
    wasPowerHeld = false,
    recovery = null,
    ballOrdinal = 0,
    inputArmed = true;
  const match = {
    players: [],
    ball: {},
    looseBalls: [],
    recovering: false,
    recoveryKind: null,
    settled: true,
    score: [0, 0],
    phase: "ready",
    server: 0,
    serveAttempt: 1,
    rallyHits: 0,
    winner: null,
    message: "",
    charge: 0,
    lastFeedback: null,
    pendingShot: null,
    events: [],
    time: 0,
    phaseTime: 0,
    seed: 901,
    difficulty: "practice",
    targetScore: 7,
    maxScore: 15,
    update,
    reset,
    start,
    consumeEvents,
    drainEvents: consumeEvents,
    cancelInput() {
      match.charge = 0;
      match.players[0].charge = 0;
      const recovering = match.recovering || match.phase === "finished";
      const velocity = { vx: match.players[0].vx, vz: match.players[0].vz };
      clearPreparation(recovering);
      if (recovering) Object.assign(match.players[0], velocity);
      wasPowerHeld = false;
      pending = {};
      request = null;
      match.pendingShot = null;
      heldInput = {};
    },
    getShotPreview: (input = heldInput) => getShotPreview(match, input),
  };
  function emit(type, data = {}) {
    match.events.push({ type, time: match.time, ...data });
    if (match.events.length > 150) match.events.shift();
  }
  function consumeEvents() {
    return match.events.splice(0);
  }
  function player(index) {
    return {
      id: ["human", "opponent-left", "partner", "opponent-right"][index],
      team: teamIndex(index),
      human: index === 0,
      x: index < 2 ? -2.4 : 2.4,
      y: 0,
      z: side(index) * 8.1,
      vx: 0,
      vz: 0,
      yaw: side(index) > 0 ? Math.PI : 0,
      action: "idle",
      actionTime: 0,
      actionDuration: 0,
      grounded: true,
      padelStroke: null,
      strokeProgress: 0,
      charge: 0,
      preparedStroke: null,
      manualPreparation: false,
      preparationTime: 0,
      swingPending: false,
      contactKind: null,
      contactQuality: 1,
      contactPoint: null,
      assistActive: false,
      assistTarget: null,
      assistContact: null,
      contactTimeToHit: null,
      radius: 0.35,
      recovering: false,
    };
  }
  function reset(next = {}) {
    const config = {
      seed: 901,
      difficulty: "practice",
      ...MATCH_RULES,
      ...options,
      ...next,
    };
    match.seed = finite(Number(config.seed), 901);
    match.difficulty = config.difficulty;
    match.targetScore = Math.max(1, Math.floor(config.targetScore));
    match.maxScore = Math.max(match.targetScore, Math.floor(config.maxScore));
    random = randomGenerator(match.seed);
    accumulator = 0;
    pending = {};
    heldInput = {};
    request = null;
    shotCooldown = 0;
    aiReact = 0;
    aiTargets = [null, null, null, null];
    aiReceiver = null;
    aiPlanTime = 0;
    assistance = null;
    preparationOrigin = null;
    preparationSequence = null;
    wasPowerHeld = false;
    recovery = null;
    ballOrdinal = 0;
    inputArmed = true;
    Object.assign(match, {
      players: [player(0), player(1), player(2), player(3)],
      ball: {
        x: 0,
        y: 1.05,
        z: 8.1,
        vx: 0,
        vy: 0,
        vz: 0,
        active: false,
        lastHit: null,
        bounces: 0,
        isServe: false,
      },
      score: [0, 0],
      looseBalls: [],
      recovering: false,
      recoveryKind: null,
      settled: true,
      phase: "ready",
      server: 0,
      serveAttempt: 1,
      rallyHits: 0,
      winner: null,
      message: "Your serve. Work the glass.",
      charge: 0,
      lastFeedback: null,
      pendingShot: null,
      events: [],
      time: 0,
      phaseTime: 0,
      pointReason: "",
    });
    prepareServe(false, { immediate: true });
    match.phase = "ready";
    match.settled = true;
    return match;
  }
  function start() {
    if (match.phase !== "ready") return;
    match.phase = "serve";
    match.phaseTime = 0;
    match.message = "Your serve · J for control or hold Enter for power";
    match.settled = false;
  }
  function serveFormation(second = false) {
    const total = match.score[0] + match.score[1];
    const server = second
      ? match.server
      : total === 0
      ? 0
      : (Math.floor((total - 1) / 2) + 1) % 4;
    const targets = match.players.map((p) => ({
      x:
        (p.team === 0 ? -1 : 1) *
        (p.human || p.id === "opponent-left" ? 2.35 : -2.35),
      z: side(p.team) * 7.7,
    }));
    const serverX = (total % 2 === 0 ? 2.25 : -2.25) * side(server);
    targets[server] = { x: serverX, z: side(server) * 8.2 };
    const opponents = match.players
      .map((p, index) => ({ p, index }))
      .filter(({ p }) => p.team !== teamIndex(server));
    const receiver = opponents.reduce((a, b) =>
      Math.abs(targets[a.index].x + serverX) <
      Math.abs(targets[b.index].x + serverX)
        ? a
        : b
    ).index;
    targets[receiver] = { x: -serverX, z: -side(server) * 7.6 };
    targets[server ^ 2] = { x: -serverX, z: side(server) * 3 };
    return { server, receiver, targets };
  }
  function prepareServe(
    second = false,
    { immediate = false, setup = serveFormation(second) } = {}
  ) {
    clearPreparation();
    wasPowerHeld = false;
    inputArmed = immediate;
    pending = {};
    if (match.ball.dead && match.ball.opacity > 0) {
      match.ball.retiredAge = match.ball.deadAge || 0;
      match.looseBalls.push(match.ball);
      if (match.looseBalls.length > 3) match.looseBalls.shift();
    }
    match.server = setup.server;
    match.receiver = setup.receiver;
    match.serviceSide = Math.sign(setup.targets[setup.server].x);
    if (immediate)
      match.players.forEach((p, index) =>
        Object.assign(p, setup.targets[index])
      );
    const server = match.players[match.server];
    for (const p of match.players) {
      p.y = 0;
      p.recovering = false;
      p.vx = 0;
      p.vz = 0;
      p.grounded = true;
      p.charge = 0;
      p.padelStroke = null;
      p.action = "idle";
      p.actionTime = 0;
      p.actionDuration = 0;
      p.strokeProgress = 0;
      p.preparedStroke = null;
      p.manualPreparation = false;
      p.assistContact = null;
      p.contactTimeToHit = null;
      p.preparationTime = 0;
    }
    match.ball = {
      id: ++ballOrdinal,
      opacity: immediate ? 1 : 0,
      fadeIn: immediate ? 0.15 : 0,
      dead: false,
      resting: false,
      x: server.x,
      y: 1.05,
      z: server.z - side(match.server) * 0.4,
      vx: 0,
      vy: 0,
      vz: 0,
      active: false,
      lastHit: null,
      bounces: 0,
      isServe: false,
      wallBounces: 0,
      netTouched: false,
      receiver: null,
      shotType: null,
      smashPower: 0,
      escaped: false,
    };
    recovery = null;
    match.recovering = false;
    match.recoveryKind = null;
    match.settled = false;
    match.phase = "serve";
    match.phaseTime = 0;
    match.rallyHits = 0;
    match.charge = 0;
    request = null;
    shotCooldown = 0;
    aiTargets = [null, null, null, null];
    aiReceiver = null;
    match.receivingPlayer = null;
    aiPlanTime = 0;
    aiReact = 0;
    if (!second) match.serveAttempt = 1;
    match.message = `${
      second
        ? "Second serve"
        : match.server === 0
        ? "Your serve"
        : teamIndex(match.server) === 0
        ? "Partner serving"
        : "Opponents serving"
    }${match.server === 0 ? " · J or hold Enter" : ""}`;
    emit("serve-ready", {
      playerIndex: match.server,
      attempt: match.serveAttempt,
    });
  }
  function awardPoint(winner, reason, details = {}) {
    if (match.phase !== "rally" && match.phase !== "serve") return;
    match.score[winner]++;
    match.pointReason = reason;
    match.phase = "point";
    match.phaseTime = 0;
    match.ball.escaped = Boolean(details.outOfCourt);
    match.charge = 0;
    request = null;
    for (const p of match.players) {
      p.charge = 0;
      p.preparedStroke = null;
      p.assistContact = null;
      p.contactTimeToHit = null;
    }
    match.message = `${
      winner === 0 ? "Your team’s point" : "Opponents’ point"
    } · ${reason}`;
    emit("point", {
      winner,
      reason,
      score: [...match.score],
      rallyHits: match.rallyHits,
      ...details,
    });
    const lead = Math.abs(match.score[0] - match.score[1]);
    if (
      (match.score[winner] >= match.targetScore && lead >= 2) ||
      match.score[winner] >= match.maxScore
    ) {
      match.phase = "finished";
      match.winner = winner;
      match.message = winner === 0 ? "Match won" : "Match complete";
      emit("match-end", { winner, score: [...match.score] });
    }
    beginRecovery(match.phase === "finished" ? "finished" : "point");
  }
  function serveFault(reason) {
    emit("serve-fault", {
      playerIndex: match.server,
      attempt: match.serveAttempt,
      reason,
    });
    if (match.serveAttempt === 1) {
      match.serveAttempt = 2;
      beginRecovery("fault", true);
      match.message = `Fault · second serve${
        match.server === 0 ? " · J or hold Enter" : ""
      }`;
    } else awardPoint(1 - teamIndex(match.server), "Double fault");
  }
  function beginRecovery(kind, second = false) {
    const velocity = { vx: match.players[0].vx, vz: match.players[0].vz };
    clearPreparation(true);
    Object.assign(match.players[0], velocity);
    request = null;
    pending = {};
    heldInput = {};
    wasPowerHeld = false;
    inputArmed = false;
    match.charge = 0;
    match.phase = kind === "finished" ? "finished" : "point";
    match.phaseTime = 0;
    match.recovering = true;
    match.recoveryKind = kind;
    match.settled = false;
    recovery = {
      kind,
      second,
      setup: serveFormation(second),
      minTime: kind === "fault" || kind === "let" ? 1.8 : 2.1,
    };
    const b = match.ball;
    b.dead = true;
    b.deadAge = 0;
    b.resting = false;
    b.rolling = false;
    b.active = true;
    b.opacity = 1;
    b.isServe = false;
    for (const p of match.players) {
      p.charge = 0;
      p.assistContact = null;
      p.contactTimeToHit = null;
      p.preparedStroke = null;
      p.recovering = false;
    }
  }
  function updateDeadBalls(dt) {
    const balls = [
      ...match.looseBalls,
      ...(match.ball.dead ? [match.ball] : []),
    ];
    for (const ball of balls) {
      ball.deadAge = (ball.deadAge || 0) + dt;
      for (const event of advanceDeadBall(ball, dt, {
        court: COURT,
        gravity: GRAVITY,
        radius: BALL_RADIUS,
      })) {
        const { type, ...data } = event;
        emit(type, { ...data, ballId: ball.id, opacity: ball.opacity });
      }
      // Keep the spent ball visibly independent of the new service ball.
      const ageFade = clamp((8 - ball.deadAge) / 1.5, 0, 1);
      const finishFade =
        match.phase === "finished"
          ? clamp((6 - match.phaseTime) / 0.45, 0, 1)
          : 1;
      const retirementFade =
        ball.retiredAge == null
          ? 1
          : clamp(1 - (ball.deadAge - ball.retiredAge) / 1.35, 0, 1);
      ball.opacity = Math.min(ageFade, finishFade, retirementFade);
      if (ball.opacity <= 0) ball.active = false;
    }
    match.looseBalls = match.looseBalls.filter((ball) => ball.deadAge < 8);
    if (!match.ball.dead && match.ball.opacity < 1) {
      match.ball.fadeIn = Math.min(0.15, (match.ball.fadeIn || 0) + dt);
      match.ball.opacity = match.ball.fadeIn / 0.15;
    }
  }
  function updateRecovery(dt) {
    if (!recovery) return;
    let arrived = true;
    for (let index = 0; index < match.players.length; index++) {
      const p = match.players[index],
        target = recovery.setup.targets[index];
      const dx = target.x - p.x,
        dz = target.z - p.z,
        distance = Math.hypot(dx, dz);
      const strokeFinishing = p.padelStroke && p.actionTime < p.actionDuration;
      const settled = distance < 0.07 && Math.hypot(p.vx, p.vz) < 0.2;
      p.recovering = !strokeFinishing && !settled;
      if (!settled) arrived = false;
      if (strokeFinishing || settled) movePlayer(p, 0, 0, 0, dt);
      else {
        const speed = Math.min(5.4, distance * 5.5);
        let moveX = dx / Math.max(distance, 0.00001),
          moveZ = dz / Math.max(distance, 0.00001);
        const teammate = match.players[index ^ 2];
        const separation = Math.hypot(p.x - teammate.x, p.z - teammate.z);
        if (separation < 1.8) {
          const avoidance = (1.8 - separation) * 1.8;
          const forwardX = moveX,
            forwardZ = moveZ;
          moveX -= forwardZ * avoidance;
          moveZ += forwardX * avoidance;
          if (separation > 0.01) {
            moveX += ((p.x - teammate.x) / separation) * avoidance * 0.25;
            moveZ += ((p.z - teammate.z) / separation) * avoidance * 0.25;
          }
        }
        movePlayer(p, moveX, moveZ, speed, dt);
      }
    }
    if (match.phase === "finished") {
      const quiet = [match.ball, ...match.looseBalls].every(
        (ball) => ball.resting || ball.opacity <= 0.001
      );
      if (arrived && quiet && match.phaseTime >= recovery.minTime) {
        match.recovering = false;
        match.settled = true;
        recovery = null;
        for (const p of match.players) p.recovering = false;
        emit("settled");
      }
    } else if (arrived && match.phaseTime >= recovery.minTime)
      prepareServe(recovery.second, { setup: recovery.setup });
  }
  function launch(index, input, shotRequest) {
    const plan = shotPlan(match, input, index, shotRequest),
      p = match.players[index];
    const serving = match.phase === "serve";
    Object.assign(match.ball, {
      ...plan.source,
      ...plan.velocity,
      active: true,
      lastHit: index,
      bounces: 0,
      isServe: serving,
      receiver: serving ? match.receiver : null,
      wallBounces: 0,
      netTouched: false,
      serviceXSign: -Math.sign(p.x || side(index)),
      shotType: plan.shotType,
      smashPower: plan.smashPower,
      escaped: false,
      dead: false,
      resting: false,
      rolling: false,
      opacity: 1,
    });
    p.action = plan.stroke;
    p.contactKind = plan.contactKind;
    p.contactQuality = plan.contactQuality;
    p.contactPoint = { ...plan.source };
    p.actionTime = 0;
    p.actionDuration =
      plan.stroke === "serve" ? 0.78 : plan.stroke === "smash" ? 0.68 : 0.52;
    p.padelStroke = plan.stroke;
    p.strokeProgress = 0;
    match.phase = "rally";
    match.phaseTime = 0;
    match.rallyHits++;
    match.lastFeedback = {
      quality: plan.quality,
      qualityLabel: plan.qualityLabel,
      contactKind: plan.contactKind,
      contactQuality: plan.contactQuality,
      power: plan.power,
      playerIndex: index,
      time: match.time,
      stroke: plan.stroke,
      powered: plan.powered,
      shotType: plan.shotType,
      smashPower: plan.smashPower,
    };
    match.message =
      index === 0
        ? `${plan.qualityLabel}${plan.powered ? " power shot" : " shot"}`
        : index === 2
        ? "Partner has it · cover the net"
        : "Get behind the ball";
    if (index === 0) {
      match.charge = 0;
      request = null;
      p.charge = 0;
      clearPreparation(true);
    }
    shotCooldown = plan.shotType === "smash" ? 0.1 : 0.19;
    aiReact =
      (match.difficulty === "competitive" ? 0.12 : 0.22) +
      plan.smashPower * 0.07;
    aiTargets = [null, null, null, null];
    aiReceiver = null;
    aiPlanTime = 0;
    emit("shot", {
      playerIndex: index,
      power: plan.power,
      quality: plan.quality,
      qualityLabel: plan.qualityLabel,
      contactKind: plan.contactKind,
      contactQuality: plan.contactQuality,
      stroke: plan.stroke,
      position: { ...plan.source },
      target: { ...plan.target },
      speed: plan.speed,
      serving,
      powered: plan.powered,
      shotType: plan.shotType,
      smashPower: plan.smashPower,
      team: teamIndex(index),
    });
  }
  function movePlayer(p, x, z, speed, dt) {
    const magnitude = Math.hypot(x, z);
    if (magnitude > 1) {
      x /= magnitude;
      z /= magnitude;
    }
    const blend = 1 - Math.exp(-17 * dt);
    p.vx += (x * speed - p.vx) * blend;
    p.vz += (z * speed - p.vz) * blend;
    p.x = clamp(
      p.x + p.vx * dt,
      -COURT.halfWidth + 0.38,
      COURT.halfWidth - 0.38
    );
    p.z =
      side(p.team) *
      clamp(
        p.z * side(p.team) + p.vz * side(p.team) * dt,
        0.7,
        COURT.halfLength - 0.4
      );
    if (p.actionTime >= p.actionDuration) {
      p.action =
        Math.hypot(p.vx, p.vz) > 0.15
          ? Math.hypot(p.vx, p.vz) > 3.5
            ? "run"
            : "walk"
          : "idle";
      p.padelStroke = null;
      p.contactKind = null;
      p.contactPoint = null;
      p.contactQuality = 1;
      // Players face the opponent and use lateral footwork, rather than spinning away from the incoming ball.
      p.yaw = p.team === 0 ? Math.PI : 0;
    }
  }
  function clearPreparation(keepContact = false) {
    assistance = null;
    preparationOrigin = null;
    preparationSequence = null;
    match.pendingShot = null;
    const p = match.players[0];
    if (!p) return;
    p.swingPending = false;
    p.manualPreparation = false;
    p.assistActive = false;
    p.assistTarget = null;
    p.assistContact = null;
    p.contactTimeToHit = null;
    p.preparationTime = 0;
    p.preparedStroke = null;
    if (!keepContact) {
      p.contactKind = null;
      p.contactQuality = 1;
      p.contactPoint = null;
    }
    p.vx = p.vz = 0;
  }
  function acquirePreparation(maxTime = PREPARATION_ASSIST.maxTime) {
    const p = match.players[0];
    if (p.assistContact || !preparationOrigin) return;
    const predicted = predictPreparationContact(match, 0, {
      origin: preparationOrigin,
      maxTime: request ? Math.max(0, request.life - CONTACT_MARGIN) : maxTime,
      stroke: request?.stroke,
      overhead: p.preparedStroke === "smash",
    });
    if (!predicted) return;
    if (!request) p.preparedStroke = predicted.stroke;
    p.assistTarget = { ...predicted.target };
    p.assistContact = {
      ...predicted.contact,
      distance: predicted.contactDistance,
      quality: predicted.contactQuality,
    };
    p.contactTimeToHit = predicted.contact.time;
    p.contactKind = predicted.contactKind;
    p.assistActive = predicted.distance > 0.015;
    if (p.assistActive)
      assistance = {
        origin: { x: p.x, z: p.z },
        target: { ...predicted.target },
        duration: predicted.duration,
        elapsed: 0,
      };
  }
  function beginPreparation(
    maxTime = PREPARATION_ASSIST.maxTime,
    preferOverhead = false,
    preserveMotion = false
  ) {
    const p = match.players[0];
    const velocity = { vx: p.vx, vz: p.vz };
    clearPreparation();
    if (preserveMotion) Object.assign(p, velocity);
    preparationOrigin = { x: p.x, z: p.z };
    preparationSequence = match.rallyHits;
    const highPassage =
      preferOverhead &&
      predictPreparationContact(match, 0, {
        maxTime,
        overhead: true,
        requireOverhead: true,
      });
    p.preparedStroke =
      match.phase === "serve" && match.server === 0
        ? "serve"
        : highPassage || match.ball.y > 2
        ? "smash"
        : match.ball.x - p.x >= -0.12
        ? "forehand"
        : "backhand";
    acquirePreparation(maxTime);
  }
  function updatePreparation(dt) {
    const p = match.players[0];
    p.preparationTime += dt;
    // Holding before the opponent returns no longer permanently locks assistance
    // out. Acquire the same incoming passage once it becomes reachable.
    acquirePreparation();
    if (p.assistContact) {
      p.assistContact.time -= dt;
      p.contactTimeToHit = Math.max(0, p.assistContact.time);
    }
    if (p.manualPreparation && !request) {
      assistance = null;
      p.assistActive = false;
      return;
    }
    if (!assistance) {
      p.vx = p.vz = 0;
      return;
    }
    assistance.elapsed = Math.min(assistance.duration, assistance.elapsed + dt);
    const u = assistance.elapsed / assistance.duration;
    const ease = u * u * (3 - 2 * u);
    const velocity = (6 * u * (1 - u)) / assistance.duration;
    p.x =
      assistance.origin.x + (assistance.target.x - assistance.origin.x) * ease;
    p.z =
      assistance.origin.z + (assistance.target.z - assistance.origin.z) * ease;
    p.vx = (assistance.target.x - assistance.origin.x) * velocity;
    p.vz = (assistance.target.z - assistance.origin.z) * velocity;
    if (p.actionTime >= p.actionDuration) {
      p.action = Math.hypot(p.vx, p.vz) > 0.15 ? "walk" : "idle";
      p.yaw = Math.PI;
    }
    if (u >= 1) {
      assistance = null;
      p.assistActive = false;
      p.vx = p.vz = 0;
    }
  }
  function missRequest(reason = "out-of-reach") {
    request = null;
    match.charge = 0;
    match.players[0].charge = 0;
    clearPreparation();
    match.message = "Ball out of reach · move closer before preparing";
    emit("miss", { playerIndex: 0, reason });
  }
  function constrainHumanServe() {
    const p = match.players[0];
    const sign = match.serviceSide || Math.sign(p.x || 1);
    const x = sign * clamp(p.x * sign, 0.4, COURT.halfWidth - 0.38);
    const z = clamp(p.z, COURT.serviceLine + 0.4, COURT.halfLength - 0.4);
    if (x !== p.x) p.vx = 0;
    if (z !== p.z) p.vz = 0;
    p.x = x;
    p.z = z;
    Object.assign(match.ball, { x, y: 1.05, z: z - 0.4 });
  }
  function replanManualPreparation() {
    const p = match.players[0];
    // A manual step establishes a fresh approach budget. Forecast the contact
    // for the cue, but do not drive the avatar toward that forecast while held.
    assistance = null;
    preparationOrigin = { x: p.x, z: p.z };
    p.assistContact = null;
    p.assistTarget = null;
    p.contactTimeToHit = null;
    acquirePreparation();
    assistance = null;
    p.assistActive = false;
    p.manualPreparation = true;
  }
  function updateHuman(dt, input) {
    const p = match.players[0];
    const ownServe = match.phase === "serve" && match.server === 0;
    const incoming =
      match.phase === "rally" &&
      match.ball.active &&
      match.ball.lastHit != null &&
      teamIndex(match.ball.lastHit) === 1;
    if (
      request &&
      (request.sequence !== match.rallyHits || (!ownServe && !incoming))
    )
      missRequest("passage-ended");
    const manualIntent =
      !request && Math.hypot(finite(input.moveX), finite(input.moveZ)) > 0.001;
    if (
      input.powerHeld &&
      !request &&
      (!wasPowerHeld || preparationSequence !== match.rallyHits)
    )
      beginPreparation(PREPARATION_ASSIST.maxTime, true, manualIntent);
    wasPowerHeld = Boolean(input.powerHeld);
    if (
      input.powerHeld &&
      !input.powerReleased &&
      !request &&
      (incoming || ownServe || match.phase === "rally")
    )
      match.charge = Math.min(1.6, match.charge + dt / 0.9);
    const manualFrame =
      !request &&
      (input.powerHeld || input.powerReleased) &&
      (manualIntent || p.manualPreparation) &&
      (ownServe || match.phase === "rally");
    if (manualFrame) {
      movePlayer(
        p,
        finite(input.moveX),
        finite(input.moveZ),
        input.sprint ? 6.6 : 5.4,
        dt
      );
      if (ownServe) constrainHumanServe();
      replanManualPreparation();
    }
    if (
      !request &&
      (input.powerReleased || input.hit || input.lob) &&
      (ownServe || incoming)
    ) {
      // A press is one committed stroke on this ball, not a momentary collision
      // check. Repeated keys cannot extend it or hit a later opponent return.
      if (
        !preparationOrigin ||
        ((input.hit || input.lob) && !input.powerReleased)
      )
        beginPreparation(
          (input.hit || input.lob) && !input.powerReleased
            ? PREPARATION_ASSIST.commitmentTime - CONTACT_MARGIN
            : PREPARATION_ASSIST.maxTime,
          Boolean(input.powerReleased)
        );
      const wasManual = p.manualPreparation;
      p.manualPreparation = false;
      const stroke = p.preparedStroke;
      const committed = {
        powered: Boolean(input.powerReleased),
        charge: input.powerReleased ? match.charge : 0,
        lob: Boolean(input.lob),
        stroke,
        aimX: finite(input.aimX),
        aimZ: finite(input.aimZ),
        life: PREPARATION_ASSIST.commitmentTime,
        sequence: match.rallyHits,
      };
      committed.target = { ...shotPlan(match, input, 0, committed).target };
      request = committed;
      match.pendingShot = request;
      p.swingPending = true;
      p.preparedStroke = stroke;
      match.charge = 0;
      // If preparation had a later plan, re-evaluate it inside the commitment
      // deadline while keeping the current approach movement budget.
      if (
        wasManual ||
        (p.assistContact &&
          (p.assistContact.time > request.life - CONTACT_MARGIN ||
            p.assistContact.time < 0))
      ) {
        assistance = null;
        p.assistContact = null;
        p.assistTarget = null;
        p.assistActive = false;
        acquirePreparation();
      }
      acquirePreparation();
      if (!ownServe && !contactInfo(match) && !p.assistContact) {
        // An impossible request must not take movement away for the whole buffer.
        // The planner already examines the complete remaining legal passage.
        missRequest("unreachable");
        return;
      }
    }
    const preparing = Boolean(
      input.powerHeld ||
        request ||
        input.powerReleased ||
        heldInput.powerReleased
    );
    if (preparing) {
      p.charge = request?.powered ? request.charge : match.charge;
      if (p.actionTime >= p.actionDuration && (p.charge > 0 || p.swingPending))
        p.padelStroke = p.preparedStroke;
      if (request) {
        request.life -= dt;
        let contact = contactInfo(match);
        // Never wait past a ball already level with the racket, but prefer the
        // planned waist-high passage instead of striking at the front edge.
        const improvesContact =
          p.assistContact &&
          p.contactTimeToHit > STEP * 2 &&
          p.assistContact.distance + 0.12 < (contact?.distance ?? Infinity);
        const waitingForOverhead =
          request.powered &&
          request.stroke === "smash" &&
          p.assistContact &&
          p.contactTimeToHit > STEP * 2 &&
          match.ball.y + 0.15 < p.assistContact.y;
        const optimalNow =
          contact &&
          !waitingForOverhead &&
          (!p.assistContact ||
            p.contactTimeToHit <= STEP * 2 ||
            (match.ball.z >= p.z - 0.65 && !improvesContact) ||
            (match.ball.y < 0.45 && match.ball.vy < 0));
        if (shotCooldown <= 0 && (ownServe || optimalNow)) {
          launch(0, input, {
            ...request,
            contactKind: contact?.kind ?? "normal",
            contactQuality: contact?.quality ?? 1,
          });
          return;
        }
      }
      updatePreparation(dt);
      if (request) {
        const contact = contactInfo(match);
        const improvesContact =
          p.assistContact &&
          p.contactTimeToHit > STEP * 2 &&
          p.assistContact.distance + 0.12 < (contact?.distance ?? Infinity);
        if (
          shotCooldown <= 0 &&
          contact &&
          !(
            request.powered &&
            request.stroke === "smash" &&
            p.assistContact &&
            p.contactTimeToHit > STEP * 2 &&
            match.ball.y + 0.15 < p.assistContact.y
          ) &&
          (p.contactTimeToHit === null ||
            p.contactTimeToHit <= STEP * 2 ||
            (match.ball.z >= p.z - 0.65 && !improvesContact) ||
            (match.ball.y < 0.45 && match.ball.vy < 0))
        ) {
          launch(0, input, {
            ...request,
            contactKind: contact.kind,
            contactQuality: contact.quality,
          });
          return;
        }
        if (request.life <= 0) missRequest();
      }
    } else {
      if (preparationOrigin) clearPreparation();
      const canMove = match.phase === "rally" || match.phase === "serve";
      movePlayer(
        p,
        canMove ? finite(input.moveX) : 0,
        canMove ? finite(input.moveZ) : 0,
        input.sprint ? 6.6 : 5.4,
        dt
      );
      if (ownServe) constrainHumanServe();
      match.charge = 0;
      p.charge = 0;
    }
  }
  function updateAI(dt) {
    if (match.phase === "serve") {
      for (const p of match.players.filter((p) => !p.human))
        movePlayer(p, 0, 0, 0, dt);
      if (match.server !== 0 && match.phaseTime > 1.05)
        launch(
          match.server,
          { aimX: (random() - 0.5) * 0.32, aimZ: -0.12 + random() * 0.3 },
          { powered: false, charge: 0 }
        );
      return;
    }
    if (match.phase !== "rally") return;
    const b = match.ball,
      receivingTeam = 1 - teamIndex(b.lastHit);
    aiReact = Math.max(0, aiReact - dt);
    aiPlanTime -= dt;
    if (aiReact <= 0 && aiPlanTime <= 0) {
      aiPlanTime = 0.09;
      const passage = projectedPassage(b, 2.5);
      const candidates = [];
      const speed = match.difficulty === "competitive" ? 5.5 : 4.8;
      for (let index = 0; index < match.players.length; index++) {
        const p = match.players[index];
        if (
          p.team !== receivingTeam ||
          (b.isServe && b.receiver != null && b.receiver !== index)
        )
          continue;
        let best = null;
        for (let i = 0; i < passage.length; i += 3) {
          const contact = passage[i];
          if (
            contact.z * side(index) < 0.35 ||
            contact.y < 0.45 ||
            contact.y > 2.6 ||
            (b.isServe && contact.bounces === 0)
          )
            continue;
          const target = {
            x: clamp(contact.x, -4.6, 4.6),
            z: side(index) * clamp(contact.z * side(index) + 0.18, 0.8, 9.4),
          };
          const distance = Math.hypot(target.x - p.x, target.z - p.z);
          const reachableDistance =
            index === 0
              ? p.swingPending || match.charge > 0
                ? PREPARATION_ASSIST.maxDistance + 1.6
                : 1.8 + Math.hypot(p.vx, p.vz) * Math.min(0.35, contact.time)
              : speed * Math.max(0, contact.time - 0.08) + 1.3;
          if (distance > reachableDistance) continue;
          const cost =
            contact.time * 0.45 +
            distance * 0.3 +
            Math.abs(contact.y - 1.25) * 0.08 -
            (index === 0 ? 0.65 : 0);
          if (!best || cost < best.cost)
            best = { index, target, cost, contact };
        }
        if (best) candidates.push(best);
      }
      candidates.sort((a, b) => a.cost - b.cost);
      // One receiver owns the ball; the other covers. A committed human swing
      // always takes precedence over the teammate's automatic return.
      const human = candidates.find((candidate) => candidate.index === 0);
      const chosen =
        human && (match.players[0].swingPending || match.charge > 0)
          ? human
          : candidates.find(
              (candidate) =>
                candidate.index === aiReceiver &&
                candidate.cost <= (candidates[0]?.cost ?? 0) + 0.5
            ) ?? candidates[0];
      aiReceiver = chosen?.index ?? null;
      match.receivingPlayer = aiReceiver;
      if (chosen) {
        aiTargets[chosen.index] = chosen.target;
        const receiver = match.players[chosen.index];
        if (
          chosen.index !== 0 &&
          chosen.contact.y >= PREPARATION_ASSIST.overheadMinHeight &&
          chosen.contact.time <= 0.4
        ) {
          receiver.preparedStroke = "smash";
          receiver.assistContact = { ...chosen.contact };
          receiver.contactTimeToHit = chosen.contact.time;
        }
      }
    }
    for (let index = 1; index < match.players.length; index++) {
      const p = match.players[index];
      if (p.assistContact) {
        p.contactTimeToHit = Math.max(0, p.contactTimeToHit - dt);
        p.assistContact.time = p.contactTimeToHit;
        p.preparationTime += dt;
        if (aiReceiver !== index || p.team !== receivingTeam) {
          p.assistContact = null;
          p.contactTimeToHit = null;
          p.preparedStroke = null;
          p.preparationTime = 0;
        }
      }
      const chasing =
        p.team === receivingTeam && aiReceiver === index && aiReact <= 0;
      let target = chasing ? aiTargets[index] : null;
      if (!target) {
        const teammate = match.players[index ^ 2];
        const lane = teammate.x >= 0 ? -1 : 1;
        target = {
          x: lane * 2.35,
          z: side(index) * (p.team === receivingTeam ? 6.3 : 3.3),
        };
      }
      const dx = target.x - p.x,
        dz = target.z - p.z,
        distance = Math.hypot(dx, dz);
      movePlayer(
        p,
        distance > 0.18 ? dx / Math.max(1, distance) : 0,
        distance > 0.18 ? dz / Math.max(1, distance) : 0,
        match.difficulty === "competitive" ? 5.5 : 4.8,
        dt
      );
      // Only NPCs yield position, so a partner never pushes the controlled avatar.
      const teammate = match.players[index ^ 2],
        separation = Math.hypot(p.x - teammate.x, p.z - teammate.z);
      if (separation > 0 && separation < 0.75) {
        const push = Math.min(0.08, 0.75 - separation);
        p.x = clamp(
          p.x + ((p.x - teammate.x) / separation) * push,
          -4.62,
          4.62
        );
        p.z =
          side(index) *
          clamp(
            (p.z + ((p.z - teammate.z) / separation) * push) * side(index),
            0.7,
            9.6
          );
      }
      const reflexBlock =
        p.team === receivingTeam &&
        b.shotType === "smash" &&
        match.phaseTime >= 0.1 &&
        Math.hypot(b.x - p.x, b.z - p.z) <= 0.95;
      if (
        (!chasing && !reflexBlock) ||
        shotCooldown > 0 ||
        !canReach(match, index) ||
        b.y > 2.45 ||
        b.y < 0.42
      )
        continue;
      if (
        receivingTeam === 0 &&
        (match.players[0].swingPending || match.charge > 0) &&
        predictPreparationContact(match, 0)
      )
        continue;
      const defenders = match.players.filter((other) => other.team !== p.team);
      const centerX = (defenders[0].x + defenders[1].x) / 2;
      const defendersAtNet = defenders.some((other) => Math.abs(other.z) < 4.4);
      const defensiveBlock =
        reflexBlock || (b.shotType === "smash" && Math.hypot(b.vx, b.vz) > 22);
      const lob =
        !b.isServe && !defensiveBlock && defendersAtNet && random() < 0.3;
      const aimX = clamp(-centerX / 5 + (random() - 0.5) * 1.35, -0.86, 0.86);
      const aimZ = -0.1 - random() * 0.55;
      launch(
        index,
        { aimX, aimZ },
        {
          powered:
            !lob &&
            !defensiveBlock &&
            match.difficulty === "competitive" &&
            random() < 0.23,
          charge: 0.79,
          lob,
          contactQuality: defensiveBlock ? 0.72 : 1,
          contactKind: defensiveBlock ? "reach" : "normal",
        }
      );
      break;
    }
  }
  function integrateBall(dt) {
    const b = match.ball;
    if (!b.active) return;
    for (const event of advanceFlight(b, dt)) {
      if (event.type === "point") {
        awardPoint(event.winner, event.reason, {
          outOfCourt: Boolean(event.outOfCourt),
          smashWinner: Boolean(event.smashWinner),
        });
        return;
      }
      if (event.type === "serve-fault") {
        serveFault(event.reason);
        return;
      }
      if (event.type === "serve-let") {
        emit("serve-let", {
          playerIndex: match.server,
          attempt: match.serveAttempt,
        });
        beginRecovery("let", true);
        match.message = "Net let · replay the serve";
        return;
      }
      const { type, ...data } = event;
      emit(type, data);
    }
    if (
      b.active &&
      (Math.abs(b.x) > 18 ||
        Math.abs(b.z) > 25 ||
        b.y < -2 ||
        match.phaseTime > 30)
    ) {
      if (b.bounces > 0) awardPoint(teamIndex(b.lastHit), "Unreturned");
      else if (b.isServe) serveFault("Out");
      else awardPoint(1 - teamIndex(b.lastHit), "Out");
    }
  }
  function step(dt, input) {
    match.time += dt;
    match.phaseTime += dt;
    shotCooldown = Math.max(0, shotCooldown - dt);
    for (const p of match.players) {
      p.actionTime += dt;
      p.strokeProgress = p.padelStroke
        ? clamp(p.actionTime / p.actionDuration, 0, 1)
        : 0;
    }
    updateDeadBalls(dt);
    if (match.phase === "ready") return;
    if (match.phase === "point" || match.phase === "finished") {
      updateRecovery(dt);
      return;
    }
    if (!inputArmed) {
      if (!input.powerHeld && !input.powerReleased && !input.hit && !input.lob)
        inputArmed = true;
      input = {};
    }
    updateHuman(dt, input);
    updateAI(dt);
    integrateBall(dt);
  }
  function update(dt, input = {}) {
    heldInput = { ...input };
    // Preserve single-frame presses even when render frames are shorter than the physics step.
    if (input.hit) pending.hit = true;
    if (input.lob) pending.lob = true;
    if (input.powerReleased) pending.powerReleased = true;
    accumulator += clamp(finite(dt), 0, 0.1);
    while (accumulator + 1e-9 >= STEP) {
      step(STEP, {
        ...heldInput,
        hit: Boolean(pending.hit),
        lob: Boolean(pending.lob),
        powerReleased: Boolean(pending.powerReleased),
      });
      pending = {};
      accumulator -= STEP;
    }
    return match;
  }
  return reset();
}
