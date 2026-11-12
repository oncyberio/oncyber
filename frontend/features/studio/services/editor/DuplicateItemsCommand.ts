import { AbstractCommand } from "./AbstractCommand";
import { ExhibitCommandContext } from "./types";
import { DuplicateArtworksCommand } from "./DuplicateArtworksCommand";
import { DuplicateKitbashCommand } from "./DuplicateKitbashCommand";
import { EDITION_ACTIONS } from "@3constants";

export interface DuplicateItemsCommandOpts {
    targetMeshIds: string[];
    autoSelect?: boolean;
}

export class DuplicateItemsCommand extends AbstractCommand {
    //
    duplicateArtsCommand: AbstractCommand;
    duplicateCompsCommand: AbstractCommand;
    // removePortalCommand: AbstractCommand;

    constructor(
        context: ExhibitCommandContext,
        public opts: DuplicateItemsCommandOpts
    ) {
        //
        super(context);

        let portalPayloads = [];
        let componentPayloads = [];
        let artworkPaylods = [];

        opts.targetMeshIds.forEach((id) => {
            //
            if (this.exhibit.portals?.[id]) {
                //
                portalPayloads.push(this.exhibit.portals[id]);
                //
            } else if (this.exhibit.kitbash?.[id]) {
                //
                componentPayloads.push(this.exhibit.kitbash[id]);
                //
            } else if (this.exhibit.artworks[id]) {
                //
                artworkPaylods.push(this.exhibit.artworks[id]);
            }
        });

        if (artworkPaylods.length) {
            this.duplicateArtsCommand = new DuplicateArtworksCommand(context, {
                payloads: artworkPaylods,
                autoSelect: opts.autoSelect,
            });
        }

        if (componentPayloads.length) {
            this.duplicateCompsCommand = new DuplicateKitbashCommand(context, {
                payloads: componentPayloads,
                autoSelect: opts.autoSelect,
            });
        }
    }

    getLabel() {
        //
        return `Duplicate ${this.opts.targetMeshIds.length} items`;
    }

    async runImpl() {
        //
        if (this.opts.autoSelect) {
            await this.context.world.edit({
                type: EDITION_ACTIONS.SET_SELECTED_ITEMS,
                items: [],
            });
        }

        await Promise.all([
            this.duplicateArtsCommand?.runImpl(),
            this.duplicateCompsCommand?.runImpl(),
        ]);
    }

    async undo(): Promise<void> {
        //
        await Promise.all([
            this.duplicateArtsCommand?.undo(),
            this.duplicateCompsCommand?.undo(),
        ]);
    }

    async redo(): Promise<void> {
        //
        await Promise.all([
            this.duplicateArtsCommand?.redo(),
            this.duplicateCompsCommand?.redo(),
        ]);
    }
}
