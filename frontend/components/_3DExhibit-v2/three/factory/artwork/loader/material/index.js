import { Vector4 } from "three";

import {

    vec2,
    vec4,
    float as tslFloat,
    sin,
    uv,
    varying,
    smoothstep,
    sRGBTransferEOTF,
    sRGBTransferOETF,

} from "three/tsl"

import {

    ArtworkNodeMaterial,
    KEEP_ALL_FRAGMENTS,
    materialUniform,
    materialTexture,
    correctRatio,
    rand,

} from "../../nodematerial"

import Textures from '@3textures'

import Shared from '@3shared'


const scale = 1200.0

const amt = 0.02

const spd = 2.0

const timer = materialUniform( "timer", "float" )

const dpi = materialUniform( "dpi", "float" )

const uvs = materialUniform( "uvs", "vec4" )

const vv = varying( correctRatio( uv(), materialUniform( "aspect2", "float" ), materialUniform( "aspect", "float" ) ) )

const frameUv = uvs.xy.add( uvs.zw.mul( smoothstep( vec2( 0.01 ), vec2( 0.99 ), vv ) ) )

const tInput = materialTexture( "tInput", vec2( frameUv.x, tslFloat( 1.0 ).sub( frameUv.y ) ) )

// The WebGL shader converted the texel to sRGB (colorspace_fragment), then
// added the scanlines and the grain in sRGB, and wrote that out.
const scanline = sin( vv.y.mul( scale ).sub( timer.mul( spd * 6.28 ) ) ).mul( amt ).mul( dpi )

const color = sRGBTransferOETF( tInput.rgb ).add( scanline ).add( rand( vv ).mul( 0.1 ) )

const colorNode = vec4( sRGBTransferEOTF( color ), tInput.a )


export default class SpriteMaterial extends ArtworkNodeMaterial {

    static get type() {

        return "ArtworkLoaderMaterial"
    }

    constructor(options) {

    	const map =  Textures['logo_artwork_loader'];

        map.anisotropy = 4

        map.needsUpdate = true

        super()

        this.uniforms = {

            timer: Shared.timer,

            offset : {value:  Math.random() * 1000},

            dpi : Shared.dpi,

            uvs: {
                value: new Vector4(),
            },

            tInput: {
                value: map,
            },


            aspect2: {

                value: options.ratio
            },

            aspect: {

                value: options.width / options.height
            }
        }

        this.colorNode = colorNode

        this.alphaTestNode = KEEP_ALL_FRAGMENTS

        this.transparent = true

        this.fog = true

        this.side = 2
    }
}
