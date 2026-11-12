import {
	Color,
	DataTexture,
	FrontSide,
	HalfFloatType,
	LinearFilter,
} from 'three';

import {
	NodeMaterial,
	RenderTarget,
} from 'three/webgpu';

import {
	cameraFar,
	cameraNear,
	float as tslFloat,
	fract,
	mix,
	mod,
	normalize,
	positionView,
	positionWorld,
	reflector,
	screenUV,
	select,
	step,
	texture,
	uniform,
	vec2,
	vec3,
	viewZToPerspectiveDepth,
} from 'three/tsl';

import {

	CYBER_CITY
} from '@3constants'

import Loader from '@3loader'

import BlurPass from '@3gl/renderer/blurpass'

import Emitter from '@3emitter'
import Events from "@3events"

import PipeLineMesh from '@3abstract/pipelinemesh'

// `.sample()` re-enables the texture's uv transform; these coordinates are raw.
const sampleRaw = ( node, coord ) => node.sample( coord ).setUpdateMatrix( false )

// WebGL sampled an unset normal map as (0,0,0,0)
const emptyNormalMap = new DataTexture( new Uint8Array( 4 ), 1, 1 )

// filterable, so the shader samples it like the real maps swapped in later
emptyNormalMap.minFilter = emptyNormalMap.magFilter = LinearFilter;
emptyNormalMap.needsUpdate = true;

// Reflections never render inside another reflection (WebGL hid the reflector
// mesh during its own pass, and nested reflectors only produced garbage).
let inMirror = false;

/**
 * Floor mirror. The reflection is r180's TSL `reflector()` node (oblique-clipped
 * virtual camera into a HalfFloat render target), with the engine's semantics
 * kept around its sub-render:
 * - fixed `textureWidth` x `textureHeight` target, like the WebGL clone;
 * - `Events.MIRROR` swaps every pipeline mesh to its mirror variant/visibility;
 * - no shadow map updates, no matrix auto updates, no XR during the pass;
 * - the optional `BlurPass` blur on the target afterwards.
 * Render targets are linear and never tone mapped, so the old
 * outputColorSpace/toneMapping toggles are implicit.
 */
class Reflector extends PipeLineMesh {

