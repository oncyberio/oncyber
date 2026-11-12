// @ts-check


import { SpaceArtwork } from "@3artwork/abstract"
import { VIDEO_PLAYBACK_TYPES } from "@components/_3DExhibit-v2/three/constants"
import { BufferGeometry, MeshBasicMaterial, Mesh, Float32BufferAttribute, PlaneGeometry } from "three"
// @ts-ignore
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js"


const TRI_SIZE = 0.3

class PlayMesh extends Mesh {


    constructor() {

        const geo = new BufferGeometry()

		geo.setIndex( [0, 1, 2] )

		geo.setAttribute( 'position',  new Float32BufferAttribute(
		    [
		       TRI_SIZE, 0, 0,
		      -TRI_SIZE,  TRI_SIZE, 0,
		       -TRI_SIZE, -TRI_SIZE, 0
		    ]
		, 3 ));

        super(geo, new MeshBasicMaterial({ color: 0xdedede, transparent: true, opacity: 0.4 }))

        this.position.z = 0.1
    }
}


class PauseMesh extends Mesh {


    constructor() {

        const w = 0.1
        const h = 0.3

        const leftRect = new PlaneGeometry(w, h)
        leftRect.translate(-0.1, 0, 0)

        const rightRect = new PlaneGeometry(w, h)
        rightRect.translate(0.1, 0, 0)

		const geo = mergeGeometries([ leftRect, rightRect ])

        super(geo, new MeshBasicMaterial({ color: 0xdedede, transparent: true, opacity: 0.4 }))

        this.position.z = 0.1
    }
}



export class VideoSpaceArtwork extends SpaceArtwork {

    constructor(opts) {

        super(opts)

        this.playMesh = new PlayMesh()

        this.add(this.playMesh)

        this.pauseMesh = new PauseMesh()

        this.add(this.pauseMesh)

        this.hideControls = false
    }

    updateMatrixWorld(force) {

        if(this.videoController?.videoPlayback === VIDEO_PLAYBACK_TYPES.MANUAL && !this.hideControls) {

            const isPaused = this.videoController?.isPaused

            this.playMesh.visible = isPaused

            this.pauseMesh.visible = !isPaused && document.pointerLockElement == null && this.isMouseOver

        }
        else {

            this.playMesh.visible = false

            this.pauseMesh.visible = false
        }

        super.updateMatrixWorld(force)
    }
}



