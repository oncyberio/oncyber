// @ts-check

import Textures from '@3textures'

import { Mesh, MeshBasicMaterial, BoxGeometry } from 'three'

import { TYPES } from '../../constants';

import { GlobalSpaceArtwork } from './globalstreamartwork';

import { IMAGE_MEDIA } from "@3utils/mediatype";

import LODMeshLoader from "@3artwork/LODmesh"


const IMAGE_URL = "https://cyber.mypinata.cloud/ipfs/QmVELbyDKxSNWQNHaHZcbcBWBqQPtbg4dYhnksqY4jwAQk?filename=PNG_9_di03ka.jpeg"





class GlobalStreamArtwork {

	async get(opts) {

        const artworkData = opts.item.data

        const preview = await LODMeshLoader.get({
            ...opts,
            overrideMime: "image/jpeg",
            isPreview: true,
            overrideUrl: IMAGE_URL,
        }, IMAGE_MEDIA)

        preview.scale.set(0.5, 0.5, 0.5)



		let object = new GlobalSpaceArtwork({

            // Get bouding box of text geometry
            ...opts,

            preview, 

            raycastMesh: preview,

            resources: [preview],

            type: TYPES.GLOBAL_STREAM
		})

        await object.get(opts);

        object.userData = {
            ...artworkData,
        }


		return object
	}
}


export default new GlobalStreamArtwork()
