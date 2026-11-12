import { PerspectiveCamera } from "three"

import { EDIT_MODE, IS_VR, STATIC_CAMERA, IS_MOBILE} from "@3constants"

import { EditModeControls } from "./editmodecontrols"

import { StaticCameraControls } from "./staticcameracontrols"

import { VRControls } from "./vrcontrols"

import PlayerControls from "./wasdcontrols"

import { HiglightControls } from "./highlightcontrols"

import FlyControls from "./flycontrols"


class ControlsFactory {

    constructor() {

        this.TYPES = {

            EDIT    : EditModeControls,

            WASD    : PlayerControls,

            VR      : VRControls,

            STATIC_CAMERA: StaticCameraControls,

            HIGHLIGHT: HiglightControls,

            FLY: FlyControls
        }
    }

    /**
     *
     * @param { { space: any,  roomParameters: import("@uitypes/roomParameters").RoomParameters, camera: PerspectiveCamera, isPreview: boolean } } opts
     */
    async get(opts, type) {

        if(type == null) {

            if(EDIT_MODE
                // && !IS_MOBILE
                ) {

                type = "EDIT"
            }

            else if(IS_VR) {

                type = "VR"
            }
             else if ( STATIC_CAMERA ) {

                type = "STATIC_CAMERA"
            }
            else {

                type = "WASD"
            }
        }

        const controls = new this.TYPES[type](opts)

        await controls.init()

        return controls
    }
}


export default new ControlsFactory()
