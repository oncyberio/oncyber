import * as THREE from "three"

import { MeshBasicNodeMaterial, Node } from "three/webgpu"

import {

    cameraPosition,
    cameraViewMatrix,
    instancedMesh,
    modelWorldMatrix,
    nodeObject,
    normalize,
    positionGeometry,
    positionLocal,
    vec3,
    vec4,

} from "three/tsl"


// Fog and colour output are node-based now (see ../tsl/fog.js).
export var ShaderOverride = function(){}


// Options only the old GLSL hook system understood. Node materials have no
// shader-string hooks; port such materials to node graphs instead.
const HOOK_OPTIONS = [ 'vertexShaderHooks', 'fragmentShaderHooks', 'uniforms', 'defines' ]

function splitHookOptions( material, opts ){

    const values = Object.assign( {}, opts )

    for( const key of HOOK_OPTIONS ) delete values[ key ]

    material.uniforms = opts.uniforms || {}

    if( opts.defines ) material.defines = Object.assign( {}, opts.defines )

    return values
}


/**
 * Built-in materials (GLTF loader classes). WebGPURenderer converts them to
 * node materials on its own.
 */
export class MeshBasicMaterial extends THREE.MeshBasicMaterial {

    constructor( opts = {} ){

        super()

        this.setValues( splitHookOptions( this, opts ) )
    }
}


export class MeshStandardMaterial extends THREE.MeshStandardMaterial {

    constructor( opts = {} ){

        super()

        this.setValues( splitHookOptions( this, opts ) )
    }
}


// Properties a MeshBasicMaterial carries, copied over from the source material.
const BASIC_PROPERTIES = [ ...Object.keys( new THREE.MeshBasicMaterial() ), 'alphaTest' ].filter( key =>

    ![ 'uuid', 'name', 'type', 'version', 'userData', 'id' ].includes( key ) &&

    !key.startsWith( 'is' ) && !key.startsWith( '_' )
)

/**
 * Unlit Y-axis billboard (grass): quads turn around Y to face the camera.
 * Takes the material it replaces as its options.
 *
 * The billboard only applies to the colour pass, as before: the shadow pass
 * draws the unbillboarded geometry.
 */
export class BillboardYMaterial extends MeshBasicNodeMaterial {

    constructor( _customCreateOption = {} ){

        super()

        const source = _customCreateOption

        if( source.isMaterial ) {

            for( const key of BASIC_PROPERTIES ) {

                const value = source[ key ]

                if( value === undefined ) continue

                if( value && ( value.isColor || value.isVector2 || value.isEuler ) ) this[ key ].copy( value )

                else this[ key ] = value
            }

            this.name = source.name

            this.userData = source.userData
        }
        else {

            this.setValues( source )
        }
    }

    setupPosition( builder ) {

        const { object } = builder

        if( object.isInstancedMesh === true && object.instanceMatrix?.isInstancedBufferAttribute === true ) {

            // The instance's translation is the centre, its columns the size.

            const instance = instancedMesh( object )

            instance.toStack()

            nodeObject( new BillboardInstanceNode( instance ) ).toStack()

            return positionLocal
        }

        const size = vec3(

            modelWorldMatrix[ 0 ].xyz.length(),

            modelWorldMatrix[ 1 ].xyz.length(),

            modelWorldMatrix[ 2 ].xyz.length()
        )

        positionLocal.assign( billboardY( positionGeometry, positionGeometry, size ) )

        return positionLocal
    }
}

// Runs after the instance node's setup, which builds the instance matrix
// node and transforms positionLocal by it; the billboard then replaces that.
class BillboardInstanceNode extends Node {

    constructor( instance ){

        super( 'void' )

        this.instance = instance
    }

    setup(){

        const matrix = this.instance.instanceMatrixNode

        const center = matrix.mul( vec4( 0.0, 0.0, 0.0, 1.0 ) ).xyz

        const size = vec3( matrix[ 0 ].xyz.length(), matrix[ 1 ].xyz.length(), matrix[ 2 ].xyz.length() )

        positionLocal.assign( billboardY( positionGeometry, center, size ) )
    }
}

// GLSL billboardX( v, viewMatrix, center, size )

function billboardY( v, center, size ){

    const view = cameraViewMatrix

    let look = cameraPosition.add( vec3( view[ 0 ].z, view[ 1 ].z, view[ 2 ].z ).mul( 3000.0 ) )

    look = normalize( vec3( look.x, 0.0, look.z ) )

    const up = vec3( 0.0, 1.0, 0.0 )

    const right = up.cross( look )

    return center.add( right.mul( v.x ).mul( size.x ) ).add( up.mul( v.y ).mul( size.y ) )
}
