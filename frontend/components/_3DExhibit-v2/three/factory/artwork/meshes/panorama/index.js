// @ts-check

import { TYPES } from "@3artwork/constants"

import { PanoramaSpaceArtwork } from "./panoramaspaceartwork"

import LODMeshLoader from "@3artwork/LODmesh"

import { PANORAMA_MEDIA } from "@3utils/mediatype"

import { CHECK_ABORT_SIGNAL } from "@3utils/abort"


class PanoramaArtwork {

	constructor(){}




    /**
     *
     * @param { import("@gltypes").ArtworkOptions } opts
     * @param { boolean } [isPreview]
     * @returns { Promise<PanoramaSpaceArtwork> }
     */
	async get( opts, isPreview = false) {

        const artworkData = opts.item.data

        let screen = await LODMeshLoader.get({
            ...opts,
            isPreview
        }, PANORAMA_MEDIA)

        CHECK_ABORT_SIGNAL(opts.abort)

        const { dimensions } = screen.userData;

        if( artworkData.borderColor == 'black-borderless'){

            artworkData.borderColor = "#000000"
        }

        const artwork = new PanoramaSpaceArtwork({
            ...opts,
            type: TYPES.PANORAMA,
            mesh: screen,
            raycastMesh: screen,
            resources: [screen]
        })

        artwork.add(screen)

        artwork.setBorder()

        artwork.userData = {
            ...artworkData,
            is360: true,
            dimensions: artworkData.dimensions || dimensions,
        };

        // scale down artworkGroup here
        artwork.scale.x = artworkData.scale || 1

        artwork.scale.y = artworkData.scale || 1

        return artwork
    }
}

export default new PanoramaArtwork()
