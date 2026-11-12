
// @ts-check



import { CSSWrapper } from "./CSSwrapper"

import { CSSEmbedArtwork } from "./CSSembedartwork";

import { TYPES } from "@3artwork/constants"

import { IMAGE_MEDIA } from "@3utils/mediatype";

import LODMeshLoader from "@3artwork/LODmesh";


import { MeshBasicMaterial, PlaneGeometry } from "three";

import { ArtworkMesh } from "../../LODmesh/artworkmesh";



const MAX_SIZE = 200

const DEFAULT_DEPTH = 0.1

class  CSSArtwork {

     /**
     *
     * @param { import("@gltypes").ArtworkOptions } opts
     * @returns { Promise<CSSEmbedArtwork> }
     */

	async get( opts ){

        const artworkData = opts.item.data

        const {
            cssWrapper,
            iframe,
            previewMesh,
            dimensions,
        } = await this.getCssWrapper(opts)

        const htmlEmbed = new CSSEmbedArtwork(
            {
                ...opts,
                cssWrapper,
                iframe,
                type: TYPES.HTML_EMBED,
                previewMesh,
                raycastMesh: cssWrapper.glPlane,
                resources: [cssWrapper]
            }
        )

        // scale down artworkGroup here
        htmlEmbed.scale.x = artworkData?.scale || 1;
        htmlEmbed.scale.y = artworkData?.scale || 1;

        htmlEmbed.setBorder()

        htmlEmbed.userData = {
            ...artworkData,
            dimensions: artworkData?.dimensions || dimensions,
            enableHTMLView: !!artworkData?.enableHTMLView,
        };


        return htmlEmbed;
    }

    /**
     *
     * @param { import("@gltypes").ArtworkOptions } opts
     * @returns
     */
    async getCssWrapper(opts) {

        const artworkData = opts.item.data

        /** @type { import("@gltypes").IArtworkMesh } */
        let previewMesh

        /** @type { number } */
        let artworkWidth, artworkHeight;

        let dimensions = artworkData.dimensions;

        if(artworkData.mime_type !== "embed/html/website" && (artworkData.dcompressed_image_url || artworkData.image_url)) {

            previewMesh = await LODMeshLoader.get({
                ...opts,
                overrideUrl: artworkData.dcompressed_image_url || artworkData.image_url,
                overrideUrlAlt: artworkData.dcompressed_image_url ? artworkData.image_url : null,
            }, IMAGE_MEDIA);

            ({ dimensions, artworkWidth, artworkHeight } = previewMesh.userData);
        }
        else {

            let artworkMaxSize = artworkData.size ||  MAX_SIZE

            let width, height

            if(dimensions) {

                width = dimensions[0]

                height = dimensions[1]
            }

            let defaultSize = 1

            if ((!width && !height) || (artworkData.mime_type !== "embed/html/website" && artworkData.size)) {

                dimensions = [
                    opts.roomParameters.placeholderSize?.[0] || defaultSize,
                    opts.roomParameters.placeholderSize?.[1] || defaultSize
                ];

                dimensions[1] = (dimensions[1] * artworkMaxSize) / dimensions[0]

                dimensions[0] = artworkMaxSize;

                [width, height] = dimensions
            }

            const scaleDown = opts.roomParameters.artworkScale

            artworkWidth = width / scaleDown;

            artworkHeight = height / scaleDown;

            previewMesh = new ArtworkMesh({
                ...opts,
                geometry: new PlaneGeometry(artworkWidth, artworkHeight),
                material: new MeshBasicMaterial({ color: 0x000000 }),
            });
        }


        let depth = DEFAULT_DEPTH

        if(opts.roomParameters.placeholderSize) {

            depth = opts.roomParameters.placeholderSize[2]
        }

        const div = document.createElement("div")
        div.style.backgroundColor = "#ffffff";

        // div.style.backgroundColor = "red"

        const iframe = document.createElement("iframe")
        // Embedded artwork URLs come from gallery data: https only, never our
        // own origin, and sandboxed away from the visitor's session.
        let src = "about:blank"
        try {
            const parsed = new URL(String(artworkData.animation_url ?? ""))
            if (parsed.protocol === "https:" && parsed.origin !== window.location.origin) src = parsed.href
        } catch {}
        iframe.setAttribute("sandbox", "allow-scripts allow-same-origin allow-pointer-lock allow-popups")
        iframe.referrerPolicy = "no-referrer"
        iframe.src = src
        iframe.style.width = "100%"
        iframe.style.height = "100%"

        // Only harmless presentation properties may be set from gallery data.
        const SAFE_PROPERTIES = ["title", "allowFullscreen", "loading"]
        if (artworkData?.properties) {
            Object.keys(artworkData.properties).forEach(key => {
                if (SAFE_PROPERTIES.includes(key)) iframe[key] = artworkData.properties[key];
            })
        }

        div.appendChild(iframe)


        const cssWrapper = new CSSWrapper(
            // @ts-ignore
            div,
            artworkWidth,
            artworkHeight
        )

        cssWrapper.glPlane.userData.artworkWidth = artworkWidth;
        cssWrapper.glPlane.userData.artworkHeight = artworkHeight;
        cssWrapper.glPlane.position.z = depth * 0.50 + 0.01;

        return {
            cssWrapper,
            iframe,
            dimensions,
            artworkWidth,
            artworkHeight,
            previewMesh
        }

    }

    updateDimensions(artwork, dimensions) {
        //
        if(artwork instanceof CSSEmbedArtwork) {

            let wrapper = artwork.cssWrapper

            let scaleDown = artwork.opts.roomParameters.artworkScale

            let width = dimensions[0] / scaleDown

            let height = dimensions[1] / scaleDown

            artwork.mesh.userData.artworkWidth = width

            artwork.mesh.userData.artworkHeight = height

            wrapper.rescale(width, height)

            artwork.rescaleBorder()
        }
    }


}


export default new CSSArtwork()
