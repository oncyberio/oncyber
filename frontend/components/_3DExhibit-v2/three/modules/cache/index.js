import Cache from '../../modules/cinematic/composer/cache'
import { SCENE_RENDER_ORDER } from '../../utils/sceneRenderOrder'

import Scene from '@3scene'

import gsap from 'gsap'

class CacheModule extends Cache {

	constructor(){

		super()

		this.alpha = 0

		this.renderOrder = SCENE_RENDER_ORDER.fade
	}

	setState(){

	}

	show( alpha = 1 , duration = 1){

		return new Promise((resolve)=>{

			if(this.tween ) {

				this.tween.kill()

				this.tween = null
			}

		   Scene.add( this )

		   this.tween = gsap.to(this, {

				alpha: alpha,

				duration: duration,

				onComplete:()=>{

					resolve()
				
				}
			})
		})

	}


	hide( alpha = 0 , duration = 0){

		return new Promise((resolve)=>{

			if(this.tween ) {

				this.tween.kill()

				this.tween = null
			}

		   this.tween = gsap.to(this, {

				alpha: alpha,

				duration: duration,

				onComplete:()=>{

					Scene.remove( this )

					resolve()
				}
			})
		})
	}
}


export default new CacheModule()
