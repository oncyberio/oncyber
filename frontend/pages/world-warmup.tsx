/**
 * The world host's warm-up frame (features/worlds/worldWarmup.ts). The site
 * keeps it hidden and tells it which world a visitor is heading for; it
 * downloads the engine and that world's room model into this host's
 * caches, where the framed world will look for them. Anywhere but in the
 * site's frame on the world host it does nothing.
 */
import { useEffect } from "react";
import Head from "next/head";
import { warmDestination } from "@features/lobby/destinationWarmup";
import { LOBBY_ENTRY } from "@features/lobby/destinationWarmupSource";
import {
    connectionAllowsPrefetch,
    prefetchEngineChunks,
    readEngineChunkList,
} from "@features/lobby/enginePrefetch";
import { directEntry } from "@features/landing-carousel/warmSpace";
import { serveWorldWarmup } from "@features/worlds/worldWarmup";

export default function WorldWarmup() {
    useEffect(
        () =>
            serveWorldWarmup({
                engine() {
                    if (connectionAllowsPrefetch((navigator as any).connection))
                        prefetchEngineChunks(
                            document,
                            readEngineChunkList(document)
                        );
                },
                warm: (href, kind) =>
                    void warmDestination(
                        href,
                        kind === "direct" ? directEntry() : LOBBY_ENTRY
                    ),
            }),
        []
    );
    return (
        <Head>
            <meta name="robots" content="noindex" />
        </Head>
    );
}
