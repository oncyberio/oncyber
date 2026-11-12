import {

	Fn,

	mix,

	select,

	vec2

} from 'three/tsl'

/**
 * "Cover" fit of a unit uv square into a quad of aspect `asp`
 * (the GLSL `correctRatio( uv, baseratio, asp )` helper).
 */
export const correctRatio = /*@__PURE__*/ Fn( ( [ inUv, baseratio, asp ] ) => {

	const fitHeight = vec2(

		inUv.x,

		inUv.y.mul( baseratio ).div( asp ).add( baseratio.div( asp ).oneMinus().mul( 0.5 ) )
	)

	const fitWidth = vec2(

		inUv.x.mul( asp ).div( baseratio ).add( asp.div( baseratio ).oneMinus().mul( 0.5 ) ),

		inUv.y
	)

	// when_fgt( baseratio, asp )
	return select( baseratio.greaterThan( asp ), fitWidth, fitHeight )
} )
