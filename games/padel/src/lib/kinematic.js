/* Kinematic ground locomotion — walk/run/jump over a heightfield.
 *
 * Ported from Jungle Trail's hand-tuned walker (weighted accel/brake, per-axis
 * slope-slide, a four-state jump machine, corridor bound) with two corrections
 * baked in:
 *
 *  - It tracks the player's FEET (pos.y == ground), not the eye. The camera is
 *    placed a fixed eye-height above; the avatar stands exactly on pos. This is
 *    what fixes "feet under the ground" — there is no eye offset to get wrong.
 *  - The movement basis matches the camera. Forward is the camera's own forward
 *    (-sinθ,0,-cosθ); the old code rotated input by +yaw and mirrored the X
 *    axis, which sent W sideways or backwards as you turned. W is now forward at
 *    every yaw.
 *
 * Ground, collision and out-of-bounds are asked of injected providers, so the
 * same solver runs on any world. */
import * as THREE from 'three';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
const response = (rate, dt) => 1 - Math.exp(-rate * dt);

export class KinematicLocomotion {
  constructor(tuning) {
    this.t = tuning;
    this.pos = new THREE.Vector3(); // FEET (pos.y == ground level)
    this.vel = new THREE.Vector3();
    this.speed = 0;
    this.runBlend = 0;
    this.grounded = true;

    this._paceBlend = 0;
    this.jumpState = 'grounded'; // grounded | takeoff | airborne | land
    this.jumpTime = 0;
    this.jumpCrouch = 0;
    this.verticalVelocity = 0;
    this.jumpHeight = 0;
    this.landImpact = 0;
    this.jumpCount = 0; // 0 on the ground, 1 after a jump, 2 after the air jump

    this.height = tuning.eyeHeight + tuning.headroom;
    this.radius = tuning.radius;
    this._normal = new THREE.Vector3(0, 1, 0);

    this.ground = null;
    this.collide = null;
    this.constrain = null;
  }

  setProviders({ ground, collide, constrain, velocity }) {
    this.ground = ground;
    this.collide = collide;
    this.constrain = constrain;
    this.velocity = velocity;
  }

  place(x, z) {
    const y = this.ground ? this.ground.heightAt(x, z) : 0;
    this.pos.set(x, y, z);
    this.vel.set(0, 0, 0);
    this.speed = 0; this._paceBlend = 0; this.runBlend = 0;
    this.grounded = true; this.jumpState = 'grounded';
    this.verticalVelocity = 0; this.jumpCrouch = 0; this.jumpHeight = 0;
    this.jumpCount = 0;
  }

  requestJump() {
    if (this.jumpState === 'grounded') { this.jumpState = 'takeoff'; this.jumpTime = 0; }
    else if (this.jumpState === 'airborne' && this.jumpCount === 1) {
      // Double jump: a fresh impulse mid-flight (the avatar layer plays its
      // trick animation off the jumpCount 1→2 edge).
      this.verticalVelocity = this.t.jumpSpeed;
      this.jumpCount = 2;
    }
  }

  update(dt, yaw, intent) {
    if (intent.jump) this.requestJump();
    this._horizontal(dt, yaw, intent);
    this._vertical(dt);
    this.runBlend = smoothstep(this.t.walkSpeed, this.t.sprintSpeed, this.speed);
  }

  _horizontal(dt, yaw, intent) {
    const t = this.t;
    const { fx, fz, mag } = intent;
    this._paceBlend += ((intent.sprint ? 1 : 0) - this._paceBlend) * response(3.8, dt);
    const pace = lerp(t.walkSpeed, t.sprintSpeed, this._paceBlend);

    // Camera-agreeing basis: forward (-sin,0,-cos), right (cos,0,-sin).
    const cos = Math.cos(yaw), sin = Math.sin(yaw);
    const wx = fx * cos + fz * sin;
    const wz = -fx * sin + fz * cos;

    // Worlds may supply their canonical velocity law while retaining collisions/grounding.
    if (this.velocity) {
      this.velocity(this.vel, wx, wz, intent.sprint, dt);
      const travelled = this._move(this.vel.x * dt, this.vel.z * dt);
      this.speed = dt > 0 ? travelled / dt : Math.hypot(this.vel.x, this.vel.z);
      return;
    }

    const directionScale = fz < 0 ? 1 : fz > 0 ? t.backwardScale : mag > 0 ? t.strafeScale : 0;

    let slopeFactor = 1;
    if (this.grounded && mag > 0 && this.ground) {
      const n = this.ground.normalAt(this.pos.x, this.pos.z, this._normal);
      const grade = -(n.x * wx + n.z * wz) / Math.max(0.1, n.y);
      const uphill = Math.min(t.slopeUphillCap, Math.max(0, grade - t.slopeUphillDead) * t.slopeUphillK);
      const downhill = Math.min(t.slopeDownhillCap, Math.max(0, -grade - t.slopeDownhillDead) * t.slopeDownhillK);
      slopeFactor = 1 - uphill - downhill;
    }

    const target = pace * directionScale * slopeFactor;
    if (this.grounded) {
      const k = response(mag > 0 ? t.groundAccel : t.groundBrake, dt);
      this.vel.x += ((mag > 0 ? wx * target : 0) - this.vel.x) * k;
      this.vel.z += ((mag > 0 ? wz * target : 0) - this.vel.z) * k;
    } else if (mag > 0) {
      const k = response(t.airSteer, dt);
      this.vel.x += (wx * target - this.vel.x) * k;
      this.vel.z += (wz * target - this.vel.z) * k;
    } else {
      const drag = Math.exp(-t.airDrag * dt);
      this.vel.x *= drag; this.vel.z *= drag;
    }

    const travelled = this._move(this.vel.x * dt, this.vel.z * dt);
    this.speed = dt > 0 ? travelled / dt : Math.hypot(this.vel.x, this.vel.z);
  }

