// @ts-nocheck
import {
	RenderTarget,
	DepthTexture,
	DepthStencilFormat,
	UnsignedInt248Type,
	HalfFloatType,
	NearestFilter,
	LinearFilter,
	NodeMaterial,
	QuadMesh,
	NoBlending,
	Matrix4,
	Vector2,
	Vector3,
	Quaternion,
	Box3,
} from "three/webgpu"

import {
	Fn,
	uniform,
	texture,
	uv,
	vec2,
	vec3,
	vec4,
	float,
	int,
	Loop,
	If,
	clamp,
	max,
	min,
	mix,
	dot,
	length,
	smoothstep,
	getViewPosition,
	getScreenPositionFromClip,
	interleavedGradientNoise,
	screenCoordinate,
} from "three/tsl"

import { isCameraCut, tileSize } from "./settings"

/**
 * Camera motion blur for a WebGPURenderer, after McGuire et al., "A
 * Reconstruction Filter for Plausible Motion Blur" (I3D 2012), with the
 * jittered taps of Jimenez, "Next Generation Post Processing in Call of
 * Duty: Advanced Warfare" (SIGGRAPH 2014).
 *
 * The scene is drawn once, into a target that keeps its depth. Each pixel's
 * motion comes from reprojecting that depth with last frame's camera, so no
 * material changes and no second scene render are needed. The visitor's own
 * avatar moves with the camera; pixels inside its capsule are reprojected
 * with the avatar's own motion instead, so it stays sharp while the world
 * streaks past it.
 *
 * Three small full-screen passes follow the scene:
 *  1. tile max: the largest motion in each K x K tile (K = longest blur),
 *  2. neighbour max: the largest motion among the 3 x 3 tiles around it,
 *  3. gather: along the neighbour-max direction, N jittered taps, each
 *     weighted by whether it is in front of or behind the pixel and whether
 *     its own blur reaches the pixel. Foreground smears over background
 *     and background never bleeds onto a sharp foreground.
 * A tile whose neighbourhood is still costs one read and a copy.
 */
export class CameraMotionBlur {

	constructor({ shutter = 1, samples = 16 } = {}) {

		this.shutter = shutter

		this.samples = samples

		this.width = 1

		this.height = 1

		this.msaa = -1

		this.target = null

		this.tiles = this.createSmallTarget()

		this.neighbours = this.createSmallTarget()

		this.quad = new QuadMesh()

		this.previous = { position: new Vector3(), quaternion: new Quaternion(), time: -Infinity }

		this.previousViewProjection = new Matrix4()

		this.previousAnchorWorld = new Matrix4()

		this.hasPreviousAnchor = false

		/** True after a blurred frame: the next still frame must be drawn sharp. */
		this.settling = false

		this.anchor = null

		this.anchorBox = new Box3()

		this.anchorBoxAge = Infinity

		this.anchorHeight = 1.8

		this.lastBlurred = false

		this.u = {
			projectionInverse: uniform( new Matrix4() ),
			reprojection: uniform( new Matrix4() ),
			anchorReprojection: uniform( new Matrix4() ),
			anchorBase: uniform( new Vector3() ),
			anchorTop: uniform( new Vector3() ),
			anchorRadius: uniform( 0 ),
			resolution: uniform( new Vector2( 1, 1 ) ),
			tileResolution: uniform( new Vector2( 1, 1 ) ),
			tile: uniform( 16 ),
			scale: uniform( 0.5 ),
		}

		this.scratch = {
			view: new Matrix4(),
			viewProjection: new Matrix4(),
			anchorDelta: new Matrix4(),
			inverseAnchor: new Matrix4(),
			base: new Vector3(),
			top: new Vector3(),
			position: new Vector3(),
			quaternion: new Quaternion(),
		}
	}

	createSmallTarget() {

		const target = new RenderTarget( 1, 1, {
			type: HalfFloatType,
			minFilter: NearestFilter,
			magFilter: NearestFilter,
			depthBuffer: false,
			stencilBuffer: false,
			generateMipmaps: false,
		} )

		target.texture.name = "motion-blur-tiles"

		return target
	}

