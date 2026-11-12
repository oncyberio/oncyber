// @ts-check

import { SpaceArtwork } from "@3artwork/abstract";

import Geometry from "@components/_3DExhibit-v2/three/factory/particles/geometry";

import loader from "@3loader"

import { getRaycastBox } from '@components/_3DExhibit-v2/three/utils/three'

import {

    BoxGeometry,
    Mesh,
	MeshBasicMaterial,
	Vector3

} from 'three'

import Camera from "@components/_3DExhibit-v2/three/camera";

import { EDITION_TRANSFORM_CONTROL, IS_FIRST_PERSON, IS_TOUCH } from "@components/_3DExhibit-v2/three/constants";

import Root from "@components/_3DExhibit-v2/three/root";

import { LABEL_ICONS, LABEL_STATES } from "@components/_3DExhibit-v2/three/modules/label";

import { BACK_PORTAL_MESSAGE } from "@components/_3DExhibit-v2/three/factory/portal/constants";

import Scene from '@3scene'

import SitZoneMaterial from "./material";

import {

    CAMERA_LAYERS 

} from '@3constants'


export class SitZoneSpaceArtwork extends SpaceArtwork {

    constructor(opts) {

        super(opts);

        this.object = null

        this.canInteract = false

        this.triggerDistance = 3

        this.name = "sitzone"

        if (IS_TOUCH) {

            this.msg = {

                message: "Tap to sit",

                iconUrl: LABEL_ICONS.TAP
            }
        } else {

            this.msg = {

                message: "Press 'E' to sit",

                iconUrl: LABEL_ICONS.PRESS_E
            }
        }

      
        this.prefTransformControls = EDITION_TRANSFORM_CONTROL.TRANSFORM_3D
    }

    async get() {

        var texture = await loader.loadImageTexture("https://cyber.mypinata.cloud/ipfs/QmYM1PTSYaDXYUxsbWgRbe3fBmdErJUqtSnX6vDZRYFR4u?filename=4arrows_a7rsir_cqnxik.png")

        const geometry = new BoxGeometry(1, 1, 1, 1)

        const material = new SitZoneMaterial({

            map: texture,

            ratio: 1
        })

        const mesh = new Mesh(

            geometry,

            material,
        )

        this.object = mesh


        mesh.layers.set( CAMERA_LAYERS.SITTING_ZONE )

        return mesh;
    }

    updateMatrixWorld(force) {

        if (this.object) {

            this.object.visible = Camera.isEditing
        }

        super.updateMatrixWorld(force)
    }

    dispose() {

        if(this.wasDisposed) return

        super.dispose()
    }
}
