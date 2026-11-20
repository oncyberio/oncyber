import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { baseTokens, lobbyTokens } from "@styles/tokens";
import { STARTER_RECIPES } from "@features/play-zone/recipes";
import {
    poseBuffers,
    smoothPoses,
    type PoseBuffers,
} from "@features/play-zone/smoothing";
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
 * The game in play can be changed without anyone reloading: edit the recipe
 * in the box and apply it, or use the quick changes. A change that fits the
 * game as it stands takes over in place. One that does not (a different
 * size of ball, an arena too small for where people are) plays the round
 * backwards to its start first.
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
    rewinding: boolean;
    /** How the last recipe arrived, and how many arrived each way. */
    lastChange: "" | "start" | "live" | "reset";
    liveChanges: number;
    resets: number;
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
    rewinding: false,
    lastChange: "",
    liveChanges: 0,
    resets: 0,
};
const WALK_SPEED = 5;

/** Changes to try on whatever game is running. The server decides whether each needs a rewind. */
const QUICK_CHANGES: Array<{
    id: string;
    label: string;
    change: (recipe: PlayRecipe) => PlayRecipe;
}> = [
    {
        id: "low-gravity",
        label: "Low gravity",
        change: (recipe) => ({ ...recipe, gravity: 2.5 }),
    },
    {
        id: "more",
        label: "50 more",
        change: (recipe) => ({
            ...recipe,
            things: recipe.things.map((thing, i) =>
                i === recipe.things.length - 1
                    ? { ...thing, count: thing.count + 50 }
                    : thing
            ),
        }),
    },
    {
        id: "bigger",
        label: "Bigger things",
        change: (recipe) => ({
            ...recipe,
            things: recipe.things.map((thing) => ({
                ...thing,
                size: Math.min(PLAY_LIMITS.size[1], thing.size * 1.6),
            })),
        }),
    },
];

