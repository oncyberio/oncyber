import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";

/**
 * Local check for the painted sky (features/worldMods/paintedSky): the
 * Starry Night dome as the engine draws it today (the sharp image sphere)
 * and repainted as brush strokes, through the same function its world mod
 * calls, with the same camera as a visit (fov 65 at the spawn point).
 *
 * ?view=after | before                 strokes (default) or the image
 * ?yaw=0&pitch=0.25&fov=65            where the camera looks (rotation YXZ)
 * ?sky=<url>                           the sky image (default: the live one)
 * ?glb=<url>                           also load the world's GLB
 * ?mobile=1                            the lighter layer set
 * ?only=2                              just one layer (0 is the ground)
 * ?backstop=1                          just the plain sphere under them
 * ?overdraw=1                          count fragments shaded per pixel:
 *                                      4/255 of grey for each (red channel)
 * ?holes=1                             clear to magenta, to spot gaps
 * ?renderer=webgl                      the WebGL2 backend
 *
 * window.__paintedSky: view(yaw, pitch, fov), measure(frames) (ms per
 * frame, waiting for the GPU each frame), info. <html data-painted-sky>
 * is "ready" once drawn, or "failed".
 */
const LIVE_SKY =
    "https://cyber.mypinata.cloud/ipfs/Qmdqrd6XzhZKUcRhnqKmuBXTCY1RowWEZu8kQ57MABZMCs?filename=1674107029-envMap-1674107029085.jpg";
const WIDTH = 1280;
const HEIGHT = 800;

