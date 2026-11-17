import {

	cameraProjectionMatrix,

	cameraViewMatrix,

	modelWorldMatrix,

	positionLocal,

	vec4,

} from 'three/tsl'

/**
 * Clip position for a background drawn at infinity: the vertex is turned into
 * a direction (model rotation and scale, no translation), seen through the
 * camera's rotation only, and pushed to the far plane (z = w).
 *
 * Dropping the translation matters in a headset. The background mesh follows
 * one camera position, but each eye sits a few centimetres to either side of
 * it, so a positioned 2 m sphere showed parallax and looked stuck to the
 * face. Without translation both eyes see the sky at infinity. On a flat
 * screen the result is the same as before, since the mesh is centred on the
 * camera.
 */
export function skyClipPosition() {

	const direction = cameraViewMatrix.mul( modelWorldMatrix.mul( vec4( positionLocal, 0.0 ) ) )

	const clip = cameraProjectionMatrix.mul( vec4( direction.xyz, 1.0 ) )

	return clip.setZ( clip.w )
}
