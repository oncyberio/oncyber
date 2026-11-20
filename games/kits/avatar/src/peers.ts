/**
 * Other players, from the page's `peers` message (ten times a second) to a
 * smooth pose every frame. Pure data: no renderer.
 */

export interface PeerSample {
    t: number;
    x: number;
    y: number;
    z: number;
    h: number;
    a: number;
}
export interface Peer {
    id: string;
    name: string;
    /** The avatar the page vouches for; empty when the player has none. */
    vrm: string;
    talking: boolean;
    samples: PeerSample[];
}

const number = (v: unknown) =>
    typeof v === "number" && Number.isFinite(v) ? v : 0;

/** One entry of the page's list, or null when it has no usable id. */
export function readPeer(raw: any): {
    id: string;
    name: string;
    vrm: string;
    talking: boolean;
    pose: Omit<PeerSample, "t">;
    fresh: boolean;
} | null {
    if (!raw || typeof raw.id !== "string" || !raw.id) return null;
    const name =
        typeof raw.name === "string" && raw.name.trim()
            ? raw.name.trim().slice(0, 24)
            : "Visitor";
    const vrm =
        typeof raw.vrm === "string" && raw.vrm.length <= 2048
            ? raw.vrm
            : typeof raw.avatarUrl === "string" && raw.avatarUrl.length <= 2048
            ? raw.avatarUrl
            : "";
    return {
        id: raw.id.slice(0, 64),
        name,
        vrm,
        talking: raw.talking === true,
        fresh: raw.fresh === true,
        pose: {
            x: number(raw.x),
            y: number(raw.y),
            z: number(raw.z),
            h: number(raw.h),
            a: Math.max(0, Math.min(31, Math.round(number(raw.a)))),
        },
    };
}

/** Add a pose to a peer's history when it moved (or the page says it is new). */
export function pushSample(
    samples: PeerSample[],
    pose: Omit<PeerSample, "t">,
    t: number,
    fresh = false,
    keep = 20
) {
    const last = samples[samples.length - 1];
    if (
        last &&
        !fresh &&
        last.x === pose.x &&
        last.y === pose.y &&
        last.z === pose.z &&
        last.h === pose.h &&
        last.a === pose.a
    )
        return;
    samples.push({ t, ...pose });
    if (samples.length > keep) samples.shift();
}

const turn = (from: number, to: number, k: number) =>
    from + Math.atan2(Math.sin(to - from), Math.cos(to - from)) * k;

/**
 * The pose at time `t`, between the two samples around it. Callers draw
 * peers a little in the past (`PEER_DELAY`) so there is a sample on each side.
 */
export function samplePose(
    samples: PeerSample[],
    t: number
): (Omit<PeerSample, "t"> & { speed: number }) | null {
    if (!samples.length) return null;
    let i = samples.length - 1;
    while (i > 0 && samples[i].t > t) i--;
    const a = samples[i],
        b = samples[i + 1];
    if (!b || t <= a.t)
        return { x: a.x, y: a.y, z: a.z, h: a.h, a: a.a, speed: 0 };
    const span = Math.max(1e-3, b.t - a.t);
    const k = Math.min(1, (t - a.t) / span);
    return {
        x: a.x + (b.x - a.x) * k,
        y: a.y + (b.y - a.y) * k,
        z: a.z + (b.z - a.z) * k,
        h: turn(a.h, b.h, k),
        a: k < 0.5 ? a.a : b.a,
        speed: Math.hypot(b.x - a.x, b.z - a.z) / span,
    };
}
export const PEER_DELAY = 0.26;
