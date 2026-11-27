import { useEffect, useRef } from "react";
import { useRouter } from "next/router";
import * as THREE from "three/webgpu";
import { createAvatar } from "@features/lobby/webgpu/avatarAdapter";
import { PROCEDURAL_AVATARS } from "@features/procedural-avatar/catalogue";

/**
 * Local check for the avatars generated in code: one avatar loaded the way
 * the lobby loads it, on a turntable, playing lobby motion.
 *
 * Query: `who` (catalogue id), `speed` (metres a second: 0 idles, 1.4
 * walks, 4 runs), `animation` (a clip name such as WAVING, instead of
 * `speed`), `hide` (comma-separated parts, e.g. `Shirt,Skirt,Tie` to see
 * the body under the clothes), `yaw` and `pitch` (degrees, stops the
 * turntable), `zoom` (`face` or `feet`), `renderer=webgl`.
 */
export default function ProceduralAvatarFixture() {
    const ref = useRef<HTMLDivElement>(null);
    const router = useRouter();
    useEffect(() => {
        const host = ref.current;
        if (!host || !router.isReady) return;
        const text = (key: string) =>
            typeof router.query[key] === "string"
                ? (router.query[key] as string)
                : "";
        const entry =
            PROCEDURAL_AVATARS.find((item) => item.id === text("who")) ||
            PROCEDURAL_AVATARS[0];
        const speed = Number(text("speed")) || 0;
        const animation = text("animation");
        const hidden = text("hide").split(",").filter(Boolean);
        const fixed = text("yaw") !== "" || text("pitch") !== "";
        const yaw = THREE.MathUtils.degToRad(Number(text("yaw")) || 0);
        const pitch = THREE.MathUtils.degToRad(Number(text("pitch")) || 4);
        const zoom = text("zoom");
        const renderer = new THREE.WebGPURenderer({
            antialias: true,
            forceWebGL: text("renderer") === "webgl",
        });
        renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.NoToneMapping;
        host.append(renderer.domElement);
        const scene = new THREE.Scene();
        scene.background = new THREE.Color("#f1eef0");
        const floor = new THREE.Mesh(
            new THREE.CircleGeometry(1.1, 64),
            new THREE.MeshBasicNodeMaterial({ color: "#e6e1e4" })
        );
        floor.rotation.x = -Math.PI / 2;
        scene.add(floor);
        const camera = new THREE.PerspectiveCamera(24, 1, 0.05, 50);
        const target =
            zoom === "face"
                ? new THREE.Vector3(0, 1.62, 0)
                : zoom === "feet"
                ? new THREE.Vector3(0, 0.25, 0)
                : new THREE.Vector3(0, 0.93, 0);
        const distance = zoom === "face" ? 1.25 : zoom === "feet" ? 1.6 : 4.6;
        const fit = () => {
            const width = Math.max(1, host.clientWidth);
            const height = Math.max(1, host.clientHeight);
            renderer.setSize(width, height);
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
        };
        fit();
        const resize = new ResizeObserver(fit);
        resize.observe(host);

        const abort = new AbortController();
        let avatar: Awaited<ReturnType<typeof createAvatar>> | undefined;
        const state = window as unknown as { __proceduralAvatar?: unknown };
        state.__proceduralAvatar = { status: "loading" };
        const started = performance.now();
        void createAvatar(entry.url, { signal: abort.signal })
            .then((loaded) => {
                avatar = loaded;
                const parts: string[] = [];
                let triangles = 0;
                loaded.root.traverse((object) => {
                    const mesh = object as THREE.Mesh;
                    if (!mesh.isMesh) return;
                    const part = mesh.name.replace(`${entry.id}_`, "");
                    parts.push(part);
                    triangles += mesh.geometry.index
                        ? mesh.geometry.index.count / 3
                        : 0;
                    if (hidden.includes(part)) mesh.visible = false;
                });
                scene.add(loaded.root);
                state.__proceduralAvatar = {
                    status: "ready",
                    id: entry.id,
                    parts,
                    triangles,
                    crowdReady: !!loaded.bakeParts,
                    loadMs: Math.round(performance.now() - started),
                };
            })
            .catch((error) => {
                if (abort.signal.aborted) return;
                state.__proceduralAvatar = {
                    status: "error",
                    message: String(error?.message || error),
                };
            });

        let last = performance.now();
        const begin = last;
        renderer.setAnimationLoop(() => {
            const time = performance.now();
            const dt = Math.min(0.1, (time - last) / 1000);
            last = time;
            if (avatar) {
                if (animation) avatar.update(dt, animation);
                else avatar.update(dt, undefined, { speed, grounded: true });
            }
            const angle = fixed ? yaw : (time - begin) / 6000;
            camera.position.set(
                target.x + Math.sin(angle) * Math.cos(pitch) * distance,
                target.y + Math.sin(pitch) * distance,
                target.z + Math.cos(angle) * Math.cos(pitch) * distance
            );
            camera.lookAt(target);
            renderer.render(scene, camera);
        });
        return () => {
            abort.abort();
            renderer.setAnimationLoop(null);
            resize.disconnect();
            avatar?.dispose();
            floor.geometry.dispose();
            (floor.material as THREE.Material).dispose();
            renderer.dispose();
            renderer.domElement.remove();
            delete state.__proceduralAvatar;
        };
    }, [router.isReady, router.query]);
    return <div ref={ref} style={{ position: "fixed", inset: 0 }} />;
}

export function getServerSideProps() {
    return process.env.NODE_ENV === "development"
        ? { props: {} }
        : { notFound: true };
}
