// @ts-check

import {

    Euler,
    PerspectiveCamera,
	PlaneGeometry,
    Vector3
} from 'three'

import { PortalContainer } from './portalcontainer';

import { Portal } from './portal';

import PlaceholderFactory from './portalplaceholder'


import { noop, parseLocation } from '@utils/js';

import { artworkDepth } from '../../utils/spaceutils';

import { PortalPreviewMesh, PORTAL_SHAPES } from './previewmesh';

import { getPortalDestination, getPortalOwner, getPortalPreviewExhibit } from '@utils/csr';

import { SPACE_EVENTS } from '../space/space';

import { CHECK_ABORT_SIGNAL, IS_ABORT_ERROR } from '../../utils/abort';
import { formatExhibit } from '@utils/metadata/formatExhibit';
import { CURRENT_SPACE, USER_HEIGHT } from '../../constants';
import { getUserInitialPositions } from '../../utils/camera';



export const DEF_PORTAL_HEIGHT = USER_HEIGHT * 2

export const DEF_PORTAL_WIDTH = DEF_PORTAL_HEIGHT * 0.63


/** Portals built per task when a world holds many of them. */
export const PORTAL_BUILD_SLICE = 48

/**
 * Calls `fn` for every item, `size` items per task, yielding to the event
 * loop between slices. Stops when `signal` aborts. Errors stay per item.
 * @template T
 * @param { T[] } items
 * @param { number } size
 * @param { AbortSignal } signal
 * @param { (item: T) => unknown } fn
 */
export async function forEachInSlices(items, size, signal, fn) {

    const list = Array.from(items || [])

    for(let i = 0; i < list.length; i += size) {

        if(signal?.aborted) return

        if(i > 0) await new Promise(resolve => setTimeout(resolve, 0))

        if(signal?.aborted) return

        for(const item of list.slice(i, i + size)) {

            Promise.resolve().then(() => fn(item)).catch(err => console.error(err))
        }
    }
}

class PortalFactory {

	constructor(){

		this.lastPortal = null

		this.defaultPlane = new PlaneGeometry(1,1,1,1)

	}

    /**
     * @param { import('@gltypes').SpaceStateOptions } opts
     * @returns { PortalContainer }
     */
	get(opts) {

        let container = opts.space.portalContainer

        if(container != null) {

            return container
        }

        container = new PortalContainer(opts)


        let portals =  Object.values(opts.exhibit.portals || {});


        //
        let abortController = new AbortController()

        const fireAbortSignal = () => {

            abortController.abort("Space disposed")
        }

        opts.space.scene.once(SPACE_EVENTS.DISPOSE, fireAbortSignal)

        // A hub can hold thousands of portals. Building them all in one go
        // blocked the main thread for most of a second, so they are built a
        // slice at a time, each slice in its own task.
        const buildPlaceholderPortal = async (placeholderData) => {


            let portalData = portals.find(it => {

                return it.id === placeholderData.portalId
            })

            if(portalData != null) {
                //
                placeholderData.meshes.originalPreviewMesh.visible = false
            }



            let portal = await this.getPortal({
                ...opts,
                abort: abortController.signal,
                placeholderData,
                exhibitId: portalData?.exhibitId,
                halo: portalData?.halo,
                coords: portalData?.coords,
                cHeroImg360: portalData?.cHeroImg360,
                levels: portalData?.levels
            })

            if(portal != null) {

                container.addPortal(portal)
            }

        }

        forEachInSlices(opts.space.portalPlaceholders, PORTAL_BUILD_SLICE, abortController.signal, buildPlaceholderPortal)

        portals.forEach(async (portalData) => {

            if(portalData.spawn) {

                let portal = await this.getPortal({
                    ...opts,
                    abort: abortController.signal,
                    exhibitId: portalData?.exhibitId,
                    spawn: portalData?.spawn,
                    coords: portalData?.coords,
                    cHeroImg360: portalData?.cHeroImg360,
                    levels: portalData?.levels
                })

                if(portal != null) {

                    container.addPortal(portal)
                }

            }
        })

        return container
	}

