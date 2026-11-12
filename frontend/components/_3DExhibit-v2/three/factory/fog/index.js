import Fog from './fog.js'

class FogFactory {


	get( background, opts ){


		return new Fog( background, opts )
	}
}

export default new FogFactory()