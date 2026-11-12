const WEB_WORKER_SUPPORT = typeof(Worker) !== "undefined"

let supportTransferrable = null

// Checks once whether buffers can be transferred to a web worker. It starts
// (and immediately stops) a worker, so it runs on the first call, not when
// this module is imported. three/constants.js calls it when the engine's
// constants are first evaluated.
export function testTransferrable() {

	if( supportTransferrable !== null ) return supportTransferrable

	supportTransferrable = false

	if( WEB_WORKER_SUPPORT ) {

		const uInt8Array = new Uint8Array(24 * 24 * 8).map((v, i) => i);


		var worker = new Worker(new URL('./transferrableworker.js', import.meta.url))

		// Transfer the underlying buffer to a worker
		worker.postMessage(uInt8Array, [uInt8Array.buffer])


		if( uInt8Array.byteLength == 0 ) {

			console.log('transfer successfull object to webworker')

			supportTransferrable = true
		}

		worker.terminate()

		worker = null
	}

	return supportTransferrable
}

export default testTransferrable
