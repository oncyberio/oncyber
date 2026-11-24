import { DoubleSide, NodeMaterial } from "three/webgpu";
import {
    attribute,
    cross,
    float as tslFloat,
    instanceIndex,
    positionGeometry,
    vec4,
} from "three/tsl";
import { brushStroke } from "../brush/brush";

/**
 * Brush strokes lying on surfaces in the world: the sky's procedural brush
 * (`../brush/brush.ts`), one stroke per instanced quad, placed by the
 * attributes `painter.ts` builds (strokeCentre: centre and length;
 * strokeAxis: direction and width; strokeNormal: the surface's normal and
 * the stroke's lift off it; strokeColour: linear rgb and bend).
 *
 * Opaque with a cut-out edge, so strokes write depth and need no sorting;
 * each is lifted a hair off its surface, by a different amount, so
 * overlapping strokes do not fight. Flat, unlit colour, as the world's own
 * emissive strokes: any light is painted into the colours.
 */
export function createSurfaceStrokeMaterial() {
    const material = new NodeMaterial();
    material.name = "PaintedSurfaceStrokeMaterial";
    material.side = DoubleSide;
    material.fog = false;
    material.alphaTest = 0.5;

    const centre = attribute("strokeCentre", "vec4");
    const axis = attribute("strokeAxis", "vec4");
    const normal = attribute("strokeNormal", "vec4");
    const tint = attribute("strokeColour", "vec4");

    const x = positionGeometry.x;
    const length = centre.w;
    const across = positionGeometry.y
        .mul(axis.w)
        .add(tint.w.mul(length).mul(x).mul(x).mul(0.5));
    const side = cross(normal.xyz, axis.xyz);
    material.positionNode = centre.xyz
        .add(axis.xyz.mul(x.mul(length)))
        .add(side.mul(across))
        .add(normal.xyz.mul(normal.w));

    const { alpha, light } = brushStroke(tslFloat(instanceIndex));
    material.colorNode = vec4(tint.xyz.mul(light), alpha);
    return material;
}

/** The flat underpaint beneath the strokes: a colour per vertex, unlit. */
export function createUnderpaintMaterial() {
    const material = new NodeMaterial();
    material.name = "PaintedSurfaceUnderpaintMaterial";
    material.side = DoubleSide;
    material.fog = false;
    material.colorNode = vec4(attribute("color", "vec3"), 1);
    return material;
}
