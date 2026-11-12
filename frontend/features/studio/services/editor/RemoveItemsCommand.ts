import { EDITION_ACTIONS } from "@components/_3DExhibit-v2/three/constants";
import { AbstractCommand } from "./AbstractCommand";
import { RemoveArtworksCommand } from "./RemoveArtworkCommand";
import { RemoveKitbashCommand } from "./RemoveKitbashCommand";
import { RemovePortalsCommand } from "./RemovePortalCommand";
import { ExhibitCommandContext } from "./types";

export interface RemoveItemsCommandOpts {
    targetMeshIds: string[];
    autoSelect?: boolean;
}

export class RemoveItemsCommand extends AbstractCommand {
    //
    removeArtCommand: AbstractCommand;
    removeKitbashCommand: AbstractCommand;
    removePortalCommand: AbstractCommand;

    constructor(
        context: ExhibitCommandContext,
        public opts: RemoveItemsCommandOpts
    ) {
        //
        super(context);

        let portalIds = [];
        let kitbashIds = [];
        let artworkIds = [];

        opts.targetMeshIds.forEach((id) => {
            //
            if (this.exhibit.portals?.[id]) {
                //
                portalIds.push(id);
                //
            } else if (this.exhibit.kitbash?.[id]) {
                //
                kitbashIds.push(id);
                //
            } else if (this.exhibit.artworks[id]) {
                //
                artworkIds.push(id);
            }
        });

        if (artworkIds.length) {
            this.removeArtCommand = new RemoveArtworksCommand(context, {
                targetMeshIds: artworkIds,
                autoSelect: opts.autoSelect,
            });
        }

        if (kitbashIds.length) {
            this.removeKitbashCommand = new RemoveKitbashCommand(context, {
                targetIds: kitbashIds,
                autoSelect: opts.autoSelect,
            });
        }

        if (portalIds.length) {
            this.removePortalCommand = new RemovePortalsCommand(context, {
                targetMeshIds: portalIds,
                autoSelect: opts.autoSelect,
            });
        }
    }

    getLabel() {
        //
        return "Remove";
    }

    async runImpl() {
        //
        await Promise.all([
            this.removeArtCommand?.runImpl(),
            this.removeKitbashCommand?.runImpl(),
            this.removePortalCommand?.runImpl(),
        ]);
    }

    async undo(): Promise<void> {
        //
        await Promise.all([
            this.removeArtCommand?.undo(),
            this.removeKitbashCommand?.undo(),
            this.removePortalCommand?.undo(),
        ]);
    }

    async redo(): Promise<void> {
        //
        await Promise.all([
            this.removeArtCommand?.redo(),
            this.removeKitbashCommand?.redo(),
            this.removePortalCommand?.redo(),
        ]);
    }
}
