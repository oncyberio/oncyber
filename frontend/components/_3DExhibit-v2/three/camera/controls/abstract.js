import Augmented from "../../abstract/augmented";


export class AbstractControls extends Augmented {

    pointerLocked = false

    async init() {}

    addEvents() {}

    removeEvents() {}

    setPointerLocked(locked) {

        this.pointerLocked = locked
    }

    setCamera(camera) {}

    copyState(otherControls) {}

    rayIntersect(ray) {}

    playFeedback() {}

    isClickLocked() {

        return false
    }

    reset() {}

    dispose() {}
}
