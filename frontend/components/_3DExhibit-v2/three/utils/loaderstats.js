import {

	CANVAS,

	LOADER_STATS

} from '@3constants'

import { LoaderState } from '@utils/js'


import root from '@3gl/root'

var THREEx  = THREEx || {}

window.THREEx = THREEx





class LoaderStats {

    lineCSS = 'font-family:Helvetica,Arial,sans-serif;font-size:9px;font-weight:bold;line-height:15px'

	constructor(){

        if(LOADER_STATS) {

            var container   = document.createElement( 'div' )

            container.style.cssText = `
                width: 200px;
                opacity: 0.9;
                cursor: pointer;
                position: absolute;
                right: 0px;
                bottom: 0px;
                z-index: 1000;
                background: black;
                color: wheat;
                max-height: 400px;
                overflow: scroll;
            `


            container.style.position   	= 'absolute'

            container.style.right  		= '0px'

            container.style.bottom    	= '0px'

            container.style.zIndex    	= '1000'

            this.domElement = container

            this.added = false
        }

	}

	update(){

        if(LOADER_STATS) {

            if(this.added == false){

                document.body.appendChild( this.domElement )

                this.added = true
            }

            this.domElement.textContent = ""

            let header = this.createLine()

            header.style.marginBottom = "4px"

            this.domElement.appendChild(header)



            const loaders = []

            root.currentArtworks.loadersGroup.children.forEach(loaderMesh => {

                loaders.push(loaderMesh)
            })

            root.currentArtworks.artworks.forEach(artwork => {

                if(artwork.mesh?.loader) {

                    loaders.push(artwork.mesh)
                }
            })


            let nbFailed = 0, nbPending = 0, nbRetrying = 0;

            loaders.forEach(mesh => {

                const state = mesh.loader.state

                if(state === LoaderState.SUCCESS) return

                this.addLoader(mesh)

                if(state === LoaderState.ERROR) {

                    nbFailed++
                }
                else if(state === LoaderState.LOADING) {

                    nbPending++
                }
                else if(state === LoaderState.RETRYING) {

                    nbRetrying++
                }
            });

            header.textContent = `Pending (${nbPending}) - Failed (${nbFailed}) - Retrying (${nbRetrying})`
        }

	}

    addLoader(mesh) {

        let line = this.createLine()

        const state = mesh.loader.state

        if(state === LoaderState.ERROR) {
            line.style.backgroundColor = "red"
            line.style.color = "white"
        }

        line.textContent = [
            mesh.loader.errors.map(_ => "⚠").join(""),
            state === LoaderState.LOADING || state === LoaderState.RETRYING  ? "⌛" : "",
            mesh.item.data.name
        ].join(" ")

        line.onclick = () => {

            console.log("LOADER_STATS", {
                type: mesh.item.data.mime_type,
                name: mesh.item.data.name,
                state,
                errors: mesh.loader.errors,
                item: mesh.item,
            })
        }

        this.domElement.appendChild( line )
    }

    createLine() {

        let line = document.createElement( 'div' )

        line.style.cssText = this.lineCSS

        return line;
    }

}

export default new LoaderStats()
