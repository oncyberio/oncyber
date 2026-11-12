import { EDITION_ACTIONS } from "@components/_3DExhibit-v2/three/constants";
import type { SpaceItem } from "@components/_3DExhibit-v2/three/factory/abstract/spaceitem";
import { ArtworkData } from "@components/_3DExhibit-v2/three/factory/editor/edit";
import { FetchedAsset } from "@uitypes/Asset";
import { PortalData } from "@uitypes/experience";
import { Deferred, deferred } from "@utils/js";
import { AbstractCommand } from "./AbstractCommand";
import { ChangeAnimationsOpts } from "./ChangeAnimationsCommand";
import { CommandState, ExhibitCommandContext } from "./types";

export interface AddArtworkBulkCommandOpts {
    artworks: FetchedAsset[];
    placeholderIds?: string[];
    remotePayloads?: Record<string, ArtworkData>;
    keepPlaceholder?: boolean;
}

export class AddArtworkBulkCommand extends AbstractCommand {
    //
    payloads: Record<string, ArtworkData> = {};
    files: Record<string, Blob> = {};
    abortController = new AbortController();

    private dbDeferreds: Record<string, Deferred<boolean>> = {};

    dbUpdateId(id: string) {
        //
        return this.dbDeferreds[id]?.promise;
    }

    constructor(
        context: ExhibitCommandContext,
        public opts: AddArtworkBulkCommandOpts
    ) {
        super(context);

        this.payloads = opts.remotePayloads || {};

        opts.placeholderIds.forEach((id) => {
            //
            this.dbDeferreds[id] = deferred();
        });
    }

    getLabel() {
        //
        return `Add artworks`;
    }

    async runImpl() {
        //
        const targetMeshes = this.opts.placeholderIds.map((id) =>
            this.getTargetMesh(id)
        );

        return this.runWithOpts(this.opts);
    }

    async runWithOpts(opts: AddArtworkBulkCommandOpts) {
        //
        const { artworks, placeholderIds, keepPlaceholder } = opts;

        artworks.forEach((artwork, i) => {
            //
            this.runWithOptsSingle({
                artwork,
                targetMeshId: placeholderIds[i],
                keepPlaceholder,
            });
        });
    }

    async runWithOptsSingle(opts: {
        artwork: FetchedAsset;
        targetMeshId: string;
        keepPlaceholder?: boolean;
    }) {
        //
        let { world } = this.context;

        let { artwork, targetMeshId, keepPlaceholder } = opts;

        let result = await world.edit({
            type: EDITION_ACTIONS.EDITOR_ADD_ARTWORK,
            placeholderId: targetMeshId,
            asset: artwork,
            keepPlaceholder,
            remotePayload: this.payloads[targetMeshId],
            abort: this.abortController.signal,
        });

        const { data, rotation, position, envmap, version, file } = result;

        if (this.payloads[targetMeshId] == null) {
            //
            this.files[targetMeshId] = file;

            this.payloads[targetMeshId] = {
                version,
                data: {
                    ...data,
                    addedBy: artwork.addedBy,
                },
                rotation,
                position,
                addedBy: artwork.addedBy,
            };

            if (envmap) {
                this.payloads[targetMeshId].envmap = envmap;
            }
        }

        this.updateExhibit((draft) => {
            //
            const payload = this.payloads[targetMeshId];

            draft.artworks[payload.data.id] = payload;
            //
        }).then(
            () => {
                //
                this.dbDeferreds[targetMeshId].resolve(true);
            },
            (err) => {
                //
                this.dbDeferreds[targetMeshId].reject(err);
            }
        );
    }

    private abort(reason?: string) {
        //
        this.abortController.abort(reason);

        this.abortController = new AbortController();
    }

    async undo() {
        //
        this.abort("undo");

        await Promise.all(
            //
            this.opts.placeholderIds.map(async (id) => {
                //
                const payload = this.payloads[id];

                if (payload) {
                    //
                    await this.context.world.edit({
                        type: EDITION_ACTIONS.EDITOR_REMOVE_ARTWORK,
                        artworkId: payload.data.id,
                    });

                    this.updateExhibit((draft) => {
                        //
                        delete draft.artworks[payload.data.id];
                    });
                }
            })
        );
    }

    async redo() {
        //
        await this.runWithOpts(this.opts);
    }
}
