import { EDITION_ACTIONS } from "@components/_3DExhibit-v2/three/constants";
import { ArtworkData } from "@components/_3DExhibit-v2/three/factory/editor/edit";
import { AbstractCommand } from "./AbstractCommand";
import { ExhibitCommandContext } from "./types";
import { duplicateScripts, removeScripts } from "./utils";

export interface DuplicateArtworksCommandOpts {
    payloads: ArtworkData[];
    autoSelect?: boolean;
}

export class DuplicateArtworksCommand extends AbstractCommand {
    //
    public payloads: ArtworkData[];

    constructor(
        context: ExhibitCommandContext,
        public opts: DuplicateArtworksCommandOpts
    ) {
        super(context);
    }

    getLabel() {
        //
        return `Duplicate artworks`;
    }

    async runImpl() {
        //
        let { payloads } = this.opts;

        this.payloads = await Promise.all(
            payloads.map(async (payload) => {
                //
                return this.context.world.edit({
                    type: EDITION_ACTIONS.EDITOR_DUPLICATE_ARTWORK,
                    payload: structuredClone(payload),
                });
            })
        );

        if (this.opts.autoSelect) {
            this.context.world.edit({
                type: EDITION_ACTIONS.SET_SELECTED_ITEMS,
                items: this.payloads.map((p) => p.data.id),
                toggle: true,
            });
        }

        this.updateExhibit((draft) => {
            //
            this.payloads.forEach((payload, idx) => {
                //
                draft.artworks[payload.data.id] = structuredClone(payload);

                const sourceId = payloads[idx].data.id;

                // duplicateScripts(draft, sourceId, payload.data.id);
            });
        });
    }

    async undo() {
        //
        await Promise.all(
            this.payloads.map((payload) => {
                //
                this.context.world.edit({
                    type: EDITION_ACTIONS.EDITOR_REMOVE_ARTWORK,
                    artworkId: payload.data.id,
                });
            })
        );

        this.updateExhibit((draft) => {
            //
            this.payloads.forEach((payload) => {
                //
                delete draft.artworks[payload.data.id];

                // removeScripts(draft, payload.data.id);
            });
        });
    }

    async redo() {
        //
        await Promise.all(
            this.payloads.map((payload) => {
                //
                this.context.world.edit({
                    type: EDITION_ACTIONS.EDITOR_ADD_ARTWORK,
                    placeholderId: null,
                    asset: payload.data,
                    keepPlaceholder: true,
                    remotePayload: payload,
                });
            })
        );

        this.updateExhibit((draft) => {
            //
            this.payloads.forEach((payload) => {
                //
                draft.artworks[payload.data.id] = structuredClone(payload);
            });
        });
    }
}
