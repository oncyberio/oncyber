import { SRGBColorSpace, Color } from "three"

import { MeshBasicNodeMaterial } from "three/webgpu"

import {

    Discard,
    Fn,
    If,
    float as tslFloat,
    max,
    min,
    mix,
    mod,
    modelViewMatrix,
    modelWorldMatrix,
    output,
    positionWorld,
    select,
    sin,
    smoothstep,
    texture,
    uniform,
    uv,
    varying,
    vec2,
    vec3,
    vec4,
    attribute,
    fract,
    floor,

} from "three/tsl"

import { kitPosition, timerD2, fogFactor, smoothstepAny, whenGt } from "./transform.js"

const GRID_SIZE = 50.0

const RGB_SHIFT_POWER = 6.0

const MAX_FLAT = 8.0

/**
 * Cyber-city kit material (diffuse and lit pass alike), and the kit preview
 * baker's material. Unlit. Blocks whose name contains "screen" get the
 * animated holographic look (rgb shift glitches, scanlines, grid).
 */
export default class FutureMaterial extends MeshBasicNodeMaterial {

    constructor(block, op, shared = null) {

        super()

        const name = block.name

        const lower = name.toLowerCase()

        this.side = 2

        this.transparent = false

        this.fog = op.instance == true

        if( shared ) {

            this.uniforms = shared.uniforms

            this.defines  = Object.assign( {}, shared.defines )

            this.transparent = shared.transparent

            return
        }

        const defines = {}

        // `color` was only provided by the preview baker; a
        // missing GLSL uniform read as black.

        const uniforms = {

            color: uniform( new Color( op.uniforms.color?.value ?? 0x000000 ) ),

            map: { value: op.uniforms.map?.value ?? null },
        }

        if( op.preview == true ) {

            defines['PREVIEW'] = ''
        }

        if ( uniforms.map.value != null ){

            uniforms.map.value.needsUpdate = true

            uniforms.map.value.generateMipmaps = true

            uniforms.map.value.colorSpace = SRGBColorSpace

            // Sampled at the raw uv, like the GLSL (no texture.matrix).

            uniforms.map = texture( uniforms.map.value, uv() )

        	defines['USE_MAP'] = ''
        }

        if( lower.includes('screen') ) {

            this.transparent = true

        	defines['SCREEN'] = ''

            let texture_ratio = 1;

            const data = uniforms.map.value?.source?.data

            if( data ){

                texture_ratio = data.width / data.height
            }

            uniforms.texture_ratio = uniform( texture_ratio )

            uniforms.timer = timerD2
        }

        if( block.material.alphaTest < 1 ) {

            defines['ALPHA_TEST'] = ''

            uniforms.alphaTest = uniform( block.material.alphaTest )
        }

        if( lower.includes('rotate') ) {

            defines['ROTATING'] = ''
        }

        if ( op.instance ){

            defines['INSTANCE'] = ''
        }

        this.uniforms = uniforms

        this.defines = defines

        this.occlusionMaterial    = new FutureMaterial( block, op, this )

        this.mirrorMaterial       = new FutureMaterial( block, op, this )
    }

    get map(){

        return this.uniforms?.map.value
    }

    set map( val ){

        // MeshBasicNodeMaterial's defaults assign `map = null` before the uniforms exist.

        if( this.uniforms ) this.uniforms.map.value = val
    }

    setup( builder ) {

        const defines = this.defines || {}

        if( defines.SCREEN !== undefined ) {

            this.setupHolo( builder, defines )
        }
        else {

            this.setupDiffuse( builder, defines )
        }

        super.setup( builder )
    }

    setupDiffuse( builder, defines ) {

        const { uniforms } = this

        const instance = defines.INSTANCE !== undefined

        // `timer` was only bound for screens, so ROTATING blocks sat at angle 0.

        const transformed = kitPosition( { instance } )

        this.positionNode = instance ? transformed : null

        if( defines.OCCLUSION !== undefined ) {

            this.colorNode = vec4( 0.0, 0.0, 0.0, 1.0 )

            this.outputNode = vec4( 0.0, 0.0, 0.0, 1.0 )

            return
        }

        this.outputNode = null

        if( defines.USE_MAP !== undefined ) {

            const worldHeight = varying( transformed.y )

            this.colorNode = Fn( () => {

                const color = uniforms.map.toVar()

                if( defines.ALPHA_TEST !== undefined ) {

                    If( color.a.lessThan( uniforms.alphaTest ), () => {

                        Discard()
                    } )
                }

                if( defines.PREVIEW === undefined ) {

                    color.rgb.mulAssign( smoothstep( 0.0, 3.0, worldHeight ).mul( 0.3 ) )
                }

                return color

            } )()
        }
        else {

            this.colorNode = vec4( uniforms.color, 1.0 )
        }
    }

