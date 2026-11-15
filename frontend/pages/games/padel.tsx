import Head from "next/head";
import PadelPreview from "@features/games/padel/PadelPreview";
import { gamesPreviewEnabled } from "@features/games/catalog";
import GamePauseGate from "@features/games/GamePauseGate";
import { gamePause, type GamePause } from "@features/games/gameDisabled";

/**
 * /games/padel: Glasshouse Padel brings its own club social layer, so it has
 * its own page instead of the shared GamePage. Hidden until games launch.
 */
export default function PadelRoute({ pause }: { pause: GamePause }) {
    return (
        <>
            <Head>
                <title>Glasshouse · Padel · Oncyber</title>
                <meta name="robots" content="noindex,nofollow" />
            </Head>
            <GamePauseGate
                game="padel"
                title="Glasshouse · Padel"
                pause={pause}
            >
                <PadelPreview />
            </GamePauseGate>
        </>
    );
}

export function getServerSideProps() {
    return gamesPreviewEnabled()
        ? { props: { pause: gamePause("padel"), lobbyWorld: true } }
        : { notFound: true };
}
