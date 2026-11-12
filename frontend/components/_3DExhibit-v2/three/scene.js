import { Scene as THREESCENE, Fog } from "three"

import {

	DEBUG

} from '@3constants'

class Scene extends THREESCENE {
    constructor() {

        super()

        if(DEBUG){

        	window.scene = this
        }

        window.scene = this
    }


    setState() {
        return Promise.resolve()
    }
}

export default new Scene()
