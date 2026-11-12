import { EDITION_ACTIONS } from "@components/_3DExhibit-v2/three/constants";
import type { SpaceItem } from "@components/_3DExhibit-v2/three/factory/abstract/spaceitem";
import { AbstractCommand } from "./AbstractCommand";
import { CommandState, ExhibitCommandContext } from "./types";

export interface ColliderOpts {
    targetMeshId: string;
    isCollider: boolean;
}

export class ChangeColliderCommand extends AbstractCommand {
    //
    prevOpts: ColliderOpts;

    constructor(context: ExhibitCommandContext, public opts: ColliderOpts) {
        super(context);
    }

    async runImpl() {
        //

        const targetMesh = this.getTargetArtwork(this.opts.targetMeshId);

        this.prevOpts = {
            targetMeshId: this.opts.targetMeshId,

            isCollider: targetMesh.userData.isCollider,
        };

        return this.runWithOpts(this.opts);
    }

    async runWithOpts(opts: ColliderOpts) {
        //
        let { world } = this.context;

        let { targetMeshId: id } = opts;

        let { isCollider } = await world.edit({
            type: EDITION_ACTIONS.EDITOR_CHANGE_COLLIDER,
            artworkId: id,
            isCollider: opts.isCollider,
        });

        this.updateExhibit((draft) => {
            //
            draft.artworks[id].data.isCollider = isCollider;
        });
    }

    undo() {
        //
        return this.runWithOpts(this.prevOpts);
    }

    redo() {
        //
        return this.runWithOpts(this.opts);
    }
}
