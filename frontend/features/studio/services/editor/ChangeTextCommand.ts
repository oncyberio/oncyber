import { EDITION_ACTIONS } from "@components/_3DExhibit-v2/three/constants";
import type { SpaceItem } from "@components/_3DExhibit-v2/three/factory/abstract/spaceitem";
import { EditorActionMap } from "@components/_3DExhibit-v2/three/factory/editor/actions";
import { ArtworkData } from "@uitypes/experience";
import { eachKey } from "@utils/js";
import { AbstractCommand } from "./AbstractCommand";
import { CommandState, ExhibitCommandContext } from "./types";

type EditTextAction = EditorActionMap["update_cyber_text"];

export interface ChangeTextOpts {
    targetMeshId: string;
    update: Omit<EditTextAction, "meshId" | "type">;
    firstPayload?: ArtworkData;
}

export class ChangeTextCommand extends AbstractCommand {
    //
    prevOpts: ChangeTextOpts;

    constructor(context: ExhibitCommandContext, public opts: ChangeTextOpts) {
        super(context);
    }

    getLabel() {
        //
        const flds = Object.keys(this.opts.update);

        return `Change ${flds.length === 1 ? flds[0] : "text"}`;
    }

    async runImpl() {
        //
        const targetMesh = this.getTargetArtwork(this.opts.targetMeshId);

        this.prevOpts = {
            targetMeshId: this.opts.targetMeshId,
            update: eachKey(this.opts.update, (value, key) => {
                //
                return targetMesh.userData[key];
            }),
        };

        const res = await this.runWithOpts(this.opts);

        return res;
    }

    async runWithOpts(opts: ChangeTextOpts, isUndo?: boolean) {
        //
        let { world } = this.context;

        let { update, targetMeshId: id } = opts;

        let data = await world.edit({
            type: EDITION_ACTIONS.UPDATE_CYBER_TEXT,
            ...update,
            meshId: id,
        });

        this.updateExhibit((draft) => {
            //
            if (isUndo) {
                //
                if (opts.firstPayload) {
                    //
                    delete draft.artworks[id];
                }
            } else {
                //
                if (opts.firstPayload) {
                    //
                    draft.artworks[id] = opts.firstPayload;
                }

                for (let key in data) {
                    //
                    draft.artworks[id].data[key] = data[key];
                }
            }
        });
    }

    undo() {
        //
        return this.runWithOpts(this.prevOpts, true);
    }

    redo() {
        //
        return this.runWithOpts(this.opts);
    }
}
