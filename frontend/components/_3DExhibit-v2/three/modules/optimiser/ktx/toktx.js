import {
	Document,
	FileUtils,
	ILogger,
	ImageUtils,
	TextureChannel,
	Transform,
	vec2,
	uuid
} from '@gltf-transform/core'

import {
	KHRTextureBasisu
} from '@gltf-transform/extensions'

import {
	lanczos2,
} from 'ndarray-lanczos';


import {


    WEB_WORKER_SUPPORT,

    SUPPORT_TRANSFERRABLE,

} from '@3constants'

import WorkerPool from '@3gl/utils/workerpool.js'

import WorkerSource from "./toktx.worker.js";



const MICROMATCH_OPTIONS = {
	nocase: true,
	contains: true
}; // Mocks for tests.


export const Mode = {
	ETC1S: 'etc1s',
	UASTC: 'uastc',
};


const GLOBAL_DEFAULTS = {
	filterScale: 1,
	powerOfTwo: false,
	slots: '*',
	// See: https://github.com/donmccurdy/glTF-Transform/pull/389#issuecomment-1089842185
	jobs: 2,
};

export const ETC1S_DEFAULTS = {
	quality: 128,
	compression: 1,
	...GLOBAL_DEFAULTS,
};

export const UASTC_DEFAULTS = {
	level: 2,
	rdo: 0,
	rdoDictionarySize: 32768,
	rdoBlockScale: 10.0,
	rdoStdDev: 18.0,
	rdoMultithreading: true,
	zstd: 18,
	...GLOBAL_DEFAULTS,
};




import {
	Texture
} from '@gltf-transform/core';

export function listTextureSlots(texture) {
	const document = Document.fromGraph(texture.getGraph());
	const root = document.getRoot();
	const slots = texture

		.getGraph()
		.listParentEdges(texture)
		.filter((edge) => edge.getParent() !== root)
		.map((edge) => edge.getName());
	return Array.from(new Set(slots));
}

import {
	Material,
	PropertyType
} from '@gltf-transform/core';

import ndarray from 'ndarray';

function getPixels(path, type, callback) {

	return new Promise((resolve, reject) => {

		let p = path;

		// Construct a Blob URL for Uint8Array inputs.
		if (path instanceof Uint8Array) {
			if (typeof type !== 'string') {
				throw new Error('Type must be given for Uint8Array image data');
			}
			const blob = new Blob([path], {
				type: type
			});
			p = URL.createObjectURL(blob);
		}
		// Decode image with Canvas API.
		const img = new Image();
		img.crossOrigin = 'anonymous';
		img.onload = function() {

			document.body.appendChild(img)
			// URL.revokeObjectURL(p);
			const canvas = document.createElement('canvas');
			canvas.width = img.width;
			canvas.height = img.height;
			const context = canvas.getContext('2d');
			context.drawImage(img, 0, 0);
			const pixels = context.getImageData(0, 0, img.width, img.height);
			resolve(ndarray(new Uint8Array(pixels.data), [img.width, img.height, 4], [4, 4 * img.width, 1], 0));
		};
		img.onerror = (err) => {
			// URL.revokeObjectURL(p);
			resolve(err);
		};
		img.src = p;
	})

}
export function createTransform(name, fn) {
	Object.defineProperty(fn, 'name', {
		value: name
	});
	return fn;
}

var wPool = null;

