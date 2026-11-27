import * as THREE from "three/webgpu";
import {
    attribute,
    cameraPosition,
    dot,
    float as f32,
    fract,
    max,
    mix,
    mx_noise_float,
    normalWorld,
    normalize,
    positionGeometry,
    positionWorld,
    pow,
    reflect,
    saturate,
    smoothstep,
    sqrt,
    tangentWorld,
    uv,
    vec3,
    vertexColor,
} from "three/tsl";

/**
 * The "studio" look: procedural shaders that light the avatar themselves,
 * from colour and shading inputs stored on the vertices. No textures.
 *
 * Each surface follows a published real-time model, simplified to one key
 * light, a cool fill, a warm back light and a sky/ground ambient:
 *
 * - Skin: wrap lighting with a wider wrap for red than for blue, so the
 *   shadow edge warms as light scatters under the surface (the idea behind
 *   pre-integrated skin shading, Penner 2011), plus light glowing through
 *   thin parts from a baked local thickness (Barré-Brisebois and Bouchard,
 *   GDC 2011).
 * - Hair: Kajiya-Kay strand lighting with two highlights shifted along the
 *   strand, a sharp white one towards the tip and a broad tinted, sparkling
 *   one towards the root (Scheuermann 2004, after Marschner et al. 2003).
 * - Cloth: a soft two-tone shade with tinted shadows and a brushed edge,
 *   and a grazing-angle sheen in the spirit of the "Charlie" sheen lobe
 *   (Estevez and Kulla 2017).
 * - Polished things: a tight highlight plus a sky-to-ground reflection that
 *   strengthens at grazing angles (Schlick's Fresnel).
 */
export type Colour3 = [number, number, number];

export type StudioSurface =
    | {
          surface: "skin";
          scatter: number;
          /** Lips, drawn per pixel on the head (reference head space). */
          lips?: {
              /** The head joint and scale that place the reference head. */
              joint: Colour3;
              origin: Colour3;
              scale: number;
              y: number;
              z: number;
              width: number;
              fullness: number;
              /** Colour of the lips and of the line between them, over skin. */
              tint: Colour3;
              line: Colour3;
          };
      }
    | {
          surface: "cloth";
          /** Colour the cloth takes in shade, as a multiplier. */
          shadow: Colour3;
          sheen: number;
          rim: number;
          /** Strength of the fine speckle of the weave. */
          grain: number;
          /** Unevenness of the shadow edge, like a brush stroke. */
          brush: number;
          /** Diagonal stripes over the cloth, laid out by its UVs. */
          stripes?: { colour: Colour3; paired: boolean };
      }
    | { surface: "hair"; sheen: Colour3; glint: number }
    | { surface: "eye"; iris: Colour3; irisLight: Colour3; white: Colour3 }
    | {
          surface: "gloss";
          /** Highlight strength and tightness, and how much sky it mirrors. */
          spec: number;
          tight: number;
          mirror: number;
      };

const KEY = vec3(0.47, 0.72, 0.51);
const FILL = vec3(-0.78, 0.28, 0.56);
const BACK = vec3(-0.27, 0.48, -0.83);
const KEY_COLOUR = vec3(1.0, 0.965, 0.92);
const FILL_COLOUR = vec3(0.74, 0.82, 1.0);
const RIM_COLOUR = vec3(1.0, 0.78, 0.6);
const SKY = vec3(0.6, 0.66, 0.8);
const GROUND = vec3(0.4, 0.33, 0.3);

function inputs() {
    const N = normalize(normalWorld);
    const V = normalize(cameraPosition.sub(positionWorld));
    const aux = attribute("aux", "vec4");
    const ndl = dot(N, KEY);
    const ndv = saturate(dot(N, V));
    const H = normalize(KEY.add(V));
    return {
        N,
        V,
        H,
        ndl,
        ndv,
        albedo: vertexColor().rgb,
        open: aux.x,
        thickness: aux.y,
        free: aux.z,
        gloss: aux.w,
        // Sky above, ground bounce below.
        ambient: mix(GROUND, SKY, N.y.mul(0.5).add(0.5)),
        fill: saturate(dot(N, FILL).mul(0.5).add(0.5)),
        back: saturate(dot(N, BACK).mul(0.65).add(0.35)),
        fresnel: pow(f32(1).sub(ndv), 4),
    };
}

