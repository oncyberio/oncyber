import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import * as THREE from "three";
import {
    createAvatarKit,
    createAvatar,
    createNameTag,
    loadVRM,
} from "../src/index.ts";

const file = (path) => new URL(path, import.meta.url);
const bytes = () => {
    const b = readFileSync(file("./fixtures/square.vrm"));
    return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
};
const locomotion = JSON.parse(
    readFileSync(file("../motion/locomotion.json"), "utf8")
);
const emotes = JSON.parse(readFileSync(file("../motion/emotes.json"), "utf8"));

// A canvas good enough for sprites in Node.
const canvas = (width, height) => ({
    width,
    height,
    getContext: () =>
        new Proxy(
            { measureText: (s) => ({ width: s.length * 28 }) },
            { get: (t, k) => t[k] ?? (() => {}), set: () => true }
        ),
});
const footY = (avatar) =>
    avatar.vrm.humanoid
        .getRawBoneNode("leftFoot")
        .getWorldPosition(new THREE.Vector3()).y;
const hipsY = (avatar) =>
    avatar.vrm.humanoid
        .getRawBoneNode("hips")
        .getWorldPosition(new THREE.Vector3()).y;
const settle = (avatar, crouch = 0, frames = 40) => {
    for (let i = 0; i < frames; i++) avatar.drive(1 / 30, crouch);
    avatar.root.updateMatrixWorld(true);
};

test("the kit's motion files are the lobby's", () => {
    execFileSync(process.execPath, [
        file("../scripts/sync-motion.mjs").pathname,
        "--check",
    ]);
});

test("an Oncyber avatar loads, is scaled to the game's height and plays lobby clips", async () => {
    const avatar = createAvatar({ height: 1.75 });
    assert.equal(avatar.kind, "stand-in");
    avatar.addClips(locomotion); // before the avatar arrives
    avatar.attach(await loadVRM(bytes()));
    assert.equal(avatar.kind, "vrm");
    avatar.root.updateMatrixWorld(true);
    const size = new THREE.Box3().setFromObject(avatar.holder);
    assert.ok(
        Math.abs(size.max.y - size.min.y - 1.75) < 0.02 &&
            Math.abs(size.min.y) < 0.02
    );
    for (const name of ["IDLE", "WALK", "RUN", "JUMP", "WAVING"])
        assert.ok(avatar.hasClip(name), name);
    const arm = avatar.vrm.humanoid.getNormalizedBoneNode("leftUpperArm");
    settle(avatar);
    assert.equal(avatar.playing, "IDLE");
    assert.ok(
        arm.quaternion.angleTo(new THREE.Quaternion()) > 0.5,
        "idle lowers the arms from the T-pose"
    );
    const idleHips = hipsY(avatar);
    assert.ok(
        idleHips > 0.6 && idleHips < 1.2,
        `hips stay at hip height (${idleHips})`
    );
    avatar.motion = { speed: 4.5 };
    settle(avatar);
    assert.equal(avatar.playing, "RUN");
    avatar.motion = { emote: "HIPHOP" };
    settle(avatar);
    assert.equal(
        avatar.playing,
        "IDLE",
        "an emote that isn't loaded leaves the avatar standing"
    );
    avatar.addClips(emotes);
    settle(avatar);
    assert.equal(avatar.playing, "HIPHOP");
    avatar.rest();
    assert.ok(arm.quaternion.angleTo(new THREE.Quaternion()) < 1e-6);
    avatar.manual = true;
    avatar.drive(1 / 30);
    assert.ok(
        arm.quaternion.angleTo(new THREE.Quaternion()) < 1e-6,
        "a game posing the rig itself is left alone"
    );
    avatar.dispose();
});

test("the crouch lowers the hips and keeps the feet on the floor", async () => {
    const avatar = createAvatar({ height: 1.75 });
    avatar.attach(await loadVRM(bytes()));
    avatar.addClips(locomotion);
    settle(avatar);
    const standing = { hips: hipsY(avatar), foot: footY(avatar) };
    settle(avatar, 1);
    assert.ok(standing.hips - hipsY(avatar) > 0.25, "hips come down");
    assert.ok(
        Math.abs(footY(avatar) - standing.foot) < 0.04,
        `feet stay put (${footY(avatar)} vs ${standing.foot})`
    );
    settle(avatar, 0);
    assert.ok(
        Math.abs(hipsY(avatar) - standing.hips) < 0.03,
        "and stands back up"
    );
});

test("name tag: shows the name, and the talking indicator only while talking", () => {
    const tag = createNameTag("Ada", { canvas });
    const [label, icon] = tag.object.children;
    assert.equal(tag.name, "Ada");
    assert.ok(label.scale.x > label.scale.y);
    assert.equal(icon.visible, false);
    tag.setTalking(true);
    assert.equal(icon.visible, true);
    const before = icon.scale.x;
    tag.update(0.1);
    assert.notEqual(icon.scale.x, before, "it pulses");
    tag.setTalking(false);
    assert.equal(icon.visible, false);
    tag.setName("A much longer name than before");
    assert.equal(tag.name, "A much longer name than ");
    tag.dispose();
});

