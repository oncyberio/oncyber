// @ts-check
import {

    BoxGeometry,

    SphereGeometry,

    Color,

    Texture,

    BackSide,

} from 'three'

import {

    NodeMaterial

} from 'three/webgpu'

import {

    cubeTexture,

    float as tslFloat,

    modelViewProjection,

    modelWorldMatrix,

    normalize,

    pmremTexture,

    positionLocal,

    varying,

    vec4,

} from 'three/tsl'

import Triangle from './geos/triangle'

import ColorMaterial from './materials/color.js'
import SharpMaterial from './materials/sharp.js'

import PipeLineMesh from '@3abstract/pipelinemesh'

/**
 * ShaderLib.backgroundCube as a node material: the environment (a PMREM, or a
 * plain cube texture) seen along the world direction, at the far plane, with
 * no blur and intensity 1. `uniforms.envMap.value` swaps the texture.
 */
class BackgroundCubeMaterial extends NodeMaterial {

    /** @param { Texture } envMap */
    constructor( envMap ) {

        super()

        this.name = 'BackgroundCubeMaterial'

        this.side = BackSide

        this.fog = false

        // transformDirection( position, modelMatrix )
        const direction = varying( normalize( modelWorldMatrix.mul( vec4( positionLocal, 0.0 ) ).xyz ) )

        // @ts-ignore
        const envMapNode = envMap.isCubeTexture ? cubeTexture( envMap, direction ) : pmremTexture( envMap, direction, tslFloat( 0 ) )

        this.uniforms = {

            envMap: envMapNode
        }

        this.vertexNode = modelViewProjection.setZ( modelViewProjection.w )

        this.colorNode = envMapNode
    }
}

let pipeLineOpts = {

    visibleOnOcclusion: false,

    visibleOnMirror : true
}

class BackgroundFactory {

    /**
     *
     * @param { Color | Texture } value
     * @returns
     */
    get(value) {



        if (value == null) {

            return null
        }

        let mesh;

        // color
        if ( value instanceof Color ) {

            mesh = new PipeLineMesh( new Triangle(), new ColorMaterial(),  pipeLineOpts )

            mesh.material.uniforms.color.value.copy(value).convertSRGBToLinear()

        } else {

            if( value.sharp ) {

                mesh = new PipeLineMesh(
                    new SphereGeometry(2,32, 32),
                    new SharpMaterial( {
                        map : value.sharp,
                    }),
                    pipeLineOpts
                )

                // value.dispose = function(){

                // }

                mesh.scale.z = -1

                mesh.onBeforeRender = function ( renderer, scene, camera ) {

                    this.matrixWorld.copyPosition(camera.matrixWorld)

                    // this.scale.set(camera.far,camera.far,camera.far)
                };

                mesh.updateMatrixWorld()

            }

            else {


                mesh = new PipeLineMesh(
                    new BoxGeometry(1, 1, 1),
                    new BackgroundCubeMaterial( value ),
                    pipeLineOpts
                )

                mesh.geometry.deleteAttribute( 'normal' );

                mesh.geometry.deleteAttribute( 'uv' );


                mesh.onBeforeRender = function ( renderer, scene, camera ) {

                    this.matrixWorld.copyPosition(camera.matrixWorld)

                    // this.updateMatrixWorld()

                };

            }
        }

        mesh.matrixAutoUpdate = false

        mesh.renderOrder = -100000000

        mesh.name = 'backgroundMesh'
        // console.log( mesh)

        mesh.frustumCulled = false

        return mesh
    }
}

export default new BackgroundFactory()
