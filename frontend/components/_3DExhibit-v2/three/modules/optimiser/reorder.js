

import instanceOptimiser from './instance.js'

import { Document, Scene, Material }  from  '@gltf-transform/core'

import { resample, dedup, prune, metalRough, draco } from '@gltf-transform/functions'

// import { KHRMaterialsUnlit, Unlit } from '@gltf-transform/extensions'

import { KHRMaterialsUnlit, Unlit } from  '@gltf-transform/extensions'
// Create an Extension attached to the Document.
// var unlitExtension

// var unlit;

const list = [

		'display'
	, 	'collision'
	, 	'collision_invisible'
	,   'floor'
	,   'floor_invisible'
	, 	'portal'
	, 	'placeholder'
	,   'grass'
	// , 	'pbr'

]

function checknameduplicate( root ){


	root.traverse((child)=>{

		const name = child.getName()

		let i = 0

		while( i < list.length ) {

			if( name == list[i]){

				console.log('DUPLICATE ', name )

				child.setName(name + '_' + Math.random())

				console.log('RENAMED INTO ' + child.getName())

			}

			i++
		}

	})
}

var nodes = {}

var animations = []

var basicMaterial = null

export function createRootNodes( doc, scene ){

	let i = 0

	const root = doc.getRoot()

	while(i < list.length){

		const alreadyCreated = getObjectByName( doc.getRoot(), list[i] )

		var node;

		// console.log( list[i], ' already created ... ')

		if( alreadyCreated != null ){

			node = alreadyCreated
		}

		else {

			node = doc.createNode(list[i])
		}

		node.setTranslation([0,0,0])

		nodes[list[i]] = node

		i++
	}

	console.log(nodes)

	return nodes

}

