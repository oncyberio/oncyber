// @ts-check

import {

	MeshBasicMaterial,

	Mesh,

    Object3D,

    PlaneGeometry,

    MeshStandardMaterial,

    MeshLambertMaterial,

    Color

} from 'three'


// import RainFactory from '@3factory/rain'

import GetTypes from './types.js'

import {KitbashWrapper} from './kitbashwrapper.js'

import {

	UPLOADER_MODE,

	EDIT_MODE

} from '@3constants'

import PreviewBaker from '@3utils/previewbaker.js'

import Material 			from './material/index.js'

import Shared from '@3shared'

import PipelineMesh from '@3abstract/pipelinemesh'



class KitBuilder {

	constructor() {

	}

	setMaterial( blocks ){

		let i = 0


		while( i < blocks.length ) {

			const parentBlock = blocks[i]

			const childrens = blocks[i].children.slice()

			const newchilds = []

			childrens.forEach( ( block ) => {

				const parent = block.parent

				if( block.material ){

					const mesh = new PipelineMesh (

						block.geometry,

						 new Material( block, {

						   	uniforms: {

						   		color: {

						   			value: new Color( block.material.color )
						   		},

						   		map: {
						   			value: block.material.map
						   		}
						   	},

						   	preview: true

					   	})

					)

					mesh.name = block.name

					parent.remove(block)

					parent.add(mesh)

				}
			})

			i++
		}
	}

    /**
     *
     * @param {Object3D} res
     * @param {any[]} data
     * @returns
     */
	async create( res, data, opts = {} ){

		// const rain = RainFactory.get()

		// const decoration = new Object3D()

		// decoration.name = 'decoration'

		// decoration.add(rain)


		const types = GetTypes(res, data, opts )

		const build = new KitbashWrapper( { ...opts, types, data } )

		await build.build()

		const space = build.space

		// space.add( decoration )

		var arrColl = build.collisions


		console.log( "arrColl " , arrColl )

		if( true || EDIT_MODE || UPLOADER_MODE ) {

			// const floor = this.getFloor()

			// space.add( floor )

			// arrColl = [ ...arrColl, floor ]
		}

		return {

			build,

            scene: space,

			collisions: arrColl

		}
	}

	async bakeAssets( res ){

		// const decoration = res.getObjectByName('decoration')

		this.setMaterial( res.originalGLB.children  )

		var previewBaker = new PreviewBaker()

		var imgs = await previewBaker.renderKitImages( res.originalGLB.children, { postprocessing: true } )

		previewBaker.dispose()

		previewBaker = null

		let result = {}

		Object.values(imgs).forEach( it => {

			result[it.name] = it.image
		})

		return result
	}

	getFloor(){

		const floor = new PipelineMesh(
			new PlaneGeometry(2000, 2000),
			new MeshLambertMaterial({side: 0, color: 0xffffff}),

			{
				visibleOnOcclusion : false,
				visibleOnMirror: false
			}
		)

		floor.rotateX(-Math.PI * 0.5)

		floor.name = 'floor'

		floor.visible = false

		floor.castShadow = false

		floor.receiveShadow = true

		floor.collisions = new Mesh( new PlaneGeometry(200, 200, 2, 2) )

		floor.collisions.rotateX(-Math.PI * 0.5)

		floor.collisions.name = 'collisionfloor'

		return floor
	}

}

export default new KitBuilder()