     /**
     * @param { import('@gltypes').PortalFactoryItemOptions } opts
     * @returns { Promise<Portal> }
     */
    async getPortal(opts, initState = true) {

        let loadedData

        if(opts.exhibitId != null) {

            let portalExhibit = opts.exhibit.portalExhibits?.[opts.exhibitId]

            if (portalExhibit) {

                loadedData = {
                    exhibit: portalExhibit,
                    roomParameters:
                        opts.exhibit.portalsDestinations?.[
                            portalExhibit.info.room
                        ],
                    user: opts.exhibit.portalsOwners?.[portalExhibit.owner.toLowerCase()],
                }

            }
        }

        let placeholderData = opts.placeholderData

        let spawn = opts.spawn

        if(placeholderData == null && spawn) {

            placeholderData = this.createSpawnPlaceholder(opts)
        }

        let nextIndex;

        if (opts?.levels?.length) {

            // TODO: this applies to portal on the same space only
            if (opts.levels.length > 1 && opts.placeholderData?.portalId) {

                const index = opts.levels.findIndex(level => opts.placeholderData.portalId === level.id);

                if (index === -1) return;

                nextIndex = index - 1 < 0 ? opts.levels.length - 1 : index - 1;

                const level = opts.levels[nextIndex];

                if (level) {

                    opts.exhibitId = level.exhibitId;
                    opts.cHeroImg360 = level.cHeroImg360;
                    opts.coords = level.coords;
                }
            }
        }

        let portal = new Portal({
            ...opts,
            isStaticPortal: true,
            raycastMesh: placeholderData.meshes.previewMesh,
            placeholderData,
            exhibitId: opts.exhibitId,
            cHeroImg360: opts.cHeroImg360,
            coords: opts.coords,
            portalData: loadedData,
            currentLevel: opts?.levels?.[nextIndex]?.id
        })

        if(spawn) {

            const { position, rotation, scale, lock } = spawn

            if(position != null) {
                portal.position.set(position.x, position.y, position.z)
            }

            if(rotation != null) {
                portal.rotation.set(rotation._x, rotation._y, rotation._z)
            }

            if(scale != null) {
                portal.scale.set(scale.x, scale.y, 1)
            }

            if(lock) {

                portal.lock(lock)
            }

        }

        if(initState) {

            try {

                await portal.initState()

                CHECK_ABORT_SIGNAL(opts.abort)
            }
            catch(err) {

                if(IS_ABORT_ERROR(err)) {

                    console.info("Portal initState aborted", portal.opts.exhibitId)

                    portal.dispose()

                    return null
                }

            }
        }

        portal.userData = {
            id: placeholderData.portalId,
            exhibitId: opts.exhibitId,
            placeholderId: spawn?.placeholderId,
            spawn,
            lock: spawn?.lock,
            cHeroImg360: opts.cHeroImg360,
            levels: opts.levels
        }

        return portal
    }


    createSpawnPlaceholder(opts) {

        let previewMesh = this.createPortalPreviewMesh(opts)

        previewMesh.name = `portal-preview-${opts.spawn.portalId}`

        return {
            portalId: opts.spawn.portalId,
            meshes: {
                previewMesh
            }
        }
    }

    createPortalPreviewMesh(opts) {


        let spawn = opts.spawn

        const { position, rotation, scale, portalId, shape } = spawn

        let previewOpts;

        if(shape === PORTAL_SHAPES.CIRCLE) {

            previewOpts = {
                type: shape,
                radius: scale?.x ?? USER_HEIGHT
            }
        }
        else {

            previewOpts = {
                type: PORTAL_SHAPES.RECTANGLE,
                height: DEF_PORTAL_HEIGHT,
                width: DEF_PORTAL_WIDTH,
            }
        }

        // create peview mesh

        let previewMesh = PortalPreviewMesh.create(previewOpts)

        previewMesh.position.z = artworkDepth(opts.roomParameters) * 0.50 + 0.01

        return previewMesh
    }

    /**
     *
     * @param { string } exhibitId
     * @param { import('@gltypes').PortalData } [loadedData]
     * @param { AbortSignal } [signal]
     * @returns { Promise<import('@gltypes').PortalData> }
     */
    async loadPortalData(exhibitId, loadedData = {}, signal) {
        CHECK_ABORT_SIGNAL(signal)
        //
        let sameSpaceExhibit
        let sameSpaceRoomParams
        let sameSpaceUser

        if(exhibitId === CURRENT_SPACE?.exhibit.id) {

            sameSpaceExhibit = CURRENT_SPACE.exhibit

            sameSpaceRoomParams = CURRENT_SPACE.roomParameters

            sameSpaceUser = CURRENT_SPACE.exhibit.ownerData
        }

        let exhibit = (exhibitId === loadedData?.exhibit?.id ? loadedData?.exhibit : null) || sameSpaceExhibit || (await getPortalPreviewExhibit(exhibitId, signal))

        CHECK_ABORT_SIGNAL(signal)

        if(exhibit == null) {
            console.error("Unable to exhibit " + exhibitId);
            return null
        }

        exhibit = formatExhibit(exhibit);

        const [roomParameters, user] = await Promise.all([
            (exhibitId === loadedData?.exhibit?.id ? loadedData?.roomParameters : null) || sameSpaceRoomParams || getPortalDestination(exhibit.info.room, signal),
            (exhibitId === loadedData?.exhibit?.id ? loadedData?.user: null) || sameSpaceUser || getPortalOwner(exhibit.owner, signal)
        ])

        CHECK_ABORT_SIGNAL(signal)

        if(roomParameters == null) {
            console.error("Unable to fetch room " + exhibit.info.room)
            return null
        }

        return {
            exhibit,
            roomParameters,
            user
        }

    }


    /**
     *
     * @param { import("@gltypes").SpaceStateOptions } opts
     * @param {  PerspectiveCamera } camera
     * @param {  (x: any) => void } [onLoad]
     * @returns { PortalContainer }
     */
     loadPreviewPortals(opts, camera, onLoad = noop) {

        return this.get(opts)
     }
}

export default new PortalFactory()

export const PortalPlaceholderFactory = PlaceholderFactory
