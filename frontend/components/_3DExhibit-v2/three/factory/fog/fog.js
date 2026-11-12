import {

	Fog as THREEFog

}  from 'three'

/**
 * Range fog. With a texture background, `fogTexture` holds the room's PMREM and
 * the fog colour becomes the background seen along the view ray (see tsl/fog.js).
 */
export default class Fog extends THREEFog {

	constructor(background, opts){

		if( background.isColor ) {

			super(  background.getHex(), opts.roomParameters?.fog.near, opts.roomParameters?.fog.far )

			this.fogTexture = null
		}
		else {

			super( 0xffffff,  opts.roomParameters?.fog.near , opts.roomParameters?.fog.far )

			this.fogTexture = background
		}
	}
}
