// Rebuild the skeletal-only tennis pack from the licensed Rokoko sports FBX.
// Usage: node worlds/tennis/tools/extract-tennis-motion.mjs /path/to/Tennis_mixamo.fbx
import { readFile, writeFile } from "node:fs/promises";
import * as THREE from "three";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
const source = process.argv[2];
if (!source)
  throw new Error(
    "Provide Tennis_mixamo.fbx from the Rokoko free sports collection."
  );
const bytes = await readFile(source);
const root = new FBXLoader().parse(
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  ""
);
root.updateMatrixWorld(true);
const raw = root.animations[0];
const rest = new Map();
root.traverse((node) => {
  if (node.isBone)
    rest.set(node.name, {
      inverse: node.getWorldQuaternion(new THREE.Quaternion()).invert(),
      parent: node.parent.getWorldQuaternion(new THREE.Quaternion()),
    });
});
const hips = root.getObjectByName("mixamorigHips");
const sourceHipsHeight = hips.getWorldPosition(new THREE.Vector3()).y;
const mixer = new THREE.AnimationMixer(root);
mixer.clipAction(raw).play();
const intervals = [
  { name: "tennis-ready", start: 2.1, end: 2.9, contact: 2.5 },
  { name: "tennis-forehand", start: 3.2, end: 4.65, contact: 3.8 },
  { name: "tennis-backhand", start: 7.35, end: 8.9, contact: 8.075 },
  { name: "tennis-serve", start: 13.15, end: 15.6, contact: 14.85 },
];
const round = (x) => Math.round(x * 1e6) / 1e6;
const clips = intervals.map(({ name, start, end, contact }) => {
  // Preserve the torso turn, removing only the capture's overall court heading.
  mixer.setTime(
    name === "tennis-serve" ? 15.4 : name === "tennis-backhand" ? 8.7 : 4.4
  );
  root.updateMatrixWorld(true);
  const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(
    hips.getWorldQuaternion(new THREE.Quaternion())
  );
  const heading = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 1, 0),
    -Math.atan2(forward.x, forward.z)
  );
  const times = Array.from(
    { length: Math.ceil((end - start) * 60) + 1 },
    (_, i) => Math.min(end - start, i / 60)
  );
  const tracks = [];
  for (const track of raw.tracks) {
    const [bone, prop] = track.name.split(".");
    const bind = rest.get(bone);
    if (!bind || bone === "mixamorigReference") continue;
    const interpolate = track.createInterpolant();
    if (prop === "quaternion") {
      const values = [];
      for (const t of times) {
        const q = new THREE.Quaternion().fromArray(
          interpolate.evaluate(start + t)
        );
        q.premultiply(bind.parent).multiply(bind.inverse);
        if (bone === "mixamorigHips") q.premultiply(heading);
        values.push(...q.normalize().toArray().map(round));
      }
      tracks.push({
        name: track.name,
        type: "quaternion",
        times: times.map(round),
        values,
      });
    } else if (bone === "mixamorigHips" && prop === "position") {
      const values = times.flatMap((t) => [
        0,
        round(interpolate.evaluate(start + t)[1]),
        0,
      ]);
      tracks.push({
        name: track.name,
        type: "vector",
        times: times.map(round),
        values,
      });
    }
  }
  return {
    name,
    start,
    end,
    contact: round(contact - start),
    clip: { name, duration: round(end - start), tracks },
  };
});
const pack = {
  source: "Rokoko / Sam Lazarus — Tennis_mixamo.fbx",
  sourceUrl:
    "https://www.rokoko.com/resources/rokoko-mocap-12-free-sports-animations",
  license:
    "Official resource page permits personal and commercial use in animation, VFX, games and 3D art projects. Original resource retrieved 2026-10-13.",
  sourceHipsHeight,
  notes: [
    "Actual forehand, two-handed backhand, ready stance and serve from the tennis recording. Skeletal motion only; no mesh.",
    "Normalized against source rest pose; horizontal root travel removed so game physics owns movement.",
  ],
  clips,
};
await writeFile(
  new URL("../src/anim/tennis-motion.json", import.meta.url),
  JSON.stringify(pack)
);
console.log(
  clips
    .map((c) => `${c.name}: ${c.clip.duration}s, contact ${c.contact}s`)
    .join("\n")
);
