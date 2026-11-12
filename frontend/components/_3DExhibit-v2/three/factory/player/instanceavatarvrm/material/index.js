import {

	MeshBasicNodeMaterial,

	MeshLambertNodeMaterial,

	Texture,

	Vector4,

	Color

} from 'three/webgpu'

import {

	Fn,

	If,

	Discard,

	attribute,

	uniform,

	uniformArray,

	texture,

	uv,

	vec2,

	vec3,

	vec4,

	float as tslFloat,

	int as tslInt,

	ivec2,

	mat4,

	cos,

	sin,

	abs,

	mod,

	step,

	floor,
    fract,

	min,

	max,

	mix,

	dot,

	smoothstep,

	positionLocal,

	positionView,

	normalLocal,

	varyingProperty,

	cameraViewMatrix,

	modelNormalMatrix,

	sRGBTransferEOTF,

	sRGBTransferOETF

} from 'three/tsl'

import { avatarLighting } from '@features/lobby/webgpu/avatarLighting'
import Shared from '@3shared'

import { compactTravelAvatarFadeScale } from '@features/lobby/worldTravelCamera'


/*
 * Instanced VRM avatar material (WebGPU / TSL port of the old unlit and lambert
 * GLSL shader pair).
 *
 * Per instance : offset (vec3), rotationY, scale, opacity, animations = [ previous clip, clip,
 * clip start time, crossfade duration ] and, for the pfp atlas, atlas = [ uv scale, uv offset ].
 *
 * Bone matrices are read with integer texel loads from the baked animation atlas
 * ( 4 texels per bone, one row per frame ), clip uv rects / loop flags come from two small
 * uniform arrays ( the old META_DATA_ARRAY / ADDITIONAL_META_DATA_ARRAY constants ).
 *
 * `new Material( options )` gives the unlit look, `new Material( options, true )` the Lambert lit
 * one. Both expose `uniforms` and `occlusionMaterial` like before; the pipeline adds
 * `defines.OCCLUSION` on the occlusion variant, read in setup().
 */

const FPS = 1 / 30

const FADE_LEVEL = 0.016

let timerNode = null

// one node for every avatar material, fed from the engine's animation clock

function getTimerNode() {

	if( timerNode == null ) {

		timerNode = uniform( Shared.animationTimer.value ).onRenderUpdate( () => Shared.animationTimer.value )
	}

	return timerNode
}

function metaArray( meta ) {

	const data = meta.image.source.data.data

	const values = []

	let i = 0

	while( i < data.length ) {

		values.push( new Vector4( data[i], data[i + 1], data[i + 2], data[i + 3] ) )

		i += 4
	}

	if( values.length == 0 ) {

		values.push( new Vector4() )
	}

	return uniformArray( values, 'vec4' )
}

function createUniforms( options, lighting ) {

	const base = options.base

	base.updateWorldMatrix( true, true )

	base.bind( base.skeleton )

	const animationTexture = options.animationTexture.isTexture ? options.animationTexture : options.animationTexture.texture

	const uniforms = {

		baseScale : uniform( options.scale ),

		bindMatrix : uniform( base.bindMatrix ),

		bindMatrixInverse : uniform( base.bindMatrixInverse ),

		boneTexture : texture( animationTexture ),

		timer : getTimerNode(),

		avatarCameraFadeScale : uniform( 1 ).onRenderUpdate( ( { camera } ) => compactTravelAvatarFadeScale( camera ) ),

		metaData : metaArray( options.metadata ),

		additionalMetaData : metaArray( options.additionalMetas ),
	}

	if( options.atlas ) {

		uniforms.map = texture( new Texture() )
	}

	else if( base.material.emissiveMap != null || base.material.map != null ) {

		uniforms.map = texture( base.material.map ? base.material.map : base.material.emissiveMap )
	}

	if( base.material.color ) {

		uniforms[ lighting ? 'diffuse' : 'ucolor' ] = uniform( base.material.color )
	}

	else if( lighting ) {

		uniforms.diffuse = uniform( new Color( 0xffffff ) )
	}

	return uniforms
}

function textureSize( options ){

	const tex = options.animationTexture

	if( tex.source ) {

		return { width: tex.source.data.width, height: tex.source.data.height }
	}

	return { width: tex.width, height: tex.height }
}


/*
 * Vertex : baked skinning + crossfade + per instance transform. Writes positionLocal (returned),
 * normalLocal (lit path) and the vFinalNormal varying (unlit path).
 */

