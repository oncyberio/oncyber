	import {

	Vector3,

	Quaternion,

	Box3

} from 'three'

const tempVec = new Vector3()

const tempVec2 = new Vector3()

import {

	IDLE,

	EMOTES

} from './constants'

import gsap from 'gsap'

import {

	MINIMUM_VRM_BOX,

	MAXIMUM_VRM_BOX,

	MINIMUM_MIX_RATIO

} from '@3constants'

const _temp3 = new Vector3()

const _hipstemp = new Vector3()

const _spinetemp = new Vector3()

const _vec3 = new Vector3()

const _box3 = new Box3()

import Mix from '@3utils/math/mix'

import Shared from '@3shared'
import { createNativeLobbyMotion } from './lobbyMotion'

import Players from '..'

VRMSpringBoneColliderShapeCapsule
VRMSpringBoneColliderShapeSphere

import {
	VRMSpringBoneColliderShapeCapsule,
	VRMSpringBoneColliderShapeSphere ,
	}
 from "@pixiv/three-vrm-springbone";

let changeScale = 0

export default class AnimatedWrapper {

	constructor( meshes, id, opts ){

		this.main = opts.main == true

		if( this.main ) {

			window.mainWrapper = this
		}

		this.textureIndex = -1

		this.url    = null

		this._atlas =  { x: 1, y: 1, z: 0, w: 0 }

		this.usePFPs 		= null

		this.headPosition = new Vector3()

		this.originalHeadPosition = new Vector3()

        this.originalHipPosition = new Vector3()

        this.originalSpinePosition = new Vector3()

		this.hipPosition = new Vector3()

		this.legPosition = new Vector3()

		this.spinePosition = new Vector3()

		if(opts.HIGH_VRM){

			// Not expected: the high-quality name comes from userData below.
		}

		this.originalVRMName = opts.userData.HIGH_VRM

		this.isHighQuality = meshes.isHighQuality == true

		this.highQualityMeshes = null

		this.firstFrame = true

		this.id     = id

		this.index = 0

		this.timer = 0


		this.actionConfirmation = 0

		this._position 	= new Vector3()

		this._opacity   = 1

		this.opacity = 1



		this.emote = -1

		this._rotation = 0

		this._color = null


		this._visible = true

		this.floorVelocity = 0

		this.lastFloorVelocityPosition = new Vector3()

		this.smoothedFloorVelocity = 0

		this.airVelocity   = 0

		this.currentAnimationIndex 	= 0

		this.currentAction  = IDLE

		this.lastAction     = IDLE

		this.onFloor  		= true

		this.isJumping 		= false

		this.currentEmote 	= null

		this.emoteResolve   = null

        this.isSitting      = false;

		this.outOfFloorAttempt = -1

		this.now = Date.now()

		this.offsetTimer    = Math.random()

		if( this.id == 0 ) {

			// window.avat = this

		}

		this._animations = [0, 0, 0, 0]

		this.overrideVRMName = null

		this._scale = 1

		this.baseScaleRatio = 1

		this.updateVRM( meshes, false, true )

		this.prevScaleVal = null

	}