	/** The scene target: colour plus a depth texture that keeps the stencil. */
	ensureTarget( renderer ) {

		const msaa = renderer.samples || 0

		if ( this.target && this.msaa === msaa ) return

		this.target?.dispose()

		const target = new RenderTarget( this.width, this.height, {
			type: HalfFloatType,
			minFilter: LinearFilter,
			magFilter: LinearFilter,
			depthBuffer: true,
			stencilBuffer: true,
			generateMipmaps: false,
			samples: msaa,
		} )

		target.texture.name = "motion-blur-scene"

		const depth = new DepthTexture( this.width, this.height )

		depth.format = DepthStencilFormat

		depth.type = UnsignedInt248Type

		target.depthTexture = depth

		this.target = target

		this.msaa = msaa

		if ( this.materials ) {

			this.nodes.color.value = target.texture

			this.nodes.depth.value = target.depthTexture

		}
		else {

			this.build()
		}
	}

	setSize( width, height ) {

		width = Math.max( 1, Math.floor( width ) )

		height = Math.max( 1, Math.floor( height ) )

		if ( width === this.width && height === this.height && this.target ) return

		this.width = width

		this.height = height

		const k = tileSize( height )

		const tw = Math.ceil( width / k ), th = Math.ceil( height / k )

		this.target?.setSize( width, height )

		this.tiles.setSize( tw, th )

		this.neighbours.setSize( tw, th )

		this.u.resolution.value.set( width, height )

		this.u.tileResolution.value.set( tw, th )

		this.u.tile.value = k
	}

	/**
	 * The object that moves with the camera (the visitor's avatar in third
	 * person), or null. Its pixels are reprojected with its own motion.
	 */
	setAnchor( object, height = null ) {

		this.anchorKnownHeight = height > 0 ? height : null

		if ( object !== this.anchor ) {

			this.anchor = object

			this.hasPreviousAnchor = false

			this.anchorBoxAge = Infinity
		}
	}