function buildVertex( material ) {

	const { uniforms, atlasSize } = material

	const skinIndex  = attribute( 'skinIndex', 'uvec4' )

	const skinWeight = attribute( 'skinWeight', 'vec4' )

	const offset     = attribute( 'offset', 'vec3' )

	const rotationY  = attribute( 'rotationY', 'float' )

	const scale      = attribute( 'scale', 'float' )

	const animations = attribute( 'animations', 'vec4' )
    const explicitPose = animations.w.lessThan(0)

	const texel = ( x, y ) => {

		const node = uniforms.boneTexture.load( ivec2( x, y ) )

		// integer texel addresses, no uv transform / per frame update needed

		node.updateMatrix = false

		node.updateType = 'none'

		return node
	}

	const getBoneMatrix = ( index, row, column ) => {

		const x = column.add( tslInt( index ).mul( 4 ) )

		return mat4( texel( x, row ), texel( x.add( 1 ), row ), texel( x.add( 2 ), row ), texel( x.add( 3 ), row ) )
	}

	const getAnimationMatrix = ( packedId, timerStart ) => {
        const id = floor(packedId)

		const metaData = uniforms.metaData.element( tslInt( id ) )

		const additionalMetaData = uniforms.additionalMetaData.element( tslInt( id ) )

		const frameCount = metaData.w.mul( atlasSize.y )

		const lastFrame = max( frameCount.sub( 1 ), 1 )

		// x is loop state

		const currentFrame = additionalMetaData.x.greaterThan( 0.5 ).select(

			mod( floor( uniforms.timer.div( FPS ) ), lastFrame ),

			min( floor( timerStart.div( FPS ) ), lastFrame )
		)

        const exactFrame = min(fract(packedId).mul(additionalMetaData.y).div(FPS), frameCount.sub(1))
        const frame = explicitPose.select(exactFrame, currentFrame)
        const column = tslInt(metaData.x.mul(atlasSize.x).round())
        const rowStart = tslInt(metaData.y.mul(atlasSize.y).round())
        const row = rowStart.add(tslInt(floor(frame)))
        const weighted = (at) => getBoneMatrix(skinIndex.x, at, column).mul(skinWeight.x)
            .add(getBoneMatrix(skinIndex.y, at, column).mul(skinWeight.y))
            .add(getBoneMatrix(skinIndex.z, at, column).mul(skinWeight.z))
            .add(getBoneMatrix(skinIndex.w, at, column).mul(skinWeight.w))
        const skinMatrix = weighted(row).toVar()
        If(explicitPose, () => {
            const nextRow = rowStart.add(tslInt(min(floor(frame).add(1), frameCount.sub(1))))
            skinMatrix.assign(skinMatrix.mul(tslFloat(1).sub(fract(frame))).add(weighted(nextRow).mul(fract(frame))))
        })

		return uniforms.bindMatrixInverse.mul( skinMatrix )
	}

	return Fn( () => {

		const timerStartDifference = uniforms.timer.sub( animations.z )

		const timeMix = explicitPose.select(animations.w.negate().sub(1), smoothstep(0.0, max(animations.w, 0.00001), timerStartDifference))

		const skinVertex = vec4( positionLocal, 1.0 )

		const skinNormal = vec4( normalLocal, 0.0 )

		const skinMatrixB = getAnimationMatrix( animations.y, timerStartDifference )

		const transformed = skinMatrixB.mul( skinVertex ).xyz.toVar()

		const finalNormal = skinMatrixB.mul( skinNormal ).xyz.toVar()

		If( timeMix.lessThan( 1.0 ), () => {

			const skinMatrixA = getAnimationMatrix( animations.x, timerStartDifference )

			transformed.assign( mix( skinMatrixA.mul( skinVertex ).xyz, transformed, timeMix ) )

			finalNormal.assign( mix( skinMatrixA.mul( skinNormal ).xyz, finalNormal, timeMix ) )
		} )

		// rotateY(rad) * v

		const c = cos( rotationY )

		const s = sin( rotationY )

		const rotate = ( v ) => vec3( c.mul( v.x ).add( s.mul( v.z ) ), v.y, c.mul( v.z ).sub( s.mul( v.x ) ) )

		const position = rotate( transformed.mul( uniforms.baseScale ).mul( scale ) ).add( offset )

		// GLSL normalMatrix * n ( view space, not normalized )

		const viewNormal = cameraViewMatrix.mul( vec4( modelNormalMatrix.mul( rotate( finalNormal ) ), 0.0 ) ).xyz

		varyingProperty( 'vec3', 'vFinalNormal' ).assign( viewNormal )

		if( material.lighting ) {

			// Supply an object-space skinned normal exactly once, like the lobby rig.

			normalLocal.assign( rotate( finalNormal ) )
		}

		return position

	} )()
}


/*
 * Fragment helpers
 */

