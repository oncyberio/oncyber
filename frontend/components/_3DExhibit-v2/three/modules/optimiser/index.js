import * as imageConversion from 'image-conversion';

import { Document, Node, Scene, WebIO, VertexLayout,vec2 , vec3 } from  '@gltf-transform/core'

import { normals, inspect } from '@gltf-transform/functions';

import { BufferUtils, HTTPUtils } from  '@gltf-transform/core'

import { prune, dedup, resample, simplify, metalRough, draco, weld, textureCompress, instance, clearNodeTransform, transformMesh } from '@gltf-transform/functions'

import { fromTranslation } from 'gl-matrix/mat4';

import { reorder, setUnlit, createRootNodes, process, addRootNodes, setInstance, lightReorder } from './reorder.js'

import { MeshoptSimplifier } from 'meshoptimizer';

import { instancetransform } from './instancer.js'

import {

	KHRDracoMeshCompression,
	KHRLightsPunctual,
	KHRMaterialsAnisotropy,
	KHRMaterialsClearcoat,
	KHRMaterialsEmissiveStrength,
	KHRMaterialsIOR,
	KHRMaterialsIridescence,
	KHRMaterialsPBRSpecularGlossiness,
	KHRMaterialsSpecular,
	KHRMaterialsSheen,
	KHRMaterialsTransmission,
	KHRMaterialsUnlit,
	KHRMaterialsVariants,
	KHRMaterialsVolume,
	KHRMeshQuantization,
	KHRTextureBasisu,
	KHRTextureTransform,
	KHRXMP,
	EXTMeshGPUInstancing,
	EXTMeshoptCompression,
	EXTTextureAVIF,
	EXTTextureWebP
} from  '@gltf-transform/extensions'

import { loadBasisEncoderModule } from './ktx/loadbasisencodermodule.js';

import { toktx } from './ktx/toktx.js'

import {

	VRMExtension, VRMC_materials_mtoon, VRMC_springBone, VRMC_Extension, VRMC_node_constraint

} from './extensions/VRMextensions.js'

import {

	FileLoader

} from 'three'

import {

	CURRENT_SPACE,

	DOWNLOAD,

	IS_FUTURE,

    RE_PORTAL_PREVIEW

} from '@3constants'

import Loader from '@3loader'


import {


    // WEB_WORKER_SUPPORT,

    // SUPPORT_TRANSFERRABLE,

    // BITMAP_SUPPORT,

    // SUPPORT_OFFSCREEN_CANVAS,

    SUPPORT_KTX_SUITE

} from '@3constants'

const list = [

		'display'
	, 	'collision'
	, 	'collision_invisible'
	,   'floor'
	,   'floor_invisible'
	, 	'portal'
	, 	'placeholder'
	,   'grass',
	,   'cameras'
	,   'reflector'
	, 	'pbr'
]

const defaultSaveOptions = {

	draco: true,

	geometrySimplifier: true,

	weld : true
}

class Optimiser {

	constructor(){

		this.isInit = false

		this.isBasisInit = false

		// this.supportKTXSuite = WEB_WORKER_SUPPORT && SUPPORT_TRANSFERRABLE && BITMAP_SUPPORT && SUPPORT_OFFSCREEN_CANVAS
	}

	async init(){

		if( this.isInit == false ) {

			await this.loadEncoderDecoder()

			this.io = new WebIO()

			const dracoDecoder = await new DracoDecoderModule()
			const dracoEncoder = await new DracoEncoderModule()

			this.io.registerExtensions(
				[
					KHRDracoMeshCompression,
					KHRLightsPunctual,
					KHRMaterialsAnisotropy,
					KHRMaterialsClearcoat,
					KHRMaterialsEmissiveStrength,
					KHRMaterialsIOR,
					KHRMaterialsIridescence,
					KHRMaterialsPBRSpecularGlossiness,
					KHRMaterialsSpecular,
					KHRMaterialsSheen,
					KHRMaterialsTransmission,
					KHRMaterialsUnlit,
					KHRMaterialsVariants,
					KHRMaterialsVolume,
					KHRMeshQuantization,
					KHRTextureBasisu,
					KHRTextureTransform,
					KHRXMP,
					EXTMeshGPUInstancing,
					EXTMeshoptCompression,
					EXTTextureAVIF,
					EXTTextureWebP
				]
			)
			.registerDependencies({
		        'draco3d.decoder': dracoDecoder, // Optional.
		        'draco3d.encoder': dracoEncoder, // Optional.
		    });

	    	this.io.registerExtensions([VRMExtension, VRMC_materials_mtoon, VRMC_springBone, VRMC_Extension, VRMC_node_constraint])

			this.isInit = true

		}


	}

