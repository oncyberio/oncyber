import {
	Vector3
} from 'three'

import {
	Fn,
	If,
	Discard,
	vec2,
	vec3,
	vec4,
	float as tslFloat,
	abs,
	mod,
	mix,
	select,
	distance,
	smoothstep,
	uv,
	varying,
	positionGeometry,
	modelViewMatrix,
	cameraViewMatrix,
	cameraProjectionMatrix,
} from 'three/tsl'

import {
	ArtworkNodeMaterial,
	materialUniform,
	materialTexture,
	correctRatio,
} from '@3factory/artwork/nodematerial'

import Shared from '@3shared'

import Textures from '@3textures'

import Smoothstep from '@3utils/math/smoothstep'

import Mix from '@3utils/math/mix'

import {

	DEBUG
} from '@3constants'
import gui from '@3gui'
import gsap from 'gsap'

import Camera from '@3camera'

import Emitter from '@3emitter'

import Events from '@3events'

import { IS_FIRST_PERSON } from "@3constants"

import Players from "@3factory/player"


const tempv3 = new Vector3()

const axis = new Vector3(0.0, 1.0, 0.0)

const duration = 3

// < VERTEX >

const vUv = varying( uv() )

const vPosition = varying( positionGeometry )

// -( third row of the view matrix ): the camera's forward direction
const viewDirection = varying( vec3(
	cameraViewMatrix.element( 0 ).z,
	cameraViewMatrix.element( 1 ).z,
	cameraViewMatrix.element( 2 ).z
).negate() )

const clipPosition = cameraProjectionMatrix.mul( modelViewMatrix ).mul( vec4( positionGeometry, 1.0 ) )

const ssp = varying( correctRatio( clipPosition.xy.div( clipPosition.w ).mul( 0.5 ).add( 0.5 ), tslFloat( 1.0 ), materialUniform( 'aspect', 'float' ) ) )

// < FRAGMENT >

const cubemap = Fn( ( [ d ] ) => {

	// intersect cube
	const n = abs( d )

	const v = select(
		n.x.greaterThan( n.y ).and( n.x.greaterThan( n.z ) ),
		d.xyz,
		select( n.y.greaterThan( n.x ).and( n.y.greaterThan( n.z ) ), d.yzx, d.zxy )
	).toVar()

	// project into face
	const q = v.yz.div( v.x ).toVar()

	// undistort in the edges
	q.mulAssign( tslFloat( 1.25 ).sub( q.mul( q ).mul( 0.25 ) ) )

	return q.mul( 0.5 ).add( 0.5 )
} )

const colorNode = Fn( () => {

	const time = materialUniform( 'time', 'float' )

	const transition = materialUniform( 'transition', 'float' )

	const centerDiff = materialUniform( 'centerDiff', 'float' )

	const vUv2 = cubemap( vPosition )

	const cc = materialTexture( 'transitionMap', mod( vUv2.mul( 2.0 ), 1.0 ) ).toVar()

	const color = materialTexture( 'map', vUv ).toVar()

	const dist = distance( vPosition, materialUniform( 'centerAnimate', 'vec3' ) )

	const mixx = smoothstep( dist, dist.add( mod( cc.r, 1.0 ).mul( 20.0 ) ), transition.mul( 2.5 ) )

	const dist2 = distance( vPosition, viewDirection )

	const mixx2 = smoothstep( dist2, dist2.add( mod( cc.r.add( time ), 1.0 ).mul( 20.0 ) ), tslFloat( 1.0 ).sub( centerDiff ).mul( 2.5 ) )

	const a = smoothstep( 0.0, 1.0, distance( vec2( 0.5 ), ssp ) ).toVar()

	a.assign( a.mul( a ) )

	If( mixx.lessThan( 0.001 ).or( mixx2.greaterThan( 0.001 ) ), () => {

		Discard()
	} )

	// The WebGL shader converted its output (colorspace_fragment): use the colour as-is.
	return vec4( color.rgb, mix( a, 1.0, centerDiff ) )
} )()

export default class PanoramaMaterial extends ArtworkNodeMaterial {

	static get type() {

		return 'PanoramaMaterial'
	}

