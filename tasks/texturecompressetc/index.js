// Get command-line argument for file path
const args = process.argv.slice(2);

if (args.length === 0) {

  console.error('Please specify path to file.')

  process.exit(1)
}

import { Document, NodeIO, VertexLayout } from '@gltf-transform/core'

import { toktx } from './toktx.js'

import { KHRONOS_EXTENSIONS } from '@gltf-transform/extensions'

import { metalRough, resample, dedup, prune } from '@gltf-transform/functions'

import { textureResize } from './textureresize.js'

import {

	VRMExtension, VRMC_materials_mtoon, VRMC_springBone, VRMC_Extension, VRMC_node_constraint

} from './VRMextensions.js'

import fs from 'fs'

const filePath = args[0];

const processing = async function(){

	// Load file and print contents
	try {
		

		const io = new NodeIO()
		  .registerExtensions(KHRONOS_EXTENSIONS)

	    io.registerExtensions([VRMExtension, VRMC_materials_mtoon, VRMC_springBone, VRMC_Extension, VRMC_node_constraint])

	    io.setVertexLayout(VertexLayout.SEPARATE)

	    // Read from URL.
	    const document = await io.read(filePath);


	    await document.transform(

	    	metalRough(),

	    	// Losslessly resample animation frames.
	    	resample(),

	    	// Remove duplicate vertex or texture data, if any.
	    	dedup(),

	    	// Remove unused nodes, textures, or other data.
	    	// prune(),

	    	textureResize({size: [256, 256], square: true}),

	    	toktx({
	    		mode: 'etc1s',
	    		powerOfTwo: true
	    	})

	    )

	    const parts = filePath.split('.');
	    const base = parts.slice(0, parts.length - 1).join('.');
	    const extension = parts[parts.length - 1];

	    // const newFileName = `${base}_compressed.${extension}`;
	    const newFileName = `${base}_compressed.glb`;

	    await io.write(newFileName, document);

	 //    console.log( glb)

	} catch (err) {

		console.log( err )

	  	process.exit(1)

	}

}

processing()