	async initBasis(){

		if( this.isBasisInit == false ) {

			if( SUPPORT_KTX_SUITE ) {

				this.basisWorkerEncoder = await loadBasisEncoderModule({webWorker : true});

				this.isBasisInit = true
			}

			else {

				const { BasisEncoder } = await loadBasisEncoderModule();

				this.basisEncoder = BasisEncoder

				this.isBasisInit = true
			}
		}
	}

	async get(url, opts = {}){

		var defaultopts = Object.assign({}, defaultSaveOptions)

		var saveOptions = Object.assign(defaultopts, CURRENT_SPACE.roomParameters.saveOptions != null ? CURRENT_SPACE.roomParameters.saveOptions : {})

		await this.init()

		await this.initBasis()

		console.log(url)

		console.log('%c optimiser read' , 'background: #222; color: #bada55');

        url = await this.fetchAndReorder(url)

		const response = await fetch(url)

		const data = await response.arrayBuffer()

		const uint8 = new Uint8Array(data)

		this.documentMax = await this.io.readBinary(uint8)  // → Document

		let fixed = 0;

		// fix over tex coords

		if(  saveOptions.draco == true ) {

			for (const mesh of this.documentMax.getRoot().listMeshes()) {
				for (const prim of mesh.listPrimitives()){
					const texcoord = prim.getAttribute('TEXCOORD_0');

					if( texcoord != null ) {
						const texcoordArray = texcoord.getArray();
						for (let i = 0; i < texcoordArray.length; i++) {
							if (Math.abs(texcoordArray[i]) > 100) {
								texcoordArray[i] = 0;
								fixed++;
							}
						}
						texcoord.setArray(texcoordArray);
					}
				}
			}

			console.log(`fixed over tex coords ${fixed / 2} vertices`);
			console.log(`fixed over tex coords ${fixed / 2} vertices`);
			console.log(`fixed over tex coords ${fixed / 2} vertices`);
		}


		await this.documentMax.transform(

			metalRough(),

			// Losslessly resample animation frames.
			resample(),

			// Remove duplicate vertex or texture data, if any.
			// dedup(),

			// Remove unused nodes, textures, or other data.
			prune(
				{
				 	keepIndices: true,
				}
			),

		)

		if( opts.isFuture == true ) {

			await this.processTransformKitbash( this.documentMax )
		}

		await this.documentMax.transform(

			// Remove duplicate vertex or texture data, if any.
			dedup()

		)

		
		if( saveOptions.weld == true  ) {

			await this.documentMax.transform(

				weld({tolerance: 0.0001}),
			)
		}

		if( saveOptions.geometrySimplifier == true  ) {

			await this.documentMax.transform(

				simplify(

					{ simplifier: MeshoptSimplifier, ratio: 0.0, error: 0.001, lockBorder: true }
				)
			)

		}

		if( saveOptions.draco == true  ) { 

			await this.documentMax.transform(

				draco()
			)
		}

		this.documentMid =  this.documentMax.clone()

		this.documentLow =  this.documentMax.clone()

		console.log('%c optimiser optimise' , 'background: #222; color: #bada55');

		await this.optimise( this.documentMax, 4096 )

		await this.optimise( this.documentMid, 2048 )

		await this.optimise( this.documentLow, 1024 )

		// lod file 

		if( opts.isFuture && false ) {

			const loddocument = this.documentLow.clone()

			await loddocument.transform(

				simplify(

					{ simplifier: MeshoptSimplifier, ratio: 0.9, error: 1 }
				)
			)

			const root = loddocument.getRoot()


			// remove texture from lod
			for (const texture of root.listTextures()) {
			    texture.dispose()
			}

			const list = root.listNodes()

			let i = 0

			while( i < list.length ) {

				const node = list[i]


				if( node.getName().includes('collision') ){

					node.detach()
					
				}

				i++
			}

			const lodfile 			= await this.prepareFile( loddocument, 'lod' )
			
		}

		this.documentCompressedLow = this.documentLow.clone()

		await this.documentCompressedLow.transform(

			toktx({

				basisEncoder : SUPPORT_KTX_SUITE ? this.basisWorkerEncoder : this.basisEncoder,

				mode: 'etc1s',

				quality: 255,

				powerOfTwo: true
			})
		)

		console.log('%c optimiser download' , 'background: #222; color: #bada55');

		const fileHigh 			= await this.prepareFile( this.documentMax, 'max' )

		const fileMid 			= await this.prepareFile( this.documentMid, 'mid' )

		const fileLow 			= await this.prepareFile( this.documentLow, 'low' )

		const lowCompressed 	= await this.prepareFile( this.documentCompressedLow, 'lowCompressed' )

		return {

			low  : fileLow,

			mid  : fileMid,

			high : fileHigh,

			lowCompressed : lowCompressed
		}

		console.log('%c done' , 'background: #222; color: #bada55');
	}

