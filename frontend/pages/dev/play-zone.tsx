import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { baseTokens, lobbyTokens } from "@styles/tokens";
import { STARTER_RECIPES } from "@features/play-zone/recipes";
import { smoothPoses } from "@features/play-zone/smoothing";
import {
    PLAY_LIMITS,
    decodeBodies,
    decodePeople,
    playBodies,
    readPlayRecipe,
    type PlayPerson,
    type PlayRecipe,
} from "../../../multiplayer/protocol/play-zone";

/**
 * Local check for play zones: server physics for short games, before it is
 * part of the lobby. Run `npm --prefix multiplayer run play:dev`, then open
 * this page in one or more tabs. Each tab is a person.
 *
 *   W A S D or the arrows   walk
 *   Space                   hit what is in front of you
 *
 * ?server=ws://127.0.0.1:2570   the play server
 * ?renderer=webgl               the WebGL2 backend
 * ?start=ball-pit               start that game on arrival
 *
 * What the page knows is written to <html data-play-zone> as JSON.
 */
type Status = {
    connected: boolean;
    title: string;
    things: number;
    heardAbout: number;
    score: [number, number];
    secondsLeft: number;
    people: number;
    stepMs: number;
    done: boolean;
    kilobytesPerSecond: number;
};

const EMPTY: Status = {
    connected: false,
    title: "",
    things: 0,
    heardAbout: 0,
    score: [0, 0],
    secondsLeft: 0,
    people: 0,
    stepMs: 0,
    done: false,
    kilobytesPerSecond: 0,
};
const WALK_SPEED = 5;

