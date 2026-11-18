import { BackSide, Color, Vector4 } from "three";
import { MeshBasicNodeMaterial } from "three/webgpu";
import {
    Fn,
    abs,
    atan,
    attribute,
    cameraProjectionMatrix,
    clamp,
    cos,
    dot,
    float as tslFloat,
    fract,
    fwidth,
    length,
    max,
    min,
    mix,
    modelViewMatrix,
    normalLocal,
    normalView,
    positionLocal,
    screenCoordinate,
    screenSize,
    sin,
    smoothstep,
    sqrt,
    step,
    uniform,
    vec2,
    vec3,
    vec4,
} from "three/tsl";
import {
    NEUTRAL_EXPRESSION,
    type ToonExpression,
    type ToonFaceParams,
} from "../face";

type Node = any;

/** Ink line weight limits, as fractions of the picture's height. */
const LINE_MIN = 0.002;
const LINE_MAX = 0.0042;

const VEC4_KEYS = [
    "eye",
    "pupil",
    "eyeStyle",
    "lash",
    "brow",
    "browShape",
    "mouth",
    "mouthOpen",
    "mouthStyle",
    "marks",
    "head",
    "mustache",
    "chinHair",
    "beard",
    "skull",
] as const;
const COLOR_KEYS = [
    "skin",
    "ink",
    "browColor",
    "lipColor",
    "facialColor",
] as const;

// Fixed colours go in as uniforms: the simplest way to hand TSL an sRGB hex.
const MOUTH_DARK: Node = uniform(new Color("#6e1a26"));
const TONGUE: Node = uniform(new Color("#e2707c"));
const BLUSH: Node = uniform(new Color("#ff6b7d"));

/**
 * Uniforms shared by an avatar's fill and ink materials. Every avatar uses
 * the same two shader programs; only these values differ.
 */
export function createToonUniforms() {
    const vectors = Object.fromEntries(
        VEC4_KEYS.map((key) => [key, uniform(new Vector4())])
    ) as Record<(typeof VEC4_KEYS)[number], Node>;
    const colors = Object.fromEntries(
        COLOR_KEYS.map((key) => [key, uniform(new Color())])
    ) as Record<(typeof COLOR_KEYS)[number], Node>;
    return {
        ...vectors,
        ...colors,
        /** blink left, blink right, look x, look y */
        gaze: uniform(new Vector4()),
        /** talk, smile, brows, 0 */
        mood: uniform(new Vector4()),
        /** Ink hull width in metres. */
        inkWidth: uniform(0.008),
        /** 0 flat colour, 1 strongest cel shadow. */
        shade: uniform(0.35),
        /** Multiplies the final colour: lets a scene dim its avatars. */
        tint: uniform(new Color(1, 1, 1)),
    };
}

export type ToonUniforms = ReturnType<typeof createToonUniforms>;

export function applyFaceParams(
    uniforms: ToonUniforms,
    params: ToonFaceParams
) {
    for (const key of VEC4_KEYS) {
        const [x = 0, y = 0, z = 0, w = 0] = params[key];
        uniforms[key].value.set(x, y, z, w);
    }
    // Colours are authored in sRGB; Color.set converts to linear working space.
    for (const key of COLOR_KEYS) uniforms[key].value.set(params[key]);
}

export function applyExpression(
    uniforms: ToonUniforms,
    expression: Partial<ToonExpression>
) {
    const e = { ...NEUTRAL_EXPRESSION, ...expression };
    uniforms.gaze.value.set(e.blinkLeft, e.blinkRight, e.lookX, e.lookY);
    uniforms.mood.value.set(e.talk, e.smile, e.brows, 0);
}

/** 1 inside a stroke of half-width `half` around distance 0, antialiased. */
const stroke = (distance: Node, half: Node, aa: Node) =>
    tslFloat(1).sub(smoothstep(half.sub(aa), half.add(aa), distance));
/** 1 where a signed distance is negative, antialiased. */
const fill = (signedDistance: Node, aa: Node) =>
    tslFloat(1).sub(smoothstep(aa.negate(), aa, signedDistance));
const segment = (p: Node, a: Node, b: Node) => {
    const pa = p.sub(a);
    const ba = b.sub(a);
    const h = clamp(dot(pa, ba).div(dot(ba, ba)), 0, 1);
    return length(pa.sub(ba.mul(h)));
};

