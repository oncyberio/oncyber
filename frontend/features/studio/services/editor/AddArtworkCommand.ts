import { EDITION_ACTIONS } from "@components/_3DExhibit-v2/three/constants";
import type { SpaceItem } from "@components/_3DExhibit-v2/three/factory/abstract/spaceitem";
import { ArtworkData } from "@components/_3DExhibit-v2/three/factory/editor/edit";
import { IS_ABORT_ERROR } from "@components/_3DExhibit-v2/three/utils/abort";
import { FetchedAsset } from "@uitypes/Asset";
import { PortalData, Script } from "@uitypes/experience";
import { AbstractCommand } from "./AbstractCommand";
import { ChangeAnimationsOpts } from "./ChangeAnimationsCommand";
import { CommandState, ExhibitCommandContext } from "./types";
import { getScripts, removeScripts, restoreScripts } from "./utils";

export interface AddArtworkCommandOpts {
    artwork: FetchedAsset;
    artworkDataProps?: Partial<ArtworkData>;
    keepPlaceholder: boolean;
    targetMeshId?: string;
    remotePayload?: ArtworkData;
    abort?: AbortSignal;
    autoSelect?: boolean;
}

export class AddArtworkCommand extends AbstractCommand {
    //
    prevArtPayload: ArtworkData;
    prevPortalPayload: PortalData;
    artScripts: Record<string, Script>;
    payload: ArtworkData;
    file: Blob;

    constructor(
        context: ExhibitCommandContext,
        public opts: AddArtworkCommandOpts
    ) {
        super(context);

        this.payload = opts.remotePayload;
    }

    getLabel() {
        //
        const info =
            this.opts.artwork.name ||
            (this.opts.artwork as any).text ||
            "asset";

        return `Add ${info}`;
    }

    async runImpl() {
        //
        const targetMesh = this.getTargetMesh(this.opts.targetMeshId);

        if (
            targetMesh &&
            !targetMesh?.isPlaceholder &&
            !this.opts.keepPlaceholder
        ) {
            //
            if (targetMesh.isArtwork) {
                //
                this.prevArtPayload =
                    this.exhibit.artworks[this.opts.targetMeshId];

                this.artScripts = getScripts(
                    this.exhibit,
                    this.opts.targetMeshId
                );
                //
            } else if (targetMesh.isPortal) {
                //
                this.prevPortalPayload =
                    this.exhibit.portals[this.opts.targetMeshId];
            }
        }

        await this.runWithOpts(this.opts, this.opts.abort);

        if (this.opts.autoSelect) {
            //
            this.context.world.edit({
                type: EDITION_ACTIONS.SET_SELECTED_ITEMS,
                items: [this.payload.data.id],
            });
        }
    }

    async runWithOpts(opts: AddArtworkCommandOpts, abort?: AbortSignal) {
        //
        try {
            let { world } = this.context;

            let { artwork, keepPlaceholder, artworkDataProps, targetMeshId } =
                opts;

            const placeholderId = this.payload
                ? this.payload.data.placeholderId
                : targetMeshId;

            const targetMesh = this.getTargetMesh(placeholderId);

            let result = await world.edit({
                type: EDITION_ACTIONS.EDITOR_ADD_ARTWORK,
                placeholderId: targetMeshId,
                asset: artwork,
                artworkDataProps,
                keepPlaceholder,
                remotePayload: this.payload,
                abort,
            });

            this.emit("3d", result);

            const {
                data,
                rotation,
                position,
                envmap,
                version,
                file,
                animations,
            } = result;

            if (this.payload == null) {
                this.file = file;

                this.payload = {
                    version,
                    data: {
                        ...data,
                        addedBy: artwork.addedBy,
                    },
                    rotation,
                    position,
                    addedBy: artwork.addedBy,
                };

                if (animations != null) this.payload.animations = animations;

                if (envmap) {
                    this.payload.envmap = envmap;
                }
            }

            this.updateExhibit((draft) => {
                //
                draft.artworks[data.id] = this.payload;

                if (targetMesh?.isPortal) {
                    //
                    delete draft.portals[targetMeshId];
                }

                if (this.artScripts) {
                    //
                    removeScripts(draft, data.id);
                }
            });
        } catch (err) {
            //
            if (IS_ABORT_ERROR(err)) {
                return;
            }

            throw err;
        }
    }

    async undo() {
        //
        const placeholderId = this.payload.data.id;

        if (this.prevArtPayload) {
            //
            await this.context.world.edit({
                type: EDITION_ACTIONS.EDITOR_ADD_ARTWORK,
                remotePayload: this.prevArtPayload,
                placeholderId,
                asset: null,
            });

            this.updateExhibit((draft) => {
                //
                delete draft.artworks[this.payload.data.id];

                const prevId = this.prevArtPayload.data.id;

                draft.artworks[prevId] = this.prevArtPayload;

                if (this.artScripts) {
                    //
                    restoreScripts(draft, prevId, this.artScripts);
                }
            });
            //
        } else if (this.prevPortalPayload) {
            //
            await this.context.world.edit({
                type: EDITION_ACTIONS.EDITOR_ADD_PORTAL,
                placeholderId,
                remotePayload: this.prevPortalPayload,
                exhibitId: this.prevPortalPayload.exhibitId,
                coords: this.prevPortalPayload.coords,
            });

            this.updateExhibit((draft) => {
                //
                delete draft.artworks[this.payload.data.id];

                draft.portals[this.prevPortalPayload.id] =
                    this.prevPortalPayload;
            });
        } else {
            //
            await this.context.world.edit({
                type: EDITION_ACTIONS.EDITOR_REMOVE_ARTWORK,
                artworkId: this.payload.data.id,
            });

            this.updateExhibit((draft) => {
                //
                delete draft.artworks[this.payload.data.id];
            });
        }
    }

    async redo() {
        //
        await this.runWithOpts(this.opts);
    }
}
