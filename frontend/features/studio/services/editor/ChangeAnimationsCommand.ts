import type { ModelSpaceArtwork } from "@3/three/factory/artwork/meshes/model/modelspaceartwork";
import { EDITION_ACTIONS } from "@components/_3DExhibit-v2/three/constants";
import type { SpaceItem } from "@components/_3DExhibit-v2/three/factory/abstract/spaceitem";
import { AbstractCommand } from "./AbstractCommand";
import { CommandState, ExhibitCommandContext } from "./types";

type Animations = Record<string, boolean>;

export interface ChangeAnimationsOpts {
    targetMeshId: string;
    animations: Animations;
}

export class ChangeAnimationsCommand extends AbstractCommand {
    //
    prevOpts: ChangeAnimationsOpts;

    constructor(
        context: ExhibitCommandContext,
        public opts: ChangeAnimationsOpts
    ) {
        super(context);
    }

    async runImpl() {
        //
        let id = this.opts.targetMeshId;

        this.prevOpts = {
            targetMeshId: id,
            animations:
                this.exhibit.artworks[id].animations ??
                (this.getTargetMesh(id) as unknown as ModelSpaceArtwork)
                    ?.activeAnimations ??
                {},
        };

        return this.runWithOpts(this.opts);
    }

    async runWithOpts(opts: ChangeAnimationsOpts) {
        //
        let { world } = this.context;

        let { animations, targetMeshId: id } = opts;

        const newAnims = await world.edit({
            type: EDITION_ACTIONS.EDITOR_SELECT_ANIMATION,
            artworkId: id,
            animations,
        });

        this.updateExhibit((draft) => {
            //
            draft.artworks[id].animations = newAnims;
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
