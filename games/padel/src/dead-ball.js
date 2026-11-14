/** Non-scoring ball motion after a rally. Uses the real court enclosure while
 * inside it, and the surrounding ground after an over-the-wall winner. */
export function advanceDeadBall(ball, dt, { court, gravity, radius }) {
  const events = [];
  if (ball.resting) return events;
  ball.y = Math.max(radius, ball.y);
  if (ball.y <= radius + 0.00001 && Math.abs(ball.vy) < 0.4) {
    ball.rolling = true;
    ball.vy = 0;
  }
  if (ball.rolling) {
    const friction = Math.exp(-2.1 * dt);
    ball.vx *= friction;
    ball.vz *= friction;
  }
  let remaining = dt;
  for (let iteration = 0; remaining > 1e-8 && iteration < 8; iteration++) {
    let time = remaining,
      collision = null;
    const consider = (candidate, type, boundary = 0) => {
      if (candidate >= -1e-8 && candidate <= time) {
        time = Math.max(0, candidate);
        collision = { type, boundary };
      }
    };
    const heightAt = (time) =>
      ball.rolling
        ? radius
        : ball.y + ball.vy * time - (gravity * time * time) / 2;
    if (!ball.rolling) {
      const disc = ball.vy ** 2 + 2 * gravity * (ball.y - radius);
      if (disc >= 0) consider((ball.vy + Math.sqrt(disc)) / gravity, "floor");
    }
    for (const direction of [-1, 1]) {
      if (Math.abs(ball.vx) > 1e-7) {
        const x = direction * (court.halfWidth - radius),
          hit = (x - ball.x) / ball.vx;
        if (
          hit >= -1e-8 &&
          (hit > 1e-7 || ball.vx * direction > 0) &&
          hit <= time &&
          Math.abs(ball.z + ball.vz * hit) <= court.halfLength &&
          heightAt(hit) <= court.sideWallHeight + radius
        )
          consider(hit, "side", x);
      }
      if (Math.abs(ball.vz) > 1e-7) {
        const z = direction * (court.halfLength - radius),
          hit = (z - ball.z) / ball.vz;
        if (
          hit >= -1e-8 &&
          (hit > 1e-7 || ball.vz * direction > 0) &&
          hit <= time &&
          Math.abs(ball.x + ball.vx * hit) <= court.halfWidth &&
          heightAt(hit) <= court.backFenceHeight + radius
        )
          consider(hit, "back", z);
      }
    }
    if (Math.abs(ball.vz) > 1e-7) {
      const hit = -ball.z / ball.vz,
        x = ball.x + ball.vx * hit;
      const netHeight =
        court.netHeight +
        Math.min(1, Math.abs(x) / court.halfWidth) ** 2 *
          (court.netEdgeHeight - court.netHeight);
      if (
        hit >= -1e-8 &&
        hit <= time &&
        Math.abs(x) <= court.halfWidth &&
        heightAt(hit) <= netHeight + radius
      )
        consider(hit, "net");
    }
    ball.x += ball.vx * time;
    ball.z += ball.vz * time;
    if (!ball.rolling) {
      ball.y += ball.vy * time - (gravity * time * time) / 2;
      ball.vy -= gravity * time;
    }
    remaining -= time;
    if (!collision) break;
    const position = { x: ball.x, y: ball.y, z: ball.z };
    if (collision.type === "floor") {
      const impactSpeed = Math.abs(ball.vy);
      ball.y = radius;
      ball.vy = impactSpeed * 0.58;
      ball.vx *= 0.84;
      ball.vz *= 0.84;
      ball.deadBounces = (ball.deadBounces || 0) + 1;
      if (impactSpeed > 0.65)
        events.push({
          type: "bounce",
          dead: true,
          impactSpeed,
          position: { ...position, y: radius },
          count: ball.deadBounces,
        });
      if (ball.vy < 0.45) {
        ball.vy = 0;
        ball.rolling = true;
      }
    } else if (collision.type === "net") {
      const impactSpeed = Math.abs(ball.vz);
      ball.z = -Math.sign(ball.vz) * 0.001;
      ball.vz *= -0.16;
      ball.vy = Math.min(0.2, ball.vy);
      if (impactSpeed > 0.65)
        events.push({ type: "net", dead: true, impactSpeed, position });
    } else {
      const surface =
        collision.type === "back"
          ? ball.y <= court.backGlassHeight + radius
            ? "glass"
            : "fence"
          : Math.abs(ball.z) >= court.sideGlassStartsAt &&
            ball.y <= court.backGlassHeight + radius
          ? "glass"
          : "fence";
      const axis = collision.type === "back" ? "z" : "x",
        velocity = collision.type === "back" ? "vz" : "vx";
      const impactSpeed = Math.abs(ball[velocity]);
      ball[axis] = collision.boundary - Math.sign(ball[velocity]) * 0.001;
      ball[velocity] *= surface === "glass" ? -0.65 : -0.45;
      if (impactSpeed > 0.65)
        events.push({
          type: "wall",
          dead: true,
          impactSpeed,
          position,
          side: collision.type,
          surface,
        });
    }
  }
  if (ball.rolling && Math.hypot(ball.vx, ball.vz) < 0.045) {
    ball.vx = ball.vz = ball.vy = 0;
    ball.resting = true;
    ball.active = false;
  }
  return events;
}
