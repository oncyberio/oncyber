import Head from "next/head";
import type { GetServerSideProps } from "next";
import GamePage from "@features/games/GamePage";
import GameDeviceGate from "@features/games/GameDeviceGate";
import GamePauseGate from "@features/games/GamePauseGate";
import {
    gamePause,
    pauseForRelease,
    type GamePause,
} from "@features/games/gameDisabled";
import {
    findSharedPageGame,
    gamesPreviewEnabled,
    type GameEntry,
} from "@features/games/catalog";
import type { GameFrame } from "@features/games/gameRelease";
import { loadGameFrame } from "@features/games/gameReleaseServer";

/** /games/<id>: a catalogued game, hidden until games launch. */
export default function GameRoute({
    game,
    pause,
    frame,
}: {
    game: GameEntry;
    pause: GamePause;
    frame: GameFrame;
}) {
    return (
        <>
            <Head>
                <title>{`${game.title} · Oncyber`}</title>
                <meta name="robots" content="noindex,nofollow" />
            </Head>
            <GameDeviceGate game={game}>
                <GamePauseGate game={game.id} title={game.title} pause={pause}>
                    <GamePage game={game} frame={frame} />
                </GamePauseGate>
            </GameDeviceGate>
        </>
    );
}

export const getServerSideProps: GetServerSideProps = async ({
    params,
    query,
}) => {
    const game = findSharedPageGame(params?.game);
    if (!game || !gamesPreviewEnabled()) return { notFound: true };
    // A hosted release when a person pointed the game at one, else the
    // committed build (docs/games/releases.md).
    const frame = await loadGameFrame(game.id, { draft: "draft" in query });
    // The kill switch stops the release this visit would load: a hosted
    // one is decided here, by the pointer's id.
    const pause = pauseForRelease(gamePause(game.id), frame.release);
    return { props: { game, pause, frame, lobbyWorld: true } };
};
