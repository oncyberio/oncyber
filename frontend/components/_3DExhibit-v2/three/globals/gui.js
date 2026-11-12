import {

    COLLISION_TYPE,
	DEBUG,
	CINEMATIC

} from '@3constants'

import DAT from 'dat.gui'

let datgui, datgui2;


if( DEBUG ){

	let datGuiImage = require('@3utils/dat.gui.image.js').default

	datGuiImage(DAT);

	let GUI = DAT.GUI

	datgui  = new GUI()
	datgui2  = new GUI()

	datgui.domElement.style.position 				= 'absolute'
	datgui.domElement.style.top 					= '15px'

	datgui2.domElement.style.position 					= 'absolute'
	datgui2.domElement.style.right  					= '0px'
	datgui2.domElement.style.top  						= '15px'

	datgui.folders = {}

	datgui.folders.camera  		= datgui.addFolder('camera')

	datgui.folders.space  		= datgui.addFolder('space')

	datgui.folders.artworks  	= datgui.addFolder('artworks')

	datgui.folders.collisions  	= datgui.addFolder('collisions')

	datgui.folders.portals  	= datgui.addFolder('portals')

	datgui.folders.controls  	= datgui.addFolder('controls')


    if (COLLISION_TYPE === "BVH") {
        datgui.folders.bvh  	= datgui.addFolder('bvh')
    }


	datgui.folders.textures 	= datgui2.addFolder('textures')

	datgui.folders.cinematic 	= datgui2.addFolder('cinematic')

	datgui.folders.multiplayer 	= datgui2.addFolder('multiplayer')

	datgui.folders.lines 	= datgui2.addFolder('lines')

	datgui.folders.light 		= datgui2.addFolder('light')

	if( CINEMATIC ) {

		datgui.folders.cinematic.open()

	}

	setTimeout(()=>{

		// document.body.appendChild(datgui.domElement)
		// document.body.appendChild(datgui2.domElement)

		datgui.domElement.parentElement.style.cssText += "z-index: 10000 !important"
		datgui2.domElement.parentElement.style.cssText += "z-index: 10000 !important"

	}, 1000)

}

else{

	datgui = ''
}

export default datgui;
