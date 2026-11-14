import Head from "next/head";
import PadelPreview from "@features/games/padel/PadelPreview";
import { gamesPreviewEnabled } from "@features/games/catalog";

/**
 * /games/padel: Glasshouse Padel brings its own club social layer, so it has
 * its own page instead of the shared GamePage. Hidden until games launch.
 */
export default function PadelRoute() {
    return (
        <>
            <Head>
                <title>Glasshouse · Padel · Oncyber</title>
                <meta name="robots" content="noindex,nofollow" />
            </Head>
            <PadelPreview />
        </>
    );
}

export function getServerSideProps() {
    return gamesPreviewEnabled()
        ? { props: { lobbyWorld: true } }
        : { notFound: true };
}