function avatarUv( material ) {

	let vUv = uv()

	if( material.atlas ) {

		const atlas = attribute( 'atlas', 'vec4' )

		vUv = vec2( vUv.x, tslFloat( 1.0 ).sub( vUv.y ) ).mul( atlas.xy ).add( atlas.zw )
	}

	return vUv
}

function fadeDiscard( material ) {

	const vOpacity = attribute( 'opacity', 'float' )

	const fadeScale = material.uniforms.avatarCameraFadeScale

	const dist = positionView.z.negate()

	const level = vec3( FADE_LEVEL )

	const halfLevel = level.mul( 0.5 )

	const fades = vec3( 1.0 ).sub( step(

		smoothstep( fadeScale.mul( 1.5 ), fadeScale.mul( 2.0 ), dist ).mul( 1.01 ),

		abs( mod( positionView.negate(), level ).sub( halfLevel ) ).div( halfLevel )
	) )

	If( min( fades.x.mul( fades.y ).mul( fades.z ), vOpacity ).lessThan( 0.01 ), () => {

		Discard()
	} )
}


function occlusionOutput( material, color ) {

	// OCCLUSION : black, the lit variant keeps its alpha

	return material.lighting ? vec4( 0.0, 0.0, 0.0, color.a ) : vec4( 0.0, 0.0, 0.0, 1.0 )
}

function setupAvatar( material ) {

	const { uniforms } = material

	material.positionNode = buildVertex( material )

	// the WebGL shaders sampled with the raw ( atlas ) uv, without the texture transform

	const sample = uniforms.map ? uniforms.map.sample( avatarUv( material ) ).setUpdateMatrix( false ) : null

	if( material.lighting ) {

		const vOpacity = attribute( 'opacity', 'float' )

		const color = Fn( () => {

			fadeDiscard( material )

			let diffuseColor = vec4( uniforms.diffuse, vOpacity )

			if( sample ) {

				diffuseColor = diffuseColor.mul( sample )
			}

			return diffuseColor

		} )()

		material.colorNode = color
	}

	else {

		material.colorNode = Fn( () => {

			fadeDiscard( material )

			let color = vec4( 1.0 )

			if( sample ) {

				color = sample
			}

			if( uniforms.ucolor ) {

				color = color.mul( vec4( uniforms.ucolor, 1.0 ) )
			}

            // Unlit means authored color, independent of camera and room lights.
            return color

		} )()
	}

	material.outputNode = material.isOcclusion ? occlusionOutput( material, material.colorNode ) : null
}


const AvatarMaterial = ( Base ) => class extends Base {

	constructor( options, lighting, uniforms = null, occlusion = false ) {

		super()

		this.options = options

		this.lighting = lighting
        if (lighting) this.lightsNode = avatarLighting(1)

		this.atlas = options.atlas == true

		this.isOcclusion = occlusion

		const size = textureSize( options )

		this.atlasSize = vec2( size.width, size.height )

		this.uniforms = uniforms || createUniforms( options, lighting )

		this.transparent = true

		this.fog = true

		this.side = options.base.material.side

		if( this.uniforms.map != null && this.atlas == false ) {

			this.map = this.uniforms.map.value
		}

		setupAvatar( this )

		if( uniforms == null ) {

			this.occlusionMaterial = new this.constructor( options, lighting, this.uniforms, true )
		}
	}

	setup( builder ) {

		// pipeline variants flag themselves with defines.OCCLUSION

		if( this.defines?.OCCLUSION !== undefined && this.isOcclusion == false ) {

			this.isOcclusion = true

			this.outputNode = occlusionOutput( this, this.colorNode )
		}

		return super.setup( builder )
	}

	customProgramCacheKey() {

		return 'avatar-vrm-' + this.lighting + '-' + this.atlas + '-' + this.isOcclusion + '-' + super.customProgramCacheKey()
	}

	clone() {

		const material = new this.constructor( this.options, this.lighting, this.uniforms, this.isOcclusion )

		material.defines = this.defines ? Object.assign( {}, this.defines ) : undefined

		return material
	}
}

class DiffuseAvatarMaterial extends AvatarMaterial( MeshBasicNodeMaterial ) {}

class LightingAvatarMaterial extends AvatarMaterial( MeshLambertNodeMaterial ) {}


export default class Material {

	constructor( options, lighting = false ) {

		const source = options.base.material
        const unlit = options.atlas || source.isMeshBasicMaterial || source.isMeshBasicNodeMaterial
        return unlit ? new DiffuseAvatarMaterial(options, false) : new LightingAvatarMaterial(options, true)
	}
}

export { DiffuseAvatarMaterial, LightingAvatarMaterial }
