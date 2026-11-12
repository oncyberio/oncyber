// @ts-check

import { Vector3 } from "three";

export class GamePadController {

    constructor(gamepad) {

        this.ticking = false;

        this.pan = new Vector3(0,0,0);

        // Recommended deadzones for Xbox One controller
        this.RIGHT_AXIS_THRESHOLD   = 7849 / 32767.0;
        this.LEFT_AXIS_THRESHOLD    = 8689 / 32767.0;
        this.TRIGGER_AXIS_THRESHOLD = 30   / 32767.0;

        this.SPACEMOUSE_THRESHOLD = 5 / 32767.0;

        this.gamepad = gamepad;
        this.prevTimestamps = [];
    }

    prevAxes = [0,0,0,0]

    /**
     *
     * @param { number[] } axes
     */
    same(axes) {
        return axes.every((it, i) => it === this.prevAxes[i])
    }

    pulse() {
        const haptic = this.gamepad.hapticActuators?.[0]
        // console.log("haptic", haptic)
        haptic?.pulse?.(0.33, 67)
    }

    update() {

        // if(!this.same(this.gamepad.axes)) {
        //     this.prevAxes = this.gamepad.axes.slice()
        //     console.log(this.prevAxes)
        // }

        this.pan.set(0,0,0)

        let panX  = this.gamepad.axes[2];
        let panZ  = this.gamepad.axes[3];


        if (panX < -this.SPACEMOUSE_THRESHOLD ||
            panX > this.SPACEMOUSE_THRESHOLD) {

            this.pan.x = panX;
        }

        if (panZ < -this.SPACEMOUSE_THRESHOLD ||
            panZ > this.SPACEMOUSE_THRESHOLD) {

            this.pan.z = -panZ;
        }

    }

    get buttons() {

        return this.gamepad.buttons
    }


    dispose() {}
}
