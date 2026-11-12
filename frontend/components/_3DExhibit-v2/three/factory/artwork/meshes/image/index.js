// @ts-check

import { TYPES } from "@3artwork/constants"

import { ImageSpaceArtwork } from "./imagespaceartwork"

import LODMeshLoader from "@3artwork/LODmesh"

import { IMAGE_MEDIA } from "@3utils/mediatype"

import { CHECK_ABORT_SIGNAL } from "@3utils/abort"


class ImageArtwork {

	constructor(){}




    /**
     *
     * @param { import("@gltypes").ArtworkOptions } opts
     * @param { boolean } [isPreview]
     * @returns { Promise<ImageSpaceArtwork> }
     */
	async get( opts, isPreview = false) {

        const artworkData = opts.item.data


        let screen = await LODMeshLoader.get({
            ...opts,
            isPreview
        }, IMAGE_MEDIA)

        CHECK_ABORT_SIGNAL(opts.abort)

        const { dimensions } = screen.userData;

        if( artworkData.borderColor == 'black-borderless'){

            artworkData.borderColor = "#000000"
        }

        const artwork = new ImageSpaceArtwork({
            ...opts,
            type: TYPES.IMAGE,
            mesh: screen,
            raycastMesh: screen,
            resources: [screen]
        })

        artwork.add(screen)

        artwork.setBorder(opts.noInstance)

        artwork.userData = {
            ...artworkData,
            is360: Math.round(screen?.userData?.artworkWidth /  screen?.userData?.artworkHeight) === 2,
            dimensions: artworkData.dimensions || dimensions,
        };

        // scale down artworkGroup here
        artwork.scale.x = artworkData.scale || 1

        artwork.scale.y = artworkData.scale || 1

        return artwork
    }
}

export default new ImageArtwork()
