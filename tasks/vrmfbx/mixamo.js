/* global THREE, mixamoVRMRigMap */

/**
 * Load Mixamo animation, convert for three-vrm use, and return it.
 *
 * @param {string} url A url of mixamo animation data
 * @param {VRM} vrm A target VRM
 * @returns {Promise<THREE.AnimationClip>} The converted AnimationClip
 */

import * as THREE from 'three'

import FBXLoader from './fbxloader.js'

import mixamoVRMRigMap from './rigmap.js'

import MixamoRigJSON from './mixamorig.json'

const objLoader = new THREE.ObjectLoader()

const MIXAMO_SKELETON = objLoader.parse( MixamoRigJSON )


function downloadJSON( input, filename ) {

	var file = new Blob([input], {type: "model/gltf+binary;charset=utf-8"});

	var a = document.createElement("a"), url = URL.createObjectURL(file);

	a.href = url;

	a.download = filename;

	document.body.appendChild(a);

	a.click();

	document.body.removeChild(a);

	a = null


	// saveString( JSON.stringify( json ), filename );  

}

var process = function( gltf, asset, vrm, clip ){

	const tracks = []; // KeyframeTracks compatible with VRM will be added here

	const restRotationInverse = new THREE.Quaternion();
	const parentRestWorldRotation = new THREE.Quaternion();
	const _quatA = new THREE.Quaternion();


	clip.tracks.forEach( ( track ) => {

		// Convert each tracks for VRM use, and push to `tracks`
		const trackSplitted = track.name.split( '.' );
		const mixamoRigName = trackSplitted[ 0 ];
		const vrmBoneName = mixamoVRMRigMap[ mixamoRigName ];
		const vrmNodeName = vrm.humanoid?.getNormalizedBoneNode( vrmBoneName )?.name;
		const mixamoRigNode = MIXAMO_SKELETON.getObjectByName( mixamoRigName );


		if ( vrmNodeName != null ) {

			const propertyName = trackSplitted[ 1 ];

			// Store rotations of rest-pose.
			mixamoRigNode.getWorldQuaternion( restRotationInverse ).invert();
			mixamoRigNode.parent.getWorldQuaternion( parentRestWorldRotation );

			// console.log( restRotationInverse )

			if ( track instanceof THREE.QuaternionKeyframeTrack ) {

				// Retarget rotation of mixamoRig to NormalizedBone.
				for ( let i = 0; i < track.values.length; i += 4 ) {

					const flatQuaternion = track.values.slice( i, i + 4 );

					_quatA.fromArray( flatQuaternion );

					// 親のレスト時ワールド回転 * トラックの回転 * レスト時ワールド回転の逆
					_quatA
						.premultiply( parentRestWorldRotation )
						.multiply( restRotationInverse );

					_quatA.toArray( flatQuaternion );

					flatQuaternion.forEach( ( v, index ) => {

						track.values[ index + i ] = v;

					} );

				}

				tracks.push(
					new THREE.QuaternionKeyframeTrack(
						`${vrmNodeName}.${propertyName}`,
						track.times,
						track.values.map( ( v, i ) => ( vrm.meta?.metaVersion === '0' && i % 2 === 0 ? - v : v ) ),
					),
				);

			} else if ( track instanceof THREE.VectorKeyframeTrack ) {

				const value = track.values.map( ( v, i ) => ( vrm.meta?.metaVersion === '0' && i % 3 !== 1 ? - v : v ) * 0.01 );
				tracks.push( new THREE.VectorKeyframeTrack( `${vrmNodeName}.${propertyName}`, track.times, value ) );

			}

		}

	} );





	return new THREE.AnimationClip( 'vrmAnimation', clip.duration, tracks );


}

let lastAsset = null

var loadMixamoAnimation = function( gltf, url, vrm, isJson = false) {

	if( isJson ) {

		console.log( url )

		const clip = THREE.AnimationClip.parse( url )

		return  new Promise(( resolve )=>{

			resolve( process( vrm, gltf.scene, vrm, clip) )
		})

	}
	else {

		const loader = new FBXLoader(); // A loader which loads FBX

		return loader.loadAsync( url ).then( ( asset ) => {


			let json = JSON.stringify( asset.animations[0].toJSON() ) 

			downloadJSON(json, 'animation.json')
			
				lastAsset = asset

				const clip = THREE.AnimationClip.findByName( asset.animations, 'mixamo.com' ); // extract the AnimationClip

				return process( gltf, asset, vrm, clip)


			
		} );

	}

	

}

export default loadMixamoAnimation