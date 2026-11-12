// @ts-check



import { CylinderGeometry, DoubleSide, Mesh, MeshBasicMaterial, Object3D, Vector3 } from "three"

import { DEBUG_AUDIO } from "@3constants"
import { AbstractAudioController } from "../artwork/controllers/abstractaudiocontroller"

/**
 * @typedef { object } VolumeRangeOpts
 * @property { number } height
 * @property { number } radius
 * @property { boolean } [wireframe]
 *
 *
 * @typedef { object } AudioControllerRangeOpts
 * @property { AbstractAudioController } audioController
 * @property { number } height
 * @property { Object3D } refObject
 */

class VolumeRange {

    /**
     *
     * @param { VolumeRangeOpts } opts
     * @returns
     */
    get({ height, radius, wireframe = false }) {

        let geometry = new CylinderGeometry(
            radius,
            radius,
            height,
            42,
            42
        )

        const material = new MeshBasicMaterial({
            color: 0xeaff6c,
            side: DoubleSide,
            depthWrite: false,
            transparent: true,
            opacity: 0.1,
            wireframe: wireframe || DEBUG_AUDIO,
        })

        const mesh = new Mesh(geometry, material)

        // mesh.scale.set(radius, 1, radius)

        mesh.userData.radius = radius

        mesh.userData.height = height

        mesh.position.y = height / 2

        return mesh
    }


    refPosition = new Vector3()

    /**
     * @param { AudioControllerRangeOpts } opts
     */
    getAudioControllerRange({ audioController, height, refObject}) {

        let radius = audioController.volumeScale

        const volumeRange = this.get({ radius, height })

        const updateMatrixWorld = volumeRange.updateMatrixWorld

        volumeRange.updateMatrixWorld = (force) => {

            if(volumeRange.visible) {

                refObject.getWorldPosition(this.refPosition)

                volumeRange.position.x = this.refPosition.x

                volumeRange.position.z = this.refPosition.z

                volumeRange.scale.set(audioController.volume, 1, audioController.volume)

                updateMatrixWorld.call(volumeRange, force)
            }
        }

        return volumeRange

    }
}

export default new VolumeRange()
