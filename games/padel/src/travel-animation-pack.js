// Same validated LCP1 decoder used by the native Oncyber lobby.
// Source: frontend/features/lobby/cc0LocomotionPack.ts.
let decodedPackSerial = 0;
const fail = () => {
  throw new Error("Invalid LCP1 locomotion pack");
};
const integer = (value, min, max) =>
  Number.isInteger(value) && Number(value) >= min && Number(value) <= max;
const identifier = (value) =>
  typeof value === "string" && /^[A-Za-z][A-Za-z0-9_]{0,79}$/.test(value);
function decodeCC0LocomotionPack(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.byteLength < 10 || bytes.byteLength > 262144) fail();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, false) !== 1279479857) fail();
  const headerLength = view.getUint32(4, true);
  if (headerLength > 65536 || headerLength + 8 >= bytes.byteLength) fail();
  let header;
  try {
    header = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(
        bytes.subarray(8, 8 + headerLength)
      )
    );
  } catch {
    fail();
  }
  if (
    !header ||
    header.version !== 1 ||
    !Array.isArray(header.bones) ||
    header.bones.length < 1 ||
    header.bones.length > 64 ||
    !header.bones.every(identifier) ||
    new Set(header.bones).size !== header.bones.length ||
    !Array.isArray(header.clips) ||
    header.clips.length < 1 ||
    header.clips.length > 16
  )
    fail();
  const packSerial = ++decodedPackSerial;
  const result = {
    clips: /* @__PURE__ */ Object.create(null),
    metadata: /* @__PURE__ */ Object.create(null),
  };
  const dataStart = 8 + headerLength;
  let expectedOffset = 0;
  for (const clip of header.clips) {
    if (
      !clip ||
      !identifier(clip.name) ||
      result.clips[clip.name] ||
      !Number.isFinite(clip.duration) ||
      clip.duration <= 0 ||
      clip.duration > 60 ||
      typeof clip.loop !== "boolean" ||
      !Array.isArray(clip.tracks) ||
      clip.tracks.length < 1 ||
      clip.tracks.length > 64
    )
      fail();
    const names = /* @__PURE__ */ new Set();
    const tracks = clip.tracks.map((track) => {
      if (
        !track ||
        !integer(track.bone, 0, header.bones.length - 1) ||
        (track.kind !== "q" && track.kind !== "p") ||
        !integer(track.count, 2, 4096) ||
        track.offset !== expectedOffset
      )
        fail();
      const quaternion = track.kind === "q";
      const components = quaternion ? 4 : 3;
      const stride = 2 + components * 2;
      const byteLength = track.count * stride;
      if (dataStart + track.offset + byteLength > bytes.byteLength) fail();
      expectedOffset += byteLength;
      if (
        !quaternion &&
        (!Array.isArray(track.min) ||
          !Array.isArray(track.max) ||
          track.min.length !== 3 ||
          track.max.length !== 3 ||
          !track.min.every(
            (n, i) =>
              Number.isFinite(n) &&
              Number.isFinite(track.max[i]) &&
              n <= track.max[i] &&
              Math.abs(n) <= 1e4 &&
              Math.abs(track.max[i]) <= 1e4
          ) ||
          header.bones[track.bone] !== "mixamorigHips")
      )
        fail();
      const name = `${header.bones[track.bone]}.${
        quaternion ? "quaternion" : "position"
      }`;
      if (names.has(name)) fail();
      names.add(name);
      const times = new Array(track.count);
      const values = new Array(track.count * components);
      let previous = -1;
      for (let key = 0; key < track.count; key++) {
        let cursor = dataStart + track.offset + key * stride;
        const time = view.getUint16(cursor, true);
        if (
          time <= previous ||
          (key === 0 && time !== 0) ||
          (key === track.count - 1 && time !== 65535)
        )
          fail();
        previous = time;
        times[key] = (time / 65535) * clip.duration;
        cursor += 2;
        let lengthSquared = 0;
        for (let component = 0; component < components; component++) {
          const value = quaternion
            ? view.getInt16(cursor, true) / 32767
            : track.min[component] +
              (view.getUint16(cursor, true) / 65535) *
                (track.max[component] - track.min[component]);
          values[key * components + component] = value;
          lengthSquared += value * value;
          cursor += 2;
        }
        if (quaternion) {
          if (lengthSquared < 0.99 || lengthSquared > 1.01) fail();
          const inverseLength = 1 / Math.sqrt(lengthSquared);
          for (let component = 0; component < 4; component++)
            values[key * 4 + component] *= inverseLength;
        }
      }
      return {
        name,
        type: quaternion ? "quaternion" : "vector",
        times,
        values,
      };
    });
    result.clips[clip.name] = {
      uuid: `cc0-${packSerial}-${clip.name}`,
      blendMode: 2500,
      // THREE.NormalAnimationBlendMode in both backends.
      name: clip.name,
      duration: clip.duration,
      tracks,
    };
    result.metadata[clip.name] = {
      duration: clip.duration,
      loop: clip.loop,
    };
  }
  if (dataStart + expectedOffset !== bytes.byteLength) fail();
  return result;
}
export { decodeCC0LocomotionPack };

export const TRAVEL_ANIMATION_DURATION_MS = Object.freeze({
  TRAVEL_ATTACK: 3533.3333015441895,
  TRAVEL_CROUCH_DOWN: 1000,
  TRAVEL_CROUCH_IDLE: 1366.6666746139526,
  TRAVEL_STAND_UP: 1000,
  IDLE_CC0: 2500,
});
export const TRAVEL_POSE_NAMES = new Set(
  Object.keys(TRAVEL_ANIMATION_DURATION_MS)
);
export const travelAnimationLoops = (name) =>
  name === "TRAVEL_CROUCH_IDLE" || name === "IDLE_CC0";
let pending;
/** Load once before destination readiness. Failed loads remain retryable. */
export function loadTravelAnimationPack() {
  return (pending ||= Promise.all(
    ["travel.f7d646d776ff.lcp", "core.0e2fa3a1be67.lcp"].map(
      async (file) => {
        const url = new URL(`./lobby/travel/${file}`, window.location.href);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20000);
        try {
          const response = await fetch(url, { signal: controller.signal });
          if (!response.ok)
            throw new Error(`Travel animations: ${response.status}`);
          return decodeCC0LocomotionPack(await response.arrayBuffer());
        } finally {
          clearTimeout(timeout);
        }
      }
    )
  )
    .then(([travel, core]) => {
      const clips = { ...travel.clips, IDLE_CC0: core.clips.IDLE_CC0 };
      const metadata = { ...travel.metadata, IDLE_CC0: core.metadata.IDLE_CC0 };
      for (const name of TRAVEL_POSE_NAMES) {
        if (
          !clips[name] ||
          !metadata[name] ||
          metadata[name].loop !== travelAnimationLoops(name) ||
          Math.abs(
            metadata[name].duration * 1000 - TRAVEL_ANIMATION_DURATION_MS[name]
          ) > 0.001
        )
          throw new Error(`Invalid native travel clip: ${name}`);
      }
      return { clips, metadata };
    })
    .catch((error) => {
      pending = undefined;
      throw error;
    }));
}