	constructor( geometry, options ) {

		const isCyberCity = options.roomParameters?.cybercity == true || CYBER_CITY

		const material = new NodeMaterial()

		material.name = 'ReflectorMaterial'

		material.transparent = true

		material.fog = true

		material.side = FrontSide

		if( isCyberCity ) {

			// read by the lobby reveal; the graph below branches in JS
			material.defines = { CYBER_CITY: '1.0' }
		}

		super( geometry, material, {
			visibleOnOcclusion: false
		} );

		this.isReflector = true;

		this.renderOrder = -Infinity

		this.type = 'Reflector'

		this.lastURL = null

		this.isBlur = false

		const scope = this;

		const color = ( options.color !== undefined ) ? new Color( options.color ) : new Color( 0x777777 );
		const textureWidth = options.textureWidth || 1024;
		const textureHeight = options.textureHeight || 1024;
		const multisample = ( options.multisample !== undefined ) ? options.multisample : 0;

		// the mesh is the mirror plane (local +Z is the normal)
		const reflection = reflector( { target: this, samples: multisample } );

		const base = reflection.reflector

		const tempTarget = new RenderTarget( textureWidth, textureHeight, { type: HalfFloatType } );

		let renderTarget = null

		// WebGL used a fixed-size target, not the drawing buffer size
		// Every target this reflector owns is fixed-size, from its first frame:
		// resizing later would destroy a texture already bound for this frame.
		base._updateResolution = function ( target ) {

			target.setSize( textureWidth, textureHeight )
		}

		const updateBefore = base.updateBefore

		base.updateBefore = function ( frame ) {

			if( inMirror ) return

			const { renderer, scene, camera } = frame

			renderTarget = this.getRenderTarget( this.getVirtualCamera( camera ) )

			inMirror = true

			const currentXrEnabled = renderer.xr?.enabled;
			const currentShadowAutoUpdate = renderer.shadowMap.autoUpdate;

			const oldCameraAutoUpdate = camera.matrixWorldAutoUpdate
			const oldSceneAutoUpdate = scene.matrixWorldAutoUpdate

			scene.matrixWorldAutoUpdate = false
			camera.matrixWorldAutoUpdate = false

			if( renderer.xr ) renderer.xr.enabled = false; // Avoid camera modification
			renderer.shadowMap.autoUpdate = false; // Avoid re-computing shadows

			Emitter.emit(Events.MIRROR, true )

			// the MIRROR event shows pipeline meshes, hide ourselves again
			scope.visible = false

			updateBefore.call( this, frame )

			Emitter.emit(Events.MIRROR, false )

			scene.matrixWorldAutoUpdate  = oldSceneAutoUpdate
			camera.matrixWorldAutoUpdate = oldCameraAutoUpdate

			if( renderer.xr ) renderer.xr.enabled = currentXrEnabled;
			renderer.shadowMap.autoUpdate = currentShadowAutoUpdate;

			if( scope.isBlur && this.hasOutput ) {

				BlurPass.blur( renderTarget, tempTarget )

				BlurPass.blur( renderTarget, tempTarget )
			}

			scope.visible = true;

			inMirror = false
		}

		const uniforms = {

			tiles			: uniform( 1 ),

			normalStrength	: uniform( 0.05 ),

			useNormalMap	: uniform( 0 ),

			normalMap		: texture( emptyNormalMap ),

			opacity			: uniform( 0.075 ),

			color			: uniform( color ),

			tDiffuse		: reflection,
		}

		material.uniforms = uniforms

		// world xz, tiled, for the normal map
		const vPosition = positionWorld.xz.mul( uniforms.tiles )

		// the reflection texel under this pixel (the mirror image is flipped in x)
		const screen = screenUV.flipX()

		// Offsets below are in the WebGL texture's space (y up); screen uvs run down.

		if( isCyberCity ) {

			const nn = sampleRaw( uniforms.normalMap, fract( vPosition ) ).xyz

			// texture2DProj( tDiffuse, vUv + vec4( 0, 2r + 2b, 0, 0 ) ): the offset is divided by w = -viewZ
			reflection.uvNode = screen.add( vec2( 0, nn.r.mul( 2.0 ).add( nn.b.mul( 2.0 ) ).div( positionView.z ) ) )

			material.colorNode = reflection.rgb.mul( nn.g.oneMinus() ).mul( nn.r ).mul( 3.5 )

			material.opacityNode = tslFloat( 1.0 )
		}
		else {

			const needsNormal = uniforms.useNormalMap.mul( uniforms.normalStrength )

			const nn = sampleRaw( uniforms.normalMap, mod( vPosition, 1.0 ) ).xyz

			const myNormal = normalize( vec3( nn.r.mul( 2.0 ).sub( 1.0 ), nn.b, nn.g.mul( 2.0 ).sub( 1.0 ) ) )

			// coord.z of the projective lookup: the [0,1] depth of this fragment
			const depth = viewZToPerspectiveDepth( positionView.z, cameraNear, cameraFar )

			const offset = myNormal.xz.mul( depth ).mul( uniforms.normalStrength ).mul( 0.2 )

			reflection.uvNode = select( needsNormal.greaterThan( 0.0 ), screen.add( vec2( offset.x, offset.y.negate() ) ), screen )

			// blendOverlay( reflection, color )
			const reflected = reflection.rgb

			const blend = uniforms.color

			const low = reflected.mul( blend ).mul( 2.0 )

			const high = vec3( 1.0 ).sub( reflected.oneMinus().mul( blend.oneMinus() ).mul( 2.0 ) )

			material.colorNode = mix( low, high, step( 0.5, reflected ) )

			material.opacityNode = uniforms.opacity
		}

		this.reflection = reflection

		this.getRenderTarget = function () {

			return renderTarget;

		};


		const _destroy = this.destroy

		this.destroy = function () {

			reflection.dispose()
			tempTarget.dispose()
			scope.material.dispose()

			if (typeof _destroy === 'function') {

				_destroy.call(this)
			}
		};

	}

	set blur(val){

		this.isBlur = val
	}

	get blur(){

		return this.isBlur
	}

	set opacity( val ){

		this.material.uniforms.opacity.value = val
	}

	get opacity(){

		return this.material.uniforms.opacity.value
	}

	set color( val ) {

		this.material.uniforms.color.value.set( val )
	}

	get color( ){

		return this.material.uniforms.color.value
	}

	set useNormalMap(val){

		this.material.uniforms.useNormalMap.value = val
	}

	get useNormal(){

		return this.material.uniforms.useNormalMap.value
	}

	set normalMap( val ){


		if( this.lastURL == val ) {

			return
		}


		if ( val != null ) {

			Loader.loadImageTexture( val ).then( ( tex )=> {

				tex.needsUpdate = true

				if( this.lastURL == val ) {

					this.material.uniforms.normalMap.value = tex
				}

			})
		}


		else {

			this.material.uniforms.normalMap.value = emptyNormalMap
		}

		this.lastURL = val

	}

	get normalMap() {

		const map = this.material.uniforms.normalMap.value

		return map === emptyNormalMap ? null : map
	}

	set normalStrength( val ){

		this.material.uniforms.normalStrength.value = val
	}

	get normalStrength(){

		return this.material.uniforms.normalStrength.value
	}


	set tiles( val ){

		this.material.uniforms.tiles.value = val
	}

	get tiles(){

		return this.material.uniforms.tiles.value
	}
}

export default Reflector;