    setupHolo( builder, defines ) {

        const { uniforms } = this

        const instance = defines.INSTANCE !== undefined

        const timer = uniforms.timer

        const map = uniforms.map

        const textureRatio = uniforms.texture_ratio

        const transformed = kitPosition( { instance, rotateTimer: defines.ROTATING !== undefined ? timer : null } )

        this.positionNode = instance ? transformed : null

        // vertex stage

        const offset = instance ? attribute( 'offset', 'vec3' ) : vec3( 0.0 )

        const midZ = modelViewMatrix.mul( vec4( offset, 1.0 ) ).z.negate()

        const scanSize = varying( smoothstepAny( MAX_FLAT, MAX_FLAT - 0.001, midZ ) )

        const mdlMidZ = modelWorldMatrix.mul( vec4( offset, 1.0 ) ).z

        const rand = fract( sin( floor( mdlMidZ.add( timer.mul( 10.0 ) ) ) ).mul( 43758.5453123 ) )

        const shiftPower = varying( instance ? mix( RGB_SHIFT_POWER, 0.0, whenGt( 0.965, rand ) ) : tslFloat( 0.0 ) )

        // vec2( x + z, y ) of the world position

        const posUv = vec2( positionWorld.x.add( positionWorld.z ), positionWorld.y )

        const rgbShift = ( vUv ) => {

            const d1 = shiftPower.mul( 0.001 )

            const d2 = shiftPower.mul( 0.002 )

            const q = vUv.mul( textureRatio )

            const x = shiftPower
                .mul( sin( timer.mul( 0.3 ).add( q.y.mul( 21.0 ) ) ) )
                .mul( sin( timer.mul( 0.7 ).add( q.y.mul( 29.0 ) ) ) )
                .mul( sin( timer.mul( 0.33 ).add( 0.3 ).add( q.y.mul( 31.0 ) ) ) )
                .mul( 0.0017 )

            const r = map.sample( vec2( x.add( vUv.x ).add( d1 ), vUv.y.add( d1 ) ) ).x.add( 0.05 )

            const g = map.sample( vec2( x.add( vUv.x ), vUv.y.sub( d2 ) ) ).y.add( 0.05 )

            const b = map.sample( vec2( x.add( vUv.x ).sub( d2 ), vUv.y ) ).z.add( 0.05 )

            const quarter = shiftPower.mul( 0.75 )

            const r2 = map.sample( quarter.mul( vec2( x.add( 0.025 ), - 0.027 ) ).add( shiftPower.mul( vec2( vUv.x.add( 0.001 ), vUv.y.add( 0.001 ) ) ) ) ).x

            const g2 = map.sample( quarter.mul( vec2( x.sub( 0.022 ), - 0.02 ) ).add( shiftPower.mul( vec2( vUv.x, vUv.y.sub( 0.002 ) ) ) ) ).y

            const b2 = map.sample( quarter.mul( vec2( x.sub( 0.02 ), - 0.018 ) ).add( shiftPower.mul( vec2( vUv.x.sub( 0.002 ), vUv.y ) ) ) ).z

            return vec3( r.add( r2.mul( 0.08 ) ), g.add( g2.mul( 0.05 ) ), b.add( b2.mul( 0.08 ) ) )
        }

        const scan = () => {

            const tt = sin( timer.mul( 3.5 * 5.0 ).add( posUv.y.mul( GRID_SIZE ) ) ).mul( 0.35 ).add( 0.35 )

            return max( whenGt( tt, 0.1 ), 0.6 )
        }

        const grid = () => {

            const size = scanSize.mul( GRID_SIZE )

            const v = tslFloat( 1.0 ).sub( clamp01( mod( posUv.x.mul( size ), 2.0 ).sub( 1.0 ).mul( 2.0 ) ).mul( 0.65 ) )

            return whenGt( v, 0.5 )
        }

        const isMirror = defines.MIRROR !== undefined

        this.colorNode = Fn( () => {

            const vUv = uv()

            // Both paths are sampled: the switch is per instance, and sampling
            // stays out of non-uniform control flow.

            const color = select( shiftPower.greaterThan( 0.0 ), vec4( rgbShift( vUv ), 1.0 ), map ).toVar()

            color.rgb.mulAssign( scan() )

            if( !isMirror ) {

                color.rgb.mulAssign( grid() )
            }

            color.a.mulAssign( min( color.r.add( color.g ).add( color.b ), 1.0 ) )

            If( color.a.lessThan( 0.1 ), () => {

                Discard()
            } )

            return color

        } )()

        // The fog itself is the global fog node; the occlusion and mirror
        // passes then tint and dim the fogged colour.

        if( defines.OCCLUSION !== undefined || isMirror ) {

            const factor = instance ? fogFactor( this, builder ) : null

            const dim = factor ? max( tslFloat( 1.0 ).sub( factor ), 0.6 ) : tslFloat( 0.6 )

            const tinted = mix( output.rgb, output.rgb.mul( vec3( uv(), 1.0 ) ), 0.9 ).mul( dim )

            this.outputNode = vec4( defines.OCCLUSION !== undefined ? tinted : tinted.mul( 1.2 ), output.a )
        }
        else {

            this.outputNode = null
        }
    }
}

function clamp01( x ) {

    return x.clamp( 0.0, 1.0 )
}
