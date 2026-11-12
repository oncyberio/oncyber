import { EDITION_ACTIONS } from "@components/_3DExhibit-v2/three/constants";
import type { SpaceArtwork } from "@components/_3DExhibit-v2/three/factory/artwork/abstract";
import type { ArtworkData, PortalData, Script } from "@uitypes/experience";
import { AbstractCommand } from "./AbstractCommand";
import { ExhibitCommandContext } from "./types";
import { getScripts, removeScripts, restoreScripts } from "./utils";

export interface RemoveArtworksCommandOpts {
    targetMeshIds: string[];
    autoSelect?: boolean;
}

export class RemoveArtworksCommand extends AbstractCommand {
    //
    artPayloads: ArtworkData[];
    artScripts: Record<string, Record<string, Script>> = {};

    _label: string;

    constructor(
        context: ExhibitCommandContext,
        public opts: RemoveArtworksCommandOpts
    ) {
        super(context);
    }

    getLabel() {
        //
        return "Delete Artwork";
    }

    async runImpl() {
        //
        let { targetMeshIds: artworkIds } = this.opts;

        const targetMeshes = artworkIds.map((id) => this.getTargetArtwork(id));

        this._label = `Delete ${targetMeshes[0]?.userData.name || "artwork"}`;

        this.artPayloads = artworkIds.map((id) => {
            this.artScripts[id] = getScripts(this.exhibit, id);

            return this.exhibit.artworks[id];
        });

        return this.runWithOpts(this.opts);
    }

    async runWithOpts(opts: RemoveArtworksCommandOpts) {
        //
        let { world } = this.context;

        let { targetMeshIds: artworkIds } = opts;

        await Promise.all(
            artworkIds.map((artworkId) => {
                //
                world.edit({
                    type: EDITION_ACTIONS.EDITOR_REMOVE_ARTWORK,
                    artworkId,
                });
            })
        );

        this.updateExhibit((draft) => {
            //
            artworkIds.forEach((artworkId) => {
                //
                delete draft.artworks[artworkId];

                removeScripts(draft, artworkId);
            });
        });
    }

    async undo() {
        //
        await Promise.all(
            this.artPayloads.map((artPayload) => {
                //

                return this.context.world
                    .edit({
                        type: EDITION_ACTIONS.EDITOR_ADD_ARTWORK,
                        placeholderId: artPayload.data.placeholderId,
                        remotePayload: artPayload,
                        asset: null,
                        autoSelect: false,
                    })
                    .then(() => {
                        //
                        if (this.opts.autoSelect) {
                            this.context.world.edit({
                                type: EDITION_ACTIONS.SET_SELECTED_ITEMS,
                                items: [artPayload.data.id],
                                toggle: true,
                            });
                        }
                    });
            })
        );

        this.updateExhibit((draft) => {
            //
            this.artPayloads.forEach((artPayload) => {
                //
                const artworkId = artPayload.data.id;

                draft.artworks[artworkId] = artPayload;

                restoreScripts(draft, artworkId, this.artScripts[artworkId]);
            });
        });
    }

    async redo() {
        //
        this.runWithOpts(this.opts);
    }
}