	updateVRM( meshes, override = false, first = false ){
        this.lobbyMotion?.release();
        this.lobbyMotion = undefined;

		if( this.isHighQuality && this.vrm )  {

			this.vrm.used = false

			this.vrm.visible = false

			if ( this.highQualityMeshes ) {

				if( this.highQualityMeshes.poolUsed == true && override == false ) {

					this.highQualityMeshes.poolUsed = false
				}

				if( this.highQualityMeshes.mixer ) {

					this.highQualityMeshes.mixer.stopAllAction()

				}
			}
		}

		this.vrmName = meshes.name

		this.meshes  = meshes

		this.usePFPs = meshes.pfpOptions

		this.isHighQuality = meshes.isHighQuality == true

		this.highQualityMeshes = null




		if( this.isHighQuality ) {

			this.vrm = meshes

			this.highQualityMeshes = meshes

			this.vrm.visible = true

			if( this.currentAction != null ) {

				this.setCurrentAction( this.currentAction, true )
			}

			this.isVersion0 = meshes.vrm.meta.metaVersion == '0'

			this.baseScaleRatio = this.vrm.vrm.baseScaleRatio

			this.absoluteRatio = this.vrm.vrm.absoluteRatio


			meshes.vrm.humanoid?.getNormalizedBoneNode( 'hips' ).getWorldPosition( _hipstemp )

			meshes.vrm.humanoid?.getNormalizedBoneNode( 'spine' ).getWorldPosition( _spinetemp )


			this.highQualityMeshes.scale.setScalar( 1.0 )

			console.log( meshes )
			console.log( meshes )
			console.log( meshes )


			console.log( _hipstemp )

			console.log( _spinetemp )

			this.hipPosition.copy(  _hipstemp )

			this.spinePosition.copy( _spinetemp )

		}

		else {

			this.vrm = []

			this.metaIds = []

			let i = 0

			while( i < meshes.children.length ) {

				const mesh = meshes.children[i]

				this.vrm.push(  mesh.gltf.userData )

                // mesh.gltf.userData.vrmHumanoid?.getNormalizedBoneNode( 'hips' ).getWorldPosition( _hipstemp )

                // mesh.gltf.userData.vrmHumanoid?.getNormalizedBoneNode( 'spine' ).getWorldPosition( _spinetemp )

				this.metaIds.push( mesh.bakeMeta.ids )

                this.hipPosition.copy(  mesh.bakeMeta.extras['SITTING'].hipsPosition )

                this.spinePosition.copy( mesh.bakeMeta.extras['SITTING'].spinePosition )

				i++
			}

			this.isVersion0 = this.vrm[0].vrmMeta.metaVersion == '0'

			this.baseScaleRatio = this.vrm[0].vrm.baseScaleRatio

			this.absoluteRatio = this.vrm[0].vrm.absoluteRatio

		}

		this.lobbyMotion = createNativeLobbyMotion(this, meshes.lobbyMotion);

        _box3.setFromObject( meshes );

		this.headPosition.set( 0, _box3.max.y - _box3.min.y, 0 )

		this.originalHeadPosition.copy( this.headPosition )

        this.originalHipPosition.copy( this.hipPosition )

        this.originalSpinePosition.copy( this.spinePosition )

		this.headPosition.y *= Mix( MINIMUM_MIX_RATIO, 1, this._scale ) * this.baseScaleRatio

		if( first ) {

			this.setScale( this.absoluteRatio )
		}

		this.prevScaleVal = null
		


	}

