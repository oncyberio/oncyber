import {

    CanvasTexture,

    Texture,

    Vector2,

    LinearFilter,

    LinearMipmapLinearFilter

} from 'three'

import {

    DEBUG,

    FBO_DEBUG,


} from '@3constants'

import {

    TEXTURE_SIZE,


} from './constants.js'


import FBOHelper from '@3gl/globals/fbohelper.js'

import Renderer from '@3renderer'

const emptyCanvas    = document.createElement('canvas')

const ctx = emptyCanvas.getContext("2d")

ctx.fillStyle = "black"

const position = new Vector2()

// Blits an image into the atlas on the GPU. WebGPU copies texture to texture,
// so the patch becomes a short-lived Texture first.
function blit( image, target, x, y ) {

    const patch = new Texture( image )

    patch.colorSpace = target.colorSpace

    patch.flipY = target.flipY

    patch.generateMipmaps = false

    patch.needsUpdate = true

    Renderer.copyTextureToTexture( patch, target, null, position.set( x, y ) )

    patch.dispose()
}

export default class UpdatableTexture extends CanvasTexture {

    constructor( format  ){

        const canvas    = document.createElement('canvas');
        canvas.width = TEXTURE_SIZE;
        canvas.height = TEXTURE_SIZE;

        const ctx = canvas.getContext("2d")
        ctx.canvas.width = TEXTURE_SIZE
        ctx.canvas.height = TEXTURE_SIZE
        ctx.clearRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);


        super( canvas )

        this.canvas = canvas 

        // this.ctx = ctx

        this.minFilter = LinearMipmapLinearFilter
        this.magFilter = LinearFilter

        this.needsUpdate = true

        if( FBO_DEBUG ) {

           // FBOHelper.attach(this, 'yolo'+Math.random())
        }

    }


    update(src, x, y) {

        if(x + src.width > this.width || y + src.height > this.height){
            console.log(src)
            console.log('bad dimensions')

            return
        }

        blit( src, this, x, y )
    
    }

    erase(src, x, y){

        emptyCanvas.width  = src.width
        emptyCanvas.height = src.height

        ctx.fillRect(0, 0, emptyCanvas.width, emptyCanvas.height);

        if(x + src.width > this.width || y + src.height > this.height){
            console.log(src)
            console.log('bad dimensions')

            return
        }

        blit( emptyCanvas, this, x, y )
        
    }
}

