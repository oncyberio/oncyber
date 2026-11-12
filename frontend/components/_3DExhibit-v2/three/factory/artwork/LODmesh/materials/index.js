
// @ts-check

import Loader from "@3loader"
import { releaseArtworkVideo } from "@utils/media/video"

import { IMAGE_MEDIA, PANORAMA_MEDIA, VIDEO_MEDIA } from "@3utils/mediatype"
import { ABORT_MSG, CHECK_ABORT_SIGNAL } from "@components/_3DExhibit-v2/three/utils/abort"
import { Object3D } from "three"

import { capDecodedImage } from "../../../../utils/textureLimit"


import { ImageMaterial } from "./imagematerial"
import THREE60Material from "./THREE60Material"
import { VideoMaterial } from "./videomaterial"

/**
 * @typedef { ImageMaterial | VideoMaterial | THREE60Material} LODMaterial
 *
 *
 * @typedef {object} LODVideoParams
 * @property {"VIDEO_MEDIA"} type
 * @property {HTMLVideoElement} [video]
 * @property {string[]} urls
 *
 * @typedef {object} LODImageParams
 * @property {"IMAGE_MEDIA"} type
 * @property {HTMLImageElement | ImageBitmap} [image]
 * @property {string[]} urls
 * @property {{ width: number, height?: number | null }} [decodeLimit]
 *   largest size to decode to (originals from hosts that cannot resize)
 *
 * @typedef {object} LODPanoParams
 * @property {"PANORAMA_MEDIA"} type
 * @property {HTMLImageElement | ImageBitmap} [image]
 * @property {string[]} urls
 *
 *
 * @typedef {LODVideoParams | LODImageParams | LODPanoParams } LODParams
 *
 * @typedef {import("@gltypes").ArtworkOptions & { materialParams: object, mesh: Object3D }} LoadMaterialOpts
 *
 * @typedef { LODParams["type"] } LODMediaType
 */


// A video that finishes loading after its mesh is gone has no owner to
// release the media element. Do not attach it to a disposed material.
function releaseUnattachedVideo(video) {
    releaseArtworkVideo(video)
}


class LODMaterialLoader {

    constructor() {}



    /**
     *
     *
     * @param {LODParams } lod
     * @param {LoadMaterialOpts} opts
     * @param { AbortSignal } abort
     * @returns { Promise<LODMaterial> }
     */
     async loadMaterial(lod, opts, abort) {

        if(lod.type === VIDEO_MEDIA) {

            return this.loadVideoMaterial({
                    ...lod,
                    materialParams: opts.materialParams,
                    videoTextureOpts: opts,

                },
                abort
            )

        }
        else if(lod.type === IMAGE_MEDIA) {

            return this.loadImageMaterial({
                    ...lod,
                    materialParams: opts.materialParams
                },
                abort
            )
        }

        else if(lod.type === PANORAMA_MEDIA) {

            return this.loadTHREE60Material({
                ...lod,
                materialParams: opts.materialParams
            },
            abort
        )
        }

    }

    /**
     * @typedef {object} LoadImageMaterialOpts
     * @property {string[]} urls
     * @property {HTMLImageElement | ImageBitmap | HTMLCanvasElement} [image]
     * @property {object} materialParams
     * @property {number} [decodeLimit] largest side in pixels to keep after
     *   decoding (capDecodedImage); none for panoramas
     *
     * @param {LoadImageMaterialOpts} opts
     * @param {AbortSignal} abort
     * @returns { Promise<ImageMaterial> }
     */
    async loadImageMaterial(
        { urls, image, materialParams, decodeLimit },
        abort
    ) {

        if(image == null) {

            image = await Loader.loadImage(
                urls,
                abort,
                false,
            )

            CHECK_ABORT_SIGNAL(abort)

            // An original from a host that cannot resize: keep it no larger
            // than the resized variant of the same level of detail.
            image = await capDecodedImage(image, decodeLimit)

            CHECK_ABORT_SIGNAL(abort)

        }

        return new ImageMaterial({
            materialParams: materialParams,
            image
        })
    }


    /**
     * @typedef {LoadImageMaterialOpts} LoadPanoMaterialOpts
     *
     * @param {LoadPanoMaterialOpts} opts
     * @param {AbortSignal} abort
     * @returns { Promise<THREE60Material> }
     */
     async loadTHREE60Material({ urls, image, materialParams }, abort) {


        if(image == null) {

            image = await Loader.loadImage(
                urls,
                abort,
                false,
            )

            CHECK_ABORT_SIGNAL(abort)

        }

        return new THREE60Material({
            materialParams: materialParams,
            image
        })
    }

    /**
     *
     * @typedef { object } LoadVideoMaterialOpts
     * @property { string[] } urls
     * @property { object } materialParams
     * @property { HTMLVideoElement } [video]
     * @property { import("@gltypes").ArtworkOptions & { mesh: Object3D } } videoTextureOpts
     *
     * @param { LoadVideoMaterialOpts } opts
     * @param {AbortSignal} abort
     * @returns { Promise<VideoMaterial> }
     */
    async loadVideoMaterial({ urls, video, videoTextureOpts, materialParams }, abort) {

        CHECK_ABORT_SIGNAL(abort)

        if(video == null) {

            video = await Loader.loadVideo(urls, abort)

            if(abort?.aborted) releaseUnattachedVideo(video)

            CHECK_ABORT_SIGNAL(abort)
        }

        // Empty URL lists resolve to null in Loader.loadAlts. Keep the normal
        // artwork load-error path instead of constructing a broken controller.
        if(video == null) {

            throw new Error("Unable to load video: no media source was available")
        }

        return new VideoMaterial({
            materialParams,
            videoOpts: {
                ...videoTextureOpts,
                video
            }
        })
    }


     /**
     * @typedef {object} UpdateMediOpts
     * @property { string } url
     * @property { LODMediaType } type
     * @property { LoadMaterialOpts } opts
     *
     * @param {UpdateMediOpts} opts
     * @param {LODMaterial} material
     * @param {AbortSignal} abort``
     */
      async updateMedia({ url, type, opts }, material, abort) {


        if (type === VIDEO_MEDIA) {

            if(material instanceof VideoMaterial) {

                CHECK_ABORT_SIGNAL(abort)

                const video = await Loader.loadVideo([url], abort)

                if(abort?.aborted || material.videoTexture == null || material.videoTexture.wasDisposed) {

                    releaseUnattachedVideo(video)

                    throw new Error(ABORT_MSG)
                }

                if(video == null) {

                    throw new Error("Unable to load video: no media source was available")
                }

                material.updateMedia({
                    ...opts,
                    video
                })

                return material
            }
            else {

                return this.loadVideoMaterial({
                    urls: [url],
                    videoTextureOpts: opts,
                    materialParams: opts.materialParams
                }, abort)
            }
        } else {

            return this.loadMaterial({ type, urls: [url]  }, opts, abort)
        }
    }

}


export default new LODMaterialLoader()
