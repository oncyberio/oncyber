import {
    abs,
    float as tslFloat,
    floor,
    fract,
    fwidth,
    hash,
    max,
    mix,
    saturate,
    smoothstep,
    sqrt,
    step,
    uv,
    varying,
    vec4,
} from "three/tsl";

type FloatNode = ReturnType<typeof tslFloat>;

/** Smooth 1D value noise, 0–1. */
const valueNoise = (z: FloatNode) => {
    const i = floor(z);
    const f = fract(z);
    return mix(hash(i), hash(i.add(1)), f.mul(f).mul(f.mul(-2).add(3)));
};

/** 0 outside, 1 inside, over about a pixel: a hard edge that never aliases. */
const edge = (distance: FloatNode, pixel: FloatNode) =>
    saturate(distance.div(max(pixel, 1e-6)).add(0.5));

/**
 * One loaded brush stroke, drawn procedurally on a quad (no texture, so it
 * stays sharp at any zoom), in the manner of the world's own oil-paint
 * strokes: a blunt, rounded head; a body of near-parallel sides with a
 * little raggedness, narrowing slightly toward the tail; a dry tail where
 * the bristles give out one by one, so it ends in streaks; fine bristle
 * grooves along its length; and light that runs from a darker head to a
 * brighter tail.
 *
 * The quad's uv runs head to tail in x and across in y. `index` tells one
 * stroke from the next (the instance index). Returns the stroke's coverage
 * (`alpha`, 0–1 with a pixel-wide edge) and the `light` to multiply its
 * colour by.
 */
export function brushStroke(index: FloatNode) {
    // per-stroke dice, thrown once in the vertex stage
    const brush = varying(
        vec4(
            index.mul(31),
            floor(mix(9, 15, hash(index.mul(17).add(1)))),
            hash(index.mul(17).add(2)).mul(64),
            hash(index.mul(17).add(3)).mul(64)
        ),
        "vStrokeBrush"
    );
    // interpolated, the values drift off the integer between pixels: round
    // them, or every pixel would hash to a different brush
    const seed = floor(brush.x.add(0.5));
    const lanes = floor(brush.y.add(0.5));
    // s runs from head (0) to tail (1), t across (-1 to 1)
    const s = uv().x;
    const t = uv().y.mul(2).sub(1);
    const fromMiddle = abs(t);

    // bristles: lanes across the stroke, each with its own light and end
    const laneCoord = t.mul(0.5).add(0.5).mul(lanes);
    const lane = floor(laneCoord);
    const laneDice = hash(lane.add(seed));
    const laneEnd = fract(laneDice.mul(7.31));
    const laneLight = fract(laneDice.mul(13.7));
    // the dry tail: most bristles carry paint to the end, some stop short,
    // the outer ones first, so the tail rounds off into streaks
    const tailEnd = laneEnd
        .mul(0.36)
        .add(0.64)
        .sub(fromMiddle.mul(fromMiddle).mul(0.2));
    const headStart = laneDice.mul(0.035);

    // the body: a blunt rounded head, then nearly parallel ragged sides
    const ragged = valueNoise(s.mul(7).add(mix(brush.w, brush.z, step(0, t))));
    const halfWidth = sqrt(saturate(s.div(0.09)))
        .mul(tslFloat(1).sub(s.mul(0.14)))
        .mul(ragged.mul(0.14).add(0.9));
    const sideDistance = halfWidth.sub(fromMiddle);
    const along = fwidth(s);
    const alpha = edge(sideDistance, fwidth(sideDistance))
        .mul(edge(tailEnd.sub(s), along))
        .mul(edge(s.sub(headStart), along));

    // light: darker head to brighter tail, each bristle a little different,
    // with a groove between bristles; fades out when lanes are under ~2 px
    const laneWidthPx = tslFloat(2)
        .div(lanes)
        .div(max(fwidth(t), 1e-6));
    const bristleVisible = smoothstep(0.8, 2.5, laneWidthPx);
    const groove = abs(fract(laneCoord).sub(0.5)).mul(2);
    const bristle = mix(
        tslFloat(1),
        laneLight
            .mul(0.24)
            .add(0.88)
            .mul(tslFloat(1).sub(groove.mul(groove).mul(0.12))),
        bristleVisible
    );
    const light = mix(0.82, 1.14, s).mul(bristle).mul(1.04);

    return { alpha, light };
}
