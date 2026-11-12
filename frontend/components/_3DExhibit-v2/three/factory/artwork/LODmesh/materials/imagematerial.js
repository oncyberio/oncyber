// @ts-check

import { LinearFilter, LinearMipmapLinearFilter, MeshLambertMaterial, SRGBColorSpace, Texture } from "three";


export class ImageMaterial extends MeshLambertMaterial {

    constructor(opts) {

        super(opts.materialParams)

        this.image = opts.image

        const texture = new Texture(opts.image)

        // ImageUtils.getMemSize(texture.sourceFile, texture.internalFormat);

        texture.colorSpace = SRGBColorSpace
        texture.minFilter = LinearMipmapLinearFilter
        texture.magFilter = LinearFilter
        texture.generateMipmaps = true;
        texture.needsUpdate = true
        // texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();

        this.map = texture
        this.needsUpdate = true
    }

    /** @return { { width: number, height: number } } */
    get dimensions() {

        return {
            width: this.image.naturalWidth || this.image.width,
            height: this.image.naturalHeight || this.image.height,
        }
    }

    /** @return boolean */
    get active() {

        return this._active
    }

    /**
     * @param { boolean } val
     */
    set active(val) {

        this._active = val
    }
}
