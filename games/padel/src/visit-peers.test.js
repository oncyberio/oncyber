import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { createPadelPeers, normalizePadelPeer } from "./visit-peers.js";
const flush = () => new Promise((resolve) => setImmediate(resolve));
const raw = (id = "visitor", values = {}) => ({
  id,
  username: "Visitor",
  x: 0,
  y: 0,
  z: 0,
  rotation: 0,
  vx: 0,
  vz: 0,
  grounded: true,
  vrmUrl: "/avatars/visitor.vrm",
  ...values,
});
function fakeAvatar() {
  return {
    root: new THREE.Group(),
    height: 1.78,
    resets: [],
    updates: [],
    disposed: 0,
    preloaded: 0,
    reset(pose) {
      this.resets.push({ ...pose });
    },
    update(dt, pose) {
      this.updates.push({ dt, pose: { ...pose } });
    },
    preloadEmotes() {
      this.preloaded++;
      return Promise.resolve(true);
    },
    dispose() {
      this.disposed++;
    },
  };
}
function setup(factory) {
  const scene = new THREE.Scene(),
    camera = new THREE.PerspectiveCamera(58, 1000 / 700, 0.1, 240);
  camera.position.set(0, 8, 20);
  camera.lookAt(0, 1, 0);
  camera.updateMatrixWorld();
  const created = [],
    labelList = [];
  const peers = createPadelPeers({
    scene,
    camera,
    canvas: { clientWidth: 1000, clientHeight: 700 },
    fallbackUrl: "/avatars/fallback.vrm",
    labels: {
      append(label) {
        labelList.push(label);
      },
    },
    createLabel() {
      return {
        style: {},
        hidden: false,
        textContent: "",
        removed: false,
        remove() {
          this.removed = true;
        },
      };
    },
    createAvatar:
      factory ??
      ((options) => {
        const avatar = fakeAvatar();
        created.push({ avatar, options });
        return Promise.resolve(avatar);
      }),
  });
  return { peers, scene, camera, created, labels: labelList };
}

test("peer normalization accepts the lobby pose and all native emote names without executable labels", () => {
  const peer = normalizePadelPeer(
    raw("id", {
      username: "<script>ignored as markup</script>",
      rotation: Math.PI * 3,
      vx: 20,
      vz: -20,
      emote: "MOONWALK",
      emoteTime: 2.2,
      jumpCount: 7,
      y: 0.8,
      grounded: false,
    })
  );
  assert.equal(peer.username, "<script>ignored as markup</script>");
  assert.equal(peer.pose.animationMode, "visit");
  assert.equal(peer.pose.emote, "MOONWALK");
  assert.equal(peer.pose.emoteTime, 2.2);
  assert.equal(peer.pose.jumpCount, 2);
  assert.equal(peer.pose.action, "jump");
  assert.equal(peer.pose.vx, 12);
  assert.equal(peer.pose.vz, -12);
  assert.ok(Math.abs(peer.pose.yaw - Math.PI) < 1e-8);
  for (const invalid of [
    null,
    {},
    raw("", {}),
    raw("id", { x: NaN }),
    raw("id", { x: 100 }),
    raw("id", { rotation: Infinity }),
  ])
    assert.equal(normalizePadelPeer(invalid), null);
  assert.equal(
    normalizePadelPeer(raw("id", { vrmUrl: "javascript:alert(1)" })).vrmUrl,
    null
  );
});

test("peers render only received real players with their avatar identity and native visit pose", async () => {
  const { peers, created, labels, scene } = setup();
  assert.equal(peers.count, 0);
  peers.receive([
    raw("a", {
      username: "A <b>name</b>",
      avatar: "/portrait.jpg",
      emote: "SHUFFLING",
    }),
    raw("b", { x: 2 }),
  ]);
  await flush();
  assert.equal(peers.count, 2);
  assert.equal(scene.children.length, 2);
  assert.equal(created[0].options.url, "/avatars/visitor.vrm");
  assert.equal(created[0].options.pfp, "/portrait.jpg");
  assert.equal(labels[0].textContent, "A <b>name</b>");
  assert.equal(labels[0].className, "visitor-label");
  assert.equal(created[0].avatar.resets[0].animationMode, "visit");
  assert.equal(created[0].avatar.preloaded, 1);
  peers.update(1 / 60, true);
  assert.equal(labels[0].hidden, false);
  assert.equal(created[0].avatar.root.visible, true);
  assert.equal(created[0].avatar.updates.at(-1).pose.emote, "SHUFFLING");
  peers.update(0, false);
  assert.equal(labels[0].hidden, true);
  assert.equal(created[0].avatar.root.visible, false);
  peers.dispose();
});

