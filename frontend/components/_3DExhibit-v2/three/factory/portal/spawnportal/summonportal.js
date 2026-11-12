// @ts-check

import { PortalPreviewMesh, PORTAL_SHAPES } from "../previewmesh"

import PortalFactory from '@3factory/portal'

import { Portal } from '../portal'

import { SpawnPortal } from "."

class SummonPortal extends SpawnPortal {

    constructor() {

        super();
    }

    async summon(opts) {
        // create peview mesh

        let previewMesh =  PortalPreviewMesh.create({
            type: PORTAL_SHAPES.RECTANGLE,
            width: this.width,
            height: this.height,
        })

        const portalData = await PortalFactory.loadPortalData(opts.exhibitId)

        let portal = new Portal({
            ...opts,
            isStaticPortal: false,
            raycastMesh: previewMesh,
            exhibitId: opts?.exhibitId,
            placeholderData: {
                portalId: `summoned-${opts?.exhibitId}`,
                source: opts.source,
                meshes: {
                    previewMesh
                }
            },
            coords: opts.coords,
            portalData
        })

        await portal.loadPortalData()

        await portal.initState(false)

        portal.name = portal.placeholderData.portalId;

        previewMesh.name = portal.placeholderData.portalId;

        portal.visible = true

        this.portal = portal;

        this.updateCoords();

        return portal;
    }

}

export default new SummonPortal()
