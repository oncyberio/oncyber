
import {

    Fn,
    vec3,
    vec4,
    float as tslFloat,
    min,
    step,
    select,
    varying,
    normalGeometry,

} from "three/tsl"

import {

    ArtworkNodeMaterial,
    KEEP_ALL_FRAGMENTS,
    materialUniform,
    rgb2hsb,
    hsb2rgb,

} from "@3factory/artwork/nodematerial"

/**
 * Frame shading shared by the single and the instanced border: the front and
 * back faces keep the frame colour (very dark colours are lifted a bit), the
 * sides are 10% darker. A borderless frame hides its front face.
 */
export const borderShade = Fn( ( [ color, border ] ) => {

    const normal = normalGeometry

    const front = step( 0.1, normal.z )

    const back = tslFloat( 1.0 ).sub( step( - 0.1, normal.z ) )

    const side = tslFloat( 1.0 ).sub( min( 1.0, front.add( back ) ) )

    const hsb = rgb2hsb( color ).toVar()

    const brightness = select(

        hsb.z.lessThan( 0.05 ),

        hsb.z.add( tslFloat( 1.0 ).sub( side ).mul( 0.05 ) ),

        hsb.z.sub( hsb.z.mul( side ).mul( 0.1 ) )
    )

    const vColor = hsb2rgb( vec3( hsb.xy, brightness ) )

    const alpha = select( border.equal( 0.0 ).and( front.equal( 1.0 ) ), 0.0, 1.0 )

    return vec4( vColor, alpha )
} )

const colorNode = varying( borderShade( materialUniform( "color", "color" ), materialUniform( "border", "float" ) ) )

export default class BorderMaterial extends ArtworkNodeMaterial {

    static get type() {

        return "BorderMaterial"
    }

    constructor(op) {

        super()

        this.uniforms = {

            color: {
                value: op.color,
            },

            border: {
                value: op.hasBorder ? 1.0 : 0.0,
            },
        }

        // The WebGL shader converted its output (colorspace_fragment): use the colour as-is.
        this.colorNode = colorNode

        this.alphaTestNode = KEEP_ALL_FRAGMENTS

        this.transparent = op?.transparent ?? true
    }
}
