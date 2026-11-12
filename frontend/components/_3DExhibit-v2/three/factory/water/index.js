
import * as THREE from 'three'

import Wrapper from './wrapper'


class WaterFactory {

	get( opts = {}){

		const water = new Wrapper()

	    water.rotation.x = -Math.PI / 2;	

	    if( opts.roomParameters && opts.roomParameters.waterOptions ){

	    	water.position.copy( opts.roomParameters?.waterOptions?.position )

	    	water.scale.x = opts.roomParameters?.waterOptions.scale.x

	    	water.scale.y = opts.roomParameters?.waterOptions.scale.z

	    	water.color  =  opts.roomParameters?.waterOptions.color

	    	water.opacity = opts.roomParameters?.waterOptions.opacity
	    }

	    return water
	}
}

export default new WaterFactory()