// @ts-check

const defaultOpts = {
    maxConcurrent: 1
}

class CanvasPool {

    /**
     *
     * @param { { maxConcurrent: number } } opts
     */
    constructor(opts) {

        this.opts = opts

        this.pool = [];
        for (let i = 0; i < this.opts.maxConcurrent; i++) {
            this.pool.push(document.createElement("canvas"));
        }

        /** @type { Function[] } */
        this.pendingReqs = []
    }

    /**
     *
     * @param { HTMLCanvasElement } canvas
     */
    releaseCanvas(canvas) {
        if (this.pendingReqs.length > 0) {
            // First in, First out
            const cb = this.pendingReqs.shift();
            cb(canvas);
        } else {
            this.pool.push(canvas);
        }
    }

    async takeCanvas() {
        if (this.pool.length) return this.pool.pop();
        return new Promise((resolve) => {
            if (this.pool.length) resolve(this.pool.pop());
            else {
                this.pendingReqs.push(resolve);
            }
        });
    }

}

export default new CanvasPool(defaultOpts)
