/**
 * How a thing is drawn: its text into a texture, or its surface from the
 * shared looks (../looks.ts), with the drawn outline a style may ask for.
 * A model, a solid, an opening or an avatar draws itself (./specials.ts)
 * and is only told.
 */
import { Mesh, type MeshBasicMaterial, type SpriteMaterial } from "three";
import {
    createOutlineMaterial,
    resolveLook,
    type createLookCache,
} from "../looks";
import type { WorldStyle } from "../style";
import { drawText } from "./text";
import type { Thing } from "./things";

type Looks = ReturnType<typeof createLookCache>;

export function createThingLooks(looks: Looks) {
    let outlineMaterial: ReturnType<typeof createOutlineMaterial> | null = null;
    return {
        /** Draws `thing` as its properties and the world's style say now. */
        apply(thing: Thing, style: WorldStyle) {
            const { props } = thing;
            if (thing.special) {
                thing.special.update(props);
                thing.object.visible = props.visible !== false;
                return;
            }
            if (props.shape === "text") {
                const { texture, aspect } = drawText(props, thing.texture);
                thing.texture = texture;
                const material = thing.material as
                    | SpriteMaterial
                    | MeshBasicMaterial;
                material.map = texture;
                material.transparent = true;
                material.opacity = props.opacity ?? 1;
                material.needsUpdate = true;
                const height = props.size?.[1] ?? 0.5;
                const base = props.scale ?? [1, 1, 1];
                thing.object.scale.set(
                    height * aspect * base[0],
                    height * base[1],
                    base[2]
                );
            } else {
                const spec = resolveLook(
                    props,
                    style,
                    props.shape === "plane" || props.shape === "ring"
                );
                const taken = looks.take(spec);
                if (thing.lookKey) looks.release(thing.lookKey);
                thing.lookKey = taken.key;
                thing.material = taken.material;
                (thing.object as Mesh).material = taken.material;
                const outlined =
                    style.outline && !["plane", "ring"].includes(props.shape);
                if (outlined && !thing.outline && thing.geometry) {
                    outlineMaterial =
                        outlineMaterial || createOutlineMaterial();
                    thing.outline = new Mesh(thing.geometry, outlineMaterial);
                    thing.outline.raycast = () => undefined;
                    thing.object.add(thing.outline);
                } else if (!outlined && thing.outline) {
                    thing.outline.removeFromParent();
                    thing.outline = undefined;
                }
                if (thing.outline)
                    thing.outline.visible = (props.opacity ?? 1) >= 1;
            }
            thing.object.visible = props.visible !== false;
        },
        dispose() {
            outlineMaterial?.dispose();
        },
    };
}
