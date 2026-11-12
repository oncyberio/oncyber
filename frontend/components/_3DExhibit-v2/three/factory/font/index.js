import TextGeometry from './bmfont/'

import FontWrapper from './wrapper.js'

import MSDFMaterial from './material.js'

import {

	GLOBAL_TEXT_SCALE,

} from '@3constants'

import Textures from '@3textures'

let datas = new Map()


// import { BufferGeometryUtils } from "three/examples/jsm/utils/BufferGeometryUtils";

import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js'

import MultiTextWrapper from './multitextwrapper.js'



var DEFAULT_OPTS =  {
	
	text : "DEFAULT",

	color: [1,1,1],

	align: 'center',

	verticalalign: 'center',

	font : "aeonik-bold",

	scale: 1,

	light: false,

	// lineHeight: 77,

	screenSized: false,

	global_text_scale : GLOBAL_TEXT_SCALE

	// mode: 'pre',
}

const LIGHT_SUFFIX = '_LIGHT'


class FontMeshFactory { 

	constructor() {
 
	}

	loadFont( name ) {

		datas.set( 	name, {

			material: new MSDFMaterial({
		
				map: Textures[name]
		
			}),

			font: Textures[name].json
		})
	}

	create(opt) {

		var defaultopts = Object.assign({}, DEFAULT_OPTS)

		var options = Object.assign(defaultopts, opt)

		let args = Object.assign({}, options)

		if( datas.get(args.font) == null ){

			this.loadFont( args.font )
		}

		args.font = datas.get(args.font).font

		let font = options.font
		
		let mat = datas.get(font).material

		mat.uniforms = datas.get(font).material.uniforms

		let geo;

		if( args.multipleTexts != null ){

			return new MultiTextWrapper( mat, args )

		}
		else{

			geo = new TextGeometry(args)
		}

		let object = new FontWrapper(
			
			geo,

			mat,

			args.text, 

			options
		)

		return object
	}

	createMultiText( opts ){

		var options = Object.assign({}, opts)

		let args = Object.assign({}, options)

		if( datas.get(args.font) == null ){

			this.loadFont( args.font )
		}

		args.font = datas.get(args.font).font

		let font = options.font
		
		let mat = datas.get(font).material

		mat.uniforms = datas.get(font).material.uniforms

		return new MultiTextWrapper( mat, args )
	}
}

export default new FontMeshFactory()