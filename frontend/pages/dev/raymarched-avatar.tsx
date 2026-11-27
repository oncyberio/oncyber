import { useEffect, useRef } from "react";
import { useRouter } from "next/router";
import * as THREE from "three/webgpu";
import { createRaymarchedAvatar } from "@features/procedural-avatar/raymarch";
import { SCULPTS } from "@features/procedural-avatar/sculpts";

/**
 * Local check for the traced reference of a sculpted character: the whole
 * figure drawn per pixel from its distance fields, on a turntable.
 *
 * It is the fidelity reference, not the avatar people wear, and it is
 * heavy: `scale` (default 0.5) is the fraction of the screen's pixels it
 * renders. Query: `who` (sculpt id), `yaw` and `pitch` (degrees, stops the
 * turntable), `zoom` (`face`, `bust` or `feet`), `scale`, `renderer=webgl`.
 */
export default function RaymarchedAvatarFixture() {
    const ref = useRef<HTMLDivElement>(null);
    const router = useRouter();
    useEffect(() => {
        const host = ref.current;
        if (!host || !router.isReady) return;
        const text = (key: string) =>
            typeof router.query[key] === "string"
                ? (router.query[key] as string)
                : "";
        const build = SCULPTS[text("who")] || SCULPTS.stagehand;
        const fixed = text("yaw") !== "" || text("pitch") !== "";
        const yaw = THREE.MathUtils.degToRad(Number(text("yaw")) || 0);
        const pitch = THREE.MathUtils.degToRad(Number(text("pitch")) || 3);
        const zoom = text("zoom");
        const scale = Math.min(2, Math.max(0.1, Number(text("scale")) || 0.5));
        const renderer = new THREE.WebGPURenderer({
            antialias: false,
            forceWebGL: text("renderer") === "webgl",
        });
        renderer.setPixelRatio(scale);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.NoToneMapping;
        renderer.domElement.style.width = "100%";
        renderer.domElement.style.height = "100%";
        host.append(renderer.domElement);
        const scene = new THREE.Scene();
        scene.background = new THREE.Color("#f5edf0");
        const sculpt = build();
        const figure = createRaymarchedAvatar(sculpt);
        scene.add(figure.mesh);
        const camera = new THREE.PerspectiveCamera(16, 1, 0.05, 60);
        const eyes = figure.focus[1];
        const target =
            zoom === "face"
                ? new THREE.Vector3(0, eyes - 0.02, 0)
                : zoom === "bust"
                ? new THREE.Vector3(0, eyes - 0.14, 0)
                : zoom === "feet"
                ? new THREE.Vector3(0, 0.25, 0)
                : new THREE.Vector3(0, sculpt.height / 2, 0);
        const distance =
            zoom === "face"
                ? 1.5
                : zoom === "bust"
                ? 2.6
                : zoom === "feet"
                ? 2.6
                : 7.4;
        const fit = () => {
            const width = Math.max(1, host.clientWidth);
            const height = Math.max(1, host.clientHeight);
            renderer.setSize(width, height, false);
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
        };
        fit();
        const resize = new ResizeObserver(fit);
        resize.observe(host);
        const state = window as unknown as { __raymarchedAvatar?: unknown };
        state.__raymarchedAvatar = { status: "loading" };
        const begin = performance.now();
        let frames = 0;
        renderer.setAnimationLoop(() => {
            const time = performance.now();
            const angle = fixed ? yaw : (time - begin) / 6000;
            camera.position.set(
                target.x + Math.sin(angle) * Math.cos(pitch) * distance,
                target.y + Math.sin(pitch) * distance,
                target.z + Math.cos(angle) * Math.cos(pitch) * distance
            );
            camera.lookAt(target);
            renderer.render(scene, camera);
            frames++;
            state.__raymarchedAvatar = {
                status: "ready",
                id: sculpt.id,
                layers: sculpt.layers.length,
                hairPieces: sculpt.hair.segments.length,
                frames,
            };
        });
        return () => {
            renderer.setAnimationLoop(null);
            resize.disconnect();
            figure.dispose();
            renderer.dispose();
            renderer.domElement.remove();
            delete state.__raymarchedAvatar;
        };
    }, [router.isReady, router.query]);
    return <div ref={ref} style={{ position: "fixed", inset: 0 }} />;
}

export function getServerSideProps() {
    return process.env.NODE_ENV === "development"
        ? { props: {} }
        : { notFound: true };
}
