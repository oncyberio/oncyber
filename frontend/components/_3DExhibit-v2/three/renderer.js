import { legacyGpuResources, ownRendererResources } from "./utils/sessionResources";
import { installFog } from "./tsl/fog";
import "./compat";
// @ts-check

import {

	WebGPURenderer,
	PCFShadowMap,
	SRGBColorSpace,

} from "three/webgpu"

import {

	DPI,

 	DEBUG,

 	CANVAS,

	SET_CANVAS,

	QUALITY,

	IS_VR,

} from "@3constants"

import { antialiasSamples, setRendererSamples } from "./rendererAntialias"

// WebGPU when the browser has it, otherwise the same renderer on its WebGL2
// backend (TSL compiles to GLSL there). `?renderer=webgl` forces the fallback.
const FORCE_WEBGL = typeof window !== "undefined" &&
	new URLSearchParams(window.location.search).get("renderer") === "webgl"

const renderer = new WebGPURenderer({
    canvas: CANVAS ?? undefined,
    antialias: true,
    alpha: true,
    forceWebGL: FORCE_WEBGL,
    powerPreference: "high-performance"
})

// Whichever loads first owns the canvas: the API's, or ours (styled the same).
if( CANVAS == null && typeof document !== "undefined" ) {

	const canvas = renderer.domElement

	canvas.style.width = "100%"

	canvas.style.height = "100%"

	canvas.style.outline = "none"

	canvas.style.position = "absolute"

	SET_CANVAS( canvas )
}

// We'll manage clearing manually because of the portals
renderer.autoClear = false

renderer.setPixelRatio(DPI)

renderer.outputColorSpace = SRGBColorSpace

// Match the r153 legacy light scale spaces were authored with (see compat.js).
renderer.legacyLights = true

renderer.info.autoReset = false

renderer.setClearColor(0x000000, 1)

renderer.setOpaqueSort(function depthSortStable( a, b ) {

	if ( a.groupOrder !== b.groupOrder ) {

		return a.groupOrder - b.groupOrder;

	} else if ( a.renderOrder !== b.renderOrder ) {

		return a.renderOrder - b.renderOrder;

	} else if ( a.material.id !== b.material.id ) {

		return a.material.id - b.material.id;

	} else if ( a.z !== b.z ) {

		return a.z - b.z;

	} else {

		return a.id - b.id;

	}

})
renderer.debug.checkShaderErrors = DEBUG

renderer.autoClearStencil = false

// r186 dropped PCFSoft for WebGPU; PCF is soft now.
renderer.shadowMap.type = PCFShadowMap;

if( DEBUG || process.env.NODE_ENV === "development" ){

	// @ts-ignore
	window.renderer = renderer
}

// Shadows: WebGL had one global switch; WebGPU decides per light shadow
// (`shadow.autoUpdate` / `shadow.needsUpdate`). The engine keeps toggling the
// global switch (lighting, reflector/water/blur sub-passes), so forward it to
// every shadow the lighting registers.
const shadowCasters = new Set()

let shadowAutoUpdate = true

Object.defineProperty( renderer.shadowMap, "autoUpdate", {

	get: () => shadowAutoUpdate,

	set( value ) {

		shadowAutoUpdate = value

		shadowCasters.forEach( ( shadow ) => shadow.autoUpdate = value )
	}
} )

/** @param { import("three").LightShadow } shadow */
export function registerShadow( shadow ) {

	shadowCasters.add( shadow )

	shadow.autoUpdate = shadowAutoUpdate

	return () => shadowCasters.delete( shadow )
}

// The handful of WebGL capability reads the engine makes. WebGL2-class
// features are a baseline for both WebGPU and the WebGL2 fallback.
renderer.capabilities = {

	isWebGL2: true,

	precision: "highp",

	get maxTextureSize() {

		const backend = /** @type {any} */ (renderer.backend)

		return backend.device?.limits.maxTextureDimension2D
			?? backend.gl?.getParameter( backend.gl.MAX_TEXTURE_SIZE )
			?? 8192
	},

	getMaxAnisotropy: () => renderer.getMaxAnisotropy(),
}

// MSAA follows the quality (rendererAntialias.js).
const FULL_SAMPLES = renderer.samples

/**
 * Applies the MSAA sample count for the quality in force (and VR). Cheap
 * when nothing changed; world3D.js calls it on every resize.
 * @returns { boolean } whether the count changed
 */
export function syncAntialias() {

	return setRendererSamples( renderer, antialiasSamples( {

		quality: QUALITY,

		dpi: DPI,

		// set before the session starts and cleared once xr is disabled
		isVR: IS_VR,

		fullSamples: FULL_SAMPLES,
	} ) )
}

ownRendererResources(renderer, legacyGpuResources);

installFog()

/**
 * Resolves once the GPU device (or the WebGL2 fallback context) exists.
 * Nothing may render before this; the engine boot awaits it.
 */
export const rendererReady = renderer.init().then(() => {

	const backend = /** @type {any} */ (renderer.backend)

	renderer.domElement.dataset.renderer = backend.isWebGPUBackend ? "webgpu" : "webgl2"

	// One invalid pipeline voids the whole frame on WebGPU; surface the cause.
	const reported = new Set()

	backend.device?.addEventListener( "uncapturederror", ( event ) => {

		const message = event.error?.message ?? String( event.error )

		if( reported.has( message ) || reported.size > 20 ) return

		reported.add( message )

		console.error( "WebGPU validation error:", message )
	} )

	return renderer
})

export default renderer
