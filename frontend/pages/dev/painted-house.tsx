import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";

/**
 * Local check for the Starry Night house interior
 * (features/worldMods/worlds/thestarrynight_skydome/house): the painted
 * room on its own, without the world around it, through the same painter
 * and materials its world mod uses.
 *
 * ?from=0,2.3,4&to=0,2.3,-6&fov=65    the camera, in the house's frame
 *                                      (x across, y up, z out the door)
 * ?mobile=1                            the thinner stroke set
 * ?under=1                             the underpaint alone, no strokes
 * ?renderer=webgl                      the WebGL2 backend
 *
 * window.__paintedHouse: view(from, to, fov), info. <html
 * data-painted-house> is "ready" once drawn, or "failed".
 */
const WIDTH = 1280;
const HEIGHT = 800;

const triple = (value: unknown, fallback: [number, number, number]) => {
    const parts = String(value ?? "")
        .split(",")
        .map(Number);
    return parts.length === 3 && parts.every(Number.isFinite)
        ? (parts as [number, number, number])
        : fallback;
};

export default function PaintedHouseCheck() {
    const router = useRouter();
    const host = useRef<HTMLDivElement>(null);
    const [status, setStatus] = useState("loading");

    useEffect(() => {
        if (!router.isReady || !host.current) return;
        const query = router.query;
        let disposed = false;
        const cleanup: Array<() => void> = [];
        const root = document.documentElement;
        root.dataset.paintedHouse = "loading";

        (async () => {
            const THREE = await import("three/webgpu");
            const { paintInterior } = await import(
                "@features/worldMods/worlds/thestarrynight_skydome/house/interior"
            );
            const { createPaintedSurface } = await import(
                "@features/worldMods/paintedSurface/paintedSurface"
            );
            if (disposed) return;
            const renderer = new THREE.WebGPURenderer({
                antialias: true,
                forceWebGL: query.renderer === "webgl",
            });
            renderer.setPixelRatio(1);
            renderer.setSize(WIDTH, HEIGHT);
            renderer.outputColorSpace = THREE.SRGBColorSpace;
            renderer.setClearColor(0x05060c, 1);
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
                400
            );
            const started = performance.now();
            const painted = paintInterior({
                density: query.mobile === "1" ? 0.6 : 1,
            });
            const paintMs = performance.now() - started;
            const room = createPaintedSurface(painted, "paintedHouse");
            if (query.under) {
                const strokes = room.getObjectByName("paintedHouseStrokes");
                if (strokes) strokes.visible = false;
            }
            scene.add(room);

            const draw = () => renderer.render(scene, camera);
            const view = (
                from: [number, number, number],
                to: [number, number, number],
                fov = 65
            ) => {
                camera.position.set(...from);
                camera.lookAt(...to);
                camera.fov = fov;
                camera.updateProjectionMatrix();
                camera.updateMatrixWorld();
                draw();
            };
            const info = {
                strokes: painted.strokes.count,
                triangles: painted.base.index.length / 3,
                paintMs: Math.round(paintMs),
                backend: (renderer.backend as { isWebGLBackend?: boolean })
                    .isWebGLBackend
                    ? "webgl2"
                    : "webgpu",
            };
            (window as unknown as { __paintedHouse: unknown }).__paintedHouse =
                { view, info };
            view(
                triple(query.from, [0, 2.3, 4.5]),
                triple(query.to, [0, 2.2, -6]),
                query.fov !== undefined ? Number(query.fov) : 65
            );
            root.dataset.paintedHouse = "ready";
            setStatus(
                `${info.backend} · ${info.strokes} strokes · ${info.triangles} underpaint triangles · painted in ${info.paintMs} ms`
            );
        })().catch((error) => {
            console.error(error);
            root.dataset.paintedHouse = "failed";
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
