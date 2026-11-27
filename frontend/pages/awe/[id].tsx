import type { GetServerSidePropsContext } from "next";
import dynamic from "next/dynamic";
import Head from "next/head";
import { nodeEnv } from "@env";
import { publicFetch } from "@utils/net/publicFetch";
import {
    isAweWorldId,
    type EmbeddedRuntime,
} from "@features/content-host/runtime";

const EmbeddedExperience = dynamic(
    () => import("@features/content-host/EmbeddedExperience"),
    { ssr: false }
);

export default function AweWorld({
    runtime,
    title,
}: {
    runtime: EmbeddedRuntime;
    title: string;
}) {
    return (
        <>
            <Head>
                <title>{title} · Oncyber</title>
            </Head>
            <EmbeddedExperience runtime={runtime} title={title} />
        </>
    );
}

export async function getServerSideProps({
    params,
}: Pick<GetServerSidePropsContext, "params">) {
    const id = params?.id;
    if (!isAweWorldId(id)) return { notFound: true };

    let title = id;
    try {
        const url = new URL(
            `/api/oncyber-embed/${id}?view=metadata`,
            nodeEnv.AWE_PLAYER_ORIGIN || "https://awe.box"
        );
        const response = await publicFetch(url.href, {
            accept: "application/json",
            maxBytes: 4096,
            maxRedirects: 0,
            timeoutMs: 5000,
        });
        if (response.status === 404 || response.status === 403)
            return { notFound: true };
        if (response.status === 200) {
            const metadata = JSON.parse(response.body.toString("utf8"));
            if (typeof metadata?.title === "string" && metadata.title.trim())
                title = metadata.title.trim().slice(0, 160);
        }
    } catch {
        // A temporary metadata failure should still let the visitor play.
    }

    // The guest player checks anonymous access to the published world.
    // Only the path segment selects content. Never forward query parameters.
    return {
        props: {
            title,
            runtime: {
                kind: "awe-app" as const,
                url: `https://awe.box/play/${id}`,
            },
            lobbyWorld: true,
        },
    };
}
