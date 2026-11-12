// @ts-check

import TextGeometry from '@3/three/factory/font/bmfont'

import FontWrapper from './wrapper'

import MSDFMaterial from '@3/three/factory/font/material'

import {

	GLOBAL_TEXT_SCALE,

} from '@3constants'

import Textures from '@3textures'

import {TextSpaceArtwork} from './textspaceartwork'

import { Mesh, MeshBasicMaterial, BoxGeometry, PlaneGeometry } from 'three'

import { TYPES } from '../../constants'

import { artworkDepth } from '@3utils/spaceutils'

// import {

// 	mergeBufferGeometries

// } from 'utils/buffergeometryutils.js'




let fontCache = new Map()


var DEFAULT_OPTS =  {

	text : "DEFAULT",

	color: [1,1,1],

	align: 'center',

	verticalalign: 'center',

	font : "aeonik-bold",

	scale: 1,

	light: false,

	width: 500,

	// lineHeight: 77,

	screenSized: false,

	// mode: 'pre',

	global_text_scale : GLOBAL_TEXT_SCALE
}


import Manifest from '../../../../manifest.json'



class TextArtwork {

	constructor() {

	}

	async loadFont( name ) {

        if (fontCache.get(name) == null ) {

            await Textures.loadFonts([Manifest.FONTS[name]])

        }


		fontCache.set( 	name, {

			material: new MSDFMaterial({

				map: Textures[name]

			}),

			font: Textures[name].json
		})
	}

    async getFont(opts) {

		var defaultopts = Object.assign({}, DEFAULT_OPTS)

		var options = Object.assign(defaultopts, opts)

		let args = Object.assign({}, options)

		if( fontCache.get(args.font) == null ){

			await this.loadFont( args.font )
		}

		args.font = fontCache.get(args.font).font

		let geo;

        // if( args.multipletext != null ){

		// 	args.text 		= ''

		// 	let geos 		= []

		// 	let i = 0

		// 	while(i < args.multipletext.length ){

		// 		args.text = args.multipletext[i]

		// 		geos[i] = createGeometry(args)

		// 		// console.log(args.multiplepositions[i])

		// 		geos[i].translate(

		// 			args.multiplepositions[i * 3],
		// 			args.multiplepositions[i * 3 + 1],
		// 			args.multiplepositions[i * 3 + 2]
		// 		)

		// 		i++
		// 	}


		// 	geo = mergeBufferGeometries(geos)

		// }
		// else{

		geo = new TextGeometry(args)
		// }

		let font = options.font

		let mat = fontCache.get(font).material

		mat.uniforms = fontCache.get(font).material.uniforms

        const text = this.getTransformedText(opts.text, opts.textTransform)

        return new FontWrapper(geo, mat, text, options);

    }

	async get(opts) {

        const artworkData = opts.item.data

        const fontText = await this.getFont(opts)

        const raycastMesh = new Mesh(
            new PlaneGeometry(1, 1),
            new MeshBasicMaterial({
                color: "#ffff00",
                opacity: 0.3,
                transparent: true,
            })
        );

        const depth = artworkDepth(opts.roomParameters)

        raycastMesh.position.z = depth * 0.50;

        fontText.position.z = depth * 0.50;

		let object = new TextSpaceArtwork({

            // Get bouding box of text geometry
            ...opts,

            raycastMesh,

            resources: [raycastMesh],

            type: TYPES.CYBER_TEXT,

		})

        object.textOpts = opts

        raycastMesh.visible = false

        object.add(fontText);

        object.add(raycastMesh)

        object.font = fontText;

        object.updateRaycastMesh()

        object.userData = {
            ...artworkData,

        }

        object.scale.x = artworkData.scale || 1

        object.scale.y = artworkData.scale || 1

		return object
	}

    /**
     *
     * @param { TextSpaceArtwork } object
     * @param { string } font
     */
    async updateFont(object, font) {
        //
        const newOpts = {
            ...object.userData,
            scale: object.textOpts.scale,
            color: object.userData.textColor,
            font
        }

        const fontText = await this.getFont(newOpts)

        const prevFont = object.font

        object.remove(prevFont)

        prevFont.dispose()

        object.add(fontText);

        object.font = fontText;

        object.item.data.font = font

        object.userData.font = font

        object.updateRaycastMesh()
    }

    /**
     *
     * @param {string} text
     * @param {import('@uitypes/Asset').TextTransform} transform
     */
    getTransformedText(text, transform) {

        if(!text) return text

        if(transform === "uppercase") {

            return text.toUpperCase()
        }

        if(transform === "lowercase") {

            return text.toLowerCase()
        }

        if(transform === "capitalize") {

            return text.replace(/\b\w/g, l => l.toUpperCase())
        }

        if(transform === "togglecase") {

            return text
                    .split('').map(c => c.toUpperCase() == c ? c.toLowerCase() : c.toUpperCase())
                    .join('');
        }

        return text
    }
}

export default new TextArtwork()