	getObjectByName( root, name ){

		const list = root.listNodes()

		var tempnode = null

		let i = 0

		while( i < list.length ) {

			const node = list[i]

			if( node.getName() == name ){

				tempnode = node
			}

			i++
		}

		return tempnode
	}

	isValidNode( name ){

		let i = 0

		let isValid = false

		while( i < list.length ) {

			if( name == list[i] ){

				isValid = true
			}

			i++
		}

		return isValid
	}

	checkIfneedsProcessing( doc ){

		const root = doc.getRoot()

		const defaultScene = root.getDefaultScene()

		const firstchilds = defaultScene.listChildren()

		let i = 0

		var needsProcessing = false


		while( i < firstchilds.length ) {

			console.log( 'NODE : ', firstchilds[i].getName() )

			if( this.isValidNode( firstchilds[i].getName().toLowerCase() ) == false ){

				console.log('THIS NODE ISNT VALID : ', firstchilds[i].getName() )

				needsProcessing = true
			}

			i++
		}

		return needsProcessing
	}

	async fetchAndReorder( url ){

		if ( CURRENT_SPACE?.roomParameters?.isFuture ) {

            return url
        }

		await this.init()

        const response = await fetch(url)

        const data = await response.arrayBuffer()

        const uint8 = new Uint8Array(data)

        const glbdocument = await this.io.readBinary(uint8)

        var reorderdoc = glbdocument;

        const root = reorderdoc.getRoot();


        if( this.checkIfneedsProcessing(reorderdoc) == true ){

            reorderdoc = await reorder(reorderdoc)
        }
        else {

            console.log('does not need a re-order but unlit, and instancing if needed')

            const defaultScene = root.getDefaultScene()

			await setUnlit(reorderdoc, defaultScene)

            await reorderdoc.transform(

				metalRough(),

				resample(),

				dedup(),

				prune({
		            keepIndices: true,
		        })

				// draco()
			);

			await setInstance(reorderdoc)

            await reorderdoc.transform(

				dedup(),
				
				prune({
		            keepIndices: true,
		        })
			);

			await lightReorder( reorderdoc )

        }


        // const report = await inspect(reorderdoc)

    	const defaultScene = root.getDefaultScene()


       // const nodes = defaultScene.listChildren().map((node) => context.nodeIndexMap.get(node)!);

        // console.log( report )
        // console.log( report )
        // console.log( report )

        const input = await this.io.writeBinary(reorderdoc)

        // const input2 = await this.io.writeJSON(reorderdoc)

        const file = new Blob([input], {type: "model/gltf+binary;charset=utf-8"})

    	if( DOWNLOAD ) {

    		var a = document.createElement("a"), url = URL.createObjectURL(file);

            a.href = url;

            a.download = 'test.glb';

    		document.body.appendChild(a);

    		a.click();

    		document.body.removeChild(a);

    		a = null
    	}

        return URL.createObjectURL(file)
	}

	async optimise( document, size ){

		await document.transform(

			textureCompress({resize: [size, size]}),
		);
	}

	async prepareFile( doc, quality ){

		const input = await this.io.writeBinary( doc );

		var file = new Blob([input], {type: "model/gltf+binary;charset=utf-8"});

		if( DOWNLOAD ) {

			var a = document.createElement("a"), url = URL.createObjectURL(file);

	        a.href = url;

	        a.download = 'test' + quality + '.glb';

			document.body.appendChild(a);

			a.click();

			document.body.removeChild(a);

			a = null
		}

		// const reader = new FileReader();

		// reader.readAsDataURL(file);

		return file

	}

    /**
     * @typedef { object } GetSceneDataOpts
     * @property {string} url
     *
     * @param { stGetSceneDataOptsring } opts
     * @return { Promise<import('@uitypes/destinations.js').UploaderSceneData> }
     */
    async fetchSceneData({ url }){

		await this.init()

		console.log('%c optimiser getSceneData' , 'background: #222; color: #bada55');

		const response = await fetch(url)

		const data = await response.arrayBuffer()

		const uint8 = new Uint8Array(data)

		const doc = await this.io.readBinary(uint8)  // → Document

        return this.getPlaceholders(doc)
	}

