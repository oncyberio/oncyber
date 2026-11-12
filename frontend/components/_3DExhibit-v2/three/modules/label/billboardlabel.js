//@ts-check
import { Vector3 } from "three";

import { LabelAbstract } from "./abstract";
import { IS_FIRST_PERSON } from "../../constants";
import Players from "@3factory/player"

import Camera from "../../camera"

const tmpVec3 = new Vector3()


export class BillboardLabel extends LabelAbstract {
    constructor(opts) {

        super(opts);

        this.currentMeshDistance = Infinity;
    }


    hide() {

        this.setVisible(false)

        this.mesh = null

        this.currentMeshDistance = Infinity;
    }

    show(opts) {

        this.distance = opts.distance;

        if (this.mesh === opts.mesh) {

            return
        }

        if(opts.parent && this.parent != opts.parent) {

            this.parent = opts.parent

            opts.parent.add(this)
        }

        if (opts.message !== this.message && opts.iconUrl !== this.iconUrl) {

            this.message = opts.message

            this.iconUrl = opts.iconUrl

            this.set(opts.message, opts.iconUrl)
        }

        this.mesh = opts.mesh

        this.mesh.getWorldQuaternion(this.quaternion)

        this.mesh.getWorldPosition(this.position)

        this.mesh.getWorldScale(tmpVec3)

        if(this.mesh.geometry.boundingBox == null) {

            this.mesh.geometry.computeBoundingBox()
        }

        this.translateX(this.mesh.geometry.boundingBox.max.x * tmpVec3.x + 0.3, 0, 0.5)

        this.setVisible(true)
    }

    update() {

        // let distance = 0;

        // if (IS_FIRST_PERSON) {

        //     distance = Camera.current.position.distanceTo(this.position)
        // } else {

        //     distance = Players.main.position.distanceTo(this.position)
        // }

        // this.currentMeshDistance = distance;

        // if (this.distance && distance > this.distance) {

        //     // this.setVisible(false);
        // }
    }
}
