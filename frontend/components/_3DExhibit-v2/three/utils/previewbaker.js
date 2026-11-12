import { 

	Object3D,

	BoxGeometry,

 	MeshBasicMaterial,

	Mesh,

	PerspectiveCamera,

	Scene,

	Vector3,

	Quaternion,

	Matrix4,

	Sphere,

	Color,

	AmbientLight,

	SRGBColorSpace,

	Box3,

	DirectionalLight,

	AnimationMixer,

} from 'three'

import {

	MeshBasicNodeMaterial,

	RenderTarget

} from 'three/webgpu'

import {

	mix,

	positionGeometry,

	vec3,

	vec4

} from 'three/tsl'

import { readRenderTargetImage } from './readpixels'

import {

	FBO_DEBUG

} from '@3constants'

import Renderer from '@3renderer'

const WIDTH = 512

const HEIGHT = 512

const tempMat4 = new Matrix4()

const box = new Box3()

const sphere = new Sphere()


const boundingBox = new Box3();

const zero = new Vector3(0,0,0)

var middle = new Vector3();

var size = new Vector3();

var headPosition = new Vector3()

import loadMixamoAnimation from '@3factory/player/instanceavatarvrm/baker/loadmixamoanimation'

// The clips are their own download (compute2.bin, see animationData.js):
// fetched on the first thumbnail, not with the world's code (this module is
// part of it through kitbuilder/instance).
import { loadBakerAnimations } from '../factory/player/instanceavatarvrm/baker/animationData.js'

import { OrbitControls } from '../camera/controls/orbitcontrols'

import PostProcessing from "../renderer/postprocessing"

import Mix from '@3utils/math/mix'

import gsap from 'gsap'

import Triangle from "@3gl/globals/triangle"

/**
 * Kit thumbnails' backdrop: a vertical grey gradient on a full-screen triangle,
 * written unconverted into the (linear) bake target like the GLSL was.
 */
function createGradientMaterial() {

	const material = new MeshBasicNodeMaterial({

		transparent: false,

		depthTest: false,

		depthWrite: false,

		side: 0
	})

	const vUv = positionGeometry.xy.mul( 0.5 ).add( 0.5 ).toVarying( 'vUv' )

	material.vertexNode = vec4( positionGeometry, 1.0 )

	material.colorNode = vec4( mix( vec3( 0.29, 0.29, 0.29 ), vec3( 0.137, 0.133, 0.133 ), vUv.y ), 1.0 )

	material.fog = false

	return material
}

import FBOHelper from '@3gl/globals/fbohelper.js'



export default class PreviewBaker extends Object3D {

	constructor(){

		super()

		this.oldClearColor = new Color()

		this.bgColor = new Color(0x638597)

		//const rdm =

		this.camera = new PerspectiveCamera(40, 1 , 0.1, 2000)

		// `encoding` was never a render target option, so this target has always
		// been linear; kept that way so thumbnails look the same.
		this.target = new RenderTarget(WIDTH, HEIGHT, {samples : 4 })


		this.scene = new Scene()

		const ambientLight = new AmbientLight( 0xffffff, 1 )

		this.scene.add( ambientLight )

		const lightDirectional = new DirectionalLight( 0xffffff, 1 )

		lightDirectional.target.position.set(-1,-1,-1)

		this.scene.add( lightDirectional )

		this.backgroundGradient = new Mesh( Triangle , createGradientMaterial() )

		this.backgroundGradient.frustumCulled = false

		this.backgroundGradient.renderOrder = -9999999999

		// this.addRandomGeometry()

		// this.render( rdm )

		// this.add(rdm[0])
	}

	async render( objects, decoration = null, opts = {}  ) {

		// Avatars pose with the idle clip; nothing else needs the clips.
		const Animations = objects.length ? await loadBakerAnimations() : []

		const oldTrgt = Renderer.getRenderTarget()

		let imgs = []

		if( decoration != null ){

			this.previousDecorationParent = decoration.parent

			this.scene.add(decoration)
		}

		if( this.canvas == null ) {

			this.canvas = document.createElement("canvas")

			this.canvas.width = WIDTH

			this.canvas.height = HEIGHT

			this.canvasCtx = this.canvas.getContext("2d")
		}

		this.orbit = new  OrbitControls(this.camera, this.canvas)

		this.orbit.enabled = false

		let i = 0

		let names = []

		let IDLEANIMATION = Animations.filter(item => item.name === "idle")[0]

		i = 0


		while( i < objects.length ) {

			const object = objects[i]

			const version  = object.userData.vrm.meta.metaVersion.split('.')[0]

			const rotation =  version != '0' ? 0 : Math.PI

			// object.scene.rotation.y += rotation

			var idleAnim = loadMixamoAnimation( object.scene, object.userData.vrm, IDLEANIMATION )

			var currentMixer = new AnimationMixer(  object.userData.vrm.scene )

			var clip = currentMixer.clipAction( idleAnim )

			clip.play()

			currentMixer.update(1)

			object.userData.vrm.update(1)

			object.userData.vrm.scene.position.copy(object.userData.vrm.scene.position)

			object.userData.vrm.scene.updateWorldMatrix(true, true)

			this.orbit.enabled = true

			imgs.push( await this.renderImage( object, this.camera, opts ) )

			this.orbit.enabled = false

			clip.stop()

			currentMixer.update(0)

			object.userData.vrm.update(0)

			// object.scene.rotation.y -= rotation

			object.userData.vrm.scene.updateWorldMatrix(false, true)

			object.userData.vrm.scene.position.copy( object.userData.vrm.scene.position )

			clip = null

			currentMixer = null

			i++
		}

		if( decoration != null && this.previousDecorationParent != null){

			this.previousDecorationParent.add(decoration)
		}

		// if(this.orbit == null ) {

		// }


		// var img = new Image()

		// img.src = dataURL

		// document.body.appendChild(img)

		// img.style.position = 'absolute'

		// img.style.zIndex = 100000

		// console.log( 'destroy orbit..')

		this.orbit.enabled = false

		this.orbit.dispose()

		this.orbit = null

		Renderer.setRenderTarget( oldTrgt )


		return imgs
	}

