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

    // Under-layer: broad dark locks drawn straight back, for coverage.
    for (const direction of scatter(150, g.random)) {
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
        for (let i = 0; i < 18; i++) {
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
        for (let i = 0; i < 46; i++) {
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
    for (const direction of scatter(110, g.random)) {
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
    for (let i = 0; i < 30; i++) {
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

export interface QuiffStyle {
    kind: "quiff";
    hairline: Hairline;
    /** Where the parting sits, metres left of centre. */
    part: number;
    /** Length of the long hair on top, in metres. */
    top: [number, number];
    /** How high the top hair stands off the skull. */
    lift: number;
    /** Length of the short back and sides. */
    sides: [number, number];
    mess: number;
}

/**
 * Short back and sides under a full, wavy top: thick locks that rise from
 * the parting, sweep back and out with a wave, and a few that fall forward
 * over the forehead.
 */
export function growQuiff(g: Groom, style: QuiffStyle): GrownHair {
    const line = style.hairline;
    const centre = line.centre;
    g.scalp(centre, (p) => hairlineDepth(line, p) - 0.004);
    const crownY = centre[1] + 0.06;
    const isTop = (p: P3) =>
        p[1] > centre[1] + 0.046 - 0.25 * Math.max(0, p[2]);

    // Back and sides: short locks combed down and back, close to the head.
    for (const direction of scatter(330, g.random)) {
        const root = g.cast(centre, direction, 0.0008);
        const depth = hairlineDepth(line, root);
        if (depth < 0.001 || isTop(root)) continue;
        let length =
            g.range(style.sides[0], style.sides[1]) *
            (0.6 + 0.4 * smoothstep(0, 0.03, depth));
        // Cut round the ears.
        const overEar =
            Math.abs(root[0]) > 0.055 && root[2] > -0.045 && root[2] < 0.03;
        if (overEar)
            length = Math.max(0.006, Math.min(length, (root[1] - 1.585) * 0.9));
        const n = g.normal(root);
        // Down, and back round the head.
        const aim: P3 = [root[0] * 0.2, -1, -0.55];
        const d = unit(
            addv(aim, n, -(aim[0] * n[0] + aim[1] * n[1] + aim[2] * n[2]))
        );
        const lift = g.range(0.0025, 0.0055);
        const guide: P3[] = [g.settle(root, -0.001)];
        for (let k = 1; k <= 3; k++)
            guide.push(
                g.settle(addv(root, d, (length * k) / 3), lift * (1 - 0.25 * k))
            );
        g.lock(guide, {
            width: g.range(0.0035, 0.0055),
            thickness: g.range(0.002, 0.003),
            belly: 0.35,
            root: 0.3,
            tone: g.range(0.7, 1.4),
            depth: 0.35,
            samples: 7,
            sides: 5,
            ridges: 1,
        });
    }

    // Top: long thick locks. Each rises, sweeps away from the parting and
    // back, and rolls over at the end.
    const sweepLock = (
        root: P3,
        heading: P3,
        length: number,
        rise: number,
        options: {
            width: number;
            thickness: number;
            flip: number;
            tone: number;
            depth: number;
        }
    ) => {
        const steps = 8;
        const guide: P3[] = [g.settle(root, -0.0015)];
        let p: P3 = root;
        const wave = g.range(0, 6.28);
        const swing = g.range(-0.5, 0.5) * style.mess;
        for (let k = 1; k <= steps; k++) {
            const t = k / steps;
            const n = g.normal(p);
            // Along the head in the heading's direction, with a slow wave.
            const side = [
                n[1] * heading[2] - n[2] * heading[1],
                n[2] * heading[0] - n[0] * heading[2],
                n[0] * heading[1] - n[1] * heading[0],
            ];
            const along = addv(
                heading,
                n,
                -(heading[0] * n[0] + heading[1] * n[1] + heading[2] * n[2])
            );
            const d = unit(
                addv(
                    along,
                    side as P3,
                    Math.sin(wave + t * 4) * 0.3 + swing * t
                )
            );
            // Up off the scalp, over, and back down, with the tip kicking out.
            const lift =
                0.004 +
                rise *
                    Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.08)), 0.75) +
                options.flip * t * t * t;
            p = g.settle(addv(p, d, length / steps), lift);
            guide.push(p);
        }
        g.lock(guide, {
            width: options.width,
            thickness: options.thickness,
            belly: 0.42,
            root: 0.15,
            tone: options.tone,
            depth: options.depth,
            samples: 15,
            sides: 8,
            ridges: 4,
        });
    };
    const top = scatter(520, g.random)
        .map((direction) => g.cast(centre, direction, 0.0008))
        .filter((p) => hairlineDepth(line, p) > 0.002 && isTop(p));
    for (const root of top) {
        const side = root[0] > style.part ? 1 : -1;
        const front = smoothstep(0.0, 0.06, root[2]);
        // Away from the parting, turning to the back of the head.
        const heading = unit([
            side * (0.8 - 0.15 * front),
            0,
            -0.5 + 0.55 * front + g.range(-0.2, 0.2),
        ]);
        sweepLock(
            root,
            heading,
            g.range(style.top[0], style.top[1]) * (0.75 + 0.25 * front),
            style.lift * g.range(0.55, 1.1) * (0.7 + 0.3 * front),
            {
                width: g.range(0.0075, 0.012),
                thickness: g.range(0.0045, 0.0068),
                flip: g.range(0, 0.016),
                tone: g.range(0.75, 1.6),
                depth: root[1] > crownY ? 0 : 0.2,
            }
        );
    }
    // The fringe: locks from the front of the parting that fall forward
    // and curve aside over the forehead.
    for (let i = 0; i < 7; i++) {
        const side = i % 2 ? 1 : -1;
        const root = g.cast(
            centre,
            [
                style.part * 10 + side * g.range(0.02, 0.22),
                0.74,
                g.range(0.62, 0.72),
            ],
            0.0008
        );
        const drop = g.range(0.02, 0.05);
        const sway = side * g.range(0.012, 0.03);
        const guide: P3[] = [
            g.settle(root, -0.0015),
            g.clear(
                [root[0] + sway * 0.2, root[1] + 0.012, root[2] + 0.014],
                0.012
            ),
            g.clear(
                [root[0] + sway * 0.6, root[1] - drop * 0.35, root[2] + 0.022],
                0.012
            ),
            g.clear([root[0] + sway, root[1] - drop, root[2] + 0.012], 0.008),
            g.clear(
                [root[0] + sway * 1.5, root[1] - drop * 1.15, root[2] + 0.006],
                0.008
            ),
        ];
        g.lock(guide, {
            width: g.range(0.004, 0.0075),
            thickness: g.range(0.003, 0.0042),
            belly: 0.4,
            root: 0.45,
            tone: g.range(0.8, 1.5),
            samples: 12,
            sides: 7,
            ridges: 3,
        });
    }
    g.strays(Math.round(36 * style.mess), [0.012, 0.035]);
    return {};
}

export type AnyHairStyle = PonytailStyle | QuiffStyle;

/** Grow whichever style a character wears. */
export function growHair(g: Groom, style: AnyHairStyle): GrownHair {
    return style.kind === "quiff"
        ? growQuiff(g, style)
        : growPonytail(g, style);
}
