import {

	MeshBasicNodeMaterial,

	RenderTarget,

	Scene,

	OrthographicCamera,

	LinearFilter,

	HalfFloatType,

	BufferGeometry,

	BufferAttribute,

	Mesh,

	Color,

	AdditiveBlending,

	DoubleSide

} from 'three/webgpu'

import {

	vec4,

	uv,

	texture,

	sRGBTransferEOTF

} from 'three/tsl'

import {

	DPI,

	APP_STATES,

	VIEW

} from '@3constants'

import Emitter 		from '@3emitter'

import Events 		from '@3events'

import Renderer 	from '@3renderer'

import gsap from 'gsap'

// Warp-speed star field shown while a space loads. It renders straight to the
// screen during the intro (and on top while it fades out), or into
// `renderTarget` for portal previews, where this object is the preview mesh's
// material. It draws the same stars as the page's loading canvas
// (`drawStarfield` in ui/LoaderVideoContainer), so the two read as one effect
// when the page hands over to the engine. It used to be a lit, wobbling
// tunnel, which made people dizzy.

const STAR_COUNT = 250

// Stars start this far away (in the canvas version's units) and fly at the
// canvas version's 0.055 per 30 fps frame.
const WARP_Z = 24

const SPEED = 1.65

// Seconds of travel each streak's tail trails behind its head; the canvas
// version gets its trails from fading the previous frames.
const TRAIL = 0.2

const MIN_Z = 0.05

const VERTS_PER_STAR = 4

const INDICES_PER_STAR = 6

class StarfieldMaterial extends MeshBasicNodeMaterial {

	constructor(){

		super()

		const renderTarget = new RenderTarget( 1, 1, {

			minFilter : LinearFilter,

			magFilter : LinearFilter,

			type : HalfFloatType,

			samples : 4
		} )

		this.uniforms = {

			map: texture( renderTarget.texture )
		}

		// A render target sampled with mesh uvs comes out upside down in r180.
		const texel = this.uniforms.map.sample( uv().flipY() )

		// The WebGL shader wrote the (linear) target straight to the screen.
		this.colorNode = vec4( sRGBTransferEOTF( texel.rgb ), texel.a )

		this.fog = false

		this.renderTarget = renderTarget

		this.scene = new Scene()

		// One unit is one CSS pixel of the view, centred.
		this.camera = new OrthographicCamera( -0.5, 0.5, 0.5, -0.5, -1, 1 )

		this.width = 1

		this.height = 1

		this.stars = []

		for ( let i = 0; i < STAR_COUNT; i++ ) {

			this.stars.push( { x: 0, y: 0, z: 0, spawned: false } )
		}

		const positions = new Float32Array( STAR_COUNT * VERTS_PER_STAR * 3 )

		const colors = new Float32Array( STAR_COUNT * VERTS_PER_STAR * 3 )

		const indices = new Uint16Array( STAR_COUNT * INDICES_PER_STAR )

		for ( let i = 0; i < STAR_COUNT; i++ ) {

			const v = i * VERTS_PER_STAR

			indices.set( [ v, v + 1, v + 2, v + 2, v + 1, v + 3 ], i * INDICES_PER_STAR )
		}

		const geometry = new BufferGeometry()

		geometry.setAttribute( 'position', new BufferAttribute( positions, 3 ) )

		geometry.setAttribute( 'color', new BufferAttribute( colors, 3 ) )

		geometry.setIndex( new BufferAttribute( indices, 1 ) )

		const material = new MeshBasicNodeMaterial( {

			vertexColors: true,

			transparent: true,

			blending: AdditiveBlending,

			depthTest: false,

			depthWrite: false,

			side: DoubleSide,

			fog: false
		} )

		this.starMesh = new Mesh( geometry, material )

		this.starMesh.frustumCulled = false

		this.scene.add( this.starMesh )

		this.transitionValue = 0

		this.currentState = null

		this.userData.isShared = true

		this.renderOnTop = false

		this.color = new Color()
	}

	async preload(){

	}

	async setState( STATE, opts ){

		let deactivatePromise;

		if( STATE == APP_STATES.INTRO ) {

			this.renderOnTop = true
		}

		if( this.currentState == APP_STATES.INTRO ) {

			deactivatePromise = this.desactivate()

			this.addEvents()
		}

		else if( this.currentState != APP_STATES.TRANSITION ) {

			this.removeEvents()
		}

		this.currentState = STATE

		switch ( STATE ) {

			case APP_STATES.INTRO:

				this.activate()

				this.addEvents()

				this.resize( VIEW.w, VIEW.h )

				break
		}

		if( deactivatePromise )
			return await deactivatePromise;

		return null;
	}

	addEvents(){

		if( this.updateEvent == null ){

			this.updateEvent = this.update.bind(this)

			if( this.renderOnTop ) {

				Emitter.on(Events.POST_UPDATE, this.updateEvent )
			}

			else {

				Emitter.on(Events.UPDATE, this.updateEvent )
			}
		}

		if ( this.currentState == APP_STATES.INTRO || this.renderOnTop ) {

			if ( this.resizeEvent == null ) {

				this.resizeEvent = ()=>{

					this.resize( VIEW.w, VIEW.h )
				}

				Emitter.on(Events.RESIZE, this.resizeEvent )
			}
		}
	}

	removeEvents(){

		if( this.updateEvent ){

			Emitter.off(Events.UPDATE, this.updateEvent )

			Emitter.off(Events.POST_UPDATE, this.updateEvent )

			this.updateEvent = null
		}

		if ( this.resizeEvent ) {

			Emitter.off(Events.RESIZE, this.resizeEvent )

			this.resizeEvent = null
		}
	}