export default function PlayZoneCheck() {
    const router = useRouter();
    const host = useRef<HTMLDivElement>(null);
    const startGame = useRef<(recipe: unknown) => void>(() => {});
    const [status, setStatus] = useState<Status>(EMPTY);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!router.isReady || !host.current) return;
        const server = String(router.query.server || "ws://127.0.0.1:2570");
        const forceWebGL = router.query.renderer === "webgl";
        const startId = String(router.query.start || "");
        let disposed = false;
        const disposers: Array<() => void> = [];

        (async () => {
            const THREE = await import("three/webgpu");
            const { createPlayScene } = await import(
                "@features/play-zone/scene"
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
            const view = createPlayScene(THREE);
            const resize = () => {
                const { clientWidth, clientHeight } = host.current;
                renderer.setSize(clientWidth, clientHeight);
                view.resize(clientWidth, clientHeight);
            };
            resize();
            window.addEventListener("resize", resize);

            // What the server last said, and what is drawn.
            let recipe: PlayRecipe | null = null;
            let target = new Float32Array(0),
                shown = new Float32Array(0),
                known = new Uint8Array(0);
            let others: PlayPerson[] = [];
            const self: PlayPerson = {
                id: 0,
                x: (Math.random() - 0.5) * 6,
                y: 0,
                z: 3 + Math.random() * 2,
                yaw: Math.PI,
            };
            const live = { ...EMPTY };
            let bytes = 0;

            const socket = new WebSocket(server);
            socket.binaryType = "arraybuffer";
            const send = (message: unknown) =>
                socket.readyState === 1 && socket.send(JSON.stringify(message));
            startGame.current = (value) =>
                send({ type: "start", recipe: value });
            socket.onopen = () => {
                live.connected = true;
                const starter = STARTER_RECIPES.find(
                    ({ id }) => id === startId
                );
                if (starter) send({ type: "start", recipe: starter.recipe });
            };
            socket.onclose = () => {
                live.connected = false;
                if (!disposed)
                    setError(
                        `No play server at ${server}. Run: npm --prefix multiplayer run play:dev`
                    );
            };
            socket.onmessage = (event) => {
                if (typeof event.data !== "string") {
                    const frame = new Uint8Array(event.data);
                    bytes += frame.byteLength;
                    const bodies = decodeBodies(frame, target);
                    if (bodies) {
                        for (const index of bodies.indices)
                            if (!known[index]) known[index] = 1;
                        return;
                    }
                    const people = decodePeople(frame);
                    if (people) others = people.people;
                    return;
                }
                const message = JSON.parse(event.data);
                if (message.type === "welcome") self.id = message.id;
                else if (message.type === "game") {
                    recipe = readPlayRecipe(message.recipe);
                    if (!recipe) return;
                    const count = playBodies(recipe).length;
                    target = new Float32Array(count * 7);
                    shown = new Float32Array(count * 7);
                    known = new Uint8Array(count);
                    view.setRecipe(recipe);
                    Object.assign(live, {
                        title: recipe.title,
                        things: count,
                        score: [0, 0],
                        secondsLeft: recipe.seconds,
                        done: false,
                    });
                } else if (message.type === "state")
                    Object.assign(live, {
                        score: message.score,
                        secondsLeft: message.secondsLeft,
                        people: message.people,
                        stepMs: message.stepMs,
                        done: message.done,
                    });
            };

            const held = new Set<string>();
            const keyDown = (event: KeyboardEvent) => {
                if (event.code === "Space") {
                    event.preventDefault();
                    if (!event.repeat) send({ type: "hit" });
                } else held.add(event.code);
            };
            const keyUp = (event: KeyboardEvent) => held.delete(event.code);
            window.addEventListener("keydown", keyDown);
            window.addEventListener("keyup", keyUp);

            let last = performance.now(),
                sentAt = 0,
                reportedAt = 0;
            renderer.setAnimationLoop((now: number) => {
                const seconds = Math.min(0.1, (now - last) / 1000);
                last = now;
                // Walk: the camera looks down -z, so "up" is away from it.
                const dx =
                    Number(held.has("KeyD") || held.has("ArrowRight")) -
                    Number(held.has("KeyA") || held.has("ArrowLeft"));
                const dz =
                    Number(held.has("KeyS") || held.has("ArrowDown")) -
                    Number(held.has("KeyW") || held.has("ArrowUp"));
                if (dx || dz) {
                    const length = Math.hypot(dx, dz);
                    const limitX = (recipe?.arena.halfX ?? 8) - 0.4,
                        limitZ = (recipe?.arena.halfZ ?? 8) - 0.4;
                    self.x = Math.max(
                        -limitX,
                        Math.min(
                            limitX,
                            self.x + (dx / length) * WALK_SPEED * seconds
                        )
                    );
                    self.z = Math.max(
                        -limitZ,
                        Math.min(
                            limitZ,
                            self.z + (dz / length) * WALK_SPEED * seconds
                        )
                    );
                    self.yaw = Math.atan2(dx, dz);
                }
                // The server is told where this person is 20 times a second.
                if (now - sentAt >= 50) {
                    sentAt = now;
                    send({
                        type: "pose",
                        x: self.x,
                        y: self.y,
                        z: self.z,
                        yaw: self.yaw,
                    });
                }
                smoothPoses(shown, target, known, seconds);
                view.draw(shown, known);
                view.drawPeople(others, self.id ? self : null, seconds);
                renderer.render(view.scene, view.camera);
                if (now - reportedAt >= 500) {
                    live.kilobytesPerSecond =
                        Math.round((bytes / (now - reportedAt)) * 10) / 10;
                    bytes = 0;
                    reportedAt = now;
                    live.heardAbout = known.reduce(
                        (n, k) => n + (k ? 1 : 0),
                        0
                    );
                    const next = {
                        ...live,
                        score: [...live.score] as [number, number],
                    };
                    document.documentElement.dataset.playZone = JSON.stringify({
                        ...next,
                        self: { id: self.id, x: self.x, z: self.z },
                    });
                    setStatus(next);
                }
            });

            disposers.push(() => {
                renderer.setAnimationLoop(null);
                window.removeEventListener("resize", resize);
                window.removeEventListener("keydown", keyDown);
                window.removeEventListener("keyup", keyUp);
                socket.onclose = null;
                socket.close();
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
        router.query.server,
        router.query.renderer,
        router.query.start,
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
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    maxWidth: 320,
                }}
            >
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {STARTER_RECIPES.map(({ id, label, recipe }) => (
                        <button
                            key={id}
                            type="button"
                            data-start={id}
                            onClick={() => startGame.current(recipe)}
                            style={{
                                minHeight: control.size,
                                padding: "0 14px",
                                borderRadius: control.radius,
                                border: `1px solid ${control.border}`,
                                background: control.background,
                                color: lobbyTokens.color.controlInk,
                                font: "inherit",
                                cursor: "pointer",
                            }}
                        >
                            {label}
                        </button>
                    ))}
                </div>
                <div
                    data-play-status
                    style={{
                        padding: "10px 12px",
                        borderRadius: control.radius,
                        border: `1px solid ${control.border}`,
                        background: control.notice,
                        lineHeight: 1.5,
                    }}
                >
                    {error ? (
                        <span>{error}</span>
                    ) : !status.connected ? (
                        <span>Connecting…</span>
                    ) : !status.title ? (
                        <span>
                            Pick a game. Open this page in a second tab to play
                            together.
                        </span>
                    ) : (
                        <>
                            <strong>{status.title}</strong>
                            {status.done
                                ? " · finished"
                                : ` · ${status.secondsLeft} s left`}
                            <br />
                            Side A {status.score[0]} : {status.score[1]} Side B
                            <br />
                            <span style={{ color: lobbyTokens.color.meta }}>
                                {status.people} here · {status.heardAbout} of{" "}
                                {status.things} things (limit{" "}
                                {PLAY_LIMITS.bodies}) · server step{" "}
                                {status.stepMs} ms · {status.kilobytesPerSecond}{" "}
                                kB/s
                            </span>
                        </>
                    )}
                </div>
                <div style={{ color: lobbyTokens.color.meta }}>
                    W A S D to walk · Space to hit
                </div>
            </div>
        </main>
    );
}

export function getServerSideProps() {
    return process.env.NODE_ENV === "development"
        ? { props: {} }
        : { notFound: true };
}
