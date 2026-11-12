// @ts-check

import Camera from '@3camera'

import Players from '@3player'

import { IS_FIRST_PERSON, USER_HEIGHT } from '@components/_3DExhibit-v2/three/constants'

import { Vector3 } from "three"

const cameraDirection = new Vector3()

const cameraPosition = new Vector3()

const backPortalPosition = new Vector3()


export class SpawnPortal {

    constructor() {

        this.portal = null

        this._active = false

        this.width = 2.3

        this.height = 4.6
    }

    set active(val) {

        this._active = val

        this.portal.visible = val
    }


    get active() {

        return this._active
    }

    dispose(isTeleporting) {

        if(this.portal) {

            this.portal.dispose(isTeleporting)

            this.portal = null
        }

        this._active = false
    }

    updateCoords(opts) {

        if (!this.portal) return;

        const camera = Camera.current

        const previewMesh = this.portal.previewMesh

        const distance = 4.6

        camera.getWorldPosition(cameraPosition)

        camera.getWorldDirection(cameraDirection)

        cameraDirection.normalize()

        const position = IS_FIRST_PERSON ? cameraPosition : Players.main.position

        backPortalPosition
            .copy(cameraDirection)
            .multiplyScalar(distance)
            .add(position)

        backPortalPosition.y = IS_FIRST_PERSON ? position.y : position.y + USER_HEIGHT

        previewMesh.position.copy(backPortalPosition)

        previewMesh.lookAt(position.x, backPortalPosition.y, position.z)

        // if (IS_MULTIPLAYER) {

        //     Camera.currentControls.world.collisions.setCollider(this.portal);
        // }

    }
}
