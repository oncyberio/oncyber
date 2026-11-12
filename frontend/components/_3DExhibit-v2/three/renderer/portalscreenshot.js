// @ts-check

import { CanvasTexture, Color, DataTexture, Object3D, PerspectiveCamera, Scene, SRGBColorSpace, Texture } from 'three'

import { RenderTarget } from 'three/webgpu'

import Renderer from '@3renderer'

import BackgroundFactory from '@3factory/background'

import { Capturer } from '../utils/capturer/Capturer';

import FBOHelper from '@3gl/globals/fbohelper.js'

import { FBO_DEBUG } from "@components/_3DExhibit-v2/three/constants"

import Shared from '@3shared'

import PostProcessing from "./postprocessing"

import { readRenderTargetImage } from '../utils/readpixels'


/** @typedef { { scene: Object3D, background: Color | Texture, camera: PerspectiveCamera, is360?: boolean, custom?: { width: number, height: number } } } ScreenshotOptions */


class ScreenshotRendering {

    constructor() {
        this.capturer = new Capturer({})
    }

    /**
     *
     * @param { ScreenshotOptions } opts
     * @returns
     */
    async takeScreenshot(opts) {


        Shared.isScreenShotRendering.value = 1.0

        const width =  opts.is360 ? 4096 : opts?.custom?.width ? opts?.custom?.width : 1024;
        const height = opts.is360 ? 2048 : opts?.custom?.height ? opts?.custom?.height : 1024;

        let renderTarget = new RenderTarget(width, height, {
            colorSpace: SRGBColorSpace
        })

        const aspect = opts.camera.aspect

        /** @type { Promise<ImageData> } */
        let imgDataPromise

        try {

            opts.camera.aspect =  opts.is360 ? 1 : width / height

            opts.camera.updateProjectionMatrix()

            opts.scene.updateMatrixWorld(true)

            let texture = renderTarget.texture

            // Render and queue the readback synchronously, then restore the shared
            // state before awaiting: screenshots may run concurrently (Promise.all).

            if(opts.is360)  {

                // mainScene.traverse(it => {
                //     if(it.isWaterObject) {
                //         it.userData.visible = it.visible
                //         it.visible = false
                //     }
                // })

                imgDataPromise = this.render360(renderTarget, opts.scene, opts)

                // mainScene.traverse(it => {
                //     if(it.isWaterObject) {
                //         it.visible = it.userData.visible
                //     }
                // })
            }
            else {
                imgDataPromise = this.renderFrame(renderTarget, opts.scene, opts);

            }
        } finally {

            opts.camera.aspect = aspect

            Shared.isScreenShotRendering.value = 0.0
        }

        try {

            const imgData = await imgDataPromise

            let can = document.createElement("canvas")

            can.width = width

            can.height = height


            let ctx = can.getContext("2d")

            ctx.putImageData(imgData, 0, 0)

            let imgDataUrl = can.toDataURL("image/jpeg")

            can = null

            // const img = new Image()

            // img.src = imgDataUrl

            // document.body.appendChild( img )

            return imgDataUrl

        } finally {

            if(!FBO_DEBUG) renderTarget.dispose()
        }
    }

    /**
     * @param { RenderTarget } renderTarget
     * @param { Object3D } scene
     * @param { ScreenshotOptions } opts
     */
    renderFrame(renderTarget, scene, opts) {



        PostProcessing.render(scene, opts.camera, opts.roomParameters, renderTarget)

        if(FBO_DEBUG){

            FBOHelper.attach(renderTarget, "2D screenshot ")

        }

        // Renderer.setRenderTarget(renderTarget)

        // Renderer.render(scene, opts.camera)

        return this.getRenderTargetImage(renderTarget)
    }



    /**
     * @param { RenderTarget } renderTarget
     * @param { Object3D } scene
     * @param { ScreenshotOptions } opts
     */
     render360(renderTarget, scene, opts) {

        this.capturer.camera = opts.camera
        this.capturer.scene = scene

        this.capturer.renderEquiretangular(renderTarget, opts)

        if(FBO_DEBUG) {

            for(let i = 0; i < 6; i++) {

                this.getRenderTargetImage(this.capturer.equirectangular.cubeRenderTarget, i).then((imgData) => {

                    const texture = this.imageDateToTexture(imgData)

                    // const w = window.open("")

                    // w.document.write(img.outerHTML)

                    //const texture = new DataTexture(imgData, imgData.width, imgData.height)

                    FBOHelper.attach(texture, "360 screenshot " + i)
                })
            }
        }


        return this.getRenderTargetImage(renderTarget)
    }


    /**
     *
     * @param { RenderTarget } renderTarget
     * @param { number } [cubeFace]
     * @returns { Promise<ImageData> }
     */
    getRenderTargetImage(renderTarget, cubeFace = 0) {

        // Rows come back top-first on both backends (see utils/readpixels)
        const imgData = readRenderTargetImage(renderTarget, cubeFace)

        Renderer.setRenderTarget(null)

        return imgData
    }

    /**
     *
     * @param { ImageData } imgData
     */
    imageDateToTexture(imgData) {

        let can = document.createElement("canvas")

        can.width = imgData.width

        can.height = imgData.height


        let ctx = can.getContext("2d")

        ctx.putImageData(imgData, 0, 0)

        return new CanvasTexture(can)
    }
}


export default new ScreenshotRendering()
