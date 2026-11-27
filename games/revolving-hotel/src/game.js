import * as T from "three/webgpu";
import { createAvatarKit } from "@oncyber/avatar-kit";
import {
    arrival,
    cameraPose,
    createWalker,
    createJumpInput,
    dragLook,
    turnLook,
    updateCamera,
    exposeLocomotionProbe,
} from "@oncyber/kit-locomotion";
import { describeArrival } from "@oncyber/game-runtime/arrival";
import gestures from "@oncyber/avatar-kit/motion/locomotion.json";
import emotes from "@oncyber/avatar-kit/motion/emotes.json";
import { avatarLoader } from "./avatar-loader.js";
import { createHotel } from "./hotel/render.mjs";
import { loadCast, createActor, buildCharacter } from "./cast.mjs";
import { drawSequence, duration } from "./sequence.mjs";
import { createRun } from "./playable.mjs";
import { createVisitorDriver } from "./visitor.js";
import { addContactShadows } from "./shadows.mjs";

import { createHotelSound } from "./sound.js";

export const bridge = {};
const $ = (id) => document.getElementById(id),
    clamp = T.MathUtils.clamp;
const SPAWN = { x: 0, z: 6 },
    HEIGHT = 1.75;
const array = (v) => [v.x, v.y, v.z];

