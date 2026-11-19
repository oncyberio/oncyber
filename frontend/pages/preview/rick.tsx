import dynamic from "next/dynamic";
import Head from "next/head";
import { useState } from "react";
import styled from "styled-components";
import catalogue from "@components/_3DExhibit-v2/three/factory/player/vrms.json";
import { brandFoundation } from "@styles/brand";
import type { LobbyParticipant } from "@features/lobby/sceneTypes";

const Lobby = dynamic(() => import("@features/lobby/LobbyRenderer"), {
    ssr: false,
});
const rick = catalogue["procedural-rick-classic"];
const participants: LobbyParticipant[] = [];
const noop = () => {};

const Space = styled.main`
    ${brandFoundation}
    position: fixed;
    inset: 0;
    background: #111317;
    color: white;
`;

const Controls = styled.aside`
    position: absolute;
    top: max(16px, env(safe-area-inset-top));
    left: max(16px, env(safe-area-inset-left));
    max-width: calc(100% - 32px);
    padding: 10px 14px;
    border-radius: 12px;
    background: rgba(18, 19, 22, 0.86);
    pointer-events: none;
    font: 14px/1.45 var(--oc-font, sans-serif);
    .touch {
        display: none;
    }
    @media (pointer: coarse) {
        .keyboard {
            display: none;
        }
        .touch {
            display: inline;
        }
    }
    a {
        color: inherit;
        pointer-events: auto;
    }
`;

export default function RickPreview() {
    const [ready, setReady] = useState(false);
    const [error, setError] = useState("");
    return (
        <Space aria-label="Rick Sanchez avatar preview">
            <Head>
                <title>Walk around as Rick · Oncyber</title>
                <meta name="robots" content="noindex" />
            </Head>
            <Lobby
                active
                crowdEnabled={false}
                avatarUrl={rick.url}
                participants={participants}
                onMove={noop}
                onReady={noop}
                onError={setError}
                onAvatarStatus={({ url, status }) => {
                    if (url !== rick.url) return;
                    setReady(status === "ready");
                    setError(status === "error" ? "Rick could not load." : "");
                }}
            />
            <Controls aria-live="polite">
                {error ? (
                    <>
                        {error} <a href="/preview/rick">Try again</a>
                    </>
                ) : ready ? (
                    <>
                        <strong>Rick Sanchez</strong>
                        <div className="keyboard">
                            WASD to move · Shift to run · Space to jump · Drag
                            to look around
                        </div>
                        <div className="touch">
                            Use the thumbstick to move and drag to look around.
                        </div>
                    </>
                ) : (
                    "Loading Rick…"
                )}
            </Controls>
        </Space>
    );
}

export function getServerSideProps() {
    return process.env.NODE_ENV === "development" ||
        process.env.VERCEL_ENV === "preview"
        ? { props: {} }
        : { notFound: true };
}