export const toktx = function(options = {}) {
	options = {
		...(options.mode === Mode.ETC1S ? ETC1S_DEFAULTS : UASTC_DEFAULTS),
		...options,
	};

	return createTransform(options.mode, async(doc) => {

		if( options.basisEncoder && options.basisEncoder.wasmbinary && wPool == null ) {

		    wPool = new WorkerPool(WorkerSource, 8, false, { wasmBinary : options.basisEncoder.wasmbinary } )
		}

		const basisuExtension = doc.createExtension(KHRTextureBasisu).setRequired(true)

		const textures = doc.getRoot().listTextures()

		let i = 0

		let numCompressed = 0

		var promises = []

		while (i < textures.length) {

			const texture = textures[i]

			const slots = listTextureSlots(texture);
			const textureLabel = texture.getURI() || texture.getName() || `${i + 1}/${doc.getRoot().listTextures().length}`;
			const prefix = `toktx:texture(${textureLabel})`;
			console.log(`${prefix}: Slots → [${slots.join(', ')}]`); // FILTER: Exclude textures that don't match (a) 'slots' or (b) expected formats.

			if (texture.getMimeType() === 'image/ktx2') {
				console.log(`${prefix}: Skipping, already KTX.`);
				return;
			} else if (texture.getMimeType() !== 'image/png' && texture.getMimeType() !== 'image/jpeg') {
				console.log(`${prefix}: Skipping, unsupported texture type "${texture.getMimeType()}".`);
				return;
			}
			else {

				console.log( slots )

				let i = 0

				while(i < slots.length ) {

					if( slots[i] == 'metallicRoughnessTexture'){

						console.log(`${prefix}: is a metalnessRoughnessTexture.`);
						return;
					}

					i++
				}
			}

			numCompressed++

			const image = texture.getImage()

			var size;


			try {

				size = texture.getSize()
			}

			catch(e){

				// The size could not be read; size stays undefined.
			}

			var width = size[0]
			var height = size[1]


			if (!image || !size) {
				console.log(`${prefix}: Skipping, unreadable texture.`);
				return;
			}

			if (options.powerOfTwo) {
				width = preferredPowerOfTwo(size[0]);
				height = preferredPowerOfTwo(size[1]);
			} else {
				if (!isPowerOfTwo(size[0]) || !isPowerOfTwo(size[1])) {
					console.log(
						`toktx: Texture dimensions ${size[0]}x${size[1]} are NPOT, and may` +
						' fail in older APIs (including WebGL 1.0) on certain devices.'
					);
				}
				width = isMultipleOfFour(size[0]) ? size[0] : ceilMultipleOfFour(size[0]);
				height = isMultipleOfFour(size[1]) ? size[1] : ceilMultipleOfFour(size[1]);
			}

			if( wPool ) {

			
				
				promises.push( new Promise( ( resolve, reject )=> {

					 wPool.queueJob(

					    './toktx.js',

					    {

					    	image: image,

					    	computedSize : [ width, height ],

					    	originalSize : size,

					    	quality: options.quality,

					    	mimeType: texture.getMimeType(),

					    	// ndarray : ndarray.
					    },

					    ( e ) => {

					        if( e.data.error == true ){

					            reject('not found')
					        }

					        else {

					        	texture.setImage(e.data.transcode).setMimeType('image/ktx2');

					        	if (texture.getURI()) {
					        		texture.setURI(FileUtils.basename(texture.getURI()) + '.ktx2');
					        	}
					        }

					        resolve()
					    },

					    this

					    // abort
					)
					
				}))
			}


			// no promise or bug, I dont kno wwhy
			else {

				// promises.push( new Promise( async (resolve, reject)=>{



					var srcPixels = await getPixels(image, texture.getMimeType())

					if (width != size[0] || height != size[1]) {

						if (width > 4096 || height > 4096) {

							width = Math.max(width / 2, 4)
							height = Math.max(height / 2, 4)
						}

						console.log('width and height are not preffered, needs a resize ')
						console.log('from ', size, ' to , ', width, ' ', height)

						var dstPixels = ndarray(new Uint8Array(width * height * 4), [width, height, 4]);

						lanczos2(srcPixels, dstPixels);

						srcPixels = dstPixels

					}

					const basisEncoder = new options.basisEncoder()

					try {

						const useSRGB = true

						const encodeUASTC = false

						const mipmaps = true

						console.log(width, height)

						const basisFileData = new Uint8Array(width * height * 10);

						basisEncoder.setCreateKTX2File(true);
						basisEncoder.setKTX2UASTCSupercompression(true);
						basisEncoder.setKTX2SRGBTransferFunc(true);

						basisEncoder.setSliceSourceImage(0, srcPixels.data, width, height, false);
						basisEncoder.setPerceptual(useSRGB);
						basisEncoder.setMipSRGB(useSRGB);
						basisEncoder.setQualityLevel(options.quality);
						basisEncoder.setUASTC(encodeUASTC);
						basisEncoder.setMipGen(mipmaps);


						const startTime = performance.now();

						console.log(' start encoding ... ')

						const numOutputBytes = basisEncoder.encode(basisFileData);

						const elapsed = performance.now() - startTime;

						console.log('elapsed ', elapsed.toFixed(2))

						console.log("numOutputBytes : ", numOutputBytes)

						if (numOutputBytes == 0) {
							console.log('encodeBasisTexture() failed!');
						} else {
							console.log('encodeBasisTexture() succeeded, output size ' + numOutputBytes);
						}

						const actualKTX2FileData = new Uint8Array(basisFileData.buffer, 0, numOutputBytes);

						texture.setImage(actualKTX2FileData).setMimeType('image/ktx2');

						if (texture.getURI()) {
							texture.setURI(FileUtils.basename(texture.getURI()) + '.ktx2');
						}

						console.log('done compressing')

					} catch (error) {
						// eslint-disable-next-line no-console
						console.error('Basis Universal Supercompressed GPU Texture encoder Error: ', error)

						throw error;

					} finally {

						basisEncoder.delete();
					}

					// resolve()
				// } ))
			}


			i++
		}

		await Promise.all(promises)

		if (numCompressed === 0) {
			console.log('toktx: No textures were found, or none were selected for compression.');
		}

		const usesKTX2 = doc
			.getRoot()
			.listTextures()
			.some((t) => t.getMimeType() === 'image/ktx2');

		if (!usesKTX2) {
			basisuExtension.dispose();
		}
	})
}



function isPowerOfTwo(value) {
	if (value <= 2) return true;
	return (value & (value - 1)) === 0 && value !== 0;
}

function preferredPowerOfTwo(value) {
	if (value <= 4) return 4;

	const lo = floorPowerOfTwo(value);
	const hi = ceilPowerOfTwo(value);

	if (hi - value > value - lo) return lo;
	return hi;
}

function floorPowerOfTwo(value) {
	return Math.pow(2, Math.floor(Math.log(value) / Math.LN2));
}

function ceilPowerOfTwo(value) {
	return Math.pow(2, Math.ceil(Math.log(value) / Math.LN2));
}

function isMultipleOfFour(value) {
	return value % 4 === 0;
}

function ceilMultipleOfFour(value) {
	if (value <= 4) return 4;
	return value % 4 ? value + 4 - (value % 4) : value;
}