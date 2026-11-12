import EventEmitter from "events/events.js"

import { installStableEmit } from "./stableemit"

import {

	DEBUG

} from "@3constants"

EventEmitter.prototype.off = EventEmitter.prototype.removeListener


/**
 * @type { import("@gltypes").Emitter }
 * */
let emitter = new EventEmitter()

// Per-frame emits reuse one copy of the listeners until they change.
installStableEmit(emitter)

emitter.on_prior = emitter.prependListener.bind(emitter)

emitter.setMaxListeners(100)

emitter.getEventCount = () => {

    let keys = Object.keys(emitter._events)

    let cc = 0

    let i = 0

    while (i < keys.length) {
        if (emitter._events[keys[i]].length) {
            cc += emitter._events[keys[i]].length
        }

        i++
    }

    return cc
}

if (DEBUG) {

    if(typeof window !== "undefined") {

        window.emitter = emitter

    }
}

export default emitter