	async renderImage( input, camera, opts = {} ){


		const oldTrgt = Renderer.getRenderTarget()

		const object = input.scene ? input.scene : input

		let oldCLe

		Renderer.getClearColor( this.oldClearColor )

		Renderer.setClearColor(this.bgColor)

		const oldP = object.parent

		this.scene.add( object )

		boundingBox.setFromObject( object );

		boundingBox.getSize(size);

		object.updateMatrix()
		object.updateWorldMatrix()


		boundingBox.setFromObject( object )
		boundingBox.getSize(size);

		const fov = (camera.fov - 20) * ( Math.PI / 180 );
	    const fovh = 2*Math.atan(Math.tan(fov/2) * camera.aspect);
	    let dx = size.z / 2 + Math.abs( size.x / 2 / Math.tan( fovh / 2 ) );
	    let dy = size.z / 2 + Math.abs( size.y / 2 / Math.tan( fov / 2 ) );
	    let cameraZ = Math.max(dx, dy);

		if( input?.userData?.vrm ) {

			input?.userData.vrmHumanoid?.getNormalizedBoneNode( 'head' ).getWorldPosition( headPosition )

			headPosition.y = Mix(headPosition.y, boundingBox.max.y, 0.35 )
		}


		camera.position.set( headPosition.x, headPosition.y, -(headPosition.z + boundingBox.max.z + 0.5) )

		this.orbit.target.set( headPosition.x, headPosition.y, headPosition.z )

		this.orbit.update()

		await this.renderOnTarget( this.scene, camera )

		await new Promise((res)=>{

			gsap.delayedCall(0.01, ()=>{

				res()
			})
		})

		await this.renderOnTarget( this.scene, camera )

		const imgData = await this.getRenderTargetImage( this.target )

		this.canvasCtx.putImageData(imgData, 0, 0)

		const dataURL = this.canvas.toDataURL("image/jpeg")

		this.scene.remove( object )

		if( oldP != null ) {

			oldP.add( object )

		}
		Renderer.setClearColor(this.oldClearColor)



		return { image: dataURL }




	}

	async renderOnTarget( scene, camera ){


		const oldTrgt = Renderer.getRenderTarget()

		await Renderer.compileAsync( scene, camera )

		scene.traverse(( child )=>{

			if( child.material && child.material.metalness ) {

				child.material.oldMetalness = child.material.metalness

				child.material.metalness = 0
			}

			child.frustumCulled = false 

		})

		// debugger

		Renderer.setRenderTarget( this.target )

		Renderer.clear()

		console.log(this.scene)

		Renderer.render(this.scene, camera)

		Renderer.setRenderTarget( oldTrgt )


		if( FBO_DEBUG ) {

			FBOHelper.attach(this.target, 'baker target' + Math.random())
		}


		scene.traverse(( child )=>{

			if( child.material && child.material.metalness ) {

				child.material.metalness = child.material.oldMetalness
			}

		})

	}


	async renderKitImages( objects,  opts = {}  ) {


		let imgs = {}

		this.orbit = new  OrbitControls(this.camera, document.body)

		this.orbit.enabled = false


		this.canvas = document.createElement("canvas")

		this.canvas.width = WIDTH

		this.canvas.height = HEIGHT

		this.canvasCtx = this.canvas.getContext("2d")

		let i = 0

		let names = []

		while( i < objects.length ) {

			names.push( { name: objects[i].name, object: objects[i] } )

			i++
		}

		i = 0

		while( i < names.length ) {

			this.orbit.enabled = true

			const img = await this.renderKitImage( names[i].object, this.camera, opts )

			this.orbit.enabled = false

			names[i].img = img

			imgs[names[i].name] = img

			i++
		}

		return imgs 
	}

