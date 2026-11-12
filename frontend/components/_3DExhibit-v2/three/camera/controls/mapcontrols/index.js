// @ts-check

import { Box3, MOUSE, TOUCH, Vector3 } from 'three';

import { OrbitControls } from '../orbitcontrols'

import {

    CANVAS

} from '@3constants'

import Emitter from '@3emitter'

import Events from '@3events'

import gsap from 'gsap';

const TARGET = new Vector3(-10.502310085718126, 0.581587538499533,  0.7745837808404059)

// MapControls performs orbiting, dollying (zooming), and panning.
// Unlike TrackballControls, it maintains the "up" direction object.up (+Y by default).
//
//    Orbit - right mouse, or left mouse + ctrl/meta/shiftKey / touch: two-finger rotate
//    Zoom - middle mouse, or mousewheel / touch: two-finger spread or squish
//    Pan - left mouse, or arrow keys / touch: one-finger move

const PseudoDomKeyTarget = {

    addEventListener: (type, cb)=>{

        Emitter.on(type, cb)
    },

    removeEventListener: (type, cb)=> {

        Emitter.off(type, cb)
    }
}

export class MapControls extends OrbitControls {

	constructor( object, domElement ) {

		super( object, domElement );

		this.screenSpacePanning = false; // pan orthogonal to world-space direction camera.up

		this.mouseButtons = { LEFT: MOUSE.PAN, MIDDLE: MOUSE.ROTATE, RIGHT: MOUSE.ROTATE };

		this.touches = { ONE: TOUCH.PAN, TWO: TOUCH.DOLLY_ROTATE };

        this.target.copy( TARGET )

		this.enableRotate = true

        this.fixedPanDistance = 30

        this.zoomSpeed = 2.2

        this.panSpeed = 10

        this.keyPanSpeed = 30

        this.vertKeyPanSpeed = 21

        this.name = "MapControls"

        this.targetRecalc = true

        this.targetRecalcDistance = 150

        this.enableDamping = true

        this.dampingFactor = 0.05

        this.listenToKeyEvents(PseudoDomKeyTarget)

		this.update()

        Emitter.on(Events.PRE_UPDATE, this.onUpdate.bind(this))


	}

    onUpdate(){

        if( this.enabled ) {

            this.update()
        }
    }

    async focusOn({ target, transition = true }) {

        const targetPos = target.getWorldPosition(new Vector3())

        if (!transition) {

            this.setTarget( targetPos )

            return
        }

        this._tweenPos?.kill()

        var ease = "power1.inOut"

        await new Promise((resolve) => {

            this._tweenPos = gsap.to(this.target, {
				...targetPos,
				duration: 1,
				ease,
				onUpdate: () => {
					//
					this.update()
				},
				onComplete: () => {

                    this.recalcTarget()

                    resolve()
                }
			})
        })

    }

    init() {

        this.update()
    }

    setPointerLocked( val ) {

        this.pointerLocked = val

        this.enabled = !val
    }

    setTarget( target ) {

        this.target.copy( target )

        this.update()

        this.recalcTarget()
    }

    isClickLocked() {

        return false
    }

}
