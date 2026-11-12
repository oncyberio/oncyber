import System from './system.js'

class AtlasFactory {

	constructor(){

		this.atlas = null
	}

	get( opts ){

		// if( this.atlas == null ) {

		// 	this.atlas = new System()

		// }


		return new System( opts )

	}
}

export default new AtlasFactory()