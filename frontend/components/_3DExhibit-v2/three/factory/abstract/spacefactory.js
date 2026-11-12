import Loader from '@3loader'

import SkyFactory from '@3factory/sky'

import BackgroundFactory from '@3factory/background'

import { HalfFloatType, Fog,LinearFilter,EquirectangularReflectionMapping,SRGBColorSpace, LinearEncoding, AnimationMixer, MeshBasicMaterial, Box3, Color, Mesh, Object3D, Texture, Vector3, AmbientLight, MeshStandardMaterial, BufferGeometry} from 'three'

import {

	DEBUG,

	UPLOADER_MODE,

	EDIT_MODE,

	IS_MOBILE

} from '@3constants'

import gui from '@3gui'

import { MODEL_MEDIA, getMediaType } from '@3utils/mediatype'

import FogFactory from '@3factory/fog'

import { cloudinary, resize } from '@utils/urlUtils'
import { yieldTask } from '../../utils/yieldTask'

export default class SpaceFactoryAbstract {

	/**
	 *
	 * @param { any } mesh
	 * @returns { mesh is Mesh<BufferGeometry, MeshStandardMaterial> }
	 */
	isPBR(mesh) {

	    return mesh.material?.type == 'MeshStandardMaterial'
	}

	async setupPBR( scene , opts, backgroundMesh){

		let cubeMap;

		let needsPBR = false

		let modelNeedsPbr = EDIT_MODE || UPLOADER_MODE

		scene.traverse( async (mesh) => {

		    if( this.isPBR(mesh) ){

		        needsPBR = true

		    }
		})

		if(!needsPBR && !modelNeedsPbr) {

		    const artworks = opts.exhibit.artworks || {}

		    for(let id in artworks) {

		        const artwork = artworks[id]

		        if(getMediaType(artwork.data.mime_type) === MODEL_MEDIA && artwork.envmapIntensity) {

		            modelNeedsPbr = true

		            break
		        }
		    }
		}

		if( needsPBR || modelNeedsPbr ) {

		    cubeMap = await this.getPBREnvMap( scene , opts, backgroundMesh )

    		if ( cubeMap && cubeMap.userData ) {

                cubeMap.userData.isShared = true
            }
		}


		scene.traverse( async (mesh) => {

		    if( this.isPBR(mesh) ){

		        mesh.material.envMap = cubeMap

		    }
		})

		return cubeMap
	}

	async getBackgroundDisplay( opts ){

		let background
		
		if( opts.roomParameters.background_type == 'texture' ||  (  opts.roomParameters.background_type == 'image' && opts.roomParameters.backgroundMap.image != null )  ){

			if(  opts.roomParameters.enableSky ) {

				background = await this.loadSky(opts)
			}
			else {

				background = await this.loadCubeImage(opts, opts.roomParameters.backgroundMap )

			}
		}

		else {

			background = new Color(opts.roomParameters?.background || "#000")
		}

		if( background == null ) {

			// No background could be built; callers receive null.
		}

		return background
	}

	async getPBREnvMap( scene, opts, backgroundMesh = null ) {

		let cubeMap;

		// if image type

		if( opts.roomParameters.environnement_type == 'image' ){

		    cubeMap = await this.loadCubeImage(opts, opts.roomParameters.envMap )

		}

		// if scene type

		else {

			let light;

			if( backgroundMesh ) {

		    	scene.add(backgroundMesh)

		    	light = new AmbientLight()

		    	scene.add( light )
			}

		    if( opts.roomParameters.environnement_position != null ) {

		        scene.position.copy( opts.roomParameters.environnement_position )
		    }

	      	scene.updateMatrixWorld(true)

		    // Capturing the environment renders the whole room; give it its own task.
		    await yieldTask()

		    cubeMap = (await Loader.loadCubeMapFromScene( scene, false )).texture

		    scene.position.set( 0, 0, 0 )

		    if( backgroundMesh ) {

		    	scene.remove(backgroundMesh)

				scene.remove(light)
		    }
		}

		return cubeMap
	}

