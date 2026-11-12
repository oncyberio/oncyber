// @ts-check

import loader from "@3loader"

class ImageCache {

    constructor() {

        this.imgCache = {};
    }

    /**
     *
     * @param { string } url
     * @param { AbortSignal } [abort]
     * @returns { Promise<HTMLImageElement> }
     */
    async loadImage(url, abort, forceNoWorker = false ) {

        if (url == null) return null

        const cache = this.imgCache;
        let image = cache[url]

        let isBitmap = false

        if (isBitmap || image == null) {

            try {

                image = await loader.fetchImage( url, abort, forceNoWorker )

                if (cache !== this.imgCache || abort?.aborted) {
                    image?.close?.();
                    return null;
                }
                if(image) {

                    cache[url] = image;
                }
            }
            catch(err) {

                return null
            }
        }

        return image
    }

    evictAll() {
        Object.values(this.imgCache).forEach((image) => image?.close?.());
        this.imgCache = {}
    }

}

export default new ImageCache()
