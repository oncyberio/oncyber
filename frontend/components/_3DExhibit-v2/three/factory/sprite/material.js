import { Vector4 } from "three";

import {

    Fn,
    If,
    Discard,
    vec2,
    vec4,
    float as tslFloat,
    uv,
    varying,
    sRGBTransferEOTF,

} from "three/tsl"

import {

    ArtworkNodeMaterial,
    materialUniform,
    materialTexture,

} from "@3factory/artwork/nodematerial"

const uvs = materialUniform( "uvs", "vec4" )

const frameUv = uvs.xy.add( uvs.zw.mul( uv() ) )

const vUv = varying( vec2( frameUv.x, tslFloat( 1.0 ).sub( frameUv.y ) ) )

const colorNode = Fn( () => {

    const color = materialTexture( "tInput", vUv ).toVar()

    color.a.mulAssign( materialUniform( "alpha", "float" ) )

    If( color.a.lessThan( 0.01 ), () => {

        Discard()
    } )

    // The WebGL shader wrote the texel without output conversion.
    return vec4( sRGBTransferEOTF( color.rgb ), color.a )
} )()

export default class SpriteMaterial extends ArtworkNodeMaterial {

    static get type() {

        return "SpriteSheetMaterial"
    }

    constructor(texture, scale) {

        super()

        this.uniforms = {

            uvs: {
                value: new Vector4(),
            },

            tInput: {
                value: texture,
            },

            alpha: {
                value: 1,
            },
        }

        this.colorNode = colorNode

        this.transparent = true

        this.depthTest = false

        this.side = 2
    }

    set alpha(val) {
        this.uniforms.alpha.value = val;
    }

    get alpha() {
        return this.uniforms.alpha.value;
    }
}