	build() {

		const u = this.u

		const color = texture( this.target.texture )

		const depth = texture( this.target.depthTexture )

		const tiles = texture( this.tiles.texture )

		const neighbours = texture( this.neighbours.texture )

		this.nodes = { color, depth, tiles, neighbours }

		// Motion of the surface seen at `p` (uv), as a blur radius in pixels,
		// and its distance from the camera: vec3( velocity, distance ). Inlined
		// at each call: a WGSL/GLSL function cannot take the textures.
		const motionAt = Fn( ( [ p ] ) => {

			const d = depth.sample( p ).level( 0 ).x

			const view = getViewPosition( p, d, u.projectionInverse ).toVar()

			// Distance from the anchor's capsule (base to top segment).
			const axis = u.anchorTop.sub( u.anchorBase )

			const h = clamp( dot( view.sub( u.anchorBase ), axis ).div( max( dot( axis, axis ), 1e-6 ) ), 0, 1 )

			const gap = length( view.sub( u.anchorBase.add( axis.mul( h ) ) ) )

			const onAnchor = gap.lessThan( u.anchorRadius )

			const clip = onAnchor.select( u.anchorReprojection, u.reprojection ).mul( vec4( view, 1 ) )

			const before = getScreenPositionFromClip( clip )

			const v = p.sub( before ).mul( u.resolution ).mul( u.scale ).toVar()

			// Points behind last frame's camera have no meaningful motion.
			v.assign( clip.w.greaterThan( 0 ).select( v, vec2( 0 ) ) )

			const len = length( v )

			v.assign( v.mul( min( 1, u.tile.div( max( len, 1e-4 ) ) ) ) )

			return vec3( v, view.z.negate() )

		} )

		// 1. Tile max: 8 x 8 probes spread over each tile.
		const tileMax = Fn( () => {

			const tileUv = u.tile.div( u.resolution )

			const origin = uv().mul( u.tileResolution ).floor().mul( tileUv )

			const best = vec2( 0 ).toVar()

			const bestLen = float( 0 ).toVar()

			Loop( { start: int( 0 ), end: int( 8 ), name: "ty" }, ( { ty } ) => {

				Loop( { start: int( 0 ), end: int( 8 ), name: "tx" }, ( { tx } ) => {

					const probe = origin.add( vec2( float( tx ).add( 0.5 ), float( ty ).add( 0.5 ) ).div( 8 ).mul( tileUv ) )

					const v = motionAt( clamp( probe, vec2( 0 ), vec2( 1 ) ) ).xy

					const l = dot( v, v )

					If( l.greaterThan( bestLen ), () => {

						bestLen.assign( l )

						best.assign( v )
					} )
				} )
			} )

			return vec4( best, 0, 1 )
		} )()

		// 2. Neighbour max: the 3 x 3 tiles around.
		const neighbourMax = Fn( () => {

			const here = uv()

			const step = vec2( 1 ).div( u.tileResolution )

			const best = vec2( 0 ).toVar()

			const bestLen = float( 0 ).toVar()

			Loop( { start: int( -1 ), end: int( 2 ), name: "ny" }, ( { ny } ) => {

				Loop( { start: int( -1 ), end: int( 2 ), name: "nx" }, ( { nx } ) => {

					const v = tiles.sample( clamp( here.add( vec2( float( nx ), float( ny ) ).mul( step ) ), vec2( 0 ), vec2( 1 ) ) ).level( 0 ).xy

					const l = dot( v, v )

					If( l.greaterThan( bestLen ), () => {

						bestLen.assign( l )

						best.assign( v )
					} )
				} )
			} )

			return vec4( best, 0, 1 )
		} )()

		// 3. Gather.
		const samples = this.samples

		const gather = Fn( () => {

			const X = uv()

			const base = color.sample( X ).level( 0 )

			const result = base.toVar()

			const vN = neighbours.sample( X ).level( 0 ).xy

			const lenN = length( vN )

			// A still neighbourhood costs one read and a copy.
			If( lenN.greaterThanEqual( 0.5 ), () => {

				const centre = motionAt( X )

				const lenC = max( length( centre.xy ), 0.5 )

				const zC = centre.z

				// Depths closer than ~3% count as the same surface.
				const softZ = max( zC.mul( 0.03 ), 0.02 )

				const weight = float( 1 ).div( lenC ).toVar()

				const sum = base.mul( weight ).toVar()

				const jitter = interleavedGradientNoise( screenCoordinate.xy ).sub( 0.5 )

				const stepUv = vN.div( u.resolution )

				Loop( { start: int( 0 ), end: int( samples ), name: "i" }, ( { i } ) => {

					// Taps on both sides, never on the centre: t in (-1, 1).
					const t = mix( float( -1 ), float( 1 ), float( i ).add( jitter ).add( 1 ).div( samples + 1 ) )

					const Y = clamp( X.add( stepUv.mul( t ) ), vec2( 0 ), vec2( 1 ) )

					const tap = motionAt( Y )

					const lenY = max( length( tap.xy ), 0.5 )

					const dist = lenN.mul( t.abs() )

					// f: the tap is in front of the pixel; b: behind it.
					const f = clamp( float( 1 ).sub( tap.z.sub( zC ).div( softZ ) ), 0, 1 )

					const b = clamp( float( 1 ).sub( zC.sub( tap.z ).div( softZ ) ), 0, 1 )

					const coneY = clamp( float( 1 ).sub( dist.div( lenY ) ), 0, 1 )

					const coneC = clamp( float( 1 ).sub( dist.div( lenC ) ), 0, 1 )

					const cylY = float( 1 ).sub( smoothstep( lenY.mul( 0.95 ), lenY.mul( 1.05 ), dist ) )

					const cylC = float( 1 ).sub( smoothstep( lenC.mul( 0.95 ), lenC.mul( 1.05 ), dist ) )

					const a = f.mul( coneY ).add( b.mul( coneC ) ).add( cylY.mul( cylC ).mul( 2 ) )

					sum.addAssign( color.sample( Y ).level( 0 ).mul( a ) )

					weight.addAssign( a )
				} )

				result.assign( sum.div( weight ) )
			} )

			return result
		} )()

		const material = ( name, node ) => {

			const m = new NodeMaterial()

			m.name = name

			m.fragmentNode = node

			m.blending = NoBlending

			m.depthTest = false

			m.depthWrite = false

			return m
		}

		this.materials = {
			tileMax: material( "MotionBlurTileMax", tileMax ),
			neighbourMax: material( "MotionBlurNeighbourMax", neighbourMax ),
			gather: material( "MotionBlurGather", gather ),
		}
	}

