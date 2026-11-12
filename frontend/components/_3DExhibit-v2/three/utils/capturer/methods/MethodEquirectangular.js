// @ts-check


import { LinearFilter, Object3D, RGBAFormat, Vector3, Camera, CubeCamera, Matrix4 } from "three"
import { CubeRenderTarget } from "three/webgpu"

import { cubeTexture, vec2, vec3 } from "three/tsl"

import renderer from "@3renderer"

import { createQuadMaterial, render } from "../helpers/fboHelper"

import Emitter from '@3emitter'

import Events from '@3events'

import GlobalCamera from '@3camera'



export class MethodEquirectangular extends Object3D {

    constructor() {
        super()

        this.size = 4096
        this.cubeSize = 2048


        this.width = this.size
        this.height = this.width >> 1

        /**
         * @type { CubeRenderTarget }
         */
        this.cubeRenderTarget = new CubeRenderTarget(this.cubeSize, {
            format: RGBAFormat,
            magFilter: LinearFilter,
            minFilter: LinearFilter
        })

        // The cube faces are rendered by a CubeCamera's six cameras so their
        // orientation follows the backend's coordinate system (WebGPU stores the
        // faces flipped); `cubeTexture()` samples them back accordingly. A sample
        // along a world direction then matches the WebGL textureCube lookup.
        this.cubeCamera = new CubeCamera(0.1, 1000, this.cubeRenderTarget)

        this.add(this.cubeCamera)

        const rayDirection = equirectRayDirection()

        this.cubeToEqurectangularMaterial = createQuadMaterial(( vUv ) => cubeTexture(this.cubeRenderTarget.texture, rayDirection(vUv)))

        this.rotation.y = Math.PI / 2;

        this.updateMatrixWorld(true)
    }


    origSceneOpts = {
        matrix: new Matrix4(),
        matrixAutoUpdate: false,
        autoUpdate: false
    }

    _obj = new Camera()
    _v3Lookat = new Vector3()
    _v3Up = new Vector3()

    /**
     *
     * @param {Object3D} scene
     * @param {Camera} camera
     * @param {import('three').RenderTarget} renderTarget
     * @param {boolean} forceClear
     */
    render( scene, camera, renderTarget, forceClear = false, opts  ) {



        this.origSceneOpts.matrix.copy(scene.matrix)
        this.origSceneOpts.matrixAutoUpdate = scene.matrixAutoUpdate
        // @ts-ignore
        this.origSceneOpts.autoUpdate = scene.autoUpdate

        scene.matrixAutoUpdate = false
        scene.matrix.copy(camera.matrix).invert()
        scene.updateMatrixWorld(true)

        // this.origSceneOpts.matrix.copy(scene.matrix)
        // this.origSceneOpts.matrixAutoUpdate = scene.matrixAutoUpdate
        // @ts-ignore
        // this.origSceneOpts.autoUpdate = scene.autoUpdate

        // scene.matrixAutoUpdate = false
        // scene.matrix.copy(camera.matrix).invert()
        // scene.updateMatrixWorld(true)


        this.cubeRenderTarget.clear(renderer, true, true, true)

        if(this.cubeCamera.coordinateSystem !== renderer.coordinateSystem) {

            this.cubeCamera.coordinateSystem = renderer.coordinateSystem

            this.cubeCamera.updateCoordinateSystem()

            this.updateMatrixWorld(true)
        }

        window.renderCube = true

        const prevTarget = renderer.getRenderTarget()

        // px, nx, py, ny, pz, nz
        this.cubeCamera.children.forEach((cubeSideCamera, cubeIndex) => {

            this._updateCameraNearFar(cubeSideCamera, camera)

            // console.log("cubeSideCamera", cubeSideCamera.near, cubeSideCamera.far)

            // enable sorting for instances

            GlobalCamera.updateFrustum(cubeSideCamera)

            Emitter.emit(Events.PRE_RENDER, scene, cubeSideCamera)

            renderer.setRenderTarget(this.cubeRenderTarget, cubeIndex)

            renderer.render(scene, cubeSideCamera)

            renderer.setRenderTarget(prevTarget)

            // @ts-ignore
            scene.autoUpdate = false;
        })

        scene.matrixAutoUpdate = this.origSceneOpts.matrixAutoUpdate
        scene.matrix.copy(this.origSceneOpts.matrix)
        // @ts-ignore
        scene.autoUpdate = this.origSceneOpts.autoUpdate;

        window.renderCube = false

        if(renderTarget) {

            renderTarget.setSize(this.width, this.height)

        } else {

            renderer.setSize(this.width, this.height);
        }

        render(this.cubeToEqurectangularMaterial, renderTarget, forceClear)

    }

    _updateCameraNearFar(cubeSideCamera, refCamera) {


        if((cubeSideCamera.near !== refCamera.near) || (cubeSideCamera.far !== refCamera.far)) {
            cubeSideCamera.near = refCamera.near;
            cubeSideCamera.far = refCamera.far;
            cubeSideCamera.updateProjectionMatrix();
        }
    }
}


/** equirect uv -> world direction (the old cubeToEquirectangular.frag) */
function equirectRayDirection() {

    return ( vUv ) => {

        const thetaphi = vUv.mul( 2.0 ).sub( 1.0 ).mul( vec2( Math.PI, Math.PI * 0.5 ) )

        return vec3(

            thetaphi.y.cos().mul( thetaphi.x.cos() ),

            thetaphi.y.sin(),

            thetaphi.y.cos().mul( thetaphi.x.sin() )
        )
    }
}
