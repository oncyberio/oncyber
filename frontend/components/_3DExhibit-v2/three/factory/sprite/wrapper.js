import { Mesh, Vector2, Vector3 } from "three";

const SPRITE_FPS = 24;

// 1 second = 60 fps

// 1 / 60

const INV_SPRITE_FPS = (1 / SPRITE_FPS) * 1000;


var _scale;
var uvOffset;
var uvMultiply;
var maxW;
var maxH;
var ratio;
var renderOrder;
var _isPlaying;

var currentCount = 0;
var uvsOffset;
var now;

import Emitter from '@3emitter'

import Events from '@3events'

export default class SpriteWrapper extends Mesh {

    constructor(
        name,
        geometry,
        material,
        json,
        scale = 1,
        loop = true
    ) {
        super(geometry, material);

        this.name = name;
        this.loop = loop;
        this.data = json;
        this.currentCount = 0;
        this._scale = scale;
        this.uvOffset = {};
        this.uvMultiply = {};
        this.maxW = this.data.meta.size.w;
        this.maxH = this.data.meta.size.h;
        this.ratio =
            this.data.frames[0].sourceSize.w / this.data.frames[0].sourceSize.h;

        this.scale.set(this.ratio * this._scale, -1.0 * this._scale, 1.0);
        // this.renderOrder = 1000;
        this._isPlaying = false;
    }

    update() {
        if (Date.now() - this.now > INV_SPRITE_FPS) {
            this.currentCount++;

            if (
                this.currentCount > this.data.frames.length - 1 &&
                this.loop == false
            ) {
                return;
            }

            let frame =this.currentCount % this.data.frames.length
               

            this.updateFrame( frame )


            this.now = Date.now();
        }
    }

    progression( val = 0 ){

        let frame = Math.floor( val * this.data.frames.length )

        this.updateFrame( frame )

    }

    updateFrame(val = 0){

        const id = val % this.data.frames.length;

        const frame =  this.data.frames[id].frame;

        this.uvsOffset = { x: frame.x / this.maxW, y: frame.y / this.maxH };

        this.uvMultiply = {
            x: frame.w / this.maxW,
            y: frame.h / this.maxH,
        };

        this.material.uniforms.uvs.value.set(
            this.uvsOffset.x,
            this.uvsOffset.y,
            this.uvMultiply.x,
            this.uvMultiply.y
        );
    }

    addEvents(){

        if( this.updateEvent == null ){

            this.updateEvent = this.update.bind(this)

            Emitter.on(Events.PRE_UPDATE, this.updateEvent)
        }
    }

    removeEvents(){

        if( this.updateEvent ){

            Emitter.off(Events.PRE_UPDATE, this.updateEvent)

            this.updateEvent = null
        }
    }

    play() {
        if (this._isPlaying == false) {

            this.currentCount = 0;
            this.now = Date.now();
            this._isPlaying = true;
            this.addEvents()
        }
    }

    pause() {
        if (this._isPlaying == true) {
            this._isPlaying = false
            this.removeEvents()
        }
    }
}