export default function createGame(ctx) {
    const { signal, graphics, services } = ctx,
        walker = createWalker(
            { ...SPAWN, rotation: Math.PI },
            {
                scale: HEIGHT / 1.8,
                constrain(s) {
                    s.x = clamp(s.x, -1.04, 1.04);
                    s.z = clamp(s.z, 0.7, 31.4);
                },
            }
        ),
        jump = createJumpInput();
    let hotel,
        kit,
        loader,
        cast,
        wearPose,
        shadows,
        follow,
        run,
        lastFrame,
        screen = "boot",
        time = 0,
        elapsed = 0,
        poseTimer = 0,
        walked = 0;
    let trip = null,
        came = "direct",
        paused = false,
        leaving = false,
        w = 0,
        h = 0,
        roundLength = 100,
        matchAge = 0,
        rendered = false,
        pendingPeers = [];
    const sound = createHotelSound(ctx.audio);
    const held = new Set(),
        opts = { signal },
        motionSets = {};
    function hud() {
        $("boot").hidden = screen !== "boot";
        $("hud").hidden = screen === "boot" || leaving;
        $("primary").textContent =
            {
                arrival: "Enter the corridor",
                menu: "Start run",
                results: "Return to hotel",
            }[screen] || "";
        $("primary").hidden = !["arrival", "menu", "results"].includes(screen);
        $("watch").hidden = screen !== "arrival";
        $("back").hidden = !["menu", "match", "sequence"].includes(screen);
        $("change").hidden =
            screen !== "arrival" || !bridge.changeAvatar;
        $("back").textContent =
            screen === "sequence"
                ? "Stop sequence"
                : screen === "match"
                ? "Leave run"
                : "Back";
        $("help").textContent =
            screen === "arrival"
                ? "Explore the hotel with your avatar."
                : screen === "menu"
                ? "Clear both agents and reach the lift. Move with WASD, Shift to run, Space to leap, J to strike."
                : "";
        $("help").hidden = !$("help").textContent;
        $("stage-title").textContent =
            screen === "sequence"
                ? "Corridor sequence"
                : screen === "match"
                ? "Reach the lift"
                : screen === "results"
                ? lastFrame?.chapter || "Run complete"
                : "The revolving hotel";
        $("readout").hidden = !["match", "sequence"].includes(screen);
    }
    function arrive(view) {
        screen = "arrival";
        kit.self.manual = false;
        kit.self.rest();
        kit.self.motion = {};
        const a = arrival(view, {
            at: SPAWN,
            facing: Math.PI,
            avatarHeight: HEIGHT,
        });
        follow = a.camera;
        walker.scale = a.scale;
        walker.place({ ...SPAWN, y: 0, rotation: a.avatarRotation });
        jump.clear();
        kit.arrival.stage(view);
        hotel.stage.rotation.z = 0;
        kit.group.visible = true;
        cast[0].root.visible = false;
        cast.slice(1).forEach((a) => {
            a.root.visible = true;
        });
        lastFrame = null;
        hud();
    }
    function resize() {
        if (w === graphics.width && h === graphics.height) return;
        w = graphics.width;
        h = graphics.height;
        hotel.resize();
    }
    function lobbyFrame(dt, move = true) {
        const input = ctx.input,
            canMove =
                move && !paused && !leaving && kit.arrival.crouch <= 0.001;
        if (canMove) {
            if (ctx.pressed.jump) jump.queue();
            if (ctx.deltas.lookX || ctx.deltas.lookY)
                dragLook(
                    follow,
                    ctx.deltas.lookX * 100,
                    ctx.deltas.lookY * 100
                );
            if (input.lookX || input.lookY)
                turnLook(
                    follow,
                    -(input.lookX || 0) * 2.1 * dt,
                    (input.lookY || 0) * 1.65 * dt
                );
        }
        const sx = canMove ? (input.right || 0) - (input.left || 0) : 0,
            sz = canMove ? (input.down || 0) - (input.up || 0) : 0;
        updateCamera(follow, dt, Math.abs(sx) + Math.abs(sz) > 0.05);
        const before = [walker.state.x, walker.state.z];
        const p = walker.advance(dt, {
            strafe: sx,
            forward: sz,
            yaw: follow.yaw,
            running: canMove && input.run > 0,
            jump: canMove && jump.read(dt),
        });
        walked += Math.hypot(
            walker.state.x - before[0],
            walker.state.z - before[1]
        );
        kit.self.root.position.set(p.x, p.y, p.z);
        kit.self.root.rotation.set(0, p.rotation + Math.PI, 0);
        kit.self.motion = {
            speed: walker.speed(),
            air: !p.floor,
            verticalVelocity: walker.state.vy,
            jumpCount: walker.state.jumpCount,
            stopping: !sx && !sz,
            emote: sx || sz ? "" : kit.self.motion.emote,
        };
        const cam = cameraPose(follow, p, w),
            eye = array(cam.position);
        if (kit.arrival.crouch < 0.001) {
            eye[0] = clamp(eye[0], -1.19, 1.19);
            eye[1] = clamp(eye[1], 0.23, 2.45);
            eye[2] = clamp(eye[2], 0.24, 31.95);
        }
        for (const [i, a] of cast.entries())
            if (i) {
                a.pose({
                    x: i === 1 ? 0.52 : -0.44,
                    y: 1.02,
                    z: i === 1 ? 12.2 : 21.5,
                    bank: 0,
                    yaw: Math.PI,
                    pitch: 0,
                    phase: elapsed * 0.7 + i,
                    weights: { IDLE: 1 },
                });
            }
        return {
            angle: 0,
            poses: [p],
            view: {
                eye,
                target: array(cam.target),
                fov: cam.fov,
                cameraBank: 0,
            },
        };
    }
    function draw(dt) {
        if (!hotel || !kit || !cast) return;
        resize();
        const action =
            screen === "match" || screen === "sequence" || screen === "results";
        const frame = action
            ? screen === "sequence"
                ? drawSequence(time, cast)
                : run.draw()
            : lobbyFrame(dt, screen === "arrival");
        kit.group.visible = !action;
        kit.self.manual = action;
        kit.update(dt, hotel.camera);
        if (action) wearPose(dt);
        lastFrame = frame;
        sound.frame(frame.poses[0], frame.angle, dt, action ? null : walked);
        for (const a of cast.slice(1))
            a.root.visible =
                Math.abs(a.root.position.z - frame.view.eye[2]) < 18;
        shadows();
        hotel.draw(frame);
        rendered = true;
        poseTimer += dt;
        if (poseTimer >= 0.1) {
            const feet = kit.self.root.position;
            bridge.pose?.(
                kit.pose(
                    feet,
                    action
                        ? frame.poses[0].yaw - Math.PI
                        : walker.state.rotation
                )
            );
            poseTimer = 0;
        }
        if (screen === "sequence") $("readout").textContent = frame.chapter;
        if (screen === "match")
            $("readout").textContent =
                frame.chapter + " · " + frame.health + "/5";
    }
    function start(kind) {
        if (!kit || leaving || paused) return;
        if (screen === "arrival" && kind === "match") {
            screen = "menu";
            hud();
            return;
        }
        screen = kind;
        time = 0;
        matchAge = 0;
        run = createRun(cast);
        held.clear();
        kit.self.rest();
        kit.self.manual = true;
        if (kind === "match") void services.call("results", "begin", {});
        hud();
        draw(0);
    }
    function back() {
        if (screen === "match") void services.call("results", "abandon", {});
        arrive(null);
        kit.arrival.enter();
        draw(0);
    }
    function primary() {
        if (paused || leaving) return;
        if (screen === "results") {
            back();
            return;
        }
        if (screen === "menu" || screen === "arrival") start("match");
    }
    function done(win) {
        screen = "results";
        if (!lastFrame.finished) lastFrame.chapter = "Time expired";
        const me = {
            id: services.identity.id || "visitor",
            name: services.identity.name || "Visitor",
            kind: "self",
        };
        void services.call("results", "report", {
            format: "solo",
            durationSeconds: matchAge,
            winner: win ? 0 : 1,
            teams: [
                { score: win ? 1 : 0, players: [me] },
                {
                    score: win ? 0 : 1,
                    players: [
                        { kind: "cpu", id: "agents", name: "Hotel agents" },
                    ],
                },
            ],
        });
        hud();
    }
    bridge.soloMatch = () => screen === "match";
    bridge.peers = (list) => {
        pendingPeers = list;
        kit?.setPeers(list);
    };
    bridge.wear = async (ref) => {
        if (!kit) return;
        const ok = await (kit.wear ? kit.wear(ref) : kit.loadSelf(ref));
        if (ok) draw(0);
    };
    bridge.emote = (name) => {
        if (screen === "arrival") kit?.emote(name);
    };
    bridge.entered = () => kit?.arrival.enter();
    bridge.redraw = () => draw(0);
    bridge.stageDeparture = () => {
        if (screen === "match") void services.call("results", "abandon", {});
        leaving = true;
        arrive(null);
        hud();
        const r = lobbyFrame(0, false);
        kit.update(0.3, hotel.camera);
        for (const n of hotel.room.children)
            if (!n.isLight && n !== kit.self.root) n.visible = false;
        hotel.scene.background = new T.Color(0);
        hotel.draw(r);
        const point = (a) => ({ x: a[0], y: a[1], z: a[2] });
        return {
            camera: {
                position: point(r.view.eye),
                target: point(r.view.target),
                fov: r.view.fov,
            },
            avatar: {
                feet: { x: walker.state.x, y: 0, z: walker.state.z },
                yaw: walker.state.rotation,
                height: HEIGHT,
            },
        };
    };
    exposeLocomotionProbe(() =>
        screen === "arrival" && !leaving ? walker : null
    );
    async function prepare() {
        ctx.loading.progress(0.08, "Lighting the hotel…");
        const [scene, res] = await Promise.all([
            createHotel(graphics.canvas, graphics.pixelRatio),
            loadCast(),
        ]);
        hotel = scene;
        loader = avatarLoader(hotel.renderer);
        if (signal.aborted) {
            hotel.dispose();
            loader.dispose();
            return;
        }
        ctx.loading.progress(0.65, "Fitting the actors…");
        Object.assign(motionSets, gestures, res.clips);
        kit = createAvatarKit({
            services,
            signal,
            height: HEIGHT,
            heading: Math.PI,
            standIn: false,
            load: loader.load,
            motion: async () => motionSets,
            emotes: async () => emotes,
        });
        const fitted = await kit.loadSelf();
        if (signal.aborted) return;
        if (!fitted) {
            const guest = buildCharacter(res.anatomy, 0);
            guest.pivot.position.set(0, 0, 0);
            kit.self.attach({
                scene: guest.root,
                humanoid: guest.vrm.humanoid,
                update() {},
                dispose() {
                    guest.mesh.geometry.dispose();
                    guest.mesh.material.dispose();
                },
            });
            kit.self.addClips(motionSets);
        }
        hotel.room.add(kit.self.root, kit.group);
        kit.setPeers(pendingPeers);
        cast = [0, 1, 2].map((i) => createActor(res, i));
        cast.forEach((a) => hotel.mount(a));
        cast[0].root.visible = false;
        wearPose = createVisitorDriver(kit, cast[0]);
        shadows = addContactShadows(hotel.room, cast);
        graphics.canvas.dataset.backend = hotel.backend
            .toLowerCase()
            .replace(" ", "");
        arrive(null);
        draw(0);
        ctx.loading.progress(1, "Hotel ready");
    }
    function enter(c) {
        came = c.arrival?.from || "direct";
        trip = c.trip;
        arrive(c.arrival?.view || null);
        draw(0);
        $("primary").addEventListener("click", primary, opts);
        $("watch").addEventListener("click", () => start("sequence"), opts);
        $("back").addEventListener("click", back, opts);
        $("change").addEventListener(
            "click",
            () => bridge.changeAvatar?.(),
            opts
        );
        bridge.link?.report(() => ({
            options: [{ id: "solo", solo: true }],
            phase:
                screen === "match"
                    ? "match"
                    : screen === "results"
                    ? "results"
                    : "arrival",
            match: null,
        }));
        bridge.link?.on("choose", (id) => {
            if (id === "solo" && screen === "arrival") {
                screen = "menu";
                start("match");
            }
        });
        if (bridge.config?.autoplay) {
            screen = "menu";
            start("match");
            roundLength = bridge.config.round || 20;
        }
    }
    function update(dt) {
        if (!rendered || leaving) return;
        elapsed += dt;
        if (!paused) {
            if (ctx.pressed.back && screen !== "arrival") {
                back();
                return;
            }
            if (ctx.pressed.watch && screen === "arrival") start("sequence");
            else if (ctx.pressed.interact && screen !== "match") primary();
        }
        if (screen === "sequence") {
            time = Math.min(duration, time + dt);
            if (time >= duration) {
                back();
                return;
            }
        }
        if (screen === "match") {
            held.clear();
            if (!paused)
                for (const [action, key] of Object.entries({
                    up: "forward",
                    down: "back",
                    left: "left",
                    right: "right",
                    run: "sprint",
                }))
                    if (ctx.input[action] > 0.1) held.add(key);
            if (!paused && ctx.pressed.jump) run.action("jump");
            if (!paused && ctx.pressed.strike) run.action("strike");
            let left = dt;
            while (left > 1e-7) {
                const step = Math.min(left, 1 / 90);
                run.step(step, held);
                left -= step;
            }
            matchAge += dt;
        }
        draw(dt);
        if (
            screen === "match" &&
            (lastFrame.finished || matchAge >= roundLength)
        )
            done(lastFrame.chapter === "Lift reached");
    }
    return {
        prepare,
        enter,
        update,
        party(t) {
            trip = t;
        },
        inputPaused(p) {
            paused = p;
            if (p) {
                held.clear();
                jump.clear();
            }
        },
        suspend() {
            return { screen, time, matchAge, run: run?.snapshot() || null };
        },
        restore(s) {
            if (s?.screen === screen) {
                time = s.time;
                matchAge = s.matchAge;
                if (s.run) run?.restore(s.run);
            }
        },
        inspect() {
            const p = walker.state;
            return {
                ...kit?.inspect(),
                screen,
                came,
                standing: !!kit && kit.arrival.crouch === 0,
                partySize: trip?.size || 1,
                position:
                    screen === "match"
                        ? [lastFrame.poses[0].x, lastFrame.poses[0].z]
                        : [p.x, p.z],
                walked: walked > 0.45,
                grounded: !!p.floor,
                roll: lastFrame?.angle || 0,
                sequenceTime: time,
                leaving,
                arrival: kit
                    ? describeArrival({
                          camera: hotel.camera.position,
                          fov: hotel.camera.fov,
                          avatar: p,
                          avatarForward: {
                              x: -Math.sin(p.rotation),
                              z: -Math.cos(p.rotation),
                          },
                          avatarHeight: HEIGHT,
                          crouched: kit.arrival.crouch > 0,
                          handsEmpty: kit.arrival.handsEmpty,
                      })
                    : null,
            };
        },
        dispose() {
            sound.dispose();
            kit?.dispose();
            loader?.dispose();
            hotel?.dispose();
            held.clear();
        },
    };
}
