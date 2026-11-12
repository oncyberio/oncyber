

// @ts-check

import { Vector3, PlaneGeometry, Mesh, MeshBasicMaterial } from 'three'


import PortalHistory from '@3history'

import { Portal } from '../portal'

import { PortalPreviewMesh, PORTAL_SHAPES } from '../previewmesh'

import { SpawnPortal } from '.'


class BackPortal extends SpawnPortal {

    constructor() {

        super();

    }

    async get(opts) {

        if(PortalHistory.isEmpty()) return null

        if(this.portal == null) {

            this.portal = await this.create(opts)
        }

        this.active = true

        this.updateCoords(opts)

        // Fix for big destinations
        // We need to preUpdate after we have the right portal position in order to get the right distance (else previewMeshPosition will be at 0,0,0)
        this.portal.preUpdate(0);

        return this.portal

    }

    async create(opts) {

        console.log("CALLED DIRECT");

        let { portalData, backState } = PortalHistory.getLast()

        // create peview mesh

        console.log("yolo" , portalData, backState )


        let previewMesh =  PortalPreviewMesh.create({
            type: PORTAL_SHAPES.RECTANGLE,
            width: this.width,
            height: this.height
        })

        let portal = new Portal({
            ...opts,
            isStaticPortal: false,
            raycastMesh: previewMesh,
            exhibitId: portalData.exhibit?.id,
            placeholderData: {
                portalId: `backto-${portalData.exhibit.id}`,
                meshes: {
                    previewMesh
                }
            },
            portalData,
            backState,
        })

        await portal.initState(false)

        portal.name = portal.placeholderData.portalId;

        previewMesh.name = portal.placeholderData.portalId;

        portal.visible = false

        return portal;
    }
}


export default new BackPortal()
