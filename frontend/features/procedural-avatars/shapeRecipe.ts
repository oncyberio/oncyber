import { drawJerseySleeve, type JerseySleeve } from "./jerseySleeve";
import { drawOrbVisor, type OrbVisor } from "./orbVisor";
import families from "./families.json";
import { drawMarkedShirt, type ShirtMark } from "./shirtMark";
import { garmentMapping, type PrintName, type PrintPath } from "./garmentPrint";
import * as T from "three/webgpu";
import {
    Drawing,
    frontOfLoft,
    level,
    lift,
    profileDepth,
    type Depth,
    type Section,
    type XY,
} from "./drawing";
import type { PanelJoin, Point } from "./sculpt";
import { avatarStyles, crewOpening, styleOf, type CrewNeck } from "./styles";
import { finish } from "./surfaces";
import { drawRoundedProfile, type RoundedSection } from "./roundedProfile";
export { roundedProfileRows, type RoundedSection } from "./roundedProfile";

type Paint = { color: string; finish: keyof typeof finish; ambient?: number };
export type Shape =
    | {
          profile: Section[];
          name?: string;
          neckline?: {
              kind: "crew";
              binding: string;
              interior: string;
              fit?: CrewNeck;
          };
          inseam?: { center: number; drop: number };
      }
    | { roundedProfile: RoundedSection[]; name?: string }
    | { across: Section[]; name?: string }
    | { oval: Point; radii: Point; tilt?: number; name?: string }
    | { from: Point; to: Point; radii: [number, number]; sides?: number }
    | { plate: XY[]; front: number; thickness: number }
    | { sweep: Point[]; widths: number[]; joints?: string[] }
    | { line: Point[]; width: number; flat?: boolean }
    | {
          decal: XY[];
          holes: XY[][];
          on: string | number;
          rear?: boolean;
          raise?: number;
      }
    | {
          stroke: XY[];
          on: string;
          rear?: boolean;
          raise?: number;
          width: number;
      }
    | {
          patch: XY[];
          center: XY;
          on: string | number;
          raise?: number;
          bulge: number;
          name?: string;
          back?: number;
          edge?: number;
      };
export interface ShapeRecipe {
    palette: Record<string, Paint>;
    parts: ({
        bone: string;
        sides?: number;
        caps?: "both" | "start" | "end" | "none";
        /** Rows of grayscale sRGB samples around the section, starting at its front. */
        tones?: number[][];
        paint: string;
        blend?: { with: string; from: number; to: number };
        gradient?: { top: number; bottom: number; from: string; to: string };
    } & Shape)[];
}
function sectionTone(
    sections: Section[],
    tones: number[][],
    horizontal: boolean
) {
    return (x: number, y: number, z: number) => {
        const along = horizontal ? x : y,
            across = horizontal ? y : x;
        let i = 1;
        while (i < sections.length - 1 && along > sections[i][0]) i++;
        const a = sections[i - 1],
            b = sections[i];
        const t = T.MathUtils.clamp((along - a[0]) / (b[0] - a[0]), 0, 1);
        const center = T.MathUtils.lerp(
            (a[1] + a[2]) / 2,
            (b[1] + b[2]) / 2,
            t
        );
        const width = T.MathUtils.lerp(a[2] - a[1], b[2] - b[1], t) / 2;
        const radius = T.MathUtils.lerp(a[3], b[3], t);
        const centerZ = T.MathUtils.lerp(a[4] ?? 0, b[4] ?? 0, t);
        const angle =
            Math.atan2(
                (across - center) / Math.max(0.1, width),
                (z - centerZ) / Math.max(0.1, radius)
            ) /
            (2 * Math.PI);
        const brightnessAt = (row: number[]) => {
            const u = ((angle + 1) % 1) * row.length,
                j = Math.floor(u);
            return T.MathUtils.lerp(row[j], row[(j + 1) % row.length], u - j);
        };
        return Math.pow(
            T.MathUtils.lerp(
                brightnessAt(tones[i - 1]),
                brightnessAt(tones[i]),
                t
            ) / 255,
            2.2
        );
    };
}
const trouserRing = (row: Section, sides: number): Point[] =>
    Array.from({ length: sides + 1 }, (_, i) => {
        const a = (i * Math.PI * 2) / sides;
        return [
            (row[1] + row[2]) / 2 + (row[2] - row[1]) * 0.5 * Math.sin(a),
            row[0],
            (row[4] ?? 0) + row[3] * Math.cos(a),
        ];
    });
