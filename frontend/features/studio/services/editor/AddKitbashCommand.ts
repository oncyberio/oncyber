import { EDITION_ACTIONS } from "@components/_3DExhibit-v2/three/constants";
import { IS_ABORT_ERROR } from "@components/_3DExhibit-v2/three/utils/abort";
import { AbstractCommand } from "./AbstractCommand";
import { CommandState, ExhibitCommandContext } from "./types";
import { KitBashData, Kitbash } from "@uitypes/experience";
import { PresetData } from "@3factory/space/kits/types";

export interface AddKitbashCommandOpts {
    ctype: string;
    kit: string;
    preset?: PresetData;
    payload?: KitBashData;
    addedBy: string;
    targetId?: string;
    duplicate?: boolean;
    autoSelect?: boolean;
}

export class AddKitbashCommand extends AbstractCommand {
    //
    prevPayload?: KitBashData;

    nextPayload: KitBashData;

    constructor(
        context: ExhibitCommandContext,
        public opts: AddKitbashCommandOpts
    ) {
        super(context);
    }

    getLabel() {
        //
        const info = `Element ${this.opts.ctype}`;

        return `Add ${info}`;
    }

    async runImpl() {
        //
        // if (this.opts.targetId && !this.opts.duplicate) {
        //     //
        //     this.prevPayload = this.exhibit.kitbash[this.opts.targetId];
        // }

        const nextPayload = await this.context.world.edit({
            type: EDITION_ACTIONS.EDITOR_ADD_KITBASH,
            ctype: this.opts.ctype,
            kit: this.opts.kit,
            preset: this.opts.preset,
            id: this.opts.targetId,
            duplicate: this.opts.duplicate,
            payload: this.opts.payload,
        });

        this.nextPayload = structuredClone(nextPayload);

        if (this.opts.autoSelect) {
            //
            this.context.world.edit({
                type: EDITION_ACTIONS.SET_SELECTED_ITEMS,
                items: [this.nextPayload.id],
            });
        }

        this.updateExhibit((draft) => {
            //
            draft.kitbash[this.nextPayload.id] = structuredClone(
                this.nextPayload
            );
        });
    }

    async undo() {
        //
        if (this.prevPayload) {
            //
            await this.context.world.edit({
                type: EDITION_ACTIONS.EDITOR_ADD_KITBASH,
                ctype: this.prevPayload.type,
                kit: this.prevPayload.kit,
                id: this.prevPayload.id,
                payload: this.prevPayload,
                preset: null,
            });

            this.updateExhibit((draft) => {
                //
                draft.kitbash[this.prevPayload.id] = structuredClone(
                    this.prevPayload
                );
            });
        } else {
            //
            await this.context.world.edit({
                type: EDITION_ACTIONS.EDITOR_REMOVE_KITBASH,
                id: this.nextPayload.id,
            });

            this.updateExhibit((draft) => {
                //
                delete draft.kitbash[this.nextPayload.id];
            });
        }
    }

    async redo() {
        //
        this.context.world.edit({
            type: EDITION_ACTIONS.EDITOR_ADD_KITBASH,
            ctype: this.nextPayload.type,
            kit: this.nextPayload.kit,
            id: null,
            payload: this.nextPayload,
            preset: null,
        });

        this.updateExhibit((draft) => {
            //
            draft.kitbash[this.nextPayload.id] = structuredClone(
                this.nextPayload
            );
        });
    }
}
