// @ts-check

import { CircleGeometry, Mesh, MeshBasicMaterial } from "three"

import { disposeObject3D } from "@3utils/three"



export class SpaceDiskCursor extends Mesh {

    /**
     * @param { { roomParameters: import("@uitypes/roomParameters").RoomParameters } } opts
     */
    constructor(opts) {

        super(

            new CircleGeometry(0.5, 32),

            new MeshBasicMaterial({
                color: 0x333333,
                polygonOffset: true,
                polygonOffsetFactor: -2.0,
                polygonOffsetUnits: -8.0,
                transparent: true,
                opacity: 0.3,
            })
        )

        this.rotation.x = Math.PI / 2

        this.rotation.y = Math.PI
    }

    dispose() {

        disposeObject3D(this)
    }
}
