import { useEffect, useRef } from "react";
import { useRouter } from "next/router";
import * as THREE from "three/webgpu";
import { VRMUtils } from "@pixiv/three-vrm";
import {
    FIGURE_STYLES,
    FIGURE_URLS,
    STAGEHAND_STYLE,
    STANCES,
    blinkAt,
    createFigureCrowd,
    createFigurePoses,
    loadFigure,
    standFigure,
    variedLook,
    type FigureCrowd,
    type FigurePoses,
} from "@features/procedural-avatar/figure";

/** Stances a standing figure drifts between. */
const CALM = ["stand", "easy", "look"];

/**
 * Local check for a figure (a bare, texture-free humanoid) and a style
 * that makes it a character, on a turntable. It blinks, to show that its
 * face still moves.
 *
 * Query: `style` (`stagehand`, the default, or `plain` for the bare
 * figure), `form=basic` (the form a world draws: it blinks and opens its
 * mouth, and has no other expression), `expression` (one to hold, such as
 * `happy` or `aa`; the basic form has `aa` only), `stance` (`stand`,
 * `wave`, ...), `crowd` (a number: that many of the character drawn as
 * one, each a little different, and each with as much of its mesh as its
 * size on screen can show: `pixels` says to within how much of a pixel, a
 * quarter unless given, 0 for every figure whole), `yaw` (degrees, stops
 * the turntable), `zoom=face`, `renderer=webgl`.
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
        const many = Math.min(
            1024,
            Math.max(0, Math.floor(Number(text("crowd")) || 0))
        );
        const form = many || text("form") === "basic" ? "basic" : "full";
        const pixels = Number(text("pixels")) || 0;
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
        const camera = new THREE.PerspectiveCamera(16, 1, 0.05, 200);
        const face = text("zoom") === "face";
        // A crowd stands in rows, each row between the heads in front.
        const across = Math.ceil(Math.sqrt(many * 1.5));
        const deep = Math.ceil(many / Math.max(1, across));
        const target = many
            ? new THREE.Vector3(0, 0.8, (-(deep - 1) * 0.95) / 2)
            : new THREE.Vector3(0, face ? 1.56 : 0.88, 0);
        const distance = many ? 4 + across * 1.9 : face ? 1.5 : 6.6;
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
        let crowd: FigureCrowd | undefined;
        let poses: FigurePoses | undefined;
        void loadFigure(FIGURE_URLS.male, style, { form })
            .then((result) => {
                if (disposed) {
                    result.figure.dispose();
                    return;
                }
                loaded = result;
                const { vrm, figure } = result;
                const facing = figure.frames.forwardZ;
                if (many) {
                    const names = Object.keys(STANCES);
                    poses = createFigurePoses(figure, names.length);
                    names.forEach((name, row) => {
                        standFigure(vrm, STANCES[name], facing);
                        poses.capture(row);
                    });
                    crowd = createFigureCrowd(figure, {
                        capacity: many,
                        poses,
                    });
                    const place = new THREE.Object3D();
                    for (let i = 0; i < many; i++) {
                        const row = Math.floor(i / across);
                        place.position.set(
                            ((i % across) - (across - 1) / 2 + (row % 2) / 2) *
                                0.72,
                            0,
                            -row * 0.95
                        );
                        place.rotation.y = Math.sin(i * 2.4) * 0.5;
                        place.updateMatrix();
                        // The first as the style has it.
                        crowd.looks.set(i, i ? variedLook(style, i) : style);
                        crowd.set(i, {
                            matrix: place.matrix,
                            look: i,
                            seed: (i * 0.618) % 1,
                        });
                    }
                    crowd.count = many;
                    scene.add(crowd.object);
                } else {
                    const stance = STANCES[text("stance")];
                    if (stance) standFigure(vrm, stance, facing);
                    scene.add(vrm.scene);
                }
                state.__figureAvatar = {
                    status: "ready",
                    style: style.id,
                    form,
                    figures: many || 1,
                    triangles: figure.triangles * (many || 1),
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
        const calm = CALM.map((name) => Object.keys(STANCES).indexOf(name));
        renderer.setAnimationLoop(() => {
            const now = clock.getElapsedTime();
            const angle = fixed
                ? yaw
                : many
                ? Math.sin(now / 5) * 0.5
                : now / 6;
            camera.position.set(
                target.x + Math.sin(angle) * distance,
                target.y + (many ? distance * 0.42 : 0),
                target.z + Math.cos(angle) * distance
            );
            camera.lookAt(target);
            if (crowd) {
                // Each drifts between two ways of standing at its own
                // pace, and now and then says something.
                for (let i = 0; i < many; i++) {
                    const from = calm[i % calm.length];
                    const to = calm[(i + 1) % calm.length];
                    crowd.set(i, {
                        pose: [
                            from,
                            to,
                            0.5 + 0.5 * Math.sin(now * (0.5 + (i % 7) / 9) + i),
                        ],
                        talk:
                            i % 6 === 2
                                ? Math.max(0, Math.sin(now * 9 + i)) *
                                  Math.max(0, Math.sin(now * 0.7 + i))
                                : 0,
                    });
                }
                // Each as fine as its size on screen can show.
                camera.updateMatrixWorld();
                crowd.update(now, {
                    camera,
                    height: renderer.domElement.height,
                    pixels: text("pixels") === "" ? undefined : pixels,
                });
                const { figures, triangles, draws } = crowd.drawn;
                state.__figureAvatar = {
                    ...(state.__figureAvatar as object),
                    figures,
                    triangles,
                    draws,
                };
            } else if (loaded?.figure.face) {
                const { blink, talk } = loaded.figure.face;
                blink.value = blinkAt(now);
                talk.value = held === "aa" ? 1 : 0;
            } else if (loaded) {
                const expressions = loaded.vrm.expressionManager;
                expressions.setValue("blink", blinkAt(now));
                if (held) expressions.setValue(held, 1);
                expressions.update();
            }
            renderer.render(scene, camera);
        });
        return () => {
            disposed = true;
            renderer.setAnimationLoop(null);
            resize.disconnect();
            crowd?.dispose();
            poses?.dispose();
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
