import { EDITION_ACTIONS } from "@components/_3DExhibit-v2/three/constants";
import { ArtworkData, Experience, PortalData } from "@uitypes/experience";
import { formatLocation } from "@utils/js";
import { uploadPortalPreviews } from "@utils/media/mediaUploader";
import { AbstractCommand } from "./AbstractCommand";
import { ExhibitCommandContext } from "./types";

export interface SetPortalCommandOpts {
    targetExhibit: Experience;
    keepPlaceholder: boolean;
    targetMeshId: string;
    isElevator: boolean;
    autoSelect?: boolean;
}

export class SetPortalCommand extends AbstractCommand {
    //
    payload: PortalData;

    prevArtPayload: ArtworkData;

    prevPortalPayload: PortalData;

    constructor(
        context: ExhibitCommandContext,
        public opts: SetPortalCommandOpts
    ) {
        super(context);
    }

    getLabel() {
        //
        return `add portal ${this.opts.targetExhibit.info?.headline || ""}`;
    }

    async runImpl() {
        //

        const targetMesh = this.getTargetMesh(this.opts.targetMeshId);

        if (targetMesh && !targetMesh.isPlaceholder) {
            //
            if (targetMesh.isArtwork) {
                //
                this.prevArtPayload =
                    this.exhibit.artworks[targetMesh.userData.id];
                //
            } else if (targetMesh.isPortal) {
                //
                this.prevPortalPayload =
                    this.exhibit.portals[targetMesh.userData.id];
            }
        }

        await this.runWithOpts(this.opts);

        if (this.opts.autoSelect) {
            //
            this.context.world.edit({
                type: EDITION_ACTIONS.SET_SELECTED_ITEMS,
                items: [this.payload.id],
            });
        }
    }

    async runWithOpts(opts: SetPortalCommandOpts) {
        //

        const { world, exhibitStore, userId, token, isAnonymous } =
            this.context;

        const exhibit = exhibitStore.exhibit;

        let {
            targetExhibit,
            targetMeshId: portalId,
            keepPlaceholder,
            isElevator,
        } = opts;
        //

        const exhibitId = targetExhibit.id;

        let coords = targetExhibit.info.coords || null;

        const initPos = targetExhibit.params?.initialPlayerPosition;

        const initRot = targetExhibit.params?.initialPlayerRotation;

        if (initPos && initRot) {
            //
            coords = formatLocation(initPos, initRot.y);
        }

        const placeholderId = this.opts.targetMeshId;

        const result: any = await world.edit({
            type: EDITION_ACTIONS.EDITOR_ADD_PORTAL,
            placeholderId,
            exhibitId,
            coords,
            keepPlaceholder,
            remotePayload: this.payload,
        });

        if (result == null) {
            throw new Error("addPortal returned null");
        }

        if (this.payload == null) {
            //

            this.emit("3d");

            portalId = result.update?.spawn?.portalId || placeholderId;

            let cHeroImg, cHeroImg360;

            if (result?.heroImg || result?.heroImg360) {
                //

                let uploadResult = await uploadPortalPreviews(
                    {
                        exhibitId: exhibit.id,
                        portalId: isElevator
                            ? `${portalId}+${exhibitId}`
                            : portalId,
                        heroImg: result?.heroImg,
                        heroImg360: result?.heroImg360,
                    },
                    token,
                    isAnonymous
                );

                if (uploadResult.success === false) {
                    //
                    await world.edit({
                        type: EDITION_ACTIONS.EDITOR_DELETE_PORTAL,
                        portalId,
                    });

                    throw new Error(
                        "Failed to upload hero img " + uploadResult.error
                    );
                }

                cHeroImg = uploadResult.value.url;

                cHeroImg360 = uploadResult.value.url360;

                this.emit("upload");
            }

            this.payload = {
                id: portalId,
                exhibitId,
                ...(result?.update || {}),
                addedBy: userId,
                cHeroImg: cHeroImg || "",
                cHeroImg360: cHeroImg360 || "",
            };
        }

        this.updateExhibit((draft) => {
            //
            draft.portals[portalId] = this.payload;

            if (draft.artworks[portalId]) {
                //
                delete draft.artworks[portalId];
            }
        });
    }

    async undo() {
        //
        const portalId = this.payload.id;

        if (this.prevArtPayload) {
            //

            await this.context.world.edit({
                type: EDITION_ACTIONS.EDITOR_ADD_ARTWORK,
                remotePayload: this.prevArtPayload,
                placeholderId: portalId,
                asset: null,
            });

            this.updateExhibit((draft) => {
                //
                delete draft.portals[portalId];

                draft.artworks[this.prevArtPayload.data.id] =
                    this.prevArtPayload;
            });
            //
        } else if (this.prevPortalPayload) {
            //
            await this.context.world.edit({
                type: EDITION_ACTIONS.EDITOR_ADD_PORTAL,
                placeholderId: portalId,
                remotePayload: this.prevPortalPayload,
                exhibitId: this.prevPortalPayload.exhibitId,
                coords: this.prevPortalPayload.coords,
            });

            this.updateExhibit((draft) => {
                //
                draft.portals[portalId] = this.prevPortalPayload;
            });
        } else {
            //
            await this.context.world.edit({
                type: EDITION_ACTIONS.EDITOR_DELETE_PORTAL,
                portalId,
            });

            this.updateExhibit((draft) => {
                //
                delete draft.portals[portalId];
            });
        }
    }

    async redo() {
        //
        return this.runWithOpts(this.opts);
    }
}
