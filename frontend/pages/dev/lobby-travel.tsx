import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import styled from "styled-components";
import { brandFoundation } from "@styles/brand";
import LobbyArrivalStatus, {
    lobbyArrivalStatusText,
} from "@features/lobby/LobbyArrivalStatus";
import ControlIconPreview from "@features/content-host/testing/ControlIconPreview";
import { DEFAULT_LOBBY_AVATAR_URL } from "@features/lobby/avatarSelection";
import { WORLD_TILE_REVEAL_MS } from "@features/lobby/worldTileMotion";
import {
    TRAVEL_ISOLATE_MS,
    TRAVEL_DISSOLVE_AT_MS,
    TRAVEL_BLACK_AT_MS,
    WORLD_DISSOLVE_MS,
    TRAVEL_DEPARTURE_MS,
} from "@features/lobby/worldTravelTiming";
import type { LobbySceneProps } from "@features/lobby/sceneTypes";
const Scene = dynamic(() => import("@features/lobby/LobbyRenderer"), {
    ssr: false,
});
const noop = () => {};
const partyIds = ["preview-0", "preview-1"];
const visitors = Array.from({ length: 7 }, (_, i) => ({
    id: `preview-${i}`,
    name: i < 2 ? `Party ${i + 1}` : `Visitor ${i - 1}`,
    x: ((i % 4) - 1.5) * 2.3,
    y: 0,
    z: -2 - Math.floor(i / 4) * 2.2,
    rotation: Math.PI,
    vrmUrl: DEFAULT_LOBBY_AVATAR_URL,
    animation: -1,
    floor: true,
    speed: 0,
    restConfirmed: true,
}));
type Phase =
    | "lobby"
    | "isolate"
    | "charge"
    | "dissolve"
    | "black"
    | "reveal"
    | "arrived";
const dissolveAt = TRAVEL_DISSOLVE_AT_MS;
const blackAt = TRAVEL_BLACK_AT_MS;
/** Development-only visual fixture. These avatars are explicit sample data;
 * actual party membership is resolved server-side in Lobby. */