	async optimiseVRM( url ){

		await this.init()

		// await this.initBasis()

		const response = await fetch(url)

		const data = await response.arrayBuffer()

		const uint8 = new Uint8Array(data)

		this.io.setVertexLayout(VertexLayout.SEPARATE)

		const doc = await this.io.readBinary(uint8)

		await this.optimise( doc, 1024 )

		// await this.optimise( documentCompressedLow, 256 )

    	// for (const texture of doc.getRoot().listTextures()) {

    	// 	const mime = texture.getMimeType()
    	// 	const image = texture.getImage()

    	// 	const blob = new Blob([image], { type: mime });

    	// 	const options = {
    	// 	    type: 'image/jpeg',
    	// 	    quality: 0.7,
    	// 	}

    	// 	try {
    	// 		// const dataUrl = await imageConversion.filetoDataURL(imageBlob)
    	// 	    const jpegBlob = await imageConversion.compress(blob, options)

    	// 	    const buffer = await jpegBlob.arrayBuffer()

    	// 	    const view = BufferUtils.toView(new Uint8Array(buffer))

    	// 	    texture
	    //     	    .setMimeType('image/jpeg')
	    //     	    .setImage(view)


    	// 	  } catch (error) {

    	// 	    console.error('Conversion failed:', error);
    	// 	  }

    	// }	

    	// const documentCompressedLow =  doc.clone()

    	// bug not cloning extras...
    	// documentCompressedLow.getRoot().extras = doc.getRoot().extras
		

  		//       await documentCompressedLow.transform(

		// 	toktx({

		// 		basisEncoder : SUPPORT_KTX_SUITE ? this.basisWorkerEncoder : this.basisEncoder,

		// 		mode: 'etc1s',

		// 		quality: 255,

		// 		powerOfTwo: true
		// 	})
		// );


		const input = await this.io.writeBinary(doc)

		const file = new Blob([input], {type: "model/gltf+binary;charset=utf-8"})

		// const inputLow = await this.io.writeBinary(documentCompressedLow)

		// const fileCompressed = new Blob([inputLow], {type: "model/gltf+binary;charset=utf-8"})

		// if( DOWNLOAD ) {

		// 	var a = document.createElement("a"), url = URL.createObjectURL(file);

	 //        a.href = url;

	 //        a.download = url + '.vrm';

		// 	document.body.appendChild(a);

		// 	a.click();

		// 	document.body.removeChild(a);

		// 	a = null
		// }




		this.io.setVertexLayout(VertexLayout.INTERLEAVED)

        return { file : file, url : URL.createObjectURL(file) }
	}

    /**
     *
     * @param { Document } doc
     * @returns { import('@uitypes/destinations.js').UploaderSceneData }
     */
    getPlaceholders(doc) {

        const root = doc.getRoot()

		const defaultScene = root.getDefaultScene()

        let placeholderNode = null

        let portalNode = null

		defaultScene.listChildren().forEach(node => {

            const name = node.getName()

            if(name === 'placeholder') {

                placeholderNode = node
            }

            else if(name === 'portal') {

                portalNode = node
            }
        })


        let placeholders = []

        let portals = []

        placeholderNode?.listChildren()?.forEach(it => {

            const position = it.getTranslation()

            const rotation = it.getRotation()

            placeholders.push({ position, rotation })

        })

        portalNode?.listChildren().forEach(it => {

            const name = it.getName()

            let match = RE_PORTAL_PREVIEW.exec(name);

                if (match != null) {

                    portals.push(name)

                }
        })

		return {
            placeholders,
            portals,
        }
    }

    async transformRoughness( url ){

    	if( this.isInit == false ) {

			await this.init()
		}

    	const response = await fetch(url)

    	const data = await response.arrayBuffer()

    	const uint8 = new Uint8Array(data)

    	const glbdocument = await this.io.readBinary(uint8)

    	await glbdocument.transform(

    		// Losslessly resample animation frames.
    		metalRough()

    	);

    	const input = await this.io.writeBinary( glbdocument );

    	// console.log(input)

    	return new Blob([input], {type: "model/gltf+binary;charset=utf-8"});

    }

    async loadEncoderDecoder(){

		const decoder = await this._loadLibrary( '/draco/draco_decoder.js', 'text' )

		await this._loadScript( URL.createObjectURL( new Blob( [ decoder ] ) ) );

		const encoder = await this._loadLibrary( '/draco/draco_encoder.js', 'text' )

		await this._loadScript( URL.createObjectURL( new Blob( [ encoder ] ) ) );
	}

