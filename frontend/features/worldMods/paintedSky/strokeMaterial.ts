import { DoubleSide, NodeMaterial } from "three/webgpu";
import {
    attribute,
    cross,
    float as tslFloat,
    instanceIndex,
    normalize,
    positionGeometry,
    vec4,
} from "three/tsl";
import { brushStroke } from "../brush/brush";
import { skyClipPosition } from "@components/_3DExhibit-v2/three/factory/background/materials/skyPosition";

/**
 * The sky's strokes: one procedural brush stroke (`../brush/brush.ts`) per
 * instanced quad. Flat, unlit colour, as the world's emissive strokes.
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
    // at infinity (far plane): behind the world, the same for both eyes in VR
    material.vertexNode = skyClipPosition();

    // ---- fragment: the brush ----
    const { alpha, light } = brushStroke(tslFloat(instanceIndex));
    material.colorNode = vec4(tint.xyz.mul(light), alpha);
    return material;
}
