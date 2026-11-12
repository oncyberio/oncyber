// @ts-check

import { PlaneGeometry, Texture, TextureLoader } from "three";

import Loader from '@3loader'

import Material from "./material";

import Wrapper from "./wrapper";

import TYPES from './constants.js'

const default_options = {

    scale: 0.4,
    loop: true
}

class SpriteBuilder {

    constructor() {

        this.TYPES = TYPES

        this.geometry = new PlaneGeometry(1, 1, 1, 1)

        this.geometry.deleteAttribute("normal")

        this.texture = null

        this.sprites = new Map()

        // this.preload()
    }

    async preload(type = null) {

        try {

            type.texture = await Loader.loadImageTexture(type.image);
            // TODO: REFACTOR TO SUPPORT ALL SPRITES EASILY
        } catch (err) {
            console.error("Failed to load " + type.image);
        }
    }
    
    async get( type = null, opts = {} ) {


        if( type == null ){

            console.log('no type')
        }

        var sprite

        if( this.sprites.get( type.image ) == null ) {

            await this.preload(type)

            const options = Object.assign( default_options, opts )

            options.name = type

            sprite = new Wrapper(
                options.name,
                this.geometry,
                new Material(type.texture),
                type.json,
                opts.scale,
                opts.loop
            );

            this.sprites.set( type.image )
        }
        else {

            sprite = this.sprites.get( type.image )
        }

        return sprite
    }
}

export default new SpriteBuilder();
