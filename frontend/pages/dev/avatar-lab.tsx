import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import {
    AUTHORED_AVATARS,
    loadAuthoredAvatar,
} from "@features/toon-avatar/authored/catalogue";
import { decodeRecipe } from "@features/toon-avatar/codec";
import { TOON_AVATAR_PRESETS } from "@features/toon-avatar/presets";

/**
 * Bench for writing an avatar from a picture. Draws one avatar from fixed
 * angles in a single frame, beside (or under) the reference picture, so
 * each change to its code can be compared with the reference at a glance
 * or from a screenshot.
 *
 * ?avatar=<authored id> | ?a=<avatar code> | ?preset=<starter id>
 * ?ref=<image url>          reference picture (or drop an image on the page)
 * ?views=0,35,90,180        camera angles in degrees (0 is the front)
 * ?pose=stand|tpose|walk|wave|...   any maker move; tpose is the rest pose
 * ?t=0.4                    seconds into the move (the frame is frozen)
 * ?focus=body|head          what the views frame
 * ?overlay=0.5              lay the reference over the first view
 * ?renderer=webgl           the WebGL2 backend
 *
 * <html data-avatar-lab> is "ready" once drawn, or "failed".
 */
const VIEW = { width: 380, height: 620 };

export default function AvatarLab() {
    const router = useRouter();
    const host = useRef<HTMLDivElement>(null);
    const [reference, setReference] = useState("");
    const [overlay, setOverlay] = useState(0);
    const [title, setTitle] = useState("");

    useEffect(() => {
        if (!router.isReady) return;
        const q = router.query;
        if (typeof q.ref === "string") setReference(q.ref);
        if (q.overlay) setOverlay(Number(q.overlay) || 0);
    }, [router.isReady, router.query]);

    useEffect(() => {
        if (!router.isReady || !host.current) return;
        const q = router.query;
        const root = document.documentElement;
        root.dataset.avatarLab = "loading";
        let disposed = false;
        let cleanup = () => {};
        (async () => {
            const THREE = await import("three/webgpu");
            const { ToonAvatar } = await import(
                "@features/toon-avatar/three/avatar"
            );
            const { ToonAnimator, TOON_MOTIONS } = await import(
                "@features/toon-avatar/three/motion"
            );
            const authored = await loadAuthoredAvatar(q.avatar);
            const preset = TOON_AVATAR_PRESETS.find((p) => p.id === q.preset);
            const avatar = new ToonAvatar(
                decodeRecipe(q.a) || preset?.recipe || authored?.recipe,
                authored || undefined
            );
            setTitle(authored?.name || preset?.name || "Avatar");
            const angles = String(q.views || "0,35,90,180")
                .split(",")
                .map(Number)
                .filter(Number.isFinite);
            const pose = String(q.pose || "stand");
            if (pose !== "tpose") {
                const animator = new ToonAnimator(
                    (name) => avatar.bones[name as keyof typeof avatar.bones],
                    avatar.layout,
                    () => 0.99
                );
                const move = TOON_MOTIONS.find((m) => m === pose) || "idle";
                animator.play(move, 0.001);
                // Step to the asked moment, then hold that frame.
                const until = Number(q.t) || 0.001;
                for (let t = 0; t < until; t += 1 / 60) animator.update(1 / 60);
                animator.update(0.0001);
            }
            avatar.setExpression({});

            const renderer = new THREE.WebGPURenderer({
                antialias: true,
                forceWebGL: q.renderer === "webgl",
            });
            renderer.setPixelRatio(1);
            renderer.setSize(VIEW.width * angles.length, VIEW.height);
            renderer.outputColorSpace = THREE.SRGBColorSpace;
            renderer.setClearColor(0x8d939c, 1);
            renderer.autoClear = false;
            host.current.appendChild(renderer.domElement);
            cleanup = () => {
                renderer.domElement.remove();
                renderer.dispose();
                avatar.dispose();
            };
            await renderer.init();
            if (disposed) return cleanup();

            const scene = new THREE.Scene();
            scene.add(avatar.root);
            const { layout } = avatar;
            const top = layout.height + layout.head.size * 0.8;
            const from =
                q.focus === "head"
                    ? layout.head.center[1] - layout.head.down * 1.8
                    : -0.03;
            // Orthographic, so the views line up with a flat reference drawing.
            const half = ((top - from) * 1.04) / 2;
            const aspect = VIEW.width / VIEW.height;
            const camera = new THREE.OrthographicCamera(
                -half * aspect,
                half * aspect,
                half,
                -half,
                0.1,
                50
            );
            const middle = (from + top) / 2;
            renderer.clear();
            renderer.setScissorTest(true);
            angles.forEach((degrees, index) => {
                const angle = THREE.MathUtils.degToRad(degrees);
                camera.position.set(
                    Math.sin(angle) * 10,
                    middle,
                    Math.cos(angle) * 10
                );
                camera.lookAt(0, middle, 0);
                renderer.setViewport(
                    index * VIEW.width,
                    0,
                    VIEW.width,
                    VIEW.height
                );
                renderer.setScissor(
                    index * VIEW.width,
                    0,
                    VIEW.width,
                    VIEW.height
                );
                renderer.render(scene, camera);
            });
            root.dataset.avatarLab = "ready";
        })().catch((error) => {
            console.error(error);
            root.dataset.avatarLab = "failed";
        });
        return () => {
            disposed = true;
            cleanup();
            delete root.dataset.avatarLab;
        };
    }, [router.isReady, router.query]);

    return (
        <main
            style={{
                minHeight: "100vh",
                padding: 16,
                background: "#14161b",
                color: "#f3f3f1",
                font: "13px/1.5 monospace",
            }}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
                event.preventDefault();
                const file = event.dataTransfer.files[0];
                if (file?.type.startsWith("image/"))
                    setReference(URL.createObjectURL(file));
            }}
        >
            <p style={{ margin: "0 0 12px" }}>
                Avatar lab · {title} ·{" "}
                {AUTHORED_AVATARS.map((item) => (
                    <a
                        key={item.id}
                        href={`?avatar=${item.id}`}
                        style={{ color: "#9db8ff", marginRight: 12 }}
                    >
                        {item.name}
                    </a>
                ))}
                {reference ? (
                    <label>
                        overlay{" "}
                        <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.05}
                            value={overlay}
                            onChange={(event) =>
                                setOverlay(Number(event.target.value))
                            }
                        />
                    </label>
                ) : (
                    "drop a reference picture here"
                )}
            </p>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <div ref={host} style={{ position: "relative" }}>
                    {reference && overlay > 0 && (
                        <img
                            src={reference}
                            alt=""
                            style={{
                                position: "absolute",
                                left: 0,
                                top: 0,
                                width: VIEW.width,
                                height: VIEW.height,
                                objectFit: "contain",
                                opacity: overlay,
                                pointerEvents: "none",
                            }}
                        />
                    )}
                </div>
                {reference && (
                    <img
                        src={reference}
                        alt="Reference"
                        style={{ height: VIEW.height, objectFit: "contain" }}
                    />
                )}
            </div>
        </main>
    );
}
