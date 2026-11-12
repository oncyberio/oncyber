import { EDITION_ACTIONS } from "@components/_3DExhibit-v2/three/constants";
import { IS_ABORT_ERROR } from "@components/_3DExhibit-v2/three/utils/abort";
import { AbstractCommand } from "./AbstractCommand";
import { CommandState, ExhibitCommandContext } from "./types";
import { KitBashData, Kitbash } from "@uitypes/experience";

export interface RemoveKitbashCommandOpts {
    targetIds: string[];
    autoSelect?: boolean;
}

export class RemoveKitbashCommand extends AbstractCommand {
    //
    payloads: any[];

    constructor(
        context: ExhibitCommandContext,
        public opts: RemoveKitbashCommandOpts
    ) {
        super(context);
    }

    getLabel() {
        //
        return `Remove Kitbash`;
    }

    async runImpl() {
        //
        this.payloads = this.opts.targetIds.map((id) => {
            //
            return structuredClone(this.exhibit.kitbash[id]);
        });

        return this.runRemove();
    }

    async runRemove() {
        //
        await Promise.all(
            this.opts.targetIds.map((id) => {
                //
                return this.context.world.edit({
                    type: EDITION_ACTIONS.EDITOR_REMOVE_KITBASH,
                    id,
                });
            })
        );

        this.updateExhibit((draft) => {
            //
            this.opts.targetIds.forEach((id) => {
                //
                delete draft.kitbash[id];
            });
        });
    }

    async undo() {
        //
        await Promise.all(
            this.payloads.map((payload) => {
                //
                return this.context.world
                    .edit({
                        type: EDITION_ACTIONS.EDITOR_ADD_KITBASH,
                        ctype: payload.type,
                        kit: payload.kit,
                        id: null,
                        payload,
                    })
                    .then(() => {
                        //
                        if (this.opts.autoSelect) {
                            //
                            this.context.world.edit({
                                type: EDITION_ACTIONS.SET_SELECTED_ITEMS,
                                items: [payload.id],
                                toggle: true,
                            });
                        }
                    });
            })
        );

        this.updateExhibit((draft) => {
            //
            this.payloads.forEach((payload) => {
                //
                draft.kitbash[payload.id] = structuredClone(payload);
            });
        });
    }

    async redo() {
        //
        await this.runRemove();
    }
}
