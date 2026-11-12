import {

	OrthographicCamera,

	Object3D,

	Scene

} from 'three'

import Cache from './cache/index.js'

import FontFactory from '@3gl/factory/font'

import gsap from 'gsap'

import {

	DEBUG,

	RECORD_SIZE,

	CURRENT_SPACE,

	GLOBAL_TEXT_SCALE,

	RECORD_INTRO,

	RECORD_END,

	SET_RECORD_SIZE,

	IS_RECORDING,

	CINEMATIC,

	SET_CINEMATIC_PREVIEW_SIZE

} from '@3constants'

const renderOrders = {

	cache: 1000,

	hero : 1001,

	logoend: 1003,

	text : 1003,

	logostart: 1004,

}

import Smoothstep from '@3utils/math/smoothstep'

import Renderer from '@3renderer'

import FontMeshFactory from '@3gl/factory/font'

import gui from '@3gui'

import {

	LAYOUT_TYPES,

	LAYOUT_OPTIONS,

	LAYOUT_CURRENT

} from './constants'

import { disposeObject3D } from "@3utils/three"

import Loader from "@3loader"

import SpriteBuilder from '@3factory/sprite'

class Composer extends Scene {

	constructor( opts ){

		super()

		this.LAYOUT_TYPES = LAYOUT_TYPES

		this.currentLayout = null

		this.camera = new OrthographicCamera(1, 1, 1, 1, 0.01, 500)

		this.camera.position.z = 20

		if( DEBUG ) {

			window.composer = this
		}

		this.setSize()

		this.active = true

		this._startProgression = 0

		this.advanced = false
	}



	async init( opts ){

		this.logoStart = await SpriteBuilder.get( SpriteBuilder.TYPES.CINEMATIC_LOGO, {scale: 1} )

		this.add( this.logoStart )

		this.advanced = opts.advanced

		// console.log(this.logoStart )
		// this.

	 //    const heroImage = await Loader.fetchImage(  CURRENT_SPACE?.exhibit?.info?.cHeroImg || CURRENT_SPACE?.exhibit?.info?.heroImg )

		// this.cacheMesh = new Cache()

		// this.cacheMesh.renderOrder = renderOrders.cache

		// this.add(this.cacheMesh)

		// this.logoEnd = new LogoEnd()

		// this.logoEnd.renderOrder = renderOrders.logoend

		// this.add(this.logoEnd)


		// this.hero = new HeroImg( heroImage )

		// this.add(this.hero)

		// this.hero.renderOrder = renderOrders.hero


		// this.logostart = new LogoStart()

		// this.logostart.renderOrder = renderOrders.logostart


		// this.add(this.logostart)


		// this.createTitleFont()

		// this.createBottomFont()

		// this.layout( LAYOUT_CURRENT, true )

		// console.log(LAYOUT_CURRENT)

		this.update(0)

		this.addDebug()

		this.layout(LAYOUT_CURRENT, true)




	}

	// createTitleFont(){


	// 	let textOptions = {

	// 	    color: [1,1,1],
	// 	    align: 'left',
	// 	    text:  CURRENT_SPACE.exhibit.info.headline,
	// 	    scale : GLOBAL_TEXT_SCALE * RECORD_SIZE.w * 3.2,
	// 	    lineHeight: 60,
	// 	    width: RECORD_SIZE.w * 0.3
	// 	}


	// 	this.titleFont  = FontMeshFactory.create( textOptions )

	// 	this.titleFont.mesh.renderOrder = renderOrders.text
	// 	this.titleFont.mesh.rendermodes.LEFT = true
	// 	this.titleFont.mesh.rendermodes.CENTER = true
	// 	this.titleFont.mesh.rendermodes.TOP = false
	// 	this.titleFont.mesh.rendermodes.BOTTOM = false
	// 	this.titleFont.update()

	// 	this.add(this.titleFont)
	// }

	// createBottomFont(){


	// 	let textOptions = {

	// 	    color: [1,1,1],
	// 	    align: 'left',
	// 	    text:  'WWW.ONCYBER.IO',
	// 	    // scale : GLOBAL_TEXT_SCALE * 700,
	// 	    lineHeight: 60
	// 	}


