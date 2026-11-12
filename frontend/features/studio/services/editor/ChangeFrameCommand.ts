import { EDITION_ACTIONS } from "@components/_3DExhibit-v2/three/constants";
import type { SpaceItem } from "@components/_3DExhibit-v2/three/factory/abstract/spaceitem";
import { AbstractCommand } from "./AbstractCommand";
import { CommandState, ExhibitCommandContext } from "./types";

export interface ChangeFrameOpts {
    targetMeshIds: string[];
    color: string;
    colors?: string[];
}

export class ChangeFrameCommand extends AbstractCommand {
    //
    prevOpts: ChangeFrameOpts;

    constructor(context: ExhibitCommandContext, public opts: ChangeFrameOpts) {
        super(context);
    }

    getLabel() {
        return `border ${this.opts.color}`;
    }

    async runImpl() {
        //
        const targetMeshes = this.opts.targetMeshIds.map((id) =>
            this.getTargetArtwork(id)
        );

        this.prevOpts = {
            targetMeshIds: this.opts.targetMeshIds,
            color: null,
            colors: targetMeshes.map((mesh) => {
                //
                return (mesh.userData as any).borderColor || "black-borderless";
            }),
        };

        return this.runWithOpts(this.opts);
    }

    async runWithOpts(opts: ChangeFrameOpts) {
        //
        let { world } = this.context;

        let { color, colors, targetMeshIds } = opts;

        let result = await Promise.all(
            targetMeshIds.map((id, idx) => {
                //
                return world.edit({
                    type: EDITION_ACTIONS.EDITOR_CHANGE_BORDER,
                    artworkId: id,
                    color: colors ? colors[idx] : color,
                });
            })
        );

        this.updateExhibit((draft) => {
            //
            this.opts.targetMeshIds.forEach((id, idx) => {
                //
                const { borderColor, hasBorder } = result[idx];

                draft.artworks[id].data.borderColor = borderColor;

                draft.artworks[id].data.hasBorder = hasBorder;
            });
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
