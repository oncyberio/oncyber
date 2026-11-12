import {

	Color,

	FrontSide,

	Vector3

} from 'three'

import {

	LightingModel,

	NodeMaterial

} from 'three/webgpu'

import {

	Fn,

	cameraPosition,

	clamp,

	dot,

	float as tslFloat,

	length,

	max,

	mix,

	normalize,

	positionWorld,

	pow,

	reflect,

	reflector,

	sRGBTransferEOTF,

	screenUV,

	texture,

	uniform,

	vec2,

	vec3

} from 'three/tsl'

import Emitter from '@3emitter'

import Events from '@3events'

import PipeLineMesh from '@3abstract/pipelinemesh'

// `.sample()` re-enables the texture's uv transform; these coordinates are raw.
const sampleRaw = ( node, coord ) => node.sample( coord ).setUpdateMatrix( false )

// Reflections never render inside another reflection.
let inMirror = false

/**
 * The WebGL water used the light uniforms only for `getShadowMask()`: it
 * multiplied every receiving light's shadow and fed the mask into its own
 * shading. This model does the same with the lights the node system sets up,
 * then writes the water colour as the outgoing light.
 */
class WaterLightingModel extends LightingModel {

	constructor( shade ) {

		super()

		this.shade = shade

		this.shadowMask = tslFloat( 1 ).toVar( 'waterShadowMask' )
	}

	direct( { lightNode } ) {

		if ( lightNode.shadowNode !== null ) {

			this.shadowMask.mulAssign( lightNode.shadowNode )
		}
	}

	finish( { context } ) {

		context.outgoingLight.rgb.assign( this.shade( this.shadowMask ) )
	}
}

class WaterMaterial extends NodeMaterial {

	constructor( shade ) {

		super()

		this.shade = shade

		this.lights = true
	}

	setupLightingModel() {

		return new WaterLightingModel( this.shade )
	}

	// no lights in the scene: no shadows
	setupOutgoingLight() {

		return this.shade( tslFloat( 1 ) )
	}
}

/**
 * three's Water (flat mirror + normal-map ripples + sun specular) on r180's TSL
 * `reflector()`. The sub-render keeps the engine's MIRROR pipeline pass.
 */
export default class Water extends PipeLineMesh {