	// 	this.bottomFont  = FontMeshFactory.create( textOptions )

	// 	this.bottomFont.mesh.renderOrder = renderOrders.text
	// 	this.bottomFont.mesh.rendermodes.LEFT = true
	// 	this.bottomFont.mesh.rendermodes.CENTER = false
	// 	this.bottomFont.mesh.rendermodes.TOP = false
	// 	this.bottomFont.mesh.rendermodes.BOTTOM = true
	// 	this.bottomFont.update()

	// 	this.add(this.bottomFont)
	// }

	layout( type = LAYOUT_TYPES.PORTRAIT, force = false ){

		if(  type == this.currentLayout && force == false ) {

			return
		}

		SET_RECORD_SIZE( LAYOUT_OPTIONS[type] )

		if( CINEMATIC == true || this.advanced ) {

			SET_CINEMATIC_PREVIEW_SIZE( {

				w: LAYOUT_OPTIONS[type].w,
				h: LAYOUT_OPTIONS[type].h,
				left: 0,
				bottom: 0
			} )
		}

		this.currentLayout = type

		this.setSize()

		switch(type){

			case LAYOUT_TYPES.LANDSCAPE :

				// var encart = {
				// 	x: 100,
				// 	y: 300
				// }

				// var size = 2


				this.logoStart.scale.set( 100 * 4, -100 * 4, 100 * 4 )

				// this.hero.scale.set(scale , scale, scale)

				// this.hero.material.uniforms.encart.value.set( encart.x, encart.y)

				// var logoSize = 50

				// this.logostart.scale.set(logoSize , logoSize, logoSize)

				// this.logostart.position.set( -RECORD_SIZE.w * 0.5 + encart.x + logoSize * 0.5 , -RECORD_SIZE.h * 0.5 + encart.y - logoSize * 0.5 - 50, 0)

				// this.titleFont.mesh.renderOrder = renderOrders.text
				// this.titleFont.mesh.rendermodes.LEFT = true
				// this.titleFont.mesh.rendermodes.CENTER = true
				// this.titleFont.mesh.rendermodes.TOP = false
				// this.titleFont.mesh.rendermodes.BOTTOM = false

				// this.titleFont.update({

				// 	scale: GLOBAL_TEXT_SCALE * RECORD_SIZE.w * 3.2,

				// 	width: RECORD_SIZE.w * 0.3
				// })

				// this.titleFont.position.set( -RECORD_SIZE.w * 0.5 + encart.x + 100, RECORD_SIZE.h * 0.5 - encart.y , 0)

				// this.bottomFont.update({

				// 	scale: GLOBAL_TEXT_SCALE * 700
				// })

				// this.bottomFont.position.set(-RECORD_SIZE.w * 0.5 + encart.x, -RECORD_SIZE.h * 0.5 + 50 , 0)



			break

			case LAYOUT_TYPES.SQUARE :

				// var encart = {
				// 	x: 100,
				// 	y: 300
				// }

				// var size = 2

				// var scale = RECORD_SIZE.h * size

				// this.hero.scale.set(scale , scale, scale)

				// this.hero.material.uniforms.encart.value.set( encart.x, encart.y)

				// var logoSize = 75


				this.logoStart.scale.set( 150 * 3, -150 * 3, 150 * 3 )

				// this.logostart.scale.set(logoSize , logoSize, logoSize)

				// this.logostart.position.set( -RECORD_SIZE.w * 0.5 + encart.x + logoSize * 0.5 , -RECORD_SIZE.h * 0.5 + encart.y - logoSize * 0.5 - 50, 0)

				// this.titleFont.mesh.renderOrder = renderOrders.text
				// this.titleFont.mesh.rendermodes.LEFT = true
				// this.titleFont.mesh.rendermodes.CENTER = true
				// this.titleFont.mesh.rendermodes.TOP = false
				// this.titleFont.mesh.rendermodes.BOTTOM = false

				// this.titleFont.update({

				// 	scale: GLOBAL_TEXT_SCALE * RECORD_SIZE.w * 4.2,

				// 	width: RECORD_SIZE.w * 0.4
				// })

				// this.titleFont.position.set( -RECORD_SIZE.w * 0.5 + encart.x + 20, RECORD_SIZE.h * 0.5 - encart.y , 0)

				// this.bottomFont.update({

				// 	scale: GLOBAL_TEXT_SCALE * 1000
				// })

				// this.bottomFont.position.set(-RECORD_SIZE.w * 0.5 + encart.x, -RECORD_SIZE.h * 0.5 + 50 , 0)



			break

			case LAYOUT_TYPES.PORTRAIT :

				// var encart = {
				// 	x: 50,
				// 	y: 300
				// }

				// var size = 2

				// var scale = RECORD_SIZE.h * size

				// this.hero.scale.set(scale , scale, scale)

				// this.hero.material.uniforms.encart.value.set( encart.x, encart.y)

				// var logoSize = 80

				this.logoStart.scale.set( 160 * 2, -160 * 2, 160 * 2 )

				// this.logostart.scale.set(logoSize , logoSize, logoSize)


				// this.logostart.position.set( -RECORD_SIZE.w * 0.5 + encart.x + logoSize * 0.5 , -RECORD_SIZE.h * 0.5 + encart.y - logoSize * 0.5 - 50, 0)
				// // this.logostart.position.set( -RECORD_SIZE.w * 0.5 + encart.x + this.logostart.size * 0.5 , -RECORD_SIZE.h * 0.5 + encart.y - this.logostart.size * 0.5 - 50, 0)


				// this.titleFont.mesh.renderOrder = renderOrders.text
				// this.titleFont.mesh.rendermodes.LEFT = true
				// this.titleFont.mesh.rendermodes.CENTER = true
				// this.titleFont.mesh.rendermodes.TOP = true
				// this.titleFont.mesh.rendermodes.BOTTOM = false

				// this.titleFont.update({

				// 	scale: GLOBAL_TEXT_SCALE * RECORD_SIZE.w * 5.5,

				// 	width: RECORD_SIZE.w * 0.4
				// })

				// this.titleFont.position.set( -RECORD_SIZE.w * 0.5 + encart.x + 20, RECORD_SIZE.h * 0.5 - encart.y * 0.5, 0)


				// this.bottomFont.update({

				// 	scale: GLOBAL_TEXT_SCALE * 1200
				// })

				// this.bottomFont.position.set(-RECORD_SIZE.w * 0.5 + encart.x, -RECORD_SIZE.h * 0.5 + 45 , 0)



			break

		}


		this.reset()
	}

