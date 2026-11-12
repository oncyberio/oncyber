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

} from "../../../../nodematerial"

const vUv = varying( correctRatio( uv(), tslFloat( 1.0 ), materialUniform( "ratio", "float" ) ) )

const tInput = materialTexture( "tInput", vUv )

const final = mix( vec4( 1.0 ), tInput, tInput.a )

const color = mix( final.rgb, vec3( 0.0 ), whenGt( 0.5, abs( normalGeometry.y ) ) )

// The WebGL shader wrote its colour without output conversion.
const colorNode = vec4( sRGBTransferEOTF( color ), 1.0 )

export default class SitZoneMaterial extends ArtworkNodeMaterial {

    static get type() {

        return "SitZoneMaterial"
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
        }

        this.colorNode = colorNode

        this.polygonOffset = true

        this.polygonOffsetFactor = -2.0

        this.polygonOffsetUnits = -8.0

        this.fog = true
    }
}
