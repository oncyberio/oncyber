import { DoubleSide, NodeMaterial } from "three/webgpu";
import {
    abs,
    attribute,
    cross,
    float as tslFloat,
    floor,
    fract,
    fwidth,
    hash,
    instanceIndex,
    max,
    mix,
    modelViewProjection,
    normalize,
    positionGeometry,
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
 * One loaded brush stroke, drawn procedurally on an instanced quad (no
 * texture, so it stays sharp at any zoom), in the manner of the world's own
 * oil-paint strokes: a blunt, rounded head; a body of near-parallel sides
 * with a little raggedness, narrowing slightly toward the tail; a dry tail
 * where the bristles give out one by one, so it ends in streaks; fine
 * bristle grooves along its length; and light that runs from a darker head
 * to a brighter tail. Flat, unlit colour, as the world's emissive strokes.
 *
 * Per instance (see strokeFormat.ts strokeInstances): strokeCentre (unit
 * direction, length), strokeAxis (unit tangent head to tail, width),
 * strokeColour (linear rgb, bend). Lengths are radians of arc on a unit
 * sphere around the camera; the quad is bent along the flow and drawn at
 * the far plane, behind everything, like the sharp sky sphere it replaces.
 */
export function createStrokeMaterial() {
    const material = new NodeMaterial();
    material.name = "PaintedSkyStrokeMaterial";
    material.side = DoubleSide;
    material.fog = false;
    material.transparent = true;
    material.depthWrite = false;
    // the quad's empty corners: skip their blending
    material.alphaTest = 0.004;

    const centre = attribute("strokeCentre", "vec4");
    const axis = attribute("strokeAxis", "vec4");
    const tint = attribute("strokeColour", "vec4");

    // ---- vertex: the quad laid on the sphere, bent along the flow ----
    const x = positionGeometry.x;
    const length = centre.w;
    const across = positionGeometry.y
        .mul(axis.w)
        .add(tint.w.mul(length).mul(x).mul(x).mul(0.5));
    const side = cross(centre.xyz, axis.xyz);
    material.positionNode = normalize(
        centre.xyz.add(axis.xyz.mul(x.mul(length))).add(side.mul(across))
    );
    // at the far plane: behind the world, whatever the camera's far
    material.vertexNode = modelViewProjection.setZ(modelViewProjection.w);

    // ---- fragment: the brush ----
    // interpolated, the index drifts off the integer between pixels: round
    // it, or every pixel would hash to a different brush
    const id = floor(varying(tslFloat(instanceIndex), "vStrokeId").add(0.5));
    const random = (k: number) => hash(id.mul(17).add(k));
    // s runs from head (0) to tail (1), t across (-1 to 1)
    const s = uv().x;
    const t = uv().y.mul(2).sub(1);
    const fromMiddle = abs(t);

    // bristles: lanes across the stroke, each with its own light and end
    const lanes = floor(mix(9, 15, random(1)));
    const laneCoord = t.mul(0.5).add(0.5).mul(lanes);
    const lane = floor(laneCoord);
    const laneSeed = lane.add(id.mul(31));
    const laneEnd = hash(laneSeed.add(5));
    const laneLight = hash(laneSeed.add(977));
    // the dry tail: most bristles carry paint to the end, some stop short,
    // the outer ones first, so the tail rounds off into streaks
    const tailEnd = laneEnd
        .mul(0.36)
        .add(0.64)
        .sub(fromMiddle.mul(fromMiddle).mul(0.2));
    const headStart = hash(laneSeed.add(311)).mul(0.035);

    // the body: a blunt rounded head, then nearly parallel ragged sides
    const ragged = mix(
        valueNoise(s.mul(7).add(random(3).mul(64))),
        valueNoise(s.mul(7).add(random(2).mul(64))),
        step(0, t)
    );
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
    const laneWidthPx = tslFloat(2).div(lanes).div(max(fwidth(t), 1e-6));
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
    material.colorNode = vec4(tint.xyz.mul(light), alpha);
    return material;
}
