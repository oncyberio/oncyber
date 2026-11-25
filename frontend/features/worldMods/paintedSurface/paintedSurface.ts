import {
    Box3,
    BufferAttribute,
    BufferGeometry,
    Group,
    InstancedBufferAttribute,
    InstancedBufferGeometry,
    Mesh,
    PlaneGeometry,
    Sphere,
    Vector3,
} from "three/webgpu";
import type { Painted } from "./painter";
import {
    createSurfaceStrokeMaterial,
    createUnderpaintMaterial,
} from "./surfaceMaterial";

/**
 * The two draws a painted surface is made of: its underpaint, then every
 * stroke in one instanced draw. `painted` comes from `createPainter().build()`.
 */
export function createPaintedSurface(painted: Painted, name: string) {
    const group = new Group();
    group.name = name;

    const bounds = new Box3(
        new Vector3(...painted.bounds.min),
        new Vector3(...painted.bounds.max)
    );
    const sphere = bounds.getBoundingSphere(new Sphere());

    const base = new BufferGeometry();
    base.setAttribute(
        "position",
        new BufferAttribute(painted.base.position, 3)
    );
    base.setAttribute("color", new BufferAttribute(painted.base.colour, 3));
    base.setIndex(new BufferAttribute(painted.base.index, 1));
    base.boundingBox = bounds.clone();
    base.boundingSphere = sphere.clone();
    const underpaint = new Mesh(base, createUnderpaintMaterial());
    underpaint.name = `${name}Underpaint`;
    group.add(underpaint);

    if (painted.strokes.count > 0) {
        const quad = new PlaneGeometry(1, 1, 4, 1);
        const geometry = new InstancedBufferGeometry();
        geometry.setIndex(quad.getIndex());
        geometry.setAttribute("position", quad.getAttribute("position"));
        geometry.setAttribute("uv", quad.getAttribute("uv"));
        const { centre, axis, normal, colour, count } = painted.strokes;
        geometry.setAttribute(
            "strokeCentre",
            new InstancedBufferAttribute(centre, 4)
        );
        geometry.setAttribute(
            "strokeAxis",
            new InstancedBufferAttribute(axis, 4)
        );
        geometry.setAttribute(
            "strokeNormal",
            new InstancedBufferAttribute(normal, 4)
        );
        geometry.setAttribute(
            "strokeColour",
            new InstancedBufferAttribute(colour, 4)
        );
        geometry.instanceCount = count;
        // the quad alone says nothing about where the strokes are
        geometry.boundingBox = bounds.clone();
        geometry.boundingSphere = sphere.clone();
        const strokes = new Mesh(geometry, createSurfaceStrokeMaterial());
        strokes.name = `${name}Strokes`;
        group.add(strokes);
    }

    return group;
}
