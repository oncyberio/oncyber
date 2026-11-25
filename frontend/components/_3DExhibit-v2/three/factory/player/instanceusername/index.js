import { Object3D } from 'three'

import { ATLAS_EVENTS } from '@3factory/atlas/constants'

import Wrapper from './wrapper.js'

import Emitter from '@3emitter'

import Events from '@3events'

import Players from "@3factory/player"

import PipeLineMesh from '@3abstract/pipelinemesh'

import Camera from '@3camera'

import Renderer from '@3renderer'

import { CANVAS, LOD_VRM_VISIBILITY } from '@3constants'

import { DEFAULT_PLAYER_AVATAR_PICTURE } from '../constants.js'

import { createNameTags } from '@features/name-tags/nameTags'

/*
 * Name tags over the players: the shared tags ( features/name-tags ), the
 * same as the lobby's, drawn as sharp distance field text in one instanced
 * draw. The username atlas still hands each player a block whose wrapper
 * carries the tag's position, visibility and opacity ( chat bubbles move
 * and fade it ); the tag itself is written here every frame from those.
 */

const MAX_TAGS = 64

const MAX_DISTANCE = Math.min( 50, LOD_VRM_VISIBILITY )

export default class InstanceUserName extends Object3D {

	constructor( atlas ){

		super()

		this.atlas = atlas

		this.onBlockDataEvent = this.onBlockData.bind(this)

		this.atlas.on(ATLAS_EVENTS.BLOCK_DATA, this.onBlockDataEvent )

		this.onBlockRemoveEvent = this.onBlockRemove.bind(this)

		this.atlas.on(ATLAS_EVENTS.REMOVE_BLOCK, this.onBlockRemoveEvent )

		this.tags = createNameTags( this, MAX_TAGS, {

			// hidden only when the camera is inside the head ( first person )
			closeFade: [ 0.8, 1.4 ],

			fallbackPhoto: DEFAULT_PLAYER_AVATAR_PICTURE,

			createMesh: ( geometry, material, occlusionMaterial ) => new PipeLineMesh( geometry, material, {

				occlusionMaterial,

				visibleOnMirror: false
			})
		})

		this.tags.mesh.matrixAutoUpdate = false

		this.shown = []

		// after the players and the camera moved, before the frame draws
		this.updateEvent = this.update.bind(this)

		Emitter.on(Events.DUSK_UPDATE, this.updateEvent)
	}

	onBlockRemove( block ){

		if( block.wrapper ) {

			block.wrapper = null
		}
	}

	onBlockData( blocks ){

		let i = 0

		while( i < blocks.length ) {

			const block = blocks[i]

			if( block.wrapper == null ) {

				block.wrapper = new Wrapper()
			}

			i++
		}
	}

	update(){

		const tags = this.tags

		tags.begin()

		const camera = Camera.current

		if( !this.visible || camera == null ) {

			tags.end( camera || Camera.mainCamera, 0 )

			return
		}

		const main = Players.main?.position

		const shown = this.shown

		shown.length = 0

		for( const player of Players.instances ) {

			const wrapper = player.username?.wrapper

			const position = wrapper?.position

			if( !player.visible || !wrapper?.visible || position == null ) continue

			let distance = 0

			if( main && !wrapper.ignoreLOD ) {

				distance = Math.hypot( position.x - main.x, position.y - main.y, position.z - main.z )

				if( distance >= MAX_DISTANCE ) continue
			}

			shown.push( { player, wrapper, distance } )
		}

		// a full space keeps the nearest
		if( shown.length > MAX_TAGS ) shown.sort( ( a, b ) => a.distance - b.distance )

		for( const { player, wrapper } of shown ) {

			const photo = player.nameTagTextOnly ? "" : ( player.userData?.avatar || DEFAULT_PLAYER_AVATAR_PICTURE )

			tags.show(

				player.userData?.sessionId || "",

				player.userData?.username || "",

				photo,

				wrapper.position.x,

				wrapper.position.y,

				wrapper.position.z,

				false,

				wrapper.opacity ?? 1
			)
		}

		// in VR there is no single screen to keep a size on: world size
		const presenting = Renderer.xr?.isPresenting === true

		tags.end( camera, presenting ? 0 : ( CANVAS?.clientHeight || 0 ) )
	}

	dispose(){

		this.atlas.off(ATLAS_EVENTS.BLOCK_DATA, this.onBlockDataEvent )

		this.atlas.off(ATLAS_EVENTS.REMOVE_BLOCK, this.onBlockRemoveEvent )

		Emitter.off(Events.DUSK_UPDATE, this.updateEvent )

		this.tags.dispose()
	}
}
