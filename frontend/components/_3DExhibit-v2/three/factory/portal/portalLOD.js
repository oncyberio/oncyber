// @ts-check

import Events from "@3events"

import Emitter from "@3emitter"

import Camera from "@3camera"

import { CURRENT_SPACE, LOAD_PORTAL_DISTANCE_SQ, LOAD_PORTAL_INFO_DISTANCE_SQ, MAX_PLAY_DISTANCE_SQ } from "@3constants"

import { STATES } from "./constants"

import { JobQueue } from "@3utils/jobqueue"

import { IS_ABORT_ERROR } from "@3utils/abort"


/**
 * @typedef { 1 } NOT_LOADED
 * @typedef { 2 } LOADING
 * @typedef { 3 } LOADED
 * @typedef { 4 } LOADING_INFO
 * @typedef { 5 } LOADED_INFO
 *
 * @typedef { 1 | 2 | 3 | 4 | 5 } LODState
 */


export const LOD_STATES = {
    NOT_LOADED: 1,
    LOADING: 2,
    LOADED_IMAGE: 3,
    LOADING_INFO: 4,
    LOADED_INFO: 5
}

export class PortalLOD {

    /**
     * @typedef { object } PortalLODOpts
     * @property { import("./portal").Portal } portal
     * @property { boolean } enable
     *
     */

    static portalJobQueue = new JobQueue({ maxConcurrent: 30 })

    /**
     * @param { PortalLODOpts } opts
     */
    static async create(opts) {

        const lod = new PortalLOD(opts)

        if(opts.enable) {

            lod.addEvents()
        }
        else {

            await lod.load()
        }

        return lod
    }


    /**
     *
     * @param { PortalLODOpts } opts
     */
    constructor(opts) {

        this.opts = opts

        this.portal = opts.portal

        this.LOAD_PORTAL_DISTANCE_SQ = LOAD_PORTAL_DISTANCE_SQ

        this.UNLOAD_PORTAL_SQ = this.LOAD_PORTAL_DISTANCE_SQ * 2

        this.LOAD_PORTAL_INFO_DISTANCE_SQ = LOAD_PORTAL_INFO_DISTANCE_SQ


        this.currentState = LOD_STATES.NOT_LOADED
    }

    reset() {

        this.currentState = LOD_STATES.NOT_LOADED
    }

    load = async () => {

        try {
            const loaded = await this.portal.loadPortalData()

            if(loaded) {

                await this.portal.setState(STATES.CLOSE)

                this.currentState = LOD_STATES.LOADED_IMAGE
            }
            else {

                this.currentState = LOD_STATES.NOT_LOADED

                this.removeEvents()

                setTimeout(() => {

                    this.portal.setState(STATES.EMPTY)
                })
            }
        }
        catch(err) {

            if(IS_ABORT_ERROR(err)) {

                console.info("PortalLoad load cancelled")

                return
            }

            console.error(err)
        }
    }

    async queueLoadJob() {

        if(this.currentState > LOD_STATES.NOT_LOADED) return

        this.currentState = LOD_STATES.LOADING

        await PortalLOD.portalJobQueue.addJob(
            this,
            this.load
        )
    }

    unload() {

        this.currentState = LOD_STATES.NOT_LOADED

        console.log("portalLOD unload portal")

        PortalLOD.portalJobQueue.removeJob(this)

        this.portal.setState(STATES.EMPTY)
    }


    async loadPortalInfo() {

        try {
            if(this.currentState >= LOD_STATES.LOADING_INFO) return

            this.currentState = LOD_STATES.LOADING_INFO

            await this.portal.previewMesh.load2DPrreviewWithInfo()

            // console.log("PortalLOD portal info loaded")

            this.currentState = LOD_STATES.LOADED_INFO
        }
        catch(err) {

            if(IS_ABORT_ERROR(err)) {

                console.info("PortalLoad loadPortalInfo cancelled")

                return
            }

            console.error(err)
        }

    }

    unloadPortalInfo() {

        if(this.currentState <= LOD_STATES.LOADED_IMAGE) return

        console.log("PortalLOD unload portal info")

        this.currentState = LOD_STATES.LOADED_IMAGE
    }

    preUpdate() {

        const portal = this.portal

        if(portal.currentState !== STATES.CLOSE && portal.currentState !== STATES.EMPTY) return


        const distance = portal.getDistanceToCameraSq(Camera.current.position, false)

        if(portal.currentState === STATES.EMPTY) {

            if( distance <= this.LOAD_PORTAL_DISTANCE_SQ) {

                this.queueLoadJob()
            }
        }

        else if(portal.currentState === STATES.CLOSE) {

            if(distance <= this.LOAD_PORTAL_INFO_DISTANCE_SQ && this.portal.opts.space.scene === CURRENT_SPACE.space.scene) {

                this.loadPortalInfo()
            }
            else if(distance <= this.UNLOAD_PORTAL_SQ) {

                // this.unloadPortalInfo()
            }
            else {

                this.unload()
            }
        }
    }

    addEvents(){

        if( this.preUpdateEvent == null ){

            this.preUpdateEvent = this.preUpdate.bind(this)

            Emitter.on(Events.PRE_UPDATE, this.preUpdateEvent)
        }
    }

    removeEvents() {

        if(this.preUpdateEvent != null) {

            Emitter.off(Events.PRE_UPDATE, this.preUpdateEvent)

             this.preUpdateEvent = null
        }

        PortalLOD.portalJobQueue.removeJob(this)
    }


    dispose() {

        this.removeEvents()
    }
}
