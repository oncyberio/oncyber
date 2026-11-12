// @ts-check


import {  PlaneGeometry, Vector3, CircleGeometry } from "three"

import Emitter from "@3emitter"

import Events from "@3events"

import Camera from "@3camera"

import { MAX_PLAY_DISTANCE_SQ, MAX_HI_IMAGE_DISTANCE_SQ } from "@3constants"

import { ArtworkMesh } from "./artworkmesh"

import { CHECK_ABORT_SIGNAL, combineAbortSignals, IS_ABORT_ERROR } from "@3utils/abort"

import { disposeMaterial } from "@3utils/three"

import LODMaterial from "./materials"
import { LoadingMaterial } from "./materials/loadingmaterial"
import { queueMediaUpgrade } from "@utils/media/upgrades"

import { getMediaDimensions } from "@utils/metadata/reformatAsset"



/**
 * @typedef { import("./materials").LODMaterial | LoadingMaterial } LODMaterial
 */

/**
 *
 * @typedef {object} LODMeshSpecOptions
 * @property {object} materialParams
 * @property { { hi: import("./materials").LODParams, lo: import("./materials").LODParams } } lod
 *
 *
 * @typedef { LODMeshSpecOptions & import("./artworkmesh").ArtworkMeshOpts } LODMeshOptions
 **/


const v3Pos = new Vector3()

const worldPosition = new Vector3()

const cameraPosition = new Vector3()

/** Levels of detail an artwork can want; LO_UNLOAD also frees the full size. */
export const LOD_TARGET = {
    HI: "hi",
    LO: "lo",
    LO_UNLOAD: "lo-unload",
}


// const LOAD_HI_DISTANCE_SQ = MAX_PLAY_DISTANCE_SQ

// const UNLOAD_HI_DISTANCE_SQ = LOAD_HI_DISTANCE_SQ * 4


function logError(err) {
    console.error(err)
}

export class LODMesh extends ArtworkMesh {

    /**
     *
     * @param { LODMeshOptions } opts
     */
    constructor(opts) {

        super(opts)

        this.isLODMesh = true

        this.opts = opts

        this.item = opts.item

        this.lod = opts.lod

        /** @type { import("./materials").LODMaterial } */
        this.hiMaterial = null

        /** @type { LODMaterial } */
        this.loMaterial = null

        /** @type { import("./materials").LoadMaterialOpts } */
        this.loadMaterialOpts = {
            ...opts,
            mesh: this
        }

        // determine low / hi / toggle distance

        this.LOAD_HI_DISTANCE_SQ   = this.computeLoadHiDistanceSq()

        this.UNLOAD_HI_DISTANCE_SQ = this.LOAD_HI_DISTANCE_SQ * 4

        this.isTransitionning = false

        this.shape = opts.item.data?.shape;

        this.forceHI = false

        // this.forceLOD = 
    }

    computeLoadHiDistanceSq() {

        let baseDist = this.lod.hi.type == 'IMAGE_MEDIA' ? MAX_HI_IMAGE_DISTANCE_SQ : MAX_PLAY_DISTANCE_SQ

        const geometry = /** @type {PlaneGeometry} */ (this.geometry)
        let maxWH = Math.max( geometry.parameters.width * geometry.parameters.height) || 1

        let scale = this.opts.item.scale?.x || this.opts.item.data.scale || 1

        return baseDist * (Math.max(1, scale * maxWH / 5) ** 2)
    }

    async init() {

        if(this.opts.preview?.mesh instanceof LODMesh) {

            const lodMesh = this.opts.preview.mesh

            this.loMaterial = lodMesh.hiMaterial

            /** @type { LODMaterial } */
            this.material = this.loMaterial

            // this.originalMaterial = this.loMaterial
        }

        this.opts.preview = null

        // THIS MUST BE CALLED BEFORE useHiTexture below

        this.abortController = new AbortController()

        this.abort = combineAbortSignals([ this.abortController.signal, this.opts.abort ])

        this.opts.abort?.addEventListener(

            "abort",

            () => {

                // console.log((new Date()).toTimeString(), "LODMESH abort ", this.item.data.name, this.abort?.aborted)

                this.dispose()
            },

            { once: true }
        )

        try {
            // Show the small preview first. POST_UPDATE upgrades nearby media
            // after the mesh is visible, without occupying the initial queue.
            if (this.lod.lo) await this.useLoMaterial()
            else if (this.canUseLoadingMaterial()) this.useLoadingMaterial()
            else await this.updateLODFromPosition(this.item.position)

            CHECK_ABORT_SIGNAL(this.abort)

            this.updateMediaDimensions(this.material.dimensions)

            if(this.lod.lo || this.loMaterial) {
                this.addEvents()
            }

            const geometry = /** @type {PlaneGeometry} */ (this.geometry)
            this.userData = {
                ...this.item.data,
                artworkWidth: geometry.parameters.width,
                artworkHeight: geometry.parameters.height,
            }
        } catch(err) {

                throw err
        }
    }