function kitFor(overrides = {}) {
    let clock = 10;
    const asked = [];
    const kit = createAvatarKit({
        services: {
            identity: { avatar: "/me.vrm" },
            avatar: async (ref) => {
                asked.push(ref);
                if (ref.includes("broken")) throw new Error("AVATAR_HTTP_404");
                return bytes();
            },
        },
        motion: async () => locomotion,
        emotes: async () => emotes,
        canvas,
        now: () => clock,
        onError() {},
        ...overrides,
    });
    const scene = new THREE.Scene();
    scene.add(kit.self.root, kit.group);
    const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 100);
    camera.position.set(0, 2.3, 4.8);
    camera.lookAt(0, 1.25, 0);
    // Stand-in for a renderer: three calls onBeforeRender on each mesh it draws.
    const render = () =>
        scene.traverseVisible((o) => o.isMesh && o.onBeforeRender());
    const frame = (seconds = 1 / 30) => {
        clock += seconds;
        kit.update(seconds, camera);
        scene.updateMatrixWorld(true);
        render();
    };
    return { kit, scene, camera, frame, asked, tick: (s) => (clock += s) };
}
const idle = () => new Promise((r) => setTimeout(r, 30));

test("kit: the visitor and another player are drawn as their avatars", async () => {
    const { kit, frame, asked } = kitFor();
    assert.equal(await kit.loadSelf(), true);
    kit.setPeers([
        {
            id: "p2",
            name: "Player 2",
            vrm: "/p2.vrm",
            x: 1.5,
            y: 0,
            z: 0,
            h: 0,
            a: 0,
            talking: true,
        },
        {
            id: "p3",
            name: "Player 3",
            vrm: "/broken.vrm",
            x: -1.5,
            y: 0,
            z: 0,
            h: 0,
            a: 1,
        },
        { id: "", name: "nobody" },
    ]);
    assert.equal(kit.others.size, 2);
    await idle();
    for (let i = 0; i < 20; i++) frame();
    const facts = kit.inspect();
    assert.deepEqual(asked.sort(), ["/broken.vrm", "/me.vrm", "/p2.vrm"]);
    assert.equal(facts.avatarSelf, "vrm");
    assert.equal(facts.avatarSelfInFrame, true);
    assert.equal(facts.avatarOthers, 2);
    assert.equal(
        facts.avatarOthersDrawn,
        2,
        "a player whose avatar fails still appears, as a stand-in"
    );
    assert.equal(facts.avatarOthersVrm, 1);
    assert.equal(facts.avatarTalking, 1);
    const p2 = kit.others.get("p2");
    assert.equal(p2.tag.name, "Player 2");
    assert.ok(Math.abs(p2.avatar.root.position.x - 1.5) < 1e-6);
    assert.equal(kit.others.get("p3").avatar.playing, "WALK");
    // Someone leaves.
    kit.setPeers([
        {
            id: "p2",
            name: "Player 2",
            vrm: "/p2.vrm",
            x: 1.5,
            y: 0,
            z: 0,
            h: 0,
            a: 8 + 6,
        },
    ]);
    for (let i = 0; i < 12; i++) frame();
    await idle(); // the emote clips load the first time someone plays one
    for (let i = 0; i < 30; i++) frame();
    assert.equal(kit.inspect().avatarOthers, 1);
    assert.equal(p2.avatar.playing, "HIPHOP", "another player's emote plays");
    kit.dispose();
    assert.equal(kit.group.parent, null);
});

test("kit: arrival frame, then standing after entered; emotes ride the pose", async () => {
    const { kit, frame, camera } = kitFor();
    await kit.loadSelf();
    kit.arrival.stage({
        cameraOffset: { x: 0, y: 2, z: -4 },
        cameraTargetOffset: { x: 0, y: 1.2, z: 0 },
        avatarRotation: 0,
        avatarHeight: 1.8,
        fov: 55,
    });
    for (let i = 0; i < 5; i++) frame();
    let facts = kit.inspect();
    assert.equal(facts.avatarArrival, "crouched");
    assert.equal(facts.avatarFacingCamera, true);
    assert.equal(facts.avatarHandsEmpty, true);
    assert.equal(facts.avatarSelfInFrame, true);
    kit.self.root.rotation.y = Math.PI;
    assert.equal(
        kit.inspect().avatarFacingCamera,
        false,
        "back to the camera is not the arrival pose"
    );
    kit.self.root.rotation.y = 0;
    camera.position.set(0, 2, -30);
    camera.lookAt(0, 2, -60);
    frame();
    assert.equal(
        kit.inspect().avatarSelfInFrame,
        false,
        "behind the camera is not in the frame"
    );
    kit.arrival.enter();
    for (let i = 0; i < 30; i++) frame();
    facts = kit.inspect();
    assert.equal(facts.avatarArrival, "standing");
    kit.emote("MOONWALK");
    await idle();
    for (let i = 0; i < 30; i++) frame();
    assert.equal(kit.self.playing, "MOONWALK");
    assert.equal(kit.inspect().avatarEmote, "MOONWALK");
    assert.deepEqual(kit.pose({ x: 1, y: 0, z: 2 }, 0.5), {
        x: 1,
        y: 0,
        z: 2,
        h: 0.5,
        a: 15,
    });
    kit.emote("");
    assert.equal(kit.pose({ x: 0, y: 0, z: 0 }, 0).a, 0);
    kit.dispose();
});

