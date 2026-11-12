// @ts-check

import {
    CanvasTexture,
    DataTexture,
    LinearFilter,
    MeshBasicMaterial,
    RGBAFormat,
    SRGBColorSpace,
    Texture,
    TextureLoader,
} from "three";


import { drawIcon, scaleToFill, wrapWord } from "@3gl/utils/draw";

import imageCache from "@3/three/utils/imagecache";

import canvasPool from "@3/three/utils/canvaspool";
import { destinationInfo } from "./utils";
import { cloudinary } from "@utils/urlUtils";

export class InforPreviewTexture {

    /**
     * @param { import("@uitypes/experience").Experience } exhibit
     * @param { import("@uitypes/user").User } user
     * @param { number } aspect
     * @param { boolean } onlyInfo
     * @param { AbortSignal } abort
     * @returns  { Promise<Texture> }
     */
    async get(
        exhibit,
        user,
        aspect,
        onlyInfo,
        abort
    ) {

        const { editors, info, number_of_visits, owner } = exhibit

        const { curator, room, headline, heroImg, cHeroImg } = info

        /** @type { HTMLCanvasElement } */
        let canvas;


        try {

            const avatarUrl = user?.avatar && cloudinary.isCloudinaryUrl(user.avatar) ? cloudinary.lod(user.avatar) : null;

            let image = onlyInfo
                            ? null :
                            await imageCache.loadImage(cHeroImg || "/images/thumbnail.png", abort);

            let avatarImg;

            if (avatarUrl) {

                avatarImg = await imageCache.loadImage(avatarUrl, abort, true);

            } else {

                avatarImg = null
            }

            const _canvas = await canvasPool.takeCanvas()

            if(abort?.aborted) return null

            // const [image, avatarImg, _canvas] = await Promise.all([
            //     imageCache.loadImage(cHeroImg || "/images/thumbnail.png"),
            //     user?.avatar ?  imageCache.loadImage(user.avatar) : null,
            //     canvasPool.takeCanvas(),
            // ])

            // console.log("Take canvas", exhibit.info.headline)

            canvas = _canvas

            let ctx = canvas.getContext("2d")

            const res = 2

            const imageWidth = 1024

            //image?.naturalWidth || 256

            let cw = Math.floor(imageWidth * aspect)

            let ch = 1024

            // || 512

            ctx.canvas.width = cw

            ctx.canvas.height = ch

            if(onlyInfo) {

                ctx.fillStyle = "transparent"

            }
            else {

                ctx.fillStyle = "black"

            }

            ctx.fillRect(0, 0, cw, ch)

            if (image) {

                const diffW = imageWidth - cw

                ctx.drawImage(image, diffW / 2, 0, cw, ch, 0, 0, cw, ch)
            }

            if(!onlyInfo) {

                var grd = ctx.createLinearGradient(0, ctx.canvas.height, 0, 0)

                grd.addColorStop(0, "#000000")

                grd.addColorStop(0.5, "transparent")

                grd.addColorStop(1, "transparent")

                // Fill with gradient
                ctx.fillStyle = grd

                ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)
            }

            destinationInfo(exhibit, user, avatarImg, ctx, res);

            const imgData = ctx
                .getImageData(0, 0, ctx.canvas.width, ctx.canvas.height)
                .data.buffer.slice(0)

            const texture = new DataTexture(
                new Uint8Array(imgData),
                ctx.canvas.width,
                ctx.canvas.height,
                RGBAFormat
            )

            texture.flipY = true

            texture.minFilter = LinearFilter

            texture.magFilter = LinearFilter

            texture.needsUpdate = true

            texture.colorSpace = SRGBColorSpace

            return texture
        }
        catch(err) {
            // debugger
            console.error(err)
        }
        finally {
            // console.log("release canvas", exhibit.info.headline)
            canvasPool.releaseCanvas(canvas)
        }
    }
}


export default new InforPreviewTexture()
