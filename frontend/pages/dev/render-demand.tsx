import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";

/**
 * Local check for render on demand (three/utils/renderDemand*.js): a scene
 * on the real three renderer, driven the way world3D.js drives the engine's
 * (gate.begin, matrices, gate.confirm, draw, gate.end). It counts the frames
 * drawn and the draw calls over a measured window.
 *
 * ?scene=still | video | water | avatar | frames
 *   what moves (default still). `frames` re-uploads an instanced buffer
 *   with the same content on every drawn frame, as the artwork frames do
 *   (&mark=update: on every frame, before the draw, as the name tags do).
 * ?ondemand=0                            draw every frame, for comparison
 * ?renderer=webgl                        the WebGL2 backend
 * ?seconds=10                            the measured window
 *
 * The result is written to <html data-render-demand> as JSON.
 */
type Result = {
    scene: string;
    onDemand: boolean;
    backend: string;
    seconds: number;
    ticks: number;
    framesDrawn: number;
    drawCalls: number;
    probes: number;
};

export default function RenderDemandCheck() {
    const router = useRouter();
    const host = useRef<HTMLDivElement>(null);
    const [result, setResult] = useState<Result | null>(null);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!router.isReady || !host.current) return;
        const scene = String(router.query.scene || "still");
        const onDemand = router.query.ondemand !== "0";
        const forceWebGL = router.query.renderer === "webgl";
        const seconds = Number(router.query.seconds) || 10;
        let disposed = false;
        const disposers: Array<() => void> = [];
        const cleanup = () => {
            while (disposers.length) disposers.pop()();
        };
        (async () => {
            const THREE = await import("three/webgpu");
            const { uniform, color, mix, sin } = await import("three/tsl");
            const { gsap } = await import("gsap");
            const { createRenderDemand } = await import(
                "@components/_3DExhibit-v2/three/utils/renderDemand"
            );
            const { createRenderGate } = await import(
                "@components/_3DExhibit-v2/three/utils/renderDemandGate"
            );
            if (disposed) return;
            const renderer = new THREE.WebGPURenderer({
                antialias: true,
                forceWebGL,
            });
            renderer.setPixelRatio(1);
            renderer.setSize(640, 400);
            renderer.autoClear = false;
            renderer.info.autoReset = false;
            host.current.appendChild(renderer.domElement);
            disposers.push(() => {
                renderer.domElement.remove();
                renderer.dispose();
            });
            await renderer.init();
            if (disposed) return;

            const world = new THREE.Scene();
            world.background = new THREE.Color(0x202020);
            world.add(new THREE.AmbientLight(0xffffff, 1));
            const sun = new THREE.DirectionalLight(0xffffff, 2);
            sun.position.set(3, 5, 2);
            world.add(sun);
            const boxMaterial = new THREE.MeshStandardNodeMaterial({
                color: 0x8a8aa0,
            });
            const geometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
            for (let i = 0; i < 200; i++) {
                const box = new THREE.Mesh(geometry, boxMaterial);
                box.position.set(
                    (i % 20) - 10,
                    Math.floor(i / 20) * 0.6 - 3,
                    -6
                );
                world.add(box);
            }
            const camera = new THREE.PerspectiveCamera(60, 640 / 400, 0.1, 100);
            camera.position.set(0, 0, 4);

            // what moves: a video, a time-driven material, an avatar
            let video: HTMLVideoElement = null;
            let mover: InstanceType<typeof THREE.Mesh> = null;
            // marked by the loop's update work, as the name tags are
            let markEachTick: { needsUpdate: boolean } = null;
            let clock = 0;
            if (scene === "video") {
                const source = document.createElement("canvas");
                source.width = 128;
                source.height = 128;
                const context = source.getContext("2d");
                let hue = 0;
                const paint = setInterval(() => {
                    hue = (hue + 7) % 360;
                    context.fillStyle = `hsl(${hue} 70% 50%)`;
                    context.fillRect(0, 0, 128, 128);
                }, 33);
                video = document.createElement("video");
                video.muted = true;
                video.srcObject = source.captureStream(30);
                await video.play();
                const screen = new THREE.Mesh(
                    new THREE.PlaneGeometry(2, 2),
                    new THREE.MeshBasicNodeMaterial({
                        map: new THREE.VideoTexture(video),
                    })
                );
                world.add(screen);
                disposers.push(() => {
                    clearInterval(paint);
                    video.pause();
                });
            } else if (scene === "water") {
                const time = uniform(0).onRenderUpdate(() => clock / 1000);
                const water = new THREE.MeshBasicNodeMaterial();
                water.colorNode = mix(
                    color(0x0b3d91),
                    color(0x3fa7d6),
                    sin(time).mul(0.5).add(0.5)
                );
                const plane = new THREE.Mesh(
                    new THREE.PlaneGeometry(6, 3),
                    water
                );
                plane.rotation.x = -1.2;
                plane.position.y = -1;
                world.add(plane);
            } else if (scene === "avatar") {
                mover = new THREE.Mesh(
                    new THREE.CapsuleGeometry(0.3, 0.8),
                    new THREE.MeshStandardNodeMaterial({ color: 0xd08040 })
                );
                world.add(mover);
            } else if (scene === "frames") {
                const frames = new THREE.InstancedMesh(
                    new THREE.BoxGeometry(0.2, 0.2, 0.05),
                    new THREE.MeshBasicNodeMaterial({ color: 0xe0e0e0 }),
                    64
                );
                frames.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
                const place = new THREE.Object3D();
                for (let i = 0; i < 64; i++) {
                    place.position.set((i % 8) - 4, Math.floor(i / 8) - 4, -3);
                    place.updateMatrix();
                    frames.setMatrixAt(i, place.matrix);
                }
                if (router.query.mark === "update") {
                    markEachTick = frames.instanceMatrix;
                } else {
                    frames.onBeforeRender = () => {
                        frames.instanceMatrix.needsUpdate = true;
                    };
                }
                world.add(frames);
            }

            const demand = createRenderDemand({ enabled: onDemand });
            const gate = createRenderGate({
                demand,
                renderer,
                gsap,
            });
            gate.install();
            disposers.push(() => gate.dispose());

            const counts = { ticks: 0, framesDrawn: 0, drawCalls: 0 };
            let measuring = false;
            let frameId = 0;
            const tick = (now: number) => {
                clock = now;
                if (mover) mover.position.x = Math.sin(now / 700) * 2;
                if (markEachTick) markEachTick.needsUpdate = true;
                renderer.info.reset();
                let draw = gate.begin(true);
                world.updateMatrixWorld();
                camera.updateMatrixWorld();
                if (!draw) draw = gate.confirm(world, camera);
                if (draw) {
                    renderer.clear();
                    renderer.render(world, camera);
                }
                gate.end();
                if (measuring) {
                    counts.ticks++;
                    if (draw) counts.framesDrawn++;
                    counts.drawCalls += renderer.info.render.drawCalls;
                }
                frameId = requestAnimationFrame(tick);
            };
            frameId = requestAnimationFrame(tick);
            disposers.push(() => cancelAnimationFrame(frameId));

            // settle (shaders, first uploads), then measure
            await new Promise((resolve) => setTimeout(resolve, 2000));
            const probesBefore = demand.stats.probes;
            measuring = true;
            await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
            measuring = false;
            if (disposed) return;
            const backend = (renderer.backend as any).isWebGPUBackend
                ? "webgpu"
                : "webgl2";
            const next = {
                scene,
                onDemand,
                backend,
                seconds,
                ...counts,
                probes: demand.stats.probes - probesBefore,
            };
            document.documentElement.dataset.renderDemand =
                JSON.stringify(next);
            setResult(next);
        })().catch((reason) => {
            if (!disposed) setError(String(reason?.message || reason));
        });
        return () => {
            disposed = true;
            cleanup();
        };
    }, [router.isReady, router.query]);

    return (
        <main
            style={{
                minHeight: "100vh",
                background: "#101010",
                color: "#f3f3f1",
                fontFamily: "monospace",
                padding: 16,
            }}
        >
            <div ref={host} />
            <p>
                {error
                    ? `Failed: ${error}`
                    : result
                    ? `${result.scene} on ${result.backend}: ${result.framesDrawn} of ${result.ticks} frames drawn, ${result.drawCalls} draw calls in ${result.seconds} s`
                    : "Measuring…"}
            </p>
        </main>
    );
}

// Internal test page: not found outside development.
export function getServerSideProps() {
    return process.env.NODE_ENV === "development"
        ? { props: {} }
        : { notFound: true };
}
