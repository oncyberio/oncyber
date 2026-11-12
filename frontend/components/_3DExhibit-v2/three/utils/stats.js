import {

	CURRENT_STATE,

	CANVAS,

	IS_DESKTOP,

	WEB_CODECS,

    ANTIALIAS,

    ARTWORK_STATS,

    REAL_DPI,

    SUPPORT_KTX_SUITE,

    SUPPORT_OFFSCREEN_CANVAS,

    COMPRESSED_SUPPORT,

	SUPPORT_OFFSCREEN_CANVAS_WEBGL

} from '@3constants'

import Camera from '@3camera'

import Stats from "stats.js"

var THREEx  = THREEx || {}

window.THREEx = THREEx

import renderer from '@3renderer'

import Emitter from '@3emitter'

import {

	STATS

} from '@3constants'

import root from '../root'

import { STATES as PORTAL_STATES } from '../factory/portal/constants'

import { PortalLOD } from '../factory/portal/portalLOD'


class RenderStats {

	constructor(){

		if( STATS ) {

			var msMin   = 100
			var msMax   = 0

			this.matrixStats = {
				nb: 0,
				time: 0
			}

			var container   = document.createElement( 'div' )
			container.style.cssText = 'width:150px;opacity:0.9;cursor:pointer'

			var msDiv   = document.createElement( 'div' )
			msDiv.style.cssText = 'padding:0 0 3px 3px;text-align:left;'
			container.appendChild( msDiv )

			var msText  = document.createElement( 'div' )
			msText.style.cssText = 'font-family:Helvetica,Arial,sans-serif;font-size:9px;font-weight:bold;line-height:15px'
			msText.innerHTML= 'WebGLRenderer'
            msText.style.color = "rgb(255 255 255)";
            msText.style.backgroundColor = "rgb(0 0 0)";

			msDiv.appendChild( msText )

			var msTexts = [];
			var nLines  = 24;
			for(var i = 0; i < nLines; i++){
				msTexts[i]  = document.createElement( 'div' )
				msTexts[i].style.cssText = 'font-family:Helvetica,Arial,sans-serif;font-size:9px;font-weight:bold;line-height:15px'
				msDiv.appendChild( msTexts[i] )
				msTexts[i].innerHTML= '-'
                msTexts[i].style.color = "rgb(255 255 255)";
                msTexts[i].style.backgroundColor = "#000000e0";
			}

			this.lastTime    = Date.now()

			container.style.position   	= 'absolute'

			container.style.left  		= '0px'

			container.style.bottom    	= '0px'

			container.style.zIndex    	= '1000000000000'



			this.domElement = container

			this.msTexts = msTexts

			this.added = false

            this.fpsStats = new Stats()

            this.fpsStats.showPanel( 0 ); // 0: fps, 1: ms, 2: mb, 3+: custom
		}
	}

	export(){

		return {

			geometries : renderer.info.memory.geometries,
			textures : renderer.info.memory.textures,
			// WebGPURenderer: `calls` counts render() calls, `drawCalls` counts draws
			calls : renderer.info.render.drawCalls ?? renderer.info.render.calls,
			triangles: renderer.info.render.triangles,
			points: renderer.info.render.points
		}
	}

