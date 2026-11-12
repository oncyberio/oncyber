import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import { DEFAULT_LOBBY_AVATAR_URL } from "@features/lobby/avatarSelection";
import catalogue from "@components/_3DExhibit-v2/three/factory/player/vrms.json";
import { LOBBY_GUEST_PORTRAIT } from "@features/lobby/lobbyIdentity";
import type { LobbyRenderStats } from "@features/lobby/sceneTypes";
import {
    BENCHMARK_COUNTS,
    BENCHMARK_SAMPLES,
    benchmarkCount,
    benchmarkBudget,
    benchmarkParticipants,
    benchmarkMotionPose,
    benchmarkMovementPose,
    benchmarkTurningPose,
    benchmarkJumpPose,
} from "@features/lobby/crowdBenchmark";

const LobbyScene = dynamic(() => import("@features/lobby/LobbyRenderer"), {
    ssr: false,
});
const noop = () => {};
const ms = (value?: number) => (value == null ? "—" : `${value.toFixed(2)} ms`);

/** Local-only synthetic rendering fixture; never joins multiplayer or microphone. */
export default function LobbyCrowdBenchmark() {
    const router = useRouter();
    const count = benchmarkCount(router.query.count);
    const budget = benchmarkBudget(router.query.detailBudget);
    const layout = router.query.layout === "grid" ? "grid" : "fan";
    const renderer = ["webgpu", "webgl2", "webgl2-modern"].includes(
        String(router.query.renderer)
    )
        ? (String(router.query.renderer) as
              | "webgpu"
              | "webgl2"
              | "webgl2-modern")
        : "auto";
    const motionPack = router.query.motionPack === "cc0" ? "cc0" : "default";
    const instanced = router.query.mode !== "native";
    const avatarId =
        typeof router.query.avatar === "string" &&
        Object.hasOwn(catalogue, router.query.avatar)
            ? router.query.avatar
            : "square";
    const avatarUrl = catalogue[avatarId]?.url || DEFAULT_LOBBY_AVATAR_URL;
    const [stats, setStats] = useState<LobbyRenderStats>(null);
    const [error, setError] = useState("");
    const [motion, setMotion] = useState(-1);
    const [procedural, setProcedural] = useState(true);
    const [run, setRun] = useState(0);
    const [active, setActive] = useState(true);
    const participants = useMemo(
        () =>
            benchmarkParticipants(
                count,
                avatarUrl,
                LOBBY_GUEST_PORTRAIT,
                motion,
                layout
            ),
        [count, motion, avatarUrl, layout]
    );
    const sampleParticipants = useMemo(() => {
        if (motion > -2) return undefined;
        const samples = participants.map((person) => ({ ...person }));
        let started: number;
        return (now = performance.now()) => {
            started ??= now;
            const elapsed = (now - started) / 1000;
            const course =
                motion === -6
                    ? benchmarkTurningPose(elapsed)
                    : motion === -4
                    ? benchmarkMovementPose(elapsed)
                    : undefined;
            samples.forEach((person, index) => {
                if (course) {
                    const pose = course;
                    person.turnIntent =
                        "turnIntent" in pose &&
                        typeof pose.turnIntent === "number"
                            ? pose.turnIntent
                            : undefined;
                    person.x = participants[index].x + pose.x;
                    person.z = participants[index].z + pose.z;
                    person.rotation = pose.rotation;
                    person.speed = pose.speed;
                    person.y = 0;
                    person.floor = true;
                    return;
                }
                const time = elapsed + (index % 4) * 0.2;
                const jump = motion === -3 || motion === -5;
                const pose = jump
                    ? benchmarkJumpPose(time, motion === -5)
                    : benchmarkMotionPose(time);
                person.jumpCount = jump
                    ? (pose as ReturnType<typeof benchmarkJumpPose>).jumpCount
                    : 0;
                person.speed = pose.speed;
                person.y = pose.y;
                person.floor = pose.floor;
            });
            return samples;
        };
    }, [participants, motion, run]);
    const renderBudget = useMemo(
        () => ({
            maxAvatars: budget === "unbounded" ? count : Number(budget),
            maxModels: 16,
            // ?labels=64 measures the GPU name tags; off by default for baselines.
            maxLabels: Math.min(
                64,
                Math.max(0, Number(router.query.labels) || 0)
            ),
            loadConcurrency: 3,
        }),
        [budget, count, router.query.labels]
    );
    const href = (change: Record<string, string | number>) =>
        `?${new URLSearchParams({
            count: String(count),
            avatar: avatarId,
            mode: instanced ? "instanced" : "native",
            renderer,
            detailBudget: budget,
            layout,
            motionPack,
            ...change,
        } as Record<string, string>).toString()}`;
    const samples = stats?.sampleFrames || 0;
    return (
        <main style={{ position: "fixed", inset: 0, background: "#050607" }}>
            <LobbyScene
                key={`${count}-${instanced}-${avatarId}-${renderer}-${budget}-${layout}-${motion}-${run}`}
                renderer={renderer}
                active={active}
                initialPosition={{ x: 0, z: 0 }}
                avatarUrl={avatarUrl}
                profilePhoto={LOBBY_GUEST_PORTRAIT}
                participants={participants}
                sampleParticipants={sampleParticipants}
                renderBudget={renderBudget}
                crowdEnabled={instanced}
                proceduralMotion={procedural}
                onStats={setStats}
                onMove={noop}
                onReady={noop}
                onError={setError}
            />
            <aside
                style={{
                    position: "absolute",
                    top: 12,
                    left: 12,
                    background: "rgba(15,17,21,.94)",
                    color: "#e8e9ec",
                    border: "1px solid #ffffff18",
                    padding: 12,
                    maxWidth: 560,
                    fontFamily: "monospace",
                    fontSize: 12,
                    zIndex: 10,
                }}
            >
                <strong>Local synthetic avatar benchmark</strong>
                <div>
                    {catalogue[avatarId]?.name} · {count.toLocaleString()}{" "}
                    synthetic visitors ·{" "}
                    {instanced ? "GPU instances" : "native mixers"}
                </div>
                <div>
                    Animation set:{" "}
                    {motionPack === "cc0"
                        ? "Quaternius CC0 candidate"
                        : "Original set + locomotion improvements"}
                    {" · "}
                    <a
                        href={href({
                            motionPack: motionPack === "cc0" ? "default" : "cc0",
                        })}
                    >
                        Compare{" "}
                        {motionPack === "cc0"
                            ? "original animations"
                            : "CC0 candidate"}
                    </a>
                </div>
                <div>
                    Detailed avatar budget: {budget} · actual renderer:{" "}
                    {stats?.backend || "initializing"}
                </div>
                <div>
                    Admitted {stats?.admitted ?? "—"} · pending{" "}
                    {stats?.pendingLoads ?? "—"} · rendered{" "}
                    {stats?.visible ?? "—"} · frustum culled{" "}
                    {stats ? Math.max(0, stats.instances - stats.visible) : "—"}
                </div>
                <div>
                    Scene draws {stats?.draws ?? "—"} · avatar batches{" "}
                    {stats?.batches ?? "—"} · triangles{" "}
                    {stats?.triangles?.toLocaleString() ?? "—"}
                </div>
                <div>
                    Frame interval p50 / p95: {ms(stats?.frameIntervalMs?.p50)}{" "}
                    / {ms(stats?.frameIntervalMs?.p95)}
                </div>
                <div>
                    CPU submission p50 / p95: {ms(stats?.frameCpuMs?.p50)} /{" "}
                    {ms(stats?.frameCpuMs?.p95)}
                </div>
                <div>
                    {stats?.pendingLoads
                        ? "Loading admitted avatars"
                        : samples
                        ? `${samples}/${BENCHMARK_SAMPLES} steady-state samples`
                        : "Warming up for 3 seconds"}{" "}
                    · GPU duration is not measured
                </div>
                <div style={{ marginTop: 8 }}>
                    Population:{" "}
                    {BENCHMARK_COUNTS.map((value) => (
                        <a
                            key={value}
                            style={{ marginRight: 10 }}
                            href={href({ count: value })}
                        >
                            {value.toLocaleString()}
                        </a>
                    ))}
                </div>
                <div>
                    Detail budget:{" "}
                    {["128", "256", "unbounded"].map((value) => (
                        <a
                            key={value}
                            style={{ marginRight: 10 }}
                            href={href({ detailBudget: value })}
                        >
                            {value}
                        </a>
                    ))}
                </div>
                <div>
                    Renderer:{" "}
                    {["webgpu", "webgl2-modern", "webgl2"].map((value) => (
                        <a
                            key={value}
                            style={{ marginRight: 10 }}
                            href={href({ renderer: value })}
                        >
                            {value}
                        </a>
                    ))}
                </div>
                <div>
                    <a
                        href={href({
                            mode: instanced ? "native" : "instanced",
                        })}
                    >
                        Compare {instanced ? "native mixers" : "GPU instances"}
                    </a>
                    {" · "}
                    <a
                        href={href({
                            layout: layout === "fan" ? "grid" : "fan",
                        })}
                    >
                        Use {layout === "fan" ? "grid" : "fan"} layout
                    </a>
                </div>
                {motion <= -2 && (
                    <p>
                        {motion === -6
                            ? "Turning course: walking arcs, running cuts and reversals"
                            : motion === -4
                            ? "Movement course: accelerate, brake and pivot"
                            : "In-place audition: "}
                        {motion === -4 || motion === -6
                            ? ""
                            : motion === -5
                            ? "jump, double jump, fall and landing"
                            : motion === -3
                            ? "takeoff, airborne pose and landing"
                            : "idle, walk, run, sprint and settle"}
                        . Use WASD / Shift / Space to test your own moving
                        avatar. Press Space again in midair for a double jump.
                        {motion === -5 &&
                            motionPack === "cc0" &&
                            " CC0 reuses its airborne pose; it has no authored double-jump spin."}
                    </p>
                )}
                <div style={{ marginTop: 8 }}>
                    <button
                        aria-pressed={procedural}
                        onClick={() => setProcedural(!procedural)}
                    >
                        Procedural motion: {procedural ? "on" : "off"}
                    </button>{" "}
                    <button
                        onClick={() => {
                            setMotion(-4);
                            setStats(null);
                        }}
                    >
                        Movement course
                    </button>{" "}
                    <button
                        onClick={() => {
                            setMotion(-6);
                            setStats(null);
                        }}
                    >
                        Turning course
                    </button>{" "}
                    <button
                        onClick={() => {
                            setMotion(-2);
                            setStats(null);
                        }}
                    >
                        Locomotion cycle
                    </button>{" "}
                    <button
                        onClick={() => {
                            setMotion(-3);
                            setStats(null);
                        }}
                    >
                        Jump cycle
                    </button>{" "}
                    <button
                        onClick={() => {
                            setMotion(-5);
                            setStats(null);
                        }}
                    >
                        Double-jump cycle
                    </button>{" "}
                    <button
                        onClick={() => {
                            setMotion(0);
                            setStats(null);
                        }}
                    >
                        Wave alternating visitors
                    </button>{" "}
                    <button
                        onClick={() => {
                            setMotion(-1);
                            setStats(null);
                        }}
                    >
                        Idle
                    </button>{" "}
                    <button
                        onClick={() => {
                            setRun(run + 1);
                            setStats(null);
                            setError("");
                        }}
                    >
                        Restart sample
                    </button>{" "}
                    <button onClick={() => setActive(!active)}>
                        {active ? "Pause" : "Resume"}
                    </button>
                </div>
                <details style={{ marginTop: 8 }}>
                    <summary>Raw counters</summary>
                    <output
                        data-testid="crowd-stats"
                        style={{ display: "block", overflowWrap: "anywhere" }}
                    >
                        {JSON.stringify(stats)}
                    </output>
                </details>
                {error && <p role="alert">{error}</p>}
            </aside>
            <style jsx>{`
                aside a {
                    color: #b8c9f0;
                    text-underline-offset: 2px;
                }
                aside button {
                    color: #e8e9ec;
                    background: #20232a;
                    border: 1px solid #ffffff24;
                    border-radius: 5px;
                    padding: 4px 7px;
                    margin-top: 4px;
                    cursor: pointer;
                }
                aside button:hover {
                    background: #30343e;
                }
                aside button:focus-visible,
                aside a:focus-visible {
                    outline: 2px solid #e8e9ec;
                    outline-offset: 2px;
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
