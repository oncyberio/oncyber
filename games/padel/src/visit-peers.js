import * as THREE from "three";

const finite = (value, fallback = 0) =>
  Number.isFinite(value) ? value : fallback;
const clamp = THREE.MathUtils.clamp;
const MAX_PEERS = 24;

export function normalizePadelPeer(raw) {
  const id = raw?.id || raw?.sessionId;
  if (
    typeof id !== "string" ||
    !id ||
    id.length > 160 ||
    ![raw.x, raw.y, raw.z, raw.rotation].every(Number.isFinite) ||
    Math.abs(raw.x) > 40 ||
    raw.y < -2 ||
    raw.y > 20 ||
    Math.abs(raw.z) > 50
  )
    return null;
  const vx = clamp(finite(raw.vx), -12, 12),
    vz = clamp(finite(raw.vz), -12, 12);
  const grounded =
    typeof raw.grounded === "boolean"
      ? raw.grounded
      : typeof raw.floor === "boolean"
      ? raw.floor
      : raw.y < 0.015;
  return {
    id,
    username: String(raw.username || raw.name || "Visitor").slice(0, 64),
    avatar: typeof raw.avatar === "string" ? raw.avatar : null,
    vrmUrl:
      typeof raw.vrmUrl === "string" &&
      /^(https?:\/\/|\/|\.\.?\/)/i.test(raw.vrmUrl)
        ? raw.vrmUrl
        : null,
    pose: {
      animationMode: "visit",
      x: raw.x,
      y: Math.max(0, raw.y),
      z: raw.z,
      yaw: Math.atan2(Math.sin(raw.rotation), Math.cos(raw.rotation)),
      vx,
      vz,
      speed: Math.min(12, Math.hypot(vx, vz)),
      grounded,
      verticalVelocity: clamp(
        finite(raw.verticalVelocity, finite(raw.vy)),
        -20,
        20
      ),
      jumpCount: clamp(Math.floor(finite(raw.jumpCount)), 0, 2),
      action: grounded ? (Math.hypot(vx, vz) > 0.08 ? "run" : "idle") : "jump",
      actionTime: 0,
      jumpWindup: 0.13,
      landingImpact: 0,
      emote: typeof raw.emote === "string" ? raw.emote.slice(0, 64) : null,
      emoteTime: Number.isFinite(raw.emoteTime)
        ? Math.max(0, raw.emoteTime)
        : null,
    },
  };
}

/** Roster rendering only: no local/fake players and no network side effects.
 * Pass the trusted parent's filtered remote roster. Avatar loading is injectable
 * so lifecycle and stale asynchronous arrivals can be tested without a browser.
 */
export function createPadelPeers({
  scene,
  renderer,
  camera,
  canvas,
  labels,
  fallbackUrl,
  createAvatar = async (options) =>
    (await import("./avatars.js")).createPadelAvatar(options),
  createLabel = () => document.createElement("div"),
} = {}) {
  const peers = new Map(),
    projected = new THREE.Vector3();
  let disposed = false,
    visible = false;
  function remove(peer) {
    peer.cancelled = true;
    peer.avatar?.root.removeFromParent();
    peer.avatar?.dispose();
    peer.label.remove();
  }
  function receive(players) {
    if (disposed || !Array.isArray(players)) return;
    const ids = new Set();
    for (const raw of players.slice(0, MAX_PEERS)) {
      const incoming = normalizePadelPeer(raw);
      if (!incoming || ids.has(incoming.id)) continue;
      const { id, pose } = incoming;
      ids.add(id);
      const url = incoming.vrmUrl || fallbackUrl;
      let peer = peers.get(id);
      if (peer && peer.url !== url) {
        remove(peer);
        peers.delete(id);
        peer = null;
      }
      if (!peer) {
        const label = createLabel();
        label.className = "visitor-label";
        label.hidden = true;
        labels.append(label);
        peer = {
          label,
          url,
          cancelled: false,
          avatar: null,
          pose: { ...pose },
          target: pose,
          elapsed: 0,
        };
        peers.set(id, peer);
        const entry = peer;
        void Promise.resolve()
          .then(() =>
            createAvatar({
              renderer,
              url,
              fallbackUrl,
              pfp: incoming.avatar,
              index: 2,
            })
          )
          .then((avatar) => {
            if (disposed || entry.cancelled) {
              avatar.dispose();
              return;
            }
            entry.avatar = avatar;
            entry.pose = { ...entry.target };
            avatar.root.visible = visible;
            scene.add(avatar.root);
            avatar.reset?.(entry.target);
            void Promise.resolve(avatar.preloadEmotes?.()).catch(() => {});
          })
          .catch(() => {
            if (!entry.cancelled) entry.label.hidden = true;
          });
      }
      peer.label.textContent = incoming.username;
      peer.target = pose;
      peer.elapsed = 0;
      if (Math.hypot(peer.pose.x - pose.x, peer.pose.z - pose.z) > 5) {
        peer.pose = { ...pose };
        peer.avatar?.reset?.(peer.pose);
      }
    }
    for (const [id, peer] of peers)
      if (!ids.has(id)) {
        remove(peer);
        peers.delete(id);
      }
  }
  function update(dt, show = true) {
    if (disposed) return;
    visible = Boolean(show);
    dt = clamp(finite(dt), 0, 0.05);
    for (const peer of peers.values()) {
      peer.label.hidden = !visible || !peer.avatar;
      if (!peer.avatar) continue;
      peer.avatar.root.visible = visible;
      if (!visible) continue;
      peer.elapsed += dt;
      const p = peer.pose,
        next = peer.target,
        amount = 1 - Math.exp(-18 * dt);
      for (const key of ["x", "y", "z"])
        p[key] += (next[key] - p[key]) * amount;
      p.yaw +=
        Math.atan2(Math.sin(next.yaw - p.yaw), Math.cos(next.yaw - p.yaw)) *
        amount;
      // Stop animating a stale velocity after the last pose. Late packets never
      // make someone run forever in place while their world position is fixed.
      const fresh = peer.elapsed < 0.5;
      const speed = fresh ? next.speed : 0;
      const action = next.grounded ? (speed > 0.08 ? "run" : "idle") : "jump";
      const emoteTime =
        next.emoteTime === null
          ? p.emote === next.emote
            ? finite(p.emoteTime) + dt
            : 0
          : next.emoteTime + peer.elapsed;
      Object.assign(p, {
        vx: fresh ? next.vx : 0,
        vz: fresh ? next.vz : 0,
        speed,
        grounded: next.grounded,
        verticalVelocity: next.verticalVelocity,
        jumpCount: next.jumpCount,
        actionTime: action === p.action ? p.actionTime + dt : 0,
        action,
        emote: next.emote,
        emoteTime,
      });
      peer.avatar.update(dt, p);
      projected
        .set(p.x, p.y + finite(peer.avatar.height, 1.78) + 0.25, p.z)
        .project(camera);
      peer.label.hidden =
        projected.z > 1 ||
        projected.z < -1 ||
        Math.abs(projected.x) > 1 ||
        Math.abs(projected.y) > 1;
      if (!peer.label.hidden)
        peer.label.style.transform = `translate(${
          (projected.x * 0.5 + 0.5) * canvas.clientWidth
        }px,${
          (-projected.y * 0.5 + 0.5) * canvas.clientHeight
        }px) translate(-50%,-50%)`;
    }
  }
  return {
    receive,
    update,
    get count() {
      return peers.size;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      peers.forEach(remove);
      peers.clear();
    },
  };
}