test("kit: no avatar service or no avatar leaves a stand-in, not a crash", async () => {
    const { kit, frame } = kitFor({ services: { identity: {} } });
    assert.equal(await kit.loadSelf(), false);
    kit.setPeers([{ id: "p2", vrm: "/p2.vrm", x: 0, y: 0, z: -2, h: 0, a: 0 }]);
    await idle();
    for (let i = 0; i < 12; i++) frame();
    const facts = kit.inspect();
    assert.equal(facts.avatarSelf, "stand-in");
    assert.equal(facts.avatarOthersDrawn, 1);
    assert.equal(facts.avatarOthersVrm, 0);
    kit.dispose();
});

test("with the lobby's packs, the lobby's own motion clock and finishing pass drive the avatar", async () => {
    const { decodeLobbyMotion, walkerMotion } = await import("../src/index.ts");
    const packs = ["lobby-core.lcp", "lobby-air.lcp"].map((name) =>
        readFileSync(file(`../motion/${name}`))
    );
    const avatar = createAvatar({ height: 1.75 });
    avatar.attach(await loadVRM(bytes()));
    avatar.addClips({ ...locomotion, ...decodeLobbyMotion(packs) });
    for (let i = 0; i < 200 && !avatar.lobbyMotion; i++)
        await new Promise((resolve) => setTimeout(resolve, 5));
    assert.ok(avatar.lobbyMotion, "the lobby clock prepares this rig");
    const state = {
        vx: 0,
        vz: 0,
        vy: 0,
        rotation: 0,
        jumpCount: 0,
        floor: true,
    };
    const seen = new Set();
    for (let frame = 0; frame < 150; frame++) {
        // Forward from rest, then a hard left turn while running.
        const input = { strafe: frame > 90 ? -1 : 0, forward: -1, yaw: 0 };
        state.vz = Math.max(-4.5, state.vz - 0.15);
        if (frame > 90) state.vx = Math.max(-3, state.vx - 0.2);
        state.rotation += frame > 90 ? 0.03 : 0;
        avatar.root.rotation.y = state.rotation;
        avatar.motion = walkerMotion(state, input);
        avatar.drive(1 / 60);
        seen.add(avatar.playing);
        avatar.root.updateMatrixWorld(true);
        assert.ok(
            Number.isFinite(hipsY(avatar)) && Number.isFinite(footY(avatar))
        );
    }
    assert.ok(seen.has("RUN") || seen.has("SPRINT"), [...seen].join(","));
    assert.ok(
        [...seen].some(
            (name) => name !== "IDLE" && name !== "WALK" && name !== "RUN"
        ),
        `the clock adds lobby-only clips (starts, turns): ${[...seen].join(
            ","
        )}`
    );
    // An emote still plays from the kit's own clips.
    avatar.addClips(emotes);
    avatar.motion = { emote: "HIPHOP" };
    for (let i = 0; i < 40; i++) avatar.drive(1 / 30);
    assert.equal(avatar.playing, "HIPHOP");
    avatar.dispose();
});

test("walkerMotion gives the lobby clock the walker's travel and steering", async () => {
    const { walkerMotion } = await import("../src/index.ts");
    const m = walkerMotion(
        { vx: 0, vz: -3, vy: 0, rotation: 0, jumpCount: 0, floor: true },
        { strafe: -1, forward: 0, yaw: 0 }
    );
    assert.equal(m.grounded, true);
    assert.equal(m.stopping, false);
    assert.ok(Math.abs(m.headingError) < 1e-9);
    assert.ok(Math.abs(m.turnIntent - Math.PI / 2) < 1e-9);
    const still = walkerMotion(
        { vx: 0, vz: 0, vy: 0, rotation: 0, jumpCount: 0, floor: true },
        { strafe: 0, forward: 0, yaw: 0 }
    );
    assert.equal(still.stopping, true);
    assert.equal(still.turnIntent, 0);
});
