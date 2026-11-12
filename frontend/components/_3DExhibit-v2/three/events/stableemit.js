/**
 * The engine's emitter fires PRE_UPDATE, UPDATE, POST_UPDATE, PRE_RENDER and
 * LIGHTING every frame, to one listener per artwork, portal and mesh. The
 * `events` package copies the listener array (and the arguments) on every
 * emit, so listeners added or removed during an emit do not change who that
 * emit calls. This keeps that rule with one copy per change of listeners
 * instead of one per emit.
 *
 * Every method that adds or removes a listener is wrapped to drop the copies
 * (so none keeps a removed listener alive); emit reuses the copy until then.
 * Errors, and emits with more than four arguments, go through the original
 * emit.
 *
 * @param { import("events").EventEmitter } emitter
 */
export function installStableEmit(emitter) {

    const baseEmit = emitter.emit

    const copies = new Map()

    for (const name of [
        "addListener",
        "on",
        "prependListener",
        "once",
        "prependOnceListener",
        "removeListener",
        "off",
        "removeAllListeners",
    ]) {

        const method = emitter[name]

        if (typeof method !== "function") continue

        emitter[name] = function () {

            copies.clear()

            return method.apply(this, arguments)
        }
    }

    function listenersOf(type, list) {

        const copy = copies.get(type)

        if (copy !== undefined && copy.list === list) return copy.listeners

        const listeners = list.slice()

        copies.set(type, { list, listeners })

        return listeners
    }

    emitter.emit = function (type, a, b, c, d) {

        const count = arguments.length

        const events = this._events

        if (type === "error" || count > 5 || events === undefined) {

            return baseEmit.apply(this, arguments)
        }

        const handler = events[type]

        if (handler === undefined) return false

        if (typeof handler === "function") {

            call(handler, this, count, a, b, c, d)

            return true
        }

        const listeners = listenersOf(type, handler)

        for (let i = 0; i < listeners.length; i++) {

            call(listeners[i], this, count, a, b, c, d)
        }

        return true
    }

    return emitter
}

// The same number of arguments the caller passed, as EventEmitter does.
function call(listener, target, count, a, b, c, d) {

    switch (count) {

        case 1: return listener.call(target)

        case 2: return listener.call(target, a)

        case 3: return listener.call(target, a, b)

        case 4: return listener.call(target, a, b, c)

        default: return listener.call(target, a, b, c, d)
    }
}
