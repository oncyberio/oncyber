/**
 * parameters = {
 *  color: <hex>,
 *  linewidth: <float>, // css pixels (or world units when worldUnits is true)
 *  dashed: <boolean>,
 *  dashScale: <float>,
 *  dashSize: <float>,
 *  dashOffset: <float>,
 *  gapSize: <float>,
 *  resolution: <Vector2>, // css-pixel viewport, used for raycasting only
 * }
 *
 * WebGPU port of the fat-line LineMaterial: a thin layer over r180's
 * Line2NodeMaterial that keeps the WebGL material's defaults and API
 * (no fog, normal blending, no alpha-to-coverage, css-pixel linewidth).
 */

import Shared from '@3shared'

import { Line2NodeMaterial } from 'three/webgpu'

import { NormalBlending, Vector2 } from 'three'

const _resolution = new Vector2()

class LineMaterial extends Line2NodeMaterial {

	static get type() {

		return 'LineMaterial'

	}

	constructor( parameters = {} ) {

		super()

		this.isLineMaterial = true

		// ShaderMaterial defaults of the WebGL version
		this.fog = false
		this.blending = NormalBlending
		this.alphaToCoverage = false

		this._resolution = Shared.resolution.value

		this._renderer = null

		this.useColor = parameters.vertexColors === true

		this._useDash = false

		this.setValues( parameters )

	}

	// Line2NodeMaterial measures linewidth in physical pixels of the viewport,
	// the WebGL material measured it against `resolution` (css pixels), so the
	// width read by the shader is scaled by the renderer's pixel ratio.

	get _pixelRatio() {

		return this._renderer ? this._renderer.getPixelRatio() : 1

	}

	get linewidth() {

		const width = this._linewidth !== undefined ? this._linewidth : 1

		return this.worldUnits ? width : width * this._pixelRatio

	}

	set linewidth( value ) {

		this._linewidth = value

	}

	// three's NodeMaterial.copy() assigns every setter, including the
	// deprecated lineColorNode alias, which warns on each clone. Keep the alias
	// without the warning.

	get lineColorNode() {

		return this.colorNode

	}

	set lineColorNode( value ) {

		this.colorNode = value

	}

	// raycasting (three/examples LineSegments2) compares linewidth against
	// `material.resolution`, keep both in the same (physical) unit

	get resolution() {

		return _resolution.copy( this._resolution ).multiplyScalar( this.worldUnits ? 1 : this._pixelRatio )

	}

	set resolution( value ) {

		if ( value && value.isVector2 ) this._resolution = value

	}

	setup( builder ) {

		this._renderer = builder.renderer

		// Line2NodeMaterial fakes transparency by sampling the viewport; the WebGL
		// material used regular blending, so hide `transparent` from that branch only.

		this._lineTransparent = this.transparent

		this.transparent = false

		try {

			super.setup( builder )

		} finally {

			this.transparent = this._lineTransparent

		}

	}

	setupDiffuseColor( builder ) {

		this.transparent = this._lineTransparent

		super.setupDiffuseColor( builder )

	}

	copy( source ) {

		super.copy( source )

		this.color.copy( source.color )

		this._linewidth = source._linewidth

		this._resolution = source._resolution

		this.useColor = source.useColor

		this.dashed = source.dashed

		this.dashScale = source.dashScale

		this.dashSize = source.dashSize

		this.gapSize = source.gapSize

		this.dashOffset = source.dashOffset

		this.worldUnits = source.worldUnits

		this.alphaToCoverage = source.alphaToCoverage

		return this

	}

}

export { LineMaterial }
