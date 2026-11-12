import { EDITION_ACTIONS } from "@components/_3DExhibit-v2/three/constants";
import type { SpaceItem } from "@components/_3DExhibit-v2/three/factory/abstract/spaceitem";
import {
    fromXYZ_,
    toXYZ,
    toXYZ_,
} from "@components/_3DExhibit-v2/three/utils/three";

import { XYZ } from "@uitypes/experience";
import { AbstractCommand } from "./AbstractCommand";
import { ExhibitCommandContext } from "./types";
import { Coords } from "@gltypes";

export interface ChangeTransformPayload {
    id: string;
    coords: Coords;
    undo: Coords;
}

export interface ChangeTransformOpts {
    updates: ChangeTransformPayload[];
}

type ChangeTransformItemOpt = Coords & { id: string };

export class ChangeTransformCommand extends AbstractCommand {
    //
    undoOpts: ChangeTransformItemOpt[];

    redoOpts: ChangeTransformItemOpt[];

    constructor(
        context: ExhibitCommandContext,
        public opts: ChangeTransformOpts
    ) {
        super(context);

        this.undoOpts = this.opts.updates.map((update) => {
            //
            return {
                id: update.id,
                ...(update.undo || this.getPrevOpts(update.id)),
            };
        });

        this.redoOpts = this.opts.updates.map((update) => {
            //
            return {
                id: update.id,
                ...update.coords,
            };
        });
    }

    getLabel() {
        //
        return "change transforms";
    }

    async runImpl() {
        //
        return this.runWithOpts(this.redoOpts);
    }

    async runWithOpts(updates: ChangeTransformItemOpt[]) {
        //
        let { world } = this.context;

        let data = await world.edit({
            type: EDITION_ACTIONS.EDITOR_CHANGE_TRANSFORM,
            updates,
        });

        this.updateExhibit((draft) => {
            //
            data.forEach((update) => {
                //
                this.updateItem(update, draft);
            });
        });
    }

    updateItem(data, draft) {
        //
        const newPosition = data.position;

        const newRotation = toXYZ_(data.rotation);

        const newScale = data.scale;

        let item;

        if ((item = draft.portals?.[data.id])) {
            //
            const portal = item;

            if (portal.spawn == null) {
                //
                throw new Error("Portal not found " + data.id);
            }

            portal.spawn.position = newPosition;

            portal.spawn.rotation = newRotation;

            portal.spawn.scale = newScale;
            //
        } else if ((item = draft.artworks?.[data.id])) {
            //
            const artwork = item;

            artwork.position = newPosition;

            artwork.rotation = newRotation;

            // 3D Objects use `scale` property on the top level `artwork`, while artworks use the `scale` property
            // of the `artwork.data` property. Since this event can be called now both for 3D objects and artworks
            // we need to save the `scale` also in the top level `artwork`
            if (artwork.data.mime_type?.startsWith("model/gltf")) {
                //
                artwork.scale = newScale;
            } else {
                artwork.data.scale = newScale.x;
            }
        } else {
            //
            // Kiybash & Components should've emitted a 'data' even when
            // world.current.edit() was called
        }
    }

    getPrevOpts(id: string): ChangeTransformItemOpt {
        //
        const targetMesh = this.getTargetMesh(id);

        if (targetMesh.isPortal) {
            //
            const portal = this.exhibit.portals[id];

            if (portal.spawn == null) {
                //
                throw new Error("Portal not found " + id);
            }

            return {
                id,
                position: portal.spawn.position,
                rotation: fromXYZ_(portal.spawn.rotation),
                scale: portal.spawn.scale || { x: 1, y: 1, z: 1 },
            };

            //
        } else if (targetMesh.isArtwork) {
            //
            const artwork = this.exhibit.artworks[id];

            let scale: XYZ;

            if (artwork.data.mime_type?.startsWith("model/gltf")) {
                scale = artwork.scale;
            } else {
                let s = artwork.data.scale || 1;

                scale = { x: s, y: s, z: 1 };
            }

            return {
                id,
                position: artwork.position,
                rotation: fromXYZ_(artwork.rotation),
                scale,
            };
        } else if (targetMesh.isKitBash) {
            //
            const kitbash = this.exhibit.kitbash[id];

            return {
                id,
                position: kitbash.position,
                rotation: fromXYZ_(kitbash.rotation),
                scale: kitbash.scale,
            };
        }
    }

    undo() {
        //
        return this.runWithOpts(this.undoOpts);
    }

    redo() {
        //
        return this.runWithOpts(this.redoOpts);
    }
}