/** The shared knee ring has identical positions and weights on the thigh
 * and shin. Its silhouette stays closed as the two bones rotate. */
export function trouserShin(
    d: Drawing,
    lower: Section[],
    thigh: string,
    shin: string,
    color: string,
    bend: number,
    sides = 16,
    join?: PanelJoin
) {
    const knee = lower[0][0],
        hem = lower.at(-1);
    d.drape(thigh, shin, knee, knee + bend);
    const cap: Point = [(hem[1] + hem[2]) / 2, hem[0], hem[4] ?? 0];
    const rings = lower.map((row) => trouserRing(row, sides));
    d.s.surface(
        [...rings, rings.at(-1).map(() => cap)],
        color,
        false,
        "start",
        undefined,
        join
    );
    return profileDepth(lower);
}
/** One side of a bifurcated garment. Its top boundary follows half of
 * the waist and the shared front-to-back saddle between the thighs. */
export function trouserLeg(
    d: Drawing,
    part: Extract<Shape, { profile: Section[] }> & { bone: string },
    color: string,
    joinKnee = false,
    sides = 16,
    detail?: (rings: Point[][]) => void,
    join?: PanelJoin
) {
    const {
        profile,
        inseam: { center, drop },
    } = part;
    const [y, lo, hi, depth, z = 0] = profile[0],
        sign = (lo + hi) / 2 < center ? -1 : 1;
    const span = Math.abs((sign < 0 ? lo : hi) - center);
    const top = trouserRing(profile[0], sides).map((_, i): Point => {
        const a = (i * Math.PI * 2) / sides,
            out = Math.sin(a) * sign;
        return [
            center + sign * span * Math.max(0, out),
            y + drop * Math.max(0, -out),
            z + depth * Math.cos(a),
        ];
    });
    const hem = profile.at(-1);
    const below = profile.findIndex((row) => row[0] > y + drop);
    if (below < 0) throw new Error("An inseam must end above the leg hem");
    d.drape("hips", part.bone, y, hem[0]);
    d.s.drape.weight = (x, py) => {
        const start = y + (drop + 1) * Math.exp(-(((x - center) / 18) ** 2));
        return T.MathUtils.smoothstep(py, start, start + 26);
    };
    d.s.preserveVertex = (x, py) =>
        Math.abs(x - center) < 0.001 && py <= y + drop + 0.01;
    const first = trouserRing(profile[below], sides);
    const transition = top.map(
        (v, i): Point => [
            T.MathUtils.lerp(v[0], first[i][0], 0.55),
            T.MathUtils.lerp(v[1], first[i][1], 0.34),
            T.MathUtils.lerp(v[2], first[i][2], 0.39),
        ]
    );
    const cap = first.map(
        (): Point => [(hem[1] + hem[2]) / 2, hem[0], hem[4] ?? 0]
    );
    const rows = [
        top,
        transition,
        ...profile.slice(below).map((row) => trouserRing(row, sides)),
        ...(joinKnee ? [] : [cap]),
    ];
    d.s.surface(
        rows,
        color,
        true,
        joinKnee ? "end" : undefined,
        undefined,
        join
    );
    d.s.preserveVertex = undefined;
    detail?.(rows);
    return profileDepth(profile);
}
export type GarmentPrints = Partial<Record<PrintName, PrintPath[]>>;
export interface OrbCollar {
    radius: number;
    drop: number;
    band: number;
    skin: string;
    binding: string;
}
/** Positions along each short leg, measured from the waist to its hem. */
export interface ShortsCut {
    rise: number;
    hemSpan: number;
}
function fitShortLeg(
    part: ShapeRecipe["parts"][number],
    cut?: ShortsCut,
    waistbandY?: number
): ShapeRecipe["parts"][number] {
    if (!cut || !("profile" in part) || !part.inseam) return part;
    const waist = part.profile[0],
        hem = part.profile.at(-1);
    const center = part.inseam.center;
    const side = (waist[1] + waist[2]) / 2 < center ? 1 : 2;
    const length = hem[0] - waist[0];
    // The visible rise includes the waistband above the leg panels.
    const top = waistbandY ?? waist[0];
    const forkY = T.MathUtils.lerp(top, hem[0], cut.rise);
    const flare = (waist[side] - center) * cut.hemSpan - (hem[side] - center);
    return {
        ...part,
        profile: part.profile.map((row) => {
            const fitted: Section = [...row];
            fitted[side] += (flare * (row[0] - waist[0])) / length;
            return fitted;
        }),
        inseam: {
            center,
            drop: T.MathUtils.clamp(forkY - waist[0], 1, length - 1),
        },
    };
}
export function drawShapeRecipe(
    d: Drawing,
    recipe: ShapeRecipe,
    prints?: GarmentPrints,
    shirtMark?: ShirtMark,
    sunRays?: XY[][],
    visor?: OrbVisor,
    orbCollar?: OrbCollar,
    shortsCut?: ShortsCut,
    jerseySleeve?: JerseySleeve
) {
    const finishes = Object.fromEntries(
        Object.values(recipe.palette).map((p) => [p.color, finish[p.finish]])
    );
    if (jerseySleeve) {
        // The source dye is absolute. Give it a separate paint key if its
        // swatch coincides with a recolorable template role such as skin.
        jerseySleeve = {
            ...jerseySleeve,
            bands: jerseySleeve.bands.map((band) => {
                const color = new T.Color(band.color).getStyle();
                finishes[color] = finish.cloth;
                return { ...band, color };
            }),
        };
    }
    d.s.palette(finishes);
    d.s.ambientByPaint = Object.fromEntries(
        Object.values(recipe.palette)
            .filter((p) => p.ambient !== undefined)
            .map((p) => [p.color, p.ambient])
    );
    const surfaces = new Map<string, Depth>();
    const backs = new Map<string, Depth>();
    let raysDrawn = false;
    const band =
        shortsCut &&
        recipe.parts.find((part) => "name" in part && part.name === "waist");
    const waistbandY =
        band && "profile" in band ? band.profile[0][0] : undefined;
    for (const source of recipe.parts) {
        const part = fitShortLeg(source, shortsCut, waistbandY);
        d.bind(part.bone);
        d.s.crown = part.bone === "head" && part.paint === "rays";
        d.s.printUV = undefined;
        if ("name" in part && ("profile" in part || "across" in part)) {
            const name = part.name as PrintName,
                paths = prints?.[name];
            // Measured shorts carry their own fork and hem. The stock kit's
            // printed seam follows the original cut.
            if (paths && !(shortsCut && "inseam" in part && part.inseam))
                d.s.printUV = garmentMapping(
                    name,
                    "across" in part ? part.across : part.profile,
                    "across" in part,
                    () => paths
                );
        }
        d.s.gradient = part.gradient;
        d.s.tone =
            part.tones && ("profile" in part || "across" in part)
                ? sectionTone(
                      "across" in part ? part.across : part.profile,
                      part.tones,
                      "across" in part
                  )
                : undefined;
        d.s.blend = part.blend;
        const pigment = recipe.palette[part.paint].color;
        if (
            jerseySleeve &&
            "across" in part &&
            part.name?.endsWith("UpperArmSleeve")
        ) {
            drawJerseySleeve(d, part.bone, jerseySleeve, pigment);
            continue;
        }
        if (
            visor &&
            part.bone === "head" &&
            (part.paint === "black" || part.paint === "white")
        ) {
            if ("plate" in part)
                drawOrbVisor(
                    d,
                    visor,
                    recipe.palette.black.color,
                    recipe.palette.white.color
                );
            continue;
        }
        if (d.s.crown && sunRays) {
            if (!raysDrawn) {
                const [cx, cy, rx, ry] = families.sunshine.crownRoot;
                const facets: Point[] = [];
                for (const ray of sunRays) {
                    const rim = ray.map(
                        ([u, v]): Point => [cx + u * rx, cy + v * ry, -2]
                    );
                    const x = rim.reduce((sum, p) => sum + p[0], 0) / 3;
                    const y = rim.reduce((sum, p) => sum + p[1], 0) / 3;
                    const thickness = Math.min(
                        3,
                        0.17 *
                            Math.max(
                                ...rim.map((p) =>
                                    Math.hypot(p[0] - x, p[1] - y)
                                )
                            )
                    );
                    for (let i = 0; i < 3; i++) {
                        const a = rim[i],
                            b = rim[(i + 1) % 3];
                        facets.push(a, b, [x, y, -2 + thickness], b, a, [
                            x,
                            y,
                            -2 - thickness,
                        ]);
                    }
                }
                d.s.triangles(facets, pigment);
                raysDrawn = true;
            }
            continue;
        }
        let surface: Depth;
        if ("roundedProfile" in part) {
            const mesh = drawRoundedProfile(
                d,
                part.roundedProfile,
                pigment,
                part.sides,
                part.caps
            );
            // Both attachment surfaces use the same retained triangles as the skin.
            surface = frontOfLoft(mesh);
            if (part.name) {
                const back = frontOfLoft(
                    mesh.map((row) => row.map(([x, y, z]): Point => [x, y, -z]))
                );
                backs.set(part.name, (x, y) => -back(x, y));
            }
        } else if ("profile" in part) {
            const [cx, , rx] = families.sunshine.crownRoot;
            const first = part.profile[0];
            const inset = part.name === "jersey" && orbCollar;
            const neckline = part.neckline && {
                ...(part.neckline.fit ?? avatarStyles[styleOf[d.id]].neckline),
                ...(inset && {
                    width: (2.45 * inset.radius * rx) / (first[2] - first[1]),
                    frontDrop: inset.drop * rx,
                }),
            };
            surface = part.inseam
                ? trouserLeg(d, part, pigment)
                : d.body(
                      part.profile,
                      pigment,
                      false,
                      part.sides,
                      part.caps,
                      0,
                      part.neckline && {
                          neckline,
                          binding: inset
                              ? inset.binding
                              : recipe.palette[part.neckline.binding].color,
                          interior:
                              recipe.palette[part.neckline.interior].color,
                          bandWidth: inset ? inset.band * rx : undefined,
                      },
                      shirtMark && part.name === "jersey"
                          ? (emit) => drawMarkedShirt(d, shirtMark, emit)
                          : undefined
                  );
            if (inset && neckline) {
                const count = part.sides ?? 28;
                const rim = crewOpening(first, neckline, count);
                const radius = inset.radius * rx;
                const tube = (y: number, scale: number): Point[] =>
                    rim.map((_, j) => {
                        const a = ((j % count) * 2 * Math.PI) / count;
                        return [
                            cx + radius * scale * Math.sin(a),
                            y,
                            (first[4] ?? 0) +
                                radius * scale * 0.78 * Math.cos(a),
                        ];
                    });
                // Blend the visible throat into the animated opening. Its
                // lower edge shares the crew rim exactly in the rest pose.
                const bottom = first[0];
                const top = bottom - 0.53 * rx;
                const tone = d.s.tone,
                    uv = d.s.printUV;
                d.s.printUV = undefined;
                d.drape("neck", part.bone, top, bottom);
                d.s.tone = (_, y) =>
                    0.78 +
                    0.22 *
                        T.MathUtils.smoothstep(
                            y,
                            bottom - 0.13 * rx,
                            bottom + neckline.frontDrop
                        );
                d.s.surface(
                    [
                        tube(top, 0),
                        tube(top, 0.95),
                        tube(bottom - 0.05 * rx, 1),
                        rim,
                    ],
                    inset.skin,
                    true
                );
                d.bind(part.bone);
                d.s.tone = tone;
                d.s.printUV = uv;
            }
            if (part.name) backs.set(part.name, profileDepth(part.profile, -1));
        } else if ("across" in part) {
            let sections = part.across;
            if (
                jerseySleeve &&
                part.bone.endsWith("UpperArm") &&
                part.paint === "pink"
            ) {
                // Keep the upper arm inside a short opening through motion.
                const center = d.sourceJoints.get("upperChest").point[0];
                const left = part.bone === "leftUpperArm";
                const elbow = left ? sections.at(-1) : sections[0];
                const middle = (elbow[1] + elbow[2]) * 0.5;
                const radius = (elbow[2] - elbow[1]) * 0.5;
                const [top, bottom] = jerseySleeve.armhole ?? [-1, 1];
                const arm: Section = [
                    center + (left ? 1 : -1) * jerseySleeve.span,
                    middle + radius * top,
                    middle + radius * bottom,
                    elbow[3] * (bottom - top) * 0.5,
                    elbow[4],
                ];
                const inner: Section = [...arm];
                // The arm starts just inside the slanted cuff, on the
                // fully arm-weighted rings. Extending it into the shoulder
                // lets the hidden skin pierce the blended cloth in a crouch.
                inner[0] =
                    center +
                    (1 - Math.abs(jerseySleeve.tilt) - 0.045) *
                        (arm[0] - center);
                sections = left ? [inner, arm, elbow] : [elbow, arm, inner];
            }
            if (part.name) {
                const front = profileDepth(sections),
                    back = profileDepth(sections, -1);
                surface = (x, y) => front(y, x);
                backs.set(part.name, (x, y) => back(y, x));
            }
            const count = part.sides ?? 24;
            const rows = sections.map(([x, top, bottom, depth, z = 0]) =>
                Array.from({ length: count + 1 }, (_, i): Point => {
                    const a = (2 * i * Math.PI) / count;
                    return [
                        x,
                        (top + bottom) / 2 + (bottom - top) * 0.5 * Math.sin(a),
                        z + depth * Math.cos(a),
                    ];
                })
            );
            const cap = (s: Section) =>
                Array.from(
                    { length: count + 1 },
                    (): Point => [s[0], (s[1] + s[2]) / 2, s[4] ?? 0]
                );
            d.s.surface(
                [
                    ...(!part.caps ||
                    part.caps === "both" ||
                    part.caps === "start"
                        ? [cap(sections[0])]
                        : []),
                    ...rows,
                    ...(!part.caps ||
                    part.caps === "both" ||
                    part.caps === "end"
                        ? [cap(sections[sections.length - 1])]
                        : []),
                ].reverse(),
                pigment
            );
        } else if ("oval" in part) {
            d.s.orbSurface = !!visor && part.name === "skull";
            d.s.fineDetail = d.s.orbSurface;
            d.s.oval(
                part.oval,
                part.radii,
                pigment,
                part.tilt,
                d.s.orbSurface ? 22 : 0
            );
            d.s.fineDetail = false;
            d.s.orbSurface = false;
            const [x, y, z] = part.oval,
                [rx, ry, rz] = part.radii;
            surface = (px, py) =>
                z +
                rz *
                    Math.sqrt(
                        Math.max(
                            0,
                            1 - ((px - x) / rx) ** 2 - ((py - y) / ry) ** 2
                        )
                    );
        } else if ("plate" in part) {
            d.decal(part.plate, level(part.front), pigment);
            const edge = [...part.plate, part.plate[0]];
            d.s.surface(
                [part.front, part.front - part.thickness].map((z) =>
                    edge.map(([x, y]): Point => [x, y, z])
                ),
                pigment,
                true
            );
        } else if ("sweep" in part)
            d.s.sweep(
                part.sweep,
                part.widths,
                pigment,
                part.sides ?? (d.s.detail === "crowd" ? 4 : 5),
                part.joints
            );
        else if ("from" in part)
            d.s.tube(part.from, part.to, ...part.radii, pigment, part.sides);
        else if ("line" in part) {
            if (part.flat) d.s.ribbon(part.line, part.width, pigment);
            else d.s.line(part.line, part.width, pigment);
        } else {
            const rear = "rear" in part && part.rear;
            const base =
                typeof part.on === "number"
                    ? level(part.on)
                    : (rear ? backs : surfaces).get(part.on);
            if (!base) throw Error("Unknown shape surface " + part.on);
            const depth = lift(base, (rear ? -1 : 1) * (part.raise ?? 0));
            if ("decal" in part) {
                d.decal(part.decal, depth, pigment, part.holes);
            } else if ("stroke" in part)
                d.stroke(part.stroke, depth, part.width, pigment);
            else
                surface = d.patch(
                    part.patch,
                    part.center,
                    depth,
                    part.bulge,
                    pigment,
                    { back: part.back, edge: part.edge, sharp: true }
                );
        }
        if (surface && "name" in part && part.name)
            surfaces.set(part.name, surface);
    }
    d.s.crown = false;
}
