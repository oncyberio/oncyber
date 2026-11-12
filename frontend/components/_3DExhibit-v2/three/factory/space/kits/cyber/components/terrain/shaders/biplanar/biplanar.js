import {

    DataTexture,

    LinearFilter,

    Matrix3

} from 'three'

import {

    Fn,

    abs,

    dot,

    floor,

    fract,

    min,

    mix,

    positionWorld,

    pow,

    reference,

    select,

    sin,

    smoothstep,

    texture,

    uniform,

    uv,

    vec2,

    vec3,

    vec4

} from 'three/tsl'

// `.sample()` re-enables the texture's uv transform; these coordinates are raw.
const sampleRaw = ( node, coord ) => node.sample( coord ).setUpdateMatrix( false )

// WebGL sampled an unset sampler as (0,0,0,0)
const emptyTexture = new DataTexture( new Uint8Array( 4 ), 1, 1 )

// filterable, so the shader samples it like the real maps swapped in later
emptyTexture.minFilter = emptyTexture.magFilter = LinearFilter

emptyTexture.needsUpdate = true

// #define HASHSCALE1 443.8975
const rand2 = Fn( ( [ p ] ) => {

    const p3 = fract( vec3( p.x, p.y, p.x ).mul( 443.8975 ) ).toVar()

    p3.addAssign( dot( p3, p3.yzx.add( 19.19 ) ) )

    return fract( p3.x.add( p3.y ).mul( p3.z ) )
} )

const noise = Fn( ( [ p ] ) => {

    const ip = floor( p )

    const f = fract( p )

    const u = f.mul( f ).mul( vec2( 3.0 ).sub( f.mul( 2.0 ) ) )

    return mix(
        mix( rand2( ip ), rand2( ip.add( vec2( 1.0, 0.0 ) ) ), u.x ),
        mix( rand2( ip.add( vec2( 0.0, 1.0 ) ) ), rand2( ip.add( vec2( 1.0, 1.0 ) ) ), u.x ),
        u.y
    )
} )

// v[ i ] for a float index (GLSL indexed vectors with the ivec3 axes)
const pick = ( v, i ) => select( i.lessThan( 0.5 ), v.x, select( i.lessThan( 1.5 ), v.y, v.z ) )

const sum = ( v ) => v.x.add( v.y ).add( v.z )

function sampleBip( map, p, ma, me, n, k, offa, offb, f ) {

    // project+fetch
    const a = vec2( pick( p, ma.y ), pick( p, ma.z ) ).toVar()

    const b = vec2( pick( p, me.y ), pick( p, me.z ) ).toVar()

    const x1 = sampleRaw( map, a.add( offa ) )
    const x2 = sampleRaw( map, a.add( offb ) )

    const y1 = sampleRaw( map, b.add( offa ) )
    const y2 = sampleRaw( map, b.add( offb ) )

    // (the WebGL shader blends both projections with the x1 - x2 weight)
    const t = smoothstep( 0.2, 0.8, f.sub( sum( x1.sub( x2 ) ).mul( 0.1 ) ) )

    const x = mix( x1, x2, t )

    const y = mix( y1, y2, t )

    // blend factors, shape transition
    const w = pow( vec2( pick( n, ma.x ), pick( n, me.x ) ), vec2( k.div( 8.0 ) ) )

    // blend and return
    return x.mul( w.x ).add( y.mul( w.y ) ).div( w.x.add( w.y ) )
}

/**
 * Builds the biplanar, no-tile terrain colour of the WebGL `map_fragment`
 * override, for a lit or unlit node material:
 * `diffuseColor = vec4( color, opacity ) * biplanar( ... )`.
 *
 * `datNormal` is the vertex normal the WebGL variant used (world-rotated for
 * the diffuse material, object space for the lighting one).
 */