	constructor(){

		const transitionMap =  Textures['panorama_tile'];


		super()

		this.uniforms = {

			time : Shared.timer,

			side : { value: -1},

			centerAnimate: {

				value : new Vector3(0, 0, 1)
			},

			aspect: Shared.aspect,

			centerDiff: {

				value: 0
			},

			transition: { value : 0 },

			map: {
				value : null
			},
			transitionMap: {
				value: transitionMap
			}
		}

		this.colorNode = colorNode

		this.depthTest = false

		this.depthWrite = false

		this.transparent = true

		this.side = 2

		this.isOverDist = false

		this.transitionning  = false

		if( DEBUG ) {

			gui.add(this.uniforms.transition, "value", 0, 1).step(0.001).name('transition').listen()

			gui.add(this, 'show')

			gui.add(this, 'hide')
		}

		this.isHiding = false 
		this.isShowing = false 

		this.centerPosition = new Vector3()
	}

	update(e){


		const base = IS_FIRST_PERSON ? Camera.current.position : Players.main.position

		const dist  =  Smoothstep(0, 7.5, this.centerPosition.distanceTo(base) )

		const dist2 =  Mix(1.0, 0.0, Smoothstep(0.5, 7.5, this.centerPosition.distanceTo(base) ) )

		this.uniforms.centerDiff.value = dist2

		if(dist == 1.0){

			this.isOverDist = true

			this.removeEvents()

			Emitter.emit( Events.CUSTOM, {

			    type: Events.PANORAMA_CLOSING,

			    value: {

			        mesh: this
			    }
			})
		}
	}

	show(){

		if( this.isShowing == true ){

			return
		}

		this.isShowing = true

		this.isHiding = false

		if( this.tween ) {

			this.tween.kill()

			this.tween = null
		}

		if( this.transitionning == false ){

			Camera.current.getWorldDirection( tempv3 )

			this.uniforms.centerAnimate.value.copy( tempv3 )

		}

		this.uniforms.transition.value = 0

		this.uniforms.side.value = -1

		this.transitionning = true
	
		this.addEvents()

		this.tween = gsap.to(this.uniforms.transition, {

			value: 1,
			ease: 'none',
			duration: duration - ( this.uniforms.transition.value * duration ),

			onComplete:()=>{

				this.transitionning = false

				this.uniforms.side.value = 1

				this.isShowing = false
			}
		})

	}

	hide(){

		return new Promise(( resolve, reject)=>{

			if( this.isHiding == true ){

				resolve()

				return
			}

			this.removeEvents()

			if( this.tween ) {

				this.tween.kill()

				this.tween = null
			}

			this.isShowing = false

			this.isHiding = true

			if( this.transitionning == false ){

				Camera.current.getWorldDirection( tempv3 )

				tempv3.x *= -1
				tempv3.y *= -1
				tempv3.z *= -1

				this.uniforms.centerAnimate.value.copy( tempv3 )

			}



			if( this.isOverDist == false ) {

				const dur = (( this.uniforms.transition.value * duration )) * 0.5

				this.tween = gsap.to(this.uniforms.transition, {

					value: 0,
					ease: 'none',
					duration: dur,

					onComplete:()=>{

						this.transitionning = false

						this.uniforms.side.value = 1

						this.isHiding = false

						resolve()
					}
				})
			}

			else {

				this.transitionning = false

				this.isHiding = false

				this.isOverDist = false

				resolve()

			}
		})
	}

	reset(){

		this.removeEvents()
		this.isHiding = false
		this.isShowing = false
		this.transitionning = false

		if( this.tween ) {
			this.tween.kill()
			this.tween = null
		}

		this.uniforms.transition.value = 0
		this.uniforms.side.value = -1

		this.isOverDist = false

	}

	addEvents(){

		this.centerPosition.copy( IS_FIRST_PERSON ? Camera.current.position : Players.main.position )

		if( this.updateEvent == null ) {

			this.updateEvent = this.update.bind(this)

			Emitter.on(Events.PRE_UPDATE, this.updateEvent)
		}
	}

	removeEvents(){

		if ( this.updateEvent ) {

			Emitter.off(Events.PRE_UPDATE, this.updateEvent)

			this.updateEvent = null
		}
	}


	set map( val ) {

		Camera.current.getWorldDirection( tempv3 )
		this.uniforms.centerAnimate.value.copy( tempv3 )
		this.uniforms.transitionMap.value = Textures['panorama_tile']
		this.uniforms.map.value = val
		// rebuild only if the new texture needs a different build (see textureCacheKey)
		this.needsUpdate = true
	}
	get map(){
		return this.uniforms.map.value
	}
}