export default function LobbyTravelLab() {
    const [phase, setPhase] = useState<Phase>("lobby");
    const [progress, setProgress] = useState(0.5);
    const [dissolveProgress, setDissolveProgress] = useState(0.5);
    const [reduced, setReduced] = useState(false);
    const [title, setTitle] = useState("Argonauts of the Lunar Sea");
    const [loadProgress, setLoadProgress] = useState(0.42);
    const [error, setError] = useState("");
    const [ready, setReady] = useState(false);
    const [renderer, setRenderer] = useState<"auto" | "webgl2">("auto");
    const [floorStatus, setFloorStatus] = useState<{
        startedAt?: number;
        visible: boolean;
    }>({ visible: false });
    const start = useRef(0);
    const [playing, setPlaying] = useState(false);
    const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
    const clear = () => {
        timers.current.forEach(clearTimeout);
        timers.current = [];
    };
    const choose = (next: Phase) => {
        clear();
        setPlaying(false);
        const elapsed =
            next === "charge"
                ? TRAVEL_ISOLATE_MS
                : next === "dissolve"
                ? dissolveAt + WORLD_DISSOLVE_MS / 2
                : next === "black" || next === "reveal"
                ? TRAVEL_DEPARTURE_MS
                : 0;
        start.current = performance.now() - elapsed;
        if (next === "dissolve") setDissolveProgress(0.5);
        if (next === "reveal") setProgress(0.5);
        setPhase(next);
    };
    const play = () => {
        clear();
        setPlaying(true);
        start.current = performance.now();
        setPhase("isolate");
        setLoadProgress(0);
        // Stepped like real asset batches, completing just before the black hold.
        [0.08, 0.17, 0.31, 0.38, 0.52, 0.66, 0.71, 0.84, 0.93, 1].forEach(
            (value, index) =>
                timers.current.push(
                    setTimeout(() => setLoadProgress(value), 900 + index * 420)
                )
        );
        timers.current.push(
            setTimeout(() => setPhase("charge"), TRAVEL_ISOLATE_MS),
            setTimeout(() => {
                setDissolveProgress(0);
                setPhase("dissolve");
            }, dissolveAt),
            setTimeout(() => setPhase("black"), blackAt),
            setTimeout(() => {
                setProgress(0);
                setPhase("reveal");
            }, TRAVEL_DEPARTURE_MS)
        );
    };
    useEffect(() => () => clear(), []);
    useEffect(() => {
        if (phase !== "dissolve" || !playing) return;
        let frame = 0;
        const tick = (now: number) => {
            const value = reduced
                ? 1
                : Math.max(
                      0,
                      Math.min(
                          1,
                          (now - start.current - dissolveAt) / WORLD_DISSOLVE_MS
                      )
                  );
            setDissolveProgress(value);
            if (value < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
    }, [phase, playing, reduced]);
    useEffect(() => {
        if (phase !== "reveal" || !playing) return;
        const startedAt = performance.now();
        let frame = 0;
        const tick = (now: number) => {
            const value = reduced
                ? 1
                : Math.min(1, (now - startedAt) / WORLD_TILE_REVEAL_MS);
            setProgress(value);
            if (value < 1) frame = requestAnimationFrame(tick);
            else {
                setPlaying(false);
                setPhase("arrived");
            }
        };
        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
    }, [phase, playing, reduced]);
    const travel: LobbySceneProps["travel"] =
        phase === "lobby" || phase === "arrived"
            ? undefined
            : {
                  phase:
                      phase === "dissolve" || phase === "black"
                          ? "charge"
                          : phase,
                  startedAt: start.current,
                  partyIds,
                  status: {
                      title: "A quiet place",
                      detail: lobbyArrivalStatusText(
                          phase === "reveal" ? "revealing" : "loading"
                      ),
                  },
                  reducedMotion: reduced,
                  label: {
                      title,
                      status:
                          phase === "reveal"
                              ? "Arriving"
                              : loadProgress < 1
                              ? "Opening your world"
                              : "Your world is ready",
                      progress:
                          phase === "reveal" || loadProgress >= 1
                              ? undefined
                              : loadProgress,
                  },
                  dissolveStartedAt: playing
                      ? start.current + dissolveAt
                      : undefined,
                  dissolveProgress: playing
                      ? undefined
                      : phase === "dissolve"
                      ? dissolveProgress
                      : phase === "black" || phase === "reveal"
                      ? 1
                      : 0,
              };
    return (
        <Preview>
            <Scene
                active={true}
                key={renderer}
                renderer={renderer}
                avatarUrl={DEFAULT_LOBBY_AVATAR_URL}
                initialPosition={{ x: 0, z: 0 }}
                participants={visitors}
                travel={travel}
                onTravelStatusVisible={(visible) =>
                    setFloorStatus({ startedAt: start.current, visible })
                }
                travelPartyIds={partyIds}
                worldRevealPreview={
                    phase === "reveal" || phase === "arrived"
                        ? {
                              progress:
                                  reduced || phase === "arrived" ? 1 : progress,
                              arrived: phase === "arrived",
                              partyIds,
                              reducedMotion: reduced,
                          }
                        : undefined
                }
                onMove={noop}
                onReady={() => setReady(true)}
                onError={setError}
            />
            <aside
                style={{
                    position: "absolute",
                    zIndex: 30,
                    left: 20,
                    right: 20,
                    top: 20,
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                    alignItems: "center",
                    padding: 12,
                    background: "#101319df",
                    border: "1px solid #ffffff20",
                    borderRadius: 12,
                }}
            >
                <strong style={{ marginRight: 12 }}>
                    World transition · preview
                </strong>
                {(
                    [
                        "lobby",
                        "isolate",
                        "charge",
                        "dissolve",
                        "black",
                        "reveal",
                        "arrived",
                    ] as Phase[]
                ).map((value) => (
                    <button
                        key={value}
                        aria-pressed={phase === value}
                        onClick={() => choose(value)}
                    >
                        {value === "dissolve" ? "dim" : value}
                    </button>
                ))}
                <button onClick={play} disabled={!ready}>
                    Play transition
                </button>
                <label>
                    Renderer{" "}
                    <select
                        value={renderer}
                        onChange={(event) => {
                            choose("lobby");
                            setReady(false);
                            setFloorStatus({ visible: false });
                            setRenderer(
                                event.target.value as "auto" | "webgl2"
                            );
                        }}
                    >
                        <option value="auto">Automatic</option>
                        <option value="webgl2">WebGL</option>
                    </select>
                </label>
                <label>
                    <input
                        type="checkbox"
                        checked={reduced}
                        onChange={(e) => setReduced(e.target.checked)}
                    />{" "}
                    Reduced motion
                </label>
                <label>
                    Title{" "}
                    <input
                        aria-label="World title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                    />
                </label>
                <label>
                    Loading{" "}
                    <input
                        aria-label="Loading progress"
                        type="range"
                        min="0"
                        max="1"
                        step=".01"
                        value={loadProgress}
                        onChange={(e) =>
                            setLoadProgress(Number(e.target.value))
                        }
                    />
                </label>
                {phase === "dissolve" && (
                    <label>
                        Dim the lights{" "}
                        <input
                            aria-label="Dimming progress"
                            type="range"
                            min="0"
                            max="1"
                            step=".01"
                            value={reduced ? 1 : dissolveProgress}
                            onChange={(e) => {
                                clear();
                                setPlaying(false);
                                setDissolveProgress(Number(e.target.value));
                            }}
                        />
                    </label>
                )}
                {phase === "reveal" && (
                    <label>
                        Outward reveal{" "}
                        <input
                            aria-label="Reveal progress"
                            type="range"
                            min="0"
                            max="1"
                            step=".01"
                            value={progress}
                            onChange={(e) => {
                                clear();
                                setPlaying(false);
                                setProgress(Number(e.target.value));
                            }}
                        />
                    </label>
                )}
                <small>
                    {error ||
                        (ready
                            ? phase === "arrived"
                                ? "Arrived · WASD to move · drag to look · 2 party members"
                                : phase === "black"
                                ? "Black hold · avatar and party remain visible"
                                : phase === "dissolve"
                                ? "The lobby lights dim smoothly to black"
                                : phase === "reveal"
                                ? "World builds outward from the player’s feet"
                                : "3D sample world · same avatar · 2 party members"
                            : "Loading native avatars…")}
                </small>
            </aside>
            {travel && (
                <LobbyArrivalStatus
                    worldName={travel.status.title}
                    phase={phase === "reveal" ? "revealing" : "loading"}
                    floorStatusVisible={
                        phase !== "reveal" &&
                        !error &&
                        floorStatus.startedAt === travel.startedAt &&
                        floorStatus.visible
                    }
                    onCancel={() => choose("lobby")}
                />
            )}
            <div
                style={{
                    position: "absolute",
                    zIndex: 30,
                    bottom: 16,
                    left: 20,
                    right: 20,
                }}
            >
                {!travel && <ControlIconPreview />}
            </div>
            <style jsx>{`
                button,
                select {
                    color: #dbe6f2;
                    border: 1px solid #ffffff30;
                    background: #262c35;
                    padding: 9px 12px;
                    border-radius: 8px;
                    cursor: pointer;
                    text-transform: capitalize;
                }
                button[aria-pressed="true"] {
                    background: #3b596e;
                    border-color: #94c8e6;
                }
                label,
                small {
                    font-size: 12px;
                    color: #c0cad3;
                }
            `}</style>
        </Preview>
    );
}
const Preview = styled.main`
    ${brandFoundation}
    position: fixed;
    inset: 0;
    background: #050607;
    color: white;
`;

export function getServerSideProps() {
    return process.env.NODE_ENV === "development"
        ? { props: {} }
        : { notFound: true };
}
