import type { GetServerSidePropsContext } from "next";
import dynamic from "next/dynamic";
import {
    isAweWorldId,
    type EmbeddedRuntime,
} from "@features/content-host/runtime";

const EmbeddedExperience = dynamic(
    () => import("@features/content-host/EmbeddedExperience"),
    { ssr: false }
);

export default function AweWorld({ runtime }: { runtime: EmbeddedRuntime }) {
    return <EmbeddedExperience runtime={runtime} title="AWE world" />;
}

export async function getServerSideProps({
    params,
}: Pick<GetServerSidePropsContext, "params">) {
    const id = params?.id;
    if (!isAweWorldId(id)) return { notFound: true };

    // The guest player checks anonymous access to the published world.
    // Only the path segment selects content. Never forward query parameters.
    return {
        props: {
            runtime: {
                kind: "awe-app" as const,
                url: `https://awe.box/play/${id}`,
            },
            lobbyWorld: true,
        },
    };
}