	updateAnchor( camera, time ) {

		const u = this.u

		const anchor = this.anchor

		// The visitor's group is not in the scene (its avatar draws instanced),
		// so only its own transform counts.
		if ( !anchor || anchor.visible === false ) {

			u.anchorRadius.value = 0

			this.hasPreviousAnchor = false

			return
		}

		anchor.updateWorldMatrix( true, false )

		// The capsule follows the avatar's bounds, refreshed twice a second.
		if ( this.anchorKnownHeight ) {

			this.anchorHeight = this.anchorKnownHeight
		}
		else if ( time - this.anchorBoxAge > 0.5 || this.anchorBoxAge === Infinity ) {

			this.anchorBox.setFromObject( anchor )

			const h = this.anchorBox.max.y - this.anchorBox.min.y

			this.anchorHeight = Number.isFinite( h ) && h > 0.2 ? h : 1.8

			this.anchorBoxAge = time
		}

		const s = this.scratch

		const world = anchor.matrixWorld

		s.base.setFromMatrixPosition( world )

		s.top.copy( s.base )

		// Leave the ground under its feet out: it belongs to the world.
		// Wide enough for the name tag over the head as well as the body.
		const radius = Math.max( this.anchorHeight * 0.22, 0.6 )

		s.base.y += radius + 0.05

		s.top.y += Math.max( this.anchorHeight - radius, radius + 0.06 )

		s.base.applyMatrix4( camera.matrixWorldInverse )

		s.top.applyMatrix4( camera.matrixWorldInverse )

		u.anchorBase.value.copy( s.base )

		u.anchorTop.value.copy( s.top )

		u.anchorRadius.value = radius

		// view now -> world now -> anchor local -> world before -> clip before
		s.inverseAnchor.copy( world ).invert()

		const before = this.hasPreviousAnchor ? this.previousAnchorWorld : world

		s.anchorDelta.multiplyMatrices( before, s.inverseAnchor )

		u.anchorReprojection.value
			.copy( this.previousViewProjection )
			.multiply( s.anchorDelta )
			.multiply( camera.matrixWorld )

		this.previousAnchorWorld.copy( world )

		this.hasPreviousAnchor = true
	}

	/**
	 * Draws `scene` into `output` (null: the canvas) with camera motion blur.
	 * Returns false when it drew nothing (the caller draws as usual).
	 */
	render( renderer, scene, camera, output = null, time = performance.now() / 1000 ) {

		if ( !camera?.isPerspectiveCamera ) return false

		this.last = { renderer, scene, camera }

		const size = renderer.getDrawingBufferSize( this.scratch.drawing ??= new Vector2() )

		this.setSize( size.x, size.y )

		this.ensureTarget( renderer )

		camera.updateMatrixWorld()

		const s = this.scratch

		camera.matrixWorld.decompose( s.position, s.quaternion, s.scale ??= new Vector3() )

		const current = { position: s.position, quaternion: s.quaternion, time }

		const cut = isCameraCut( this.previous, current )

		s.viewProjection.multiplyMatrices( camera.projectionMatrix, camera.matrixWorldInverse )

		if ( cut ) {

			this.previousViewProjection.copy( s.viewProjection )

			this.hasPreviousAnchor = false
		}

		const u = this.u

		u.projectionInverse.value.copy( camera.projectionMatrixInverse )

		u.reprojection.value.copy( this.previousViewProjection ).multiply( camera.matrixWorld )

		// The shutter stays open for `shutter` of a 30 fps frame whatever
		// the frame rate (1: 1/30 s, the strong blur of console games), so
		// the blur is as long at 60 or 120 fps as at 30. At most twice the
		// step between two frames.
		const gap = Math.max( time - this.previous.time, 1e-3 )

		u.scale.value = 0.5 * Math.min( 2, this.shutter / 30 / gap )

		this.updateAnchor( camera, time )

		// Did the camera move since last frame? A still frame is drawn
		// straight to the output: no blur to compute, nothing to pay.
		const moved = !cut && !s.viewProjection.equals( this.previousViewProjection )

		const oldTarget = renderer.getRenderTarget()

		if ( !moved ) {

			try {

				renderer.setRenderTarget( output )

				if ( output ) renderer.clear( true, true, true )

				renderer.render( scene, camera )
			}
			finally {

				renderer.setRenderTarget( oldTarget )
			}

			this.remember( s, time, false )

			return true
		}

		const oldAutoClear = renderer.autoClear

		try {

			renderer.setRenderTarget( this.target )

			renderer.autoClear = false

			renderer.clear( true, true, true )

			renderer.render( scene, camera )

			const quad = this.quad

			renderer.setRenderTarget( this.tiles )

			quad.material = this.materials.tileMax

			quad.render( renderer )

			renderer.setRenderTarget( this.neighbours )

			quad.material = this.materials.neighbourMax

			quad.render( renderer )

			renderer.setRenderTarget( output )

			quad.material = this.materials.gather

			quad.render( renderer )
		}
		finally {

			renderer.setRenderTarget( oldTarget )

			renderer.autoClear = oldAutoClear
		}

		this.remember( s, time, true )

		return true
	}

