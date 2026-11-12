import { disposeObject3D } from "@components/_3DExhibit-v2/three/utils/three";

import { Group } from "three";



export class DropPlaceholder extends Group {

    constructor(opts) {

        super()

        this.name = "drop-placeholder"

        this.isPlaceholder = true

        this.preview = opts.preview 

        this.groundPoint = opts.groundPoint?.clone()

        this.pending = true

        this.add(this.preview)        

        this.position.copy(opts.position)

        this.quaternion.copy(opts.quaternion)
    }


    commit(artwork) {

        if (!this.pending) return

        this.remove(this.preview)
        if (this.preview !== artwork && !this.preview?.userData.isShared) {
            if (this.preview?.dispose) this.preview.dispose()
            else if (this.preview) disposeObject3D(this.preview)
        }
        this.preview = null

        this.pending = false
    }

    abort() {

        if (!this.pending) return

        if (this.preview) {

            this.remove(this.preview)

            this.preview.dispose?.()

            disposeObject3D(this.preview)

            this.preview = null
        }

        this.pending = false
    }

    dispose() {

        this.abort()
    }
}