	reset(){

		this.createStartTween()

		this.createFadeTween()

		this.createEndTween()

		this.startProgression = 0
	}

	createStartTween(){

		if(this.startTween != null){

			this.startTween.kill()

			this.startTween = null
		}

			// this.cacheMesh.

		this.startTween = new gsap.timeline()

		this.logoStart.progression(0)

		this.logoStart.visible = true

		var p = []

		let opts = {

			prog : 0
		}

		p.push(

			gsap.to(opts, {

				prog: 1,

				duration: RECORD_INTRO,
				ease: 'none',

				onUpdate:()=>{

					this.logoStart.progression( opts.prog )
				},
				onComplete:()=>{

					this.logoStart.visible = false
				}
			})
		)


		// this.hero.material.uniforms.reveal.value = 0

		// this.cacheMesh.alpha = 1

		// this.hero.alpha = 1

		// this.startTween.add(
		// 	[

		// 		this.objectTween( this.titleFont, {alpha: true, positionY: -30}),

		// 		this.objectTween( this.logostart, {alpha: true}),

		// 		this.objectTween( this.bottomFont, {alpha: true} ),

		// 		gsap.to(this.hero.material.uniforms.reveal, {

		// 			value: 1,
		// 			duration: RECORD_INTRO + 0.2,
		// 			ease: 'power3.inOut'
		// 		}),
		// 	]

		// )

		this.startTween.add( p )

		this.startTween.pause()
	}