export default function PlayZoneCheck() {
    const router = useRouter();
    const host = useRef<HTMLDivElement>(null);
    const sendToServer = useRef<(message: unknown) => void>(() => {});
    const current = useRef<PlayRecipe | null>(null);
    const [status, setStatus] = useState<Status>(EMPTY);
    const [error, setError] = useState("");
    const [draft, setDraft] = useState("");
    const [draftError, setDraftError] = useState("");

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
            let poses: PoseBuffers = poseBuffers(0);
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
            sendToServer.current = send;
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
                    const bodies = decodeBodies(frame, poses.target);
                    if (bodies) {
                        for (const index of bodies.indices)
                            if (!poses.known[index]) poses.known[index] = 1;
                        return;
                    }
                    const people = decodePeople(frame);
                    if (people) others = people.people;
                    return;
                }
                const message = JSON.parse(event.data);
                if (message.type === "welcome") self.id = message.id;
                else if (message.type === "rewind") live.rewinding = true;
                else if (message.type === "game") {
                    const next = readPlayRecipe(message.recipe);
                    if (!next) return;
                    const change: Status["lastChange"] =
                        recipe && message.change !== "start"
                            ? message.change
                            : "start";
                    // Only a new round starts from nothing. A change keeps
                    // every shared thing where it is drawn.
                    poses = poseBuffers(
                        playBodies(next).length,
                        change === "start" ? null : poses
                    );
                    recipe = current.current = next;
                    view.setRecipe(next);
                    Object.assign(live, {
                        title: next.title,
                        things: poses.known.length,
                        done: false,
                        rewinding: false,
                        lastChange: change,
                        liveChanges:
                            live.liveChanges + Number(change === "live"),
                        resets: live.resets + Number(change === "reset"),
                    });
                    if (change === "start")
                        Object.assign(live, {
                            score: [0, 0],
                            secondsLeft: next.seconds,
                        });
                    setDraft(JSON.stringify(next, null, 2));
                    setDraftError("");
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
            const typing = (event: KeyboardEvent) =>
                (event.target as HTMLElement)?.tagName === "TEXTAREA";
            const keyDown = (event: KeyboardEvent) => {
                if (typing(event)) return;
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
                if (live.rewinding) {
                    // The server is walking everyone back; follow it, so this
                    // person carries on from wherever the rewind leaves them.
                    const me = others.find((person) => person.id === self.id);
                    if (me) {
                        const ease = 1 - Math.exp(-18 * seconds);
                        self.x += (me.x - self.x) * ease;
                        self.z += (me.z - self.z) * ease;
                        self.yaw = me.yaw;
                    }
                } else if (dx || dz) {
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
                smoothPoses(
                    poses.shown,
                    poses.target,
                    poses.known,
                    seconds,
                    live.rewinding ? Infinity : undefined
                );
                view.draw(poses.shown, poses.known);
                view.drawPeople(others, self.id ? self : null, seconds);
                renderer.render(view.scene, view.camera);
                // A rewind looks washed out, like a tape running back.
                renderer.domElement.style.filter = live.rewinding
                    ? "saturate(0.25) contrast(1.15)"
                    : "";
                if (now - reportedAt >= 250) {
                    live.kilobytesPerSecond =
                        Math.round((bytes / (now - reportedAt)) * 10) / 10;
                    bytes = 0;
                    reportedAt = now;
                    live.heardAbout = poses.known.reduce(
                        (n, k) => n + (k ? 1 : 0),
                        0
                    );
                    const next = {
                        ...live,
                        score: [...live.score] as [number, number],
                    };
                    // The first thing's drawn pose lets a check see that a
                    // change in place moved nothing.
                    document.documentElement.dataset.playZone = JSON.stringify({
                        ...next,
                        self: { id: self.id, x: self.x, z: self.z },
                        first: Array.from(poses.shown.subarray(0, 3)),
                        gravity: recipe?.gravity ?? null,
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

    const applyDraft = () => {
        let value: unknown;
        try {
            value = JSON.parse(draft);
        } catch {
            return setDraftError("That is not valid JSON.");
        }
        if (!readPlayRecipe(value))
            return setDraftError("A recipe needs at least one thing.");
        setDraftError("");
        sendToServer.current({ type: "change", recipe: value });
    };

    const control = lobbyTokens.control;
    const button = {
        minHeight: control.size,
        padding: "0 14px",
        borderRadius: control.radius,
        border: `1px solid ${control.border}`,
        background: control.background,
        color: lobbyTokens.color.controlInk,
        font: "inherit",
        cursor: "pointer",
    } as const;
    const panel = {
        padding: "10px 12px",
        borderRadius: control.radius,
        border: `1px solid ${control.border}`,
        background: control.notice,
        lineHeight: 1.5,
    } as const;
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
                    width: 340,
                    maxHeight: "calc(100% - 32px)",
                }}
            >
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {STARTER_RECIPES.map(({ id, label, recipe }) => (
                        <button
                            key={id}
                            type="button"
                            data-start={id}
                            onClick={() =>
                                sendToServer.current({ type: "start", recipe })
                            }
                            style={button}
                        >
                            {label}
                        </button>
                    ))}
                </div>
                <div data-play-status style={panel}>
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
                            {status.rewinding
                                ? " · rewinding to the start"
                                : status.done
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
                                <br />
                                Changed in place {status.liveChanges} times,
                                after a rewind {status.resets}
                            </span>
                        </>
                    )}
                </div>
                {status.title && (
                    <>
                        <div
                            style={{
                                display: "flex",
                                gap: 8,
                                flexWrap: "wrap",
                            }}
                        >
                            {QUICK_CHANGES.map(({ id, label, change }) => (
                                <button
                                    key={id}
                                    type="button"
                                    data-change={id}
                                    onClick={() =>
                                        current.current &&
                                        sendToServer.current({
                                            type: "change",
                                            recipe: change(current.current),
                                        })
                                    }
                                    style={button}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                        <textarea
                            data-recipe
                            aria-label="The recipe of the game in play"
                            value={draft}
                            spellCheck={false}
                            onChange={(event) => setDraft(event.target.value)}
                            style={{
                                ...panel,
                                minHeight: 120,
                                flex: "1 1 200px",
                                resize: "none",
                                color: lobbyTokens.color.controlInk,
                                font: `${baseTokens.font.size.xs}px ${baseTokens.font.mono}`,
                                lineHeight: 1.45,
                            }}
                        />
                        <div
                            style={{
                                display: "flex",
                                gap: 8,
                                alignItems: "center",
                            }}
                        >
                            <button
                                type="button"
                                data-apply
                                onClick={applyDraft}
                                style={button}
                            >
                                Apply to the game in play
                            </button>
                            <span role="status">{draftError}</span>
                        </div>
                    </>
                )}
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
