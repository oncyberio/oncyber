import { EDITION_ACTIONS } from "@components/_3DExhibit-v2/three/constants";
import type { SpaceItem } from "@components/_3DExhibit-v2/three/factory/abstract/spaceitem";
import { AbstractCommand } from "./AbstractCommand";
import { CommandState, ExhibitCommandContext } from "./types";

export interface ChangeDimensionsOpts {
    targetMeshId: string;
    dimensions: [number, number];
}

export class ChangeDimensionsCommand extends AbstractCommand {
    //
    prevOpts: ChangeDimensionsOpts;

    constructor(
        context: ExhibitCommandContext,
        public opts: ChangeDimensionsOpts
    ) {
        super(context);
    }

    async runImpl() {
        //

        const targetMesh = this.getTargetMesh(this.opts.targetMeshId);

        this.prevOpts = {
            ...this.opts,
            dimensions: targetMesh.userData.dimensions,
        };

        return this.runWithOpts(this.opts);
    }

    async runWithOpts(opts: ChangeDimensionsOpts) {
        //
        let { world } = this.context;

        let { dimensions, targetMeshId: id } = opts;

        this.editorAction = {
            type: EDITION_ACTIONS.EDITOR_CHANGE_DIMENSIONS,
            artworkId: id,
            dimensions,
        };

        let data = await world.edit(this.editorAction);

        this.updateExhibit((draft) => {
            //
            draft.artworks[id].data.dimensions = data.dimensions;
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
