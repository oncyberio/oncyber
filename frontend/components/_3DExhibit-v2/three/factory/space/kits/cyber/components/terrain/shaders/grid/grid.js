import {

    abs,

    fract,

    fwidth,

    min,

    reference,

    uniform,

    uv,

    vec2,

    vec3

} from 'three/tsl'

/**
 * Anti-aliased grid lines, as the WebGL hook did before `diffuseColor`:
 * `diffuse = ( 1 - line ) * diffuse` (unclamped, the cells go negative).
 */
export function gridMaterial( Base ) {

    return class extends Base {

        constructor( data ){

            super({

                shadowSide: 2,

                side: 2,

                fog :true,
            })

            this.uniforms = {

                div     : uniform( data.griddiv ?? 1 ),

                size    : uniform( data.gridsize ?? 1 )
            }

            const vvUv = uv().sub( 0.5 )

            const coord = fract( vvUv.mul( this.uniforms.div ) )

            // Compute anti-aliased world-space grid lines
            const grid = abs( fract( coord.sub( 0.5 ) ).sub( 0.5 ) ).div( fwidth( coord ) ).mul( 0.5 )

            const line = min( grid.x, grid.y )

            this.colorNode = vec3( 1.0 ).sub( line ).mul( reference( 'color', 'color', this ) )

            this.color.set(data.color)
        }

        setRatio(){

        }
    }
}
