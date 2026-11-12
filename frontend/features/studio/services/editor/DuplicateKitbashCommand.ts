import { EDITION_ACTIONS } from "@components/_3DExhibit-v2/three/constants";
import { AbstractCommand } from "./AbstractCommand";
import { ExhibitCommandContext } from "./types";

export interface DuplicateKitbashCommandOpts {
    payloads: any[];
    autoSelect?: boolean;
}

export class DuplicateKitbashCommand extends AbstractCommand {
    //
    public payloads: any[];

    constructor(
        context: ExhibitCommandContext,
        public opts: DuplicateKitbashCommandOpts
    ) {
        super(context);
    }

    getLabel() {
        //
        return `Duplicate components`;
    }

    async runImpl() {
        //
        let { payloads } = this.opts;

        this.payloads = await Promise.all(
            payloads.map((payload) => {
                //
                return this.context.world.edit({
                    type: EDITION_ACTIONS.EDITOR_DUPLICATE_KITBASH,
                    payload,
                });
            })
        );

        if (this.opts.autoSelect) {
            this.context.world.edit({
                type: EDITION_ACTIONS.SET_SELECTED_ITEMS,
                items: this.payloads.map((p) => p.id),
                toggle: true,
            });
        }

        this.updateExhibit((draft) => {
            //
            this.payloads.forEach((payload) => {
                //
                draft.kitbash[payload.id] = structuredClone(payload);
            });
        });
    }

    async undo() {
        //
        await Promise.all(
            this.payloads.map((payload) => {
                //
                this.context.world.edit({
                    type: EDITION_ACTIONS.EDITOR_REMOVE_KITBASH,
                    id: payload.id,
                });
            })
        );

        this.updateExhibit((draft) => {
            //
            this.payloads.forEach((payload) => {
                //
                delete draft.kitbash[payload.id];
            });
        });
    }

    async redo() {
        //
        await Promise.all(
            this.payloads.map((payload) => {
                //
                this.context.world.edit({
                    type: EDITION_ACTIONS.EDITOR_ADD_KITBASH,
                    ctype: payload.type,
                    kit: payload.kit,
                    id: null,
                    payload: structuredClone(payload),
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
}