function paintFace(
    u: ToonUniforms,
    base: Node,
    p: Node,
    aa: Node,
    line: Node
): Node {
    return Fn(() => {
        const color = vec3(base).toVar();
        const ink = vec3(u.ink);
        const half = line.mul(0.5);
        const ax = abs(p.x);
        const mirrored = vec2(ax, p.y);
        const eyeCenter = vec2(u.eye.x, u.eye.y);
        const eyeRadius = u.eye.z;
        const mouthY = u.mouth.x;
        const mouthHalf = u.mouth.y;

        // Stubble: a flat shadow over the jaw.
        const jawLine = mouthY.add(0.2).add(ax.mul(ax).mul(0.55));
        color.assign(
            mix(
                color,
                vec3(u.facialColor),
                fill(p.y.sub(jawLine), aa).mul(u.marks.w).mul(0.3)
            )
        );

        // Blush.
        const cheek = vec2(
            u.eye.x.add(eyeRadius.mul(0.35)),
            u.eye.y.sub(eyeRadius.mul(u.eye.w)).sub(0.13)
        );
        const blush = length(mirrored.sub(cheek).div(vec2(0.17, 0.1))).sub(1);
        color.assign(
            mix(
                color,
                vec3(BLUSH),
                fill(blush.mul(0.1), aa).mul(u.marks.x).mul(0.7)
            )
        );

        // Freckles: one dot per cell, nudged by a hash, across the cheeks.
        const cell = mirrored.sub(cheek).div(0.075);
        const id = cell.floor();
        const jitter = fract(
            sin(dot(id, vec2(12.9898, 78.233))).mul(43758.5453)
        );
        const dotAt = cell.fract().sub(vec2(0.3).add(jitter.mul(0.4)));
        const within = fill(
            length(mirrored.sub(cheek).div(vec2(0.3, 0.14)))
                .sub(1)
                .mul(0.1),
            aa
        );
        const freckle = fill(length(dotAt).mul(0.075).sub(0.017), aa)
            .mul(within)
            .mul(step(0.25, jitter));
        color.assign(mix(color, color.mul(0.62), freckle.mul(u.marks.y)));

        // Facial hair: the nearest enabled shape, filled then inked.
        const far = tslFloat(100);
        const mustacheT = clamp(ax.div(u.mustache.y), 0, 1);
        const mustacheY = u.beard.z
            .add(u.mustache.w.mul(mustacheT).mul(mustacheT))
            .sub(mustacheT.mul(0.03));
        const mustache = length(
            vec2(ax.sub(mustacheT.mul(u.mustache.y)), p.y.sub(mustacheY))
        )
            .sub(u.mustache.z.mul(tslFloat(1).sub(mustacheT.mul(0.75))))
            .add(far.mul(tslFloat(1).sub(u.mustache.x)));
        const chin = length(
            vec2(p.x, p.y.sub(u.chinHair.y)).div(
                vec2(u.chinHair.z, u.chinHair.w)
            )
        )
            .sub(1)
            .mul(min(u.chinHair.z, u.chinHair.w))
            .add(far.mul(tslFloat(1).sub(u.chinHair.x)));
        // Beard edge: from the upper lip, sweeping up toward the ears.
        const beardTop = u.beard.z.add(0.03).add(ax.mul(ax).mul(0.62));
        const beard = p.y
            .sub(beardTop)
            .add(far.mul(tslFloat(1).sub(u.beard.x)));
        // Chinstrap: a band just inside the jaw's outline, below the ears.
        const drop = clamp(p.y.negate().div(u.head.z), 0, 1);
        const cheekBand = drop.sub(0.42).div(0.3);
        const widthHere = u.head.y.mul(
            tslFloat(1)
                .sub(u.skull.y.mul(drop.pow(1.6)))
                .add(u.skull.z.mul(cheekBand.mul(cheekBand).negate().exp()))
        );
        const outline = ax
            .div(widthHere)
            .pow(u.skull.x)
            .add(drop.pow(u.skull.x))
            .pow(u.skull.x.reciprocal());
        const strap = max(
            tslFloat(0.8).sub(outline).mul(0.8),
            p.y.sub(u.eye.y).add(0.05)
        ).add(far.mul(tslFloat(1).sub(u.beard.y)));
        const hairShape = min(min(mustache, chin), min(beard, strap));
        color.assign(mix(color, vec3(u.facialColor), fill(hairShape, aa)));
        color.assign(mix(color, ink, stroke(abs(hairShape), half, aa)));

        // Forehead lines.
        const lines = u.marks.z;
        for (let i = 0; i < 3; i++) {
            const y = u.brow.z.add(0.13 + i * 0.085).add(ax.mul(ax).mul(-0.12));
            const reach = 0.3 - i * 0.05;
            const d = length(vec2(max(ax.sub(reach), 0), p.y.sub(y)));
            color.assign(
                mix(
                    color,
                    ink,
                    stroke(d, half.mul(0.7), aa).mul(step(i + 0.5, lines))
                )
            );
        }

        // Under-eye lines and lashes, in eye radii around each eye.
        const e = mirrored.sub(eyeCenter).div(eyeRadius);
        const rim = length(e.div(vec2(1, u.eye.w)));
        const below = smoothstep(
            -0.45,
            -0.75,
            e.y.div(u.eye.w).div(max(rim, 0.001))
        );
        const bag = stroke(
            abs(rim.sub(1.2)).mul(eyeRadius),
            half.mul(0.7),
            aa
        ).mul(below);
        color.assign(
            mix(
                color,
                ink,
                bag
                    .mul(step(0.01, u.eyeStyle.z))
                    .mul(clamp(u.eyeStyle.z.mul(3), 0, 1))
            )
        );
        const lashCount = u.eyeStyle.w;
        for (let i = 0; i < 3; i++) {
            // Fan out from the outer corner; a wing is one long low stroke.
            const angle = mix(
                tslFloat(0.55 + i * 0.36),
                tslFloat(0.3),
                u.lash.y
            );
            const direction = vec2(cos(angle), sin(angle).mul(u.eye.w));
            const d = segment(
                e,
                direction.mul(0.98),
                direction.mul(u.lash.x.add(1))
            ).mul(eyeRadius);
            color.assign(
                mix(
                    color,
                    ink,
                    stroke(d, half.mul(0.8), aa).mul(step(i + 0.5, lashCount))
                )
            );
        }

        // Brows.
        const browMid = u.brow.x.add(u.brow.y).mul(0.5);
        const browHalf = max(u.brow.y.sub(u.brow.x).mul(0.5), 0.001);
        const bt = clamp(ax.sub(browMid).div(browHalf), -1, 1);
        const browY = u.brow.z
            .add(u.mood.z.mul(0.09))
            .add(u.browShape.x.mul(bt))
            .add(u.browShape.y.mul(tslFloat(1).sub(bt.mul(bt))));
        const browD = length(
            vec2(ax.sub(browMid.add(bt.mul(browHalf))), p.y.sub(browY))
        );
        color.assign(
            mix(
                color,
                vec3(u.browColor),
                stroke(browD, u.brow.w, aa).mul(u.browShape.z)
            )
        );

        // Beauty mark.
        const mole = length(
            p.sub(vec2(u.eye.x.add(0.14), mouthY.add(0.17)))
        ).sub(0.024);
        color.assign(mix(color, ink, fill(mole, aa).mul(u.head.x)));

        // Mouth: two curves that share their corners. Closed, they are one line.
        const t = p.x.div(mouthHalf);
        const tc = clamp(t, -1, 1);
        const bendAmount = u.mouth.z.add(u.mood.y.mul(0.12));
        const wave = u.mouthOpen.x;
        const centerY = mouthY
            .add(bendAmount.mul(tc.mul(tc).sub(0.5)))
            .add(u.mouth.w.mul(tc).mul(0.5))
            .add(wave.mul(sin(tc.mul(7.85))));
        const slope = bendAmount
            .mul(2)
            .mul(tc)
            .add(u.mouth.w.mul(0.5))
            .add(wave.mul(7.85).mul(cos(tc.mul(7.85))))
            .div(mouthHalf);
        const straighten = sqrt(slope.mul(slope).add(1)).reciprocal();
        const arch = sqrt(max(tslFloat(1).sub(tc.mul(tc)), 0));
        const talk = u.mood.x;
        const above = u.mouthOpen.y.add(talk.mul(0.04));
        const underneath = u.mouthOpen.z.add(talk.mul(0.17));
        const upper = centerY.add(above.mul(arch));
        const lower = centerY.sub(underneath.mul(arch));
        const overshoot = p.x.sub(tc.mul(mouthHalf));
        const dUpper = length(vec2(overshoot, p.y.sub(upper).mul(straighten)));
        const dLower = length(vec2(overshoot, p.y.sub(lower).mul(straighten)));
        const across = step(abs(t), 1);

        const lips = u.mouthStyle.y;
        const lipShape = max(
            p.y.sub(upper.add(arch.mul(0.055).mul(lips))),
            lower.sub(arch.mul(0.075).mul(lips)).sub(p.y)
        );
        color.assign(
            mix(
                color,
                vec3(u.lipColor),
                fill(lipShape, aa).mul(across).mul(step(0.02, lips))
            )
        );

        const inside = fill(max(p.y.sub(upper), lower.sub(p.y)), aa)
            .mul(across)
            .mul(step(0.004, above.add(underneath)));
        const interior = vec3(MOUTH_DARK).toVar();
        const tongue = length(
            vec2(
                p.x,
                p.y.sub(
                    mouthY.sub(bendAmount.mul(0.5)).sub(underneath.mul(0.8))
                )
            ).div(vec2(mouthHalf.mul(0.55), max(underneath.mul(0.5), 0.001)))
        ).sub(1);
        interior.assign(
            mix(
                interior,
                vec3(TONGUE),
                fill(tongue.mul(0.05), aa).mul(u.mouthStyle.x)
            )
        );
        const teeth = u.mouthOpen.w;
        const topRow = step(upper.sub(0.05), p.y).mul(step(0.5, teeth));
        interior.assign(
            mix(interior, vec3(1, 1, 1), max(topRow, step(1.5, teeth)))
        );
        const clenched = step(1.5, teeth);
        const gapX = abs(fract(p.x.div(0.085).add(0.5)).sub(0.5)).mul(0.085);
        const gapY = abs(p.y.sub(upper.add(lower).mul(0.5)));
        interior.assign(
            mix(
                interior,
                ink,
                max(
                    stroke(gapX, half.mul(0.45), aa),
                    stroke(gapY, half.mul(0.45), aa)
                ).mul(clenched)
            )
        );
        color.assign(mix(color, interior, inside));
        color.assign(mix(color, ink, stroke(min(dUpper, dLower), half, aa)));
        return color;
    })();
}

