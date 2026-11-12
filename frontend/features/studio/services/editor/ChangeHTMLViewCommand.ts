import { EDITION_ACTIONS } from "@components/_3DExhibit-v2/three/constants";
import type { SpaceItem } from "@components/_3DExhibit-v2/three/factory/abstract/spaceitem";
import { AbstractCommand } from "./AbstractCommand";
import { CommandState, ExhibitCommandContext } from "./types";

export interface ChangeHTMLViewOpts {
    targetMeshId: string;
    enableHTMLView: boolean;
}

export class ChangeHTMLViewCommand extends AbstractCommand {
    //
    prevOpts: ChangeHTMLViewOpts;

    constructor(
        context: ExhibitCommandContext,
        public opts: ChangeHTMLViewOpts
    ) {
        super(context);
    }

    async runImpl() {
        //
        const targetMesh = this.getTargetArtwork(this.opts.targetMeshId);

        this.prevOpts = {
            ...this.opts,
            enableHTMLView: targetMesh.userData.enableHTMLView,
        };

        return this.runWithOpts(this.opts);
    }

    async runWithOpts(opts: ChangeHTMLViewOpts) {
        //
        let { world } = this.context;

        let { enableHTMLView, targetMeshId: id } = opts;

        let data = await world.edit({
            type: EDITION_ACTIONS.EDITOR_TOGGLE_HTML,
            artworkId: id,
            enableHTMLView,
        });

        this.updateExhibit((draft) => {
            //
            draft.artworks[id].data.enableHTMLView = data.enableHTMLView;
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
