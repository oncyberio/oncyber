// @ts-check

import { Texture } from "three"

import { NodeMaterial } from "three/webgpu"

import {

    Fn,
    vec2,
    vec3,
    vec4,
    float as tslFloat,
    abs,
    min,
    max,
    mix,
    mod,
    step,
    sign,
    clamp,
    fract,
    sin,
    dot,
    texture,
    materialReference,

} from "three/tsl"

/**
 * Helpers shared by the artwork / label / text node materials.
 *
 * These materials keep the WebGL `material.uniforms.name.value` API. The node
 * graph is built once per class and reads those values from the material that
 * is being drawn, so every instance of a class shares one compiled pipeline
 * (exactly like the built-in materials do with `material.color`, `map`, ...).
 */

const EMPTY_TEXTURE = new Texture()

/**
 * `material.uniforms[ name ].value` of the material being drawn.
 *
 * @param { string } name
 * @param { string } type
 */
export function materialUniform( name, type ) {

    return materialReference( `uniforms.${name}.value`, type )
}

function pickTexture( material, name ) {

    const value = material?.uniforms?.[ name ]?.value

    return value && value.isTexture ? value : EMPTY_TEXTURE
}

/**
 * Samples `material.uniforms[ name ].value` of the material being drawn.
 *
 * @param { string } name
 * @param { any } [uvNode]
 */
export function materialTexture( name, uvNode ) {

    const node = texture( EMPTY_TEXTURE, uvNode )

    // A few build decisions depend on the texture (the WebGL2 backend flips
    // ImageBitmaps and render targets in the shader, and decodes sRGB video
    // there): build with the drawn material's texture. `textureCacheKey`
    // keeps materials whose textures need a different build apart.
    const setup = node.setup

    node.setup = function( builder ) {

        this.value = pickTexture( builder.material, name )

        return setup.call( this, builder )
    }

    return node.onObjectUpdate( ( { material } ) => pickTexture( material, name ) )
}

/**
 * The texture traits a node build depends on (see `materialTexture`).
 *
 * @param { any } texture
 */
function textureCacheKey( texture ) {

    if( texture == null || texture.isTexture !== true ) return "-"

    const bitmap = typeof ImageBitmap !== "undefined" && texture.image instanceof ImageBitmap && texture.flipY === true

    return ( bitmap ? "b" : "" ) +
        ( texture.isRenderTargetTexture || texture.isFramebufferTexture || texture.isDepthTexture ? "r" : "" ) +
        ( texture.isVideoTexture ? "v" + texture.colorSpace : "" )
}

/**
 * Base class: unlit, no fog unless asked, `uniforms` kept.
 *
 * The material pipeline (`abstract/pipelinemesh.js`) marks occlusion / mirror
 * variants with `defines.OCCLUSION` / `defines.MIRROR`. Subclasses return the
 * node overrides for a variant from `setupVariant()`; they are only applied
 * while the graph is built, so the material's properties (and so its cache
 * key) stay stable.
 */
export class ArtworkNodeMaterial extends NodeMaterial {

    constructor() {

        super()

        this.lights = false

        this.fog = false

        /** @type { Record<string, { value: any }> } */
        this.uniforms = {}
    }

    get pipelineVariant() {

        const defines = this.defines

        if( defines?.OCCLUSION !== undefined ) return "OCCLUSION"

        if( defines?.MIRROR !== undefined ) return "MIRROR"

        return ""
    }

    customProgramCacheKey() {

        let key = super.customProgramCacheKey() + this.pipelineVariant

        for( const name in this.uniforms ) {

            const value = this.uniforms[ name ]?.value

            if( value?.isTexture ) key += "," + name + textureCacheKey( value )
        }

        return key
    }

    /**
     * @param { string } variant
     * @returns { object | null }
     */
    setupVariant( variant ) {

        return null
    }

    setup( builder ) {

        const overrides = this.setupVariant( this.pipelineVariant )

        if( overrides == null ) {

            super.setup( builder )

            return
        }

        const saved = {}

        for( const key in overrides ) {

            saved[ key ] = this[ key ]

            this[ key ] = overrides[ key ]
        }

        try {

            super.setup( builder )
        }
        finally {

            Object.assign( this, saved )
        }
    }
}

/**
 * Transparent WebGL materials without an explicit `discard` still drew (and
 * wrote depth for) fully transparent fragments. Node materials discard
 * `alpha <= alphaTest` (0 by default); this keeps every fragment.
 */
export const KEEP_ALL_FRAGMENTS = tslFloat( -1 )

export const whenGt = Fn( ( [ x, y ] ) => max( sign( x.sub( y ) ), 0.0 ) )

/**
 * Cover-fits a 0..1 uv of a `baseratio` image onto an `asp` surface.
 */
export const correctRatio = Fn( ( [ inUv, baseratio, asp ] ) => {

    return mix(

        vec2(
            inUv.x,
            inUv.y.mul( baseratio ).div( asp ).add( tslFloat( 0.5 ).mul( tslFloat( 1.0 ).sub( baseratio.div( asp ) ) ) )
        ),

        vec2(
            inUv.x.mul( asp ).div( baseratio ).add( tslFloat( 0.5 ).mul( tslFloat( 1.0 ).sub( asp.div( baseratio ) ) ) ),
            inUv.y
        ),

        whenGt( baseratio, asp )
    )
} )

export const rgb2hsb = Fn( ( [ c ] ) => {

    const K = vec4( 0.0, - 1.0 / 3.0, 2.0 / 3.0, - 1.0 )

    const p = mix( vec4( c.bg, K.wz ), vec4( c.gb, K.xy ), step( c.b, c.g ) )

    const q = mix( vec4( p.xyw, c.r ), vec4( c.r, p.yzx ), step( p.x, c.r ) )

    const d = q.x.sub( min( q.w, q.y ) )

    const e = 1.0e-10

    return vec3(
        abs( q.z.add( q.w.sub( q.y ).div( d.mul( 6.0 ).add( e ) ) ) ),
        d.div( q.x.add( e ) ),
        q.x
    )
} )

export const hsb2rgb = Fn( ( [ c ] ) => {

    const rgb = clamp( abs( mod( c.x.mul( 6.0 ).add( vec3( 0.0, 4.0, 2.0 ) ), 6.0 ).sub( 3.0 ) ).sub( 1.0 ), 0.0, 1.0 ).toVar()

    rgb.assign( rgb.mul( rgb ).mul( tslFloat( 3.0 ).sub( rgb.mul( 2.0 ) ) ) )

    return c.z.mul( mix( vec3( 1.0 ), rgb, c.y ) )
} )

export const rand = Fn( ( [ n ] ) => fract( sin( dot( n, vec2( 12.9898, 4.1414 ) ) ).mul( 43758.5453 ) ) )
