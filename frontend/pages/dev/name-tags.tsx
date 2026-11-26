import { useEffect, useRef } from "react";
import { useRouter } from "next/router";
import * as THREE from "three/webgpu";
import { createNameTags } from "@features/name-tags/nameTags";
import { LOBBY_GUEST_PORTRAIT } from "@features/lobby/lobbyIdentity";

const NAMES = [
    "rayan",
    "Anon-3f9a",
    "jackbutcher",
    "a_very_long_display_name_that_keeps_going",
    "6529er",
    "Mfer #4212",
    "ÉLODIE",
    "kō",
    "visitor",
    "0x8f3…a91c",
    "Murakami fan club",
    "z",
];

/**
 * Local check for the name tags over avatars: a crowd of stand-ins, a wall
 * that hides some of them, and a slowly orbiting camera.
 */
export default function NameTagsFixture() {
    const ref = useRef<HTMLDivElement>(null);
    const router = useRouter();
    useEffect(() => {
        const host = ref.current;
        if (!host || !router.isReady) return;
        const forceWebGL = router.query.renderer === "webgl";
        const radius = Number(router.query.radius) || 7;
        const still = router.query.still === "1";
        const picture =
            typeof router.query.photo === "string"
                ? router.query.photo
                : LOBBY_GUEST_PORTRAIT;
        const renderer = new THREE.WebGPURenderer({
            antialias: true,
            forceWebGL,
        });
        renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
        host.append(renderer.domElement);
        const scene = new THREE.Scene();
        scene.background = new THREE.Color("#5d6f86");
        scene.add(new THREE.HemisphereLight("#ffffff", "#334", 2));
        const camera = new THREE.PerspectiveCamera(
            60,
            host.clientWidth / host.clientHeight,
            0.1,
            200
        );
        const floor = new THREE.Mesh(
            new THREE.PlaneGeometry(80, 80),
            new THREE.MeshStandardNodeMaterial({ color: "#c9c4b8" })
        );
        floor.rotation.x = -Math.PI / 2;
        scene.add(floor);
        const wall = new THREE.Mesh(
            new THREE.BoxGeometry(4, 3, 0.3),
            new THREE.MeshStandardNodeMaterial({ color: "#8a5a44" })
        );
        wall.position.set(-3, 1.5, -2);
        scene.add(wall);
        const body = new THREE.CapsuleGeometry(0.3, 1.1);
        const people = NAMES.map((name, i) => {
            const mesh = new THREE.Mesh(
                body,
                new THREE.MeshStandardNodeMaterial({
                    color: new THREE.Color().setHSL(i / NAMES.length, 0.4, 0.6),
                })
            );
            const angle = (i / NAMES.length) * Math.PI * 2;
            const r = 2 + (i % 4) * 3;
            mesh.position.set(Math.cos(angle) * r, 0.85, Math.sin(angle) * r);
            scene.add(mesh);
            return { name, mesh, photo: i % 5 === 3 ? "" : picture };
        });
        const tags = createNameTags(scene, 64, {
            fallbackPhoto: LOBBY_GUEST_PORTRAIT,
        });
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
        let frame = 0;
        const start = performance.now();
        renderer.setAnimationLoop(() => {
            const t = still ? 0 : (performance.now() - start) / 9000;
            camera.position.set(
                Math.cos(t) * radius,
                2.2,
                Math.sin(t) * radius
            );
            camera.lookAt(0, 1.4, 0);
            camera.updateMatrixWorld();
            tags.begin();
            for (const person of people)
                tags.show(
                    person.name,
                    person.name,
                    person.photo,
                    person.mesh.position.x,
                    person.mesh.position.y + 0.85 + 0.3,
                    person.mesh.position.z
                );
            tags.end(camera, host.clientHeight);
            renderer.render(scene, camera);
            frame++;
        });
        return () => {
            renderer.setAnimationLoop(null);
            resize.disconnect();
            tags.dispose();
            renderer.dispose();
            renderer.domElement.remove();
            void frame;
        };
    }, [router.isReady, router.query]);
    return <div ref={ref} style={{ position: "fixed", inset: 0 }} />;
}

export function getServerSideProps() {
    return process.env.NODE_ENV === "development"
        ? { props: {} }
        : { notFound: true };
}
