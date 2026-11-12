import { useState } from "react";
import dynamic from "next/dynamic";
import { DEFAULT_LOBBY_AVATAR_URL } from "@features/lobby/avatarSelection";
import { LOBBY_GUEST_PORTRAIT } from "@features/lobby/lobbyIdentity";
import type { LobbyFlash } from "../../../multiplayer/protocol/lobby-flash";

const Scene = dynamic(() => import("@features/lobby/LobbyRenderer"), {
    ssr: false,
});
const noop = () => {};
/** Explicit development fixture; sample artwork never enters the owned NFT picker. */
export default function FlashPreview() {
    const [flash, setFlash] = useState<LobbyFlash | null>(null);
    const [error, setError] = useState("");
    const [ready, setReady] = useState(false);
    const [presented, setPresented] = useState(false);
    const [renderer, setRenderer] = useState<"auto" | "webgl2">("auto");
    const [showPeer, setShowPeer] = useState(false);
    const stop = () => {
        setFlash(null);
        setPresented(false);
    };
    return (
        <main
            style={{
                position: "fixed",
                inset: 0,
                background: "#101010",
                color: "#f3f3f1",
                fontFamily: "sans-serif",
            }}
        >
            <Scene
                key={renderer}
                active
                renderer={renderer}
                avatarUrl={DEFAULT_LOBBY_AVATAR_URL}
                profilePhoto={LOBBY_GUEST_PORTRAIT}
                initialPosition={{ x: 0, z: 0 }}
                flash={flash}
                participants={
                    showPeer && flash
                        ? [
                              {
                                  id: "preview-peer",
                                  name: "Flash preview",
                                  x: -1.6,
                                  y: 0,
                                  z: 1,
                                  rotation: 0,
                                  vrmUrl: DEFAULT_LOBBY_AVATAR_URL,
                                  avatar: LOBBY_GUEST_PORTRAIT,
                                  speed: 0,
                                  floor: true,
                                  animation: -1,
                                  flash,
                              },
                          ]
                        : []
                }
                onMove={noop}
                onReady={() => setReady(true)}
                onError={setError}
                onFlashDismiss={stop}
                onFlashReady={() => setPresented(true)}
                onFlashError={(_, message) => {
                    setError(message);
                    stop();
                }}
            />
            <div
                style={{
                    position: "absolute",
                    top: 24,
                    left: 24,
                    right: 24,
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    flexWrap: "wrap",
                }}
            >
                <span>Flash · development preview</span>
                <label>
                    Renderer{" "}
                    <select
                        value={renderer}
                        onChange={(event) => {
                            stop();
                            setReady(false);
                            setError("");
                            setRenderer(
                                event.target.value as "auto" | "webgl2"
                            );
                        }}
                    >
                        <option value="auto">Automatic</option>
                        <option value="webgl2">WebGL</option>
                    </select>
                </label>
                <button
                    disabled={!ready}
                    onClick={() => {
                        setError("");
                        setPresented(false);
                        setFlash({
                            id: "preview-flower",
                            title: "Sample artwork",
                            imageUrl: "/textures/flower.png",
                            nonce: crypto.randomUUID(),
                            startedAt: Date.now(),
                        });
                    }}
                >
                    Show sample artwork
                </button>
                <button onClick={stop}>Stop Flash</button>
                <label>
                    <input
                        type="checkbox"
                        checked={showPeer}
                        onChange={(event) => setShowPeer(event.target.checked)}
                    />
                    Nearby avatar
                </label>
                <small>WASD to dismiss · drag to look around</small>
                <span role="status">
                    {!ready
                        ? "Loading avatar…"
                        : flash
                        ? presented
                            ? "Showing Flash"
                            : "Preparing Flash…"
                        : "Ready"}
                </span>
                {error && <span role="alert">{error}</span>}
            </div>
            <style jsx>{`
                button,
                select {
                    min-height: 40px;
                    border: 1px solid #ffffff24;
                    border-radius: 12px;
                    background: #242424;
                    color: #f3f3f1;
                    padding: 0 14px;
                    cursor: pointer;
                }
                button:focus-visible {
                    outline: 2px solid #3975ff;
                }
                button:disabled {
                    opacity: 0.4;
                    cursor: default;
                }
                small {
                    color: #aaa;
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