export function createBiplanar( material, opts, datNormal ) {

    const uniforms = {

        edgeTransition      : uniform( opts.edgeTransition ?? 0 ),

        noTileDisplacement  : uniform( opts.noTileDisplacement ?? 0 ),

        smoothAngle         : uniform( opts.smoothAngle ?? 0 ),

        map                 : texture( emptyTexture ),

        sideMap             : texture( emptyTexture ),

        // the map's uv transform (`mapTransform`)
        mapTransform        : uniform( new Matrix3() ).onObjectUpdate( () => {

            const map = material.map

            if( map ) {

                if( map.matrixAutoUpdate ) map.updateMatrix()

                return map.matrix
            }
        } )
    }

    const { edgeTransition, noTileDisplacement, smoothAngle, map, sideMap, mapTransform } = uniforms

    const colorNode = Fn( () => {

        // ( mapTransform[0][0] / 500 ) * worldPosition
        const p = positionWorld.mul( mapTransform.element( 0 ).x.div( 500.0 ) ).toVar()

        // vMapUv
        const texcoord = mapTransform.mul( vec3( uv(), 1.0 ) ).xy.toVar()

        const wn = datNormal.toVar()

        const n = abs( wn ).toVar()

        const k = edgeTransition

        // determine major axis (in x; yz are following axis)
        const ma = select( n.x.greaterThan( n.y ).and( n.x.greaterThan( n.z ) ), vec3( 0, 1, 2 ),
            select( n.y.greaterThan( n.z ), vec3( 1, 2, 0 ), vec3( 2, 0, 1 ) ) ).toVar()

        // determine minor axis (in x; yz are following axis)
        const mi = select( n.x.lessThan( n.y ).and( n.x.lessThan( n.z ) ), vec3( 0, 1, 2 ),
            select( n.y.lessThan( n.z ), vec3( 1, 2, 0 ), vec3( 2, 0, 1 ) ) ).toVar()

        // determine median axis (in x;  yz are following axis)
        const me = vec3( 3.0 ).sub( mi ).sub( ma ).toVar()

        const l = noise( texcoord ).mul( 8.0 )

        const fr = fract( l )

        const ia = floor( l.add( 0.5 ) ) // suslik's method
        const ib = floor( l )

        const f = min( fr, fr.oneMinus() ).mul( 2.0 )

        const offa = sin( vec2( 3.0, 7.0 ).mul( ia ) ).mul( noTileDisplacement )
        const offb = sin( vec2( 3.0, 7.0 ).mul( ib ) ).mul( noTileDisplacement )

        const sampleA = sampleBip( map, p, ma, me, n, k, offa, offb, f )

        const sampleB = sampleBip( sideMap, p, ma, me, n, k, offa, offb, f )

        const smoothCalc = smoothstep( smoothAngle, smoothAngle.add( 0.5 ), wn.y )

        const sampled = mix( sampleB, sampleA, smoothCalc )

        return vec4( reference( 'color', 'color', material ), 1.0 ).mul( sampled )

    } )()

    return { uniforms, colorNode, emptyTexture }
}

/**
 * Turns a node material class into the biplanar terrain material: the biplanar
 * colour replaces `color * map` whenever a map is set (USE_MAP), the plain
 * colour otherwise.
 */
export function biplanarMaterial( Base, getNormal ) {

    return class extends Base {

        constructor( opts ){

            super({

                shadowSide: 2,

                side: 2,

                fog :true,

            })

            const { uniforms, colorNode, emptyTexture } = createBiplanar( this, opts, getNormal() )

            this.uniforms = uniforms

            this._biplanarColor = colorNode

            this._emptyTexture = emptyTexture

            this.uniforms.map.value = this._map ?? emptyTexture

            this.color.set(opts.color)

            this.name ='diffuse_shader'
        }

        setup( builder ) {

            this.colorNode = this.map ? this._biplanarColor : null

            return super.setup( builder )
        }

        set map( val ){

            this._map = val

            if( this.uniforms ) this.uniforms.map.value = val ?? this._emptyTexture
        }

        get map(){

            return this._map
        }

        set edgeTransition( val ){

          this.uniforms.edgeTransition.value = val
        }

        get edgeTransition(){

          return this.uniforms.edgeTransition.value
        }


        set noTileDisplacement( val ){

          this.uniforms.noTileDisplacement.value = val
        }

        get noTileDisplacement(){

          return this.uniforms.noTileDisplacement.value
        }

        set smoothAngle( val ){

          this.uniforms.smoothAngle.value = val
        }

        get smoothAngle(){

          return this.uniforms.smoothAngle.value
        }


        set sideMap( val ){

            this.uniforms.sideMap.value = val ?? this._emptyTexture
        }

        get sideMap(){

            const val = this.uniforms.sideMap.value

            return val === this._emptyTexture ? null : val
        }


        setRatio(){

        }
    }
}
