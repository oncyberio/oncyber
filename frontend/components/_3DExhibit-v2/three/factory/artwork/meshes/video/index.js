// @ts-check




import { TYPES } from '@3artwork/constants'

import { SpaceArtwork } from "@3artwork/abstract"

import { VideoSpaceArtwork } from "./videospaceartwork"


import { VIDEO_MEDIA } from "@3utils/mediatype"

import LODMeshLoader from "@3artwork/LODmesh"






class VideoArtwork {

    constructor() {}

    /**
     *
     * @param { import("@gltypes").ArtworkOptions } opts
     * @returns { Promise<SpaceArtwork> }
     */
    async get(opts) {

        const artworkData = opts.item.data

        let screen = await LODMeshLoader.get({
            ...opts,
            // overrideUrl: "https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8",
        }, VIDEO_MEDIA)


        const { dimensions } = screen.userData;

        const artwork = new VideoSpaceArtwork({
            ...opts,
            type: TYPES.VIDEO,
            mesh: screen,
            raycastMesh: screen,
            resources: [screen]
        });

        artwork.add(screen)

        artwork.setBorder(opts.noInstance)

        artwork.name = artworkData.name;
        artwork.userData = {
            ...artworkData,
            videoDimensions: artworkData.videoDimensions || dimensions,
        };

        artwork.scale.x = artworkData.scale || 1;
        artwork.scale.y = artworkData.scale || 1;

        return artwork;
    }


}

export default new VideoArtwork()
