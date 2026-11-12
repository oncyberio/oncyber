import { EDITION_ACTIONS } from "@components/_3DExhibit-v2/three/constants";
import type { SpaceItem } from "@components/_3DExhibit-v2/three/factory/abstract/spaceitem";
import { ArtworkData } from "@components/_3DExhibit-v2/three/factory/editor/edit";
import { Asset, FetchedAsset } from "@uitypes/Asset";
import { AbstractCommand } from "./AbstractCommand";
import { CommandState, ExhibitCommandContext } from "./types";

export interface RefreshArtworkCommandOpts {
    artwork: FetchedAsset;
    artworkId: string;
}

export class RefreshArtworkCommand extends AbstractCommand {
    //

    data: Asset;

    file: Blob;

    constructor(
        context: ExhibitCommandContext,
        public opts: RefreshArtworkCommandOpts
    ) {
        super(context);
    }

    async runImpl() {
        //
        let { world } = this.context;

        let { artwork, artworkId } = this.opts;

        let item = this.exhibit.artworks[artworkId];

        let currentData = item.data;

        if (item == null) {
            throw new Error("Artwork was deleted!");
        }

        const { position, rotation, scale, data: actualData, ...props } = item;

        const sameType = currentData.mime_type === artwork.mime_type;

        const copy = sameType
            ? {
                  ...currentData,
                  ...props,
              }
            : {
                  id: currentData.id,
                  addedBy: currentData.addedBy,
                  sharedBy: currentData.sharedBy || null,
                  curatorNotes: item?.curatorNotes || "",
                  hasBorder: !!currentData.hasBorder,
                  borderColor: currentData.borderColor || null,
                  scale: currentData.scale || null,
              };

        let artworkData = {
            ...copy,
            ...artwork,
        };

        delete artworkData.compressed_image_url;
        delete artworkData.dcompressed_image_url;
        delete artworkData.compressed_animation_url;
        delete artworkData.dcompressed_animation_url;

        this.editorAction = {
            type: EDITION_ACTIONS.EDITOR_ADD_ARTWORK,
            placeholderId: artworkId,
            asset: artworkData,
            artworkDataProps: props,
        };

        let result = await world.edit(this.editorAction);

        if (result == null) {
            throw new Error("Couldn't find the artwork!");
        }

        const { data, file } = result;

        this.file = file;

        this.data = data;

        this.updateExhibit((draft) => {
            //
            draft.artworks[artworkId].data = data;
        });
    }
}