function paintEye(
    u: ToonUniforms,
    q: Node,
    right: Node,
    aa: Node,
    line: Node
): Node {
    return Fn(() => {
        const color = vec3(1, 1, 1).toVar();
        const ink = vec3(u.ink);
        const eyeRadius = u.eye.z;
        const aspect = u.eye.w;
        const blink = mix(u.gaze.x, u.gaze.y, right);

        // Pupil.
        const center = vec2(u.gaze.z.mul(0.42), u.gaze.w.mul(0.42).mul(aspect));
        const d = q.sub(center);
        const angle = atan(d.y, d.x);
        const star = tslFloat(1).add(u.pupil.z.mul(cos(angle.mul(5))));
        const radial = length(d.div(vec2(u.pupil.x, u.pupil.y)))
            .div(star)
            .sub(1)
            .mul(u.pupil.x);
        const ring = u.pupil.w;
        const solid = fill(radial, aa);
        const hollow = stroke(abs(radial), ring.mul(0.5), aa);
        color.assign(mix(color, ink, mix(solid, hollow, step(0.001, ring))));
        const glint = length(
            d.sub(vec2(u.pupil.x.mul(0.35), u.pupil.y.mul(0.35)))
        ).sub(u.pupil.x.mul(0.3));
        color.assign(
            mix(color, vec3(1, 1, 1), fill(glint, aa).mul(u.eyeStyle.x))
        );

        // Upper lid: skin comes down over the eye, with its own ink edge.
        const closed = clamp(u.eyeStyle.y.mul(0.62).add(blink), 0, 1);
        const lidY = mix(aspect.mul(1.15), aspect.mul(-0.7), closed).sub(
            q.x.mul(q.x).mul(0.18)
        );
        color.assign(mix(color, vec3(u.skin), fill(lidY.sub(q.y), aa)));
        color.assign(
            mix(color, ink, stroke(abs(q.y.sub(lidY)), line.mul(0.5), aa))
        );

        // Rim.
        const rim = length(q.div(vec2(1, aspect)));
        color.assign(
            mix(
                color,
                ink,
                smoothstep(
                    tslFloat(1).sub(line).sub(aa),
                    tslFloat(1).sub(line).add(aa),
                    rim
                )
            )
        );
        return color;
    })();
}