function skin(options: Extract<StudioSurface, { surface: "skin" }>) {
    const s = inputs();
    const scatter = options.scatter;
    let albedo = s.albedo;
    if (options.lips) {
        // Painted with maths, per pixel: two lobes for the upper lip, one
        // for the lower, and the line where they meet, turned down a little
        // at the corners.
        const l = options.lips;
        const h = positionGeometry
            .sub(vec3(...l.joint))
            .div(l.scale)
            .add(vec3(...l.origin));
        const x = h.x.abs();
        const w = l.width / 0.0165;
        const lobe = (cx: number, cy: number, rx: number, ry: number) => {
            const dx = x.sub(cx).div(rx);
            const dy = h.y.sub(cy).div(ry);
            return f32(1).sub(
                smoothstep(0.7, 1.08, dx.mul(dx).add(dy.mul(dy)))
            );
        };
        const upper = lobe(
            0.005 * w,
            l.y + 0.0031 * l.fullness,
            0.0102 * w,
            0.0036 * l.fullness
        );
        const lower = lobe(
            0,
            l.y - 0.0038 * l.fullness,
            0.0118 * w,
            0.0044 * l.fullness
        );
        const front = smoothstep(l.z - 0.022, l.z - 0.012, h.z);
        const corner = smoothstep(l.width + 0.0015, l.width - 0.0035, x);
        const mask = max(upper, lower.mul(0.85)).mul(front).mul(corner);
        const sag = x.div(l.width).mul(x.div(l.width)).mul(0.0011);
        const line = f32(1)
            .sub(
                smoothstep(
                    0.00028,
                    0.00085,
                    h.y.sub(f32(l.y - 0.0002).sub(sag)).abs()
                )
            )
            .mul(front)
            .mul(smoothstep(l.width + 0.001, l.width - 0.0015, x));
        albedo = albedo
            .mul(mix(vec3(1), vec3(...l.tint), mask))
            .mul(mix(vec3(1), vec3(...l.line), line.mul(0.85)));
    }
    // Red travels furthest under skin, blue least: three wraps.
    const wrap = vec3(0.6, 0.3, 0.2).mul(scatter);
    const lit = saturate(vec3(s.ndl).add(wrap).div(wrap.add(1)));
    const key = lit.mul(lit.mul(-2).add(3)).mul(lit).mul(KEY_COLOUR).mul(0.8);
    // Creases fill with warm, not grey, shadow.
    const occlusion = mix(vec3(0.78, 0.42, 0.36), vec3(1), s.open);
    const light = key
        .mul(mix(0.55, 1, s.open))
        .add(FILL_COLOUR.mul(s.fill).mul(0.2))
        .add(s.ambient.mul(0.36).mul(occlusion));
    // Light through thin parts: ears, nostrils, the edges of fingers.
    const through = pow(
        saturate(dot(s.V, normalize(KEY.add(s.N.mul(0.4))).negate())),
        3
    )
        .add(saturate(dot(s.N.negate(), KEY)).mul(0.35))
        .mul(f32(1).sub(s.thickness))
        .mul(vec3(1.0, 0.28, 0.18))
        .mul(0.85);
    const nh = saturate(dot(s.N, s.H));
    const shine = pow(nh, 70)
        .mul(0.16)
        .add(pow(nh, 14).mul(0.045))
        .mul(saturate(s.ndl.mul(3).add(0.4)))
        .mul(s.open);
    const rim = s.fresnel.mul(s.back).mul(RIM_COLOUR).mul(0.42).mul(s.open);
    return albedo.mul(light.add(through)).add(shine).add(rim);
}

