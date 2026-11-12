// @ts-check

import Textures from '@3textures'

import { Mesh, MeshBasicMaterial, BoxGeometry } from 'three'

import { TYPES } from '../../constants';

import { SitZoneSpaceArtwork } from './zones/sitzonespaceartwork';

// import {

// 	mergeBufferGeometries

// } from 'utils/buffergeometryutils.js'

class TriggerZoneArtwork {

	constructor() {

	}


	async get(opts) {

        const artworkData = opts.item.data

        const raycastMesh = new Mesh(
            new BoxGeometry(1,1,1,1),
            new MeshBasicMaterial({
                color: "#ffff00",
                opacity: 0.3,
                transparent: true,
            })
        );

		let object = new SitZoneSpaceArtwork({

            // Get bouding box of text geometry
            ...opts,

            raycastMesh,

            resources: [raycastMesh],

            type: TYPES.TRIGGER_ZONE
		})

        const sitZone = await object.get();

        raycastMesh.visible = false

        object.add(sitZone);

        object.add(raycastMesh)

        object.userData = {
            ...artworkData,
        }

        object.scale.x = artworkData.scale || 1

        object.scale.y = artworkData.scale || 1

		return object
	}
}


export default new TriggerZoneArtwork()
