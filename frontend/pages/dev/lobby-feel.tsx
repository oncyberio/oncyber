import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
    FeelSimulation,
    FEEL_PROFILES,
    FeelProfile,
} from "@features/lobby/testing/feelSimulation";
import { DEFAULT_LOBBY_AVATAR_URL } from "@features/lobby/avatarSelection";
import type { LobbyRenderStats } from "@features/lobby/sceneTypes";
const Scene = dynamic(() => import("@features/lobby/LobbyRenderer"), {
    ssr: false,
});
import AvatarFeedbackPanel, {
    AvatarFeedbackCapture,
} from "@features/lobby/testing/AvatarFeedbackPanel";
import { AvatarTraceRecorder } from "@features/lobby/testing/avatarFeedback";
const noop = () => {};
const number = (n?: number, places = 1) =>
    Number.isFinite(n) ? n.toFixed(places) : "—";
export default function LobbyFeelLab() {
    const [recording, setRecording] = useState(false);
    const [smoothing, setSmoothing] = useState(true);
    const [profile, setProfile] = useState<FeelProfile>("regional");
    const [count, setCount] = useState(64),
        [seed, setSeed] = useState(42);
    const [run, setRun] = useState(0),
        [manual, setManual] = useState(false),
        [paused, setPaused] = useState(false);
    const [report, setReport] =
        useState<ReturnType<FeelSimulation["report"]>>(null);
    const [render, setRender] = useState<LobbyRenderStats>(null),
        [error, setError] = useState("");
    const simulation = useMemo(
        () => new FeelSimulation({ profile, count, seed, smoothing }),
        [profile, count, seed, run, smoothing]
    );
    const trace = useMemo(() => new AvatarTraceRecorder(), [simulation]);
    const [capture, setCapture] = useState<AvatarFeedbackCapture>(null);
    useEffect(() => {
        setCapture(null);
        setError("");
        setReport(null);
        setRender(null);
        setPaused(false);
    }, [simulation]);
    useEffect(() => {
        const worker = new Worker("/lobby/feel-metrics-worker.js", {
            type: "module",
        });
        let busy = false;
        let alive = true;
        worker.onmessage = ({ data }) => {
            if (!alive) return;
            busy = false;
            setReport(data);
        };
        worker.onerror = () => {
            if (alive)
                setError(
                    "Metrics worker could not load. Reload the lab to restore measurements."
                );
        };
        const timer = setInterval(() => {
            if (!busy) {
                const snapshot = simulation.reportSnapshot();
                busy = true;
                worker.postMessage(
                    snapshot,
                    Object.values(snapshot.samples).map(
                        (values) => values.buffer
                    )
                );
            }
            if (recording && simulation.timeMs >= 24000) {
                setPaused(true);
                setRecording(false);
            }
        }, 500);
        return () => {
            alive = false;
            clearInterval(timer);
            worker.terminate();
        };
    }, [simulation, recording]);
    const exportReport = () => {
        const blob = new Blob(
            [
                JSON.stringify(
                    {
                        at: new Date().toISOString(),
                        movement: simulation.report(),
                        rendering: render,
                        manual,
                    },
                    null,
                    2
                ),
            ],
            { type: "application/json" }
        );
        const url = URL.createObjectURL(blob),
            anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `lobby-feel-${profile}-${count}-seed${seed}.json`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
    };
    return (
        <main className="feel-lab">
            <Scene
                key={`${profile}-${count}-${seed}-${run}-${smoothing}`}
                active={!paused}
                renderer="webgpu"
                proceduralMotion={true}
                selectedAvatarId={capture?.avatar.id}
                onMotionFrame={(frame) =>
                    trace.record(frame, simulation.timeMs)
                }
                onSelectAvatar={(avatar) =>
                    setCapture({
                        schemaVersion: 1,
                        clickedAt: new Date().toISOString(),
                        avatar,
                        frames: trace.capture(avatar.id),
                        rendering: render,
                        context: {
                            profile,
                            seed,
                            count,
                            smoothing,
                            manual,
                            simulationMs: simulation.timeMs,
                            avatarUrl: DEFAULT_LOBBY_AVATAR_URL,
                            proceduralMotion: true,
                        },
                    })
                }
                avatarUrl={DEFAULT_LOBBY_AVATAR_URL}
                participants={[]}
                initializePose={() => simulation.predictor.state}
                advanceMovement={(dt, controls) =>
                    simulation.advance(
                        recording
                            ? Math.max(
                                  0,
                                  Math.min(
                                      dt,
                                      (24000 - simulation.timeMs) / 1000
                                  )
                              )
                            : dt,
                        manual ? controls : undefined
                    )
                }
                sampleParticipants={simulation.participants}
                consumeCorrection={simulation.consumeCorrection}
                onMove={noop}
                onReady={noop}
                onError={setError}
                onStats={setRender}
            />
            <aside>
                <header>
                    <span className="eyebrow">ONCYBER / MULTIPLAYER LAB</span>
                    <h1>Feel the difference.</h1>
                    <p>
                        Real avatars. Production movement code.
                        <br />A repeatable network, so changes are comparable.
                    </p>
                </header>
                <label>
                    Network conditions
                    <select
                        value={profile}
                        onChange={(e) => {
                            setProfile(e.target.value as FeelProfile);
                            setPaused(false);
                        }}
                    >
                        {Object.entries(FEEL_PROFILES).map(([key, value]) => (
                            <option key={key} value={key}>
                                {value.label}
                            </option>
                        ))}
                    </select>
                </label>
                <div className="row">
                    <label>
                        Simulated players
                        <select
                            value={count}
                            onChange={(e) => setCount(Number(e.target.value))}
                        >
                            {[16, 32, 64, 128, 256, 512].map((n) => (
                                <option key={n}>{n}</option>
                            ))}
                        </select>
                    </label>
                    <label>
                        Repeatable seed
                        <input
                            type="number"
                            min={1}
                            max={999999}
                            value={seed}
                            onChange={(e) =>
                                setSeed(
                                    Math.max(
                                        1,
                                        Math.min(
                                            999999,
                                            Number(e.target.value) || 1
                                        )
                                    )
                                )
                            }
                        />
                    </label>
                </div>
                <label className="check">
                    <input
                        type="checkbox"
                        checked={smoothing}
                        onChange={(e) => setSmoothing(e.target.checked)}
                    />{" "}
                    Smooth remote motion (A/B comparison)
                </label>
                <label className="check">
                    <input
                        type="checkbox"
                        checked={manual}
                        onChange={(e) => setManual(e.target.checked)}
                    />{" "}
                    Take control with WASD / Shift / Space
                </label>
                <div className="buttons">
                    <button onClick={() => setPaused(!paused)}>
                        {paused ? "Resume" : "Pause"}
                    </button>
                    <button
                        onClick={() => {
                            setRun(run + 1);
                            setPaused(false);
                        }}
                    >
                        Replay seed
                    </button>
                    <button
                        onClick={() => {
                            setManual(false);
                            setRun(run + 1);
                            setPaused(false);
                            setRecording(true);
                        }}
                    >
                        Record 24s
                    </button>
                    <button onClick={exportReport}>Export run</button>
                </div>
                <AvatarFeedbackPanel capture={capture} />
                <div className="metrics" data-testid="feel-metrics">
                    <div>
                        <small>Local correction · p95</small>
                        <b>
                            {number(
                                report?.correctionMeters.p95 &&
                                    report.correctionMeters.p95 * 100,
                                2
                            )}{" "}
                            <em>cm</em>
                        </b>
                    </div>
                    <div>
                        <small>Remote frozen frames</small>
                        <b>
                            {number(report?.frozenPercent)}
                            <em>%</em>
                        </b>
                    </div>
                    <div>
                        <small>Input ACK age · p95</small>
                        <b>
                            {number(report?.ackAgeMs.p95, 0)} <em>ms</em>
                        </b>
                    </div>
                    <div>
                        <small>Frame interval · p99</small>
                        <b>
                            {number(render?.frameIntervalMs?.p99)} <em>ms</em>
                        </b>
                    </div>
                    <div>
                        <small>Visible / observed</small>
                        <b>
                            {render?.visible ?? "—"}
                            <em> / {report?.observedActors ?? 0}</em>
                        </b>
                    </div>
                    <div>
                        <small>Draw calls</small>
                        <b>
                            {render?.draws ?? "—"}
                            <em> · {render?.backend || "loading"}</em>
                        </b>
                    </div>
                </div>
                <p className="note">
                    {number(report?.seconds, 0)} seconds ·{" "}
                    {manual
                        ? "Manual movement"
                        : "Scripted turns, sprint, stops and double jumps"}
                    . Observer capped at 128 nearby players. GPU admission may
                    render fewer.
                </p>
                <details>
                    <summary>Measurement details</summary>
                    <pre data-testid="feel-report">
                        {JSON.stringify(
                            { movement: report, rendering: render },
                            null,
                            2
                        )}
                    </pre>
                </details>
                <footer>
                    This lab simulates packet delay, jitter, loss and outage in
                    the browser. It does not measure QUIC or server capacity.
                    <br />
                    <a href="/dev/lobby-network?target=local">
                        Open live local crowd ↗
                    </a>
                    <a href="/dev/lobby-network">Open Fly observer ↗</a>
                </footer>
                {error && <p role="alert">{error}</p>}
            </aside>
            <div className="legend">
                {paused ? "PAUSED" : "LIVE SIMULATION"}
                <span>
                    {FEEL_PROFILES[profile].label} · seed {seed}
                </span>
            </div>
            <style jsx>{`
                .feel-lab {
                    position: fixed;
                    inset: 0;
                    background: #f4f5f6;
                    color: #151718;
                    font-family: Arial, sans-serif;
                }
                aside {
                    position: absolute;
                    z-index: 10;
                    top: 20px;
                    left: 20px;
                    width: 336px;
                    max-height: calc(100vh - 40px);
                    overflow: auto;
                    box-sizing: border-box;
                    background: rgba(255, 255, 255, 0.94);
                    border: 1px solid #e6e8ea;
                    border-radius: 20px;
                    padding: 24px;
                    box-shadow: 0 12px 45px #18242b0a;
                }
                .eyebrow {
                    font-size: 9px;
                    letter-spacing: 1.8px;
                    color: #687178;
                }
                h1 {
                    font-size: 27px;
                    font-weight: 500;
                    letter-spacing: -1px;
                    margin: 13px 0 8px;
                }
                header p {
                    color: #687178;
                    font-size: 12px;
                    line-height: 1.6;
                    margin-bottom: 24px;
                }
                label {
                    display: block;
                    font-size: 11px;
                    color: #687178;
                    margin-bottom: 14px;
                }
                select,
                input[type="number"] {
                    margin-top: 7px;
                    display: block;
                    box-sizing: border-box;
                    width: 100%;
                    padding: 10px;
                    background: #f7f8f9;
                    border: 1px solid #e6e8ea;
                    border-radius: 8px;
                    color: #151718;
                    font-size: 11px;
                }
                .row {
                    display: flex;
                    gap: 12px;
                }
                .row label {
                    width: 50%;
                }
                .check {
                    display: flex;
                    align-items: center;
                    gap: 7px;
                    font-size: 11px;
                }
                .buttons {
                    display: flex;
                    gap: 6px;
                    flex-wrap: wrap;
                    margin: 18px 0;
                }
                button {
                    background: white;
                    border: 1px solid #dde1e4;
                    border-radius: 20px;
                    padding: 9px 12px;
                    cursor: pointer;
                    font-size: 11px;
                }
                button:first-child {
                    background: #192023;
                    color: white;
                    border-color: #192023;
                }
                .metrics {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    border-top: 1px solid #edf0f1;
                    padding-top: 18px;
                    gap: 20px 10px;
                }
                small {
                    display: block;
                    font-size: 10px;
                    color: #788188;
                    margin-bottom: 7px;
                }
                b {
                    font-size: 23px;
                    font-weight: 500;
                    letter-spacing: -0.5px;
                }
                em {
                    font-size: 11px;
                    font-weight: 400;
                    font-style: normal;
                    color: #788188;
                    letter-spacing: 0;
                }
                .note,
                footer {
                    font-size: 10px;
                    line-height: 1.6;
                    color: #788188;
                }
                .note {
                    margin: 20px 0;
                }
                footer {
                    margin-top: 20px;
                    border-top: 1px solid #edf0f1;
                    padding-top: 16px;
                }
                a {
                    color: #202a30;
                    display: block;
                    margin-top: 10px;
                    text-decoration: none;
                }
                summary {
                    cursor: pointer;
                    font-size: 11px;
                }
                pre {
                    font-size: 9px;
                    overflow: auto;
                    max-height: 230px;
                }
                .legend {
                    position: absolute;
                    bottom: 24px;
                    right: 24px;
                    font-size: 9px;
                    letter-spacing: 1px;
                }
                .legend span {
                    display: block;
                    color: #788188;
                    margin-top: 6px;
                    letter-spacing: 0;
                }
                @media (max-width: 700px) {
                    aside {
                        width: 270px;
                        padding: 17px;
                        left: 10px;
                        top: 10px;
                        max-height: 55vh;
                    }
                    .legend {
                        right: 14px;
                        bottom: 14px;
                    }
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
