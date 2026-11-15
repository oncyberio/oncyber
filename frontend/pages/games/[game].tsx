import Head from "next/head";
import type { GetServerSideProps } from "next";
import GamePage from "@features/games/GamePage";
import GamePauseGate from "@features/games/GamePauseGate";
import { gamePause, type GamePause } from "@features/games/gameDisabled";
import {
    findSharedPageGame,
    gamesPreviewEnabled,
    type GameEntry,
} from "@features/games/catalog";

/** /games/<id>: a catalogued game, hidden until games launch. */
export default function GameRoute({
    game,
    pause,
}: {
    game: GameEntry;
    pause: GamePause;
}) {
    return (
        <>
            <Head>
                <title>{`${game.title} · Oncyber`}</title>
                <meta name="robots" content="noindex,nofollow" />
            </Head>
            <GamePauseGate game={game.id} title={game.title} pause={pause}>
                <GamePage game={game} />
            </GamePauseGate>
        </>
    );
}

export const getServerSideProps: GetServerSideProps = async ({ params }) => {
    const game = findSharedPageGame(params?.game);
    if (!game || !gamesPreviewEnabled()) return { notFound: true };
    return { props: { game, pause: gamePause(game.id), lobbyWorld: true } };
};
