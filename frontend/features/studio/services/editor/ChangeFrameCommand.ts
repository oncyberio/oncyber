import { EDITION_ACTIONS } from "@components/_3DExhibit-v2/three/constants";
import type { SpaceItem } from "@components/_3DExhibit-v2/three/factory/abstract/spaceitem";
import type { ArtworkFrame } from "@components/_3DExhibit-v2/three/factory/border/galleryFrame";
import { AbstractCommand } from "./AbstractCommand";
import { CommandState, ExhibitCommandContext } from "./types";

export interface ChangeFrameOpts {
    targetMeshIds: string[];
    color: string;
    colors?: string[];
    /**
     * The frame style for every target: null for the flat border, undefined
     * to keep each artwork's current style.
     */
    frame?: ArtworkFrame | null;
    /** One frame style per target (undo); wins over `frame`. */
    frames?: (ArtworkFrame | null)[];
}

export class ChangeFrameCommand extends AbstractCommand {
    //
    prevOpts: ChangeFrameOpts;

    constructor(context: ExhibitCommandContext, public opts: ChangeFrameOpts) {
        super(context);
    }

    getLabel() {
        return this.opts.frame
            ? `frame ${this.opts.frame.style} ${this.opts.color}`
            : `border ${this.opts.color}`;
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
            frames: targetMeshes.map((mesh) => {
                //
                return (mesh.userData as any).frame ?? null;
            }),
        };

        return this.runWithOpts(this.opts);
    }

    async runWithOpts(opts: ChangeFrameOpts) {
        //
        let { world } = this.context;

        let { color, colors, frame, frames, targetMeshIds } = opts;

        let result = await Promise.all(
            targetMeshIds.map((id, idx) => {
                //
                return world.edit({
                    type: EDITION_ACTIONS.EDITOR_CHANGE_BORDER,
                    artworkId: id,
                    color: colors ? colors[idx] : color,
                    frame: frames ? frames[idx] : frame,
                });
            })
        );

        this.updateExhibit((draft) => {
            //
            targetMeshIds.forEach((id, idx) => {
                //
                const { borderColor, hasBorder, frame } = result[idx];

                const data = draft.artworks[id].data;

                data.borderColor = borderColor;

                data.hasBorder = hasBorder;

                if (frame) {
                    //
                    data.frame = frame;
                } else if (data.frame !== undefined) {
                    //
                    delete data.frame;
                }
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
