   // @ts-check


import LODMeshLoader from "@3artwork/LODmesh"

import CSSEmbedLoader from "@3artwork/meshes/css"

import { DEFAULTS, TYPES } from "@3artwork/constants"

import { HTMLSpaceArtwork } from "./HTMLspaceartwork"

import { IMAGE_MEDIA, VIDEO_MEDIA } from "@components/_3DExhibit-v2/three/utils/mediatype"

import { CSSHTMLSpaceArtwork } from "./CSSHTMLspaceartwork"

import { CHECK_ABORT_SIGNAL, IS_ABORT_ERROR } from "@3utils/abort"





class HTMLArtwork {

	constructor(){}

    /**
     *
     * @param { import("@gltypes").ArtworkOptions } opts

     */
    async get(opts) {
        return this.getCanvasImpl(opts)
        //return this.getCSSImpl(opts)
    }

    /**
     *
     * @param { import("@gltypes").ArtworkOptions } opts

     */
     async getCSSImpl(opts) {

        const artworkData = opts.item.data

        const {
            cssWrapper,
            previewMesh,
            iframe,
            dimensions
        } = await CSSEmbedLoader.getCssWrapper(opts)



        const htmlArtwork = new CSSHTMLSpaceArtwork({
            ...opts,
            type: TYPES.HTML,
            cssWrapper,
            previewMesh,
            iframe,
            raycastMesh: cssWrapper.glPlane,
            resources: [cssWrapper, previewMesh],
            foreverPlay: !!artworkData.foreverPlay,

        });

        htmlArtwork.add(previewMesh);

        htmlArtwork.setBorder(opts.noInstance)

        htmlArtwork.userData = {
            ...artworkData,
            dimensions: artworkData?.dimensions || dimensions,
        };

        // scale down artworkGroup here
        htmlArtwork.scale.x = artworkData?.scale || 1

        htmlArtwork.scale.y = artworkData?.scale || 1

        return htmlArtwork

    }


    /**
     *
     * @param { import("@gltypes").ArtworkOptions } opts

     */
     async getCanvasImpl(opts) {

        const artworkData = opts.item.data

        // Live HTML artworks used to run their (untrusted, on-chain) markup in a
        // same-origin iframe so the canvas could be captured as a texture,
        // which gave that markup full access to the visitor's Oncyber session.
        // Until they run on an isolated origin, show the artwork's poster.
        const url = artworkData.animation_url || artworkData.image_url
        const htmlText = null

        CHECK_ABORT_SIGNAL(opts.abort)

        const coverMime = opts.item.data.cover_mime_type

        const coverMedia = coverMime?.startsWith("video") ? VIDEO_MEDIA : IMAGE_MEDIA

        let mesh = await LODMeshLoader.get({
            ...opts,
            overrideUrl: artworkData.dcompressed_image_url || artworkData.image_url,
            // Fall back to the alt source if the primary preview fails to load
            // (e.g. a CORS/404 on the remote image). When there's no compressed
            // variant, use an explicit fallback URL if the artwork provides one.
            overrideUrlAlt: artworkData.dcompressed_image_url
                ? artworkData.image_url
                : (artworkData.image_fallback_url || null),
        }, coverMedia)



        CHECK_ABORT_SIGNAL(opts.abort)


        const { dimensions, artworkWidth, artworkHeight } = mesh.userData;



        const htmlArtwork = new HTMLSpaceArtwork({
            ...opts,
            type: TYPES.HTML,
            mesh,
            raycastMesh: mesh,
            htmlText,
            baseUrl: url,
            foreverPlay: !!artworkData.foreverPlay,
            resources: [mesh]
        });

        htmlArtwork.add(mesh);

        htmlArtwork.setBorder()

        htmlArtwork.userData = {
            ...artworkData,
            dimensions: artworkData?.dimensions || dimensions,
        };

        // scale down artworkGroup here
        htmlArtwork.scale.x = artworkData?.scale || 1

        htmlArtwork.scale.y = artworkData?.scale || 1

        return htmlArtwork

    }
}

export default new HTMLArtwork()
