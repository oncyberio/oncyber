import { MeshBasicNodeMaterial, DoubleSide } from "three/webgpu"

import {
    Fn,
    If,
    Discard,
    attribute,
    texture,
    uv,
    vec3,
    vec4,
    normalize,
    cross,
    distance,
    smoothstep,
    positionLocal,
    cameraPosition,
    cameraViewMatrix,
    modelWorldMatrix,
    varyingProperty,
    sRGBTransferEOTF,
} from "three/tsl"

/*
 * Instanced nametags: camera facing billboards around each instance offset, sampled from the
 * username atlas ( atlas = [ uv scale, uv offset ] per instance ), faded by opacity, and hidden only
 * when the camera is inside the head ( first person ), alpha tested at 0.5. The pipeline's occlusion variant
 * ( defines.OCCLUSION ) draws them black.
 */

const SIZE = 0.75

function billboard() {

    const offset = attribute( "offset", "vec3" )

    return Fn( () => {

        // rows of the view matrix: camera z and up axes in world space

        const viewZ = vec3( cameraViewMatrix[ 0 ].z, cameraViewMatrix[ 1 ].z, cameraViewMatrix[ 2 ].z )

        const cameraUp = vec3( cameraViewMatrix[ 0 ].y, cameraViewMatrix[ 1 ].y, cameraViewMatrix[ 2 ].y )

        const lookat = cameraPosition.add( viewZ.mul( 1500.0 ) )

        const look = normalize( lookat.sub( offset ) )

        const billboardRight = cross( cameraUp, look )

        const billboardUp = cross( look, billboardRight )

        const position = offset
            .add( billboardRight.mul( positionLocal.x ).mul( SIZE ) )
            .add( billboardUp.mul( positionLocal.y ).mul( SIZE ) )

        const worldPosition = modelWorldMatrix.mul( vec4( position, 1.0 ) ).xyz

        varyingProperty( "float", "vClose" ).assign( smoothstep( 0.8, 1.4, distance( cameraPosition, worldPosition ) ) )

        return position

    } )()
}

export default class Material extends MeshBasicNodeMaterial {

    constructor( op, occlusion = false, uniforms = null ) {

        super()

        this.op = op

        this.uniforms = uniforms || {

            tInput : texture( op.tex ),
        }

        this.isOcclusion = occlusion

        this.side = DoubleSide

        this.transparent = true

        this.fog = false

        this.positionNode = billboard()

        this.buildColor()

        if( uniforms == null ) {

            this.occlusionMaterial = new Material( op, true, this.uniforms )
        }
    }

    buildColor() {

        const atlas = attribute( "atlas", "vec4" )

        const vOpacity = attribute( "opacity", "float" )

        const sample = this.uniforms.tInput.sample( uv().mul( atlas.xy ).add( atlas.zw ) ).setUpdateMatrix( false )

        const occlusion = this.isOcclusion

        this.colorNode = Fn( () => {

            const texel = sample.toVar()

            const alpha = texel.a.mul( vOpacity ).mul( varyingProperty( "float", "vClose" ) )

            If( alpha.lessThan( 0.5 ), () => {

                Discard()
            } )

            // WebGL wrote the texel as-is ( no colour space chunk ): hand the node output its linear value

            const rgb = occlusion ? vec3( 0.0 ) : sRGBTransferEOTF( texel.rgb )

            return vec4( rgb, alpha )

        } )()
    }

    setup( builder ) {

        // pipeline variants flag themselves with defines.OCCLUSION

        if( this.defines?.OCCLUSION !== undefined && this.isOcclusion == false ) {

            this.isOcclusion = true

            this.buildColor()
        }

        return super.setup( builder )
    }

    customProgramCacheKey() {

        return "username-" + this.isOcclusion + "-" + super.customProgramCacheKey()
    }
}
