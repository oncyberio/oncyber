/**
 * The geometry of a plain shape a world script makes: a box, a sphere, a
 * profile spun around an axis, an outline given depth. Made from code on
 * the device; nothing is downloaded.
 */
import {
    BoxGeometry,
    BufferGeometry,
    CapsuleGeometry,
    ConeGeometry,
    CylinderGeometry,
    ExtrudeGeometry,
    LatheGeometry,
    PlaneGeometry,
    RingGeometry,
    Shape,
    SphereGeometry,
    TorusGeometry,
    Vector2,
} from "three";
import type { ThingProps } from "../protocol";

export function geometryFor(props: ThingProps): BufferGeometry {
    const [x, y, z] = props.size ?? [1, 1, 1];
    switch (props.shape) {
        case "sphere":
            return new SphereGeometry(x / 2, 24, 16);
        case "cylinder":
            return new CylinderGeometry(x / 2, x / 2, y, 24);
        case "cone":
            return new ConeGeometry(x / 2, y, 24);
        case "torus":
            return new TorusGeometry(x / 2, Math.max(0.01, z / 6), 12, 32);
        case "ring":
            return new RingGeometry(x / 4, x / 2, 32);
        case "plane":
            return new PlaneGeometry(x, y);
        case "capsule":
            return new CapsuleGeometry(x / 2, Math.max(0, y - x), 6, 16);
        case "lathe": {
            const profile = props.profile ?? [
                [0, -0.5],
                [0.5, -0.5],
                [0.5, 0.5],
                [0, 0.5],
            ];
            const geometry = new LatheGeometry(
                profile.map(([r, h]) => new Vector2(r, h)),
                32
            );
            return geometry.scale(x, y, z);
        }
        case "star":
        case "extrude": {
            const shape = new Shape();
            let outline = props.outline;
            if (props.shape === "star" || !outline) {
                const points = props.points ?? 5;
                outline = [];
                for (let i = 0; i < points * 2; i++) {
                    const angle =
                        (i / (points * 2)) * Math.PI * 2 + Math.PI / 2;
                    const radius = i % 2 ? 0.22 : 0.5;
                    outline.push([
                        Math.cos(angle) * radius,
                        Math.sin(angle) * radius,
                    ]);
                }
            }
            outline.forEach(([px, py], i) =>
                i ? shape.lineTo(px, py) : shape.moveTo(px, py)
            );
            const depth = props.depth ?? 0.2;
            const bevel = (props.bevel ?? 0.3) * Math.min(depth, 0.2) * 0.5;
            const geometry = new ExtrudeGeometry(shape, {
                depth,
                bevelEnabled: bevel > 0,
                bevelThickness: bevel,
                bevelSize: bevel,
                bevelSegments: 2,
                curveSegments: 12,
            });
            geometry.translate(0, 0, -depth / 2);
            return geometry.scale(x, y, z);
        }
        default:
            return new BoxGeometry(x, y, z);
    }
}