	constructor( geometry, options = {} ) {


		const textureWidth = options.textureWidth !== undefined ? options.textureWidth : 512;
		const textureHeight = options.textureHeight !== undefined ? options.textureHeight : 512;
		const alpha = options.alpha !== undefined ? options.alpha : 1.0;
		const time = options.time !== undefined ? options.time : 0.0;
		const normalSampler = options.waterNormals !== undefined ? options.waterNormals : null;
		const sunDirection = options.sunDirection !== undefined ? options.sunDirection : new Vector3( 0.70707, 0.70707, 0.0 );
		const sunColor = new Color( options.sunColor !== undefined ? options.sunColor : 0xffffff );
		const waterColor = new Color( options.waterColor !== undefined ? options.waterColor : 0x7F7F7F );
		const distortionScale = options.distortionScale !== undefined ? options.distortionScale : 20.0;
		const side = options.side !== undefined ? options.side : FrontSide;
		const fog = options.fog !== undefined ? options.fog : false; //

		const uniforms = {

			normalSampler	: texture( normalSampler ),

			alpha			: uniform( alpha ),

			// may be swapped for a shared { value } timer (see wrapper.js)
			time			: uniform( time ),

			size			: uniform( 1.0 ),

			distortionScale	: uniform( distortionScale ),

			sunColor		: uniform( sunColor ),

			sunDirection	: uniform( sunDirection ),

			waterColor		: uniform( waterColor ),
		}

		let material

		// read whatever object sits in `uniforms.time` at render time
		const timeNode = uniform( time ).onRenderUpdate( () => material.uniforms.time.value )

		const getNoise = ( coord ) => {

			const uv0 = coord.div( 103.0 ).add( vec2( timeNode.div( 17.0 ), timeNode.div( 29.0 ) ) )
			const uv1 = coord.div( 107.0 ).sub( vec2( timeNode.div( - 19.0 ), timeNode.div( 31.0 ) ) )
			const uv2 = coord.div( vec2( 8907.0, 9803.0 ) ).add( vec2( timeNode.div( 101.0 ), timeNode.div( 97.0 ) ) )
			const uv3 = coord.div( vec2( 1091.0, 1027.0 ) ).sub( vec2( timeNode.div( 109.0 ), timeNode.div( - 113.0 ) ) )

			const noise = sampleRaw( uniforms.normalSampler, uv0 )
				.add( sampleRaw( uniforms.normalSampler, uv1 ) )
				.add( sampleRaw( uniforms.normalSampler, uv2 ) )
				.add( sampleRaw( uniforms.normalSampler, uv3 ) )

			return noise.mul( 0.5 ).sub( 1.0 )
		}

		const mirrorSampler = reflector( {} )

		const shade = ( shadowMask ) => Fn( () => {

			const noise = getNoise( positionWorld.xz.mul( uniforms.size ) )
			const surfaceNormal = normalize( noise.xzy.mul( vec3( 1.5, 1.0, 1.5 ) ) ).toVar()

			const worldToEye = cameraPosition.sub( positionWorld )
			const eyeDirection = normalize( worldToEye ).toVar()

			// sunLight( surfaceNormal, eyeDirection, 100.0, 2.0, 0.5, diffuseLight, specularLight )
			const sunReflection = normalize( reflect( uniforms.sunDirection.negate(), surfaceNormal ) )
			const direction = max( 0.0, dot( eyeDirection, sunReflection ) )
			const specularLight = pow( direction, 100.0 ).mul( uniforms.sunColor ).mul( 2.0 )
			const diffuseLight = max( dot( uniforms.sunDirection, surfaceNormal ), 0.0 ).mul( uniforms.sunColor ).mul( 0.5 )

			const distance = length( worldToEye )

			const distortion = surfaceNormal.xz.mul( tslFloat( 0.001 ).add( tslFloat( 1.0 ).div( distance ) ) ).mul( uniforms.distortionScale )

			// the WebGL target was 8 bit
			const reflectionSample = clamp( mirrorSampler.rgb, 0.0, 1.0 )

			const theta = max( dot( eyeDirection, surfaceNormal ), 0.0 )
			const rf0 = tslFloat( 0.3 )
			const reflectance = rf0.add( rf0.oneMinus().mul( pow( theta.oneMinus(), 5.0 ) ) )
			const scatter = max( 0.0, dot( surfaceNormal, eyeDirection ) ).mul( uniforms.waterColor )

			const albedo = mix(
				uniforms.sunColor.mul( diffuseLight ).mul( 0.3 ).add( scatter ).mul( shadowMask ),
				vec3( 0.1 ).add( reflectionSample.mul( 0.9 ) ).add( reflectionSample.mul( specularLight ) ),
				reflectance
			)

			// mirror texel under this pixel; distortion is in the WebGL texture's y-up space
			mirrorSampler.uvNode = screenUV.flipX().add( vec2( distortion.x, distortion.y.negate() ) )

			// the WebGL shader wrote this value straight out, with no colour conversion
			return sRGBTransferEOTF( albedo.mul( mix( 0.5, 1.0, shadowMask ) ) )

		} )()

		material = new WaterMaterial( shade )

		material.name = 'WaterMaterial'

		material.side = side

		material.fog = fog

		material.transparent = true

		material.opacityNode = uniforms.alpha

		material.uniforms = uniforms

		super( geometry, material, {
			visibleOnOcclusion: false,
			visibleOnMirror: false
		}  )

		// window.wata = this

		this.renderOrder = -999999999

		const scope = this

		scope.material = material;

		// the mesh is the mirror plane (local +Z is the normal)
		const base = mirrorSampler.reflector

		base.target = this

		let renderTarget = null

		this.mirrorSampler = mirrorSampler

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

			// expose the current target like the WebGL clone did
			scope.renderTarget = renderTarget

			inMirror = true

			const currentShadowAutoUpdate = renderer.shadowMap.autoUpdate;
			const currentXrEnabled = renderer.xr?.enabled;
			const previousAutoUpdateScene = scene.matrixWorldAutoUpdate
			const oldCameraAutoUpdate = camera.matrixWorldAutoUpdate

			camera.matrixWorldAutoUpdate = false
			scene.matrixWorldAutoUpdate = false

			if( renderer.xr ) renderer.xr.enabled = false; // Avoid camera modification and recursion

			renderer.shadowMap.autoUpdate = false; // Avoid re-computing shadows

			Emitter.emit(Events.MIRROR, true)

			scope.visible = false

			updateBefore.call( this, frame )

			Emitter.emit(Events.MIRROR, false)

			scope.visible = true

			camera.matrixWorldAutoUpdate = oldCameraAutoUpdate

			scene.matrixWorldAutoUpdate = previousAutoUpdateScene

			if( renderer.xr ) renderer.xr.enabled = currentXrEnabled;

			renderer.shadowMap.autoUpdate = currentShadowAutoUpdate

			inMirror = false
		}

	}

	extraDispose(){

		this.mirrorSampler?.dispose()

		this.mirrorSampler = null

		this.renderTarget = null

	}
}