/**
 * The two materials every toon avatar is drawn with: flat cel colour with the
 * face painted on, and the ink hull.
 */
export function createToonMaterials(uniforms: ToonUniforms) {
    const paint: Node = attribute("paint", "vec4");
    const vertexColor: Node = attribute("color", "vec3");
    const p = paint.xy;
    const region = paint.z;
    const aa = max(fwidth(p.x).add(fwidth(p.y)).mul(0.6), 0.0005);

    // Ink keeps a drawn line's weight on screen: it follows the avatar's own
    // line width, but never thinner or heavier than a pen would be at this
    // picture size. Painted lines and the hull share the same limits.
    const thinnest = screenSize.y.mul(LINE_MIN);
    const heaviest = screenSize.y.mul(LINE_MAX);
    const paintPerPixel = max(max(fwidth(p.x), fwidth(p.y)), 0.00001);
    const penned = (width: Node) =>
        clamp(width, paintPerPixel.mul(thinnest), paintPerPixel.mul(heaviest));

    const isFace = step(0.5, region).mul(step(region, 1.5));
    const isEye = step(1.5, region);
    const face = paintFace(
        uniforms,
        vertexColor,
        p,
        aa,
        penned(uniforms.head.w)
    );
    const eye = paintEye(
        uniforms,
        p,
        step(2.5, region),
        aa,
        penned(uniforms.head.w.div(uniforms.eye.z))
    );

    // Cel shading, the way a background painter would do it: one crisp
    // shadow shape tinted cool rather than just darker, and a narrow band of
    // light on the side facing the lamp. Edges stay sharp at any zoom.
    const light = vec3(-0.5, 0.62, 0.6).normalize();
    const facing = dot(normalView, light);
    const edge = max(fwidth(facing), 0.002);
    const lit = smoothstep(edge.negate(), edge, facing.add(0.12));
    const glow = smoothstep(edge.negate(), edge, facing.sub(0.8));
    const shadowTint = mix(
        vec3(1, 1, 1),
        vec3(0.62, 0.6, 0.78),
        uniforms.shade
    );
    const shadow = mix(shadowTint, vec3(1, 1, 1), lit).mul(
        tslFloat(1).add(glow.mul(uniforms.shade).mul(0.16))
    );
    // A little paper grain, fixed to the screen like the stock it's drawn on.
    const tooth = fract(
        sin(dot(screenCoordinate.xy.floor(), vec2(12.9898, 78.233))).mul(
            43758.5453
        )
    );
    const paper = tslFloat(1).add(tooth.sub(0.5).mul(0.045));

    const fillMaterial = new MeshBasicNodeMaterial();
    fillMaterial.name = "ToonAvatarFill";
    fillMaterial.toneMapped = false;
    const surface = mix(mix(vertexColor, face, isFace).mul(shadow), eye, isEye);
    fillMaterial.colorNode = vec4(surface.mul(paper).mul(uniforms.tint), 1);

    const inkMaterial = new MeshBasicNodeMaterial();
    inkMaterial.name = "ToonAvatarInk";
    inkMaterial.toneMapped = false;
    inkMaterial.side = BackSide;
    // How far one pixel reaches at this vertex, in view units.
    const clip = cameraProjectionMatrix.mul(
        modelViewMatrix.mul(vec4(positionLocal, 1))
    );
    const viewPerPixel = clip.w
        .mul(2)
        .div(cameraProjectionMatrix.mul(vec4(0, 1, 0, 0)).y.mul(screenSize.y));
    const modelScale = max(
        length(modelViewMatrix.mul(vec4(normalLocal, 0)).xyz),
        0.0001
    );
    const hull = clamp(
        uniforms.inkWidth.mul(modelScale),
        viewPerPixel.mul(thinnest),
        viewPerPixel.mul(heaviest)
    ).div(modelScale);
    inkMaterial.positionNode = positionLocal.add(
        normalLocal.mul(hull).mul(paint.w)
    );
    inkMaterial.colorNode = vec4(vec3(uniforms.ink).mul(uniforms.tint), 1);

    return { fill: fillMaterial, ink: inkMaterial };
}