	update(){

		if(this.added == false){

			CANVAS.parentElement.appendChild( this.domElement )

			this.added = true

            document.body.appendChild(this.fpsStats.dom)
		}

        this.fpsStats.update()

		if( Date.now() - this.lastTime < 1000/30 )   return;
		this.lastTime    = Date.now()

		var i   = 0;

		// this.msTexts[i++].textContent = 'ORIENTATION ' + ORIENTATION
		// this.msTexts[i++].textContent = 'IS MAC MOBILE ' + IS_MAC_MOBILE
		// this.msTexts[i++].textContent = 'IS TOUCH ' + IS_TOUCH
		// this.msTexts[i++].textContent = 'gputier ' + GPU_TIER.path

		this.msTexts[i++].textContent = 'Platform : ' + ( IS_DESKTOP  ? 'Desktop' : 'Mobile' )
		this.msTexts[i++].textContent = 'REAL_DPI : ' + REAL_DPI



		if( Camera.currentControls &&  Camera.currentControls.name ){

			this.msTexts[i++].textContent = 'Control :  ' + Camera.currentControls.name
		}

		if( Camera.current && Camera.current.name ) {

			this.msTexts[i++].textContent = 'Camera :  ' + Camera.current.name
		}

		// this.msTexts[i++].textContent = 'editmode ' 	+ EEDIT_MODE
		this.msTexts[i++].textContent = 'antialias ' 	+ ANTIALIAS
		this.msTexts[i++].textContent = 'webcodecs ' 	+ WEB_CODECS
		this.msTexts[i++].textContent = 'state ' 		+ CURRENT_STATE

        this.msTexts[i++].textContent = `videos: ${ARTWORK_STATS.VIDEOS} (${ARTWORK_STATS.PLAYING_VIDEOS} playing)`


        // LOD artworks
        let lod = 0, lo = 0;

        const artworks = root.currentArtworks?.artworks || []
        for (let i = 0, l = artworks.length; i < l; i++) {
            const art = artworks[i];
            if(art.mesh?.isLODMesh) {
                lod++

                if(art.mesh.state === "lo") {
                    lo++
                }
            }
        }

        this.msTexts[i++].textContent = `LOD meshes: ${lo} lo / ${lod}`

        // LOD portals
        lod = 0, lo = 0;

        const portals = root.currentPortals?.portals|| []
        for (let i = 0, l = portals.length; i < l; i++) {
            const portal = portals[i];
            if(portal.isStaticPortal && portal.opts.exhibitId) {
                lod++

                if(portal.currentState !== PORTAL_STATES.EMPTY) {
                    lo++
                }
            }
        }

        this.msTexts[i++].textContent = `PORTALS: ${lo} loaded / ${lod}`
        this.msTexts[i++].textContent = `Queued portals: ${PortalLOD.portalJobQueue?.pendingJobs?.length || 0}`

		this.msTexts[i++].textContent = "Programs: " 	+ (renderer.info.programs?.length ?? 0)
		this.msTexts[i++].textContent = "Geometries: "	+renderer.info.memory.geometries
		this.msTexts[i++].textContent = "Textures: " 	+ renderer.info.memory.textures
		this.msTexts[i++].textContent = "events: " 		+ Emitter.getEventCount()

		// this.msTexts[i++].textContent = "== Render ====="
		this.msTexts[i++].textContent = "Calls: "    	+ (renderer.info.render.drawCalls ?? renderer.info.render.calls)
		this.msTexts[i++].textContent = "Triangle: " 	+ renderer.info.render.triangles
		// this.msTexts[i++].textContent = "Points: " 		+ renderer.info.render.points

        if(root.editor) {

            // this.msTexts[i++].textContent = "Drag hittest: " 	+ (root.editor.perfs.dragHitTests / root.editor.perfs.dragHitNbs).toFixed(4)
        }
        this.msTexts[i++].textContent = "matrix perf " + (this.matrixStats.time).toFixed(3) + " ms"
        this.msTexts[i++].textContent = "interpolation perf " + window.$interstats?.toFixed?.(4) + " ms"
        this.msTexts[i++].textContent = "SUPPORT_KTX_SUITE " + SUPPORT_KTX_SUITE

        if( renderer.info.render.manualFrame ) {

        	this.msTexts[i++].textContent = "manual frames " + renderer.info.render.manualFrame

        }

        this.msTexts[i++].textContent ='offscreen canvas ' + SUPPORT_OFFSCREEN_CANVAS
        this.msTexts[i++].textContent ='compressed support ' + COMPRESSED_SUPPORT
        this.msTexts[i++].textContent ='webgl offscreen canvas :  ' + SUPPORT_OFFSCREEN_CANVAS_WEBGL

		

        

	}

}

export default new RenderStats()
