import { Frustum, Matrix4 } from 'three'

import {

	DEBUG

} from '@3constants'

/**
 * Answers "was this mesh drawn last frame?" from the last rendered camera.
 * The WebGL fork exposed the renderer's internal render list for this; WebGPU
 * doesn't, so we test the same thing the renderer culls with: visibility up
 * the parent chain plus the camera frustum.
 */
class RenderList {

	constructor() {

		if( DEBUG ){

			window.renderList = this
		}

		this.frustum = new Frustum()

		this.matrix = new Matrix4()

		this.hasCamera = false
	}

	setCamera( camera ){

		if( !camera ) return

		this.matrix.multiplyMatrices( camera.projectionMatrix, camera.matrixWorldInverse )

		this.frustum.setFromProjectionMatrix( this.matrix, camera.coordinateSystem )

		this.hasCamera = true
	}

    reset() {

		this.hasCamera = false
    }

	isVisible( object ){

		if( !this.hasCamera ) return false

		let node = object

		while( node ){

			if( !node.visible ) return false

			node = node.parent
		}

		if( object.frustumCulled === false ) return true

		return this.frustum.intersectsObject( object )
	}
}

export default new RenderList()
