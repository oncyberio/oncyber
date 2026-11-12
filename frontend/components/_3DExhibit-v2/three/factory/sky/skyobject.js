import {
	BackSide,
	BoxGeometry,
	Mesh,
	Vector3
} from 'three';

import {
	NodeMaterial
} from 'three/webgpu';

import {
	Fn,
	acos,
	add,
	clamp,
	cos,
	dot,
	exp,
	float as tslFloat,
	max,
	mix,
	modelViewProjection,
	mul,
	normalize,
	positionWorld,
	pow,
	sub,
	uniform,
	varyingProperty,
	vec3,
	vec4
} from 'three/tsl';

/**
 * Based on "A Practical Analytic Model for Daylight"
 * aka The Preetham Model, the de facto standard analytic skydome model
 * https://www.researchgate.net/publication/220720443_A_Practical_Analytic_Model_for_Daylight
 *
 * First implemented by Simon Wallner
 * http://simonwallner.at/project/atmospheric-scattering/
 *
 * Improved by Martin Upitis
 * http://blenderartists.org/forum/showthread.php?245954-preethams-sky-impementation-HDR
 *
 * Three.js integration by zz85 http://twitter.com/blurspline
 *
 * TSL port of the engine's WebGL Sky (no sun disc, view direction from the
 * world origin).
*/

export default class Sky extends Mesh {