export default function PaintedSkyCheck() {
    const router = useRouter();
    const host = useRef<HTMLDivElement>(null);
    const [status, setStatus] = useState("loading");

    useEffect(() => {
        if (!router.isReady || !host.current) return;
        const query = router.query;
        const number = (key: string, fallback: number) =>
            query[key] !== undefined ? Number(query[key]) : fallback;
        const after = query.view !== "before";
        let disposed = false;
        const cleanup: Array<() => void> = [];
        const root = document.documentElement;
        root.dataset.paintedSky = "loading";

        (async () => {
            const THREE = await import("three/webgpu");
            const { GLTFLoader } = await import(
                "three/examples/jsm/loaders/GLTFLoader.js"
            );
            const { default: BackgroundFactory } = await import(
                "@components/_3DExhibit-v2/three/factory/background"
            );
            const { paintSkyBackground, loadStrokeSet, createStrokeMesh } =
                await import("@features/worldMods/paintedSky/paintedSky");
            const { STARRY_NIGHT_STROKES } = await import(
                "@features/worldMods/worlds/thestarrynight_skydome/strokeFile"
            );
            const { strokeInstances, strokesPerLayer } = await import(
                "@features/worldMods/paintedSky/strokeFormat"
            );
            if (disposed) return;
            const renderer = new THREE.WebGPURenderer({
                antialias: true,
                forceWebGL: query.renderer === "webgl",
            });
            renderer.setPixelRatio(1);
            renderer.setSize(WIDTH, HEIGHT);
            renderer.outputColorSpace = query.overdraw
                ? THREE.LinearSRGBColorSpace
                : THREE.SRGBColorSpace;
            renderer.setClearColor(query.holes ? 0xff00ff : 0x000000, 1);
            host.current.appendChild(renderer.domElement);
            cleanup.push(() => {
                renderer.domElement.remove();
                renderer.dispose();
            });
            await renderer.init();

            const scene = new THREE.Scene();
            const camera = new THREE.PerspectiveCamera(
                65,
                WIDTH / HEIGHT,
                0.1,
                1400
            );
            camera.position.set(0, 2.85, 0);
            camera.rotation.order = "YXZ";
            const view = (yaw: number, pitch: number, fov: number) => {
                camera.rotation.set(pitch, yaw, 0);
                camera.fov = fov;
                camera.updateProjectionMatrix();
                camera.updateMatrixWorld();
            };
            view(number("yaw", 0), number("pitch", 0.25), number("fov", 65));

            // the sky image, loaded as spacefactory.loadCubeImage does
            const image = await new THREE.ImageLoader()
                .setCrossOrigin("anonymous")
                .loadAsync(String(query.sky || LIVE_SKY));
            const texture = new THREE.Texture(image);
            texture.colorSpace = THREE.SRGBColorSpace;
            texture.minFilter = THREE.LinearFilter;
            texture.needsUpdate = true;
            const background = BackgroundFactory.get({
                sharp: texture,
            } as never);
            scene.add(background);

            if (query.glb) {
                const gltf = await new GLTFLoader().loadAsync(
                    String(query.glb)
                );
                // the engine hides the world's invisible colliders (a fully
                // transparent material); a bare loader would draw them
                gltf.scene.traverse((object) => {
                    const material = (object as InstanceType<typeof THREE.Mesh>)
                        .material as InstanceType<typeof THREE.Material>;
                    if (material && material.opacity === 0)
                        object.visible = false;
                });
                scene.add(gltf.scene);
                scene.add(new THREE.AmbientLight(0xffffff, 1));
            }

            let painted = false;
            let paintMs = 0;
            if (after && query.only !== undefined) {
                // one layer alone, to see what each adds
                const set = await loadStrokeSet(STARRY_NIGHT_STROKES.url);
                const layer = Number(query.only);
                const all = strokeInstances(set, layer + 1);
                const from = strokesPerLayer(set)
                    .slice(0, layer)
                    .reduce((a, b) => a + b, 0);
                const part = (array: Float32Array) => array.slice(from * 4);
                const mesh = createStrokeMesh({
                    count: all.count - from,
                    centre: part(all.centre),
                    axis: part(all.axis),
                    colour: part(all.colour),
                });
                background.add(mesh);
                (background as InstanceType<typeof THREE.Mesh>).material[
                    "visible"
                ] = false;
                painted = true;
            } else if (after) {
                const started = performance.now();
                painted = await paintSkyBackground(
                    background,
                    STARRY_NIGHT_STROKES.url,
                    { mobile: query.mobile === "1" }
                );
                paintMs = performance.now() - started;
            }
            if (disposed) return;
            const strokes = background.getObjectByName("paintedSky") as
                | InstanceType<typeof THREE.Mesh>
                | undefined;
            if (strokes && query.backstop) strokes.visible = false;
            if (strokes && query.overdraw) {
                // every fragment the strokes shade adds 4/255, corners too
                const { vec4 } = await import("three/tsl");
                const material = strokes.material as InstanceType<
                    typeof THREE.NodeMaterial
                >;
                material.colorNode = vec4(4 / 255, 4 / 255, 4 / 255, 1);
                material.alphaTest = 0;
                material.blending = THREE.AdditiveBlending;
                material.needsUpdate = true;
                const backstop =
                    background.getObjectByName("paintedSkyBackstop");
                if (backstop) backstop.visible = false;
            }

            const sync = async () => {
                const backend = renderer.backend as unknown as {
                    gl?: WebGL2RenderingContext;
                    device?: GPUDevice;
                };
                if (backend.gl) {
                    backend.gl.readPixels(
                        0,
                        0,
                        1,
                        1,
                        backend.gl.RGBA,
                        backend.gl.UNSIGNED_BYTE,
                        new Uint8Array(4)
                    );
                } else if (backend.device) {
                    await backend.device.queue.onSubmittedWorkDone();
                }
            };
            const draw = () => renderer.render(scene, camera);
            const measure = async (frames = 60) => {
                const times: number[] = [];
                for (let i = 0; i < frames; i++) {
                    const t0 = performance.now();
                    draw();
                    await sync();
                    times.push(performance.now() - t0);
                }
                times.sort((a, b) => a - b);
                return {
                    median: times[Math.floor(frames / 2)],
                    mean: times.reduce((a, b) => a + b, 0) / frames,
                };
            };
            const info = {
                view: after ? "after" : "before",
                painted,
                paintMs: Math.round(paintMs),
                strokes: strokes
                    ? (
                          strokes.geometry as InstanceType<
                              typeof THREE.InstancedBufferGeometry
                          >
                      ).instanceCount
                    : 0,
                backend: (renderer.backend as { isWebGLBackend?: boolean })
                    .isWebGLBackend
                    ? "webgl2"
                    : "webgpu",
            };
            (window as unknown as { __paintedSky: unknown }).__paintedSky = {
                view: (yaw: number, pitch: number, fov: number) => {
                    view(yaw, pitch, fov);
                    draw();
                },
                measure,
                info,
            };
            // drawn on demand: once now, then whenever the view changes
            draw();
            root.dataset.paintedSky = "ready";
            setStatus(
                `${info.view} · ${info.backend} · ${info.strokes} strokes` +
                    (after && !painted ? " · strokes failed, image kept" : "")
            );
        })().catch((error) => {
            console.error(error);
            root.dataset.paintedSky = "failed";
            setStatus(`failed: ${error?.message ?? error}`);
        });
        return () => {
            disposed = true;
            while (cleanup.length) cleanup.pop()();
        };
    }, [router.isReady, router.query]);

    return (
        <main style={{ background: "#000", minHeight: "100vh", margin: 0 }}>
            <div ref={host} style={{ width: WIDTH, height: HEIGHT }} />
            <p
                style={{
                    margin: "8px 12px",
                    color: "#fff",
                    font: "12px monospace",
                    opacity: 0.7,
                }}
            >
                {status}
            </p>
        </main>
    );
}

export function getServerSideProps() {
    return process.env.NODE_ENV === "development"
        ? { props: {} }
        : { notFound: true };
}
