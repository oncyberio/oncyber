import axios from 'axios'

import fs from 'fs-extra'

import { KHRONOS_EXTENSIONS } from '@gltf-transform/extensions';

import { NodeIO, VertexLayout} from '@gltf-transform/core'

import { datas } from './data.js'

import draco3d from 'draco3dgltf'

import { resample, prune, dedup, draco, textureCompress, textureResize, weld } from '@gltf-transform/functions'

import { BufferUtils, HTTPUtils } from '@gltf-transform/core';

// import { VertexLayout } from '@gltf/

import sharp from 'sharp';

import { VRMExtension, VRMC_materials_mtoon, VRMC_Extension, VRMC_springBone, VRMC_node_constraint }  from './VRMExtension.js'



const downloadAndSaveFile = async (url, path) => {
    const response = await axios({
        method: 'GET',
        url,
        responseType: 'arraybuffer',
    });

    await fs.writeFile(path, response.data);
};

const downloadAllFiles = async () => {
    await fs.ensureDir('sources');

    for (const entry in datas) {
        const { url, id } = datas[entry];
        const filename = url.split('/').pop().split('.')[0] + '.glb';
        const path = `sources/${id}` + '.glb';

        console.log(`Downloading ${filename}...`);
        await downloadAndSaveFile(url, path);
    }

    console.log('All files downloaded.');
};

const compressFiles = async () => {
    await fs.ensureDir('build');

    const io = new NodeIO();
    io.registerExtensions(KHRONOS_EXTENSIONS)
    io.registerExtensions([VRMExtension, VRMC_materials_mtoon, VRMC_Extension, VRMC_springBone, VRMC_node_constraint])
	.registerDependencies({
	   'draco3d.decoder': await draco3d.createDecoderModule(), // Optional.
	   'draco3d.encoder': await draco3d.createEncoderModule(), // Optional.
	});

	io.setVertexLayout(VertexLayout.SEPARATE)

    const files = await fs.readdir('sources');

    for (const file of files) {

    	console.log(file)
    	if( file != '.DS_Store'){

    		const sourcePath = `sources/${file}`;

    		const outputfilename = file.split('/').pop().split('.')[0] + '.vrm';

    		const outputPath = `build/${outputfilename}`;

    		console.log(`Compressing ${file}...`);

    		const doc = await io.read(sourcePath);

    	   
    		// const doc = container.getDocument();

    		await doc.transform(

    		    // prune(),

    		    //dedup(),

    		    // weld(),

    		    // draco(),

    		    textureResize({size: [512, 512]})
    		);
    		
    		for (const texture of doc.getRoot().listTextures()) {
    		  const buffer = await sharp(texture.getImage()).toFormat('jpeg').toBuffer();
    		  texture
    		    .setMimeType('image/jpeg')
    		    .setImage(BufferUtils.toView(buffer))
    		    .setURI(HTTPUtils.basename(texture.getURI()) + '.jpeg');

    		}
    		const binary = await io.writeBinary(doc);

    		fs.writeFileSync(outputPath, binary);
    		// await io.writeBinary(doc);

    		console.log(`Compressed ${outputfilename} saved to build folder.`);
    	}
        
    }
};

const main = async () => {
    console.log('Starting the process...');
    // await downloadAllFiles();
    await compressFiles();
    console.log('Process completed.');
};

main();