  // Per-axis slope-slide, then the world's collider, then the world's bound.
  _move(dx, dz) {
    const g = this.ground, t = this.t;
    const x0 = this.pos.x, z0 = this.pos.z;
    const climbable = (x, z) => {
      if (!g) return true;
      const e = 0.45;
      const nx = g.heightAt(x - e, z) - g.heightAt(x + e, z);
      const ny = 2 * e;
      const nz = g.heightAt(x, z - e) - g.heightAt(x, z + e);
      return (ny / Math.hypot(nx, ny, nz)) > t.maxSlopeCos;
    };
    let mx = 0, mz = 0;
    if (!this.grounded) { mx = dx; mz = dz; }
    else {
      if (climbable(this.pos.x + dx, this.pos.z)) mx = dx;
      else if (Math.abs(dx) > 1e-8) this.vel.x = 0;
      if (climbable(this.pos.x + mx, this.pos.z + dz)) mz = dz;
      else if (Math.abs(dz) > 1e-8) this.vel.z = 0;
    }

    if (this.collide) {
      const feetY = this.pos.y;
      const hit = this.collide.move(this.pos.x, this.pos.z, mx, mz, feetY, feetY + this.height, this.radius, this.vel);
      this.pos.x = hit.x; this.pos.z = hit.z;
    } else {
      this.pos.x += mx; this.pos.z += mz;
    }

    if (this.constrain) this.constrain(this.pos, this.vel);
    return Math.hypot(this.pos.x - x0, this.pos.z - z0);
  }

  // Four-state jump: ground-snap, crouch on takeoff, ballistic, land crouch.
  _vertical(dt) {
    const t = this.t;
    const groundY = this.ground ? this.ground.heightAt(this.pos.x, this.pos.z) : 0;
    if (this.jumpState === 'takeoff') {
      this.grounded = true;
      this.pos.y += (groundY - this.pos.y) * Math.min(1, dt * t.groundSnapRate);
      this.jumpTime += dt;
      const u = clamp(this.jumpTime / t.takeoffTime, 0, 1);
      this.jumpCrouch = u < 0.58 ? smoothstep(0, 0.58, u) : 1 - smoothstep(0.58, 1, u);
      if (u >= 1) {
        this.jumpState = 'airborne'; this.grounded = false;
        this.verticalVelocity = t.jumpSpeed; this.jumpCrouch = 0;
        this.jumpCount = 1;
      }
    } else if (this.jumpState === 'airborne') {
      this.grounded = false;
      this.verticalVelocity -= t.gravity * dt;
      this.pos.y += this.verticalVelocity * dt;
      if (this.verticalVelocity < 0 && this.pos.y <= groundY) {
        this.landImpact = -this.verticalVelocity;
        this.pos.y = groundY; this.verticalVelocity = 0; this.grounded = true;
        this.jumpState = 'land'; this.jumpTime = 0; this.jumpCount = 0;
      }
    } else if (this.jumpState === 'land') {
      this.grounded = true;
      this.pos.y += (groundY - this.pos.y) * Math.min(1, dt * (t.groundSnapRate + 2));
      this.jumpTime += dt;
      const u = clamp(this.jumpTime / t.landTime, 0, 1);
      const land = u < 0.28 ? smoothstep(0, 0.28, u) : 1 - smoothstep(0.28, 1, u);
      this.jumpCrouch = land * 0.82;
      if (u >= 1) { this.jumpState = 'grounded'; this.jumpCrouch = 0; }
    } else {
      this.grounded = true; this.jumpCrouch = 0;
      this.pos.y += (groundY - this.pos.y) * Math.min(1, dt * t.groundSnapRate);
    }
    this.jumpHeight = Math.max(0, this.pos.y - groundY);
  }
}
