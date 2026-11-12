import { EDITION_ACTIONS } from "@components/_3DExhibit-v2/three/constants";
import type { SpaceItem } from "@components/_3DExhibit-v2/three/factory/abstract/spaceitem";
import { ArtworkData } from "@uitypes/experience";
import { AbstractCommand } from "./AbstractCommand";
import { CommandState, ExhibitCommandContext } from "./types";

export interface ChangeVideoOpts {
    targetMeshId: string;
    videoPlayback: ArtworkData["videoPlayback"];
}

export class ChangeVideoOptCommand extends AbstractCommand {
    //
    prevOpts: ChangeVideoOpts;

    constructor(context: ExhibitCommandContext, public opts: ChangeVideoOpts) {
        super(context);
    }

    async runImpl() {
        //
        const targetMesh = this.getTargetArtwork(this.opts.targetMeshId);

        this.prevOpts = {
            ...this.opts,
            videoPlayback: targetMesh.userData.videoPlayback,
        };

        return this.runWithOpts(this.opts);
    }

    async runWithOpts(opts: ChangeVideoOpts) {
        //
        let { world } = this.context;

        let { videoPlayback, targetMeshId: id } = opts;

        this.editorAction = {
            type: EDITION_ACTIONS.EDITOR_CHANGE_VIDEO_OPTS,
            artworkId: id,
            opts: { videoPlayback },
        };

        await world.edit(this.editorAction);

        this.updateExhibit((draft) => {
            //
            draft.artworks[id].videoPlayback = videoPlayback;
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
