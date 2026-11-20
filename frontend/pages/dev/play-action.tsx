import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { baseTokens, lobbyTokens } from "@styles/tokens";
import library from "@features/play-zone/actions.json";
import { JOINTS, actionPose } from "@features/play-zone/rig";
import {
    readPlayAction,
    type ActionPoint,
} from "../../../multiplayer/protocol/play-action";

/**
 * Local check for play actions (how a person moves for a moment), written
 * by scripts/play-action.mjs into features/play-zone/actions.json. It plays
 * one on a plain jointed figure, with a ball where the action's hit lands.
 *
 * ?action=volleyball-spike   which one (default: the first)
 * ?strip=8                   show that many instants side by side, as a film strip
 * ?t=0.5                     hold one instant instead of playing
 * ?view=side | front         where to look from (default: three-quarter)
 * ?renderer=webgl            the WebGL2 backend
 */
const NAMES = Object.keys(library);
/** Where the thing being hit is, for actions that reach for one: up and in front. */
const BALL: ActionPoint = [0.15, 1.85, 0.4];

export default function PlayActionCheck() {
    const router = useRouter();
    const host = useRef<HTMLDivElement>(null);
    const [error, setError] = useState("");
    const name = String(router.query.action || NAMES[0] || "");
    const entry = (library as Record<string, any>)[name];

    useEffect(() => {
        if (!router.isReady || !host.current) return;
        const action = readPlayAction(entry);
        const strip = Math.min(
            12,
            Math.max(0, Number(router.query.strip) || 0)
        );
        const held =
            router.query.t === undefined ? null : Number(router.query.t);
        const view = String(router.query.view || "");
        const forceWebGL = router.query.renderer === "webgl";
        let disposed = false;
        const disposers: Array<() => void> = [];

        (async () => {
            const THREE = await import("three/webgpu");
            const { createMannequin } = await import(
                "@features/play-zone/mannequin"
            );
            if (disposed) return;
            const renderer = new THREE.WebGPURenderer({
                antialias: true,
                forceWebGL,
            });
            await renderer.init();
            if (disposed) return renderer.dispose();
            renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
            host.current.appendChild(renderer.domElement);

            const scene = new THREE.Scene();
            scene.background = new THREE.Color(baseTokens.color.black);
            scene.add(
                new THREE.HemisphereLight(
                    baseTokens.color.white,
                    baseTokens.color.muted,
                    1.8
                )
            );
            const sun = new THREE.DirectionalLight(baseTokens.color.white, 2);
            sun.position.set(3, 6, 5);
            scene.add(sun);
            const count = strip || 1;
            const spacing = 1.3;
            const floor = new THREE.Mesh(
                new THREE.BoxGeometry(count * spacing + 2, 0.04, 3),
                new THREE.MeshStandardMaterial({
                    color: baseTokens.color.paperInk,
                    roughness: 0.9,
                })
            );
            floor.position.y = -0.02;
            scene.add(floor);

            // The camera always looks from the front; each figure is turned
            // instead, so a strip stays a row across the screen from any side.
            const facing =
                view === "side"
                    ? Math.PI / 2
                    : view === "front"
                    ? 0
                    : Math.PI / 5;
            const figures = Array.from({ length: count }, (_, i) => {
                const figure = createMannequin(THREE);
                figure.group.position.x = (i - (count - 1) / 2) * spacing;
                figure.group.rotation.y = facing;
                scene.add(figure.group);
                const ball = new THREE.Mesh(
                    new THREE.SphereGeometry(0.12, 16, 12),
                    new THREE.MeshStandardMaterial({
                        color: baseTokens.color.selectionEnd,
                        transparent: true,
                    })
                );
                ball.position.set(BALL[0], BALL[1], BALL[2]);
                ball.visible = action?.contact != null;
                figure.group.add(ball);
                return { figure, ball };
            });

            // No perspective: every figure in a strip is seen from the same
            // side, so they can be compared.
            const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
            camera.position.set(0, 1.25, 20);
            camera.lookAt(0, 1.25, 0);
            let aspect = 1;
            const frame = () => {
                // Wide enough for the row, tall enough for a jump.
                const half = Math.max(
                    (count * spacing + 0.4) / 2 / aspect,
                    1.45
                );
                camera.left = -half * aspect;
                camera.right = half * aspect;
                camera.top = half;
                camera.bottom = -half;
                camera.updateProjectionMatrix();
            };
            const resize = () => {
                const { clientWidth, clientHeight } = host.current;
                renderer.setSize(clientWidth, clientHeight);
                aspect = clientWidth / Math.max(1, clientHeight);
                frame();
            };
            resize();
            window.addEventListener("resize", resize);

            const pose = new Float32Array(JOINTS.length * 3);
            const started = performance.now();
            renderer.setAnimationLoop((now: number) => {
                // Play, then stand for half a second before the next time.
                const seconds = action?.seconds ?? 1;
                const cycle = ((now - started) / 1000) % (seconds + 0.5);
                const playing = Math.min(1, cycle / seconds);
                figures.forEach(({ figure, ball }, i) => {
                    const t = strip ? (i + 0.5) / count : held ?? playing;
                    figure.update(actionPose(action, t, BALL, pose));
                    // The ball is there until it is hit.
                    if (action?.contact != null)
                        (ball.material as any).opacity =
                            t <= action.contact + 0.02 ? 1 : 0.15;
                });
                renderer.render(scene, camera);
                document.documentElement.dataset.playAction = JSON.stringify({
                    name: action?.name ?? null,
                    drawn: true,
                });
            });
            disposers.push(() => {
                renderer.setAnimationLoop(null);
                window.removeEventListener("resize", resize);
                figures.forEach(({ figure }) => figure.dispose());
                renderer.domElement.remove();
                renderer.dispose();
            });
        })().catch((reason) => !disposed && setError(String(reason)));

        return () => {
            disposed = true;
            while (disposers.length) disposers.pop()();
        };
    }, [
        router.isReady,
        entry,
        router.query.strip,
        router.query.t,
        router.query.view,
        router.query.renderer,
    ]);

    const control = lobbyTokens.control;
    return (
        <main
            style={{
                position: "fixed",
                inset: 0,
                background: baseTokens.color.black,
                color: lobbyTokens.color.ink,
                font: `${baseTokens.font.size.md}px ${baseTokens.font.sans}`,
            }}
        >
            <div ref={host} style={{ position: "absolute", inset: 0 }} />
            <div
                style={{
                    position: "absolute",
                    left: 16,
                    top: 16,
                    right: 16,
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                    alignItems: "center",
                }}
            >
                {NAMES.map((id) => (
                    <button
                        key={id}
                        type="button"
                        aria-pressed={id === name}
                        onClick={() =>
                            router.replace({
                                query: { ...router.query, action: id },
                            })
                        }
                        style={{
                            minHeight: control.size,
                            padding: "0 14px",
                            borderRadius: control.radius,
                            border: `1px solid ${
                                id === name
                                    ? control.pressedBorder
                                    : control.border
                            }`,
                            background:
                                id === name
                                    ? control.pressed
                                    : control.background,
                            color: lobbyTokens.color.controlInk,
                            font: "inherit",
                            cursor: "pointer",
                        }}
                    >
                        {id}
                    </button>
                ))}
            </div>
            <div
                style={{
                    position: "absolute",
                    left: 16,
                    bottom: 16,
                    color: lobbyTokens.color.meta,
                }}
            >
                {error ||
                    (entry
                        ? `“${entry.description}” · ${entry.seconds} s · ${entry.moments.length} moments`
                        : "No actions yet. Write one with scripts/play-action.mjs.")}
            </div>
        </main>
    );
}

export function getServerSideProps() {
    return process.env.NODE_ENV === "development"
        ? { props: {} }
        : { notFound: true };
}
