// @ts-check

import {

    vec3,
    vec4,
    float as tslFloat,
    abs,
    mix,
    uv,
    varying,
    normalGeometry,
    sRGBTransferEOTF,

} from "three/tsl"

import {

    ArtworkNodeMaterial,
    materialUniform,
    materialTexture,
    correctRatio,
    whenGt,

} from "../../nodematerial"

const selected = materialUniform( "selected", "float" )

const vUv = varying( correctRatio( uv(), tslFloat( 1.0 ), materialUniform( "ratio", "float" ) ) )

const tInput = materialTexture( "tInput", vUv )

const emissiveColor = mix( vec3( 0.0 ), vec3( 0.0, 1.0, 0.0 ), selected )

const final = mix( vec4( emissiveColor, 1.0 ), vec4( tInput.rgb.mul( tslFloat( 1.0 ).sub( selected ) ), tInput.a ), tInput.a )

const color = mix( final.rgb, vec3( tslFloat( 0.0 ).sub( selected ) ), whenGt( 0.5, abs( normalGeometry.z ) ) )

// The WebGL shader wrote its colour without output conversion.
const colorNode = vec4( sRGBTransferEOTF( color ), 1.0 )

export default class PlaceHolderMaterial extends ArtworkNodeMaterial {

    static get type() {

        return "PlaceHolderMaterial"
    }

    constructor(op) {

        super()

        this.uniforms = {

            tInput: {
                value: op.map,
            },

            ratio: {
                value: op.ratio
            },

            selected: {

                value: 0
            }
        }

        this.colorNode = colorNode

        this.polygonOffset = true

        this.polygonOffsetFactor = -2.0

        this.polygonOffsetUnits = -8.0

        this.fog = true
    }
}