	/** Keep this frame's camera for the next; a blurred frame needs a sharp one after. */
	remember( s, time, blurred ) {

		this.settling = blurred

		this.previousViewProjection.copy( s.viewProjection )

		this.previous.position.copy( s.position )

		this.previous.quaternion.copy( s.quaternion )

		this.previous.time = time
	}

	/**
	 * GPU cost in milliseconds per frame, for measuring on a real device:
	 * the scene draw into the target, and the three blur passes while the
	 * camera turns at `degreesPerFrame` (2 degrees a frame is 120 degrees
	 * a second at 60 fps, a fast mouse turn). Waits for the GPU after each
	 * batch by reading one pixel back.
	 */
	async benchmark( frames = 60, degreesPerFrame = 2 ) {

		const { renderer, scene, camera } = this.last ?? {}

		if ( !renderer ) return null

		const finish = () => renderer.readRenderTargetPixelsAsync( this.tiles, 0, 0, 1, 1 )

		const time = async ( draw ) => {

			await finish()

			const start = performance.now()

			for ( let i = 0; i < frames; i ++ ) draw()

			await finish()

			return ( performance.now() - start ) / frames
		}

		const old = renderer.getRenderTarget()

		const turned = camera.clone()

		turned.rotateY( degreesPerFrame * Math.PI / 180 )

		turned.updateMatrixWorld()

		const before = new Matrix4().multiplyMatrices( turned.projectionMatrix, turned.matrixWorldInverse )

		const saved = this.u.reprojection.value.clone()

		this.u.reprojection.value.copy( before ).multiply( camera.matrixWorld )

		this.u.anchorRadius.value = 0

		const quad = this.quad

		const passes = ( output ) => () => {

			renderer.setRenderTarget( this.tiles )
			quad.material = this.materials.tileMax
			quad.render( renderer )

			renderer.setRenderTarget( this.neighbours )
			quad.material = this.materials.neighbourMax
			quad.render( renderer )

			renderer.setRenderTarget( output )
			quad.material = this.materials.gather
			quad.render( renderer )
		}

		this.benchOutput ??= new RenderTarget( 1, 1, { type: HalfFloatType, depthBuffer: false } )

		this.benchOutput.setSize( this.width, this.height )

		try {

			const sceneMs = await time( () => {

				renderer.setRenderTarget( this.target )
				renderer.clear( true, true, true )
				renderer.render( scene, camera )
			} )

			const blurMs = await time( passes( this.benchOutput ) )

			// The same passes with a still camera: the cost when not moving.
			this.u.reprojection.value.copy( this.previousViewProjection ).multiply( camera.matrixWorld )

			const stillMs = await time( passes( this.benchOutput ) )

			return {
				width: this.width,
				height: this.height,
				samples: this.samples,
				msaa: this.msaa,
				sceneMs: +sceneMs.toFixed( 2 ),
				blurTurningMs: +blurMs.toFixed( 2 ),
				blurStillMs: +stillMs.toFixed( 2 ),
			}
		}
		finally {

			this.u.reprojection.value.copy( saved )

			renderer.setRenderTarget( old )
		}
	}

	/** Forget last frame's camera: the next frame is drawn sharp. */
	reset() {

		this.previous.time = -Infinity

		this.hasPreviousAnchor = false

		this.settling = false
	}

	dispose() {

		this.target?.dispose()

		this.tiles.dispose()

		this.neighbours.dispose()

		for ( const m of Object.values( this.materials ?? {} ) ) m.dispose()
	}
}
