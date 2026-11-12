// @ts-check

import {

    LinearFilter,
    LinearMipmapLinearFilter,
	SRGBColorSpace, Texture,
    RepeatWrapping

} from 'three'

import {

    vec3,
    vec4,
    float as tslFloat,
    cos,
    sin,
    dot,
    mix,
    cross,
    reflect,
    normalize,
    distance,
    smoothstep,
    uv,
    varying,
    equirectUV,
    normalGeometry,
    modelPosition,
    modelWorldMatrix,
    cameraPosition,

} from 'three/tsl'

import {

    ArtworkNodeMaterial,
    materialUniform,
    materialTexture,

} from '../../../nodematerial'

import Shared from '@3shared'

// < VERTEX >

const depth = smoothstep( 8.0, 20.0, distance( cameraPosition, modelPosition ) )

const scaleVal = mix( 1.0, 3.0, depth )

// uv scaled around its centre
const vUv = varying( uv().mul( 2.0 ).sub( 1.0 ).mul( scaleVal.mul( 0.5 ).add( 0.5 ).mul( 2.0 ) ).mul( 0.5 ).add( 0.5 ) )

const vertDir = modelPosition.sub( cameraPosition )

const n = modelWorldMatrix.element( 2 ).xyz

const vAngle = dot( cross( n, vec3( 0.0, 1.0, 0.0 ) ), normalize( vertDir.negate() ) ).add( materialUniform( "timer", "float" ).mul( 0.1 ) )

// the object normal rotated by vAngle around Y
const c = cos( vAngle )

const s = sin( vAngle )

const worldNormal = varying( vec3(

    c.mul( normalGeometry.x ).sub( s.mul( normalGeometry.z ) ),

    normalGeometry.y,

    s.mul( normalGeometry.x ).add( c.mul( normalGeometry.z ) )
) )

// < FRAGMENT >

const direction = normalize( reflect( vec3( vUv, 1.0 ), worldNormal ) )

const map = materialTexture( "map", equirectUV( vec3( direction.x.negate(), direction.yz ) ) )

// The WebGL shader converted its output (colorspace_fragment): use the colour as-is.
const colorNode = vec4( map.rgb, map.a )


export default class THREE60Material extends ArtworkNodeMaterial {

    static get type() {

        return "THREE60Material"
    }

	constructor(opts){

        const texture = new Texture(opts.image)

        texture.colorSpace = SRGBColorSpace
        texture.minFilter = LinearMipmapLinearFilter
        texture.magFilter = LinearFilter
        texture.generateMipmaps = true;
        texture.wrapS = RepeatWrapping;
        texture.wrapT = RepeatWrapping;

        texture.needsUpdate = true

        // texture.anisotropy = 8

		super()

        this.setValues( opts.materialParams )

        this.transparent = false

        this.uniforms = {

            timer: Shared.timer,

            map: {

                value: texture
            }
        }

        this.colorNode = colorNode

        this.image = opts.image
	}

	set map( val ){

		this.uniforms.map.value = val
	}

	get map(){

		return this.uniforms.map.value
	}

    /** @return { { width: number, height: number } } */
    get dimensions() {

        return {
            width: this.image.naturalWidth,
            height: this.image.naturalHeight,
        }
    }

    /** @return boolean */
    get active() {

        return this._active
    }

    /**
     * @param { boolean } val
     */
    set active(val) {

        this._active = val
    }
}
