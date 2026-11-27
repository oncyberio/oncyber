import { useEffect, useRef } from "react";
import { useRouter } from "next/router";
import * as THREE from "three/webgpu";
import { VRMUtils } from "@pixiv/three-vrm";
import {
    FIGURE_STYLES,
    FIGURE_URLS,
    STAGEHAND_STYLE,
    loadFigure,
} from "@features/procedural-avatar/figure";

/**
 * Local check for a figure (a bare, texture-free humanoid) and a style
 * that makes it a character, on a turntable. It blinks, to show that its
 * expressions still work.
 *
 * Query: `style` (`stagehand`, the default, or `plain` for the bare
 * figure), `expression` (one to hold, such as `happy` or `aa`), `yaw`
 * (degrees, stops the turntable), `zoom=face`, `renderer=webgl`.
 */
export default function FigureAvatarFixture() {
    const ref = useRef<HTMLDivElement>(null);
    const router = useRouter();
    useEffect(() => {
        const host = ref.current;
        if (!host || !router.isReady) return;
        const text = (key: string) =>
            typeof router.query[key] === "string"
                ? (router.query[key] as string)
                : "";
        const style = FIGURE_STYLES[text("style")] || STAGEHAND_STYLE;
        const fixed = text("yaw") !== "";
        const yaw = THREE.MathUtils.degToRad(Number(text("yaw")) || 0);
        const renderer = new THREE.WebGPURenderer({
            antialias: true,
            forceWebGL: text("renderer") === "webgl",
        });
        renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.NoToneMapping;
        host.append(renderer.domElement);
        const scene = new THREE.Scene();
        scene.background = new THREE.Color("#f5edf0");
        const camera = new THREE.PerspectiveCamera(16, 1, 0.05, 60);
        const face = text("zoom") === "face";
        const target = new THREE.Vector3(0, face ? 1.56 : 0.88, 0);
        const distance = face ? 1.5 : 6.6;
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
        const state = window as unknown as { __figureAvatar?: unknown };
        state.__figureAvatar = { status: "loading" };
        let disposed = false;
        let loaded: Awaited<ReturnType<typeof loadFigure>> | undefined;
        void loadFigure(FIGURE_URLS.male, style)
            .then((result) => {
                if (disposed) {
                    result.figure.dispose();
                    return;
                }
                loaded = result;
                scene.add(result.vrm.scene);
                state.__figureAvatar = {
                    status: "ready",
                    style: style.id,
                    triangles: result.figure.triangles,
                };
            })
            .catch((error) => {
                state.__figureAvatar = {
                    status: "error",
                    message: String(error?.message || error),
                };
            });
        const held = text("expression");
        const clock = new THREE.Clock();
        renderer.setAnimationLoop(() => {
            const now = clock.getElapsedTime();
            const angle = fixed ? yaw : now / 6;
            camera.position.set(
                target.x + Math.sin(angle) * distance,
                target.y,
                target.z + Math.cos(angle) * distance
            );
            camera.lookAt(target);
            const expressions = loaded?.vrm.expressionManager;
            if (expressions) {
                // A blink every few seconds, a fifth of a second long.
                const sinceBlink = (now % 3.4) / 0.2;
                expressions.setValue(
                    "blink",
                    sinceBlink < 1 ? Math.sin(sinceBlink * Math.PI) : 0
                );
                if (held) expressions.setValue(held, 1);
                expressions.update();
            }
            renderer.render(scene, camera);
        });
        return () => {
            disposed = true;
            renderer.setAnimationLoop(null);
            resize.disconnect();
            if (loaded) {
                loaded.figure.dispose();
                VRMUtils.deepDispose(loaded.vrm.scene);
            }
            renderer.dispose();
            renderer.domElement.remove();
            delete state.__figureAvatar;
        };
    }, [router.isReady, router.query]);
    return <div ref={ref} style={{ position: "fixed", inset: 0 }} />;
}

export function getServerSideProps() {
    return process.env.NODE_ENV === "development"
        ? { props: {} }
        : { notFound: true };
}