	async _loadLibrary( url, responseType ) {

		const loader = new FileLoader( this.manager );
		loader.setPath( this.decoderPath );
		loader.setResponseType( responseType );
		loader.setWithCredentials( this.withCredentials );

		return new Promise( ( resolve, reject ) => {

			loader.load( url, resolve, undefined, reject );

		} );

	}


	async processKitBash( url ){

		await this.init()

		const response = await fetch(url)

		const data = await response.arrayBuffer()

		const uint8 = new Uint8Array(data)

		const glbdocument = await this.io.readBinary(uint8)

	 	await this.processTransformKitbash( glbdocument )

        const input = await this.io.writeBinary(glbdocument)

        const file = new Blob([input], {type: "model/gltf+binary;charset=utf-8"})



    		// var a = document.createElement("a"), url = URL.createObjectURL(file);

      //       a.href = url;

      //       a.download = 'test.glb';

    		// document.body.appendChild(a);

    		// a.click();

    		// document.body.removeChild(a);

    		// a = null


        return URL.createObjectURL(file)

		// await setUnlit(glbdocument, defaultScene)

	}

	async processTransformKitbash( doc ) {

		// await doc.transform(unweld());

	    const root = doc.getRoot();

	    const scenes = root.listScenes()

        const defaultScene = root.getDefaultScene() || root.listScenes()[0]

        const childrens = defaultScene.listChildren()

        let i = 0

        while( i < childrens.length ) {

        	this.processKitBashChild( childrens[i] )

        	i++
        }

        await doc.transform(

        	normals(
        		{
        			overwrite: false
        		}
    		)

    	
        );

	}


	// https://stackoverflow.com/a/23709352/1314762
	computeNormal(a, b, c) {
		const A = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
		const B = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
		const n = [
			A[1] * B[2] - A[2] * B[1],
			A[2] * B[0] - A[0] * B[2],
			A[0] * B[1] - A[1] * B[0],
		];
		return vec3.normalize([0, 0, 0], n);
	}

	processKitBashChild( child ){

		let i = 0

		const childs = child.listChildren()

		const bounds = []

		const attributes = []

		while(i < childs.length ) {

			const thatchild = childs[i]

			const mesh = thatchild.getMesh()

			transformMesh(mesh, thatchild.getWorldMatrix())

			thatchild.setTranslation([0,0,0])
			thatchild.setScale([1,1,1])
			thatchild.setRotation([0,0,0,1])

    		for (const prim of mesh.listPrimitives()) {

				const attribute = prim.getAttribute('POSITION');

				attributes.push(attribute)

			}

			i++
		}

		child.setTranslation([0,0,0])
		child.setScale([1,1,1])
		child.setRotation([0,0,0,1])

		const firstBox = bounds[0]

		const globalBox = this.flatBounds(attributes, 3)

		const globalCenter = {

			x: (globalBox.max[0] + globalBox.min[0]) * 0.5,
			y: (globalBox.max[1] + globalBox.min[1]) * 0.5,
			z: (globalBox.max[2] + globalBox.min[2]) * 0.5,
		}

		i = 0

		while( i < childs.length ) {

			const mesh = childs[i].getMesh()

			const currentBox = bounds[ mesh.boxIndex ]

			transformMesh(mesh, fromTranslation([], [-globalCenter.x, -globalBox.min[1], -globalCenter.z]));

			i++
		}

	}

	flatBounds(accessors, elementSize) {
		const min  = new Array(elementSize).fill(Infinity);
		const max  = new Array(elementSize).fill(-Infinity);

		const tmpMin = [];
		const tmpMax = [];


		for (const accessor of accessors) {
			accessor.getMinNormalized(tmpMin);
			accessor.getMaxNormalized(tmpMax);
			for (let i = 0; i < elementSize; i++) {
				min[i] = Math.min(min[i], tmpMin[i]);
				max[i] = Math.max(max[i], tmpMax[i]);
			}
		}

		return { min, max };
	}

	async _loadScript( src ) {

	  // var prevScript = document.getElementById( 'decoder_script' );
	  // if ( prevScript !== null ) {
	  //   prevScript.parentNode.removeChild( prevScript );
	  // }
	  var head = document.getElementsByTagName( 'head' )[ 0 ];
	  var script = document.createElement( 'script' );
	  // script.id = 'decoder_script';
	  script.type = 'text/javascript';
	  script.src = src;
	  return new Promise( function ( resolve ) {
	    script.onload = resolve;
	    head.appendChild( script );

	  });
	};
}

export default new Optimiser
