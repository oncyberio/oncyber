import dynamic from "next/dynamic";
import Link from "next/link";
import Head from "next/head";
import type { GetServerSideProps } from "next";
import { useEffect, useState } from "react";
import {
    decodeLook,
    encodeLook,
    modelUrl,
} from "@features/avatar-builder/look";
import type { LobbyParticipant } from "@features/lobby/sceneTypes";
import s from "@features/avatar-builder/studio.module.css";
const Lobby = dynamic(() => import("@features/lobby/LobbyRenderer"), {
    ssr: false,
});
const participants: LobbyParticipant[] = [];
const noop = () => {};
export default function Play({ code, name }: { code: string; name: string }) {
    const url = modelUrl(decodeLook(code));
    const [prepared, setPrepared] = useState(""),
        [status, setStatus] = useState("Loading avatar…");
    useEffect(() => {
        let live = true;
        setStatus("Loading avatar…");
        void import("@features/lobby/LobbyRenderer")
            .then((m) => m.preloadLobbyRendererAvatar(url))
            .catch(() => undefined)
            .then(() => {
                if (live) setPrepared(url);
            });
        return () => {
            live = false;
        };
    }, [url]);
    return (
        <main className={s.space}>
            <Head>
                <title>{name} · Avatar Studio</title>
            </Head>
            <Lobby
                active={prepared === url}
                avatarUrl={url}
                crowdEnabled={false}
                participants={participants}
                onMove={noop}
                onReady={noop}
                onError={setStatus}
                onAvatarStatus={(e) => {
                    if (e.url === url)
                        setStatus(
                            e.status === "ready"
                                ? ""
                                : e.status === "error"
                                ? "Could not load this build."
                                : "Loading avatar…"
                        );
                }}
            />
            <aside>
                <Link
                    href={{
                        pathname: "/avatar-builder",
                        query: { build: code, name },
                    }}
                >
                    ← Avatar Studio
                </Link>
                <strong>{name}</strong>
                <span role="status">
                    {status || "Move with WASD · Shift to run · Space to jump"}
                </span>
            </aside>
        </main>
    );
}
export const getServerSideProps: GetServerSideProps = async ({ query }) => {
    const look = decodeLook(query.build);
    if (!look) return { notFound: true };
    return {
        props: {
            code: encodeLook(look),
            name:
                typeof query.name === "string"
                    ? query.name.trim().slice(0, 40) || "My avatar"
                    : "My avatar",
        },
    };
};