function cloth(options: Extract<StudioSurface, { surface: "cloth" }>) {
    const s = inputs();
    let albedo = s.albedo;
    if (options.stripes) {
        const t = fract(uv().x.add(uv().y));
        const line = (centre: number, half: number) =>
            smoothstep(half + 0.012, half, t.sub(centre).abs());
        const amount = options.stripes.paired
            ? max(line(0.42, 0.045), line(0.62, 0.045))
            : line(0.5, 0.1);
        albedo = mix(albedo, vec3(...options.stripes.colour), amount);
    }
    const where = positionGeometry;
    if (options.grain > 0)
        albedo = albedo.mul(
            mx_noise_float(where.mul(1500)).mul(options.grain).add(1)
        );
    // Two soft tones, their boundary pushed about like a brush stroke.
    const stroke = mx_noise_float(where.mul(vec3(34, 13, 34))).mul(
        options.brush
    );
    const tone = smoothstep(0.3, 0.62, s.ndl.mul(0.5).add(0.5).add(stroke));
    const shade = vec3(...options.shadow);
    const folds = smoothstep(0.15, 0.95, s.open);
    const light = mix(shade.mul(0.6), KEY_COLOUR, tone.mul(mix(0.45, 1, folds)))
        .mul(0.78)
        .add(FILL_COLOUR.mul(s.fill).mul(0.14))
        .add(s.ambient.mul(0.3).mul(mix(shade, vec3(1), folds)));
    const sheen = pow(f32(1).sub(s.ndv), 3)
        .mul(options.sheen)
        .mul(tone.mul(0.6).add(0.4))
        .mul(folds);
    const rim = s.fresnel.mul(s.back).mul(RIM_COLOUR).mul(options.rim);
    return albedo.mul(light.add(sheen)).add(rim.mul(folds));
}

function hair(options: Extract<StudioSurface, { surface: "hair" }>) {
    const s = inputs();
    const T = normalize(tangentWorld);
    const where = positionGeometry;
    // Each lock carries its own offset, and each strand ridge on it a
    // little more, so the highlight breaks up along the strands.
    // Strands: a value that changes across the lock and holds along it,
    // from the across/along coordinates stored in the UVs. It tints each
    // strand, slides its highlight, and makes some glossier than others.
    const across = uv().x;
    const fine = mx_noise_float(vec3(across.mul(1500), uv().y.mul(2.5), 0.5));
    const broad = mx_noise_float(vec3(across.mul(330), uv().y.mul(1.2), 3.7));
    const fibre = fine.mul(0.6).add(broad.mul(0.4)).mul(s.gloss);
    const shift = s.free.mul(0.1).add(fibre.mul(0.16));
    const strand = (offset: number, exponent: number, towards: typeof s.H) => {
        const t = normalize(T.add(s.N.mul(shift.add(offset))));
        const along = dot(t, towards);
        return pow(sqrt(max(f32(1).sub(along.mul(along)), 0)), exponent).mul(
            smoothstep(-1, 0, along)
        );
    };
    const backH = normalize(BACK.add(s.V));
    const glossy = smoothstep(-0.2, 0.6, fibre);
    const primary = strand(0.1, 110, s.H).mul(glossy.mul(0.7).add(0.3));
    const secondary = strand(-0.18, 30, s.H).mul(glossy);
    const behind = strand(0.05, 60, backH).mul(glossy.mul(0.6).add(0.4));
    const tl = dot(T, KEY);
    const diffuse = mix(
        sqrt(max(f32(1).sub(tl.mul(tl)), 0)),
        saturate(s.ndl.mul(0.6).add(0.4)),
        0.55
    );
    const light = KEY_COLOUR.mul(diffuse)
        .mul(0.72)
        .mul(mix(0.3, 1, s.open))
        .add(s.ambient.mul(0.34).mul(mix(0.25, 1, s.open)))
        .add(FILL_COLOUR.mul(s.fill).mul(0.12));
    const lit = saturate(s.ndl.mul(1.5).add(0.5)).mul(s.open);
    const sheen = vec3(...options.sheen);
    return s.albedo
        .mul(fibre.mul(0.45).add(1))
        .mul(light)
        .add(vec3(0.95, 0.92, 0.88).mul(primary).mul(options.glint).mul(lit))
        .add(sheen.mul(secondary).mul(lit).mul(0.42))
        .add(RIM_COLOUR.mul(behind).mul(0.12).mul(s.open))
        .add(s.fresnel.mul(s.back).mul(sheen).mul(0.14).mul(s.open));
}