	createFadeTween(){

		if(this.fadeTween != null){

			this.fadeTween.kill()

			this.fadeTween = null
		}

		this.fadeTween = new gsap.timeline()

		// this.fadeTween.add(
		// 	[


		// 		gsap.to( [ this.cacheMesh,this.titleFont,this.logostart,this.bottomFont,this.hero], {

		// 			alpha: 0,
		// 			duration: 1,
		// 			ease: 'none',
		// 		}),

		// 	]

		// )

		this.fadeTween.pause()
	}

	createEndTween(){

		if(this.endTween != null){

			this.endTween.kill()

			this.endTween = null
		}

		this.endTween = new gsap.timeline()

		// this.logoEnd.alpha = 0

		// this.endTween.add(
		// 	[

		// 		gsap.to( [ this.cacheMesh, this.logoEnd ], {

		// 			alpha: 1,
		// 			duration: RECORD_END,
		// 			ease: 'none',
		// 		}),
		// 	]
		// )

		this.endTween.pause()
	}

	objectTween(object, opts){

		var p = []

		if(opts.positionX != null){

			object.position.x -= opts.positionX

			p.push(

				gsap.to(object.position, {

					x: object.position.x + opts.positionX,

					duration: RECORD_INTRO,
					ease: 'power1.out'
				})
			)
		}


		if(opts.positionY != null){

			object.position.y -= opts.positionY

			p.push(

				gsap.to(object.position, {

					y: object.position.y + opts.positionY,

					duration: RECORD_INTRO,
					ease: 'power1.easeOut'
				})
			)
		}

		if(opts.alpha != null){

			object.alpha = 0

			p.push(

				gsap.to(object, {

					alpha: 1,

					duration: RECORD_INTRO,
					ease: 'power1.easeOut'
				})
			)

		}

		return p
	}

	render(){

		if( this.visible || IS_RECORDING ) {

			if( IS_RECORDING ) {

				this.oldVisibility = this.visible

				this.visible = true
			}

			const oldAutoClear = Renderer.autoClear

			Renderer.autoClear = false

			// Renderer.clearDepth()

			Renderer.render(this, this.camera)

			Renderer.autoClear = oldAutoClear

			// console.log('render YOLO')

			if( IS_RECORDING ) {

				this.visible = this.oldVisibility
			}
		}

		// this.camera = new OrthographicCamera()
	}

	// clear(){

	// }

	setSize(){

		this.camera.left 	= RECORD_SIZE.w / - 2
		this.camera.right 	= RECORD_SIZE.w / 2
		this.camera.top 	= RECORD_SIZE.h / 2
		this.camera.bottom 	= RECORD_SIZE.h / - 2

		this.camera.updateProjectionMatrix()

	}

	update( progress ){

		// this.cacheMesh.opacity = Math.pow((progress - 0.5) * 2, 4)
	}

	fadeCache(val){

		return gsap.to(this.cacheMesh,{

			alpha: val,
			duration : 1,
			ease: 'none'
		})
	}

	setStartOpacity(val){


		// this.hero.opacity = val
		// this.logostart.opacity = val
		// this.titleFont.alpha = val

	}

	set startProgression(val){

		this._startProgression = val

		this.startTween.seek(val)

		// this.update()
	}

	get startProgression(){

		return this._startProgression
	}

	dispose(){

		// debugger

		this.remove( this.logoStart )

		this.logoStart.material.dispose()
		this.logoStart.geometry.dispose()

		this.logoStart = null



		if( this.startTween ) {


			this.startTween.pause()
			this.fadeTween.pause()
			this.endTween.pause()

			this.startTween.kill()
			this.fadeTween.kill()
			this.endTween.kill()

			this.startTween = null
			this.fadeTween  = null
			this.endTween   = null
		}


		// disposeObject3D(this)

		// let i = 0

		// let toremove = []

		// while ( i < this.children.length ) {

		// 	toremove.push( this.children[i] )

		// 	i++
		// }

		// i = 0

		// while(i < toremove.length ) {

		// 	this.remove( toremove[i] )

		// 	i++
		// }

	}

	addDebug(){

		if( DEBUG ) {

			this.folder = gui.addFolder('composer')

			this.folder.add( this, '_startProgression', 0, RECORD_INTRO ).step(0.01).onChange((val)=>{

				this.startProgression = val
			})

		}
	}
}


export default new Composer()
