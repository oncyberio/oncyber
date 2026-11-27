/**
 * tokens-ok-file: default colours for the 3D things a script makes.
 *
 * The world script SDK: the code that runs inside the sandbox's worker,
 * before the creator's script. It is kept as text because it never runs in
 * the Oncyber page: sandboxDocument.ts puts it in a Blob worker inside an
 * opaque frame. Plain ES2019 only, no template literals or imports.
 *
 * What a script sees is listed once, by name, in ./scriptApi.ts (with what
 * the model is told of it), and a thing's properties in ./protocol.ts
 * (THING_PROPS). The lists this code sends properties by are made from
 * that table; scriptApi.test.ts holds the rest of it to both.
 */
import { GIVEN_KEYS, LIVE_KEYS, PLACE_KEYS } from "./protocol";
import { SCRIPT_GLOBALS } from "./scriptApi";

export const WORLD_SCRIPT_SDK = String.raw`
"use strict";
(function () {
    var post = self.postMessage.bind(self);
    var ops = [];
    var things = {};
    // What the host was last told: of each thing (one entry per property),
    // of each artwork and door, and of each HUD line.
    var sent = {};
    var sentArt = {};
    var sentDoor = {};
    var sentHud = {};
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
        sentArt[art.id] = artState(art);
        return art;
    }
    function artState(art) {
        return JSON.stringify([arr(art.position), arr(art.rotation), arr(art.scale), !!art.visible]);
    }

    // The properties of a thing that are not as the host was last told, or
    // null when it knows them all: only what changed travels.
    function changedProps(id, thing) {
        var props = thingProps(thing);
        var last = sent[id] || (sent[id] = {});
        var changed = null;
        for (var key in props) {
            var value = JSON.stringify(props[key]);
            if (value === last[key]) continue;
            last[key] = value;
            (changed = changed || {})[key] = props[key];
        }
        return changed;
    }
    // A thing's properties as they travel (protocol.ts, THING_PROPS): LIVE
    // whenever the script changes them, GIVEN once from what it was made
    // with. Where it is and how big (PLACE) is {x, y, z} here, an array there.
    var LIVE = ${JSON.stringify(LIVE_KEYS)};
    var GIVEN = ${JSON.stringify(GIVEN_KEYS)};
    var PLACE = ${JSON.stringify(PLACE_KEYS)};
    function thingProps(thing) {
        var props = {};
        for (var i = 0; i < LIVE.length; i++) {
            var key = LIVE[i];
            props[key] = PLACE.indexOf(key) < 0 ? thing[key] : arr(thing[key]);
        }
        return props;
    }

    // A point as a script may write it ([x, y, z] or {x, y, z}), as an array.
    function pt(value) {
        return arr(fromAny(value, v3(0, 0, 0)));
    }

    // What a model is made of. Each call adds a part; the host builds the
    // object and draws it the way the world's style says (parts.ts).
    function makeModel(thing) {
        var target = thing.parts;
        function push(command) { target.push(command); thing._rev++; return thing; }
        // A flat shape: corners counter-clockwise as seen from the front.
        thing.poly = function (corners, look) { return push(["poly", (corners || []).map(pt), look || {}]); };
        thing.box = function (min, max, look) { return push(["box", pt(min), pt(max), look || {}]); };
        // A bar from a to b; facing is the side that shows.
        thing.beam = function (a, b, facing, width, depth, look) { return push(["beam", pt(a), pt(b), pt(facing), +width, +depth, look || {}]); };
        // An upright column around [x, z], from y0 to y1.
        thing.prism = function (at, radius, y0, y1, look) { return push(["prism", [+at[0], +at[1]], +radius, +y0, +y1, look || {}]); };
        // A drawn line from a to b on the surface that faces facing.
        thing.line = function (a, b, facing, look) { return push(["line", pt(a), pt(b), pt(facing), look || {}]); };
        // Everything added inside fn is turned by yaw and moved to at.
        thing.place = function (at, yaw, fn) {
            var inner = [];
            var outer = target;
            push(["place", pt(at), +yaw || 0, inner]);
            target = inner;
            try { fn(thing); } finally { target = outer; }
            return thing;
        };
        // Starts the model again from nothing.
        thing.clear = function () { thing.parts.length = 0; target = thing.parts; thing._rev++; return thing; };
    }

    function add(spec) {
        spec = spec || {};
        var id = spec.id != null ? String(spec.id) : "t" + ++autoId;
        if (things[id]) id = id + "-" + ++autoId;
        var live = mode === "keep" ? carried[id] : null;
        var thing = {
            id: id,
            shape: spec.shape || (spec.text != null ? "text" : "box"),
            position: fromAny(live && live.position, fromAny(spec.position, v3(0, 0, 0))),
            rotation: fromAny(live && live.rotation, fromAny(spec.rotation, v3(0, 0, 0))),
            scale: fromAny(spec.scale, fromAny(live && live.scale, v3(1, 1, 1))),
            color: spec.color || undefined,
            look: spec.look || undefined,
            pattern: spec.pattern || undefined,
            color2: spec.color2 || undefined,
            wobble: spec.wobble == null ? undefined : +spec.wobble,
            shader: spec.shader || undefined,
            solid: spec.solid == null ? undefined : !!spec.solid,
            avatar: spec.avatar == null ? undefined : String(spec.avatar),
            name: spec.name == null ? undefined : String(spec.name),
            say: undefined,
            motion: spec.motion || undefined,
            // model: what it is made of (the things that are parts of this
            // one are in _kids).
            parts: [],
            _kids: [],
            lamp: spec.lamp || undefined,
            _rev: 0,
            _sentRev: 0,
            parent: spec.parent ? String(spec.parent.id || spec.parent) : null,
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
                thing._kids.slice().forEach(function (part) { part.remove(); });
                delete things[id];
                delete sent[id];
                ops.push({ op: "remove", id: id });
            },
            onClick: function (fn) { thing._click = fn; return thing; },
            distanceTo: function (other) { return distance(thing, other); },
            // A part of this thing: it moves, turns and is removed with it.
            add: function (partSpec) {
                partSpec = partSpec || {};
                var copy = {};
                for (var key in partSpec) copy[key] = partSpec[key];
                copy.parent = id;
                if (copy.id == null) copy.id = id + "." + ++autoId;
                var part = add(copy);
                thing._kids.push(part);
                return part;
            },
            lookAt: function (target) {
                var p = target.position || fromAny(target);
                thing.rotation.y = Math.atan2(p.x - thing.position.x, p.z - thing.position.z);
                return thing;
            },
        };
        if (thing.shape === "model") {
            if (Array.isArray(spec.parts)) { thing.parts = spec.parts.slice(); thing._rev++; }
            makeModel(thing);
        }
        if (thing.shape === "avatar") {
            // Says something over its head, for a few seconds.
            thing.speak = function (text, seconds) {
                thing.say = text == null ? "" : String(text);
                var mine = ++thing._said;
                if (thing.say) wait(seconds == null ? 4 : +seconds).then(function () {
                    if (thing._said === mine) thing.say = "";
                });
                return thing;
            };
            thing._said = 0;
        }
        var props = thingProps(thing);
        props.shape = thing.shape;
        for (var g = 0; g < GIVEN.length; g++) props[GIVEN[g]] = spec[GIVEN[g]];
        // Parts given up front go with the thing; later ones follow in a flush.
        if (thing._rev) { props.parts = thing.parts; props.lamp = thing.lamp; thing._sentRev = thing._rev; }
        props.parent = thing.parent;
        things[id] = thing;
        delete sent[id];
        changedProps(id, thing);
        ops.push({ op: "add", id: id, props: props });
        return thing;
    }

    var doorList = [];
    var doorById = {};

    function makeDoor(data) {
        var cos = Math.cos(+data.yaw || 0), sin = Math.sin(+data.yaw || 0);
        var door = {
            id: String(data.id),
            position: v3(data.position[0], data.position[1], data.position[2]),
            yaw: +data.yaw || 0,
            width: +data.width || 0,
            height: +data.height || 0,
            portal: !!data.portal,
            building: data.building ? { position: fromAny(data.building.position), size: fromAny(data.building.size) } : null,
            // 0 shut, 1 fully open. A door the space made a portal stays shut.
            open: +data.open || 0,
            // A point given from the doorway (x across, y up, z out through
            // the door) as a point of the world.
            toWorld: function (p) {
                var q = fromAny(p, v3(0, 0, 0));
                return v3(door.position.x + cos * q.x + sin * q.z, door.position.y + q.y, door.position.z - sin * q.x + cos * q.z);
            },
            // A point of the world, from the doorway.
            toLocal: function (p) {
                var q = p && p.position ? p.position : fromAny(p, v3(0, 0, 0));
                var x = q.x - door.position.x, z = q.z - door.position.z;
                return v3(cos * x - sin * z, q.y - door.position.y, sin * x + cos * z);
            },
            distanceTo: function (other) { return distance(door, other); },
        };
        sentDoor[door.id] = door.open;
        return door;
    }

    function copyOf(spec) {
        var copy = {};
        for (var key in spec || {}) copy[key] = spec[key];
        return copy;
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
        // An object made of parts, drawn in the world's style.
        build: function (spec) { var s = copyOf(spec); s.shape = "model"; return add(s); },
        // Boxes ([min, max]) and one-sided walls nobody can walk through.
        solid: function (spec) { var s = copyOf(spec); s.shape = "solid"; return add(s); },
        // A box-shaped hole in the world's own model: size [x, y, z].
        open: function (spec) { var s = copyOf(spec); s.shape = "opening"; return add(s); },
        // One of Oncyber's avatars standing in the world.
        avatar: function (spec) { var s = copyOf(spec); s.shape = "avatar"; return add(s); },
        get doors() { return doorList; },
        door: function (id) { return doorById[id] || null; },
        onUpdate: function (fn) { updaters.push(fn); },
        onClick: function (fn) { clickers.push(fn); },
        restart: function () { post({ t: "restart" }); },
        // The world's creative direction: summary, palette, look.
        style: { summary: "", palette: ["#ffffff"], look: "matte" },
    };

    var input = {
        isDown: function (code) { return !!down[code] || !!down[String(code).toLowerCase()]; },
        onKeyDown: function (fn) { keyDown.push(fn); },
        onKeyUp: function (fn) { keyUp.push(fn); },
    };

    var ui = {
        // A line that already says this is not sent again: a script may
        // call hud() every frame.
        hud: function (key, text, corner) {
            key = String(key);
            text = text == null ? null : String(text);
            var line = text == null ? null : text + "\n" + corner;
            if (key in sentHud && sentHud[key] === line) return;
            sentHud[key] = line;
            ops.push({ op: "hud", key: key, text: text, corner: corner });
        },
        toast: function (text, seconds) { ops.push({ op: "toast", text: String(text), seconds: seconds }); },
        banner: function (text, seconds) { ops.push({ op: "banner", text: text == null ? null : String(text), seconds: seconds }); },
        clear: function () { sentHud = {}; ops.push({ op: "hud-clear" }); },
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
            var props = changedProps(id, thing);
            // A model's parts travel only when they have changed.
            if (thing._rev !== thing._sentRev) {
                thing._sentRev = thing._rev;
                props = props || {};
                props.parts = thing.parts;
                props.lamp = thing.lamp === undefined ? null : thing.lamp;
            }
            if (props) ops.push({ op: "set", id: id, props: props });
        }
        for (var d = 0; d < doorList.length; d++) {
            var door = doorList[d];
            var open = Math.min(1, Math.max(0, +door.open || 0));
            if (open !== sentDoor[door.id]) {
                sentDoor[door.id] = open;
                if (!door.portal) ops.push({ op: "door", id: door.id, open: open });
            }
        }
        for (var i = 0; i < artworkList.length; i++) {
            var art = artworkList[i];
            var a = artState(art);
            if (a !== sentArt[art.id]) {
                sentArt[art.id] = a;
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

    // What the script's code is handed, in the order its wrapper names them.
    var GLOBALS = ${JSON.stringify(SCRIPT_GLOBALS)};
    var handed = { world: world, input: input, ui: ui, sound: sound, keep: keep, wait: wait, every: every, random: random, distance: distance, console: con };
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
            if (message.style) world.style = message.style;
            artworkList = (message.artworks || []).map(makeArtwork);
            artworkList.forEach(function (a) { artworkById[a.id] = a; });
            doorList = (message.doors || []).map(makeDoor);
            doorList.forEach(function (d) { doorById[d.id] = d; });
            try {
                if (userMain) userMain.apply(null, GLOBALS.map(function (name) { return handed[name]; }));
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

    // Nothing else reaches the network or other code from here, and no
    // second worker can be started to keep this one answering while it works.
    ["fetch", "XMLHttpRequest", "WebSocket", "WebSocketStream", "EventSource", "importScripts", "indexedDB", "caches", "WebTransport", "Worker", "SharedWorker", "BroadcastChannel"].forEach(function (name) {
        try { Object.defineProperty(self, name, { value: undefined, writable: false, configurable: false }); } catch (error) { /* already gone */ }
    });
})();
`;

/** The creator's source wrapped so it sees only the SDK's names. */
export function wrapUserSource(source: string) {
    return (
        `self.__defineScript(function (${SCRIPT_GLOBALS.join(", ")}) {\n` +
        '"use strict";\n' +
        source +
        "\n});\n"
    );
}
