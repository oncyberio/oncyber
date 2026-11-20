import dynamic from "next/dynamic";
import Head from "next/head";
import type { GetServerSideProps } from "next";
import { useEffect, useState } from "react";
import styled from "styled-components";
import catalogue from "@components/_3DExhibit-v2/three/factory/player/vrms.json";
import { brandFoundation } from "@styles/brand";
import type { LobbyParticipant } from "@features/lobby/sceneTypes";

const Lobby = dynamic(() => import("@features/lobby/LobbyRenderer"), {
    ssr: false,
});
const avatars = {
    rick: {
        name: "Rick Sanchez",
        url: catalogue["procedural-rick-classic"].url,
    },
    vale: { name: "Vale", url: "/models/procedural/drawn-vale-streetwear" },
    jessica: { name: "Jessica", url: catalogue["procedural-cast-jessica"].url },
    "nia-bell": { name: "Nia Bell", url: "/models/procedural/drawn-nia-bell" },
};
type Avatar = keyof typeof avatars;
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

export default function AvatarPreview({ avatar }: { avatar: Avatar }) {
    const { name, url: avatarUrl } = avatars[avatar];
    const [ready, setReady] = useState(false);
    const [error, setError] = useState("");
    const [prepared, setPrepared] = useState("");
    useEffect(() => {
        let current = true;
        setReady(false);
        setError("");
        // Prepare the selected skeleton and clips while the lobby initializes.
        // A busy software renderer can otherwise starve the first avatar load.
        void import("@features/lobby/LobbyRenderer")
            .then(({ preloadLobbyRendererAvatar }) =>
                preloadLobbyRendererAvatar(avatarUrl)
            )
            .catch(() => undefined)
            .then(() => {
                if (current) setPrepared(avatarUrl);
            });
        return () => {
            current = false;
        };
    }, [avatarUrl]);
    return (
        <Space aria-label={`${name} avatar preview`}>
            <Head>
                <title>Walk around as {name} · Oncyber</title>
                <meta name="robots" content="noindex" />
            </Head>
            <Lobby
                active={prepared === avatarUrl}
                crowdEnabled={false}
                avatarUrl={avatarUrl}
                participants={participants}
                onMove={noop}
                onReady={noop}
                onError={setError}
                onAvatarStatus={({ url, status }) => {
                    if (url !== avatarUrl) return;
                    setReady(status === "ready");
                    setError(
                        status === "error" ? `${name} could not load.` : ""
                    );
                }}
            />
            <Controls aria-live="polite">
                {error ? (
                    <>
                        {error} <a href={`/preview/${avatar}`}>Try again</a>
                    </>
                ) : ready ? (
                    <>
                        <strong>{name}</strong>
                        <div className="keyboard">
                            WASD to move · Shift to run · Space to jump · Drag
                            to look around
                        </div>
                        <div className="touch">
                            Use the thumbstick to move and drag to look around.
                        </div>
                    </>
                ) : (
                    `Loading ${name}…`
                )}
            </Controls>
        </Space>
    );
}

export const getServerSideProps: GetServerSideProps = async ({ params }) => {
    const avatar = params?.avatar;
    if (
        (process.env.NODE_ENV !== "development" &&
            process.env.VERCEL_ENV !== "preview") ||
        typeof avatar !== "string" ||
        !Object.prototype.hasOwnProperty.call(avatars, avatar)
    )
        return { notFound: true };
    return { props: { avatar } };
};
