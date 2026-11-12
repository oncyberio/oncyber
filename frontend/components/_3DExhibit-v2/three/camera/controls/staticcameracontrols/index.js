// @ts-check

import {

    IS_MOBILE, IS_POINTER_LOCK, IS_TOUCH

} from '@3constants'

import {

    Vector3,

    Quaternion

} from 'three'

import Emitter from "@3emitter"

import Events from "@3events"

import { AbstractControls } from "../abstract"

const tempVec3 = new Vector3()

const quat = new Quaternion()

export class StaticCameraControls extends AbstractControls {

    constructor(opts) {

        super()

        this.name = 'StaticCameraControls'

        this.camera = opts.camera;

        this.index = 0

        this.setSpace(opts.space, opts.roomParameters)

        this.prevScreenX = 0;

        this.prevScreenY = 0;

        this.world = {
            thirdPersonPos: new Vector3(0, 0, 0)
        }
    }

    setCamera( camera ){

        camera.getWorldPosition( tempVec3 )

        camera.getWorldQuaternion( quat )

        this.camera.position.copy( tempVec3 );

        this.camera.quaternion.copy( quat );

        this.limits = {

            x: Math.PI * 0.5,

            y: Math.PI * 0.25
        }

        this.currentMovement = {

            x: 0,

            y: 0
        }
    }

    setSpace(space, roomParameters) {

        this.currentSpace = space

        this.roomParameters = roomParameters

        this.cameras = this.currentSpace.cameras


        if (this.cameras[this.index]) {

            this.setCamera( this.cameras[this.index ])

        }
    }


    addEvents( ) {

        Emitter.on(Events.MOUSE_MOVE, this.mouseMove)

        if( IS_MOBILE ) {

            Emitter.on(Events.CLICK, this.handleClick);
        }
        else {

            Emitter.on(Events.KEY_DOWN, this.handleKeyDown);

        }

    }

    removeEvents() {

        Emitter.on(Events.MOUSE_MOVE, this.mouseMove)

        if( IS_MOBILE ) {

            Emitter.off(Events.CLICK, this.handleClick);
        }
        else {

            Emitter.off(Events.KEY_DOWN, this.handleKeyDown);

        }

    }


    handleKeyDown = (event) => {

        if (event.code === "ArrowRight" || event.code === "KeyW" || event.code === "KeyD") {

            this.index++

            const modIndex = this.mod( this.index, this.cameras.length )

            this.setCamera( this.cameras[ modIndex ])

        } else if (event.code === "ArrowLeft" || event.code === "KeyS" || event.code === "KeyA") {

            this.index--

            const modIndex = this.mod( this.index, this.cameras.length )

            this.setCamera( this.cameras[ modIndex ])
        }

    }

    handleClick = (event) => {

        this.index++

        const modIndex = this.mod( this.index, this.cameras.length )

        this.setCamera( this.cameras[ modIndex ])

    }

    mouseMove = (e) => {

        if (!IS_TOUCH && !IS_POINTER_LOCK())  return;

        let movementX = 0

        let movementY = 0

        for (let i = 0; i < e.mousemovePackets.length; i++) {

            movementX += e.raw.dx / 500

            movementY += e.raw.dy / 500

        }

        this.currentMovement.x += movementX

        this.currentMovement.y += movementY

        if( this.currentMovement.x < -this.limits.x ) {

            this.currentMovement.x = -this.limits.x

            movementX = 0
        }

        if( this.currentMovement.x > this.limits.x ) {

            this.currentMovement.x = this.limits.x

            movementX = 0
        }

        if( this.currentMovement.y < -this.limits.y ) {

            this.currentMovement.y = -this.limits.y

            movementY = 0
        }

        if( this.currentMovement.y > this.limits.y ) {

            this.currentMovement.y = this.limits.y

            movementY = 0
        }

        this.camera.rotation.y -= movementX;

        this.camera.rotation.x -= movementY;
    }

    dispose = () => {

        this.index = 0;

        this.removeEvents();
    }

    mod(n, m) {

      return ((n % m) + m) % m;
    }

}
