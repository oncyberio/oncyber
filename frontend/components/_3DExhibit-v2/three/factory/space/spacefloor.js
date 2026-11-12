// @ts-check

import Raycaster from "@3raycaster"

import Events from "@3events"


import { SpaceItem } from "@3factory/abstract/spaceitem"



export class SpaceFloor extends SpaceItem {

    constructor(opts) {

        super(opts)

        this.raycastOptions.notifyOnlyIfChanged = false
    }

     /**
     *
     * @param { { active: boolean, type: string, intersect: import("three").Intersection  } } e
     */
      raycastCallBack(e) {

        // const isUserAction = e.type == Raycaster.TYPES.USER_RAYCAST

        // if (EEDIT_MODE || IS_VR || IS_MOBILE) {

        //     if(isUserAction) {

        //         // console.log(Events.FLOOR_INTERSECTED, e)

        //         this.emit(Events.FLOOR_INTERSECTED, {

        //             point: e?.intersect?.point

        //         })
        //     }
        // }
    }
}
