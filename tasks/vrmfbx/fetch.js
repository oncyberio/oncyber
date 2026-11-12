const fetch = require('node-fetch');

var fs = require('fs');

const fileToArrayBuffer = require('file-to-array-buffer')

function toArrayBuffer(buf) {
    const ab = new ArrayBuffer(buf.length);
    const view = new Uint8Array(ab);
    for (let i = 0; i < buf.length; ++i) {
        view[i] = buf[i];
    }
    return ab;
}

async function fetchBuffer( path ){

	console.log('path ',path)

	var response 	= null

	var data 		= null


	data = JSON.parse(fs.readFileSync(path)); 



	// console.log(data)

	// const res = await fileToArrayBuffer(data)

	return data
}

module.exports = fetchBuffer