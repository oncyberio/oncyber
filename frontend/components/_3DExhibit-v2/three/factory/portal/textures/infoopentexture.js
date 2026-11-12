// @ts-check

import { LinearFilter, SRGBColorSpace, Texture } from "three"

import imageCache from "@3utils/imagecache"

import { destinationInfo } from "./utils"
import { cloudinary } from "@utils/urlUtils";


export class InfoOpenTexture {

    /**
     * @param { import("@uitypes/experience").Experience } exhibit
     * @param { import("@uitypes/user").User } user
     * @param { number } width
     * @param { number } height
     * @param { boolean } canEnterSpace
     * @param { AbortSignal } abort
     * @returns  { Promise<Texture> }
     */
    async get(
        exhibit,
        user,
        width,
        height,
        canEnterSpace = true,
        abort = null
    ) {

        const avatarUrl = user?.avatar ? cloudinary.lod(user.avatar) : null;

        const avatarImg = avatarUrl ? await imageCache.loadImage(avatarUrl, abort, true) : null;

        const canvas = document.createElement("canvas");

        const ctx = canvas.getContext("2d");
        ctx.canvas.width = width;
        ctx.canvas.height = height;

        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

        if (!canEnterSpace) {
            ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
            ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        }

        destinationInfo(exhibit, user, avatarImg, ctx, 2);

        const texture = new Texture(canvas);
        texture.minFilter = LinearFilter;
        texture.magFilter = LinearFilter;
        texture.generateMipmaps = true;
        texture.needsUpdate = true;

        texture.colorSpace = SRGBColorSpace;

        return texture;

    }
}


export default new InfoOpenTexture()
