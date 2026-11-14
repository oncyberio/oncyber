
import {

    Fn,
    If,
    Discard,
    vec3,
    vec4,
    cross,
    varying,
    attribute,
    positionGeometry,

} from "three/tsl"

import { ArtworkNodeMaterial } from "@3factory/artwork/nodematerial"

import { borderShade } from "../bordermaterial"

/** scale, then rotate by the (vec4) quaternion R, then translate */
const transform = Fn( ( [ position, T, R, S ] ) => {

    const transformed = position.mul( S ).toVar()

    transformed.addAssign( cross( R.xyz, cross( R.xyz, transformed ).add( R.w.mul( transformed ) ) ).mul( 2.0 ) )

    transformed.addAssign( T )

    return transformed
} )

const positionNode = transform(

    positionGeometry,

    attribute( "offset", "vec3" ),

    attribute( "rotation", "vec4" ),

    attribute( "scale", "vec3" )
)

// color is in sRGB space, used as-is like the WebGL shader did
const shade = varying( borderShade( attribute( "color", "vec3" ), attribute( "border", "float" ) ) )

const discardHidden = Fn( ( [ color ] ) => {

    If( shade.a.lessThan( 0.1 ), () => {

        Discard()
    } )

    return color
} )

const colorNode = discardHidden( shade )

const occlusionColorNode = discardHidden( vec4( vec3( 0.0 ), shade.a ) )

export default class BorderInstancedMaterial extends ArtworkNodeMaterial {

    static get type() {

        return "BorderInstancedMaterial"
    }

    constructor(op) {

        super()

        this.positionNode = positionNode

        // The WebGL shader converted its output (colorspace_fragment): use the colour as-is.
        this.colorNode = colorNode

        this.transparent = true

        this.fog = true
    }

    setupVariant( variant ) {

        if( variant == "OCCLUSION" ) {

            return { colorNode: occlusionColorNode, fog: false }
        }

        return null
    }
}
