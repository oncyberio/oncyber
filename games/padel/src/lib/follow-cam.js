/* Third-person follow camera — a damped orbit behind the character.
 *
 * The character's yaw is shared with the camera (turning the view turns the
 * body, so W still goes where you look); the mouse's vertical drag tilts the
 * orbit and the wheel zooms. Collision keeps the camera out of the floor: the
 * boom is clamped above the ground under the camera. This is the pragmatic
 * subset of oncyber's third-person wrapper — a full frustum-corner raycast
 * against wall meshes can layer on later via a collider provider, but the
 * ground clamp is what prevents the camera burrowing on slopes.
 *
 * Positioning is spherical: forward is (-sinθ,0,-cosθ), so the camera sits at
 * pivot + behind·distance where behind is (sinθ,0,cosθ), lifted by the orbit
 * pitch. */
export class FollowCam {
  constructor(tuning) {
    this.t = tuning.tp;
    this.pitch = 0.32; // resting orbit elevation (looking slightly down)
    this.currentDist = this.t.distance;
    this._started = false;
    this._baseFov = null;
  }

  /** Vertical drag tilts the orbit (yaw is the shared character yaw). */
  orbit(_dx, dy, sensitivity) {
    this.pitch -= dy * (sensitivity ?? this.t.sensitivity);
    this.pitch = Math.max(this.t.pitchMin, Math.min(this.t.pitchMax, this.pitch));
  }

  /** Wheel zoom. */
  zoom(dz) {
    this.currentDist = Math.max(this.t.minDistance, Math.min(this.t.distance, this.currentDist + dz * 0.01));
  }

  update(camera, { pivotX, pivotY, pivotZ, yaw, ground, dt }) {
    if (this._baseFov == null) this._baseFov = camera.fov;
    const t = this.t;
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const px = pivotX, py = pivotY + t.height, pz = pivotZ;
    const dist = this.currentDist;

    let cx = px + Math.sin(yaw) * dist * cp;
    let cy = py + dist * sp;
    let cz = pz + Math.cos(yaw) * dist * cp;

    if (t.collision && ground) {
      const gy = ground.heightAt(cx, cz) + 0.4;
      if (cy < gy) cy = gy; // never let the camera drop below the ground
    }

    if (!this._started) { camera.position.set(cx, cy, cz); this._started = true; }
    else {
      const a = 1 - Math.exp(-t.damp * dt);
      camera.position.x += (cx - camera.position.x) * a;
      camera.position.y += (cy - camera.position.y) * a;
      camera.position.z += (cz - camera.position.z) * a;
    }

    camera.up.set(0, 1, 0);
    camera.lookAt(px, py, pz);

    if (Math.abs(camera.fov - this._baseFov) > 1e-3) { camera.fov = this._baseFov; camera.updateProjectionMatrix(); }
  }

  /** Re-snap on the next frame (call when entering third person). */
  reset() { this._started = false; }
}