	async loadCubeImage( opts, source ){

		let background;

		// console.log(source)
		// console.log(source.format)
		// console.log(sopts)
		// console.log(sopts)
		// console.log(sopts)

		if( source?.format?.toLowerCase() == '.jpg' || source?.format?.toLowerCase() == '.jpeg' || source?.format?.toLowerCase() == '.png' ){

		    // background = await Loader.loadCubeMapfrom360(roomParameters.envMap.path)

		    var tex = new Texture()

		    var img = new Image()

		    img.crossOrigin = "Anonymous"

		    var url = source.image

		    if( IS_MOBILE ) {

		    	url = resize(source.image, 2048)

		    }

		    var img = await Loader.loadImage([url])
		   
		    tex.colorSpace = SRGBColorSpace;

		    tex.image = img

		    tex.minFilter = LinearFilter

		    tex.needsUpdate = true

		    background = await Loader.loadPMREMEnvironment(source, true, tex)

		    background.sharp = tex

		}

		// if hdr

		else {

		    background = await Loader.loadPMREMEnvironment(source, true)

		}

		return background
	}

	async loadSky( opts ){

		const skyScene = SkyFactory.get( opts.roomParameters.enableSky, opts.roomParameters.skyOptions  )

		skyScene.rotation.order = "ZYX"

		skyScene.rotation.z = Math.PI / 2

		skyScene.rotation.x = Math.PI / 2

	    skyScene.updateMatrixWorld(true)

		const cube = await Loader.loadCubeMapFromScene( skyScene, false )

		cube.sky = true
		cube.texture.userData.worldTravelProceduralSky = true

		SkyFactory.dispose( skyScene )

		return cube.texture
	}


	/** @param { Object3D } scene */
	getFarValue(scene, box = null ) {

		var bbox;

		if( box == null ) {

			bbox = new Box3().setFromObject(scene);
		}

		else {

			bbox = box.clone()
		}
	   

	    const size = new Vector3()

	    bbox.getSize(size)

	    const unit =  Math.max(size.x, size.y, size.z)

	    // returns the length of the body diagonal of the box
	    return Math.ceil(Math.sqrt(3) * unit)
	}

	isSafeSpace( objects ){

	    let isDefault = true

	    let i = 0

	    while( i < objects.length ) {

	        const object = objects[i]

	        if( object != null ) {

	            if  (
	                 object.rotation.x != 0 ||  object.rotation.y != 0 ||  object.rotation.z != 0 ||
	                 object.scale.x    != 1 ||  object.scale.y    != 1 ||  object.scale.z    != 1 ||
	                 object.position.x != 0 ||  object.position.y != 0 ||  object.position.z != 0

	                ) {

	                    isDefault = false
	                }
	        }

	        i++
	    }

	    return isDefault
	}

    getFog( background,  far , opts ){

    	if( background == null ) {

    		// No background: null is passed on to the fog factory below.
    	}

        let fog = null


        // auto fog 
        if( far != null && far > 1400 ) {

        	if( opts.roomParameters.fog == null || opts.roomParameters?.fog?.enabled == false || ( opts.roomParameters?.fog?.enabled == true && opts.roomParameters?.fog.far > 1400 ) ) {

        		opts.roomParameters.fog = {
        		    enabled: true,
        		    near: 800,
        		    far : 1400
        		}

        		opts.roomParameters.near = 0.5

        	}
            

        }

        if( opts.roomParameters?.fog?.enabled == true ) {

            fog = FogFactory.get(background, opts)
        }


        return fog
    }


    addDebug( res ){


    	if( DEBUG && UPLOADER_MODE ){

    	    let i = 0

    	    while( i < res.textures.length ){

    	        const texture     = res.textures[i]

    	        const currentImage =  texture.image

    	        var f =  gui.folders.textures.addImage(currentImage, 'src').name(texture.name).onChange((value) => {

    	            texture.dispose()

    	            texture.image = value

    	            texture.needsUpdate = true
    	        })

    	        i++
    	    }
    	}
    }
}
