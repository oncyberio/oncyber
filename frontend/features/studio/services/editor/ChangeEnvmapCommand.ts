import { EDITION_ACTIONS } from "@components/_3DExhibit-v2/three/constants";
import { AbstractCommand } from "./AbstractCommand";
import { CommandState, ExhibitCommandContext } from "./types";

export interface ChangeEnvmapOpts {
    targetMeshId: string;
    envmap: string;
    envmapIntensity: number;
}

export class ChangeEnvmapCommand extends AbstractCommand {
    //
    prevOpts: ChangeEnvmapOpts;

    constructor(context: ExhibitCommandContext, public opts: ChangeEnvmapOpts) {
        super(context);
    }

    async runImpl() {
        //
        const targetMesh = this.getTargetArtwork(this.opts.targetMeshId);

        const artwork = this.exhibit.artworks[this.opts.targetMeshId];

        this.prevOpts = {
            //
            ...this.opts,

            envmap: artwork.envmap,

            envmapIntensity: artwork.envmapIntensity,
        };

        return this.runWithOpts(this.opts);
    }

    async runWithOpts(opts: ChangeEnvmapOpts) {
        //
        let { world } = this.context;

        let { envmap, envmapIntensity, targetMeshId: id } = opts;

        await world.edit({
            type: EDITION_ACTIONS.EDITOR_CHANGE_ENVMAP,
            envmap,
            envmapIntensity,
            artworkId: id,
        });

        this.updateExhibit((draft) => {
            //
            draft.artworks[id].envmap = envmap;

            draft.artworks[id].envmapIntensity = envmapIntensity;
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
