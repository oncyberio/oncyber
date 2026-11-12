import { EDITION_ACTIONS } from "@components/_3DExhibit-v2/three/constants";
import type { SpaceArtwork } from "@components/_3DExhibit-v2/three/factory/artwork/abstract";
import { ArtworkData } from "@uitypes/experience";
import { AbstractCommand } from "./AbstractCommand";
import { CommandState, ExhibitCommandContext } from "./types";

export interface ChangeAudioOpts {
    targetMeshId: string;
    audioType: ArtworkData["audioType"];
    volume: number;
}

export class ChangeAudioOptCommand extends AbstractCommand {
    //
    prevOpts: ChangeAudioOpts;

    constructor(context: ExhibitCommandContext, public opts: ChangeAudioOpts) {
        super(context);
    }

    getLabel() {
        return `audio ${this.opts.audioType}:${this.opts.volume}`;
    }

    async runImpl() {
        //
        const targetMesh = this.getTargetArtwork(this.opts.targetMeshId);

        this.prevOpts = {
            targetMeshId: this.opts.targetMeshId,
            audioType: targetMesh.audioController.audioType,
            volume: targetMesh.audioController.volume,
        };
        return this.runWithOpts(this.opts);
    }

    async runWithOpts(opts: ChangeAudioOpts) {
        //
        let { world } = this.context;

        let { audioType, volume, targetMeshId: id } = opts;

        await world.edit({
            type: EDITION_ACTIONS.EDITOR_CHANGE_AUDIO,
            artworkId: id,
            audioType,
            volume,
        });

        this.updateExhibit((draft) => {
            //
            draft.artworks[id].audioType = audioType;
            draft.artworks[id].volume = volume;
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
