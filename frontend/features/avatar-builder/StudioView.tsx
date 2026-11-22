import { useEffect, useRef, useState } from "react";
import type * as Three from "three/webgpu";
import {
    createAvatar,
    type LobbyAvatar,
} from "@features/lobby/webgpu/avatarAdapter";
import { applyLiveLook } from "./liveLook";
import { editUrl, type Look } from "./look";

export type Framing = "Figure" | "Portrait";
export type Movement = "Idle" | "Walk" | "Run";
type Engine = { scene: Three.Scene; avatar?: LobbyAvatar };
type Props = {
    look: Look;
    framing: Framing;
    motion: Movement;
    angle: number;
    onTurn: (angle: number) => void;
    onStatus: (s: "loading" | "ready" | "error") => void;
    attempt: number;
};
export default function StudioView(props: Props) {
    const host = useRef<HTMLDivElement>(null);
    const [engine, setEngine] = useState<Engine>();
    const current = useRef(props);
    current.current = props;
    useEffect(() => {
        const el = host.current;
        let dead = false;
        let release = () => {};
        (async () => {
            const T = await import("three/webgpu");
            if (dead) return;
            const renderer = new T.WebGPURenderer({
                alpha: true,
                antialias: true,
                forceWebGL:
                    new URLSearchParams(location.search).get("renderer") ===
                    "webgl",
            });
            const canvas = renderer.domElement;
            el.appendChild(canvas);
            let previousX: number | undefined;
            const start = (event: PointerEvent) => {
                if (event.button !== 0) return;
                previousX = event.clientX;
                canvas.setPointerCapture(event.pointerId);
            };
            const drag = (event: PointerEvent) => {
                if (previousX === undefined) return;
                const delta = event.clientX - previousX;
                previousX = event.clientX;
                current.current.onTurn(current.current.angle + delta * 0.45);
            };
            const end = () => {
                previousX = undefined;
            };
            canvas.addEventListener("pointerdown", start);
            canvas.addEventListener("pointermove", drag);
            canvas.addEventListener("lostpointercapture", end);
            const scene = new T.Scene();
            const camera = new T.PerspectiveCamera(27, 1, 0.02, 40);
            const root: Engine = { scene };
            const base = new T.Mesh(
                new T.CylinderGeometry(0.7, 0.73, 0.053, 96),
                new T.MeshBasicMaterial({ color: 0x77708a })
            );
            base.position.y = -0.036;
            scene.add(base);
            const rim = new T.Mesh(
                new T.RingGeometry(0.641, 0.646, 96),
                new T.MeshBasicMaterial({ color: 0xb8aec1, side: T.DoubleSide })
            );
            rim.rotation.x = -Math.PI / 2;
            rim.position.y = -0.008;
            scene.add(rim);
            const stamp = document.createElement("canvas");
            stamp.width = stamp.height = 128;
            const ctx = stamp.getContext("2d");
            const grad = ctx.createRadialGradient(64, 64, 2, 64, 64, 60);
            grad.addColorStop(0, "rgba(32,23,49,.65)");
            grad.addColorStop(0.45, "rgba(32,23,49,.38)");
            grad.addColorStop(1, "rgba(32,23,49,0)");
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, 128, 128);
            const map = new T.CanvasTexture(stamp);
            const contact = new T.Mesh(
                new T.PlaneGeometry(1.03, 0.62),
                new T.MeshBasicMaterial({
                    map,
                    transparent: true,
                    depthWrite: false,
                })
            );
            contact.rotation.x = -Math.PI / 2;
            contact.position.y = -0.006;
            scene.add(contact);
            const resize = () => {
                const w = el.clientWidth,
                    h = el.clientHeight;
                if (w && h) {
                    renderer.setSize(w, h, false);
                    camera.aspect = w / h;
                    camera.updateProjectionMatrix();
                }
            };
            const observer = new ResizeObserver(resize);
            let active = false;
            release = () => {
                observer.disconnect();
                canvas.removeEventListener("pointerdown", start);
                canvas.removeEventListener("pointermove", drag);
                canvas.removeEventListener("lostpointercapture", end);
                if (active) void renderer.setAnimationLoop(null);
                for (const mesh of [base, rim, contact]) {
                    mesh.geometry.dispose();
                    mesh.material.dispose();
                }
                map.dispose();
                canvas.remove();
                if (active) renderer.dispose();
            };
            await renderer.init();
            if (dead) {
                renderer.dispose();
                return;
            }
            active = true;
            renderer.setClearColor(0x000000, 0);
            renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
            resize();
            observer.observe(el);
            let previous = performance.now(),
                span = 2.2,
                center = 0.87;
            await renderer.setAnimationLoop((time: number) => {
                const dt = Math.max(
                    0,
                    Math.min(0.065, (time - previous) / 1000)
                );
                previous = time;
                const p = current.current;
                const near = p.framing === "Portrait";
                const ease = 1 - Math.exp(-dt * 12);
                span +=
                    (Math.max(
                        near ? 0.65 : 2.19,
                        (near ? 0.4 : 1.16) / camera.aspect
                    ) -
                        span) *
                    ease;
                center += ((near ? 1.55 : 0.855) - center) * ease;
                const distance =
                    span / (2 * Math.tan(T.MathUtils.degToRad(camera.fov / 2)));
                const yaw = T.MathUtils.degToRad(p.angle);
                camera.position.set(
                    distance * Math.sin(yaw),
                    center + (near ? 0.035 : 0.17) * distance,
                    distance * Math.cos(yaw)
                );
                camera.lookAt(0, center, 0);
                root.avatar?.update(dt, p.motion.toUpperCase());
                renderer.render(scene, camera);
            });
            if (!dead) setEngine(root);
        })().catch(() => {
            if (!dead) current.current.onStatus("error");
        });
        return () => {
            dead = true;
            release();
        };
    }, [props.attempt]);
    useEffect(() => {
        if (!engine) return;
        const url = editUrl(props.look.base),
            controller = new AbortController();
        let model: LobbyAvatar;
        current.current.onStatus("loading");
        void createAvatar(url, { signal: controller.signal })
            .then((result) => {
                if (controller.signal.aborted) {
                    result.dispose();
                    return;
                }
                if (result.sourceUrl !== url) {
                    result.dispose();
                    throw Error("The selected rig could not load");
                }
                model = result;
                applyLiveLook(model.root, current.current.look);
                engine.scene.add(model.root);
                engine.avatar = model;
                current.current.onStatus("ready");
            })
            .catch(() => {
                if (!controller.signal.aborted)
                    current.current.onStatus("error");
            });
        return () => {
            controller.abort();
            if (engine.avatar === model) engine.avatar = undefined;
            model?.dispose();
        };
    }, [engine, props.look.base]);
    useEffect(() => {
        if (engine?.avatar) applyLiveLook(engine.avatar.root, props.look);
    }, [engine, props.look]);
    return (
        <div
            ref={host}
            style={{ position: "absolute", inset: 0, touchAction: "pan-y" }}
            aria-label="Interactive 3D avatar"
        />
    );
}
