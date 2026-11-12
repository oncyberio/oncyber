// @ts-check

import { Mesh, PlaneGeometry, MeshBasicMaterial, Material } from "three"

import { LoaderState } from "@utils/js"

import { disposeObject3D } from "@3utils/three"



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

/**
 * @extends { Mesh<PlaneGeometry, Material> }
 */
export class SpaceArtworkLoaderMesh extends Mesh {

    /**
     * @param { { geometry: PlaneGeometry, material: Material,  maxTentatives: number, item: any } } opts
     */
    constructor(opts, json, loop = true, scale = 1) {

        super(opts.geometry, opts.material)

        this.item = opts.item

        this.loader = new LoaderState(opts.maxTentatives)

        this.name = name;
        this.loop = loop;
        this.data = json;
        this.currentCount = 0
        this._scale = scale;
        this.uvOffset = {};
        this.uvMultiply = {};
        this.maxW = this.data.meta.size.w;
        this.maxH = this.data.meta.size.h;
        this.ratio =
            this.data.frames[0].sourceSize.w / this.data.frames[0].sourceSize.h;

        this.maxFrames = this.data.frames.length
        // this.scale.set(this.ratio * this._scale, -1.0 * this._scale, 1.0);
        // this.renderOrder = 1000;
        this._isPlaying = false;

        this.play()
    }

    update() {

        if (Date.now() - this.now > INV_SPRITE_FPS) {
            this.currentCount++;

            if (
                this.currentCount > this.maxFrames - 1 &&
                this.loop == false
            ) {
                return;
            }

            let frame =this.currentCount % this.maxFrames


            this.updateFrame( frame )


            this.now = Date.now();
        }
    }

    progression( val = 0 ){

        let frame = Math.floor( val * this.maxFrames )

        this.updateFrame( frame )

    }

    updateFrame(val = 0){

        const id = val % this.maxFrames;

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

            this.currentCount = Math.floor(Math.random() * (this.maxFrames - 1) );
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

    dispose() {


        this.pause()

        this.geometry.dispose()

        this.material.dispose()

        // disposeObject3D(this)
    }
}
