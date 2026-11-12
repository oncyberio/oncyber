import {
	lanczos2,
} from 'ndarray-lanczos';

import ndarray from 'ndarray';

importScripts('/basis/basis_encoder.js')

// console.log(BASIS)


function getPixels(path, type, callback) {

	return new Promise(async(resolve, reject) => {

		let p = path;

		let blob;

		// Construct a Blob URL for Uint8Array inputs.
		if (path instanceof Uint8Array) {
			if (typeof type !== 'string') {
				throw new Error('Type must be given for Uint8Array image data');
			}
			blob = new Blob([path], {
				type: type
			});
			// p = URL.createObjectURL(blob);
		}

		// Decode image with Canvas API.
		const img = await createImageBitmap(blob);
		// img.crossOrigin = 'anonymous';
		// img.onload = function() {
			// URL.revokeObjectURL(p);

		const canvas = new OffscreenCanvas(img.width, img.height)
	
		canvas.width = img.width;
		canvas.height = img.height;
		const context = canvas.getContext('2d');
		context.drawImage(img, 0, 0);
		const pixels = context.getImageData(0, 0, img.width, img.height);
		resolve(ndarray(new Uint8Array(pixels.data), [img.width, img.height, 4], [4, 4 * img.width, 1], 0));
		// };
		// img.onerror = (err) => {
		// 	// URL.revokeObjectURL(p);
		// 	resolve(err);
		// };
		// img.src = p;
	})

}

var controller, signal, url;

let decoderPending;
let decoderConfig;
let BasisEncoder;
let BasisFile;
let KTX2File;
let initializeBasis;
let isInit = false

self.addEventListener(

	"message",

	async function(e) {

		console.log(e.data)

		if (e.data.init == true) {

			console.log('INIT WEB WORKER ')

			decoderConfig = e.data

			decoderPending = new Promise((resolve) => {

				BASIS(decoderConfig).then((module) => {

					const { BasisFile, KTX2File, initializeBasis, BasisEncoder } = module;
					initializeBasis();
					isInit = true
					resolve({ BasisFile, KTX2File, BasisEncoder });

				});

			})

			return

		}

	
		decoderPending.then( async ( opts ) => {

			const BasisEncoder = opts.BasisEncoder

			const image = e.data.image

			const size = e.data.originalSize

			const width = e.data.computedSize[0]

			const height = e.data.computedSize[1]

			const mimeType = e.data.mimeType

			var srcPixels = await getPixels(image, mimeType)

			if (width != size[0] || height != size[1]) {

				if (width > 4096 || height > 4096) {

					width = Math.max(width / 2, 4)
					height = Math.max(height / 2, 4)
				}

				var dstPixels = ndarray(new Uint8Array(width * height * 4), [width, height, 4]);

				lanczos2(srcPixels, dstPixels);

				srcPixels = dstPixels

			}

			console.log( width, height )
			console.log( width, height )
			console.log( width, height )

			console.log('THREAD ENCODING , ' , BasisEncoder )
			console.log( ' SRC PIXELS , ' , srcPixels )

			const basisEncoder = new BasisEncoder()

			try {

				console.log('try encoding... ')

				const basisFileData = new Uint8Array(width * height * 10);

				basisEncoder.setCreateKTX2File(true);
				basisEncoder.setKTX2UASTCSupercompression(true);
				basisEncoder.setKTX2SRGBTransferFunc(true);
				basisEncoder.setSliceSourceImage(0, srcPixels.data, width, height, false);
				basisEncoder.setPerceptual(true);
				basisEncoder.setMipSRGB(true);
				basisEncoder.setQualityLevel(e.data.quality);
				basisEncoder.setUASTC(false);
				basisEncoder.setMipGen(true);

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

				self.postMessage({

					transcode: actualKTX2FileData

				})
					// texture.setImage(actualKTX2FileData).setMimeType('image/ktx2');

				// if (texture.getURI()) {
				//   texture.setURI(FileUtils.basename(texture.getURI()) + '.ktx2');
				// }

				// console.log('done compressing')

			} catch (error) {

				console.log('error .... ')
				console.log(error)
				// eslint-disable-next-line no-console
				// console.error('Basis Universal Supercompressed GPU Texture encoder Error: ', error)

				self.postMessage({
					error: true
				})

			} finally {

				basisEncoder.delete();
			}
		})

	},

	false

);