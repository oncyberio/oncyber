// @ts-check

import { SpaceArtwork } from "@3artwork/abstract";

import { getRaycastBox } from '@components/_3DExhibit-v2/three/utils/three'

import {

	Vector3

} from 'three'
import FontWrapper from "./wrapper";

const _vec3 = new Vector3()

export class TextSpaceArtwork extends SpaceArtwork {

    constructor(opts) {

        super(opts);

        this.isUniformScale = false

        /** @type { FontWrapper } */
        this.font = null;

        this.textOpts = null
    }

    updateRaycastMesh(){

    	// this.font.mesh.geometry.computeBoundingBox()


    	this.font.mesh.geometry.boundingBox.getSize( _vec3 )

    	this.raycastMesh.scale.set(_vec3.x, _vec3.y, 1)

    	// this.raycastMesh.visible = true

        // this.raycastMesh.material.wireframe = true
    }

}
