import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import useLobbySocial from "@features/lobby/useLobbySocial";
import { parseLobbyEndpoints } from "@features/lobby/lobbyEndpoints";
import { DEFAULT_LOBBY_AVATAR_URL } from "@features/lobby/avatarSelection";
import { LOBBY_GUEST_PORTRAIT } from "@features/lobby/lobbyIdentity";
import type { LobbyRenderStats } from "@features/lobby/sceneTypes";

const Scene = dynamic(() => import("@features/lobby/LobbyRenderer"), {
    ssr: false,
});
const noop = () => {};
const endpoints = parseLobbyEndpoints(
    process.env.NEXT_PUBLIC_LOBBY_REGIONS || ""
);
// Permit loopback, or an explicitly configured pilot endpoint in local development.
// This fixture opens one real client and never generates synthetic crowds.
const allowedFixture =
    endpoints.length > 0 &&
    endpoints.every(
        (endpoint) =>
            ["localhost", "127.0.0.1", "[::1]"].includes(
                new URL(endpoint.httpUrl).hostname
            ) ||
            (process.env.NODE_ENV === "development" &&
                !!process.env.NEXT_PUBLIC_LOBBY_PILOT_URL &&
                endpoint.httpUrl === process.env.NEXT_PUBLIC_LOBBY_PILOT_URL)
    );

export default function LobbyNetworkFixture() {
    const router = useRouter();
    const local = router.query.target === "local";
    const endpointConfig = local
        ? JSON.stringify([
              { id: "lab", httpUrl: "http://127.0.0.1:2675", protocol: 2 },
          ])
        : undefined;
    const fixtureAllowed = local || allowedFixture;
    const [enabled, setEnabled] = useState(true);
    const [stats, setStats] = useState<LobbyRenderStats>(null);
    const [diagnostics, setDiagnostics] = useState<any>(null);
    const [error, setError] = useState("");
    const social = useLobbySocial({
        enabled: enabled && router.isReady && fixtureAllowed,
        endpointConfig,
        identity: {
            username: "Network observer",
            vrmUrl: DEFAULT_LOBBY_AVATAR_URL,
            avatar: LOBBY_GUEST_PORTRAIT,
        },
    });
    useEffect(() => {
        const timer = setInterval(
            () =>
                setDiagnostics({
                    ...social.getNetworkDiagnostics(),
                    predicted: social.getPredictedPose(),
                }),
            500
        );
        return () => clearInterval(timer);
    }, [social.getNetworkDiagnostics, social.getPredictedPose]);
    return (
        <main style={{ position: "fixed", inset: 0, background: "white" }}>
            {fixtureAllowed && (
                <Scene
                    active
                    renderer="webgpu"
                    proceduralMotion={true}
                    avatarUrl={DEFAULT_LOBBY_AVATAR_URL}
                    profilePhoto={LOBBY_GUEST_PORTRAIT}
                    participants={[]}
                    initializePose={social.initializePose}
                    advanceMovement={social.advanceMovement}
                    sampleParticipants={social.sampleParticipants}
                    consumeCorrection={social.consumeCorrection}
                    onMove={social.updatePosition}
                    onReady={noop}
                    onError={setError}
                    onStats={setStats}
                />
            )}
            <aside
                style={{
                    position: "absolute",
                    top: 12,
                    left: 12,
                    maxWidth: 500,
                    padding: 16,
                    background: "rgba(255,255,255,.94)",
                    fontFamily: "monospace",
                    fontSize: 12,
                    zIndex: 10,
                }}
            >
                <strong>
                    Live crowd · {local ? "local server :2675" : "Fly Paris"}
                </strong>
                <p>
                    <a href="/dev/lobby-feel">Feel lab</a> ·{" "}
                    <a href="/dev/lobby-network?target=local">Local crowd</a> ·{" "}
                    <a href="/dev/lobby-network">Fly pilot</a>
                </p>
                <p>
                    {fixtureAllowed
                        ? "Real multiplayer traffic (WebTransport preferred when configured; WebSocket fallback). WASD to move; Shift to run; Space to jump."
                        : "Configure localhost endpoints or the owned Fly pilot in development to enable this fixture."}
                </p>
                <p data-testid="network-status">
                    {enabled ? social.status : "left"}
                </p>
                <button onClick={() => setEnabled((value) => !value)}>
                    {enabled ? "Leave server" : "Reconnect"}
                </button>{" "}
                <button
                    disabled={!enabled || social.status !== "connected"}
                    onClick={() => void social.toggleVoice()}
                >
                    Voice: {social.voiceState}
                </button>
                <p>
                    Network (server room population is separate from nearby
                    rendered avatars):
                </p>
                <output
                    data-testid="network-stats"
                    style={{ display: "block", overflowWrap: "anywhere" }}
                >
                    {JSON.stringify(diagnostics)}
                </output>
                <p>Renderer (CPU submission, not GPU duration):</p>
                <output
                    data-testid="network-render-stats"
                    style={{ display: "block", overflowWrap: "anywhere" }}
                >
                    {JSON.stringify(stats)}
                </output>
                {(error || social.error || social.voiceError) && (
                    <p role="alert">
                        {error || social.error || social.voiceError}
                    </p>
                )}
            </aside>
        </main>
    );
}
export function getServerSideProps() {
    return process.env.NODE_ENV === "development"
        ? { props: {} }
        : { notFound: true };
}