test("remote poses interpolate with wrapped heading and snap only on large relocations", async () => {
  const { peers, created } = setup();
  peers.receive([raw("a", { rotation: Math.PI - 0.05 })]);
  await flush();
  peers.receive([raw("a", { x: 1, rotation: -Math.PI + 0.05, vx: 2.8 })]);
  peers.update(1 / 60, true);
  const pose = created[0].avatar.updates.at(-1).pose;
  assert.ok(pose.x > 0 && pose.x < 1);
  assert.ok(
    Math.abs(pose.yaw - Math.PI) < 0.05,
    "heading crosses the short arc at ±pi"
  );
  assert.equal(pose.action, "run");
  peers.receive([raw("a", { x: 9 })]);
  peers.update(0, true);
  assert.equal(created[0].avatar.updates.at(-1).pose.x, 9);
  assert.equal(created[0].avatar.resets.length, 2);
  peers.dispose();
});

test("stale peer velocity stops the running animation while emote time advances smoothly", async () => {
  const { peers, created } = setup();
  peers.receive([raw("a", { vx: 2.8, emote: "MOONWALK", emoteTime: 3 })]);
  await flush();
  for (let i = 0; i < 40; i++) peers.update(1 / 60, true);
  const pose = created[0].avatar.updates.at(-1).pose;
  assert.equal(pose.vx, 0);
  assert.equal(pose.speed, 0);
  assert.equal(pose.action, "idle");
  assert.ok(pose.emoteTime > 3.6 && pose.emoteTime < 3.7);
  peers.dispose();
});

test("roster removal and avatar changes dispose the replaced actors and labels", async () => {
  const { peers, created, labels, scene } = setup();
  peers.receive([raw("a"), raw("b")]);
  await flush();
  peers.receive([raw("a", { vrmUrl: "/avatars/new.vrm" })]);
  await flush();
  assert.equal(peers.count, 1);
  assert.equal(scene.children.length, 1);
  assert.equal(created[0].avatar.disposed, 1);
  assert.equal(created[1].avatar.disposed, 1);
  assert.equal(labels[0].removed, true);
  assert.equal(labels[1].removed, true);
  assert.equal(created[2].options.url, "/avatars/new.vrm");
  peers.dispose();
  peers.dispose();
  assert.equal(created[2].avatar.disposed, 1);
  assert.equal(scene.children.length, 0);
});

test("avatars that finish loading after a visitor leaves or view disposes are never attached", async () => {
  const pending = [];
  const { peers, scene } = setup(
    () => new Promise((resolve) => pending.push(resolve))
  );
  peers.receive([raw("a")]);
  await flush();
  peers.receive([]);
  const leftAvatar = fakeAvatar();
  pending[0](leftAvatar);
  await flush();
  assert.equal(leftAvatar.disposed, 1);
  assert.equal(scene.children.length, 0);
  peers.receive([raw("b")]);
  await flush();
  peers.dispose();
  const lateAvatar = fakeAvatar();
  pending[1](lateAvatar);
  await flush();
  assert.equal(lateAvatar.disposed, 1);
  assert.equal(scene.children.length, 0);
});

test("duplicate or malformed roster entries cannot create extra peers, and labels clip offscreen", async () => {
  const { peers, created, labels } = setup();
  peers.receive([
    raw("a"),
    raw("a"),
    raw("bad", { y: NaN }),
    raw("behind", { z: 40 }),
  ]);
  await flush();
  assert.equal(peers.count, 2);
  assert.equal(created.length, 2);
  peers.update(1 / 60, true);
  assert.equal(labels[0].hidden, false);
  assert.equal(labels[1].hidden, true);
  peers.receive(null);
  assert.equal(peers.count, 2);
  peers.dispose();
});

test("peer counts are bounded and failed avatar loads remain safe and removable", async () => {
  const bounded = setup();
  bounded.peers.receive(Array.from({ length: 40 }, (_, i) => raw(String(i))));
  await flush();
  assert.equal(bounded.peers.count, 24);
  bounded.peers.dispose();
  const failed = setup(() => Promise.reject(new Error("missing avatar")));
  failed.peers.receive([raw("failed")]);
  await flush();
  failed.peers.update(1 / 60, true);
  assert.equal(failed.labels[0].hidden, true);
  assert.equal(failed.scene.children.length, 0);
  failed.peers.receive([]);
  assert.equal(failed.labels[0].removed, true);
  failed.peers.dispose();
});
