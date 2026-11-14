import Head from "next/head";
import type { GetServerSideProps } from "next";
import GamePage from "@features/games/GamePage";
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
    frame,
}: {
    game: GameEntry;
    frame: GameFrame;
}) {
    return (
        <>
            <Head>
                <title>{`${game.title} · Oncyber`}</title>
                <meta name="robots" content="noindex,nofollow" />
            </Head>
            <GamePage game={game} frame={frame} />
        </>
    );
}

export const getServerSideProps: GetServerSideProps = async ({
    params,
    query,
}) => {
    const game = findSharedPageGame(params?.game);
    if (!game || !gamesPreviewEnabled()) return { notFound: true };
    // A hosted release when the game has one, else the committed build.
    const frame = await loadGameFrame(game.id, { draft: "draft" in query });
    return { props: { game, frame, lobbyWorld: true } };
};
