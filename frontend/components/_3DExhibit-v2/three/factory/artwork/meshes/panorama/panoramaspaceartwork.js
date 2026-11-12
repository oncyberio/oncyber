import { SpaceArtwork } from "@3artwork/abstract";

import label, { LABEL_STATES } from "@3modules/label"

import { LABEL_ICONS } from "@3modules/label/constants";

import Scene from '@3scene'

import Emitter from '@3emitter'

import Events from '@3events'

import {

    CURRENT_MODE,

    IS_DESKTOP

} from '@3constants'

import Camera from '@3camera'

var a = 0

export class PanoramaSpaceArtwork extends SpaceArtwork {

	constructor( args ){

		super( args )

		this.isPanorama = true

		this.label = label.get()

		if( IS_DESKTOP ) {

			this.msg = {

		        message: "Press 'O' to open panorama",

		        iconUrl: LABEL_ICONS.PRESS_O
		    }

		    this.closeMsg = {

		    	iconUrl: LABEL_ICONS.PRESS_O,

		    	message: "Press 'O' to close panorama or move around"
		    }

		}

		else {

			this.msg = {

		        message: "Click to open panorama",

		        iconUrl: LABEL_ICONS.TAP
		    }

		    this.closeMsg = {

		    	message: "Move around to close panorama",

		    	iconUrl: LABEL_ICONS.TAP
		    }
		}

		this.isPanoVisible = false

	}

	lookAtCallback = ( e ) => {

		if( this.isPanoVisible || (Camera.isEditing && CURRENT_MODE != "display") ){

			return
		}

		if ( e.active == true ) {

			this.look()
		}

		else {

            this.leave()

		}
	}

    look = () => {
        this.label.setState(

            LABEL_STATES.ATTACHED,
            {
                ...this.msg,

                parent: Scene,

                mesh: this.mesh
            }
        )

        this.addKeyboard()
    }

    leave = () => {
        this.label.setState(LABEL_STATES.DETACHED)

        this.removeKeyboard()
    }

	keyboard(e){

		if ( ( IS_DESKTOP && ( e.key == 'o' || e.key == 'O') || IS_DESKTOP == false ) ) {

			// this.removeKeyboard()

			if( this.isPanoVisible == false ) {

				this.label.setState(LABEL_STATES.DETACHED)

				Emitter.emit( Events.CUSTOM, {

				    type: Events.PANORAMA_OPENING,

				    value: {

				        mesh: this
				    }
				})

				// console.log( this.label )

				// Camera.


				this.label.setState(

				    LABEL_STATES.ATTACHED,
				    {
				        ...this.closeMsg,

				        parent: Scene,

				        mesh: this.mesh
				    }
				)

				this.label.lookAt(Camera.current.position)

				this.isPanoVisible = true

				console.log( this.label )
			}

			else {

				Emitter.emit( Events.CUSTOM, {

				    type: Events.PANORAMA_CLOSING,

				    value: {

				        mesh: this
				    }
				})

				// this.closePano()
			}
		}
	}


	closePano(){

		this.label.setState(LABEL_STATES.DETACHED)

		this.removeKeyboard()

		this.isPanoVisible = false

	}

	addKeyboard(){

		if( this.onKeyBoardEvent == null ) {

			this.onKeyBoardEvent = this.keyboard.bind(this)

			Emitter.on(IS_DESKTOP ? Events.KEY_DOWN : Events.CLICK , this.onKeyBoardEvent)

			a++
		}
	}

	removeKeyboard(){

		if ( this.onKeyBoardEvent ) {

			console.log('remove events panorama ')

			Emitter.off(IS_DESKTOP ? Events.KEY_DOWN : Events.CLICK , this.onKeyBoardEvent)

			this.onKeyBoardEvent = null

			a--
		}
	}
}
