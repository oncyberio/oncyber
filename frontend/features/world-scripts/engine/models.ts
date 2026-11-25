/**
 * Draws a script's "model" (parts.ts) the way the world's style says: in a
 * painted look, as brush strokes over flat underpaint (two draws, however
 * many parts); in any other look, as one mesh with that look's surface.
 */
import { BufferAttribute, BufferGeometry, Mesh, type Object3D } from "three";
import { createPaintedSurface } from "@features/worldMods/paintedSurface/paintedSurface";
import { IS_MOBILE } from "@3/three/constants";
import { resolveLook, type createLookCache } from "../looks";
import { buildParts } from "../parts";
import type { ThingProps } from "../protocol";
import type { WorldStyle } from "../style";

type Looks = ReturnType<typeof createLookCache>;

/** The same id always builds the same object: a number from its letters. */
function seedOf(id: string) {
    let seed = 2166136261;
    for (let i = 0; i < id.length; i++)
        seed = Math.imul(seed ^ id.charCodeAt(i), 16777619);
    return seed >>> 0 || 1;
}

function disposeTree(object: Object3D) {
    object.traverse((node) => {
        const mesh = node as Mesh;
        mesh.geometry?.dispose();
    });
    object.removeFromParent();
}

/** What was built from: a rebuild is needed only when one of these changes. */
const signature = (props: ThingProps, style: WorldStyle) =>
    JSON.stringify([
        props.parts?.length,
        props.lamp,
        props.look,
        props.opacity,
        style.look,
        style.strokes,
    ]);

export function createModel(id: string, holder: Object3D, looks: Looks) {
    let built: Object3D | null = null;
    let lookKey: string | null = null;
    let parts: ThingProps["parts"] | null = null;
    let builtFrom = "";

    function clear() {
        if (built) disposeTree(built);
        built = null;
        if (lookKey) looks.release(lookKey);
        lookKey = null;
    }

    return {
        /** Builds the model again when its parts, lamp or look changed. */
        update(props: ThingProps, style: WorldStyle) {
            const from = signature(props, style);
            if (parts === props.parts && from === builtFrom) return;
            parts = props.parts;
            builtFrom = from;
            clear();
            if (!props.parts?.length) return;

            const spec = resolveLook(
                // tokens-ok: a 3D material's base colour
                { ...props, color: "#ffffff" },
                style,
                true
            );
            const painted = spec.look === "painted";
            const model = buildParts(props.parts, {
                painted,
                // lit looks take their light from the world's own lights
                lamp: painted || spec.look === "flat" ? props.lamp : undefined,
                density: IS_MOBILE ? 0.6 : 1,
                strokes: style.strokes,
                seed: seedOf(id),
            });
            if (painted) {
                built = createPaintedSurface(model, `world-script:${id}:model`);
            } else {
                const geometry = new BufferGeometry();
                geometry.setAttribute(
                    "position",
                    new BufferAttribute(model.base.position, 3)
                );
                geometry.setAttribute(
                    "color",
                    new BufferAttribute(model.base.colour, 3)
                );
                geometry.setIndex(new BufferAttribute(model.base.index, 1));
                geometry.computeVertexNormals();
                const taken = looks.take({
                    ...spec,
                    perVertex: true,
                    pattern: "none",
                    shader: null,
                    wobble: 0,
                });
                lookKey = taken.key;
                built = new Mesh(geometry, taken.material);
                built.name = `world-script:${id}:model`;
            }
            holder.add(built);
        },
        dispose: clear,
    };
}
