// @ts-check

import { BoxGeometry, Mesh, MeshBasicMaterial } from "three";

import loader from "@3loader"

import { isUrlOk } from "@utils/urlUtils"

import { SpaceArtwork } from "@3artwork/abstract"

import ImageArtwork from "@3artwork/meshes/image"

import VideoArtwork from "@3artwork/meshes/video"

import { TYPES } from "@3artwork/constants"

import { AudioSpaceArtwork } from "./audiospaceartwork"


class AudioArtwork {
    constructor() {}


     /**
     *
     * @param { import("@gltypes").ArtworkOptions } opts
     * @returns { Promise<SpaceArtwork
     * > }
     */
    async get(opts) {

        const artworkData = opts.item.data

        let srcUrl =
            artworkData?.dcompressed_animation_url ||
            artworkData?.compressed_animation_url ||
            artworkData?.animation_url;

        // Ping to see if url is ok and display an early error feedback
        // Actual loading is delayed until first user interaction
        if (!(await isUrlOk(srcUrl))) {

            srcUrl = null;

            console.error("[loadAudio] Error loading audio at ", srcUrl)

            let alternateUrl = artworkData?.animation_original_url

            console.log("[loadVideo] trying alternate url ", alternateUrl)

            if (!opts.overrideUrl && alternateUrl && alternateUrl != srcUrl) {

                if (await isUrlOk(alternateUrl)) {

                    srcUrl = alternateUrl
                }
            }
        }
        if (srcUrl == null) {
            throw new Error(
                "Unable to load audio at " + artworkData?.animation_original_url
            );
        }

        let boxSize = 4

        if(opts.roomParameters.placeholderSize) {

            boxSize = opts.roomParameters.placeholderSize[0]
        }

        let coverUrl = artworkData.dcompressed_image_url || artworkData.image_url

        if (coverUrl) {

            let coverImage = null

            let coverMimeType = artworkData.cover_mime_type

            let coverOpts = { ...opts, overrideUrl: coverUrl, overrideMime: coverMimeType }

            if (coverMimeType?.includes("video")) {

                coverImage = await VideoArtwork.get(coverOpts)
            } else {

                coverImage = await ImageArtwork.get(coverOpts);
            }

            coverImage.scale.x = 1

            coverImage.scale.y = 1

            const artwork = new AudioSpaceArtwork({
                ...opts,
                type: TYPES.AUDIO,
                coverImage,
                raycastMesh: coverImage.raycastMesh,
                url: srcUrl,
                resources: [coverImage]
            })

            artwork.add(coverImage)

            artwork.userData = coverImage.userData,

            coverImage.userData = {};

            artwork.scale.x = artworkData?.scale || 1

            artwork.scale.y = artworkData?.scale || 1

            return artwork
        }

        let mesh = new Mesh(
            new BoxGeometry(boxSize, boxSize, boxSize),
            new MeshBasicMaterial({
                color: "red",
                transparent: true,
                opacity: 0,
            })
        )

        let gltf = await loader.loadGLTF("/models/sound.gltf")

        gltf.scene.scale.set(boxSize * 2.5, boxSize * 2.5, boxSize * 2.5)

        mesh.add(gltf.scene)

        let artwork = new AudioSpaceArtwork({
            ...opts,
            type: TYPES.AUDIO,
            url: srcUrl,
            raycastMesh: mesh,
            resources: [mesh]
        })

        artwork.userData = {
            ...artwork.userData,
            ...artworkData,
            isBackgroundAudio: opts.item.isBackgroundAudio,
            volume: opts.item.volume,
        }

        artwork.add(mesh)

        return artwork

    }
}

export default new AudioArtwork()
