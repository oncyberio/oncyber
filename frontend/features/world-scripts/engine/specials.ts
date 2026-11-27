/**
 * The things that are more than one mesh with a look: a model built from
 * parts, a solid nobody walks through, an opening in the world's own
 * model, an avatar. Each keeps itself up to date from the thing's
 * properties; the thing only holds where it stands.
 */
import type { Object3D } from "three";
import type { createLookCache } from "../looks";
import type { ThingProps } from "../protocol";
import type { WorldStyle } from "../style";
import { createAvatar } from "./avatars";
import { solidPositions, type createSolids } from "./collision";
import { createModel } from "./models";
import type { createOpenings } from "./openings";

/** A thing that is more than one mesh with a look. */
export interface Special {
    /** The thing's properties or the world's style changed. */
    update(props: ThingProps): void;
    /** The thing was moved, turned or resized. */
    moved?(): void;
    frame?(): void;
    dispose(): void;
}

export const SPECIAL_SHAPES = ["model", "solid", "opening", "avatar"];

export function createSpecials(world: {
    looks: ReturnType<typeof createLookCache>;
    solids: ReturnType<typeof createSolids>;
    openings: ReturnType<typeof createOpenings>;
    /** The world's style as it is now. */
    style(): WorldStyle;
}) {
    const { looks, solids, openings } = world;
    /** What stands behind a model, a solid, an opening or an avatar. */
    return function special(
        id: string,
        holder: Object3D,
        shape: string
    ): Special {
        switch (shape) {
            case "model": {
                const model = createModel(id, holder, looks);
                return {
                    update: (props) => model.update(props, world.style()),
                    dispose: model.dispose,
                };
            }
            case "solid":
                return {
                    update: (props) =>
                        solids.set(
                            id,
                            holder,
                            solidPositions(props.boxes, props.walls)
                        ),
                    moved: () => solids.moved(id),
                    dispose: () => solids.set(id, holder, null),
                };
            case "opening": {
                let size = "";
                const open = (props: ThingProps) => {
                    size = JSON.stringify(props.size);
                    openings.set(id, holder, props.size ?? [1, 1, 1]);
                };
                let last: ThingProps = {};
                return {
                    update: (props) => {
                        last = props;
                        if (JSON.stringify(props.size) !== size) open(props);
                    },
                    moved: () => open(last),
                    dispose: () => openings.set(id, holder, null),
                };
            }
            default:
                return createAvatar(id, holder);
        }
    };
}