	async renderKitImage( object, camera, opts = {} ){

		return new Promise((resolve, reject)=>{

			const oldTrgt = Renderer.getRenderTarget()


			object.traverse((child)=>{

				if(child.name.includes('collision') ) {

					child.previousVisibility = child.visible

					child.visible = false
				}

				child.position.set(0,0,0)
				child.rotation.set(0,0,0)
				child.scale.set(1,1,1)

				child.updateMatrix()
				child.updateWorldMatrix()
			})

			const oldP = object.parent

			object.position.set(0, 0, 0)

			object.rotation.set(0, 0, 0)

			this.scene.add( object )

			boundingBox.setFromObject( object );

			boundingBox.getSize(size);

			if( size.z > size.x * 1.5 ) {

				object.rotation.y = Math.PI * 0.5
			}

			object.position.set( (boundingBox.min.x + boundingBox.max.x ) * 0.5, -boundingBox.min.y + 0.01, (boundingBox.min.z + boundingBox.max.z ) * 0.5)

			object.updateMatrix()
			object.updateWorldMatrix()


			boundingBox.setFromObject( object )
			boundingBox.getSize(size);

			const fov = (camera.fov - 20) * ( Math.PI / 180 );
		    const fovh = 2*Math.atan(Math.tan(fov/2) * camera.aspect);
		    let dx = size.z / 2 + Math.abs( size.x / 2 / Math.tan( fovh / 2 ) );
		    let dy = size.z / 2 + Math.abs( size.y / 2 / Math.tan( fov / 2 ) );
		    let cameraZ = Math.max(dx, dy);

			   // set the far plane of the camera so that it easily encompasses the whole object
			const minZ = boundingBox.min.z;
			const cameraToFarEdge = ( minZ < 0 ) ? -minZ + cameraZ : cameraZ - minZ;

			// camera.position.copy()
			
			camera.position.set( object.position.x, (boundingBox.min.y + boundingBox.max.y) * 0.5 , object.position.z + cameraZ )

			this.camera.near = 1
			this.camera.far = camera.position.z + Math.max(size.x, size.y, size.z)  * 2

			this.camera.updateProjectionMatrix()


			this.orbit.target.set((boundingBox.min.x + boundingBox.max.x) * 0.5,(boundingBox.min.y + boundingBox.max.y) * 0.5, (boundingBox.min.z + boundingBox.max.z) * 0.5)

			this.orbit.rotateUp(    Math.PI * 0.25)
			this.orbit.rotateLeft(  -Math.PI * 0.25)

			this.orbit.update()

			this.scene.add(this.backgroundGradient)

			Renderer.setRenderTarget( this.target ) 

			Renderer.clear()

			if ( opts.usePostProcessing?.enabled ) {

				const oldPostproSize = {

					w: PostProcessing.width,

					h: PostProcessing.height
				}

				PostProcessing.resize( WIDTH, HEIGHT, 1.0 )

				PostProcessing.render( this.scene, camera, opts,  this.target )

				PostProcessing.resize( oldPostproSize.w, oldPostproSize.h )
			}

			else {

				Renderer.render(this.scene, camera)
			}

			this.scene.remove(this.backgroundGradient)

			const imgDataPromise = this.getRenderTargetImage( this.target )

			this.scene.remove( object )

			oldP.add( object )

			Renderer.setRenderTarget( oldTrgt )
		
			// var img = new Image()

			// img.src = dataURL

			// document.body.appendChild(img)

			// img.style.position = 'absolute'

			// img.style.zIndex = 100000

			object.traverse((child)=>{

				if(child.name.includes('collision') ) {

					child.visible = child.previousVisibility
				}
			})

			imgDataPromise.then(( imgData )=>{

				this.canvasCtx.putImageData(imgData, 0, 0)

				const dataURL = this.canvas.toDataURL("image/jpeg")

				setTimeout(()=>{

					resolve({ name: object.name,  image: dataURL })

				}, 1)

			}, reject)

		})

	}

	/** @returns { Promise<ImageData> } top row first, on both backends */
	getRenderTargetImage(renderTarget, cubeFace = 0) {

	    return readRenderTargetImage(renderTarget, cubeFace)
	}

	// addRandomGeometry(){

	// 	var arr = []

	// 	let i = 0

	// 	while(i < 10 ) {

	// 		const geo = new BoxGeometry( Math.random() * 5 + 2, Math.random() * 5 + 2 , Math.random() * 5 + 2  )

	// 		const mat = new MeshBasicMaterial( { color: Math.random() * 0xffffff, side: 2 } )


	// 		const m = new Mesh( geo, mat )

	// 		m.position.set( Math.random() * 5 - 5, Math.random() * 5 - 5 , Math.random() * 5 - 5 )

	// 		m.scale.set(0.1,0.1,0.1)


	// 		arr.push( m )

	// 		this.scene.add(m)

	// 		i++
	// 	}

	// 	return arr
	// }

	dispose(){

		this.camera = null

		this.target.dispose()

		this.scene = null
	}

}