function eye(options: Extract<StudioSurface, { surface: "eye" }>) {
    const s = inputs();
    // The iris is drawn, not modelled: distance from the pupil's centre in
    // iris radii comes in through the UVs.
    const at = uv();
    const r = at.length();
    const dir = at.div(max(r, 0.001));
    // Fibres run outwards from the pupil; a lighter crescent sits low.
    const fibres = mx_noise_float(vec3(dir.x.mul(7), dir.y.mul(7), r.mul(1.5)));
    const tone = smoothstep(0.42, 0.95, r)
        .mul(0.45)
        .add(fibres.mul(0.22))
        .add(
            smoothstep(0.1, -0.9, dir.y).mul(0.4).mul(smoothstep(0.45, 0.8, r))
        );
    const iris = mix(
        vec3(...options.iris),
        vec3(...options.irisLight),
        saturate(tone)
    )
        // The dark ring where iris meets white.
        .mul(f32(1).sub(smoothstep(0.78, 1, r).mul(0.8)));
    const pupil = smoothstep(0.46, 0.41, r);
    const coloured = mix(iris, vec3(0.012, 0.009, 0.008), pupil);
    const white = vec3(...options.white).mul(
        f32(1).sub(smoothstep(1, 4.5, r).mul(0.3))
    );
    const albedo = mix(coloured, white, smoothstep(0.985, 1.03, r));
    // Evenly lit, like a painted eye, with a wet highlight on top.
    const light = saturate(s.ndl.mul(0.25).add(0.75)).mul(0.92);
    const nh = saturate(dot(s.N, s.H));
    const fillH = normalize(FILL.add(s.V));
    const glint = pow(nh, 320)
        .mul(1.4)
        .add(pow(saturate(dot(s.N, fillH)), 200).mul(0.35));
    return albedo.mul(light).mul(mix(0.55, 1, s.open)).add(glint);
}

function gloss(options: Extract<StudioSurface, { surface: "gloss" }>) {
    const s = inputs();
    const diffuse = saturate(s.ndl.mul(0.6).add(0.4));
    const light = KEY_COLOUR.mul(diffuse)
        .mul(0.74)
        .add(FILL_COLOUR.mul(s.fill).mul(0.16))
        .add(s.ambient.mul(0.34))
        .mul(mix(0.35, 1, s.open));
    const nh = saturate(dot(s.N, s.H));
    const R = reflect(s.V.negate(), s.N);
    const schlick = pow(f32(1).sub(s.ndv), 5).mul(0.94).add(0.06);
    const mirrored = mix(GROUND, SKY.mul(1.25), smoothstep(-0.25, 0.5, R.y))
        .mul(schlick)
        .mul(options.mirror);
    const highlight = pow(nh, options.tight)
        .mul(options.spec)
        .add(pow(saturate(dot(R, BACK)), 24).mul(options.spec * 0.35))
        .mul(saturate(s.ndl.mul(2).add(0.6)));
    return s.albedo
        .mul(light)
        .add(mirrored.add(highlight).mul(mix(0.3, 1, s.open)).mul(s.gloss));
}

/** A self-lit, texture-free material for one studio surface. */
export function createStudioMaterial(options: StudioSurface): THREE.Material {
    const material = new THREE.MeshBasicNodeMaterial();
    material.colorNode =
        options.surface === "skin"
            ? skin(options)
            : options.surface === "cloth"
            ? cloth(options)
            : options.surface === "hair"
            ? hair(options)
            : options.surface === "eye"
            ? eye(options)
            : gloss(options);
    return material;
}
