import { rgb } from "../kernel/build";
import { smoothstep } from "../kernel/noise";
import type { Vec3 } from "../kernel/sdf";
import {
    Groom,
    Hairline,
    P3,
    addv,
    hairlineDepth,
    scatter,
    unit,
} from "./hair";

export interface PonytailStyle {
    kind: "ponytail";
    hairline: Hairline;
    /** Direction from the skull centre to where the hair is tied. */
    tie: Vec3;
    /** Where the parting sits, metres left of centre. */
    part: number;
    tailLength: [number, number];
    /** Loose strands: 1 is the reference mess. */
    mess: number;
    band: string;
}

export type HairStyle = PonytailStyle;

/** Cut a guide short, keeping at least a few points. */
function trim(guide: P3[], fraction: number) {
    guide.length = Math.min(
        guide.length,
        Math.max(4, Math.round(guide.length * fraction))
    );
}

export interface GrownHair {
    /** Head-space anchor of anything that swings (a ponytail's tie). */
    tie?: P3;
}

/**
 * A low, loose ponytail: hair drawn back over the skull to a tie at the
 * nape, a centre parting with long locks left out to frame the face, and
 * plenty of strays.
 */
export function growPonytail(g: Groom, style: PonytailStyle): GrownHair {
    const line = style.hairline;
    const centre = line.centre;
    const mess = style.mess;
    g.scalp(centre, (p) => hairlineDepth(line, p) - 0.005);
    const tie = g.cast(centre, style.tie, 0.011);

    const toTie = () =>
        addv(tie, [g.range(-0.004, 0.004), g.range(-0.004, 0.004), 0.004]);
    /** Sink a guide's first point into the scalp so no cut end shows. */
    const rooted = (guide: P3[]) => {
        guide[0] = g.settle(guide[0], -0.0015);
        return guide;
    };

    const dbg = (globalThis as any).__hairDebug;
    // Under-layer: broad dark locks drawn straight back, for coverage.
    for (const direction of dbg ? [] : scatter(150, g.random)) {
        const root = g.cast(centre, direction, 0.001);
        if (hairlineDepth(line, root) < 0.002) continue;
        const up = smoothstep(1.6, 1.68, root[1]);
        const base = g.range(0.002, 0.005) + up * 0.003;
        const guide = g.flow(root, tie, () => base, {
            wander: 0.2 * mess,
            stop: 0.014,
            over: true,
        });
        guide.push(toTie());
        g.lock(rooted(guide), {
            width: g.range(0.0055, 0.008),
            thickness: g.range(0.0022, 0.003),
            belly: 0.4,
            root: 0.1,
            tone: g.range(0.6, 0.95),
            depth: 0.8,
            samples: 11,
        });
    }

    // Combed out from the parting: hair lifts at the root, drapes over the
    // corner of the forehead, then turns back above the ear to the tie.
    const partRoot = (s: number, f: number) => {
        const a = 0.72 - f * 1.3;
        return g.cast(
            centre,
            [
                style.part * 12 + s * g.range(0.01, 0.07),
                Math.cos(a),
                Math.sin(a),
            ],
            0.001
        );
    };
    const combed = (s: number, f: number, lift: number, wander: number) => {
        const root = partRoot(s, f);
        const front = 1 - smoothstep(0.1, 0.75, f);
        const volume = g.range(0.006, 0.012) * (0.6 + 0.5 * front) + lift;
        const waypoint = g.cast(
            centre,
            [
                s * 0.93,
                0.32 - 0.3 * front + g.range(-0.08, 0.08),
                0.34 * front - 0.14 + g.range(-0.06, 0.06),
            ],
            0.006
        );
        // Hair leaves the parting sideways, straight out from where it is
        // rooted, and only then turns back: at the front that carries it
        // over the corner of the forehead in a curve.
        const start: P3[] = [
            root,
            g.settle(
                [
                    s * (0.034 + g.range(-0.005, 0.005)),
                    root[1] - 0.006 + g.range(-0.003, 0.003),
                    root[2] - 0.004 + g.range(-0.006, 0.006),
                ],
                0.003 + volume
            ),
            g.settle(
                [
                    s * (0.064 + g.range(-0.005, 0.005)),
                    root[1] - 0.036 + g.range(-0.008, 0.008),
                    root[2] - 0.016 + g.range(-0.01, 0.008),
                ],
                0.003 + volume * 0.8
            ),
        ];
        const first = start
            .slice(0, -1)
            .concat(
                g.flow(
                    start[start.length - 1],
                    waypoint,
                    (t) => 0.003 + volume * (0.8 - 0.45 * t) + lift * t,
                    { wander, stop: 0.016, step: 0.011 }
                )
            );
        const settle = 0.0055 + lift + g.range(0, 0.002);
        const second = g.flow(
            first[first.length - 1],
            tie,
            (t) => settle - 0.003 * t,
            { wander: wander * 1.6, stop: 0.014 }
        );
        return rooted(first.concat(second.slice(1)));
    };
    for (const s of [1, -1]) {
        for (let i = 0; i < (dbg ? 0 : 18); i++) {
            const guide = combed(
                s,
                (i + g.range(-0.3, 0.3)) / 17,
                0,
                0.12 * mess
            );
            guide.push(toTie());
            g.lock(guide, {
                width: g.range(0.005, 0.0072),
                thickness: g.range(0.0026, 0.0036),
                belly: 0.3,
                root: 0.08,
                tone: g.range(0.75, 1.15),
                depth: 0.25,
                samples: 16,
            });
        }
    }

    // Top layer: many fine strands over the same paths, lighter and looser,
    // some slipping free before they reach the tie.
    for (const s of [1, -1]) {
        for (let i = 0; i < (dbg ? 0 : 46); i++) {
            const guide = combed(
                s,
                g.random(),
                g.range(0.001, 0.004),
                0.16 * mess
            );
            const free = g.random() < 0.16 * mess;
            if (free) trim(guide, g.range(0.45, 0.9));
            else guide.push(toTie());
            g.lock(guide, {
                width: g.range(0.0014, 0.003),
                thickness: g.range(0.0011, 0.0018),
                belly: 0.3,
                root: 0.3,
                tone: g.range(1.1, 3.2),
                depth: 0,
                samples: 16,
                sides: 4,
                ridges: 2,
            });
        }
    }
    for (const direction of dbg ? [] : scatter(110, g.random)) {
        const root = g.cast(centre, direction, 0.001);
        if (hairlineDepth(line, root) < 0.003) continue;
        const up = smoothstep(1.6, 1.68, root[1]);
        const base = g.range(0.004, 0.008) + up * 0.003;
        const loose = g.random() < 0.08 * mess ? g.range(0.004, 0.009) : 0;
        const guide = g.flow(
            root,
            tie,
            (t) => base + loose * Math.sin(Math.PI * Math.min(1, t * 1.15)),
            { wander: 0.22 * mess, stop: 0.014, over: true }
        );
        if (g.random() < 0.14 * mess) trim(guide, g.range(0.5, 0.9));
        else guide.push(toTie());
        g.lock(rooted(guide), {
            width: g.range(0.0014, 0.003),
            thickness: g.range(0.0011, 0.0018),
            belly: 0.35,
            root: 0.3,
            tone: g.range(1.1, 3.2),
            depth: 0,
            samples: 16,
            sides: 4,
            ridges: 2,
        });
    }

    // The tail: a bundle hanging from the tie, fanning and waving a little.
    for (let i = 0; i < (dbg ? 0 : 30); i++) {
        const length = g.range(style.tailLength[0], style.tailLength[1]);
        const steps = 9;
        const phase = g.range(0, 6.28);
        const wave = g.range(0.1, 0.32) * mess;
        const spread = g.range(-0.5, 0.5);
        let d = unit([spread * 0.7, g.range(-0.5, -0.1), -0.85]);
        let p = addv(tie, [
            g.range(-0.006, 0.006),
            g.range(-0.006, 0.004),
            g.range(-0.004, 0.004),
        ]);
        const guide: P3[] = [p];
        const layer = g.range(0.004, 0.016);
        for (let k = 0; k < steps; k++) {
            const t = (k + 1) / steps;
            d = unit([
                d[0] * 0.8 + spread * 0.12 + Math.sin(phase + t * 5) * wave,
                d[1] - 0.42,
                d[2] * 0.62 + Math.cos(phase * 1.3 + t * 4) * wave * 0.6 - 0.04,
            ]);
            p = g.clear(addv(p, d, length / steps), layer);
            guide.push(p);
        }
        g.lock(guide, {
            width: g.range(0.006, 0.01),
            thickness: g.range(0.003, 0.0048),
            belly: 0.3,
            root: 0.6,
            tone: g.range(0.75, 1.3),
            depth: 1 - smoothstep(0.004, 0.012, layer),
            samples: 14,
        });
    }

    // Locks left out of the tie, in a few bunches a side: from the parting
    // they curve out over the forehead's corner and hang past the cheek.
    for (const s of [1, -1]) {
        const bunches = [
            { f: 0.03, end: g.range(0.85, 1), back: 0, size: 4, thin: false },
            {
                f: 0.12,
                end: g.range(0.45, 0.65),
                back: 0.01,
                size: 3,
                thin: false,
            },
            {
                f: 0.22,
                end: g.range(0.25, 0.4),
                back: 0.02,
                size: 3,
                thin: false,
            },
            { f: 0.08, end: 1, back: 0.004, size: 3, thin: true },
        ];
        for (const bunch of bunches) {
            const flick = g.range(-0.002, 0.014);
            const sway = g.range(-0.004, 0.004);
            for (let i = 0; i < bunch.size; i++) {
                const j = () => g.range(-0.0035, 0.0035);
                const root = partRoot(s, bunch.f + g.range(0, 0.05));
                const back = bunch.back + g.range(0, 0.006);
                const lift = g.range(0.006, 0.011);
                const points: [P3, number][] = [
                    [
                        [s * (0.034 + j()), 1.667 + j(), 0.064 - back + j()],
                        lift + 0.004,
                    ],
                    [
                        [s * (0.061 + j()), 1.637 + j(), 0.055 - back + j()],
                        lift + 0.003,
                    ],
                    [
                        [s * (0.077 + j()), 1.592 + j(), 0.045 - back + j()],
                        lift,
                    ],
                    [
                        [s * (0.083 + sway + j()), 1.545, 0.04 - back + j()],
                        lift,
                    ],
                    [
                        [s * (0.082 + sway + j()), 1.498, 0.04 - back + j()],
                        lift,
                    ],
                    [
                        [s * (0.08 + flick * 0.6 + j()), 1.45, 0.046 - back],
                        lift,
                    ],
                    [
                        [
                            s * (0.086 + flick * 1.7 + j()),
                            1.402 + j(),
                            0.056 - back,
                        ],
                        lift,
                    ],
                ];
                const end = Math.min(1, bunch.end + g.range(-0.08, 0.08));
                const kept = Math.max(3, Math.round(end * points.length));
                const guide: P3[] = [root].concat(
                    points
                        .slice(0, kept)
                        .map(([p, l], k) =>
                            k < 3 ? g.settle(p, l) : g.clear(p, l)
                        )
                );
                g.lock(rooted(guide), {
                    width: bunch.thin
                        ? g.range(0.0012, 0.002)
                        : g.range(0.003, 0.0052),
                    thickness: bunch.thin ? 0.001 : g.range(0.0018, 0.0026),
                    belly: 0.3,
                    root: 0.3,
                    tone: g.range(0.9, 2),
                    depth: 0,
                    samples: Math.max(10, kept * 3),
                    sides: bunch.thin ? 4 : 6,
                });
            }
        }
        // Short wisps at the temple, in front of the ear.
        for (let i = 0; i < 4; i++) {
            const x = s * g.range(0.066, 0.072);
            const z = g.range(0.012, 0.036);
            const guide = [
                g.settle([x, 1.6 + g.range(-0.005, 0.008), z], 0.001),
                g.clear([x * 1.04, 1.57, z + 0.004], 0.003),
                g.clear(
                    [
                        x * 1.05 + s * g.range(-0.002, 0.006),
                        g.range(1.515, 1.545),
                        z + g.range(0, 0.01),
                    ],
                    0.004
                ),
            ];
            g.lock(guide, {
                width: g.range(0.002, 0.0035),
                thickness: 0.0014,
                belly: 0.25,
                root: 0.7,
                tone: g.range(0.9, 1.3),
                samples: 8,
                sides: 4,
            });
        }
    }

    // Strays everywhere, a few more around the crown and the tail.
    g.strays(Math.round(190 * mess), [0.018, 0.07]);
    g.strays(Math.round(40 * mess), [0.03, 0.1], (p) => p[1] < tie[1]);

    // The hair tie: a small clear band.
    const band = rgb(style.band);
    const ring: P3[] = [];
    for (let i = 0; i <= 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        ring.push([
            tie[0] + Math.cos(a) * 0.0125,
            tie[1] + Math.sin(a) * 0.011 - 0.003,
            tie[2] - 0.003 + Math.sin(a) * 0.004,
        ]);
    }
    g.out.tube(
        ring,
        6,
        () => 0.0026,
        () => band,
        { caps: false }
    );
    return { tie };
}