	setScale( val, force = false ){

		if( this.prevScaleVal == val ) {

			return
		}

		this.prevScaleVal = val

		const mixedScale =  val

		this._scale = mixedScale

		this.headPosition.copy( this.originalHeadPosition )

        this.hipPosition.copy( this.originalHipPosition )

        this.spinePosition.copy( this.originalSpinePosition )

		this.headPosition.y *= Mix( MINIMUM_MIX_RATIO, 1, this._scale ) * this.baseScaleRatio

        this.spinePosition.y *= Mix( MINIMUM_MIX_RATIO, 1, this._scale ) * this.baseScaleRatio

        this.hipPosition.y *= Mix( MINIMUM_MIX_RATIO, 1, this._scale ) * this.baseScaleRatio


		if( this.isHighQuality ) {

			const scale =  Mix( MINIMUM_MIX_RATIO, 1, mixedScale ) * this.baseScaleRatio
			
	        this.hipPosition.copy( this.originalHipPosition )

	        this.spinePosition.copy( this.originalSpinePosition )

	        this.spinePosition.setScalar( 0.5 * scale )

	        this.hipPosition.setScalar( 0.5 * scale )
	        
	        // this.hipPosition.setScalar( 0.5 * scale )


			this.highQualityMeshes.scale.setScalar( scale )

			if( this.highQualityMeshes.vrm.springBoneManager != null ) {

				// scale joints
				for ( const joint of this.highQualityMeshes.vrm.springBoneManager.joints ) {

				  if( joint.settings.originalSiftness  == null) {

				  	joint.settings.originalSiftness =  joint.settings.stiffness
				  	joint.settings.originalHitRadius =  joint.settings.hitRadius
				  }

				  joint.settings.stiffness = joint.settings.originalSiftness * scale;
				  joint.settings.hitRadius = joint.settings.originalHitRadius * scale;
				}

				// scale colliders
				for ( const collider of this.highQualityMeshes.vrm.springBoneManager.colliders ) {

				  const shape = collider.shape;
				  const offset = collider.offset;

				  if( shape.originalRadius == null ) {

				  	shape.originalRadius = shape.radius

				  }

				  shape.radius = shape.originalRadius * scale

				  if( offset != null ) {

				  	if( collider.originalOffset == null ) {

				  		collider.originalOffset = offset.clone()
				  	}

				  	collider.offset.copy(shape.originalOffset)

				  	collider.offset.multiplyScalar( scale )
				  }

				  if ( shape instanceof VRMSpringBoneColliderShapeCapsule ) {

				  	if( shape.originalTail == null ) {

				  		shape.originalTail = shape.tail.clone()
				  	}

				    shape.tail.copy(shape.originalTail).multiplyScalar( scale)

				  }
				}

			}
		}
	}

	playEmote = ( emoteIndex ) => {

        if( emoteIndex === -1 ) {

            this.stopEmote()

            return Promise.resolve()
        }

		if( emoteIndex == this.emote ) {

			return
		}

		return new Promise( ( resolve, reject  )=>{

			if( EMOTES[ emoteIndex ] == null ||  ( emoteIndex == this.emote && EMOTES[ emoteIndex ]?.sync  == true ) ) {

				resolve()

				return
			}


			// const clip = this.metaIds.indexOf(EMOTES[ emoteIndex ].name)

			if( this.emoteResolve ) {

				this.emoteResolve()

				this.emoteResolve = null
			}

			if( ( this.onFloor || this.isSitting ) && this.emoteResolve == null ) {

				// this.currentEmoteClip 				= clip

				this.emote 	 						= emoteIndex

				const emote  						= EMOTES[ emoteIndex ]

				this.emoteResolve  					= resolve

				this.currentEmote  					= emote

			}

			else {

				resolve()
			}
		} )
	}

	stopEmote = () =>{

		this.emote 	 = -1

		this.currentEmote = null

        const resolve = this.emoteResolve

        this.emoteResolve = null

        resolve?.()

		// this.currentEmoteClip = null
	}

	setPlayerOnFloor( val ) {


		let final = val

		if( val == false ) {

			if( this.isJumping == true ) {

				final = false

				this.outOfFloorAttempt = -1
			}

			if( this.isJumping == false ) {

				this.outOfFloorAttempt ++

				if( this.outOfFloorAttempt < 15 ) {

					final = true
				}
			}
		}

		else {

			this.outOfFloorAttempt = -1

			final = val
		}

		// if (val == false &&)

		// this.onFloor = val

		// if( val == true ) {

		// 	this.onFloor = val

		// }
		// else {

		// 	this.onFloor = true

		// 	this.outOfFloorAttempt = -1
		// }

		this.onFloor = final

	}

	setPlayerIsJumping( val ){

		this.isJumping = val

		if( val == undefined ) {

			// Callers should pass a boolean; undefined is stored as is.
		}

	}



