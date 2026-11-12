/** Offline extraction of the already-pinned CC0 idle; no runtime dependencies. */
export function readPackedIdle(bytes) {
    const headerLength = bytes.readUInt32LE(4);
    const header = JSON.parse(bytes.subarray(8, 8 + headerLength));
    const clip = header.clips.find((clip) => clip.name === "IDLE");
    return {
        name: "IDLE_CC0",
        duration: clip.duration,
        tracks: clip.tracks.map((track) => {
            const quaternion = track.kind === "q";
            const width = quaternion ? 4 : 3;
            let cursor = 8 + headerLength + track.offset;
            const times = [],
                values = [];
            for (let key = 0; key < track.count; key++) {
                times.push(
                    (bytes.readUInt16LE(cursor) / 65535) * clip.duration
                );
                cursor += 2;
                for (let axis = 0; axis < width; axis++) {
                    values.push(
                        quaternion
                            ? bytes.readInt16LE(cursor) / 32767
                            : track.min[axis] +
                                  (bytes.readUInt16LE(cursor) / 65535) *
                                      (track.max[axis] - track.min[axis])
                    );
                    cursor += 2;
                }
            }
            return {
                name: `${header.bones[track.bone]}.${
                    quaternion ? "quaternion" : "position"
                }`,
                type: quaternion ? "quaternion" : "vector",
                times,
                values,
            };
        }),
    };
}

export function oncyberIdleWithHands(original, relaxed) {
    const finger = /Hand(Thumb|Index|Middle|Ring|Pinky)[123]\.quaternion$/;
    const hands = new Map(
        relaxed.tracks
            .filter((t) => finger.test(t.name))
            .map((t) => [t.name, t])
    );
    return {
        ...original,
        name: "IDLE_ONCYBER",
        tracks: original.tracks.map((track) => {
            const hand = hands.get(track.name);
            return hand
                ? {
                      ...hand,
                      times: hand.times.map(
                          (t) => (t / relaxed.duration) * original.duration
                      ),
                  }
                : track;
        }),
    };
}
