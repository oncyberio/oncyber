import {

    Fn,
    vec3,
    vec4,
    max,
    mix,
    step,
    float as tslFloat,
    attribute,
    varying,
    normalGeometry,

} from "three/tsl"

import { ArtworkNodeMaterial } from "@3factory/artwork/nodematerial"

import { instancedBoxPosition } from "../borderinstancedmaterial"

/**
 * Gallery frame boxes (moulding, mat, backing, label plate), all in one
 * instanced draw. Unlit like the rest of the artwork pipeline, with a fixed
 * light from above so the moulding's depth reads: top faces catch light,
 * bottom faces and the sides fall off. `border` is 1 for the moulding and
 * 0 for flat parts (mat, backing, plate), which are shaded more softly.
 */
export const galleryShade = Fn( ( [ color, moulding ] ) => {

    const normal = normalGeometry

    const front = step( 0.5, normal.z )

    const top = step( 0.5, normal.y )

    const bottom = step( 0.5, normal.y.negate() )

    const side = step( 0.5, normal.x.abs() )

    const back = step( 0.5, normal.z.negate() )

    // moulding: strong falloff; flat parts: gentle
    const k = front
        .add( top.mul( mix( tslFloat( 0.97 ), tslFloat( 1.12 ), moulding ) ) )
        .add( side.mul( mix( tslFloat( 0.9 ), tslFloat( 0.74 ), moulding ) ) )
        .add( bottom.mul( mix( tslFloat( 0.84 ), tslFloat( 0.55 ), moulding ) ) )
        .add( back.mul( 0.5 ) )

    // Near-black mouldings would lose every face to black: lift them a bit
    // so the profile still shows.
    const base = mix( color, max( color, vec3( 0.05 ) ), moulding )

    return vec4( base.mul( k ), 1.0 )
} )

const colorNode = varying( galleryShade( attribute( "color", "vec3" ), attribute( "border", "float" ) ) )

const occlusionColorNode = vec4( vec3( 0.0 ), 1.0 )

export default class GalleryFrameMaterial extends ArtworkNodeMaterial {

    static get type() {

        return "GalleryFrameMaterial"
    }

    constructor() {

        super()

        this.positionNode = instancedBoxPosition

        // Colours are sRGB and used as-is, like the flat border's.
        this.colorNode = colorNode

        this.fog = true
    }

    setupVariant( variant ) {

        if( variant == "OCCLUSION" ) {

            return { colorNode: occlusionColorNode, fog: false }
        }

        return null
    }
}