	resize(w, h){

		this.renderTarget.setSize( Math.max( 1, Math.floor( w * DPI ) ), Math.max( 1, Math.floor( h * DPI ) ) )

		this.width = Math.max( 1, w )

		this.height = Math.max( 1, h )

		this.camera.left = -this.width / 2

		this.camera.right = this.width / 2

		this.camera.top = this.height / 2

		this.camera.bottom = -this.height / 2

		this.camera.updateProjectionMatrix()
	}

	desactivate(){

		return new Promise((resolve)=>{

			if ( this.tween ) {

				this.tween.kill()

				this.tween = null
			}

			this.tween = gsap.to(this, {

				transitionValue : 0,

				duration : 2.7,

				ease: 'power1.easeOut',

				onComplete:()=>{

					this.renderOnTop = false

					resolve(true)
				}
			})
		})
	}

	activate( force = false ){

		if ( this.tween ) {

			this.tween.kill()

			this.tween = null
		}

		if( force == true ) {

			this.transitionValue = 0
		}

		this.tween = gsap.to(this, {

			transitionValue : 1,

			duration : 4.5,

			ease: 'power1.easeOut',
		})
	}

	spawn( star ){

		const halfw = this.width / 2

		const halfh = this.height / 2

		star.x = Math.random() * this.width - halfw

		star.y = Math.random() * this.height - halfh

		star.z = 1 + Math.random() * WARP_Z

		// hsla(200, 100%, 50..100%) like the canvas version, where three in
		// four stars come out white.
		const lightness = Math.min( 1, 0.5 + Math.random() * 2 )

		star.color = this.color.setHSL( 200 / 360, 1, lightness ).clone()

		star.spawned = true
	}

	updateStars( delta ){

		const halfw = this.width / 2

		const halfh = this.height / 2

		const step = Math.min( delta, 0.1 ) * SPEED

		// Fade in quickly, and stay bright through most of the fade out.
		const brightness = Math.min( 1, this.transitionValue * 2.5 )

		const positions = this.starMesh.geometry.attributes.position

		const colors = this.starMesh.geometry.attributes.color

		const p = positions.array

		const c = colors.array

		for ( let i = 0; i < STAR_COUNT; i++ ) {

			const star = this.stars[ i ]

			if ( !star.spawned ) this.spawn( star )

			star.z -= step

			let hx = star.x / star.z

			let hy = star.y / star.z

			if ( star.z <= MIN_Z || hx < -halfw || hx > halfw || hy < -halfh || hy > halfh ) {

				this.spawn( star )

				hx = star.x / star.z

				hy = star.y / star.z
			}

			const tz = star.z + SPEED * TRAIL

			const tx = star.x / tz

			const ty = star.y / tz

			// A thin quad from tail to head, wider at the head as it nears.
			let dx = hx - tx

			let dy = hy - ty

			const len = Math.hypot( dx, dy ) || 1

			dx /= len

			dy /= len

			const head = Math.min( 2.5, 0.6 + 1.2 / star.z )

			const tail = head * 0.3

			const nx = -dy

			const ny = dx

			const o = i * VERTS_PER_STAR * 3

			p[ o ] = tx + nx * tail
			p[ o + 1 ] = ty + ny * tail
			p[ o + 2 ] = 0

			p[ o + 3 ] = tx - nx * tail
			p[ o + 4 ] = ty - ny * tail
			p[ o + 5 ] = 0

			p[ o + 6 ] = hx + nx * head
			p[ o + 7 ] = hy + ny * head
			p[ o + 8 ] = 0

			p[ o + 9 ] = hx - nx * head
			p[ o + 10 ] = hy - ny * head
			p[ o + 11 ] = 0

			// Additive, so a black tail is see-through.
			const r = star.color.r * brightness

			const g = star.color.g * brightness

			const b = star.color.b * brightness

			c.fill( 0, o, o + 6 )

			c[ o + 6 ] = r
			c[ o + 7 ] = g
			c[ o + 8 ] = b

			c[ o + 9 ] = r
			c[ o + 10 ] = g
			c[ o + 11 ] = b
		}

		positions.needsUpdate = true

		colors.needsUpdate = true
	}

	update( delta, total ){

		this.updateStars( delta )

		let oldXREnabled = Renderer.xr.enabled

		Renderer.xr.enabled = false

		if( this.currentState == APP_STATES.INTRO ) {

			Renderer.setClearColor(0x000000, 1)

			Renderer.clear()

			Renderer.render( this.scene, this.camera )

			Renderer.setClearColor(0x000000, 0)
		}

		else {

			// render on top

			if( this.renderOnTop ) {

				Renderer.clearDepth()

				const prevAutoClear = Renderer.autoClear

				Renderer.autoClear = false

				Renderer.render( this.scene, this.camera )

				Renderer.autoClear = prevAutoClear
			}

			else {

				let former = Renderer.getRenderTarget()

				const prevAlpha = Renderer.getClearAlpha()

				Renderer.setRenderTarget( this.renderTarget )

				// The stars are additive, so the preview needs its own black.
				Renderer.setClearAlpha( 1 )

				Renderer.clear()

				Renderer.render( this.scene, this.camera )

				Renderer.setClearAlpha( prevAlpha )

				Renderer.setRenderTarget( former )
			}
		}

		Renderer.xr.enabled = oldXREnabled
	}
}

export default new StarfieldMaterial()