function getObjectByName( root, name ){

	const list = root.getDefaultScene().listChildren()

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

export function addRootNodes( scene ){

	let i = 0

	while(i < list.length){

		nodes[list[i]].detach()

		scene.addChild( nodes[list[i]]  )

		i++
	}
}

function getRoot(roots, name){

	const lower = name.toLowerCase()

	if(lower.includes('placeholder')){

		return roots.placeholder
	}

	// else if(lower.includes('pbr')){

	// 	return roots.pbr
	// }

	else if(lower.includes('floor') && lower.includes('invisible')){

		return roots.floor_invisible
	}

	else if(lower.includes('collision') && lower.includes('invisible')){

		return roots.collision_invisible
	}

	else if(lower.includes('portal_preview')){
		return roots.portal
	}

	else if(lower.includes('floor')){

		return roots.floor
	}

	else if(lower.includes('collision')) {

		return roots.collision

    } else if (lower.includes('grass')) {

        return roots.grass
    }

	else {

		return roots.display
	}

}

function isNodeSimilar( node ){

	let i = 0

	var isSimilar = false

	while( i < animations.length ) {

		if( node.equals(animations[i].node) ){

			isSimilar = true
		}

		i++
	}

	return isSimilar
}

async function getAnimationMeshes( root ){

	const animationsList = root.listAnimations()

	animations 		= []

	let g = 0

	while(g < animationsList.length ) {

		const channels = animationsList[g].listChannels()

		let h = 0

		while ( h < channels.length ) {

			const channel = channels[h]

			const node 	  =  channel.getTargetNode()

			if( !isNodeSimilar(node) ){

				const parent  =  node.getParentNode()

				if( parent != null ) {

					animations.push({

						node: node,

						parent: parent
					})

				}
			}

			h++
		}

		g++

	}
}

function checkIfAnimated(node){


	let c = 0

	while( c < animations.length ){

		if( node == animations[c].node ){

			return true
		}

		c++
	}

	return false
}

function checkIfroot(node, rootNodes){

	// console.log( rootNodes )

	let c = 0

	while( c < rootNodes.length ){

		if( node.getName() == rootNodes[c].getName() ){

			return true
		}

		c++
	}

	return false
}

export function process( scene, rootNodes, debug = false ){

	let nodes = []

	scene.traverse( ( child )=>{

		const isAnimated = checkIfAnimated( child )

		if(isAnimated == false ){

			child.tempTranslation = child.getWorldTranslation()

			child.tempRotation = child.getWorldRotation()

			child.tempScale = child.getWorldScale()

			nodes.push(child)
		}

		if( isAnimated ) {

			console.log( 'is animated : ',  child.getName())
		}

	})

	let c = 0

	while( c < nodes.length){

		const node = nodes[c]

		if( node.tempTranslation ){

			var name = node.getMesh() ? node.getMesh().getName() : node.getName()

			const datRoot = getRoot(rootNodes, name)

			if(datRoot.getName() == node.getName()){

				c++

				continue;
			}

			node.setTranslation(node.tempTranslation)

			node.setRotation(node.tempRotation)

			node.setScale(node.tempScale)

			node.tempTranslation 	= null
			node.tempRotation 		= null
			node.tempScale 			= null

			node.detach()

			datRoot.addChild(node)

		}

		else {

			var name = node.getMesh() ? node.getMesh().getName() : node.getName()

			const datRoot = getRoot(rootNodes, name)


			if(datRoot.getName() == node.getName()){

				c++

				continue;
			}

			node.detach()

			datRoot.addChild(node)

			console.log('no temp translation', node.getName())
		}

		c++
	}
}

function process2( childs, rootNodes ){


	let c = 0

	while( c < childs.length){

		if(checkIfAnimated(childs[c]) == true){

			// console.log("ANIMATED ??? ")
			// console.log(childs[c].getName())

			c++

			continue;
		}

		// console.log('CONTINUE ?.?? ', childs[c].getName())

		process2(childs[c].listChildren(), rootNodes)

		const node = childs[c]

		// console.log(node.getName())

		node.tempTranslation = node.getWorldTranslation()

		node.tempRotation = node.getWorldRotation()

		node.tempScale = node.getWorldScale()

		c++
	}

	c = 0

	while( c < childs.length){

		const node = childs[c]

		if(node.tempTranslation){

			var name = node.getName() 

			const mesh = node.getMesh()

			const meshName = mesh ? mesh.getName() : ''

			if(name == ''){

				name = meshName
			}

			const datRoot = getRoot(rootNodes, name)

			if(datRoot.getName() == node.getName()){

				c++

				continue;
			}

			node.setTranslation(node.tempTranslation)

			node.setRotation(node.tempRotation)

			node.setScale(node.tempScale)

			node.detach()

			datRoot.addChild(node)

		}
		
		c++
	}
}



function deletePrimitivesList( mesh, list = [] ){

	const primitives = mesh.listPrimitives()

	let i = 0

	while ( i < primitives.length ) {

		const primitive = primitives[i]

		let c = 0

		while(c < list.length ) {

			const primName = list[c]

			const prim = primitive.getAttribute(primName)

			if( prim != null ) {

				prim.dispose()
			}

			c++
		}

		i++
	}

}

function cleanAttributes( isCollisionDisplay = false  ) {

	// nodes.display.traverse((node)=>{

	// 	const mesh = node.getMesh()

	// 	if ( mesh != null ) {

	// 		deletePrimitivesList(mesh, ['NORMAL'])
	// 	}
	// })

	if( isCollisionDisplay == false ){

		// nodes.collision.traverse((node)=>{

		// 	const mesh = node.getMesh()

		// 	if ( mesh != null ) {

		// 		deletePrimitivesList(mesh, ['TEXCOORD_0', 'TEXCOORD_1', '' ])
		// 	}

		// })

		nodes.collision_invisible.traverse((node)=>{

			const mesh = node.getMesh()


			if ( mesh != null ) {

				deletePrimitivesList(mesh, ['TEXCOORD_1', 'NORMAL' ])
			}

		})

		nodes.floor_invisible.traverse((node)=>{

			const mesh = node.getMesh()

			if ( mesh != null ) {

				deletePrimitivesList(mesh, ['TEXCOORD_1', 'NORMAL' ])
			}

		})
	}
}

function containsPBR( array ){

	let contains = false

	let i = 0

	while(i < array.length ) {

		if( array[i].includes('pbr') ){

			contains = true
		}

		i++
	}

	return contains
}


function traverseUnlit( doc, input ) {

	let childrens = input.listChildren()

	let i = 0

	while( i < childrens.length ) {

		const child = childrens[i]

		const currentMesh  	= child.getMesh()

		const isPBR 		= child.getName().toLowerCase().includes('pbr') || (( currentMesh == null ) ? false : currentMesh.getName().toLowerCase().includes('pbr'))
	
		if( isPBR ) {

			child.traverse(( childbis )=>{

				const name = childbis.getName()

				if( name.toLowerCase().includes('pbr') == false ){

					childbis.setName(name + '_pbr')
				}

				const mesh = childbis.getMesh()

				if( mesh && mesh.getName().toLowerCase().includes('_pbr') == false ) {

					mesh.setName(mesh.getName() + '_pbr')
				}

			})

			// console.log('do nothing ')

			// console.log(child.getName())

			// if( currentMesh ) {
				
			// 	console.log( currentMesh.getName() )
			// }

		}

		else {

			traverseUnlit( doc, child )

			if( currentMesh != null ) {

				// Create an Extension attached to the Document.
				const unlitExtension = doc.createExtension(KHRMaterialsUnlit);

				// Create an Unlit property.
				const unlit = unlitExtension.createUnlit();

				const material = doc.createMaterial('myMaterial')
				    .setBaseColorFactor([1, 1, 1, 1]) // RGBA

				// Attach the property to a Material.
				material.setExtension('KHR_materials_unlit', unlit)

				let c = 0

				const prims = currentMesh.listPrimitives()

				while( c < prims.length ) {

					const prim = prims[c]

					const mat = prim.getMaterial()

					if( mat != null && mat.getName().toLowerCase().includes('pbr') == false ) {

						// console.log( 'set UNLIT ' )
						// console.log( mat.getName() )
						// console.log( currentMesh.getName() )
						// console.log( child.getName() )


						if( mat.getExtension('KHR_materials_unlit') == null ) {

							mat.setExtension('KHR_materials_unlit', unlit)

						}

						deletePrimitivesList(currentMesh, ['TEXCOORD_1'])
					}


					c++
				}
			}
		}

		i++
	}
}


function setUnlitExtensions( doc, scene ){

	traverseUnlit( doc, scene )
}

function analyser( node ){

	node.traverse((child)=>{

		const mesh  = child.getMesh()

		if ( mesh != null ) {

			const prims = mesh.listPrimitives()

			let c = 0

			while( c < prims.length ) {

				const prim = prims[c]

				c++
			}
		}
	})
}

function cleanUnusedNode( root ){

	const cameras = root.listCameras()

	let i = 0

	while(i < cameras.length ) {

		const camera = cameras[i]

		if(camera.getParentNode){


			camera.detach()

			camera.dispose()
		}

		i++
	}
}

function buildcollision( doc, rootNodes ){

	let collisionChildrens = rootNodes.collision.listChildren()

	let invisibleCollisionsChildrens = rootNodes.collision_invisible.listChildren()

	console.log("collisionChildrens.length")
	console.log(collisionChildrens.length)
	console.log("invisibleCollisionsChildrens.length")
	console.log(invisibleCollisionsChildrens.length)

	if(
		collisionChildrens.length == 0
		&& invisibleCollisionsChildrens.length == 0
	) {

		let displayChilds = rootNodes.display.listChildren()

		const newNodeList = []

		const nodeList = [ rootNodes.display, rootNodes.floor  ]

		let g = 0

		while(g < nodeList.length){

			nodeList[g].traverse((displayChild)=>{

				const mesh = displayChild.getMesh()

				if(mesh != null){


					const name = displayChild.getName()

					const primitives = mesh.listPrimitives()

					const newNode = doc.createNode().setMesh( displayChild.getMesh() )

					// console.log(name)


					newNode.setName(name + '_collision_invisible')

					newNode.setTranslation(displayChild.getWorldTranslation())

					newNode.setRotation(displayChild.getWorldRotation())

					newNode.setScale(displayChild.getWorldScale())

					newNodeList.push(newNode)

				}
			})

			g++
		}


		let i = 0

		while(i < newNodeList.length ) {

			rootNodes.collision_invisible.addChild(newNodeList[i])

			i++
		}
	}
}

function log(root ){

	let c = 0

	let i = 0

	const scenes = root.listScenes()


	console.log('start : ') 

	while( c < scenes.length ) {

		const scene = scenes[c]

		console.log('scene number : ', c )

		const childs = scene.listChildren()


		i = 0

		while(i < childs.length ) {

			console.log('in root  : ', childs[i].getName(), ' and childs : ', childs[i].listChildren().length )

			i++
		}

		c++
	}

	
	console.log('end ;')
}

export async function lightReorder( doc ){

	nodes = {}

	const root = doc.getRoot();

	// debugger

	// log(root)

	const defaultScene = root.getDefaultScene()

	const rootNodes = createRootNodes(doc, defaultScene )

	addRootNodes( defaultScene )


	// log(root)

	// debugger

	const childrens = defaultScene.listChildren()

	let i = 0

	while(i < childrens.length ) {

		let isARoot = false

		for (const node in rootNodes) {
		  
			if( rootNodes[node] == childrens[i] ){

				isARoot = true
			}

		}

		if( isARoot == false ) {

			childrens[i].detach()

			rootNodes.display.addChild( childrens[i] )
		}

		i++
	}


	log(root)

	// debugger
}

export async function setInstance( doc ){

	await instanceOptimiser( doc )
}

async function reorderDestinations( doc ){



	nodes = {}

    const root = doc.getRoot();

    const defaultScene = root.getDefaultScene()

    setUnlitExtensions( doc, defaultScene  )

    await doc.transform(

        prune(
        	{
        		keepIndices: true
        	}
        )
    )

    getAnimationMeshes(root)

    checknameduplicate( defaultScene )

    const listScene = root.listScenes()

    const rootNodes = createRootNodes(doc, defaultScene )

    addRootNodes( defaultScene )

    process2(defaultScene.listChildren(), rootNodes )

    var isCollisionDisplay = false

    if( rootNodes.collision.listChildren().length == 0     &&  rootNodes.collision_invisible.listChildren().length == 0 ) {

        isCollisionDisplay = true
    }

    buildcollision( doc, rootNodes )

    cleanAttributes( isCollisionDisplay )

   	await instanceOptimiser( doc )

	process2(defaultScene.listChildren(), rootNodes, true )

    addRootNodes( defaultScene )

    cleanUnusedNode( root )



    await doc.transform(

    	metalRough(),

    	// Losslessly resample animation frames.
    	resample(),

    	// Remove duplicate vertex or texture data, if any.
    	dedup(),

    	// Remove unused nodes, textures, or other data.
    	prune({

    		keepIndices: true
    	}),

    	// draco()

    )



    return doc
}

export const reorder = reorderDestinations
export const setUnlit = setUnlitExtensions