
// @ts-check

import renderer from "@3renderer"

import { init } from "./helpers/fboHelper"

import { MethodEquirectangular } from "./methods/MethodEquirectangular"



export class Capturer {


    constructor(opts) {

        // this.fileType = opts.fileType || "png"
        // this.imageQuality = opts.imageQuality || 0.8
        this.camera = opts.camera
        this.scene = opts.scene

        init()

        this.equirectangular = new MethodEquirectangular()

    }

    renderEquiretangular(renderTarget, opts ) {


        this.equirectangular.render( this.scene, this.camera, renderTarget, false, opts );
    }
}


