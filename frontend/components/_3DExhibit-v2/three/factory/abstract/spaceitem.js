// @ts-check


import Events from '@3events'

import Camera from '@3camera'

import AugmentedGroup from '@3abstract/augmentedgroup.js'

import RenderList from "@3gl/globals/renderlist"

import { disposeObject3D, getSelectionHandle } from '@3utils/three'
import { Color, Matrix4, Object3D } from 'three'
import { SpaceComponent } from './spacecomponent'


//

export class SpaceItem extends SpaceComponent {

    /**
     *
     * @param { import('@gltypes').SpaceItemOptions } opts
     */
	constructor(opts){

		super(opts)

        this.roomParameters = opts.roomParameters


        // Scale conversion [UI pixels] <-> [webgl units]
        this.uiScaleFactor = 1

        /** @type { import('three/examples/jsm/renderers/CSS3DRenderer').CSS3DObject } */
        this.cssObject = null

        /** @type { import ('../artwork/meshes/css/CSSwrapper').CSSWrapper } */
        this.cssWrapper = null

        /** @type { Object3D } */
        this.selectionBox = null
	}


    setCoordinates( item ){

        const { position, rotation } = item

        this.position.set(+position.x, +position.y, +position.z)

        this.rotation.set(
            +rotation._x,
            +rotation._y,
            +rotation._z
        )
    }

    /***
     * @param { import('@gltypes').RaycastEvent } e
     */
	raycastCallBack(e){

        // this.callbackOptions.value.active = e.active

        // Emitter.emit(Events.CUSTOM, this.callbackOptions )

	}

    isVisible( mesh ){

        return RenderList.isVisible( mesh )
    }

    /**
     *
     * @param { number } uiSize
     * @returns number
     */
     uiSizeToScale(uiSize) {
        return uiSize / this.uiScaleFactor;
    }

    /**
     *
     * @param { number } uiSize
     * @returns number
     */
     scaleToUISize(uiSize) {
        return uiSize * this.uiScaleFactor;
    }


    disposeResources() {}
}