	constructor() {

		const material = new NodeMaterial();

		material.name = 'SkyShader'

		material.side = BackSide

		material.depthWrite = false

		material.fog = false

		const uniforms = {
			'turbidity': uniform( 2 ),
			'rayleigh': uniform( 1 ),
			'mieCoefficient': uniform( 0.005 ),
			'mieDirectionalG': uniform( 0.8 ),
			'sunPosition': uniform( new Vector3() ),
			'up': uniform( new Vector3( 0, 1, 0 ) )
		}

		material.uniforms = uniforms

		const { turbidity, rayleigh, mieCoefficient, mieDirectionalG, sunPosition, up } = uniforms

		const vSunDirection = varyingProperty( 'vec3' );
		const vSunE = varyingProperty( 'float' );
		const vSunfade = varyingProperty( 'float' );
		const vBetaR = varyingProperty( 'vec3' );
		const vBetaM = varyingProperty( 'vec3' );

		material.vertexNode = Fn( () => {

			// constants for atmospheric scattering
			const e = tslFloat( 2.71828182845904523536028747135266249775724709369995957 );

			// this pre-calcuation replaces older TotalRayleigh(vec3 lambda) function:
			const totalRayleigh = vec3( 5.804542996261093E-6, 1.3562911419845635E-5, 3.0265902468824876E-5 );

			// MieConst = pi * pow( ( 2.0 * pi ) / lambda, vec3( v - 2.0 ) ) * K
			const MieConst = vec3( 1.8399918514433978E14, 2.7798023919660528E14, 4.0790479543861094E14 );

			// earth shadow hack
			const cutoffAngle = tslFloat( 1.6110731556870734 );
			const steepness = tslFloat( 1.5 );
			const EE = tslFloat( 1000.0 );

			const sunDirection = normalize( sunPosition );
			vSunDirection.assign( sunDirection );

			const zenithAngleCos = clamp( dot( sunDirection, up ), - 1, 1 );
			vSunE.assign( EE.mul( max( 0.0, tslFloat( 1.0 ).sub( pow( e, cutoffAngle.sub( acos( zenithAngleCos ) ).div( steepness ).negate() ) ) ) ) );

			const sunfade = tslFloat( 1.0 ).sub( clamp( tslFloat( 1.0 ).sub( exp( sunPosition.y.div( 450000.0 ) ) ), 0, 1 ) );
			vSunfade.assign( sunfade );

			const rayleighCoefficient = rayleigh.sub( tslFloat( 1.0 ).mul( tslFloat( 1.0 ).sub( sunfade ) ) );

			// extinction (absorbtion + out scattering)
			vBetaR.assign( totalRayleigh.mul( rayleighCoefficient ) );

			const c = tslFloat( 0.2 ).mul( turbidity ).mul( 10E-18 );
			vBetaM.assign( tslFloat( 0.434 ).mul( c ).mul( MieConst ).mul( mieCoefficient ) );

			// set z to camera.far
			return modelViewProjection.setZ( modelViewProjection.w );

		} )();

		material.colorNode = Fn( () => {

			const pi = tslFloat( 3.141592653589793238462643383279502884197169 );

			// optical length at zenith for molecules
			const rayleighZenithLength = tslFloat( 8.4E3 );
			const mieZenithLength = tslFloat( 1.25E3 );

			// 3.0 / ( 16.0 * pi )
			const THREE_OVER_SIXTEENPI = tslFloat( 0.05968310365946075 );
			// 1.0 / ( 4.0 * pi )
			const ONE_OVER_FOURPI = tslFloat( 0.07957747154594767 );

			// cameraPos is the world origin, as in the WebGL shader
			const direction = normalize( positionWorld );

			// optical length
			// cutoff angle at 90 to avoid singularity in next formula.
			const zenithAngle = acos( max( 0.0, dot( up, direction ) ) );
			const inverse = tslFloat( 1.0 ).div( cos( zenithAngle ).add( tslFloat( 0.15 ).mul( pow( tslFloat( 93.885 ).sub( zenithAngle.mul( 180.0 ).div( pi ) ), - 1.253 ) ) ) );
			const sR = rayleighZenithLength.mul( inverse );
			const sM = mieZenithLength.mul( inverse );

			// combined extinction factor
			const Fex = exp( mul( vBetaR, sR ).add( mul( vBetaM, sM ) ).negate() );

			// in scattering
			const cosTheta = dot( direction, vSunDirection );

			const rPhase = THREE_OVER_SIXTEENPI.mul( tslFloat( 1.0 ).add( pow( cosTheta.mul( 0.5 ).add( 0.5 ), 2.0 ) ) );
			const betaRTheta = vBetaR.mul( rPhase );

			const g2 = pow( mieDirectionalG, 2.0 );
			const inv = tslFloat( 1.0 ).div( pow( tslFloat( 1.0 ).sub( tslFloat( 2.0 ).mul( mieDirectionalG ).mul( cosTheta ) ).add( g2 ), 1.5 ) );
			const mPhase = ONE_OVER_FOURPI.mul( tslFloat( 1.0 ).sub( g2 ) ).mul( inv );
			const betaMTheta = vBetaM.mul( mPhase );

			const Lin = pow( vSunE.mul( add( betaRTheta, betaMTheta ).div( add( vBetaR, vBetaM ) ) ).mul( sub( 1.0, Fex ) ), vec3( 1.5 ) ).toVar();
			Lin.mulAssign( mix( vec3( 1.0 ), pow( vSunE.mul( add( betaRTheta, betaMTheta ).div( add( vBetaR, vBetaM ) ) ).mul( Fex ), vec3( 1.0 / 2.0 ) ), clamp( pow( sub( 1.0, dot( up, vSunDirection ) ), 5.0 ), 0.0, 1.0 ) ) );

			// nightsky
			const L0 = vec3( 0.1 ).mul( Fex );

			const texColor = add( Lin, L0 ).mul( 0.04 ).add( vec3( 0.0, 0.0003, 0.00075 ) );

			const retColor = pow( texColor, vec3( tslFloat( 1.0 ).div( tslFloat( 1.2 ).add( vSunfade.mul( 1.2 ) ) ) ) );

			// Written as-is: the sky is only drawn into the PMREM capture target,
			// where WebGL also stored it raw and treated it as linear.
			return vec4( retColor, 1.0 );

		} )();

		super( new BoxGeometry( 1, 1, 1 ), material );

		this.isSky = true;

	}

}
