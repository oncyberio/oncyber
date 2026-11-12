import {

	Mesh,

	Object3D,

	Vector3

} from 'three'

const temp1 = new Vector3()

import Geometry from './geometry.js'

import Material from './material'

import Atlas  	from '@3factory/atlas'

import {

	ATLAS_EVENTS,

	TEXTURE_SIZE,

	BLOCK_SIZE

} from '@3factory/atlas/constants'

import Wrapper from './wrapper.js'

import BASE_GEOMETRY from './basegeometry.js'

import Emitter from '@3emitter'

import Events from '@3events'

import Players from "@3factory/player"

import PipeLineMesh from '@3abstract/pipelinemesh'

let c = 0


import {

	LOD_VRM_VISIBILITY

} from '@3constants'

export default class InstanceUserName extends Object3D {

	constructor( atlas ){

		super()

		this.atlas = atlas

		this.onNewTextureEvent =  this.onNewTexture.bind(this)

		this.atlas.on(ATLAS_EVENTS.NEW_TEX, this.onNewTextureEvent )

		this.onBlockDataEvent = this.onBlockData.bind(this)

		this.atlas.on(ATLAS_EVENTS.BLOCK_DATA, this.onBlockDataEvent )

		this.onBlockRemoveEvent = this.onBlockRemove.bind(this)

		this.atlas.on(ATLAS_EVENTS.REMOVE_BLOCK, this.onBlockRemoveEvent )

		this.updateEvent = this.update.bind(this)

		Emitter.on(Events.PRE_UPDATE, this.updateEvent)

		this.meshes = []

		this.height = 0

		this.textureCount = -1

		window.pppp = this
	}

	// set enabled

	onNewTexture( tex ){

		this.textureCount++

		const mat = new Material( {tex: tex} )

		const instanceMesh  = new PipeLineMesh(
			new Geometry(BASE_GEOMETRY, { opacity: true, pause: true, atlas: true, max: this.atlas.distanceBasedMaxElements , sorting: false }),
			mat,
			{
				occlusionMaterial: mat.occlusionMaterial,
				visibleOnMirror: false
			}

		)

		instanceMesh.frustumCulled 	  = false

		instanceMesh.matrixAutoUpdate = false

		this.meshes.push(

			instanceMesh
		)

		instanceMesh.textureCount = this.textureCount

		this.add( instanceMesh )

	}

	onBlockRemove( block ){

		if( block.wrapper ) {

			block.wrapper = null
		}
	}


	update(){

		let i = 0

		while( i < this.meshes.length ){

			if( this.meshes[i].wrappers.length > 0 ) {

				this.meshes[i].geometry.sort( this.meshes[i].wrappers )

				this.meshes[i].visible = true
			}

			else {

				this.meshes[i].visible = false
			}

			i++
		}
	}

	onBlockData( blocks ){

		let i = 0

		// i = 0
		while( i < this.meshes.length){

			this.meshes[i].wrappers = []

			i++
		}

		i = 0

		// console.log(Players.main?.position)

		while( i < blocks.length ) {

			const block = blocks[i]

			const textureIndex = block.textureIndex

			// if no wrapper at all

			if( block.wrapper == null ) {

				block.wrapper = new Wrapper()
			}

			const wrapper = block.wrapper

			wrapper.atlas = { x: block.uvScale.x, y: block.uvScale.y, z: block.uvPos.x, w: block.uvPos.y }


			const mesh = this.meshes[ textureIndex  ]

			if ( wrapper.visible && wrapper.position != null && Players.main?.position ) {

				temp1.copy( wrapper.position )

            	wrapper.distance =  temp1.distanceTo( Players.main.position )

                if (wrapper.ignoreLOD) {

                    wrapper.distance = 1
                }
            }
			else {

				wrapper.distance = Infinity
			}

            // mesh may not exists if distance based
			if( mesh != null ){

				if( wrapper.distance < Math.min( 50, LOD_VRM_VISIBILITY ) ) {

					mesh.wrappers.push( wrapper )
				}
			}

			i++
		}
	}

	dispose(){

		this.atlas.off(ATLAS_EVENTS.NEW_TEX, this.onNewTextureEvent )

		this.atlas.off(ATLAS_EVENTS.BLOCK_DATA, this.onBlockDataEvent )

		this.atlas.off(ATLAS_EVENTS.REMOVE_BLOCK, this.onBlockRemoveEvent )

		let i = 0

		while(i < this.meshes.length ) {

			var mesh = this.meshes[i]

			this.remove(mesh)

			mesh.material.dispose()

			mesh.geometry.dispose()

			mesh = null

			i++
		}
	}
}
