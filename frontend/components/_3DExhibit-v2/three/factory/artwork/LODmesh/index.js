// @ts-check


import { isTransparent } from "@3utils/mediatype"

import { LODMesh } from "./LODmesh"

import { MeshBasicMaterial, PlaneGeometry, MeshLambertMaterial } from "three"

import { EDIT_MODE, DISABLE_LOD } from "@3gl/constants"




import { getMediaLODUrls } from "@utils/metadata/reformatAsset"


const defGeo = new PlaneGeometry()

const defMat = new MeshBasicMaterial()


export class LODMeshLoader {

    constructor() {}

     /**
     *
     * @param { import("@gltypes").ArtworkOptions & { video?: HTMLVideoElement, image?: HTMLImageElement } } opts
     * @param { "IMAGE_MEDIA" | "VIDEO_MEDIA" | "PANORAMA_MEDIA" } mediatype
     */
      async get(opts, mediatype) {

        const artworkData = opts.item.data

        let lod = opts.overrideUrl || opts.video ?
                        {
                            // Include the alt URL (when provided) so a failed
                            // primary image falls back via loadAlts instead of
                            // failing the whole artwork.
                            hi: { type: mediatype, video: opts.video, urls: opts.overrideUrlAlt ? [opts.overrideUrl, opts.overrideUrlAlt] : [opts.overrideUrl] },
                            lo: null
                        } :
                        await getMediaLODUrls(artworkData)

        if(DISABLE_LOD || opts.isPreview && EDIT_MODE) {
            lod.lo = null
        }

        const materialParams = {
            polygonOffset: true,
            polygonOffsetFactor: -2.0,
            polygonOffsetUnits: -8.0,
            transparent: isTransparent(opts.overrideMime || artworkData.mime_type),
        }

        let mesh = new LODMesh({
            ...opts,
            geometry: defGeo,
            material: defMat,
            materialParams,
            lod
        });

        mesh.mediaType = mediatype

        await mesh.init()

        return mesh;
    }
}


export default new LODMeshLoader()

export { LODMesh } from "./LODmesh"
