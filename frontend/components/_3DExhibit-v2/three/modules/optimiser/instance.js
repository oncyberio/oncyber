// import { instance, resample, dedup, prune } from '@gltf-transform/functions'

import { instance } from '@gltf-transform/functions'


var animations = []

var storeAnimations = null

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

async function takeOutAnimation( root ){

	const animationsList = root.listAnimations()

	storeAnimations = []

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

					parent.removeChild(node)

				}
			}

			h++
		}

		storeAnimations.push( animationsList[g] )

		root.removeRef('animations', animationsList[g] )

		g++

	}
}

async function takeInAnimation( root ){

	let i = 0

	while(i < animations.length ) {

		const animation = animations[i]

		animation.parent.addChild(animation.node)

		i++
	}

	let c = 0

	while( c < storeAnimations.length ) {

		root.addRef('animations', storeAnimations[c] )

		c++
	}

}

function getRootObjectByName( root, name ){

	const scene = root.getDefaultScene()

	const list = scene.listChildren()

	var placeholderNode = null

	let i = 0

	while( i < list.length ) {

		const node = list[i]

		if( node.getName() == name ){

			placeholderNode = node
		}

		i++
	}

	return placeholderNode
}

function getObjectByName( root, name ){

	const list = root.listNodes()

	var placeholderNode = null

	let i = 0

	while( i < list.length ) {

		const node = list[i]

		if( node.getName() == name ){

			placeholderNode = node
		}

		i++
	}

	return placeholderNode
}

var parentMap = []

function storeAndRemove(root, nodeNames){

	let i = 0

	while( i < nodeNames.length ) {

		const name      = nodeNames[i]

		const node 	    = getRootObjectByName( root, name)

		if( node != null ) {

			const parent = node.getParentNode() || root.getDefaultScene()

			parentMap.push(
				{
					name: node.getName(),

					node: node,

					parent: parent
				}
			)

			if( parent != null ) {

				parent.removeChild( node )
				// node.detach()
			}
		}


		i++
	}


}

function restore( name = null ){

	let i = 0

	// console.log( "parentMap..." )
	// console.log( parentMap)

	// if(name == 'grass'){

	// }

	while(i < parentMap.length ) {

		const node   = parentMap[i].node

		const parent = parentMap[i].parent

		if( name == null ) {

			if( parent != null ) {

				node.getParentNode()?.removeChild(node)

				parent.addChild( node )

				// parentMap[i].node = parent

			}
		}

		else {

			if( parent != null && name == node.getName()) {

				console.log('restoring ... ', name, ' to : ', parent.getName())

				node.getParentNode()?.removeChild(node)

				parent.addChild( node )

				// parentMap[i].parent = parent

			}
		}

		// parentMap[i].parent = null

		i++
	}

}

function getParentNode( name ){

	let i = 0

	let res = null

	while(i < parentMap.length ) {

		const node   = parentMap[i].node

		if( node.getName() == name ) {

			res = node
		}

		i++
	}

	return res
}

// async function standaloneInstance(doc, root, names){

// 	let c = 0

// 	while(c < names.length){

// 		const name = names[c]

// 		const node = getParentNode( name )

// 		if( node != null ){

//             const nodeChildrens = node.listChildren()

//             if (nodeChildrens.length > 0) {

//                 var childs = node.listChildren()

//                 let i = 0

//                 const tempScene = doc.createScene()

//                 while( i < childs.length ) {

//                     tempScene.addChild(childs[i])

//                     i++
//                 }

//                 await doc.transform(

//                     instancetransform({min: 2})

//                 )

//                 childs = tempScene.listChildren()

//                 i = 0

//                 while( i < childs.length ) {

//                 	console.log(childs[i].getName())

//                     node.addChild(childs[i])

//                     i++
//                 }

//                 tempScene.detach()
//             }
// 		}

// 		c++
// 	}

// }

function reorderNodesInName( root, name ){

	const scene = root.getDefaultScene()

	const list = scene.listChildren()

	var placeholderNode = null

	const rootNode = getRootObjectByName( root , name )

	if( rootNode != null ) {

		console.log( "rootNode found : ", rootNode )

		let i = 0

		while( i < list.length ) {

			const node = list[i]

			if( node.getName() != name ){

				node.getParentNode()?.removeChild(node)

				console.log('added node : ', node.getName(), '  to ' , name )

				rootNode.addChild( node )
			}

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

async function instanceOptimiser(doc){

	parentMap = []

    console.log('instance optmiser : ON')

	const root = doc.getRoot();

	// const gr = getRootObjectByName( root, 'grass')

	// takeOutAnimation( root )

	storeAndRemove( root, ['cameras', 'grass', 'placeholder', 'collision', 'collision_invisible', 'floor', 'floor_invisible', 'portal', 'reflector'])
	// storeAndRemove( root, ['display', 'cameras', 'placeholder', 'collision', 'collision_invisible', 'floor', 'floor_invisible', 'portal', 'reflector'])


	await doc.transform(

		instance({min: 2})
	)

	reorderNodesInName( root, 'display' )

	storeAndRemove( root, ['display'])

	restore('grass')

	await doc.transform(

		instance({min: 2})
	)

	restore('grass')

	reorderNodesInName( root, 'grass' )

	restore()

	// takeInAnimation( root )

	// log(root)

	// debugger



}


export default instanceOptimiser