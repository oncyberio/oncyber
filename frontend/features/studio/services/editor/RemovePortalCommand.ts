import { EDITION_ACTIONS } from "@components/_3DExhibit-v2/three/constants";
import type { Portal } from "@components/_3DExhibit-v2/three/factory/portal/portal";
import { PortalData } from "@uitypes/experience";
import { AbstractCommand } from "./AbstractCommand";
import { ExhibitCommandContext } from "./types";

export interface RemovePortalsCommandOpts {
    targetMeshIds: string[];
    autoSelect?: boolean;
}

export class RemovePortalsCommand extends AbstractCommand {
    //
    portalPayloads: PortalData[];

    info: string;

    constructor(
        context: ExhibitCommandContext,
        public opts: RemovePortalsCommandOpts
    ) {
        super(context);

        const targetMeshes = opts.targetMeshIds.map((id) =>
            this.getTargetPortal(id)
        );

        this.info = targetMeshes[0]?.userData.name || "portal";
    }

    getLabel() {
        //
        return `Remove portal ${this.info}`;
    }

    async runImpl() {
        //
        const targetMeshes = this.opts.targetMeshIds.map((id) =>
            this.getTargetPortal(id)
        );

        this.portalPayloads = this.opts.targetMeshIds.map(
            (id) => this.exhibit.portals[id]
        );

        this.portalPayloads.forEach((payload, idx) => {
            //
            if (payload == null) {
                //
                throw new Error(
                    "Unkown portal " + this.opts.targetMeshIds[idx]
                );
            }
        });

        return this.runWithOpts(this.opts);
    }

    async runWithOpts(opts: RemovePortalsCommandOpts) {
        //
        let { world } = this.context;

        let { targetMeshIds: portalIds } = opts;

        await Promise.all(
            portalIds.map((portalId) => {
                //
                return world.edit({
                    type: EDITION_ACTIONS.EDITOR_DELETE_PORTAL,
                    portalId,
                });
            })
        );

        this.updateExhibit((draft) => {
            //
            portalIds.forEach((portalId) => {
                delete draft.portals[portalId];
            });
        });
    }

    async undo() {
        //
        await Promise.all(
            this.portalPayloads.map((portalPayload, idx) => {
                //

                return this.context.world
                    .edit({
                        type: EDITION_ACTIONS.EDITOR_ADD_PORTAL,
                        placeholderId:
                            portalPayload.spawn?.placeholderId ||
                            portalPayload.id,
                        remotePayload: portalPayload,
                        exhibitId: portalPayload.exhibitId,
                        coords: portalPayload.coords,
                    })
                    .then(() => {
                        //
                        if (this.opts.autoSelect) {
                            //
                            this.context.world.edit({
                                type: EDITION_ACTIONS.SET_SELECTED_ITEMS,
                                items: [portalPayload.id],
                                toggle: true,
                            });
                        }
                    });
            })
        );

        this.updateExhibit((draft) => {
            //
            this.opts.targetMeshIds.forEach((id, idx) => {
                //
                draft.portals[id] = this.portalPayloads[idx];
            });
        });
    }

    async redo() {
        //
        this.runWithOpts(this.opts);
    }
}
