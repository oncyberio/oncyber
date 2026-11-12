import {

	DEBUG,

	SET_FONT_DISTANCE_RANGE_FIELD

} from '@3constants'

import Loader from '@3loader'

import { Texture } from 'three'

class Textures {

	constructor(){

	}

    get_url_extension( url ) {

		const cs = url.split('.')
		
		let ext = cs.pop()

		if(ext === "undefined") {
			ext = cs.pop()
		}

		return ext
	}

	loadTextures( object ){

	    return new Promise((resolve, reject)=>{

	        var ps = []

            let i = 0

            while(i < object.length ){
                
                let current = object[i]

                const url = [current.url]

               const ext = this.get_url_extension(url[0]).toLowerCase()

               const isJPGPNG = ext == 'jpg' || ext == 'png'  || ext == 'jpeg'

               if( this[current.name] == null && isJPGPNG == true ) {

                	ps.push(
                        Loader.loadAlts(
                            Loader.loadImageTexture.bind(Loader),
                            url

                        ).then((tex)=>{


                		    this.set(current.name, tex)
                            
                	    }).catch(err => {

                            console.error(err)

                            this.set(current.name, new Texture())
                        })
                    )
                }

                i++
            }

            Promise.all(ps).then(()=>{

            	resolve()
            })

	    })
	}

    async loadTexture(object){

        return new Promise((resolve, reject)=>{

            Loader.loadImageTexture(object.url).then((tex)=>{

                this.set(object.name, tex)

                resolve()
            })
        })
    }

	async loadFonts(object ){

	    return new Promise((resolve, reject)=>{

	        var ps = []

            let i = 0

            while(i < object.length ){

                let current = object[i]

                if( this[current.name] == null ) {

                	ps.push(new Promise( async (res)=>{

                		const tex = await  Loader.loadImageTexture(current.tex )

                		const json = await Loader.loadJson(current.json)

                		SET_FONT_DISTANCE_RANGE_FIELD(json.distanceField.distanceRange )

                		tex.json = json

                		this.set(current.name, tex)

                		res()

                	}))
                }

                i++
            }

            Promise.all(ps).then(()=>{

            	resolve()

            })
	    })
	}

	set( name, value ){

		if( this[name] == null ) {

			this[name] = value
		}
		else {

			console.warn('texture already set')
		}
	}
}

export default new Textures()
