/**
 * The world script SDK: the code that runs inside the sandbox's worker,
 * before the creator's script. It is kept as text because it never runs in
 * the Oncyber page: sandboxDocument.ts puts it in a Blob worker inside an
 * opaque frame. Plain ES2019 only, no template literals or imports.
 *
 * What a script sees (also what the AI brief documents, see brief.ts):
 *   world.add(spec) -> thing      shapes, text; thing.position.x += 1 just works
 *   world.player / world.camera   position {x,y,z}, forward {x,y,z}
 *   world.artworks                the space's artworks: id, name, position, visible
 *   world.onUpdate(fn(dt, time))  every frame
 *   world.onClick(fn(hit))        hit.thing or hit.artwork, hit.point
 *   world.restart()               rewind to the start (same as a logic change)
 *   input.isDown(code), input.onKeyDown(fn), input.onKeyUp(fn)
 *   ui.hud(key, text, corner), ui.toast(text, s), ui.banner(text, s)
 *   sound.play(name, volume)
 *   keep(name, initial)           state that survives a live edit in place
 *   wait(s), every(s, fn), random(), distance(a, b)
 */
export const WORLD_SCRIPT_SDK = String.raw`
"use strict";
(function () {
    var post = self.postMessage.bind(self);
    var ops = [];
    var things = {};
    var sent = {};
    var updaters = [];
    var clickers = [];
    var keyDown = [];
    var keyUp = [];
    var timers = [];
    var down = {};
    var kept = {};
    var keptIn = {};
    var carried = {};
    var mode = "fresh";
    var autoId = 0;
    var time = 0;
    var errors = 0;
    var seed = 1;

    function report(error) {
        errors++;
        var text = error && error.stack ? String(error.stack) : String(error);
        post({ t: "error", text: text.slice(0, 800) });
    }

    function v3(x, y, z) {
        return { x: +x || 0, y: +y || 0, z: +z || 0 };
    }
    function fromAny(value, fallback) {
        if (value == null) return fallback;
        if (typeof value === "number") return v3(value, value, value);
        if (Array.isArray(value)) return v3(value[0], value[1], value[2]);
        if (typeof value === "object") return v3(value.x, value.y, value.z);
        return fallback;
    }
    function arr(v) {
        return [v.x, v.y, v.z];
    }

    var artworkList = [];
    var artworkById = {};

    function makeArtwork(data) {
        var art = {
            id: String(data.id),
            name: String(data.name || ""),
            type: String(data.type || ""),
            position: v3(data.position[0], data.position[1], data.position[2]),
            rotation: v3(data.rotation[0], data.rotation[1], data.rotation[2]),
            scale: v3(data.scale[0], data.scale[1], data.scale[2]),
            visible: data.visible !== false,
            _art: true,
            distanceTo: function (other) { return distance(art, other); },
            onClick: function (fn) { art._click = fn; return art; },
            reset: function () {
                art.position = v3(data.position[0], data.position[1], data.position[2]);
                art.rotation = v3(data.rotation[0], data.rotation[1], data.rotation[2]);
                art.scale = v3(data.scale[0], data.scale[1], data.scale[2]);
                art.visible = data.visible !== false;
            },
        };
        sent["art:" + art.id] = artState(art);
        return art;
    }
    function artState(art) {
        return JSON.stringify([arr(art.position), arr(art.rotation), arr(art.scale), !!art.visible]);
    }

    function thingState(thing) {
        return JSON.stringify([
            arr(thing.position), arr(thing.rotation), arr(thing.scale),
            thing.color, thing.opacity, thing.visible, thing.text, thing.glow,
            thing.textColor, thing.background,
        ]);
    }
    function thingProps(thing) {
        return {
            position: arr(thing.position), rotation: arr(thing.rotation), scale: arr(thing.scale),
            color: thing.color, opacity: thing.opacity, visible: thing.visible, text: thing.text,
            glow: thing.glow, textColor: thing.textColor, background: thing.background,
        };
    }

    function add(spec) {
        spec = spec || {};
        var id = spec.id != null ? String(spec.id) : "t" + ++autoId;
        if (things[id]) id = id + "-" + ++autoId;
        var live = mode === "keep" ? carried[id] : null;
        var thing = {
            id: id,
            shape: spec.shape || (spec.text != null ? "text" : "box"),
            position: live ? fromAny(live.position) : fromAny(spec.position, v3(0, 0, 0)),
            rotation: live ? fromAny(live.rotation) : fromAny(spec.rotation, v3(0, 0, 0)),
            scale: live && !spec.scale ? fromAny(live.scale) : fromAny(spec.scale, v3(1, 1, 1)),
            color: spec.color || "#ffffff",
            opacity: spec.opacity == null ? 1 : spec.opacity,
            visible: spec.visible !== false,
            text: spec.text == null ? "" : String(spec.text),
            glow: !!spec.glow,
            textColor: spec.textColor || "#ffffff",
            background: spec.background || "",
            data: spec.data || {},
            removed: false,
            set: function (props) {
                for (var key in props) {
                    if (key === "position" || key === "rotation" || key === "scale") thing[key] = fromAny(props[key], thing[key]);
                    else thing[key] = props[key];
                }
                return thing;
            },
            remove: function () {
                if (thing.removed) return;
                thing.removed = true;
                delete things[id];
                delete sent[id];
                ops.push({ op: "remove", id: id });
            },
            onClick: function (fn) { thing._click = fn; return thing; },
            distanceTo: function (other) { return distance(thing, other); },
            lookAt: function (target) {
                var p = target.position || fromAny(target);
                thing.rotation.y = Math.atan2(p.x - thing.position.x, p.z - thing.position.z);
                return thing;
            },
        };
        var props = thingProps(thing);
        props.shape = thing.shape;
        props.size = spec.size;
        props.billboard = spec.billboard;
        things[id] = thing;
        sent[id] = thingState(thing);
        ops.push({ op: "add", id: id, props: props });
        return thing;
    }

    function distance(a, b) {
        var p = a && a.position ? a.position : fromAny(a, v3(0, 0, 0));
        var q = b && b.position ? b.position : fromAny(b, v3(0, 0, 0));
        var dx = p.x - q.x, dy = p.y - q.y, dz = p.z - q.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    var player = { position: v3(0, 0, 0), forward: v3(0, 0, 1), yaw: 0,
        moveTo: function (p) { ops.push({ op: "player", position: arr(fromAny(p)) }); } };
    var camera = { position: v3(0, 0, 0), forward: v3(0, 0, 1) };

    function setView(view) {
        if (!view) return;
        player.position = fromAny(view.player.position);
        player.forward = fromAny(view.player.forward);
        player.yaw = +view.player.yaw || 0;
        camera.position = fromAny(view.camera.position);
        camera.forward = fromAny(view.camera.forward);
    }

    var world = {
        add: add,
        player: player,
        camera: camera,
        get artworks() { return artworkList; },
        artwork: function (idOrName) {
            return artworkById[idOrName] || artworkList.find(function (a) { return a.name === idOrName; }) || null;
        },
        get things() { return Object.keys(things).map(function (k) { return things[k]; }); },
        get time() { return time; },
        onUpdate: function (fn) { updaters.push(fn); },
        onClick: function (fn) { clickers.push(fn); },
        restart: function () { post({ t: "restart" }); },
    };

    var input = {
        isDown: function (code) { return !!down[code] || !!down[String(code).toLowerCase()]; },
        onKeyDown: function (fn) { keyDown.push(fn); },
        onKeyUp: function (fn) { keyUp.push(fn); },
    };

    var ui = {
        hud: function (key, text, corner) { ops.push({ op: "hud", key: String(key), text: text == null ? null : String(text), corner: corner }); },
        toast: function (text, seconds) { ops.push({ op: "toast", text: String(text), seconds: seconds }); },
        banner: function (text, seconds) { ops.push({ op: "banner", text: text == null ? null : String(text), seconds: seconds }); },
        clear: function () { ops.push({ op: "hud-clear" }); },
    };

    var sound = { play: function (name, volume) { ops.push({ op: "sound", name: name, volume: volume }); } };

    function keep(name, initial) {
        name = String(name);
        if (!(name in kept)) {
            kept[name] = mode === "keep" && name in keptIn ? keptIn[name] : initial;
        }
        return kept[name];
    }

    function wait(seconds) {
        return new Promise(function (resolve) { timers.push({ at: time + (+seconds || 0), fn: resolve }); });
    }
    function every(seconds, fn) {
        var s = Math.max(0.05, +seconds || 1);
        var timer = { at: time + s, every: s, fn: fn };
        timers.push(timer);
        return function () { timer.cancelled = true; };
    }
    function random() {
        // Seeded, so a rewind starts the round the same way every time.
        seed = (seed * 16807) % 2147483647;
        return (seed - 1) / 2147483646;
    }

    var con = {
        log: function () { ops.push({ op: "log", level: "log", text: Array.prototype.map.call(arguments, String).join(" ") }); },
        warn: function () { ops.push({ op: "log", level: "warn", text: Array.prototype.map.call(arguments, String).join(" ") }); },
        error: function () { ops.push({ op: "log", level: "error", text: Array.prototype.map.call(arguments, String).join(" ") }); },
    };

    function flush(seq) {
        for (var id in things) {
            var thing = things[id];
            var state = thingState(thing);
            if (state !== sent[id]) {
                sent[id] = state;
                ops.push({ op: "set", id: id, props: thingProps(thing) });
            }
        }
        for (var i = 0; i < artworkList.length; i++) {
            var art = artworkList[i];
            var a = artState(art);
            if (a !== sent["art:" + art.id]) {
                sent["art:" + art.id] = a;
                ops.push({ op: "artwork", id: art.id, props: { position: arr(art.position), rotation: arr(art.rotation), scale: arr(art.scale), visible: !!art.visible } });
            }
        }
        var batch = ops;
        ops = [];
        post({ t: "ops", seq: seq, ops: batch });
    }

    function safe(fn, a, b) {
        try {
            var result = fn(a, b);
            if (result && typeof result.catch === "function") result.catch(report);
        } catch (error) {
            report(error);
        }
    }

    function tick(message) {
        var dt = Math.min(0.1, Math.max(0, +message.dt || 0));
        time += dt;
        setView(message.view);
        var due = timers.filter(function (t) { return !t.cancelled && t.at <= time; });
        for (var i = 0; i < due.length; i++) {
            var timer = due[i];
            if (timer.every) timer.at += timer.every;
            else timer.cancelled = true;
            safe(timer.fn);
        }
        timers = timers.filter(function (t) { return !t.cancelled; });
        for (var j = 0; j < updaters.length; j++) safe(updaters[j], dt, time);
        flush(message.seq);
    }

    var userMain = null;
    self.__defineScript = function (main) { userMain = main; };

    self.onmessage = function (event) {
        var message = event.data || {};
        if (message.t === "start") {
            mode = message.mode === "keep" ? "keep" : "fresh";
            keptIn = message.kept || {};
            carried = message.things || {};
            seed = (message.seed >>> 0) || 1;
            setView(message.view);
            artworkList = (message.artworks || []).map(makeArtwork);
            artworkList.forEach(function (a) { artworkById[a.id] = a; });
            try {
                if (userMain) userMain(world, input, ui, sound, keep, wait, every, random, distance, con);
            } catch (error) {
                report(error);
            }
            flush(-1);
            post({ t: "started", errors: errors });
        } else if (message.t === "tick") {
            tick(message);
        } else if (message.t === "key") {
            var code = String(message.code || "");
            var key = String(message.key || "");
            var e = { code: code, key: key };
            if (message.down) { down[code] = true; down[key.toLowerCase()] = true; }
            else { delete down[code]; delete down[key.toLowerCase()]; }
            var list = message.down ? keyDown : keyUp;
            for (var k = 0; k < list.length; k++) safe(list[k], e);
        } else if (message.t === "click") {
            var hit = { point: fromAny(message.point, null), thing: null, artwork: null };
            if (message.thing && things[message.thing]) hit.thing = things[message.thing];
            if (message.artwork && artworkById[message.artwork]) hit.artwork = artworkById[message.artwork];
            var target = hit.thing || hit.artwork;
            if (target && target._click) safe(target._click, hit);
            for (var c = 0; c < clickers.length; c++) safe(clickers[c], hit);
        } else if (message.t === "keep") {
            var copy = {};
            for (var name in kept) {
                try { copy[name] = JSON.parse(JSON.stringify(kept[name])); } catch (error) { /* not plain data: not kept */ }
            }
            post({ t: "kept", kept: copy });
        }
    };

    // Nothing else reaches the network or other code from here.
    ["fetch", "XMLHttpRequest", "WebSocket", "EventSource", "importScripts", "indexedDB", "caches", "WebTransport"].forEach(function (name) {
        try { Object.defineProperty(self, name, { value: undefined, configurable: false }); } catch (error) { /* already gone */ }
    });
})();
`;

/** The creator's source wrapped so it sees only the SDK's names. */
export function wrapUserSource(source: string) {
    return (
        "self.__defineScript(function (world, input, ui, sound, keep, wait, every, random, distance, console) {\n" +
        '"use strict";\n' +
        source +
        "\n});\n"
    );
}