    canUseLoadingMaterial() {
        return this.lod.hi.type === "VIDEO_MEDIA" && !this.opts.isPreview && !this.lod.hi.video
    }

    useLoadingMaterial() {
        this.loMaterial ||= new LoadingMaterial(this.item.data, this.opts.materialParams)
        this.state = "lo"
        this.setMaterial(this.loMaterial)
    }

    updateMediaDimensions(dimensions) {
        const { depth, ...size } = getMediaDimensions({
            ...dimensions,
            artworkData: this.item.data,
            roomParameters: this.opts.roomParameters
        })
        let { width, height } = size
        if(this.shape === "circle") width = height
        if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return
        const currentGeometry = /** @type {PlaneGeometry} */ (this.geometry)
        if (this.geometryReady && currentGeometry.parameters.width === width &&
            currentGeometry.parameters.height === height) return
        if (this.geometryReady) this.geometry.dispose()
        const geometry = this.shape === "circle" ?
            new CircleGeometry(width / 2, 32) : new PlaneGeometry(width, height)
        Object.assign(geometry.parameters, { width, height })
        this.geometry = /** @type {PlaneGeometry} */ (geometry)
        this.geometryReady = true
        this.position.z = depth * 0.50
        this.userData.artworkWidth = width
        this.userData.artworkHeight = height
        // A video without a poster may only reveal its true ratio on decode.
        // Keep its border attached to the new surface instead of stretching it.
        const artwork = /** @type {import("../abstract").SpaceArtwork} */ (this.parent)
        if (artwork?.mesh === this) {
            artwork.setBorder()
            artwork.updateBorderInstance()
        }
    }

    get videoController() {

        // @ts-ignore
        return this.material?.videoController
    }

    get audioController() {

        // @ts-ignore
        return this.material?.audioController
    }

    /**
     *
     * @param {LODMaterial} material
     * @returns
     */
     setMaterial(material) {

        if(material == null || material === this.material) return

        const previousMaterial = this.material
        previousMaterial.active = false

        this.material = material

        this.material.active = true

        this.material.needsUpdate = true

        if (this.geometryReady && previousMaterial instanceof LoadingMaterial && !(material instanceof LoadingMaterial)) {
            this.updateMediaDimensions(material.dimensions)
        }

        this.diffuseMaterial  = this.material

        this.mirrorMaterial   = this.material
    }

    /**
     *
     * @param {import("@gltypes").XYZ} position
     * @returns
     */
    async updateLODFromPosition(position) {

        const target = this.lodTarget(position)

        if(target === LOD_TARGET.HI) {

            return this.useHiMaterial()
        }

        await this.useLoMaterial()

        if(target === LOD_TARGET.LO_UNLOAD) {

            this.unloadHiMaterial()
        }
    }

    /**
     * Which level of detail the artwork wants at `position`, decided without
     * loading anything.
     *
     * @param {import("@gltypes").XYZ} position
     * @returns { string } a LOD_TARGET
     */
    lodTarget(position) {

        if( this.forceHI || (this.lod.lo == null && !this.loMaterial) ) {

            return LOD_TARGET.HI
        }

        cameraPosition.copy(Camera.current.position)

        v3Pos.set(position.x, cameraPosition.y, position.z)

        const distanceSq = v3Pos.distanceToSquared(cameraPosition)

        if(distanceSq < this.LOAD_HI_DISTANCE_SQ) return LOD_TARGET.HI

        return distanceSq > this.UNLOAD_HI_DISTANCE_SQ
            ? LOD_TARGET.LO_UNLOAD
            : LOD_TARGET.LO
    }

    /**
     * True when updateLODFromPosition would change nothing: the material in
     * use already matches (useHi/LoMaterial return at once) and there is no
     * full-size material to release.
     *
     * @param { string } target a LOD_TARGET
     */
    isSettled(target) {

        if(target === LOD_TARGET.HI) return this.state === "hi"

        if(this.state !== "lo") return false

        return target === LOD_TARGET.LO || this.hiMaterial == null
    }

    CHECK_ABORT() {

        CHECK_ABORT_SIGNAL(this.abort)
    }