	setCurrentAction( action, force = false ){

		if (!action) return;
        const actionName = action.name;
        if (this.isHighQuality ? !this.vrm?.possibleActions?.[actionName] : !(this.metaIds?.[0]?.includes(actionName))) return;
        this.lobbyMotion?.release();

		// console.log( action, this.isHighQuality  )

		if( this.isHighQuality ) {

			if( this.currentAction != action || force == true ) {

				this.lastAction    = this.currentAction

				this.currentAction = action

				if( this.lastAction ) {

					const duration = 0.1

					this.vrm.possibleActions[this.lastAction.name]?.fadeOut( duration );

					this.vrm.possibleActions[this.currentAction.name]
						.reset()
						.setEffectiveTimeScale( 1 )
						.setEffectiveWeight( 1 )
						.fadeIn( duration )
						.play();
				}

				else { 

					this.vrm.possibleActions[this.currentAction.name].play()

					this.vrm.possibleActions[this.currentAction.name].setEffectiveWeight(1)
				}
			}
		}
		else {

			var index;
			try {

				index = this.metaIds[0].indexOf(actionName)
                if (index < 0) return;

				if( index != this.currentAnimationIndex ) {

					const baseTime = 0.15

					var ts = action.timeScale ? action.timeScale * baseTime : baseTime

					if( this.currentAction != null && this.currentAction.fadeRatio != null ){

						ts = baseTime * this.currentAction.fadeRatio
					}

					if( force ) {

						this._animations = [index, index, Shared.animationTimer.value + 100, ts ]
					}
					else {

						this._animations = [this.currentAnimationIndex, index, Shared.animationTimer.value, ts ]

					}


					this.currentAnimationIndex = index

					this.lastAction    = this.currentAction

					this.currentAction = action

				}
			}

			catch(e){

				// The baked animation metadata is not ready; the current
				// animation keeps playing.
			}



		}
	}


	fadeToAction(previousAction, activeAction, duration ) {

		if ( previousAction !== activeAction ) {

			previousAction.fadeOut( duration );

		}

		activeAction
			.reset()
			.setEffectiveTimeScale( 1 )
			.setEffectiveWeight( 1 )
			.fadeIn( duration )
			.play();

	}

	set color(val){

		this._color = val

	}

	get color(){

		return this._color
	}

	set visible( val ){

		this._visible = val

		// if( val == false ) {

		// }
	}

	get visible(){

		return this._visible
	}

	set position(val){


		if(val.x == 0 && val.y == 0 && val.z == 0){

			// The origin is a valid position; nothing to do.
		}

		const now = Date.now()

		if( (now - this.now) > 20 ){

			tempVec.set(val.x, 0, val.z)

			this.floorVelocity = tempVec.distanceTo(this.lastFloorVelocityPosition)

			this.lastFloorVelocityPosition.set( val.x, 0.0, val.z )

			this.now = Date.now()
		}

		if( this.firstFrame == true ) {

			this.floorVelocity = 0

			this.lastFloorVelocityPosition.copy(val)

		}

		// tempVec.set(0, val.y, 0)

		// tempVec2.set(0, this._position.y, 0)

		//this.airVelocity = tempVec.distanceTo(tempVec2)

		this.firstFrame = false

		this._position.copy(val)

		if( this.isHighQuality ) {

			this.vrm.position.copy(this._position)
		}
	}

	set opacity( val ) {

		this._opacity = val
	}

	get opacity() {

		return this._opacity
	}

	set animations(val){

		this._animations = val
	}

	get animations(){

		return this._animations
	}

	set rotation(val){

		// console.log( val )

		this._rotation = val + ( this.isVersion0 ? 0 : Math.PI )

		if( this.isHighQuality ) {

			this.vrm.rotation.y = this._rotation
		}
		// this._rotation = val +  Math.PI
	}

	get rotation(){

		return this._rotation
	}

	get position(){

		return this._position
	}

	set atlas( val ) {

		this._atlas = val
	}

	get atlas() {

		return this._atlas
	}

	set scale( val ) {

		this._scale = val
	}

	get scale() {

		return this._scale
	}

	dispose(){

		if ( this.isHighQuality ) {

			this.visible = false

			this.highQualityMeshes.poolUsed = false

			if( this.highQualityMeshes.mixer ) {

				this.highQualityMeshes.mixer.stopAllAction()

				// this.highQualityMeshes.mixer = null
			}
		}
	}
}
