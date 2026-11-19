import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import { cartoonCast } from "@features/procedural-avatars/cartoonCast";
import {
    characters,
    previewRecipe,
} from "@features/procedural-avatars/catalog";
import type { LobbyAvatar } from "@features/lobby/webgpu/avatarAdapter";

export default function ProceduralCrowdStudy({ seeds }: { seeds?: string[] }) {
    const router = useRouter();
    const cartoon = router.query.cast === "cartoon";
    const canvas = useRef<HTMLCanvasElement>(null);
    const [message, setMessage] = useState("Preparing recipes…");
    useEffect(() => {
        const local: ReturnType<typeof previewRecipe>[] = [];
        let stopped = false,
            dispose = () => {};
        (async () => {
            const [T, { LobbyAvatarCrowd }] = await Promise.all([
                import("three/webgpu"),
                import("@features/lobby/webgpu/avatarCrowd"),
            ]);
            if (stopped) return;
            const params = new URLSearchParams(location.search),
                count = Math.min(
                    100,
                    Math.max(
                        1,
                        parseInt(params.get("count") ?? "100", 10) || 100
                    )
                );
            const renderer = new T.WebGPURenderer({
                canvas: canvas.current,
                antialias: true,
                forceWebGL: params.get("renderer") === "webgl",
            });
            await renderer.init();
            if (stopped) {
                renderer.dispose();
                return;
            }
            renderer.setPixelRatio(Math.min(1.5, devicePixelRatio));
            const backend = renderer.backend.constructor.name,
                scene = new T.Scene();
            scene.background = new T.Color("#e8e2d6");
            const camera = new T.OrthographicCamera(-10, 10, 10, -10, 0.1, 100);
            const crowd = new LobbyAvatarCrowd(scene, renderer),
                avatars: LobbyAvatar[] = [];
            let frame = 0;
            dispose = () => {
                cancelAnimationFrame(frame);
                crowd.dispose();
                avatars.forEach((a) => a.dispose());
                renderer.dispose();
            };
            const cols = Math.ceil(Math.sqrt(count)),
                rows = Math.ceil(count / cols),
                start = performance.now();
            const families =
                params.get("cast") === "cartoon"
                    ? cartoonCast.map((c) => "cast-" + c.id)
                    : characters.map((c) => c.id);
            const authored = [...new Set(params.getAll("guest"))]
                .filter((id) => /^[a-z][a-z0-9-]{0,63}$/.test(id))
                .slice(0, count);
            if (seeds) {
                const { studyCrowdMember } = await import(
                    "@features/procedural-avatars/studyCrowd"
                );
                if (stopped) return;
                for (let i = 0; i < count; i++)
                    local.push(
                        previewRecipe(
                            studyCrowdMember(seeds[i % seeds.length], i)
                        )
                    );
            }
            const distinct = new Set(
                local.map(({ recipe }) =>
                    recipe.cartoon
                        ? recipe.cartoon.head.join("/") +
                          recipe.cartoon.outfit.color
                        : [recipe.headWidth, recipe.crownLength].join("/")
                )
            ).size;
            for (let i = 0; i < count; i += 4) {
                const batch = await Promise.all(
                    Array.from(
                        { length: Math.min(4, count - i) },
                        async (_, j) => {
                            const k = i + j,
                                id = families[k % families.length];
                            const source =
                                local[k]?.slug ??
                                (k < authored.length
                                    ? "drawn-" + authored[k]
                                    : id + "/" + k);
                            const avatar = await crowd.create(
                                "/models/procedural/" + source
                            );
                            if (stopped) {
                                avatar.dispose();
                                return;
                            }
                            const col = k % cols,
                                row = Math.floor(k / cols);
                            avatar.root.position.set(
                                ((cols - 1) * 0.5 - col) * 1.72,
                                ((rows - 1) * 0.5 - row) * 2.45,
                                0
                            );
                            scene.add(avatar.root);
                            return avatar;
                        }
                    )
                );
                if (stopped) return;
                avatars.push(...batch);
                setMessage(`Preparing ${avatars.length} / ${count} recipes…`);
                await new Promise<void>((resolve) =>
                    requestAnimationFrame(() => resolve())
                );
            }
            const readyMs = performance.now() - start;
            let last = 0,
                frames = 0,
                avatarCalls = 0;
            const draw = (now: number) => {
                if (stopped) return;
                const el = canvas.current,
                    w = el.clientWidth,
                    h = el.clientHeight;
                if (
                    el.width !== Math.floor(w * renderer.getPixelRatio()) ||
                    el.height !== Math.floor(h * renderer.getPixelRatio())
                )
                    renderer.setSize(w, h, false);
                const half = Math.max(
                        (rows * 2.45) / 2,
                        (((cols * 1.72) / 2) * h) / w
                    ),
                    aspect = w / h;
                camera.left = -half * aspect;
                camera.right = half * aspect;
                camera.top = half;
                camera.bottom = -half;
                camera.position.set(0, 0.93, -30);
                camera.lookAt(0, 0.93, 0);
                camera.updateProjectionMatrix();
                camera.updateMatrixWorld();
                const dt = Math.min(0.08, (now - last) / 1000);
                last = now;
                avatars.forEach((a, i) =>
                    a.update(dt, ["IDLE", "WALK", "RUN"][i % 3])
                );
                crowd.flush(camera);
                if (frames === 0)
                    scene.traverse((object) => {
                        const mesh = object as InstanceType<typeof T.Mesh>;
                        if (!mesh.isMesh) return;
                        let before = 0;
                        mesh.onBeforeRender = () => {
                            before = renderer.info.render.drawCalls;
                        };
                        mesh.onAfterRender = () => {
                            avatarCalls +=
                                renderer.info.render.drawCalls - before;
                        };
                    });
                avatarCalls = 0;
                renderer.info.reset();
                renderer.render(scene, camera);
                const stats = renderer.info.render;
                el.dataset.calls = String(avatarCalls);
                el.dataset.frameCalls = String(stats.drawCalls);
                el.dataset.visible = String(crowd.stats.visible);
                el.dataset.backend = backend;
                el.dataset.authored = String(local.length || authored.length);
                if (local.length) el.dataset.distinct = String(distinct);
                el.dataset.triangles = String(stats.triangles);
                el.dataset.readyMs = String(Math.round(readyMs));
                if (frames++ === 0)
                    setMessage(
                        `${
                            crowd.stats.visible
                        } recipes · ${avatarCalls} avatar draw · ${
                            stats.drawCalls
                        } total draws · ${stats.triangles.toLocaleString()} triangles · ${backend}`
                    );
                frame = requestAnimationFrame(draw);
            };
            frame = requestAnimationFrame(draw);
        })().catch((error) => {
            if (!stopped) setMessage(error.message);
        });
        return () => {
            stopped = true;
            dispose();
            local.forEach((entry) => entry.release());
        };
    }, [router.asPath, seeds]);
    return (
        <main>
            <Head>
                <title>Recipe crowd · Oncyber</title>
            </Head>
            <header>
                <h1>Recipe crowd</h1>
                <Link
                    href={
                        seeds
                            ? "/preview/studies/rowan"
                            : cartoon
                            ? "/dev/cartoon-cast"
                            : "/dev/procedural-avatars"
                    }
                >
                    Avatar studies
                </Link>
            </header>
            <canvas
                ref={canvas}
                aria-label="Independently animated procedural recipes"
            />
            <output>{message}</output>
            <style jsx>{`
                main {
                    height: 100vh;
                    display: flex;
                    flex-direction: column;
                    background: #f7f5ef;
                    color: #282720;
                    font-family: system-ui;
                }
                header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 12px 4vw;
                }
                h1 {
                    font: 36px Georgia;
                    margin: 0;
                }
                canvas {
                    min-height: 0;
                    width: 100%;
                    flex: 1;
                }
                output {
                    padding: 12px 4vw;
                    font-size: 14px;
                }
            `}</style>
        </main>
    );
}

export function getServerSideProps() {
    return process.env.NODE_ENV === "development"
        ? { props: {} }
        : { notFound: true };
}