    async useHiMaterial() {

        if(this.state == "hi") return

        this.state = "hi"

        // console.log("LODMesh -> hi")

        if(this.hiMaterial == null) {

            try {

                this.hiLoad ||= queueMediaUpgrade(
                    async signal => {
                        const material = await LODMaterial.loadMaterial(this.lod.hi, this.loadMaterialOpts, signal)
                        if (signal.aborted || this.wasDisposed) {
                            disposeMaterial(material)
                            CHECK_ABORT_SIGNAL(signal)
                            throw new Error("Artwork disposed")
                        }
                        return material
                    },
                    this.abort,
                    this.item?.distanceToCamera || 0
                )
                this.hiMaterial = await this.hiLoad
                this.hiLoad = null

            } catch(err) {

                this.hiLoad = null
                if(this.wasDisposed || IS_ABORT_ERROR(err)) {

                    // console.info("[LODMesh/loadHiTexture] task cancelled ", type, this.item.data.mime_type, this.item?.data?.name)

                    throw err
                }

                if (this.lod.lo || this.loMaterial) {
                    await this.useLoMaterial()
                    // Keep the poster; do not retry a failed movie every frame.
                    this.state = "hi"
                    return
                }
                throw err
            }
        }

        if(this.hiMaterial != null && this.state === "hi") {

            this.setMaterial(this.hiMaterial)
        }
    }

    async useLoMaterial() {

        if(this.state == "lo") return

        this.state = "lo"


        if(this.loMaterial == null) {

            try {

                this.loMaterial = await LODMaterial.loadMaterial(this.lod.lo, this.loadMaterialOpts, this.abort)
            }
            catch(err) {

                if(this.wasDisposed || IS_ABORT_ERROR(err)) {

                    // console.info("[LODMesh/loadHiTexture] task cancelled ", this.item?.data?.name)

                    throw err
                }

                // A missing movie poster must not occupy an initial artwork
                // slot until the full movie downloads. Keep the local loader.
                if (this.canUseLoadingMaterial()) {
                    this.lod.lo = null
                    this.useLoadingMaterial()
                    return
                }
                // A missing thumbnail must not hide a working original.
                this.lod.lo = null
                this.state = null
                await this.useHiMaterial()
                return
            }
        }

        if(this.loMaterial != null && this.state === "lo") {

            this.setMaterial(this.loMaterial)
        }

    }

    unloadHiMaterial() {

        if(this.hiMaterial) {

            console.log("LODMesh -> unload")

            disposeMaterial(this.hiMaterial)

            this.hiMaterial = null
        }
    }



    /**
     *
     * @param { string } url
     * @param { import("./materials").LODMediaType } type
     * @param { import("@gltypes").ArtworkOptions } _opts
     */
    async updateMedia(url, type, _opts) {

        this.hi = {
            type,
            urls: [url]
        }

        if(this.hiMaterial != null) {

            const opts = {
                ..._opts,
                materialParams: this.opts.materialParams,
                mesh: this
            }

            const pervMaterial = this.hiMaterial

            this.hiMaterial = await LODMaterial.updateMedia({ url, type,  opts }, this.hiMaterial, this.abort)

            this.setMaterial(this.hiMaterial)

            if(pervMaterial !== this.hiMaterial) {

                disposeMaterial(pervMaterial)
            }
        }

    }

    postUpdate = () => {

        if(!this.enabled || this.wasDisposed) {

            console.error("[Potential memory leak] LODMesh.postUpdate after dispose/removeEvents")

            return
        }

        // Prevents switching material in this middle of e-detail transition
        if(this.isTransitionning) return

        worldPosition.setFromMatrixPosition(this.matrixWorld)

        // Runs for every artwork on every frame: decide synchronously, and
        // start the async switch only when something has to change.
        if(this.isSettled(this.lodTarget(worldPosition))) return

        this.updateLODFromPosition(worldPosition).catch(logError)
    }


    addEvents() {

        if(this.enabled) return

        this.enabled = true

        Emitter.on(Events.POST_UPDATE, this.postUpdate)
    }

    removeEvents() {

        this.enabled = false

        Emitter.off(Events.POST_UPDATE, this.postUpdate)
    }

    dispose() {

        if(this.wasDisposed) return

        if(this.opts.isPreview) {

            this.hiMaterial = null

            this.material = null
        }

        super.dispose()

        if(this.loMaterial) {

            disposeMaterial(this.loMaterial)

            this.loMaterial = null
        }

        if(this.hiMaterial) {

            disposeMaterial(this.hiMaterial)

            this.hiMaterial = null
        }

        this.removeEvents()

        this.opts = null

        this.lod = null

        this.abortController.abort("disposed")

    }
}
