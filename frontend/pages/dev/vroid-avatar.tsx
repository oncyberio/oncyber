import { useEffect, useRef } from "react";
import { useRouter } from "next/router";
import * as THREE from "three/webgpu";
import { VRMLoaderPlugin, VRMUtils } from "@pixiv/three-vrm";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { STAGEHAND_RECIPE } from "@features/procedural-avatar/vroid/recipe";
import { restyleVroid } from "@features/procedural-avatar/vroid/restyle";

/**
 * Local check for a character made from a VRoid base model: the base is
 * loaded, then reshaped and recoloured by a recipe, on a turntable.
 *
 * Query: `base` (a model under `/models/`, default the VRoid base body),
 * `plain=1` (the base untouched, to compare), `yaw` (degrees, stops the
 * turntable), `zoom=face`, `renderer=webgl`.
 */
export default function VroidAvatarFixture() {
    const ref = useRef<HTMLDivElement>(null);
    const router = useRouter();
    useEffect(() => {
        const host = ref.current;
        if (!host || !router.isReady) return;
        const text = (key: string) =>
            typeof router.query[key] === "string"
                ? (router.query[key] as string)
                : "";
        const file = /^[\w.-]+\.vrm$/.test(text("base"))
            ? text("base")
            : "fem_vroid.vrm";
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
        scene.add(new THREE.HemisphereLight(0xffffff, 0xb0a0a0, 2.2));
        const camera = new THREE.PerspectiveCamera(16, 1, 0.05, 60);
        const target = new THREE.Vector3(0, 0.88, 0);
        let distance = 6.6;
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
        const state = window as unknown as { __vroidAvatar?: unknown };
        state.__vroidAvatar = { status: "loading" };
        let disposed = false;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let vrm: any;
        const loader = new GLTFLoader();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        loader.register((parser: any) => {
            const plugin = new VRMLoaderPlugin(parser, {
                autoUpdateHumanBones: true,
            });
            // As the lobby loads avatars: plain glTF materials, no MToon.
            plugin.mtoonMaterialPlugin.getMaterialType = () => null;
            plugin.mtoonMaterialPlugin.extendMaterialParams = async () => {};
            return plugin;
        });
        void loader
            .loadAsync(`/models/${file}`)
            .then((gltf) => {
                if (disposed) return;
                vrm = gltf.userData.vrm;
                VRMUtils.rotateVRM0(vrm);
                scene.add(vrm.scene);
                vrm.scene.updateMatrixWorld(true);
                const styled =
                    text("plain") === "1"
                        ? null
                        : restyleVroid(vrm, STAGEHAND_RECIPE);
                const height = styled ? styled.height : 1.6;
                if (text("zoom") === "face") {
                    target.set(0, height - 0.13, 0);
                    distance = 1.6;
                } else target.set(0, height / 2, 0);
                state.__vroidAvatar = {
                    status: "ready",
                    file,
                    height,
                    triangles: styled?.triangles,
                };
            })
            .catch((error) => {
                state.__vroidAvatar = {
                    status: "error",
                    message: String(error?.message || error),
                };
            });
        const begin = performance.now();
        renderer.setAnimationLoop(() => {
            const angle = fixed ? yaw : (performance.now() - begin) / 6000;
            camera.position.set(
                target.x + Math.sin(angle) * distance,
                target.y,
                target.z + Math.cos(angle) * distance
            );
            camera.lookAt(target);
            renderer.render(scene, camera);
        });
        return () => {
            disposed = true;
            renderer.setAnimationLoop(null);
            resize.disconnect();
            if (vrm) VRMUtils.deepDispose(vrm.scene);
            renderer.dispose();
            renderer.domElement.remove();
            delete state.__vroidAvatar;
        };
    }, [router.isReady, router.query]);
    return <div ref={ref} style={{ position: "fixed", inset: 0 }} />;
}

export function getServerSideProps() {
    return process.env.NODE_ENV === "development"
        ? { props: {} }
        : { notFound: true };
}
